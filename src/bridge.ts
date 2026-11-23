/**
 * The phone's side of this DSH (the server's
 * `docs/tech/relay.md`, "The allow-list"). The relay hands this
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
 * - Whatever goes back fits one message of the encrypted channel
 *   (`fitFrame`): a frame too large for it would close the channel.
 *
 * A cloud computer (the server's premium ADR 0051) is reached by the server,
 * not the relay: its streams go straight to DSH's mux, and its unary calls to
 * this bridge through `bridgeRoute`, behind DSH's own sign-in.
 */
import { z } from 'zod';
import { PhoneSessionError, type PhoneSessionOps } from './phone-session.js';
import { PRESET_NAME } from './phone-permission.js';
import { listDirectory, readDocument, readText, searchFiles } from './phone-files.js';
import { PhoneUploads, uploadLimits, uploadSchemas } from './phone-uploads.js';
import type { OwnerFilter } from './shared-owner.js';
import { MAX_MESSAGE } from './secure-channel.js';
import { ROUTE_PREFIX, type FetchRoute } from './panel.js';

/**
 * DSH's automation tasks, passed on unchanged for a personal computer and refused on a shared DSH, whose task catalog
 * names no member (the server's ADR 0066).
 */
export const SCHEDULE_CALLS: ReadonlySet<string> = new Set([
  'schedule/catalog', 'schedule/history', 'schedule/create', 'schedule/edit', 'schedule/run',
]);

/** Unary methods a phone may call. A test holds this list. */
export const ALLOWED_CALLS: ReadonlySet<string> = new Set([
  'session/list', 'session/create', 'session/prompt', 'session/state', 'session/page', 'session/cancel',
  'session/modelCatalog', 'teamwork/configuration', 'teamwork/selectModel', 'teamwork/selectPermission',
  'teamwork/listFiles', 'teamwork/searchFiles', 'teamwork/readFile', 'teamwork/readDocument',
  'teamwork/uploadStart', 'teamwork/uploadChunk', 'teamwork/uploadFinish', 'teamwork/uploadCancel',
  'userQuestions/answer',
  '$events/result',
  ...Object.keys(sessionActionSchemas()),
  ...SCHEDULE_CALLS,
]);

/** Streams a phone may open on the mux. A test holds this list. */
export const ALLOWED_STREAMS: ReadonlySet<string> = new Set(['session/follow', '$events']);

const MUX_PATH = '/api/remote.mux';

/**
 * What a phone may do to a session from its list, as DSH's own sidebar does: rename it, pin it, archive it. Each is
 * DSH's own call, passed on only with exactly these fields, so `stopActivity` never reaches `archiveSession` and a
 * running session's archive is refused (`workspace/session-active`) rather than stopping its work.
 */
function sessionActionSchemas() {
  const sessionId = z.string().min(1).max(256);
  const named = z.object({ sessionId }).strict();
  return {
    'session/rename': z.object({ sessionId, title: z.string().min(1).max(500) }).strict(),
    'workspace/pinSession': named,
    'workspace/unpinSession': named,
    'workspace/archiveSession': named,
    'workspace/unarchiveSession': named,
  } as Record<string, z.ZodType>;
}
const SESSION_ACTIONS = sessionActionSchemas();

/** Reading a session's files, under its working directory (src/phone-files.ts). */
const FILE_CALLS = new Set(['teamwork/listFiles', 'teamwork/searchFiles', 'teamwork/readFile', 'teamwork/readDocument']);

/** Which of the member's sessions DSH's workspace registry pins and archives (its `pinnedSessionIds`, `archivedSessionIds`). */
export interface SessionMarks {
  pinned: readonly string[];
  archived: readonly string[];
  /** DSH's workspaces in its own order, each with the sessions it lists in its own manual order. */
  workspaces: readonly { id: string; title: string; sessionIds: readonly string[] }[];
}

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
  /** On a shared DSH, whose sessions each pairing's member may reach (src/shared-owner.ts); none on a personal computer. */
  owners?: () => OwnerFilter | undefined;
  /** The pin and archive sets `session/list` marks each item with, under `teamwork`; none while DSH has no registry. */
  marks?: () => SessionMarks | undefined;
  /** The DSH workspace registered at exactly this folder, if any (see `session/create` in `call`). */
  workspaceAt?: (path: string) => string | undefined;
}

interface Link {
  /** This pairing's answering identity at DSH, minted on first use. */
  cookie?: Promise<string>;
  mux?: WebSocket;
  /** Mux frames waiting for the socket to open. */
  queued: string[];
  /** Streams this pairing opened and DSH has not ended, with what each one is. */
  streams: Map<string, string>;
  /** The pairing's mux frames in each direction, one at a time, so a filter's wait keeps their order. */
  inbound: Promise<void>;
  outbound: Promise<void>;
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
    if (!link) this.links.set(pairingId, link = { queued: [], streams: new Map(), inbound: Promise.resolve(), outbound: Promise.resolve() });
    return link;
  }

  private drop(pairingId: string) {
    const link = this.links.get(pairingId);
    if (!link) return;
    this.links.delete(pairingId);
    this.uploads.drop(pairingId);
    this.options.owners?.()?.drop(pairingId);
    link.mux?.close(1000, 'phone left');
  }

  private async call(frame: z.infer<typeof callSchema>) {
    const { status, body } = await this.answer(frame.pairingId, frame.id, frame.method, frame.body);
    const result = { t: 'result', pairingId: frame.pairingId, id: frame.id, status, body };
    this.options.send(fitFrame(result) ?? { ...result, status: 502, body: { error: 'too_large' } });
  }

  /**
   * One unary call under `pairingId`, through the allow-list, and its answer: what the relay's `result` carries, and
   * what a cloud computer's server reads from `POST /api/teamwork/bridge` (`bridgeRoute`).
   */
  async answer(pairingId: string, id: string, method: string, body: unknown): Promise<{ status: number; body: unknown }> {
    const frame = { pairingId, id, method, body };
    let output!: (status: number, body: unknown) => void;
    const answered = new Promise<{ status: number; body: unknown }>((resolve) => { output = (status, body) => resolve({ status, body }); });
    void this.run(frame, output);
    return answered;
  }

  private async run(frame: { pairingId: string; id: string; method: string; body: unknown }, output: (status: number, body: unknown) => void) {
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
    const owners = this.options.owners?.();
    if (owners && SCHEDULE_CALLS.has(frame.method)) return answer(200, { result: { ok: false, error: { code: 'teamwork/schedule_unavailable' } } });
    if (owners && !(await owners.admitCall(frame.pairingId, frame.method, frame.body)))
      return answer(200, { result: { ok: false, error: { code: 'teamwork/not_found' } } });
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
      if (Object.hasOwn(SESSION_ACTIONS, frame.method) && !SESSION_ACTIONS[frame.method]!.safeParse(request).success) throw new PhoneSessionError('invalid_request');
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
        const sessionId = z.string().min(1).max(256);
        const schemas: Record<string, z.ZodType> = {
          'teamwork/configuration': z.object({ sessionId: sessionId.optional() }).strict(),
          'teamwork/selectPermission': z.object({ sessionId, preset: z.string().regex(PRESET_NAME) }).strict(),
          'teamwork/listFiles': z.object({ sessionId, path: z.string().max(4096) }).strict(),
          'teamwork/searchFiles': z.object({ sessionId, query: z.string().min(1).max(200) }).strict(),
          'teamwork/readDocument': z.object({
            sessionId, path: z.string().min(1).max(4096), offset: z.number().int().nonnegative(),
            version: z.string().max(128).optional(),
          }).strict(),
          'teamwork/readFile': z.object({ sessionId, path: z.string().min(1).max(4096) }).strict(),
        };
        const schema = schemas[frame.method]
          ?? z.object({ sessionId, provider: z.string().min(1), model: z.string().min(1), reasoningEffort: z.string().optional() }).strict();
        const input = schema.safeParse(request) as z.ZodSafeParseResult<{ sessionId?: string; path?: string; query?: string; offset?: number; version?: string }>;
        if (!input.success) throw new PhoneSessionError('invalid_request');
        await this.cookie(link, origin);
        if (input.data.sessionId) {
          const admission = await post('session/state', { args: { request: { sessionId: input.data.sessionId } } });
          const body = await admission.json() as { result?: { ok?: boolean } };
          if (!admission.ok || !body.result?.ok) return answer(admission.status, body);
        }
        if (this.links.get(frame.pairingId) !== link) throw new PhoneSessionError('not_found');
        // A session's files, read only and under its working directory (src/phone-files.ts).
        if (FILE_CALLS.has(frame.method)) {
          const root = await operations.fileRoot(input.data.sessionId!);
          const read = frame.method === 'teamwork/listFiles' ? listDirectory(root, input.data.path!)
            : frame.method === 'teamwork/searchFiles' ? searchFiles(root, input.data.query!)
              : frame.method === 'teamwork/readDocument' ? readDocument(root, input.data.path!, input.data.offset!, input.data.version, operations.officeKit?.())
                : readText(root, input.data.path!);
          // A file the system will not open (no permission, gone meanwhile) is one the member cannot reach.
          const value = await read.catch((error: unknown) => { throw error instanceof PhoneSessionError ? error : new PhoneSessionError('not_found'); });
          return answer(200, { result: { ok: true, value } });
        }
        const value = frame.method === 'teamwork/configuration'
          ? { ...await operations.configuration(input.data.sessionId) as object, uploads: uploadLimits }
          : frame.method === 'teamwork/selectPermission'
            ? await operations.selectPermission(input.data as Parameters<PhoneSessionOps['selectPermission']>[0])
            : await operations.selectModel(input.data as Parameters<PhoneSessionOps['selectModel']>[0]);
        return answer(200, { result: { ok: true, value } });
      }
      let uploaded: string[] = [];
      let forwarded = frame.body;
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
        if (prompt.requestId && operations.accepted(promptSession, prompt.requestId)) {
          return answer(200, { result: { ok: true } });
        }
        await operations.check(promptSession);
        if (Array.isArray(prompt.content)) {
          uploaded = this.uploads.validate(frame.pairingId, promptSession, prompt.content);
          const content = this.uploads.resolveImages(prompt.content, uploaded);
          if (content.some(part => typeof part === 'object' && part !== null && 'type' in part && part.type === 'image')) {
            await operations.checkImages?.(promptSession);
          }
          const body = frame.body as { args: { request: object } };
          forwarded = { ...body, args: { ...body.args, request: { ...body.args.request, content } } };
        }
      }
      // A phone or the console names a folder; DSH files a session under a workspace only when it is named by id, so a
      // folder that is a workspace goes as that workspace, and the session is listed there instead of under Ungrouped.
      const created = frame.method === 'session/create' ? request as { cwd?: unknown; workspaceId?: unknown } | undefined : undefined;
      const workspaceId = typeof created?.cwd === 'string' && created.workspaceId === undefined ? this.options.workspaceAt?.(created.cwd) : undefined;
      const response = workspaceId
        ? await post(frame.method, { ...frame.body as object, args: { ...(frame.body as { args: object }).args, request: { ...Object.fromEntries(Object.entries(created!).filter(([key]) => key !== 'cwd')), workspaceId } } })
        : await post(frame.method, forwarded);
      const text = await response.text();
      if (promptSession && response.ok && (parseJson(text) as { result?: { ok?: boolean } } | null)?.result?.ok) {
        for (const id of uploaded) this.uploads.cancel(frame.pairingId, promptSession, id);
      }
      const body = text ? parseJson(text) : null;
      const kept = owners && response.ok ? await owners.afterCall(frame.pairingId, frame.method, body) : body;
      answer(response.status, frame.method === 'session/list' && response.ok ? this.marked(kept) : kept);
    } catch (error) {
      if (error instanceof PhoneSessionError) return answer(200, { result: { ok: false, error: { code: `teamwork/${error.code}` } } });
      link.cookie = undefined;
      this.options.log?.('A phone request could not reach DSH', error);
      answer(502, { error: 'dsh_unreachable' });
    }
  }

  /**
   * A `session/list` answer with each item's place in DSH's sidebar, as `teamwork: { pinned, archived, workspace }`:
   * its pin and archive marks, and the workspace that lists it (`index` among the workspaces, `position` among its
   * sessions, both DSH's own order) or null when DSH lists it under Ungrouped.
   */
  private marked(body: unknown) {
    const marks = this.options.marks?.();
    const wire = body as { result?: { ok?: boolean; value?: { items?: unknown } } } | null;
    const items = wire?.result?.value?.items;
    if (!marks || !wire?.result?.ok || !Array.isArray(items)) return body;
    const pinned = new Set(marks.pinned), archived = new Set(marks.archived);
    // DSH lists a session under the first workspace that accounts it, as its sidebar does.
    const workspaces = new Map<string, { id: string; title: string; index: number; position: number }>();
    marks.workspaces.forEach(({ id, title, sessionIds }, index) => sessionIds.forEach((sessionId, position) => {
      if (!workspaces.has(sessionId)) workspaces.set(sessionId, { id, title, index, position });
    }));
    const mark = (item: unknown) => {
      const id = (item as { sessionId?: unknown } | null)?.sessionId;
      return typeof id === 'string'
        ? { ...(item as object), teamwork: { pinned: pinned.has(id), archived: archived.has(id), workspace: workspaces.get(id) ?? null } }
        : item;
    };
    return { ...wire, result: { ...wire.result, value: { ...wire.result.value, items: items.map(mark) } } };
  }

  private mux(pairingId: string, body: unknown) {
    const parsed = clientMuxSchema.safeParse(body);
    if (!parsed.success) return;
    const link = this.link(pairingId);
    // Without a filter nothing waits, so frames go on at once and in order.
    if (!this.options.owners?.()) return void this.muxNow(pairingId, link, parsed.data);
    link.inbound = link.inbound.then(() => this.muxNow(pairingId, link, parsed.data)).catch((error) => this.options.log?.('A phone stream frame failed', error));
  }

  private async muxNow(pairingId: string, link: Link, message: z.infer<typeof clientMuxSchema>) {
    if (message.type === 'open') {
      if (!ALLOWED_STREAMS.has(message.endpoint)) return this.fail(pairingId, message.streamId, 'stream_not_allowed');
      if (link.streams.has(message.streamId)) return this.fail(pairingId, message.streamId, 'stream_exists');
      const owners = this.options.owners?.();
      if (owners && !(await owners.admitOpen(pairingId, message.endpoint, message.payload))) return this.fail(pairingId, message.streamId, 'not_found');
      link.streams.set(message.streamId, message.endpoint);
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
      this.options.log?.('Could not sign DSH in for the phone', error);
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
      const endpoint = link.streams.get(message.data.streamId);
      if (message.data.type === 'end' || message.data.type === 'error') link.streams.delete(message.data.streamId);
      const owners = this.options.owners?.();
      if (!owners || endpoint !== '$events' || message.data.type !== 'item') return void this.deliver(pairingId, link, message.data);
      const data = message.data;
      link.outbound = link.outbound.then(async () => {
        const value = await owners.eventFor(pairingId, data.value);
        if (value !== undefined) this.deliver(pairingId, link, data);
      }).catch((error) => this.options.log?.('A phone event could not be filtered', error));
    });
    mux.addEventListener('close', () => {
      if (link.mux !== mux) return;
      link.mux = undefined;
      if (this.links.get(pairingId) === link) this.closeStreams(pairingId, link, 'dsh_closed');
    });
  }

  /**
   * Passes one of DSH's mux frames to the phone, made to fit the channel. One
   * that cannot fit ends its stream at both ends instead: a stream with a
   * frame missing would show the phone a different session.
   */
  private deliver(pairingId: string, link: Link, body: z.infer<typeof serverMuxSchema>) {
    const frame = fitFrame({ t: 'mux', pairingId, body });
    if (frame) return this.options.send(frame);
    link.streams.delete(body.streamId);
    if (link.mux?.readyState === 1) link.mux.send(JSON.stringify({ type: 'cancel', streamId: body.streamId }));
    this.fail(pairingId, body.streamId, 'too_large');
  }

  /** Every open stream of a pairing ends, as DSH itself would end it. */
  private closeStreams(pairingId: string, link: Link, code: string) {
    link.queued = [];
    for (const streamId of link.streams.keys()) this.fail(pairingId, streamId, code);
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

/** What a frame may take of the channel's message, leaving room for nothing else; JSON as the channel encodes it. */
const FRAME_BYTES = MAX_MESSAGE;
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
/** The longest a string stays when a frame is too large, tried in turn; ids and names are far shorter. */
const STRING_CAPS = [64 * 1024, 16 * 1024, 4 * 1024, 1024];

/**
 * A frame for the phone that fits one message of the encrypted channel, or
 * undefined when nothing can make it fit. A frame that fits is passed as it
 * is. A larger one has its long strings (a tool's output, a file written) cut
 * short, which the phone shows only in part anyway; a follow's opening
 * snapshot then keeps its newest records and says it has more, which
 * `session/page` reads back.
 */
export function fitFrame<T>(frame: T): T | undefined {
  if (bytes(frame) <= FRAME_BYTES) return frame;
  let short = frame;
  for (const cap of STRING_CAPS) {
    short = shorten(frame, cap) as T;
    if (bytes(short) <= FRAME_BYTES) return short;
  }
  // A window of history: a follow's snapshot, or a call's `session/page`.
  const body = (short as { body?: { value?: History; result?: { value?: History } } }).body;
  const history = body?.value?.type === 'snapshot' ? body.value : body?.result?.value;
  if (!body || !Array.isArray(history?.records)) return undefined;
  const records = history.records;
  let over = bytes(short) - FRAME_BYTES;
  let first = 0;
  // Each record dropped takes its JSON and the comma before the next.
  while (over > 0 && first < records.length) over -= bytes(records[first++]) + 1;
  if (over > 0) return undefined;
  const kept = { ...history, records: records.slice(first), hasMore: true };
  return { ...short, body: history === body.value ? { ...body, value: kept } : { ...body, result: { ...body.result, value: kept } } };
}

type History = { type?: unknown; records?: unknown[] };

function shorten(value: unknown, cap: number): unknown {
  if (typeof value === 'string') {
    if (value.length <= cap) return value;
    // Never end on half of a surrogate pair.
    const end = /[\uD800-\uDBFF]/.test(value[cap - 1]!) ? cap - 1 : cap;
    return value.slice(0, end) + '…';
  }
  if (Array.isArray(value)) return value.map(item => shorten(item, cap));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shorten(item, cap)]));
  return value;
}

/** The pairing a cloud computer's server calls the bridge under: there is one, and no phone. */
export const CLOUD_PAIRING = 'cloud';

const routeCallSchema = z.object({ id: z.string().min(1).max(256), method: z.string().min(1).max(128), body: z.unknown() }).strict();

/**
 * `POST /api/teamwork/bridge` on DSH's own web server, registered only where a host provides the token (`tokenFile`):
 * a cloud computer's server makes the calls a phone makes through the relay, `{ id, method, body }` as a `call`
 * frame's, and reads `{ status, body }` as its `result`. DSH's sign-in guards it as it guards `/api/`.
 */
export function bridgeRoute(bridge: Bridge): FetchRoute {
  return {
    path: `${ROUTE_PREFIX}/bridge`,
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      const input = routeCallSchema.safeParse(parseJson(await request.text()));
      const answer = input.success ? await bridge.answer(CLOUD_PAIRING, input.data.id, input.data.method, input.data.body) : { status: 400, body: { error: 'invalid_request' } };
      return new Response(JSON.stringify(answer), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    },
  };
}
