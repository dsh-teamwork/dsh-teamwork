import { describe, expect, it } from 'vitest';
import { loopbackWebURL, rewriteWebRequest } from '../src/web-relay.js';

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
