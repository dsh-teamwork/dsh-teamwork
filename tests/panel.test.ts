import { describe, expect, it } from 'vitest';
import { panelRoutes, ROUTE_PREFIX, type PanelOps } from '../src/panel.js';
import { say, speaking } from '../src/messages.js';

const calls: Array<[string, unknown[]]> = [];
const ops: PanelOps = {
  summary: async () => ({ budget: { remaining: null, state: "unlimited", resetAt: null, tokenLimited: false, exhausted: false }, pendingReviews: 0 }),
  profile: async () => ({ id: 'user', email: 'user@example.com', name: null, image: null, locale: 'en' }),
  updateProfile: async input => { calls.push(['profile', [input]]); return { id: 'user', email: 'user@example.com', image: null, ...input }; },
  state: async (sessionId) => { calls.push(['state', [sessionId]]); return { authenticated: false } as never; },
  login: async () => ({ url: 'https://teamwork.example.com/plugin?challenge=abc', automatic: true }),
  authorize: async (code) => { calls.push(['authorize', [code]]); },
  sync: async () => { throw new Error('Sync failed'); },
  logout: async () => {},
  setWorkspace: async (teamId, path) => { calls.push(['workspace', [teamId, path]]); },
  setServer: async (server) => { calls.push(['server', [server]]); },
  use: async (sessionId, id) => `used ${id} in ${sessionId}`,
  install: async (id, version) => { calls.push(['install', [id, version]]); return 'installed'; },
};
let locale: 'en' | 'zh-CN' = 'en';
const routes = new Map(panelRoutes(ops, { say, speak: answer => speaking(locale, answer) }).map((r) => [r.path, r]));
const post = (name: string, body?: unknown) =>
  routes.get(`${ROUTE_PREFIX}/${name}`)!.fetch(new Request(`http://dsh.local${ROUTE_PREFIX}/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body ?? {}) }));

describe('panel routes', () => {
  it('proxies only editable profile fields and rejects invalid updates', async () => {
    calls.length = 0;
    expect((await post('update-profile', { name: 'Ada', locale: 'en', token: 'ignored' })).status).toBe(200);
    expect(calls).toEqual([['profile', [{ name: 'Ada', locale: 'en' }]]]);
    expect((await post('update-profile', { name: 'x'.repeat(81), locale: 'en' })).status).toBe(400);
    expect((await post('update-profile', { name: null, locale: 'invalid' })).status).toBe(400);
    expect(calls).toHaveLength(1);
  });
  it('checks browser origin and JSON on every panel POST', async () => {
    for (const route of routes.values()) {
      for (const headers of [
        { 'content-type': 'text/plain' },
        { 'content-type': 'application/json', origin: 'http://localhost:2000' },
        { 'content-type': 'application/json', 'sec-fetch-site': 'same-site' },
      ] as HeadersInit[]) {
        const response = await route.fetch(new Request('http://localhost:3000' + route.path, { method: 'POST', headers, body: '{}' }));
        expect(response.status).toBe(403);
      }
    }
  });
  it('registers POST-only routes under /api/teamwork', () => {
    expect([...routes.keys()].sort()).toEqual(['authorize', 'decide-phone', 'install', 'login', 'logout', 'owner-pin', 'pair-phone', 'profile', 'revoke-phone', 'server', 'share-audit-key', 'share-disable', 'share-enable', 'share-invite', 'share-unlock', 'state', 'summary', 'sync', 'update-profile', 'use', 'workspace'].map((n) => `${ROUTE_PREFIX}/${n}`));
    for (const route of routes.values()) expect(route.methods).toEqual(['POST']);
  });

  it('passes the session through, and none when it is missing', async () => {
    calls.length = 0;
    await post('state', { sessionId: 's1' });
    await post('state', {});
    expect(calls).toEqual([['state', ['s1']], ['state', [undefined]]]);
  });

  it('installs only with the exact version the member confirmed', async () => {
    calls.length = 0;
    const missing = await post('install', { id: 'lint' });
    expect(missing.status).toBe(400);
    expect(calls).toEqual([]);
    expect(await (await post('install', { id: 'lint', version: '2.3.1' })).json()).toEqual({ message: 'installed' });
    expect(calls).toEqual([['install', ['lint', '2.3.1']]]);
  });

  it('answers a failure as 400 with the message the panel shows', async () => {
    const response = await post('sync');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Sync failed' });
    expect((await post('authorize', '{not json')).status).toBe(400);
    expect((await post('use', { sessionId: 's1' })).status).toBe(400);
  });

  it('sets a server, or goes back to the default with null, and refuses an empty one', async () => {
    calls.length = 0;
    await post('server', { server: 'http://localhost:3800' });
    await post('server', { server: null });
    expect(calls).toEqual([['server', ['http://localhost:3800']], ['server', [null]]]);
    expect((await post('server', { server: ' ' })).status).toBe(400);
  });

  it('sets a team’s default workspace with the path exactly as given', async () => {
    calls.length = 0;
    await post('workspace', { teamId: 'team', path: '/work/name ' });
    expect(calls).toEqual([['workspace', ['team', '/work/name ']]]);
    expect((await post('workspace', { teamId: 'team' })).status).toBe(400);
    expect((await post('workspace', { path: '/work' })).status).toBe(400);
    expect(calls).toHaveLength(1);
  });

  it('never caches an answer', async () => {
    expect((await post('login')).headers.get('cache-control')).toBe('no-store');
  });
  it('words its own refusals in the panel’s language, and only inside its requests', async () => {
    locale = 'zh-CN';
    expect(await (await post('state', '{')).json()).toEqual({ error: '请求格式无效。' });
    expect(await (await post('authorize', {})).json()).toEqual({ error: '缺少授权码。' });
    expect(say('request.invalid')).toBe('The request could not be read.');
    locale = 'en';
    expect(await (await post('state', '{')).json()).toEqual({ error: 'The request could not be read.' });
    expect(await (await post('authorize', {})).json()).toEqual({ error: 'Authorization code is missing.' });
  });
});
