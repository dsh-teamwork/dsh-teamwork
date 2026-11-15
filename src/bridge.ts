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
import { PhoneSessionError, type PhoneSessionOps } from './phone-session.js';
import { PhoneUploads, uploadLimits, uploadSchemas } from './phone-uploads.js';

/** Unary methods a phone may call. A test holds this list. */
export const ALLOWED_CALLS: ReadonlySet<string> = new Set([
  'session/list', 'session/create', 'session/prompt', 'session/state', 'session/page', 'session/cancel',
  'session/modelCatalog', 'teamwork/configuration', 'teamwork/selectModel',
  'teamwork/uploadStart', 'teamwork/uploadChunk', 'teamwork/uploadFinish', 'teamwork/uploadCancel',
  'userQuestions/answer',
  '$events/result',
]);

/** Streams a phone may open on the mux. A test holds this list. */
export const ALLOWED_STREAMS: ReadonlySet<string> = new Set(['session/follow', '$events']);

const MUX_PATH = '/api/remote.mux';

const callSchema = z.object({ t: z.literal('call'), pairingId: z.string(), id: z.string(), method: z.string(), body: z.unknown() });
const muxSchema = z.object({ t: z.literal('mux'), pairingId: z.string(), body: z.unknown() });
const endSchema = z.object({ t: z.enum(['detach', 'revoked']), pairingId: z.string() });
/** A frame the relay passes to the bridge. */
export const forwardedSchema = z.union([callSchema, muxSchema, endSchema]);
export type Forwarded = z.infer<typeof forwardedSchema>;

const clientMuxSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('open'), streamId: z.string().min(1), endpoint: z.string(), payload: z.unknown() }),
  z.object({ type: z.literal('item'), streamId: z.string().min(1), value: z.unknown().optional() }),
  z.object({ type: z.literal('end'), streamId: z.string().min(1) }),
  z.object({ type: z.literal('cancel'), streamId: z.string().min(1) }),
]);
const serverMuxSchema = z.object({ type: z.string(), streamId: z.string() }).loose();

export interface BridgeOptions {
  /**
   * A fresh sign-in URL for this DSH's own web server (`connection.authenticatedUrl`
   * over `webServer.getOrigin()`), or undefined where DSH serves no web.
   */
  launchUrl: () => string | undefined;
  /** Hands a frame back to the relay. */
  send: (frame: unknown) => void;
  request?: typeof fetch;
  WebSocket?: typeof globalThis.WebSocket;
  log?: (message: string, error?: unknown) => void;
  /** Only these session operations supplement DSH's native calls. */
  session?: PhoneSessionOps;
}

interface Link {
  /** This pairing's answering identity at DSH, minted on first use. */
  cookie?: Promise<string>;
  mux?: WebSocket;
  /** Mux frames waiting for the socket to open. */
  queued: string[];
  /** Streams this pairing opened and DSH has not ended. */
  streams: Set<string>;
}

export class Bridge {
  private links = new Map<string, Link>();
  private uploads = new PhoneUploads();
  private promptCalls = new Map<string, Promise<{ status: number; body: unknown }>>();

  constructor(private readonly options: BridgeOptions) {}

  handle(frame: Forwarded) {
    if (frame.t === 'call') return void this.call(frame);
    if (frame.t === 'mux') return this.mux(frame.pairingId, frame.body);
    this.drop(frame.pairingId);
  }

  /** The relay connection ended: every phone is gone with it. */
  dropAll() {
    for (const pairingId of [...this.links.keys()]) this.drop(pairingId);
  }

  private link(pairingId: string) {
    let link = this.links.get(pairingId);
    if (!link) this.links.set(pairingId, link = { queued: [], streams: new Set() });
    return link;
  }

  private drop(pairingId: string) {
    const link = this.links.get(pairingId);
    if (!link) return;
    this.links.delete(pairingId);
    this.uploads.drop(pairingId);
    link.mux?.close(1000, 'phone left');
  }

  private async call(frame: z.infer<typeof callSchema>) {
    const output = (status: number, body: unknown) => this.options.send({ t: 'result', pairingId: frame.pairingId, id: frame.id, status, body });
    const candidate = (frame.body as { args?: { request?: unknown } } | null)?.args?.request;
    const identity = frame.method === 'session/prompt' ? z.object({ sessionId: z.string().min(1).max(256), requestId: z.string().min(1).max(256) }).safeParse(candidate) : null;
    const key = identity?.success ? JSON.stringify([frame.pairingId, identity.data.sessionId, identity.data.requestId]) : null;
    const existing = key ? this.promptCalls.get(key) : undefined;
    if (existing) { const result = await existing; return output(result.status, result.body); }
    let finish: ((result: { status: number; body: unknown }) => void) | undefined;
    if (key) this.promptCalls.set(key, new Promise(resolve => { finish = resolve; }));
    const answer = (status: number, body: unknown) => {
      if (key) { finish?.({ status, body }); this.promptCalls.delete(key); }
      return output(status, body);
    };
    if (!ALLOWED_CALLS.has(frame.method)) return answer(403, { error: 'method_not_allowed' });
    const origin = this.origin();
    if (!origin) return answer(503, { error: 'no_web_server' });
    const link = this.link(frame.pairingId);
    const send = async (method: string, body: unknown) => (this.options.request ?? fetch)(`${origin}/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: await this.cookie(link, origin) },
      body: JSON.stringify({ type: 'client-request', rpcId: frame.id, method, payload: body }),
      redirect: 'manual',
    });
    const post = async (method = frame.method, body = frame.body) => {
      let response = await send(method, body);
      // Admission checks and forwarded calls renew a stale identity once.
      if (response.status === 401) { link.cookie = undefined; response = await send(method, body); }
      return response;
    };
    try {
      const operations = this.options.session;
      const request = (frame.body as { args?: { request?: unknown } } | null)?.args?.request;
      if (Object.hasOwn(uploadSchemas, frame.method)) {
        if (!operations) return answer(503, { error: 'configuration_unsupported' });
        const input = uploadSchemas[frame.method as keyof typeof uploadSchemas].safeParse(request);
        if (!input.success) throw new PhoneSessionError('invalid_upload');
        const data = input.data;
        let value: unknown;
        if ('name' in data) {
          const admission = await post('session/state', { args: { request: { sessionId: data.sessionId } } });
          const body = await admission.json() as { result?: { ok?: boolean } };
          if (!admission.ok || !body.result?.ok) return answer(admission.status, body);
          await operations.check(data.sessionId);
          const cookie = await this.cookie(link, origin);
          if (this.links.get(frame.pairingId) !== link) throw new PhoneSessionError('not_found');
          value = this.uploads.start(frame.pairingId, data, async (stream, signal) => {
            const query = new URLSearchParams({ sessionId: data.sessionId, name: data.name });
            const response = await (this.options.request ?? fetch)(`${origin}/api/session/uploadFileBinary?${query}`, {
              method: 'POST', headers: { cookie, 'content-type': 'application/octet-stream' },
              body: stream as unknown as BodyInit, signal, redirect: 'manual', ...{ duplex: 'half' },
            });
            const result = await response.json() as { ok?: boolean; value?: unknown };
            if (!response.ok || !result.ok) throw new PhoneSessionError('upload_failed');
            return result.value;
          });
        } else if (frame.method === 'teamwork/uploadChunk') {
          const chunk = data as z.infer<typeof uploadSchemas['teamwork/uploadChunk']>;
          value = await this.uploads.chunk(frame.pairingId, chunk.sessionId, chunk.uploadId, chunk.offset, chunk.data);
        }
        else if (frame.method === 'teamwork/uploadFinish') value = await this.uploads.finish(frame.pairingId, data.sessionId, data.uploadId);
        else { this.uploads.cancel(frame.pairingId, data.sessionId, data.uploadId); value = {}; }
        return answer(200, { result: { ok: true, value } });
      }
      if (frame.method.startsWith('teamwork/')) {
        if (!operations) return answer(503, { error: 'configuration_unsupported' });
        const schema = frame.method === 'teamwork/configuration'
          ? z.object({ sessionId: z.string().min(1).max(256).optional() }).strict()
          : z.object({ sessionId: z.string().min(1).max(256), provider: z.string().min(1), model: z.string().min(1), reasoningEffort: z.string().optional() }).strict();
        const input = schema.safeParse(request);
        if (!input.success) throw new PhoneSessionError('invalid_request');
        await this.cookie(link, origin);
        if (input.data.sessionId) {
          const admission = await post('session/state', { args: { request: { sessionId: input.data.sessionId } } });
          const body = await admission.json() as { result?: { ok?: boolean } };
          if (!admission.ok || !body.result?.ok) return answer(admission.status, body);
        }
        if (this.links.get(frame.pairingId) !== link) throw new PhoneSessionError('not_found');
        const value = frame.method === 'teamwork/configuration'
          ? { ...await operations.configuration(input.data.sessionId) as object, uploads: uploadLimits }
          : await operations.selectModel(input.data as Parameters<PhoneSessionOps['selectModel']>[0]);
        return answer(200, { result: { ok: true, value } });
      }
      let uploaded: string[] = [];
      let promptSession: string | undefined;
      if (frame.method === 'session/prompt' && operations) {
        const input = z.object({ sessionId: z.string().min(1) }).safeParse(request);
        if (!input.success) throw new PhoneSessionError('invalid_request');
        const admission = await post('session/state', { args: { request: { sessionId: input.data.sessionId } } });
        const body = await admission.json() as { result?: { ok?: boolean } };
        if (!admission.ok || !body.result?.ok) return answer(admission.status, body);
        if (this.links.get(frame.pairingId) !== link) throw new PhoneSessionError('not_found');
        promptSession = input.data.sessionId;
        const prompt = request as { requestId?: string; content?: unknown };
        if (!prompt.requestId || !operations.accepted(promptSession, prompt.requestId)) {
          await operations.check(promptSession);
          if (Array.isArray(prompt.content)) uploaded = this.uploads.validate(frame.pairingId, promptSession, prompt.content);
        }
      }
      const response = await post();
      const text = await response.text();
      if (promptSession && response.ok && (parseJson(text) as { result?: { ok?: boolean } } | null)?.result?.ok) {
        for (const id of uploaded) this.uploads.cancel(frame.pairingId, promptSession, id);
      }
      answer(response.status, text ? parseJson(text) : null);
    } catch (error) {
      if (error instanceof PhoneSessionError) return answer(200, { result: { ok: false, error: { code: `teamwork/${error.code}` } } });
      link.cookie = undefined;
      this.options.log?.('手机的请求无法到达 DSH', error);
      answer(502, { error: 'dsh_unreachable' });
    }
  }

  private mux(pairingId: string, body: unknown) {
    const parsed = clientMuxSchema.safeParse(body);
    if (!parsed.success) return;
    const message = parsed.data;
    const link = this.link(pairingId);
    if (message.type === 'open') {
      if (!ALLOWED_STREAMS.has(message.endpoint)) return this.fail(pairingId, message.streamId, 'stream_not_allowed');
      if (link.streams.has(message.streamId)) return this.fail(pairingId, message.streamId, 'stream_exists');
      link.streams.add(message.streamId);
    } else if (!link.streams.has(message.streamId)) {
      // Not a stream this pairing opened: it reaches nothing.
      return;
    }
    if (message.type === 'cancel') link.streams.delete(message.streamId);
    const text = JSON.stringify(message);
    if (link.mux?.readyState === 1) link.mux.send(text);
    else {
      link.queued.push(text);
      if (!link.mux) void this.openMux(pairingId, link);
    }
  }

  private async openMux(pairingId: string, link: Link) {
    const origin = this.origin();
    const Socket = this.options.WebSocket ?? globalThis.WebSocket;
    if (!origin || !Socket) return this.closeStreams(pairingId, link, 'no_web_server');
    let cookie: string;
    try { cookie = await this.cookie(link, origin); } catch (error) {
      link.cookie = undefined;
      this.options.log?.('无法为手机登录 DSH', error);
      return this.closeStreams(pairingId, link, 'dsh_unreachable');
    }
    if (this.links.get(pairingId) !== link || link.mux) return;
    // Node's WebSocket takes headers as a non-standard option; a browser's would not.
    const mux = new (Socket as unknown as new (url: string, init: unknown) => WebSocket)(origin.replace(/^http/, 'ws') + MUX_PATH, { headers: { cookie, origin } });
    link.mux = mux;
    mux.addEventListener('open', () => {
      for (const text of link.queued.splice(0)) mux.send(text);
    });
    mux.addEventListener('message', (event) => {
      const message = serverMuxSchema.safeParse(parseJson(String(event.data)));
      if (!message.success) return;
      if (message.data.type === 'end' || message.data.type === 'error') link.streams.delete(message.data.streamId);
      this.options.send({ t: 'mux', pairingId, body: message.data });
    });
    mux.addEventListener('close', () => {
      if (link.mux !== mux) return;
      link.mux = undefined;
      if (this.links.get(pairingId) === link) this.closeStreams(pairingId, link, 'dsh_closed');
    });
  }

  /** Every open stream of a pairing ends, as DSH itself would end it. */
  private closeStreams(pairingId: string, link: Link, code: string) {
    link.queued = [];
    for (const streamId of link.streams) this.fail(pairingId, streamId, code);
    link.streams.clear();
  }

  private fail(pairingId: string, streamId: string, code: string) {
    this.options.send({ t: 'mux', pairingId, body: { type: 'error', streamId, error: { code, message: code, details: {} } } });
  }

  private origin() {
    const launch = this.options.launchUrl();
    return launch ? new URL(launch).origin : undefined;
  }

  /** `/connect` with DSH's launch token and `interactions=answer`: an identity that may answer questions and approvals. */
  private cookie(link: Link, origin: string) {
    link.cookie ??= (async () => {
      const token = new URL(this.options.launchUrl()!).searchParams.get('token');
      if (!token) throw new Error('DSH gave no launch token');
      const response = await (this.options.request ?? fetch)(`${origin}/connect?token=${encodeURIComponent(token)}&interactions=answer`, { redirect: 'manual' });
      const cookie = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
      if (!cookie) throw new Error(`DSH refused the launch token (${response.status})`);
      return cookie;
    })();
    const pending = link.cookie;
    pending.catch(() => { if (link.cookie === pending) link.cookie = undefined; });
    return pending;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
