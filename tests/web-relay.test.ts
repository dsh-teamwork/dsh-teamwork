import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loopbackWebURL, NativeWebSwitch, pageCookie, rewriteWebRequest, WebTunnels } from '../src/web-relay.js';

const launch = new URL('http://127.0.0.1:4000/?token=local');

describe('desktop web relay', () => {
  it.each([
    'http://127.0.0.1:4000', 'https://[::1]', 'http://localhost',
  ])('accepts a loopback Web listener %s', (url) => {
    expect(loopbackWebURL(new URL(url))).toBe(true);
  });

  it.each([
    'https://example.test', 'http://127.0.0.1.example.test', 'file:///tmp/index.html',
    'http://user:pass@127.0.0.1', 'http://127.0.0.1@example.test',
  ])('rejects an unsafe listener %s', (url) => {
    expect(loopbackWebURL(new URL(url))).toBe(false);
  });

  it('replaces credentials and authority while preserving the target and upgrade', () => {
    const request = Buffer.from(
      'GET /api/remote.mux?z=%20&a=1 HTTP/1.1\r\nhOsT: remote\r\n' +
      'cOoKiE: attacker=1\r\nCookie: duplicate=1\r\nOrigin: https://remote.test\r\n' +
      'Authorization: Bearer remote\r\nUpgrade: websocket',
    );
    expect(rewriteWebRequest(request, launch, 'local=identity').toString()).toBe(
      'GET /api/remote.mux?z=%20&a=1 HTTP/1.1\r\nUpgrade: websocket\r\n' +
      'Origin: http://127.0.0.1:4000\r\nHost: 127.0.0.1:4000\r\nCookie: local=identity\r\n\r\n',
    );
  });

  it('leaves Origin absent on a request without it', () => {
    const request = Buffer.from('GET / HTTP/1.1\r\nHost: remote');
    expect(rewriteWebRequest(request, launch, 'local=identity').toString()).not.toContain('Origin:');
  });

  it.each([
    'GET https://remote.test/ HTTP/1.1', 'GET //remote.test/ HTTP/1.1',
    'GET / HTTP/1.0', 'GET /embedded space HTTP/1.1',
    'GET / HTTP/1.1\r\n Cookie: folded', 'GET / HTTP/1.1\r\nHost : invalid',
  ])('rejects malformed or non-origin-form requests', (request) => {
    expect(() => rewriteWebRequest(Buffer.from(request), launch, 'local=identity')).toThrow();
  });
});

describe('DSH page credential cache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each([
    ['Max-Age=10', 9_000],
    ['Expires=Sun, 22 Nov 2026 00:00:10 GMT', 9_000],
    ['Max-Age=2592000', 300_000],
  ])('renews before DSH cookie expiry or the cache cap (%s)', async (attributes, refreshMs) => {
    vi.useFakeTimers();
    const start = Date.parse('2026-11-22T00:00:00Z');
    vi.setSystemTime(start);
    const fetch = vi.fn(async () => new Response(null, {
      status: 303,
      headers: { 'Set-Cookie': `dsh=local; ${attributes}` },
    }));
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    await Promise.all([pageCookie(launch, signal), pageCookie(launch, signal)]);
    vi.setSystemTime(start + refreshMs - 1);
    await pageCookie(launch, signal);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.setSystemTime(start + refreshMs);
    await pageCookie(launch, signal);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('the native Web switch', () => {
  it('is off until the owner turns it on, readable by them alone, and gone once turned off', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'native-web-switch-'));
    try {
      const cache = join(dir, 'cache.json');
      expect(await NativeWebSwitch.beside(cache).on()).toBe(false);
      await NativeWebSwitch.beside(cache).set(true);
      const saved = NativeWebSwitch.beside(cache);
      expect(await saved.on()).toBe(true);
      expect((await stat(saved.path)).mode & 0o777).toBe(0o600);
      await saved.set(false);
      expect(await NativeWebSwitch.beside(cache).on()).toBe(false);
      await expect(stat(saved.path)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('the native Web tunnels a computer serves', () => {
  it('counts them, remembers the last activity, and ends every one at once', () => {
    const tunnels = new WebTunnels();
    expect(tunnels.state).toEqual({ tunnels: 0 });
    const control = new AbortController();
    const first = tunnels.signal(control.signal), second = tunnels.signal(control.signal);
    tunnels.opened(); tunnels.opened();
    expect(tunnels.state.tunnels).toBe(2);
    expect(tunnels.state.lastActivity).toEqual(expect.any(String));
    tunnels.endAll();
    expect(first.aborted && second.aborted).toBe(true);
    expect(control.signal.aborted).toBe(false);
    tunnels.closed(); tunnels.closed();
    expect(tunnels.state.tunnels).toBe(0);
    // A tunnel opened after the disconnect lives on.
    expect(tunnels.signal(control.signal).aborted).toBe(false);
  });
});
