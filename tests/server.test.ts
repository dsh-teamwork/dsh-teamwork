import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ServerChoice, serverAddress, TeamworkClient } from '../src/client.js';

describe('the server a member signs in to', () => {
  it('accepts https anywhere and plain http only on this machine', () => {
    expect(serverAddress('https://dshteamwork.com/')).toBe('https://dshteamwork.com');
    expect(serverAddress(' https://teamwork.example.com/base/ ')).toBe('https://teamwork.example.com/base');
    expect(serverAddress('http://localhost:3800')).toBe('http://localhost:3800');
    expect(() => serverAddress('http://teamwork.example.com')).toThrow('https');
    expect(() => serverAddress('https://dshteamwork.com/?x=1')).toThrow('查询参数');
    expect(() => serverAddress('dshteamwork.com')).toThrow('无效');
  });

  it('signs out and drops the cache when it changes, since a token belongs to one server', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'server-'));
    const request = (async (input: string | URL) => Response.json(String(input).endsWith('/auth/plugin/token')
      ? { token: 't' } : { teamId: 'a', teamName: 'A', role: 'member', configs: [] })) as typeof fetch;
    const client = new TeamworkClient('https://dshteamwork.com', join(dir, 'cache.json'), request);
    client.beginLogin(); await client.completeLogin('code'); await client.sync();
    await client.setEndpoint('https://dshteamwork.com/');
    expect(client.authenticated()).toBe(true);
    await client.setEndpoint('http://localhost:3800');
    expect(client.endpoint).toBe('http://localhost:3800');
    expect(client.authenticated()).toBe(false);
    expect(client.current()).toBeUndefined();
    expect(client.beginLogin()).toMatch(/^http:\/\/localhost:3800\/plugin\?challenge=/);
  });

  it('accepts the whole line the sign-in page shows, not only the bare code', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'server-'));
    const sent: unknown[] = [];
    const request = (async (_input: string | URL, init?: RequestInit) => { sent.push(JSON.parse(String(init?.body)).code); return Response.json({ token: 't' }); }) as typeof fetch;
    const client = new TeamworkClient('http://localhost:3800', join(dir, 'cache.json'), request);
    client.beginLogin(); await client.completeLogin('  /teamwork authorize eyJ.a.b\n');
    client.beginLogin(); await client.completeLogin('eyJ.c.d');
    expect(sent).toEqual(['eyJ.a.b', 'eyJ.c.d']);
  });

  it('remembers the choice beside the cache, and forgets an unreadable one', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'server-'));
    const choice = ServerChoice.beside(join(dir, 'teamwork-cache.json'));
    expect(choice.path).toBe(join(dir, 'teamwork-cache.server.json'));
    expect(await choice.read()).toBeUndefined();
    await choice.write('http://localhost:3800');
    expect(await new ServerChoice(choice.path).read()).toBe('http://localhost:3800');
    await writeFile(choice.path, '{"server":"http://evil.example.com"}');
    expect(await choice.read()).toBeUndefined();
    await choice.write(undefined);
    expect(await choice.read()).toBeUndefined();
  });
});
