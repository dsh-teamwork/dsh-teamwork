import { connect as tcp } from 'node:net';
import { Transform } from 'node:stream';
import { connect as tls } from 'node:tls';
import WebSocket, { createWebSocketStream } from 'ws';

const HEADER_LIMIT = 64 * 1024;
const COOKIE_CACHE_MS = 5 * 60_000;
const cookies = new WeakMap<AbortSignal, { launch: string; refreshAt: number; value: Promise<string> }>();

// ws finalizes a Duplex with close() without a code. The gateway treats an
// explicit normal close as EOF, including for responses without a length.
class RelayWebSocket extends WebSocket {
  override close(code = 1000, reason?: string | Buffer) {
    super.close(code, reason);
  }
}

export function loopbackWebURL(url: URL) {
  return ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
    && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
}

export function pageCookie(launch: URL, lifetime: AbortSignal) {
  const previous = cookies.get(lifetime);
  const now = Date.now();
  if (previous?.launch === launch.href && now < previous.refreshAt) return previous.value;
  const signal = AbortSignal.any([lifetime, AbortSignal.timeout(10_000)]);
  let refreshAt = now + COOKIE_CACHE_MS;
  const value = fetch(launch, { redirect: 'manual', signal }).then(async response => {
    await response.body?.cancel();
    const headers = response.headers.getSetCookie();
    const cookie = headers.map(value => value.split(';')[0]).join('; ');
    if (response.status !== 303 || !cookie) throw new Error('DSH web sign-in failed');
    for (const header of headers) {
      const maxAge = /;\s*max-age=(-?\d+)\s*(?:;|$)/i.exec(header);
      const expires = /;\s*expires=([^;]+)/i.exec(header);
      const expiry = maxAge ? now + Number(maxAge[1]) * 1000 : expires ? Date.parse(expires[1]) : Infinity;
      if (!Number.isNaN(expiry)) refreshAt = Math.min(refreshAt, expiry - 1000);
    }
    const current = cookies.get(lifetime);
    if (current?.value === value) current.refreshAt = refreshAt;
    return cookie;
  });
  cookies.set(lifetime, { launch: launch.href, refreshAt, value });
  void value.catch(() => {
    if (cookies.get(lifetime)?.value === value) cookies.delete(lifetime);
  });
  return value;
}

export function rewriteWebRequest(header: Buffer, launch: URL, cookie: string): Buffer {
  const [line, ...headers] = header.toString('latin1').split('\r\n');
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+ \/(?!\/)[^\x00-\x20\x7f]* HTTP\/1\.1$/.test(line)) {
    throw new Error('Invalid upstream request line');
  }
  if (headers.some(value => !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+:/.test(value))) {
    throw new Error('Invalid upstream request header');
  }
  const cleaned = headers.filter(value => !/^(host|cookie|origin|authorization):/i.test(value));
  if (headers.some(value => /^origin:/i.test(value))) cleaned.push('Origin: ' + launch.origin);
  cleaned.push('Host: ' + launch.host, 'Cookie: ' + cookie);
  return Buffer.from([line, ...cleaned, '', ''].join('\r\n'), 'latin1');
}

/** One HTTP connection, or one upgraded WebSocket, to the current DSH instance. */
export async function connectWebRelay(launchURL: string, dataURL: URL, id: string, lifetime: AbortSignal) {
  const launch = new URL(launchURL);
  if (!loopbackWebURL(launch) || lifetime.aborted) return;
  if (dataURL.protocol !== 'wss:' && !(dataURL.protocol === 'ws:' && ['127.0.0.1', '[::1]', 'localhost'].includes(dataURL.hostname))) return;
  const cookie = await pageCookie(launch, lifetime);
  if (lifetime.aborted) return;

  const ws = new RelayWebSocket(dataURL, {
    headers: { 'X-DSH-Web-Dial': id }, handshakeTimeout: 10_000,
    maxPayload: 1024 * 1024, followRedirects: false,
  });
  const tunnel = createWebSocketStream(ws);
  const host = launch.hostname.replace(/^\[|\]$/g, '');
  const secure = launch.protocol === 'https:';
  const options = { host, port: Number(launch.port || (secure ? 443 : 80)) };
  const local = secure ? tls(options) : tcp(options);
  let header = Buffer.alloc(0);
  let first = true;
  const timeout = setTimeout(close, 10_000);
  function close() {
    clearTimeout(timeout);
    lifetime.removeEventListener('abort', close);
    local.destroy();
    tunnel.destroy();
  }

  const request = new Transform({
    transform(chunk: Buffer, _, done) {
      if (!first) return done(null, chunk);
      const buffered = Buffer.concat([header, chunk]);
      const end = buffered.indexOf('\r\n\r\n');
      if (end > HEADER_LIMIT || (end < 0 && buffered.length > HEADER_LIMIT)) {
        return done(new Error('Upstream request headers too large'));
      }
      if (end < 0) {
        header = buffered;
        return done();
      }
      try {
        const rewritten = rewriteWebRequest(buffered.subarray(0, end), launch, cookie);
        first = false;
        header = Buffer.alloc(0);
        clearTimeout(timeout);
        done(null, Buffer.concat([rewritten, buffered.subarray(end + 4)]));
      } catch (error) {
        done(error as Error);
      }
    },
  });
  lifetime.addEventListener('abort', close, { once: true });
  request.on('error', close);
  tunnel.on('error', close).on('close', close);
  local.on('error', close);
  // Both pipes propagate backpressure, including when DSH reads an upload slowly.
  tunnel.pipe(request).pipe(local, { end: false });
  local.pipe(tunnel);
}
