/** Local device trust and the only path from relay ciphertext into the DSH bridge. */
import { importAesKey } from './aes-gcm.js';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { SecureChannel, base64, deviceIdentity } from './secure-channel.js';
import { forwardedSchema } from './bridge.js';
import { IDLE_MS, PIN } from './pin-lock.js';
const fileSchema = z.object({
    seed: z.string(),
    peers: z.record(z.string(), z.object({ key: z.string(), name: z.string() })),
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
    trust(scope, id, key, name) {
        return this.update((peers) => {
            peers[JSON.stringify([scope, id])] = { key, name };
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
        };
    }
    async details(id) {
        const trusted = await this.options.keys.peer(await this.options.scope(), id);
        return {
            ...this.status(id),
            verified: !!trusted,
            ...(trusted ? { deviceName: trusted.name } : {}),
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
        if (frame.kind !== 'commit' || this.opening.has(frame.pairingId) || this.links.size >= 64)
            return;
        const epoch = this.epoch;
        this.opening.add(frame.pairingId);
        try {
            const scope = await this.options.scope();
            const trusted = await this.options.keys.peer(scope, frame.pairingId);
            const identity = await this.options.keys.identity();
            if (epoch !== this.epoch)
                return;
            const joining = trusted ? undefined : this.options.joining?.(frame.pairingId);
            if (!trusted && !joining) {
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
                send: this.options.send,
                ready: (key, code) => {
                    link.remoteKey = key;
                    link.code = code;
                    if (trusted) {
                        link.authorized = true;
                        channel.verified();
                        channel.send({ t: 'secureReady' });
                        void this.askPin(frame.pairingId, link);
                    }
                    else if (!link.joining)
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
                        this.options.changed();
                        return;
                    }
                    if (body?.t === 'shareJoin' && link.joining && !link.authorized) {
                        const input = { inviteId: body.invite, secret: body.secret, name: body.name };
                        const valid = Object.values(input).every((v) => typeof v === 'string' && v.length > 0 && v.length <= 100);
                        const admitted = valid && link.remoteKey && await this.options.admit?.({ pairingId: frame.pairingId, userId: link.joining, ...input });
                        if (!admitted) {
                            channel.send({ t: 'joinRefused' });
                            throw new Error('invite_refused');
                        }
                        await this.options.keys.trust(link.scope, frame.pairingId, link.remoteKey, input.name);
                        await this.options.confirm(frame.pairingId);
                        link.name = input.name;
                        link.authorized = true;
                        link.pending = false;
                        channel.verified();
                        channel.send({ t: 'pairAccepted' });
                        void this.askPin(frame.pairingId, link);
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
                ...(joining ? { joining } : {}),
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
    async approve(id) {
        const link = this.links.get(id);
        if (!link?.pending || !link.phoneConfirmed || !link.remoteKey || !link.code || !link.name)
            throw new Error('Compare the security codes on both devices first.');
        await this.options.keys.trust(link.scope, id, link.remoteKey, link.name);
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
            this.links.get(id)?.channel.close();
        }
    }
    now() { return this.options.now?.() ?? Date.now(); }
    /** Whether a channel may carry the member's work now: unlocked, and not idle past the limit. */
    async open(pairingId, link) {
        if (!this.options.pins)
            return true;
        if (link.unlocked && this.now() - (link.lastActive ?? 0) <= IDLE_MS) {
            link.lastActive = this.now();
            return true;
        }
        if (link.unlocked) {
            link.unlocked = false;
            await this.askPin(pairingId, link);
        }
        return false;
    }
    /** Tells the phone a PIN is needed: to set one, to enter it, or that the member is locked out. */
    async askPin(pairingId, link) {
        const { pins } = this.options;
        if (!pins)
            return;
        try {
            const member = await this.options.pinMember?.(pairingId);
            if (!member)
                return;
            link.channel.send(await pins.locked(member) ? { t: 'pinLocked' } : { t: 'pinRequired', set: !(await pins.has(member)) });
        }
        catch (error) {
            this.options.error(error);
        }
    }
    /** `unlock` with the PIN, or `setPin`: the first PIN, or a new one with the old. */
    async pinMessage(pairingId, link, body) {
        const pins = this.options.pins, member = await this.options.pinMember?.(pairingId);
        if (!pins || !member)
            return;
        const pin = typeof body.pin === 'string' ? body.pin : '';
        if (body.t === 'setPin' && !PIN.test(pin))
            return link.channel.send({ t: 'pinInvalid' });
        if (body.t === 'setPin' && !(await pins.has(member))) {
            await pins.set(member, pin);
        }
        else {
            const result = await pins.check(member, body.t === 'setPin' ? (typeof body.old === 'string' ? body.old : '') : pin);
            if (!result.ok) {
                link.unlocked = false;
                if (result.reason === 'unset')
                    return link.channel.send({ t: 'pinRequired', set: true });
                return link.channel.send(result.reason === 'wrong' ? { t: 'pinWrong', left: result.left } : { t: 'pinLocked' });
            }
            if (body.t === 'setPin')
                await pins.set(member, pin);
        }
        link.unlocked = true;
        link.lastActive = this.now();
        link.channel.send({ t: 'unlocked' });
    }
    /** What a locked channel answers its member's work with: the call fails, the stream ends, and nothing reaches DSH. */
    refuseLocked(link, frame) {
        if (frame.t === 'call')
            link.channel.send({ t: 'result', pairingId: frame.pairingId, id: frame.id, status: 200, body: { result: { ok: false, error: { code: 'teamwork/locked' } } } });
        const mux = frame.t === 'mux' ? frame.body : null;
        if (mux?.type === 'open' && mux.streamId)
            link.channel.send({ t: 'mux', pairingId: frame.pairingId, body: { type: 'error', streamId: mux.streamId, error: { code: 'locked', message: 'locked', details: {} } } });
    }
    reset() {
        this.epoch++;
        this.offer = undefined;
        for (const link of this.links.values())
            link.channel.close();
        this.links.clear();
        this.opening.clear();
    }
}
//# sourceMappingURL=phone-security.js.map