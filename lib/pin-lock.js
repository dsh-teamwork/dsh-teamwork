/**
 * The PIN lock (the server's `docs/tech/shared-dsh.md`, "The PIN"): a second lock on a device that already proved its
 * key. Each member has one four-digit PIN, set from their own device and checked only here, inside the encrypted
 * channel; nothing is derived from it. Five wrong PINs lock that member on every device until whoever runs this DSH
 * clears it, and a forgotten PIN is cleared the same way. The file (`<cache>.pins.json`, mode 0600) keeps each PIN as
 * scrypt with its parameters and salt, and the failure count, so a restart neither forgets a lock nor resets the count.
 *
 * On a shared DSH a member is their account id; on a personal computer its one member is `owner`.
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
const scrypt = promisify(scryptCallback);
export const PIN = /^\d{4}$/;
export const MAX_FAILURES = 5;
/** How long an unlocked channel stays unlocked with nothing sent on it. */
export const IDLE_MS = 15 * 60 * 1000;
const PARAMS = { N: 16384, r: 8, p: 1 };
const entrySchema = z.object({ hash: z.string().optional(), salt: z.string().optional(), N: z.number().optional(), failures: z.number().int().min(0) });
const fileSchema = z.record(z.string(), entrySchema);
export const pinsPath = (cachePath) => cachePath.replace(/(\.json)?$/, '.pins.json');
async function pinEntry(pin) {
    if (!PIN.test(pin))
        throw new Error('A PIN is four digits.');
    const salt = randomBytes(16);
    const hash = await scrypt(pin, salt, 32, PARAMS);
    return { hash: hash.toString('base64'), salt: salt.toString('base64'), N: PARAMS.N, failures: 0 };
}
async function verify(entry, pin) {
    if (!entry?.hash || !entry.salt)
        return { ok: false, reason: 'unset' };
    if (entry.failures >= MAX_FAILURES)
        return { ok: false, reason: 'locked' };
    if (PIN.test(pin)) {
        const expected = Buffer.from(entry.hash, 'base64');
        const actual = await scrypt(pin, Buffer.from(entry.salt, 'base64'), expected.length, { ...PARAMS, N: entry.N ?? PARAMS.N });
        if (timingSafeEqual(expected, actual)) {
            entry.failures = 0;
            return { ok: true };
        }
    }
    entry.failures++;
    return entry.failures >= MAX_FAILURES ? { ok: false, reason: 'locked' } : { ok: false, reason: 'wrong', left: MAX_FAILURES - entry.failures };
}
export class PinStore {
    path;
    state;
    writes = Promise.resolve();
    constructor(path) {
        this.path = path;
    }
    load() {
        return (this.state ??= readFile(this.path, 'utf8').then((text) => fileSchema.parse(JSON.parse(text)), (error) => { if (error.code === 'ENOENT')
            return {}; throw error; }));
    }
    /** One change at a time, saved before its result is known, so no guess goes uncounted. */
    change(apply) {
        const task = this.writes.catch(() => { }).then(async () => {
            const state = structuredClone(await this.load());
            const result = await apply(state);
            await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
            const temporary = `${this.path}.${randomBytes(8).toString('hex')}.tmp`;
            try {
                await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
                await rename(temporary, this.path);
            }
            finally {
                await rm(temporary, { force: true });
            }
            this.state = Promise.resolve(state);
            return result;
        });
        this.writes = task;
        return task;
    }
    // Existing owner entries (including a locked owner) keep protection after an upgrade.
    async ownerEnabled() { return Object.hasOwn(await this.load(), 'owner'); }
    resetOwnerPin() {
        return this.change(state => { if (state.owner)
            state.owner = { failures: 0 }; });
    }
    /** Whether a member has set a PIN; one who has not is asked to set one. */
    async has(member) { return !!(await this.load())[member]?.hash; }
    async locked(member) { return ((await this.load())[member]?.failures ?? 0) >= MAX_FAILURES; }
    /** Checks a PIN, counting a wrong one before answering; a locked member is refused even the right one. */
    check(member, pin) {
        return this.change(state => verify(state[member], pin));
    }
    /** A local setting change is authorized by the host. */
    set(member, pin) {
        return this.change(async (state) => { state[member] = await pinEntry(pin); });
    }
    /** A device can change an existing PIN only with its old PIN, in the same serialized write. */
    replace(member, pin, old, requirePolicyEntry) {
        return this.change(async (state) => {
            const entry = state[member];
            if (!entry && requirePolicyEntry)
                return { ok: false, reason: 'unset' };
            if (entry?.hash) {
                const result = await verify(entry, old);
                if (!result.ok)
                    return result;
            }
            state[member] = await pinEntry(pin);
            return { ok: true };
        });
    }
    /** Clears a member's PIN and lock: their next connection sets a new one. */
    clear(member) { return this.change((state) => { delete state[member]; }); }
    /** Clear PIN records when switching shared hosting modes. */
    reset() {
        const task = this.writes.catch(() => { }).then(async () => {
            await rm(this.path, { force: true });
            this.state = Promise.resolve({});
        });
        this.writes = task;
        return task;
    }
}
//# sourceMappingURL=pin-lock.js.map