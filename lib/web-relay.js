import { connect as tcp } from 'node:net';
import { connect as tls } from 'node:tls';
const HEADER_LIMIT = 64 * 1024;
const BUFFER_LIMIT = 1024 * 1024;
function pageCookie(launch, signal) {
    return fetch(launch, { redirect: 'manual', signal }).then(async (response) => {
        await response.body?.cancel();
        const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
        if (response.status !== 303 || !cookie)
            throw new Error('DSH web sign-in failed');
        return cookie;
    });
}
/** One HTTP connection, or one upgraded WebSocket, to the current DSH instance. */
export async function connectWebRelay(launchURL, dataURL, id, lifetime) {
    const launch = new URL(launchURL);
    const host = launch.hostname.replace(/^\[|\]$/g, '');
    if (!['127.0.0.1', '::1', 'localhost'].includes(host) || !['http:', 'https:'].includes(launch.protocol))
        return;
    const signal = AbortSignal.any([lifetime, AbortSignal.timeout(10_000)]);
    const cookie = await pageCookie(launch, signal);
    if (lifetime.aborted)
        return;
    if (dataURL.protocol !== 'wss:' && !(dataURL.protocol === 'ws:' && ['127.0.0.1', '[::1]', 'localhost'].includes(dataURL.hostname)))
        return;
    const WebSocketWithHeaders = WebSocket;
    const ws = new WebSocketWithHeaders(dataURL, { headers: { 'X-DSH-Web-Dial': id } });
    ws.binaryType = 'arraybuffer';
    let local;
    let header = Buffer.alloc(0);
    let first = true;
    let upstreamEnded = false;
    let pauseTimer;
    const timeout = setTimeout(() => close(), 10_000);
    function close() {
        clearTimeout(timeout);
        clearInterval(pauseTimer);
        lifetime.removeEventListener('abort', close);
        local?.destroy();
        if (ws.readyState < WebSocket.CLOSING)
            ws.close(upstreamEnded ? 1000 : 4000);
    }
    lifetime.addEventListener('abort', close, { once: true });
    ws.addEventListener('close', close, { once: true });
    ws.addEventListener('error', close, { once: true });
    ws.addEventListener('open', () => {
        const secure = launch.protocol === 'https:';
        const options = { host, port: Number(launch.port || (secure ? 443 : 80)) };
        local = secure ? tls(options) : tcp(options);
        local.on('end', () => { upstreamEnded = true; });
        local.on('error', close);
        local.on('close', close);
        local.on('data', chunk => {
            if (ws.readyState !== WebSocket.OPEN)
                return close();
            ws.send(chunk);
            if (ws.bufferedAmount <= BUFFER_LIMIT || pauseTimer)
                return;
            local?.pause();
            pauseTimer = setInterval(() => {
                if (ws.bufferedAmount > BUFFER_LIMIT / 2)
                    return;
                clearInterval(pauseTimer);
                pauseTimer = undefined;
                local?.resume();
            }, 20);
        });
    });
    ws.addEventListener('message', ({ data }) => {
        if (!local || !(data instanceof ArrayBuffer) || data.byteLength > BUFFER_LIMIT)
            return close();
        let chunk = Buffer.from(data);
        if (first) {
            chunk = Buffer.concat([header, chunk]);
            const end = chunk.indexOf('\r\n\r\n');
            if (end > HEADER_LIMIT || (end < 0 && chunk.length > HEADER_LIMIT))
                return close();
            if (end < 0) {
                header = chunk;
                return;
            }
            const [line, ...headers] = chunk.subarray(0, end).toString('latin1').split('\r\n');
            if (!/^\S+ \/(?!\/)[^\x00-\x20]* HTTP\/1\.1$/.test(line))
                return close();
            const cleaned = headers.filter(value => !/^(host|cookie|origin|authorization):/i.test(value));
            if (headers.some(value => /^origin:/i.test(value)))
                cleaned.push('Origin: ' + launch.origin);
            cleaned.push('Host: ' + launch.host, 'Cookie: ' + cookie);
            chunk = Buffer.concat([Buffer.from([line, ...cleaned, '', ''].join('\r\n'), 'latin1'), chunk.subarray(end + 4)]);
            first = false;
            header = Buffer.alloc(0);
            clearTimeout(timeout);
        }
        if (local.writableLength + chunk.length > BUFFER_LIMIT)
            return close();
        local.write(chunk);
    });
}
//# sourceMappingURL=web-relay.js.map