/**
 * Shared mode (the server's `docs/tech/shared-dsh.md`): this DSH is a team's, signed in by a team host
 * key instead of a person. The key is kept beside the cache (`<cache>.shared.json`, mode 0600) and traded for a host token
 * (platform ADR 0047): the server sends a nonce, this DSH signs it with its identity key, and the first exchange binds the
 * key to that identity, so the key copied to another machine is refused. The token lasts an hour and is renewed before it ends.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { Identity } from './secure-channel.js';

const KEY = /^dshh_([0-9a-f]{1,32})_[A-Za-z0-9_-]{43}$/;
const fileSchema = z.object({ key: z.string().regex(KEY) });
const challengeSchema = z.object({ nonce: z.string().min(1).max(200) });
const tokenSchema = z.object({ token: z.string().min(1), expiresAt: z.string(), hostId: z.string(), teamId: z.string(), name: z.string() });
/** Renew this long before the token ends, and retry this soon after a failure that may pass. */
const RENEW_BEFORE_MS = 10 * 60 * 1000;
const RETRY_MS = 60 * 1000;

export const sharedKeyPath = (cachePath: string) => cachePath.replace(/(\.json)?$/, '.shared.json');

/** What the server's refusal means for the key: `invalid` (unknown, rotated or deleted) and `elsewhere` stop renewal. */
export class SharedKeyError extends Error {
  constructor(readonly code: 'format' | 'invalid' | 'elsewhere' | 'unavailable', message: string) { super(message); }
}

/** The bytes the identity key signs: the nonce, the host and the server, so a signature is good for one exchange only. */
export const signedExchange = (nonce: string, hostId: string, server: string) => new TextEncoder().encode(`dsh-teamwork shared host\n${nonce}\n${hostId}\n${server}`);

export interface SharedStatus { enabled: boolean; hostId?: string; teamId?: string; name?: string; expiresAt?: string; error?: string }

export interface SharedModeOptions {
  path: string;
  /** The server this DSH talks to, as `TeamworkClient.endpoint` names it; it is the APP_URL the signature names. */
  server: () => string;
  identity: () => Promise<Identity>;
  /** Hears each new host token, and `undefined` when shared mode ends or its key is refused for good. */
  onToken: (token: string | undefined) => Promise<void>;
  request?: typeof fetch;
  log?: (message: string) => void;
  now?: () => number;
}

export class SharedMode {
  private key?: string;
  private state: Omit<SharedStatus, 'enabled'> = {};
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  constructor(private readonly options: SharedModeOptions) {}

  get enabled() { return this.key !== undefined; }
  status(): SharedStatus { return { enabled: this.enabled, ...this.state }; }

  /** Resumes shared mode from the saved key, if there is one. A refused key stays saved, so the status says why. */
  async restore() {
    let saved: string | undefined;
    try { saved = fileSchema.parse(JSON.parse(await readFile(this.options.path, 'utf8'))).key; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    this.key = saved;
    await this.renew(++this.generation).catch(() => { /* the status holds the reason */ });
  }

  /** Turns shared mode on with a key: it is saved only once the server accepts it for this machine. */
  async enable(input: string) {
    const key = input.trim();
    if (!KEY.test(key)) throw new SharedKeyError('format', 'That is not a team host key. Copy it again from the team console.');
    const generation = ++this.generation;
    this.stopTimer();
    const previous = this.key;
    this.key = key;
    try { await this.renew(generation); }
    catch (error) { this.key = previous; throw error; }
    await mkdir(dirname(this.options.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.options.path}.${randomBytes(8).toString('hex')}.tmp`;
    try { await writeFile(temporary, JSON.stringify({ key }), { mode: 0o600 }); await rename(temporary, this.options.path); }
    finally { await rm(temporary, { force: true }); }
  }

  /** Turns shared mode off: the key is deleted and the host token dropped. */
  async disable() {
    this.generation++;
    this.stopTimer();
    this.key = undefined; this.state = {};
    await rm(this.options.path, { force: true });
    await this.options.onToken(undefined);
  }

  stop() { this.generation++; this.stopTimer(); }

  private stopTimer() { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }

  private schedule(generation: number, delay: number) {
    this.stopTimer();
    this.timer = setTimeout(() => { void this.renew(generation).catch(() => {}); }, Math.max(1000, delay));
    this.timer.unref?.();
  }

  private async renew(generation: number) {
    const key = this.key;
    if (!key || generation !== this.generation) return;
    const hostId = KEY.exec(key)![1]!;
    try {
      const issued = await this.exchange(key, hostId);
      if (generation !== this.generation) return;
      this.state = { hostId: issued.hostId, teamId: issued.teamId, name: issued.name, expiresAt: issued.expiresAt };
      await this.options.onToken(issued.token);
      const now = this.options.now?.() ?? Date.now();
      this.schedule(generation, Date.parse(issued.expiresAt) - now - RENEW_BEFORE_MS);
    } catch (error) {
      if (generation !== this.generation) return;
      const failure = error instanceof SharedKeyError ? error : new SharedKeyError('unavailable', 'The Teamwork server could not be reached. Retrying in a minute.');
      this.state = { ...this.state, error: failure.message };
      this.options.log?.(`shared mode: ${failure.message}`);
      if (failure.code === 'unavailable') this.schedule(generation, RETRY_MS);
      else await this.options.onToken(undefined);
      throw failure;
    }
  }

  private async exchange(key: string, hostId: string) {
    const server = this.options.server(), request = this.options.request ?? fetch;
    const post = (path: string, body: unknown) => request(`${server}/relay/shared/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    const challenge = await post('challenge', { key });
    if (challenge.status === 404) throw new SharedKeyError('invalid', 'This Teamwork server does not offer Team DSHs.');
    if (!challenge.ok) throw new SharedKeyError(challenge.status === 400 ? 'format' : 'unavailable', 'The Teamwork server refused the challenge.');
    const { nonce } = challengeSchema.parse(await challenge.json());
    const identity = await this.options.identity();
    const signature = await identity.privateKey.sign(signedExchange(nonce, hostId, server));
    const response = await post('token', {
      key, nonce,
      publicKey: Buffer.from(identity.privateKey.publicKey.raw).toString('base64'),
      signature: Buffer.from(signature).toString('base64'),
    });
    if (response.status === 401) throw new SharedKeyError('invalid', 'The team host key is not valid: it was rotated, deleted, or mistyped. Ask a team admin for the current key.');
    if (response.status === 403) throw new SharedKeyError('elsewhere', 'This team host key is already used by another machine. Ask a team admin to create a new key for this one.');
    if (!response.ok) throw new SharedKeyError('unavailable', 'The Teamwork server could not issue a host token.');
    return tokenSchema.parse(await response.json());
  }
}
