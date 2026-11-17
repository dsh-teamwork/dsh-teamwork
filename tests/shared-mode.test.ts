import { createPublicKey, verify } from 'node:crypto';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deviceIdentity, base64 } from '../src/secure-channel.js';
import { SharedMode, SharedKeyError, sharedKeyPath, signedExchange } from '../src/shared-mode.js';

const server = 'https://teamwork.test';
const hostId = 'a1b2c3';
const key = `dshh_${hostId}_${'k'.repeat(43)}`;

/** The server's side of the exchange: it checks the signature against the bound key, as the relay does. */
function fakeServer(options: { refuse?: number } = {}) {
  let bound: string | undefined;
  const calls: string[] = [];
  const request = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push(url.replace(server, ''));
    if (url.endsWith('/challenge')) return Response.json({ nonce: `n-${calls.length}`, expiresAt: '' });
    if (options.refuse) return Response.json({ error: 'refused' }, { status: options.refuse });
    const raw = Buffer.from(body.publicKey, 'base64');
    const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw]), format: 'der', type: 'spki' });
    const ok = verify(null, signedExchange(body.nonce, hostId, server), publicKey, Buffer.from(body.signature, 'base64'));
    if (!ok || body.key !== key) return Response.json({ error: 'host_key_invalid' }, { status: 401 });
    bound ??= body.publicKey;
    if (bound !== body.publicKey) return Response.json({ error: 'host_bound_elsewhere' }, { status: 403 });
    return Response.json({ token: `token-${calls.length}`, expiresAt: new Date(Date.now() + 3600_000).toISOString(), hostId, teamId: 'team-1', name: 'Build box' });
  }) as unknown as typeof fetch;
  return { request, calls };
}

async function setup(request: typeof fetch, seed = base64(new Uint8Array(32).fill(7))) {
  const dir = await mkdtemp(join(tmpdir(), 'shared-mode-'));
  const tokens: (string | undefined)[] = [];
  const mode = new SharedMode({ path: sharedKeyPath(join(dir, 'teamwork-cache.json')), server: () => server, identity: () => deviceIdentity(seed), onToken: async t => { tokens.push(t); }, request });
  return { dir, mode, tokens, path: sharedKeyPath(join(dir, 'teamwork-cache.json')) };
}

describe('shared mode', () => {
  it('trades the key for a host token with a signature of this identity, and keeps the key only once accepted', async () => {
    const fake = fakeServer();
    const { mode, tokens, path } = await setup(fake.request);
    await mode.enable(`  ${key}\n`);
    try {
      expect(tokens).toEqual(['token-2']);
      expect(fake.calls).toEqual(['/relay/shared/challenge', '/relay/shared/token']);
      expect(mode.status()).toMatchObject({ enabled: true, hostId, teamId: 'team-1', name: 'Build box' });
      expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ key });
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    } finally { mode.stop(); }
  });

  it('resumes from the saved key on the same machine, and another machine is refused', async () => {
    const fake = fakeServer();
    const first = await setup(fake.request);
    await first.mode.enable(key); first.mode.stop();
    const again = new SharedMode({ path: first.path, server: () => server, identity: () => deviceIdentity(base64(new Uint8Array(32).fill(7))), onToken: async t => { first.tokens.push(t); }, request: fake.request });
    await again.restore(); again.stop();
    expect(first.tokens.at(-1)).toMatch(/^token-/);
    const other = await setup(fake.request, base64(new Uint8Array(32).fill(9)));
    await expect(other.mode.enable(key)).rejects.toMatchObject({ code: 'elsewhere' });
    expect(other.mode.enabled).toBe(false);
    expect(existsSync(other.path)).toBe(false);
  });

  it('refuses a malformed key without asking the server, and a rejected key is never saved', async () => {
    const fake = fakeServer({ refuse: 401 });
    const { mode, tokens, path } = await setup(fake.request);
    await expect(mode.enable('dsh_not_a_key')).rejects.toBeInstanceOf(SharedKeyError);
    expect(fake.calls).toEqual([]);
    await expect(mode.enable(key)).rejects.toMatchObject({ code: 'invalid' });
    expect(tokens).toEqual([undefined]);
    expect(mode.enabled).toBe(false);
    expect(existsSync(path)).toBe(false);
  });

  it('deletes the key and drops the token when turned off', async () => {
    const { mode, tokens, path } = await setup(fakeServer().request);
    await mode.enable(key);
    await mode.disable();
    expect(tokens.at(-1)).toBeUndefined();
    expect(mode.status()).toEqual({ enabled: false });
    expect(existsSync(path)).toBe(false);
  });
});
