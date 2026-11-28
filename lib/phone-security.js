/** Local device trust and the only path from relay ciphertext into the DSH bridge. */
import { importAesKey } from './aes-gcm.js';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { SecureChannel, base64, deviceIdentity } from './secure-channel.js';
import { forwardedSchema } from './bridge.js';
import { IDLE_MS } from './pin-lock.js';
/** What a paired device is, as it says when it pairs: the phone app on iOS or Android, or a web browser. */
export const DEVICE_KINDS = ['ios', 'android', 'web'];
const deviceKind = (value) => DEVICE_KINDS.includes(value) ? value : undefined;
const fileSchema = z.object({
    seed: z.string(),
    peers: z.record(z.string(), z.object({ key: z.string(), name: z.string(), kind: z.enum(DEVICE_KINDS).optional() })),
});
export class PhoneKeys {
    path;
    state;
    writes = Promise.resolve();
    constructor(path) {
        this.path = path;
    }
    load() {
        return (this.state ??= (async () => {
            try {
                return fileSchema.parse(JSON.parse(await readFile(this.path, 'utf8')));
            }
            catch (error) {
                if (error.code !== 'ENOENT')
                    throw error;
                const state = { seed: base64(randomBytes(32)), peers: {} };
                await this.save(state);
                return state;
            }
        })());
    }
    save(state) {
        const contents = JSON.stringify(state);
        this.writes = this.writes
            .catch(() => { })
            .then(async () => {
            await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
            const temporary = `${this.path}.${randomBytes(8).toString('hex')}.tmp`;
            try {
                await writeFile(temporary, contents, { mode: 0o600 });
                await rename(temporary, this.path);
            }
            finally {
                await rm(temporary, { force: true });
            }
        });
        return this.writes;
    }
    async identity() {
        return deviceIdentity((await this.load()).seed);
    }
    async peer(scope, id) {
        return (await this.load()).peers[JSON.stringify([scope, id])];
    }
    updates = Promise.resolve();
    update(change) {
        const task = this.updates
            .catch(() => { })
            .then(async () => {
            const state = await this.load();
            const peers = { ...state.peers };
            change(peers);
            await this.save({ ...state, peers });
            state.peers = peers;
        });
        this.updates = task;
        return task;
    }
    trust(scope, id, key, name, kind) {
        return this.update((peers) => {
            peers[JSON.stringify([scope, id])] = { key, name, ...(kind ? { kind } : {}) };
        });
    }
    forget(scope, id) {
        return this.update((peers) => {
            delete peers[JSON.stringify([scope, id])];
        });
    }
    /** Forgets every phone of `scope` outside `kept`, and answers which ones went. */
    async forgetExcept(scope, kept) {
        const gone = [];
        await this.update((peers) => {
            for (const entry of Object.keys(peers)) {
                const [owner, id] = JSON.parse(entry);
                if (owner !== scope || kept.has(id))
                    continue;
                delete peers[entry];
                gone.push(id);
            }
        });
        return gone;
    }
}
export class PhoneSecurity {
    options;
    links = new Map();
    /**
     * When each pairing last carried work while unlocked. An unlock belongs to the device, not to one channel: a
     * channel the network dropped and the device opened again within the idle limit is not asked for the PIN again.
     * A wrong PIN, the idle limit, a revocation, a PIN change and signing out each forget it.
     */
    unlocks = new Map();
    opening = new Set();
    blocked = new Set();
    offer;
    epoch = 0;
    constructor(options) {
        this.options = options;
    }
    offerCode(expiresAt) {
        this.offer = { expires: Date.parse(expiresAt) };
    }
    async publicKey() {
        return (await this.options.keys.identity()).publicKey;
    }
    status(id) {
        const link = this.links.get(id);
        return {
            safetyCode: link?.code,
            phoneConfirmed: link?.phoneConfirmed ?? false,
            ...(link?.name ? { deviceName: link.name } : {}),
            ...(link?.kind ? { deviceKind: link.kind } : {}),
        };
    }
    async details(id) {
        const trusted = await this.options.keys.peer(await this.options.scope(), id);
        return {
            ...this.status(id),
            verified: !!trusted,
            ...(trusted ? { deviceName: trusted.name } : {}),
            ...(trusted?.kind ? { deviceKind: trusted.kind } : {}),
            ...(this.links.get(id)?.pending ? { status: 'pending' } : {}),
        };
    }
    async handle(frame) {
        if (frame.t !== 'sealed') {
            try {
                this.links.get(frame.pairingId)?.channel.close();
                if (frame.t === 'revoked')
                    await this.revoke(frame.pairingId);
            }
            catch (error) {
                this.options.error(error);
            }
            return;
        }
        if (this.blocked.has(frame.pairingId))
            return;
        const current = this.links.get(frame.pairingId);
        if (current?.channel && current.channelId === frame.channelId)
            return current.channel.receive(frame);
        // A new channel opens with a commitment (pairing, or a device without the pinned fast path) or straight with Noise
        // (a device both ends already trust: `pinned`, the platform's ADR 0071).
        if ((frame.kind !== 'commit' && frame.kind !== 'noise') || this.opening.has(frame.pairingId) || this.links.size >= 64)
            return;
        const epoch = this.epoch;
        this.opening.add(frame.pairingId);
        try {
            const scope = await this.options.scope();
            const trusted = await this.options.keys.peer(scope, frame.pairingId);
            const identity = await this.options.keys.identity();
            if (epoch !== this.epoch)
                return;
            const pinned = frame.kind === 'noise';
            if (pinned && !trusted)
                return;
            if (!trusted) {
                if (!this.offer ||
                    this.offer.expires < Date.now() ||
                    (this.offer.pairingId && this.offer.pairingId !== frame.pairingId))
                    return;
                this.offer.pairingId = frame.pairingId;
            }
            current?.channel.close();
            let link;
            const channel = new SecureChannel({
                pairingId: frame.pairingId,
                channelId: frame.channelId,
                initiator: false,
                identity,
                importAesKey,
                random: (n) => randomBytes(n),
                expectedKey: trusted?.key,
                pinned,
                send: this.options.send,
                ready: (key, code) => {
                    link.remoteKey = key;
                    link.code = code;
                    if (trusted) {
                        link.authorized = true;
                        channel.verified();
                        link.resumed = this.resume(frame.pairingId, link);
                    }
                    else
                        channel.send({ t: 'verify', code });
                    this.options.changed();
                },
                message: async (value) => {
                    const body = value;
                    if (body?.t === 'pairHello' &&
                        !link.authorized &&
                        typeof body.name === 'string' &&
                        body.name.length <= 100) {
                        link.name = body.name;
                        link.kind = deviceKind(body.kind);
                        this.options.changed();
                        return;
                    }
                    if (body?.t === 'pairConfirm' && !link.authorized) {
                        link.phoneConfirmed = true;
                        this.options.changed();
                        return;
                    }
                    if (!link.authorized)
                        throw new Error('device_not_verified');
                    if (body?.t === 'revoke') {
                        this.blocked.add(frame.pairingId);
                        this.unlocks.delete(frame.pairingId);
                        link.authorized = false;
                        this.options.forward({ t: 'detach', pairingId: frame.pairingId });
                        await this.options.keys.forget(link.scope, frame.pairingId);
                        channel.send({ t: 'revokedAck' });
                        const timer = setTimeout(() => channel.close(), 10000);
                        timer.unref?.();
                        return;
                    }
                    if (body?.t === 'unlock' || body?.t === 'setPin')
                        return this.pinMessage(frame.pairingId, link, body);
                    const inner = forwardedSchema.safeParse(value);
                    if (!inner.success ||
                        inner.data.pairingId !== frame.pairingId ||
                        !['call', 'mux'].includes(inner.data.t))
                        throw new Error('invalid_secure_message');
                    if (!(await this.open(frame.pairingId, link)))
                        return this.refuseLocked(link, inner.data);
                    if (this.links.get(frame.pairingId) === link)
                        this.options.forward(inner.data);
                },
                closed: (error) => {
                    if (this.links.get(frame.pairingId) === link) {
                        this.links.delete(frame.pairingId);
                        this.options.forward({ t: 'detach', pairingId: frame.pairingId });
                    }
                    this.options.changed();
                    if (error.message !== 'channel_closed')
                        this.options.error(error);
                },
            });
            link = {
                channel,
                channelId: frame.channelId,
                scope,
                phoneConfirmed: false,
                authorized: false,
                pending: !trusted,
            };
            this.links.set(frame.pairingId, link);
            channel.start();
            channel.receive(frame);
        }
        catch (error) {
            this.options.error(error);
        }
        finally {
            this.opening.delete(frame.pairingId);
        }
    }
    send(value) {
        const id = value?.pairingId;
        const link = id ? this.links.get(id) : undefined;
        if (link?.authorized) {
            try {
                link.channel.send(value);
            }
            catch (error) {
                link.channel.close(error);
            }
        }
    }
    async approve(id, safetyCode) {
        const link = this.links.get(id);
        if (!link?.pending || !link.phoneConfirmed || !link.remoteKey || !link.code || !link.name)
            throw new Error('Compare the security codes on both devices first.');
        if (safetyCode !== undefined && safetyCode !== link.code)
            throw new Error('The safety code changed. Compare it again.');
        await this.options.keys.trust(link.scope, id, link.remoteKey, link.name, link.kind);
        if (this.links.get(id) !== link)
            throw new Error('Device disconnected. Pair again.');
        // Both local approval and the relay's account authorization are required.
        await this.options.confirm(id);
        link.authorized = true;
        link.pending = false;
        link.channel.verified();
        link.channel.send({ t: 'pairAccepted' });
        void this.askPin(id, link);
        this.offer = undefined;
        this.options.changed();
    }
    async revoke(id) {
        this.unlocks.delete(id);
        // Keep an in-memory deny even when the durable write fails; never resume this live grant.
        if (this.links.has(id))
            this.blocked.add(id);
        this.links.get(id)?.channel.close();
        const scope = await this.options.scope();
        if (await this.options.keys.peer(scope, id)) {
            this.blocked.add(id);
            await this.options.keys.forget(scope, id);
        }
    }
    /**
     * The relay's list of this computer's unrevoked pairings: a phone trusted here but absent from it was
     * revoked while this computer was offline (the phone no longer waits for an acknowledgement), so its
     * trust goes now.
     */
    async reconcile(listed) {
        const gone = await this.options.keys.forgetExcept(await this.options.scope(), new Set(listed));
        for (const id of gone) {
            this.blocked.add(id);
            this.unlocks.delete(id);
            this.links.get(id)?.channel.close();
        }
    }
    now() { return this.options.now?.() ?? Date.now(); }
    /** Whether a channel may carry the member's work now: unlocked, and not idle past the limit. */
    async open(pairingId, link) {
        await link.resumed;
        if (!this.options.pins || (this.options.pinRequired && !await this.options.pinRequired()))
            return true;
        if (link.unlocked && this.now() - (link.lastActive ?? 0) <= IDLE_MS) {
            link.lastActive = this.now();
            this.unlocks.set(pairingId, link.lastActive);
            return true;
        }
        if (link.unlocked) {
            link.unlocked = false;
            this.unlocks.delete(pairingId);
            await this.askPin(pairingId, link);
        }
        return false;
    }
    /**
     * A new channel of a trusted device: `secureReady`, then whether it is still unlocked (its last unlock has not gone
     * idle) or must give the PIN. Decided before either is sent, so no work it sends meanwhile is refused as locked.
     */
    async resume(pairingId, link) {
        const last = this.unlocks.get(pairingId);
        let still = false;
        try {
            const required = this.options.pins && (!this.options.pinRequired || await this.options.pinRequired());
            still = !!required && last !== undefined && this.now() - last <= IDLE_MS && !await this.options.pins.locked();
        }
        catch (error) {
            this.options.error(error);
        }
        if (this.links.get(pairingId) !== link)
            return;
        try {
            link.channel.send({ t: 'secureReady' });
        }
        catch {
            return;
        }
        if (still) {
            link.unlocked = true;
            link.lastActive = last;
            return link.channel.send({ t: 'unlocked' });
        }
        this.unlocks.delete(pairingId);
        await this.askPin(pairingId, link);
    }
    /** Tells the device a PIN is needed: to enter it, or that the lock holds until the owner sets one here. */
    async askPin(pairingId, link) {
        const { pins } = this.options;
        if (!pins)
            return;
        try {
            if (this.options.pinRequired && !await this.options.pinRequired()) {
                link.channel.send({ t: 'unlocked' });
                return;
            }
            link.channel.send(await pins.locked() || !await pins.has() ? { t: 'pinLocked' } : { t: 'pinRequired', set: false });
        }
        catch (error) {
            this.options.error(error);
        }
    }
    /**
     * `unlock` with the PIN. A device never sets the PIN (`setPin` is answered as if asked again): the owner sets it in
     * the panel on this computer.
     */
    async pinMessage(pairingId, link, body) {
        const pins = this.options.pins;
        if (!pins)
            return;
        if (this.options.pinRequired && !await this.options.pinRequired())
            return link.channel.send({ t: 'unlocked' });
        if (body.t === 'setPin')
            return this.askPin(pairingId, link);
        const result = await pins.check(typeof body.pin === 'string' ? body.pin : '');
        if (this.links.get(pairingId) !== link)
            return;
        if (!result.ok) {
            if (link.unlocked)
                this.options.forward({ t: 'detach', pairingId });
            link.unlocked = false;
            this.unlocks.delete(pairingId);
            if (result.reason === 'locked')
                this.relockOtherChannels(pairingId);
            if (result.reason === 'unset')
                return this.askPin(pairingId, link);
            return link.channel.send(result.reason === 'wrong' ? { t: 'pinWrong', left: result.left } : { t: 'pinLocked' });
        }
        link.unlocked = true;
        link.lastActive = this.now();
        this.unlocks.set(pairingId, link.lastActive);
        link.channel.send({ t: 'unlocked' });
    }
    relockOtherChannels(current) {
        for (const [id, link] of this.links) {
            if (id === current || !link.authorized)
                continue;
            link.unlocked = false;
            this.unlocks.delete(id);
            this.options.forward({ t: 'detach', pairingId: id });
            void this.askPin(id, link);
        }
    }
    /** What a locked channel answers its member's work with: the call fails, the stream ends, and nothing reaches DSH. */
    refuseLocked(link, frame) {
        if (frame.t === 'call')
            link.channel.send({ t: 'result', pairingId: frame.pairingId, id: frame.id, status: 200, body: { result: { ok: false, error: { code: 'teamwork/locked' } } } });
        const mux = frame.t === 'mux' ? frame.body : null;
        if (mux?.type === 'open' && mux.streamId)
            link.channel.send({ t: 'mux', pairingId: frame.pairingId, body: { type: 'error', streamId: mux.streamId, error: { code: 'locked', message: 'locked', details: {} } } });
    }
    /** Signed out, or the PIN changed: every channel closes and every device is asked for the PIN again. */
    reset() {
        this.unlocks.clear();
        this.drop();
    }
    /**
     * The relay connection dropped: every channel closes, and a device that comes back within the idle limit stays
     * unlocked.
     */
    drop() {
        this.epoch++;
        this.offer = undefined;
        for (const link of this.links.values())
            link.channel.close();
        this.links.clear();
        this.opening.clear();
    }
}
//# sourceMappingURL=phone-security.js.map