import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TeamworkClient } from '../src/client.js';
import { listenForCode } from '../src/login-callback.js';

describe('the sign-in code coming back on loopback', () => {
  it('listens on 127.0.0.1 only, redeems the code once and closes', async () => {
    const redeemed: string[] = [];
    const callback = await listenForCode(async (code) => { redeemed.push(code); });
    expect(callback.uri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    const response = await fetch(`${callback.uri}?code=good`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('已登录 DSH Teamwork');
    expect(redeemed).toEqual(['good']);
    await expect(fetch(`${callback.uri}?code=again`)).rejects.toThrow();
  });

  it('stays open after a code that fails, so a stray request cannot end the sign-in', async () => {
    const callback = await listenForCode(async (code) => { if (code !== 'good') throw new Error('Teamwork request failed (401)'); });
    const failed = await fetch(`${callback.uri}?code=<script>`);
    expect(failed.status).toBe(400);
    const page = await failed.text();
    expect(page).toContain('Teamwork request failed (401)');
    expect(page).not.toContain('<script>');
    expect((await fetch(`${callback.uri}?code=good`)).status).toBe(200);
  });

  it('answers nothing but the callback path with a code', async () => {
    const callback = await listenForCode(async () => { throw new Error('should not redeem'); });
    try {
      const origin = new URL(callback.uri).origin;
      expect((await fetch(`${origin}/favicon.ico`)).status).toBe(404);
      expect((await fetch(callback.uri)).status).toBe(404);
      expect((await fetch(`${callback.uri}?code=x`, { method: 'POST' })).status).toBe(404);
    } finally { callback.close(); }
  });

  it('stops listening when its time runs out', async () => {
    const callback = await listenForCode(async () => {}, 20);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await expect(fetch(`${callback.uri}?code=late`)).rejects.toThrow();
  });

  it('names the listener in the sign-in link', async () => {
    const client = new TeamworkClient('https://dshteamwork.com', join(await mkdtemp(join(tmpdir(), 'login-')), 'cache.json'));
    const url = new URL(client.beginLogin('http://127.0.0.1:53124/callback'));
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:53124/callback');
    expect(url.searchParams.get('challenge')).toMatch(/^[\w-]{43}$/);
    expect(new URL(client.beginLogin()).searchParams.has('redirect_uri')).toBe(false);
  });
});
