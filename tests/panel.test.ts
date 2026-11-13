import { describe, expect, it } from 'vitest';
import { panelRoutes, ROUTE_PREFIX, type PanelOps } from '../src/panel.js';

const calls: Array<[string, unknown[]]> = [];
const ops: PanelOps = {
  state: async (sessionId) => { calls.push(['state', [sessionId]]); return { authenticated: false } as never; },
  login: () => 'https://teamwork.example.com/plugin?challenge=abc',
  authorize: async (code) => { calls.push(['authorize', [code]]); },
  sync: async () => { throw new Error('同步失败'); },
  logout: async () => {},
  setServer: async (server) => { calls.push(['server', [server]]); },
  use: async (sessionId, id) => `used ${id} in ${sessionId}`,
  install: async (id, version) => { calls.push(['install', [id, version]]); return 'installed'; },
};
const routes = new Map(panelRoutes(ops).map((r) => [r.path, r]));
const post = (name: string, body?: unknown) =>
  routes.get(`${ROUTE_PREFIX}/${name}`)!.fetch(new Request(`http://dsh.local${ROUTE_PREFIX}/${name}`, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body ?? {}) }));

describe('panel routes', () => {
  it('registers POST-only routes under /api/teamwork', () => {
    expect([...routes.keys()].sort()).toEqual(['authorize', 'decide-phone', 'install', 'login', 'logout', 'pair-phone', 'revoke-phone', 'server', 'state', 'sync', 'use'].map((n) => `${ROUTE_PREFIX}/${n}`));
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
    expect(await response.json()).toEqual({ error: '同步失败' });
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

  it('never caches an answer', async () => {
    expect((await post('login')).headers.get('cache-control')).toBe('no-store');
  });
});
