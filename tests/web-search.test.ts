import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TeamworkClient } from '../src/client.js';
import { PROVIDER_ID, teamworkSearch } from '../src/web-search.js';

// A signed-in client whose server answers /api/web/search as `answer` says, recording what it was sent.
async function signedIn(answer: (method: string, body: string) => Response) {
  const sent: { method: string; body: string; auth: string | null }[] = [];
  const request = (async (url: string, init: RequestInit = {}) => {
    if (url.endsWith('/api/auth/plugin/token')) return Response.json({ token: 'plugin-token' });
    if (url.endsWith('/api/web/search')) {
      const method = init.method ?? 'GET', body = String(init.body ?? '');
      sent.push({ method, body, auth: new Headers(init.headers).get('Authorization') });
      return answer(method, body);
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  const client = new TeamworkClient('https://dshteamwork.example', join(await mkdtemp(join(tmpdir(), 'search-')), 'cache.json'), request);
  client.beginLogin(); await client.completeLogin('code');
  return { client, sent };
}

function seam() {
  const registered: { id: string; available(): boolean; search(r: { query: string; maxResults?: number }): Promise<{ sources: unknown[] }> }[] = [];
  let effect: (() => () => void) | undefined;
  const ctx = {
    get: () => ({ registerSearchProvider: (p: (typeof registered)[number]) => { registered.push(p); return () => { registered.splice(registered.indexOf(p), 1); }; } }),
    effect: (f: () => () => void) => { effect = f; },
  };
  return { ctx: ctx as never, registered, unplug: () => effect?.()() };
}

describe('Teamwork search', () => {
  it('is offered while the server searches, and sends only the query and the count', async () => {
    const { client, sent } = await signedIn((method) => method === 'GET'
      ? Response.json({ available: true, dailyLimit: 500, usedToday: 0 })
      : Response.json({ sources: [{ url: 'https://example.org/a', title: 'A', snippet: 's' }] }));
    const search = teamworkSearch(client), dsh = seam();
    search.attach(dsh.ctx);
    expect(dsh.registered).toEqual([]);
    await search.refresh();
    expect(dsh.registered.map(p => p.id)).toEqual([PROVIDER_ID]);
    expect(dsh.registered[0].available()).toBe(true);
    expect(await dsh.registered[0].search({ query: 'DeepSeek V4', maxResults: 50 })).toEqual({ sources: [{ url: 'https://example.org/a', title: 'A', snippet: 's' }], truncated: false });
    expect(sent.at(-1)).toEqual({ method: 'POST', body: '{"query":"DeepSeek V4","count":20}', auth: 'Bearer plugin-token' });
    dsh.unplug();
    expect(dsh.registered).toEqual([]);
  });

  it('is not offered by a server without search, and keeps its last answer when the server cannot be asked', async () => {
    let status = 404;
    const { client } = await signedIn(() => new Response('{}', { status }));
    const search = teamworkSearch(client), dsh = seam();
    search.attach(dsh.ctx);
    await search.refresh();
    expect(dsh.registered).toEqual([]);
    status = 200;
    const offered = await signedIn(() => status === 200 ? Response.json({ available: true }) : new Response('', { status }));
    const later = teamworkSearch(offered.client), dsh2 = seam();
    later.attach(dsh2.ctx); await later.refresh();
    status = 503; await later.refresh();
    expect(dsh2.registered.length).toBe(1);
    status = 404; await later.refresh();
    expect(dsh2.registered).toEqual([]);
  });

  it('tells the model why a search was refused', async () => {
    let status = 429;
    const { client } = await signedIn(() => Response.json({ error: 'x' }, { status }));
    await expect(client.webSearch('q', undefined)).rejects.toThrow(/allowance is used up/);
    status = 401;
    await expect(client.webSearch('q', undefined)).rejects.toThrow(/teamwork login/);
    status = 502;
    await expect(client.webSearch('q', undefined)).rejects.toThrow(/Teamwork search failed \(502 x\)/);
  });
});
