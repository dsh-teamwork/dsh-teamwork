/**
 * The PIN lock: a second lock on a device that already proved its key. The owner of this computer sets one four-digit
 * PIN in the Teamwork panel; a paired device gives it inside the encrypted channel, where it is checked only here, and
 * nothing is derived from it. Five wrong PINs lock every device until the owner clears the lock here
 * (`/teamwork pin reset`), and a forgotten PIN is cleared the same way. The file (`<cache>.pins.json`, mode
 * 0600) keeps the PIN as scrypt with its parameters and salt, and the failure count, so a restart neither forgets a
 * lock nor resets the count. It is keyed `owner`, the one entry it holds.
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

const OWNER = 'owner';

export const pinsPath = (cachePath: string) => cachePath.replace(/(\.json)?$/, '.pins.json');

export type PinCheck = { ok: true } | { ok: false; reason: 'unset' | 'locked' } | { ok: false; reason: 'wrong'; left: number };

async function pinEntry(pin: string): Promise<Entry> {
  if (!PIN.test(pin)) throw new Error('A PIN is four digits.');
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32, PARAMS);
  return { hash: hash.toString('base64'), salt: salt.toString('base64'), N: PARAMS.N, failures: 0 };
}

async function verify(entry: Entry | undefined, pin: string): Promise<PinCheck> {
  if (!entry?.hash || !entry.salt) return { ok: false, reason: 'unset' };
  if (entry.failures >= MAX_FAILURES) return { ok: false, reason: 'locked' };
  if (PIN.test(pin)) {
    const expected = Buffer.from(entry.hash, 'base64');
    const actual = await scrypt(pin, Buffer.from(entry.salt, 'base64'), expected.length, { ...PARAMS, N: entry.N ?? PARAMS.N });
    if (timingSafeEqual(expected, actual)) { entry.failures = 0; return { ok: true }; }
  }
  entry.failures++;
  return entry.failures >= MAX_FAILURES ? { ok: false, reason: 'locked' } : { ok: false, reason: 'wrong', left: MAX_FAILURES - entry.failures };
}

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
      const state = structuredClone(await this.load());
      const result = await apply(state);
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      const temporary = `${this.path}.${randomBytes(8).toString('hex')}.tmp`;
      try { await writeFile(temporary, JSON.stringify(state), { mode: 0o600 }); await rename(temporary, this.path); }
      finally { await rm(temporary, { force: true }); }
      this.state = Promise.resolve(state);
      return result;
    });
    this.writes = task;
    return task;
  }

  /** Whether the PIN lock is on: an entry exists, even one whose PIN was reset or that is locked. */
  async enabled() { return Object.hasOwn(await this.load(), OWNER); }

  /** Whether a PIN is set; a reset one is not until the owner sets it again. */
  async has() { return !!(await this.load())[OWNER]?.hash; }
  async locked() { return ((await this.load())[OWNER]?.failures ?? 0) >= MAX_FAILURES; }

  /** Checks a PIN, counting a wrong one before answering; a locked PIN refuses even the right one. */
  check(pin: string): Promise<PinCheck> {
    return this.change(state => verify(state[OWNER], pin));
  }

  /** Sets the PIN, from the panel on this computer. */
  set(pin: string) {
    return this.change(async state => { state[OWNER] = await pinEntry(pin); });
  }

  /** Clears the PIN and its lock but keeps the lock on: no device works until the owner sets a new one. */
  resetPin() {
    return this.change(state => { if (state[OWNER]) state[OWNER] = { failures: 0 }; });
  }

  /** Turns the PIN lock off. */
  clear() { return this.change((state) => { delete state[OWNER]; }); }
}
