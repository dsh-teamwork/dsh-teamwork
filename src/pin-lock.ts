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

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }) => Promise<Buffer>;

export const PIN = /^\d{4}$/;
export const MAX_FAILURES = 5;
/** How long an unlocked channel stays unlocked with nothing sent on it. */
export const IDLE_MS = 15 * 60 * 1000;
const PARAMS = { N: 16384, r: 8, p: 1 };

const entrySchema = z.object({ hash: z.string().optional(), salt: z.string().optional(), N: z.number().optional(), failures: z.number().int().min(0) });
const fileSchema = z.record(z.string(), entrySchema);
type Entry = z.infer<typeof entrySchema>;

export const pinsPath = (cachePath: string) => cachePath.replace(/(\.json)?$/, '.pins.json');

export type PinCheck = { ok: true } | { ok: false; reason: 'unset' | 'locked' } | { ok: false; reason: 'wrong'; left: number };

export class PinStore {
  private state?: Promise<Record<string, Entry>>;
  private writes: Promise<unknown> = Promise.resolve();
  constructor(private readonly path: string) {}

  private load(): Promise<Record<string, Entry>> {
    return (this.state ??= readFile(this.path, 'utf8').then(
      (text) => fileSchema.parse(JSON.parse(text)),
      (error: NodeJS.ErrnoException): Record<string, Entry> => { if (error.code === 'ENOENT') return {}; throw error; },
    ));
  }

  /** One change at a time, saved before its result is known, so no guess goes uncounted. */
  private change<T>(apply: (state: Record<string, Entry>) => Promise<T> | T): Promise<T> {
    const task = this.writes.catch(() => {}).then(async () => {
      const state = await this.load();
      const result = await apply(state);
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      const temporary = `${this.path}.${randomBytes(8).toString('hex')}.tmp`;
      try { await writeFile(temporary, JSON.stringify(state), { mode: 0o600 }); await rename(temporary, this.path); }
      finally { await rm(temporary, { force: true }); }
      return result;
    });
    this.writes = task;
    return task;
  }

  /** Whether a member has set a PIN; one who has not is asked to set one. */
  async has(member: string) { return !!(await this.load())[member]?.hash; }
  async locked(member: string) { return ((await this.load())[member]?.failures ?? 0) >= MAX_FAILURES; }

  /** Checks a PIN, counting a wrong one before answering; a locked member is refused even the right one. */
  check(member: string, pin: string): Promise<PinCheck> {
    return this.change(async (state) => {
      const entry = state[member];
      if (!entry?.hash || !entry.salt) return { ok: false as const, reason: 'unset' as const };
      if (entry.failures >= MAX_FAILURES) return { ok: false as const, reason: 'locked' as const };
      const want = Buffer.from(entry.hash, 'base64');
      const got = PIN.test(pin) ? await scrypt(pin, Buffer.from(entry.salt, 'base64'), want.length, { ...PARAMS, N: entry.N ?? PARAMS.N }) : Buffer.alloc(want.length);
      if (PIN.test(pin) && timingSafeEqual(want, got)) { entry.failures = 0; return { ok: true as const }; }
      entry.failures += 1;
      return entry.failures >= MAX_FAILURES ? { ok: false as const, reason: 'locked' as const } : { ok: false as const, reason: 'wrong' as const, left: MAX_FAILURES - entry.failures };
    });
  }

  /** Sets a member's PIN. Only for one with none yet, or after `check` passed with the old one. */
  set(member: string, pin: string) {
    if (!PIN.test(pin)) return Promise.reject(new Error('A PIN is four digits.'));
    return this.change(async (state) => {
      const salt = randomBytes(16);
      state[member] = { hash: (await scrypt(pin, salt, 32, PARAMS)).toString('base64'), salt: salt.toString('base64'), N: PARAMS.N, failures: 0 };
    });
  }

  /** Clears a member's PIN and lock: their next connection sets a new one. */
  clear(member: string) { return this.change((state) => { delete state[member]; }); }

  /** Shared mode ended, or this DSH changed hands: every PIN goes. */
  async reset() { this.state = Promise.resolve({}); await rm(this.path, { force: true }); }
}
