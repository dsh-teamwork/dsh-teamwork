import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TeamworkClient } from '../src/client.js';
import { watchTokenFile } from '../src/token-file.js';

const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise(resolve => setTimeout(resolve, 10));
  expect(check()).toBe(true);
};

describe('a token the host provides in a file', () => {
  it('is read at once, followed through rewrites and atomic replacement, and reported only when it changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'token-file-'));
    const path = join(dir, 'token');
    const seen: (string | undefined)[] = [];
    const errors: Error[] = [];
    await writeFile(path, ' first\n');
    const watcher = watchTokenFile(path, async token => { seen.push(token); }, error => errors.push(error), 20);
    try {
      await watcher.ready;
      expect(seen).toEqual(['first']);
      await writeFile(join(dir, 'next'), 'second');
      await rename(join(dir, 'next'), path);
      await until(() => seen.length === 2);
      await writeFile(path, 'second\n');
      await writeFile(path, '');
      await until(() => seen.length === 3);
      await writeFile(path, 'third');
      await until(() => seen.length === 4);
      await rm(path);
      await until(() => seen.length === 5);
      expect(seen).toEqual(['first', 'second', undefined, 'third', undefined]);
      expect(errors).toEqual([]);
    } finally { watcher.stop(); }
  });

  it('treats a missing file as no token', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'token-file-'));
    const seen: (string | undefined)[] = [];
    const watcher = watchTokenFile(join(dir, 'absent'), async token => { seen.push(token); }, () => {}, 20);
    try { await watcher.ready; expect(seen).toEqual([undefined]); } finally { watcher.stop(); }
  });

  it('signs the client in without a browser, keeps the session revision across renewals, and clears on removal', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'token-file-'));
    const cache = join(dir, 'cache.json');
    const auth: (string | null)[] = [];
    const request = (async (_input: string | URL, init?: RequestInit) => {
      auth.push(new Headers(init?.headers).get('authorization'));
      return Response.json({ teams: [{ teamId: 'a', teamName: 'A', role: 'member', configs: [] }] });
    }) as typeof fetch;
    const client = new TeamworkClient('https://dshteamwork.com', cache, request);
    const start = client.sessionRevision();
    await client.useToken('t1');
    expect(client.authenticated()).toBe(true);
    const signedIn = client.sessionRevision();
    expect(signedIn).not.toBe(start);
    await client.sync();
    expect(existsSync(cache)).toBe(true);
    await client.useToken('t2');
    expect(client.sessionRevision()).toBe(signedIn);
    await client.sync();
    expect(auth).toEqual(['Bearer t1', 'Bearer t2']);
    await client.useToken(undefined);
    expect(client.authenticated()).toBe(false);
    expect(client.sessionRevision()).not.toBe(signedIn);
    expect(client.current()).toBeUndefined();
    expect(existsSync(cache)).toBe(false);
  });
});
