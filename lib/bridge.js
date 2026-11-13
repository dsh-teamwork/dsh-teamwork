/**
 * The phone's side of this DSH (dsh-teamwork-premium ADR 0009,
 * `premium/docs/tech/mobile-relay.md`, "The allow-list"). The relay hands this
 * plugin a confirmed pairing's `call` and `mux` frames; the bridge checks each
 * against the allow-list and replays it against DSH's own Remote API on
 * loopback, as an answering identity of that pairing's own, then sends the
 * answer back. Nothing off the list touches DSH.
 *
 * - A `call` is one unary method. Its `body` is the call's `payload`; the
 *   bridge wraps it itself, so the method it checked is the method that runs.
 * - A `mux` frame is one frame of DSH's `/api/remote.mux`. An `open` must name
 *   an allowed stream; `item`, `end` and `cancel` are accepted only for a
 *   stream that pairing opened. Each pairing has its own loopback mux.
 */
import { z } from 'zod';
/** Unary methods a phone may call. A test holds this list. */
export const ALLOWED_CALLS = new Set([
    'session/list', 'session/create', 'session/prompt', 'session/state', 'session/page', 'session/cancel',
    'session/selectModel', 'session/modelCatalog',
    'userQuestions/answer',
    '$events/result',
]);
/** Streams a phone may open on the mux. A test holds this list. */
export const ALLOWED_STREAMS = new Set(['session/follow', '$events']);
const MUX_PATH = '/api/remote.mux';
const callSchema = z.object({ t: z.literal('call'), pairingId: z.string(), id: z.string(), method: z.string(), body: z.unknown() });
const muxSchema = z.object({ t: z.literal('mux'), pairingId: z.string(), body: z.unknown() });
const endSchema = z.object({ t: z.enum(['detach', 'revoked']), pairingId: z.string() });
/** A frame the relay passes to the bridge. */
export const forwardedSchema = z.union([callSchema, muxSchema, endSchema]);
const clientMuxSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('open'), streamId: z.string().min(1), endpoint: z.string(), payload: z.unknown() }),
    z.object({ type: z.literal('item'), streamId: z.string().min(1), value: z.unknown().optional() }),
    z.object({ type: z.literal('end'), streamId: z.string().min(1) }),
    z.object({ type: z.literal('cancel'), streamId: z.string().min(1) }),
]);
const serverMuxSchema = z.object({ type: z.string(), streamId: z.string() }).loose();
export class Bridge {
    options;
    links = new Map();
    constructor(options) {
        this.options = options;
    }
    handle(frame) {
        if (frame.t === 'call')
            return void this.call(frame);
        if (frame.t === 'mux')
            return this.mux(frame.pairingId, frame.body);
        this.drop(frame.pairingId);
    }
    /** The relay connection ended: every phone is gone with it. */
    dropAll() {
        for (const pairingId of [...this.links.keys()])
            this.drop(pairingId);
    }
    link(pairingId) {
        let link = this.links.get(pairingId);
        if (!link)
            this.links.set(pairingId, link = { queued: [], streams: new Set() });
        return link;
    }
    drop(pairingId) {
        const link = this.links.get(pairingId);
        if (!link)
            return;
        this.links.delete(pairingId);
        link.mux?.close(1000, 'phone left');
    }
    async call(frame) {
        const answer = (status, body) => this.options.send({ t: 'result', pairingId: frame.pairingId, id: frame.id, status, body });
        if (!ALLOWED_CALLS.has(frame.method))
            return answer(403, { error: 'method_not_allowed' });
        const origin = this.origin();
        if (!origin)
            return answer(503, { error: 'no_web_server' });
        const link = this.link(frame.pairingId);
        const post = async () => (this.options.request ?? fetch)(`${origin}/api/${frame.method}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: await this.cookie(link, origin) },
            body: JSON.stringify({ type: 'client-request', rpcId: frame.id, method: frame.method, payload: frame.body }),
            redirect: 'manual',
        });
        try {
            let response = await post();
            // DSH restarted since this identity was minted: mint another once.
            if (response.status === 401) {
                link.cookie = undefined;
                response = await post();
            }
            const text = await response.text();
            answer(response.status, text ? parseJson(text) : null);
        }
        catch (error) {
            link.cookie = undefined;
            this.options.log?.('手机的请求无法到达 DSH', error);
            answer(502, { error: 'dsh_unreachable' });
        }
    }
    mux(pairingId, body) {
        const parsed = clientMuxSchema.safeParse(body);
        if (!parsed.success)
            return;
        const message = parsed.data;
        const link = this.link(pairingId);
        if (message.type === 'open') {
            if (!ALLOWED_STREAMS.has(message.endpoint))
                return this.fail(pairingId, message.streamId, 'stream_not_allowed');
            if (link.streams.has(message.streamId))
                return this.fail(pairingId, message.streamId, 'stream_exists');
            link.streams.add(message.streamId);
        }
        else if (!link.streams.has(message.streamId)) {
            // Not a stream this pairing opened: it reaches nothing.
            return;
        }
        if (message.type === 'cancel')
            link.streams.delete(message.streamId);
        const text = JSON.stringify(message);
        if (link.mux?.readyState === 1)
            link.mux.send(text);
        else {
            link.queued.push(text);
            if (!link.mux)
                void this.openMux(pairingId, link);
        }
    }
    async openMux(pairingId, link) {
        const origin = this.origin();
        const Socket = this.options.WebSocket ?? globalThis.WebSocket;
        if (!origin || !Socket)
            return this.closeStreams(pairingId, link, 'no_web_server');
        let cookie;
        try {
            cookie = await this.cookie(link, origin);
        }
        catch (error) {
            link.cookie = undefined;
            this.options.log?.('无法为手机登录 DSH', error);
            return this.closeStreams(pairingId, link, 'dsh_unreachable');
        }
        if (this.links.get(pairingId) !== link || link.mux)
            return;
        // Node's WebSocket takes headers as a non-standard option; a browser's would not.
        const mux = new Socket(origin.replace(/^http/, 'ws') + MUX_PATH, { headers: { cookie, origin } });
        link.mux = mux;
        mux.addEventListener('open', () => {
            for (const text of link.queued.splice(0))
                mux.send(text);
        });
        mux.addEventListener('message', (event) => {
            const message = serverMuxSchema.safeParse(parseJson(String(event.data)));
            if (!message.success)
                return;
            if (message.data.type === 'end' || message.data.type === 'error')
                link.streams.delete(message.data.streamId);
            this.options.send({ t: 'mux', pairingId, body: message.data });
        });
        mux.addEventListener('close', () => {
            if (link.mux !== mux)
                return;
            link.mux = undefined;
            if (this.links.get(pairingId) === link)
                this.closeStreams(pairingId, link, 'dsh_closed');
        });
    }
    /** Every open stream of a pairing ends, as DSH itself would end it. */
    closeStreams(pairingId, link, code) {
        link.queued = [];
        for (const streamId of link.streams)
            this.fail(pairingId, streamId, code);
        link.streams.clear();
    }
    fail(pairingId, streamId, code) {
        this.options.send({ t: 'mux', pairingId, body: { type: 'error', streamId, error: { code, message: code, details: {} } } });
    }
    origin() {
        const launch = this.options.launchUrl();
        return launch ? new URL(launch).origin : undefined;
    }
    /** `/connect` with DSH's launch token and `interactions=answer`: an identity that may answer questions and approvals. */
    cookie(link, origin) {
        link.cookie ??= (async () => {
            const token = new URL(this.options.launchUrl()).searchParams.get('token');
            if (!token)
                throw new Error('DSH gave no launch token');
            const response = await (this.options.request ?? fetch)(`${origin}/connect?token=${encodeURIComponent(token)}&interactions=answer`, { redirect: 'manual' });
            const cookie = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
            if (!cookie)
                throw new Error(`DSH refused the launch token (${response.status})`);
            return cookie;
        })();
        const pending = link.cookie;
        pending.catch(() => { if (link.cookie === pending)
            link.cookie = undefined; });
        return pending;
    }
}
function parseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=bridge.js.map