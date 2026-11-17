/**
 * The loopback listener that takes the sign-in code back from the browser, so
 * nobody has to copy it (platform repository,
 * docs/adr/0012-the-plugin-gets-its-code-back-on-loopback.md).
 *
 * It listens on 127.0.0.1 only, on a port the system picks, from `/teamwork
 * login` until a code redeems or ten minutes pass. Anything on this machine can
 * deliver a code here, but a code redeems only with the verifier this plugin
 * holds; one that fails leaves the listener open for the real one.
 */
import { createServer } from 'node:http';
export const CALLBACK_PATH = '/callback';
const CALLBACK_TTL_MS = 10 * 60_000;
export async function listenForCode(redeem, ttlMs = CALLBACK_TTL_MS) {
    let closed = false, redeemed = false;
    // One redemption at a time: a second request for the same sign-in waits for the first.
    let queue = Promise.resolve();
    const server = createServer((request, response) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        const code = request.method === 'GET' && url.pathname === CALLBACK_PATH ? url.searchParams.get('code') : null;
        if (!code) {
            response.writeHead(404).end();
            return;
        }
        const attempt = queue.then(async () => { if (!redeemed) {
            await redeem(code);
            redeemed = true;
        } });
        queue = attempt.catch(() => { });
        attempt.then(() => { page(response, 200, 'Signed in to DSH Teamwork', 'You can close this page and go back to DSH.'); close(); }, (error) => page(response, 400, 'Sign-in did not finish', `${error.message || 'Authorization failed'}. Go back to DSH and sign in again, or paste the line shown on the website into DSH.`));
    });
    const close = () => {
        if (closed)
            return;
        closed = true;
        clearTimeout(timer);
        server.close();
        server.closeIdleConnections();
    };
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
    });
    const timer = setTimeout(close, ttlMs);
    timer.unref();
    return { uri: `http://127.0.0.1:${server.address().port}${CALLBACK_PATH}`, close };
}
function page(response, status, title, body) {
    const escape = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>`
        + `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;line-height:1.6"><h1 style="font-size:1.25rem">${escape(title)}</h1><p>${escape(body)}</p></body>`);
}
//# sourceMappingURL=login-callback.js.map