/**
 * A shared DSH's own roster (the server's `docs/tech/shared-dsh.md`, "Two lists" and "Pairing by invite"): who may act
 * on this DSH, which the server's access list alone never decides. It holds the invites the admin created here, each
 * member's paired devices, and which member started each session. It lives beside the cache
 * (`<cache>.shared-roster.json`, mode 0600) and is written atomically; nothing in it leaves this machine.
 *
 * An invite is a single-use secret for one member, valid for a day. Only its hash is kept. The member's device sends
 * the secret inside the encrypted channel, after pinning this DSH's key from the same invite, so only this DSH reads it.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const fileSchema = z.object({
    invites: z.record(z.string(), z.object({ userId: z.string(), email: z.string(), secretHash: z.string(), expiresAt: z.number() })),
    /** pairing id → the member whose device it is. */
    devices: z.record(z.string(), z.object({ userId: z.string(), name: z.string() })),
    /** session id → the member who started it. */
    owners: z.record(z.string(), z.string()),
});
const empty = () => ({ invites: {}, devices: {}, owners: {} });
export const sharedRosterPath = (cachePath) => cachePath.replace(/(\.json)?$/, '.shared-roster.json');
const hash = (secret) => createHash('sha256').update(secret).digest('hex');
export class SharedRoster {
    path;
    now;
    state;
    writes = Promise.resolve();
    constructor(path, now = Date.now) {
        this.path = path;
        this.now = now;
    }
    load() {
        return (this.state ??= readFile(this.path, 'utf8').then((text) => fileSchema.parse(JSON.parse(text)), (error) => { if (error.code === 'ENOENT')
            return empty(); throw error; }));
    }
    /** One change at a time, saved before the next begins. */
    change(apply) {
        const task = this.writes.catch(() => { }).then(async () => {
            const state = await this.load();
            const result = apply(state);
            await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
            const temporary = `${this.path}.${randomBytes(8).toString('hex')}.tmp`;
            try {
                await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
                await rename(temporary, this.path);
            }
            finally {
                await rm(temporary, { force: true });
            }
            return result;
        });
        this.writes = task;
        return task;
    }
    /** A new invite for a member; the secret is returned once and never kept. */
    invite(member) {
        const id = randomBytes(9).toString('base64url'), secret = randomBytes(16).toString('base64url');
        return this.change((state) => {
            for (const [key, old] of Object.entries(state.invites))
                if (old.expiresAt < this.now())
                    delete state.invites[key];
            state.invites[id] = { userId: member.userId, email: member.email, secretHash: hash(secret), expiresAt: this.now() + INVITE_TTL_MS };
            return { id, secret, expiresAt: state.invites[id].expiresAt };
        });
    }
    /**
     * Spends an invite for a device when it is unspent, unexpired, for this member, and the secret matches its hash: the
     * device then belongs to the member. False changes nothing, so a wrong guess cannot spend someone's invite.
     */
    accept(input) {
        return this.change((state) => {
            const invite = state.invites[input.inviteId];
            if (!invite || invite.expiresAt < this.now() || invite.userId !== input.userId)
                return false;
            const want = Buffer.from(invite.secretHash, 'hex'), got = Buffer.from(hash(input.secret), 'hex');
            if (want.length !== got.length || !timingSafeEqual(want, got))
                return false;
            delete state.invites[input.inviteId];
            state.devices[input.pairingId] = { userId: input.userId, name: input.deviceName };
            return true;
        });
    }
    /** The member a paired device belongs to. */
    async memberOf(pairingId) { return (await this.load()).devices[pairingId]?.userId; }
    async ownerOf(sessionId) { return (await this.load()).owners[sessionId]; }
    claim(sessionId, userId) { return this.change((state) => { state.owners[sessionId] ??= userId; }); }
    async devices() { return (await this.load()).devices; }
    forgetDevice(pairingId) { return this.change((state) => { delete state.devices[pairingId]; }); }
    /**
     * Keeps only the members the server still lists: their devices stay, everyone else's go, with their unspent
     * invites. Sessions keep their owners, so a member who comes back finds them. Returns the pairings dropped.
     */
    prune(allowed) {
        return this.change((state) => {
            const dropped = [];
            for (const [pairingId, device] of Object.entries(state.devices))
                if (!allowed.has(device.userId)) {
                    delete state.devices[pairingId];
                    dropped.push(pairingId);
                }
            for (const [id, invite] of Object.entries(state.invites))
                if (!allowed.has(invite.userId))
                    delete state.invites[id];
            return dropped;
        });
    }
    /** Shared mode ended: the roster goes with it. */
    async clear() { this.state = Promise.resolve(empty()); await rm(this.path, { force: true }); }
}
//# sourceMappingURL=shared-roster.js.map