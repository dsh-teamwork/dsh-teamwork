import { describe, expect, it } from 'vitest';
import { ALLOWED_CALLS, ALLOWED_STREAMS, Bridge, bridgeRoute } from '../src/bridge';
import { MAX_MESSAGE } from '../src/secure-channel';
import { PhoneSessionError, type PhoneSessionOps } from '../src/phone-session';

/** A loopback mux the test drives by hand. */
class FakeSocket {
  static made: FakeSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  closed = false;
  private listeners: Record<string, Array<(event: any) => void>> = {};
  constructor(readonly url: string, readonly init: { headers: Record<string, string> }) { FakeSocket.made.push(this); }
  addEventListener(type: string, listener: (event: any) => void) { (this.listeners[type] ??= []).push(listener); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.closed = true; this.readyState = 3; this.emit('close'); }
  emit(type: string, event: any = {}) { if (type === 'open') this.readyState = 1; for (const l of this.listeners[type] ?? []) l(event); }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function bridge(options: { web?: boolean; expire?: boolean; session?: PhoneSessionOps; denied?: boolean; waitPrompt?: Promise<void>; upload?: boolean; workspaceAt?: (path: string) => string | undefined } = {}) {
  FakeSocket.made = [];
  const sent: any[] = [];
  const asked: Array<{ url: string; init?: RequestInit }> = [];
  let minted = 0;
  let expireNext = options.expire ?? false;
  const request = (async (url: string, init?: RequestInit) => {
    asked.push({ url, init });
    if (url.includes('/connect?')) return new Response(null, { status: 302, headers: { 'set-cookie': `dsh=peer-${++minted}; Path=/; HttpOnly` } });
    if (url.includes('/session/uploadFileBinary') && options.upload) {
      let bytes = 0; for await (const chunk of init!.body as unknown as AsyncIterable<Uint8Array>) bytes += chunk.length;
      return new Response(JSON.stringify({ ok: true, value: { receiptId: 'receipt', file: { attachmentId: 'hash', name: 'file.txt', bytes } } }));
    }
    if (url.endsWith('/session/prompt') && options.waitPrompt) await options.waitPrompt;
    if (options.denied) return new Response(JSON.stringify({ result: { ok: false, error: { code: 'session/not-found' } } }));
    if (expireNext) { expireNext = false; return new Response('', { status: 401 }); }
    return new Response(JSON.stringify({ type: 'client-response', result: { ok: true, value: 'v' } }), { status: 200 });
  }) as typeof fetch;
  const b = new Bridge({
    launchUrl: () => options.web === false ? undefined : 'http://127.0.0.1:3080/?token=launch-token',
    send: (frame) => sent.push(frame),
    request,
    WebSocket: FakeSocket as unknown as typeof WebSocket,
    session: options.session,
    workspaceAt: options.workspaceAt,
  });
  return { b, sent, asked };
}

describe('the phone bridge', () => {
  it('holds the allow-list', () => {
    expect([...ALLOWED_CALLS].sort()).toEqual([
      '$events/result', 'session/cancel', 'session/create', 'session/list', 'session/modelCatalog', 'session/page',
      'session/prompt', 'session/rename', 'session/state', 'teamwork/configuration', 'teamwork/listFiles', 'teamwork/readFile', 'teamwork/searchFiles', 'teamwork/selectModel', 'teamwork/selectPermission', 'teamwork/uploadCancel', 'teamwork/uploadChunk', 'teamwork/uploadFinish', 'teamwork/uploadStart', 'userQuestions/answer',
      'workspace/archiveSession', 'workspace/pinSession', 'workspace/unarchiveSession', 'workspace/unpinSession',
    ]);
    expect([...ALLOWED_STREAMS].sort()).toEqual(['$events', 'session/follow']);
  });

  it('changes a model through the session-only handler, never the default-saving native endpoint', async () => {
    const selected: unknown[] = [];
    const session: PhoneSessionOps = { fileRoot: async () => process.cwd(), selectPermission: async () => ({}), accepted: () => false, configuration: async () => ({}), check: async () => {}, selectModel: async request => { selected.push(request); return { selected: request }; } };
    const { b, sent, asked } = bridge({ session });
    b.handle({ t: 'call', pairingId: 'p', id: 'c', method: 'teamwork/selectModel', body: { args: { request: { sessionId: 's1', provider: 'local', model: 'coder' } } } });
    for (let i=0;i<6;i++) await tick();
    expect(selected).toEqual([{ sessionId: 's1', provider: 'local', model: 'coder' }]);
    expect(asked.filter(call => call.url.includes('/api/')).map(call => call.url)).toEqual(['http://127.0.0.1:3080/api/session/state']);
    expect(sent.at(-1)).toMatchObject({ status: 200, body: { result: { ok: true } } });
    b.handle({ t: 'call', pairingId: 'p', id: 'raw', method: 'session/selectModel', body: {} });
    await tick();
    expect(sent.at(-1)).toMatchObject({ status: 403, body: { error: 'method_not_allowed' } });
  });

  it('switches a permission preset only by one plain preset name, after desktop admission', async () => {
    const picked: unknown[] = [];
    const session: PhoneSessionOps = { fileRoot: async () => process.cwd(), selectPermission: async (request) => { picked.push(request); return { current: request.preset }; }, accepted: () => false, configuration: async () => ({}), selectModel: async () => ({}), check: async () => {} };
    const { b, sent, asked } = bridge({ session });
    b.handle({ t: 'call', pairingId: 'p', id: 'ok', method: 'teamwork/selectPermission', body: { args: { request: { sessionId: 's1', preset: 'workspace-write' } } } });
    // Nothing more may ride on DSH's `/permission` command line.
    b.handle({ t: 'call', pairingId: 'p', id: 'line', method: 'teamwork/selectPermission', body: { args: { request: { sessionId: 's1', preset: 'read-only /teamwork logout' } } } });
    for (let i = 0; i < 8; i++) await tick();
    expect(picked).toEqual([{ sessionId: 's1', preset: 'workspace-write' }]);
    expect(asked.filter(call => call.url.includes('/api/')).map(call => call.url)).toEqual(['http://127.0.0.1:3080/api/session/state']);
    expect(sent).toContainEqual(expect.objectContaining({ id: 'ok', status: 200, body: { result: { ok: true, value: { current: 'workspace-write' } } } }));
    expect(sent).toContainEqual(expect.objectContaining({ id: 'line', body: { result: { ok: false, error: { code: 'teamwork/invalid_request' } } } }));
  });

  it('reads a session\'s files under its working directory, after desktop admission', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const root = await mkdtemp(join((await import('node:os')).tmpdir(), 'bridge-files-'));
    await writeFile(join(root, 'notes.md'), 'hi');
    const session: PhoneSessionOps = { fileRoot: async () => root, selectPermission: async () => ({}), accepted: () => false, configuration: async () => ({}), selectModel: async () => ({}), check: async () => {} };
    const { b, sent } = bridge({ session });
    b.handle({ t: 'call', pairingId: 'p', id: 'list', method: 'teamwork/listFiles', body: { args: { request: { sessionId: 's1', path: '' } } } });
    b.handle({ t: 'call', pairingId: 'p', id: 'read', method: 'teamwork/readFile', body: { args: { request: { sessionId: 's1', path: 'notes.md' } } } });
    b.handle({ t: 'call', pairingId: 'p', id: 'out', method: 'teamwork/readFile', body: { args: { request: { sessionId: 's1', path: '/etc/hostname' } } } });
    for (let i = 0; i < 20; i++) await tick();
    expect(sent).toContainEqual(expect.objectContaining({ id: 'list', body: { result: { ok: true, value: { path: '', entries: [{ name: 'notes.md', kind: 'file', bytes: 2 }], truncated: false } } } }));
    expect(sent).toContainEqual(expect.objectContaining({ id: 'read', body: { result: { ok: true, value: { path: 'notes.md', text: 'hi', bytes: 2, truncated: false } } } }));
    expect(sent).toContainEqual(expect.objectContaining({ id: 'out', body: { result: { ok: false, error: { code: 'teamwork/not_found' } } } }));
  });

  it('checks desktop admission before invoking session configuration operations', async () => {
    let called=false;
    const session: PhoneSessionOps = { fileRoot: async () => process.cwd(), selectPermission: async () => ({}), accepted: () => false, configuration: async () => { called=true; return {}; }, selectModel: async () => { called=true; return {}; }, check: async () => { called=true; } };
    const { b, sent } = bridge({ session, denied: true });
    b.handle({ t: 'call', pairingId: 'p', id: 'c', method: 'teamwork/configuration', body: { args: { request: { sessionId: 'hidden' } } } });
    for (let i=0;i<6;i++) await tick();
    expect(called).toBe(false);
    expect(sent.at(-1)).toMatchObject({ body: { result: { ok: false, error: { code: 'session/not-found' } } } });
  });

  it('confirms an already accepted request even after its image or file receipts are retired', async () => {
    let checked = false;
    const session: PhoneSessionOps = { fileRoot: async () => process.cwd(), selectPermission: async () => ({}), accepted: (_id, requestId) => requestId === 'already-accepted', configuration: async () => ({}), selectModel: async () => ({}), check: async () => { checked = true; throw new PhoneSessionError('busy'); } };
    const { b, sent, asked } = bridge({ session });
    b.handle({ t: 'call', pairingId: 'p', id: 'retry', method: 'session/prompt', body: { args: { request: { sessionId: 's1', requestId: 'already-accepted', content: [{ type: 'file', receiptId: 'retired' }] } } } });
    for (let i = 0; i < 6; i++) await tick();
    expect(checked).toBe(false);
    expect(asked.some(call => call.url.endsWith('/session/prompt'))).toBe(false);
    expect(sent.at(-1)).toMatchObject({ status: 200, body: { result: { ok: true } } });
  });

  it('coalesces a still-in-flight prompt retry before native admission can race', async () => {
    let release!: () => void;
    const waitPrompt = new Promise<void>(resolve => { release = resolve; });
    const session: PhoneSessionOps = { fileRoot: async () => process.cwd(), selectPermission: async () => ({}), accepted: () => false, configuration: async () => ({}), selectModel: async () => ({}), check: async () => {} };
    const { b, sent, asked } = bridge({ session, waitPrompt });
    const body = { args: { request: { sessionId: 's1', requestId: 'one-task', content: [{ type: 'text', text: 'one task' }] } } };
    b.handle({ t: 'call', pairingId: 'p', id: 'first', method: 'session/prompt', body });
    b.handle({ t: 'call', pairingId: 'p', id: 'retry', method: 'session/prompt', body });
    for (let i = 0; i < 6; i++) await tick();
    expect(asked.filter(call => call.url.endsWith('/session/prompt'))).toHaveLength(1);
    release(); for (let i = 0; i < 6; i++) await tick();
    expect(sent.filter(frame => ['first', 'retry'].includes(frame.id))).toHaveLength(2);
  });

  it('stores attachments while an agent is busy but keeps readiness checks on Send', async () => {
    let checked = false;
    const session: PhoneSessionOps = { fileRoot: async () => process.cwd(), selectPermission: async () => ({}), accepted: () => false, configuration: async () => ({}), selectModel: async () => ({}), check: async () => { checked = true; throw new PhoneSessionError('busy'); } };
    const { b, sent, asked } = bridge({ session, upload: true });
    const call = async (id: string, method: string, request: unknown) => {
      b.handle({ t: 'call', pairingId: 'p', id, method, body: { args: { request } } });
      for (let i = 0; i < 100 && !sent.some(frame => frame.id === id); i++) await tick();
      return sent.find(frame => frame.id === id).body.result;
    };
    const started = await call('start', 'teamwork/uploadStart', { sessionId: 's1', name: 'file.txt', bytes: 3 });
    expect(started.ok).toBe(true); expect(checked).toBe(false);
    await call('chunk', 'teamwork/uploadChunk', { sessionId: 's1', uploadId: started.value.uploadId, offset: 0, data: 'YWJj' });
    expect((await call('finish', 'teamwork/uploadFinish', { sessionId: 's1', uploadId: started.value.uploadId })).value.receiptId).toBe('receipt');
    expect(checked).toBe(false);
    expect((await call('send', 'session/prompt', { sessionId: 's1', requestId: 'new', content: [{ type: 'file', receiptId: 'receipt' }] })).error.code).toBe('teamwork/busy');
    expect(checked).toBe(true);
    expect(asked.some(call => call.url.endsWith('/session/prompt'))).toBe(false);
    b.dropAll();
  });

  it('blocks image receipts for a text-only session and resolves them after a model switch', async () => {
    let vision = false;
    const session: PhoneSessionOps = {
      fileRoot: async () => process.cwd(), selectPermission: async () => ({}), accepted: () => false,
      configuration: async () => ({}), selectModel: async () => ({}), check: async () => {},
      checkImages: async () => { if (!vision) throw new PhoneSessionError('image_model_unsupported'); },
    };
    const { b, asked } = bridge({ session });
    const call = (id: string, method: string, request: unknown) => b.answer('p', id, method, { args: { request } });
    const start = await call('start', 'teamwork/uploadStart', { sessionId: 's1', name: 'picture.png', bytes: 3 });
    const uploadId = (start.body as any).result.value.uploadId;
    await call('chunk', 'teamwork/uploadChunk', { sessionId: 's1', uploadId, offset: 0, data: 'YWJj' });
    const finished = await call('finish', 'teamwork/uploadFinish', { sessionId: 's1', uploadId });
    const receiptId = (finished.body as any).result.value.receiptId;
    const prompt = { sessionId: 's1', requestId: 'send', content: [{ type: 'file', receiptId }] };
    expect((await call('blocked', 'session/prompt', prompt)).body).toMatchObject({
      result: { ok: false, error: { code: 'teamwork/image_model_unsupported' } },
    });
    expect(asked.some(call => call.url.endsWith('/session/prompt'))).toBe(false);
    vision = true;
    expect((await call('allowed', 'session/prompt', prompt)).body).toMatchObject({ result: { ok: true } });
    const forwarded = asked.find(call => call.url.endsWith('/session/prompt'));
    expect(JSON.parse(String(forwarded?.init?.body)).payload.args.request.content).toEqual([
      { type: 'image', mediaType: 'image/png', data: 'YWJj', name: 'picture.png' },
    ]);
    b.dropAll();
  });

  it('returns a preflight refusal without submitting the prompt', async () => {
    const session: PhoneSessionOps = { fileRoot: async () => process.cwd(), selectPermission: async () => ({}), accepted: () => false, configuration: async () => ({}), selectModel: async () => ({}), check: async () => { throw new PhoneSessionError('missing_tools'); } };
    const { b, sent, asked } = bridge({ session });
    b.handle({ t: 'call', pairingId: 'p', id: 'c', method: 'session/prompt', body: { args: { request: { sessionId: 's1' } } } });
    for (let i=0;i<6;i++) await tick();
    expect(asked.some(call => call.url.endsWith('/session/prompt'))).toBe(false);
    expect(sent.at(-1)).toMatchObject({ body: { result: { ok: false, error: { code: 'teamwork/missing_tools' } } } });
  });

  it('refuses a method off the list without touching DSH', async () => {
    const { b, sent, asked } = bridge();
    b.handle({ t: 'call', pairingId: 'p', id: '1', method: 'settings/update', body: { args: {} } });
    b.handle({ t: 'call', pairingId: 'p', id: '2', method: 'session/list/../../settings/update', body: {} });
    await tick();
    expect(asked).toEqual([]);
    expect(sent).toEqual([
      { t: 'result', pairingId: 'p', id: '1', status: 403, body: { error: 'method_not_allowed' } },
      { t: 'result', pairingId: 'p', id: '2', status: 403, body: { error: 'method_not_allowed' } },
    ]);
  });

  it('replays an allowed call as the method it checked, under an answering identity of that pairing', async () => {
    const { b, sent, asked } = bridge();
    b.handle({ t: 'call', pairingId: 'p', id: 'c1', method: 'session/list', body: { args: { request: {} } } });
    await tick(); await tick();
    b.handle({ t: 'call', pairingId: 'p', id: 'c2', method: 'session/state', body: { args: {} } });
    b.handle({ t: 'call', pairingId: 'q', id: 'c3', method: 'session/state', body: { args: {} } });
    for (let i = 0; i < 5; i++) await tick();

    const connects = asked.filter(a => a.url.includes('/connect?'));
    expect(connects.map(a => a.url)).toEqual(Array(2).fill('http://127.0.0.1:3080/connect?token=launch-token&interactions=answer'));
    const calls = asked.filter(a => a.url.includes('/api/'));
    expect(calls[0]!.url).toBe('http://127.0.0.1:3080/api/session/list');
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ type: 'client-request', rpcId: 'c1', method: 'session/list', payload: { args: { request: {} } } });
    // One identity per pairing, minted once and reused.
    const cookies = calls.map(c => (c.init!.headers as Record<string, string>).cookie);
    expect(cookies).toEqual(['dsh=peer-1', 'dsh=peer-1', 'dsh=peer-2']);
    expect(sent).toContainEqual({ t: 'result', pairingId: 'p', id: 'c1', status: 200, body: { type: 'client-response', result: { ok: true, value: 'v' } } });
  });

  it('passes a rename, pin or archive on with exactly its fields, and nothing else of the kind', async () => {
    const { b, sent, asked } = bridge();
    b.handle({ t: 'call', pairingId: 'p', id: 'ok', method: 'session/rename', body: { args: { request: { sessionId: 's1', title: 'Release notes' } } } });
    b.handle({ t: 'call', pairingId: 'p', id: 'pin', method: 'workspace/pinSession', body: { args: { request: { sessionId: 's1' } } } });
    // Archiving never stops a running session's work from a phone, and a title is never empty.
    b.handle({ t: 'call', pairingId: 'p', id: 'stop', method: 'workspace/archiveSession', body: { args: { request: { sessionId: 's1', stopActivity: true } } } });
    b.handle({ t: 'call', pairingId: 'p', id: 'empty', method: 'session/rename', body: { args: { request: { sessionId: 's1', title: '' } } } });
    b.handle({ t: 'call', pairingId: 'p', id: 'other', method: 'workspace/delete', body: { args: { request: { workspaceId: 'w' } } } });
    for (let i = 0; i < 6; i++) await tick();
    expect(asked.filter(a => a.url.includes('/api/')).map(a => a.url)).toEqual(['http://127.0.0.1:3080/api/session/rename', 'http://127.0.0.1:3080/api/workspace/pinSession']);
    expect(sent).toContainEqual({ t: 'result', pairingId: 'p', id: 'stop', status: 200, body: { result: { ok: false, error: { code: 'teamwork/invalid_request' } } } });
    expect(sent).toContainEqual({ t: 'result', pairingId: 'p', id: 'empty', status: 200, body: { result: { ok: false, error: { code: 'teamwork/invalid_request' } } } });
    expect(sent).toContainEqual({ t: 'result', pairingId: 'p', id: 'other', status: 403, body: { error: 'method_not_allowed' } });
  });

  it('marks each listed session with its place in the pin and archive sets and the workspace that lists it', async () => {
    const sent: any[] = [];
    const items = [{ sessionId: 'a', title: 'A' }, { sessionId: 'b' }, { sessionId: 'c' }, { sessionId: 'd' }];
    const workspaces = [{ id: 'w1', title: 'alpha', sessionIds: ['c', 'b'] }, { id: 'w2', title: 'beta', sessionIds: ['d', 'b'] }];
    const request = (async (url: string) => url.includes('/connect?')
      ? new Response(null, { status: 302, headers: { 'set-cookie': 'dsh=peer; Path=/' } })
      : new Response(JSON.stringify({ type: 'client-response', result: { ok: true, value: { items } } }))) as typeof fetch;
    const b = new Bridge({ launchUrl: () => 'http://127.0.0.1:3080/?token=t', send: (frame) => sent.push(frame), request, marks: () => ({ pinned: ['b'], archived: ['c'], workspaces }) });
    b.handle({ t: 'call', pairingId: 'p', id: 'l', method: 'session/list', body: { args: { _request: {} } } });
    for (let i = 0; i < 4; i++) await tick();
    expect(sent[0].body.result.value.items).toEqual([
      { sessionId: 'a', title: 'A', teamwork: { pinned: false, archived: false, workspace: null } },
      { sessionId: 'b', teamwork: { pinned: true, archived: false, workspace: { id: 'w1', title: 'alpha', index: 0, position: 1 } } },
      { sessionId: 'c', teamwork: { pinned: false, archived: true, workspace: { id: 'w1', title: 'alpha', index: 0, position: 0 } } },
      { sessionId: 'd', teamwork: { pinned: false, archived: false, workspace: { id: 'w2', title: 'beta', index: 1, position: 0 } } },
    ]);
  });

  it('starts a session in a folder that is a workspace as that workspace, so DSH lists it there', async () => {
    const { b, asked } = bridge({ workspaceAt: path => path === '/work/alpha' ? 'ws-alpha' : undefined });
    b.handle({ t: 'call', pairingId: 'p', id: 'c1', method: 'session/create', body: { args: { request: { cwd: '/work/alpha', agentPreset: 'team:t:p' } } } });
    b.handle({ t: 'call', pairingId: 'p', id: 'c2', method: 'session/create', body: { args: { request: { cwd: '/home/me/Desktop' } } } });
    for (let i = 0; i < 5; i++) await tick();
    const payloads = asked.filter(a => a.url.endsWith('/api/session/create')).map(a => JSON.parse(String(a.init!.body)).payload);
    expect(payloads).toEqual([
      { args: { request: { agentPreset: 'team:t:p', workspaceId: 'ws-alpha' } } },
      { args: { request: { cwd: '/home/me/Desktop' } } },
    ]);
  });

  it('mints a new identity once when DSH no longer knows the old one', async () => {
    const { b, sent, asked } = bridge({ expire: true });
    b.handle({ t: 'call', pairingId: 'p', id: 'c', method: 'session/list', body: {} });
    for (let i = 0; i < 6; i++) await tick();
    expect(asked.filter(a => a.url.includes('/connect?'))).toHaveLength(2);
    expect(sent).toEqual([expect.objectContaining({ id: 'c', status: 200 })]);
  });

  it('answers 503 where DSH serves no web', async () => {
    const { b, sent } = bridge({ web: false });
    b.handle({ t: 'call', pairingId: 'p', id: 'c', method: 'session/list', body: {} });
    await tick();
    expect(sent).toEqual([{ t: 'result', pairingId: 'p', id: 'c', status: 503, body: { error: 'no_web_server' } }]);
  });

  it('opens only allowed streams, and passes on frames only for streams the pairing opened', async () => {
    const { b, sent } = bridge();
    b.handle({ t: 'mux', pairingId: 'p', body: { type: 'open', streamId: 'x', endpoint: 'terminal/attach', payload: {} } });
    expect(sent).toEqual([{ t: 'mux', pairingId: 'p', body: { type: 'error', streamId: 'x', error: { code: 'stream_not_allowed', message: 'stream_not_allowed', details: {} } } }]);
    b.handle({ t: 'mux', pairingId: 'p', body: { type: 'item', streamId: 'x', value: 1 } });
    b.handle({ t: 'mux', pairingId: 'p', body: { type: 'cancel', streamId: 'someone-elses' } });
    await tick();
    expect(FakeSocket.made).toHaveLength(0);

    b.handle({ t: 'mux', pairingId: 'p', body: { type: 'open', streamId: 'e', endpoint: '$events', payload: { args: {} } } });
    for (let i = 0; i < 4; i++) await tick();
    const mux = FakeSocket.made[0]!;
    expect(mux.url).toBe('ws://127.0.0.1:3080/api/remote.mux');
    expect(mux.init.headers.cookie).toBe('dsh=peer-1');
    mux.emit('open');
    expect(mux.sent).toEqual([{ type: 'open', streamId: 'e', endpoint: '$events', payload: { args: {} } }]);

    // Another pairing's stream id reaches nothing through this pairing's mux.
    b.handle({ t: 'mux', pairingId: 'q', body: { type: 'cancel', streamId: 'e' } });
    expect(mux.sent).toHaveLength(1);

    mux.emit('message', { data: JSON.stringify({ type: 'item', streamId: 'e', value: { type: 'ready' } }) });
    expect(sent.at(-1)).toEqual({ t: 'mux', pairingId: 'p', body: { type: 'item', streamId: 'e', value: { type: 'ready' } } });
    // Once DSH ends a stream, the phone can no longer send on it.
    mux.emit('message', { data: JSON.stringify({ type: 'end', streamId: 'e' }) });
    b.handle({ t: 'mux', pairingId: 'p', body: { type: 'item', streamId: 'e', value: 2 } });
    expect(mux.sent).toHaveLength(1);
  });

  it('closes a pairing’s mux when its phone leaves, and ends its streams if DSH closes it', async () => {
    const { b, sent } = bridge();
    b.handle({ t: 'mux', pairingId: 'p', body: { type: 'open', streamId: 'f', endpoint: 'session/follow', payload: {} } });
    for (let i = 0; i < 4; i++) await tick();
    FakeSocket.made[0]!.emit('open');
    FakeSocket.made[0]!.close();
    expect(sent.at(-1)).toEqual({ t: 'mux', pairingId: 'p', body: { type: 'error', streamId: 'f', error: { code: 'dsh_closed', message: 'dsh_closed', details: {} } } });

    b.handle({ t: 'mux', pairingId: 'p', body: { type: 'open', streamId: 'g', endpoint: 'session/follow', payload: {} } });
    for (let i = 0; i < 4; i++) await tick();
    const second = FakeSocket.made[1]!;
    b.handle({ t: 'detach', pairingId: 'p' });
    expect(second.closed).toBe(true);
  });

  describe('keeps every frame within the encrypted channel’s message limit', () => {
    const bytes = (frame: unknown) => new TextEncoder().encode(JSON.stringify(frame)).length;
    const big = (n: number) => 'x'.repeat(n);
    async function follow() {
      const { b, sent } = bridge();
      b.handle({ t: 'mux', pairingId: 'p', body: { type: 'open', streamId: 'f', endpoint: 'session/follow', payload: {} } });
      for (let i = 0; i < 4; i++) await tick();
      const mux = FakeSocket.made[0]!;
      mux.emit('open');
      return { b, sent, mux };
    }
    const userMessage = (seq: number, text: string) => ({ seq, event: { type: 'user/message', seq, data: { source: { kind: 'user' }, content: [{ type: 'text', text }] } } });
    const toolResult = (seq: number, output: string) => ({ seq, event: { type: 'tool/result', seq, data: { message: { toolCallId: `call-${seq}`, content: [{ type: 'text', text: output }] } } } });

    it('shortens a snapshot of large tool output, keeping what the phone draws', async () => {
      const { sent, mux } = await follow();
      const records = Array.from({ length: 10 }, (_, i) => i % 2 ? toolResult(i, big(300_000)) : userMessage(i, `question ${i}`));
      mux.emit('message', { data: JSON.stringify({ type: 'item', streamId: 'f', value: { type: 'snapshot', cursor: 9, hasMore: false, records } }) });
      const frame = sent.at(-1);
      expect(bytes(frame)).toBeLessThanOrEqual(MAX_MESSAGE);
      expect(frame.body.value.type).toBe('snapshot');
      expect(frame.body.value.records.map((r: { seq: number }) => r.seq)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(frame.body.value.records[8].event.data.content[0].text).toBe('question 8');
    });

    it('keeps a snapshot’s newest records when shortening is not enough, and says there is more', async () => {
      const { sent, mux } = await follow();
      const records = Array.from({ length: 3000 }, (_, i) => userMessage(i, `question ${i} ${big(900)}`));
      mux.emit('message', { data: JSON.stringify({ type: 'item', streamId: 'f', value: { type: 'snapshot', cursor: 2999, hasMore: false, records } }) });
      const frame = sent.at(-1);
      expect(bytes(frame)).toBeLessThanOrEqual(MAX_MESSAGE);
      const kept = frame.body.value.records as Array<{ seq: number }>;
      expect(kept.at(-1)!.seq).toBe(2999);
      expect(kept[0]!.seq).toBeGreaterThan(0);
      expect(frame.body.value.hasMore).toBe(true);
    });

    it('shortens a live event and a call’s result', async () => {
      const { b, sent, mux } = await follow();
      mux.emit('message', { data: JSON.stringify({ type: 'item', streamId: 'f', value: { type: 'event', event: toolResult(5, big(2_000_000)).event } }) });
      expect(bytes(sent.at(-1))).toBeLessThanOrEqual(MAX_MESSAGE);
      expect(sent.at(-1).body.value.event.data.message.toolCallId).toBe('call-5');

      const request = (async () => new Response(JSON.stringify({ result: { ok: true, value: { records: [toolResult(1, big(3_000_000))], hasMore: false } } }))) as typeof fetch;
      const paged = new Bridge({ launchUrl: () => 'http://127.0.0.1:3080/?token=t', send: frame => sent.push(frame), request: (async (url: string, init?: RequestInit) => url.includes('/connect?') ? new Response(null, { status: 302, headers: { 'set-cookie': 'dsh=a' } }) : request(url, init)) as typeof fetch });
      paged.handle({ t: 'call', pairingId: 'p', id: 'page', method: 'session/page', body: { args: { request: {} } } });
      for (let i = 0; i < 6; i++) await tick();
      const result = sent.at(-1);
      expect(result).toMatchObject({ t: 'result', id: 'page', status: 200, body: { result: { ok: true } } });
      expect(bytes(result)).toBeLessThanOrEqual(MAX_MESSAGE);
      void b;
    });

    it('keeps a page’s newest records when shortening is not enough', async () => {
      const sent: any[] = [];
      const records = Array.from({ length: 3000 }, (_, i) => userMessage(i, `question ${i} ${big(900)}`));
      const request = (async (url: string) => url.includes('/connect?')
        ? new Response(null, { status: 302, headers: { 'set-cookie': 'dsh=a' } })
        : new Response(JSON.stringify({ result: { ok: true, value: { records, hasMore: false, cursor: 2999 } } }))) as typeof fetch;
      const paged = new Bridge({ launchUrl: () => 'http://127.0.0.1:3080/?token=t', send: frame => sent.push(frame), request });
      paged.handle({ t: 'call', pairingId: 'p', id: 'page', method: 'session/page', body: { args: { request: {} } } });
      for (let i = 0; i < 6; i++) await tick();
      const result = sent.at(-1);
      expect(bytes(result)).toBeLessThanOrEqual(MAX_MESSAGE);
      expect(result.body.result.value.hasMore).toBe(true);
      expect(result.body.result.value.records.at(-1).seq).toBe(2999);
    });
  });

  it('answers a cloud computer\'s server on DSH\'s own route, through the same allow-list', async () => {
    const selected: unknown[] = [];
    const session: PhoneSessionOps = { fileRoot: async () => process.cwd(), selectPermission: async () => ({}), accepted: () => false, configuration: async () => ({}), check: async () => {}, selectModel: async request => { selected.push(request); return { selected: request }; } };
    const { b, sent } = bridge({ session });
    const route = bridgeRoute(b);
    expect(route).toMatchObject({ path: '/api/teamwork/bridge', methods: ['POST'] });
    const post = async (body: unknown) => (await route.fetch(new Request('http://dsh/api/teamwork/bridge', { method: 'POST', body: JSON.stringify(body) }))).json();
    expect(await post({ id: 'c1', method: 'teamwork/selectModel', body: { args: { request: { sessionId: 's1', provider: 'local', model: 'coder' } } } }))
      .toMatchObject({ status: 200, body: { result: { ok: true } } });
    expect(selected).toEqual([{ sessionId: 's1', provider: 'local', model: 'coder' }]);
    expect(await post({ id: 'c2', method: 'session/selectModel', body: {} })).toEqual({ status: 403, body: { error: 'method_not_allowed' } });
    expect(await post({ id: 'c3', method: 'session/list', body: { args: { _request: {} } } })).toMatchObject({ status: 200, body: { result: { ok: true, value: 'v' } } });
    expect(await post({ method: 'session/list' })).toEqual({ status: 400, body: { error: 'invalid_request' } });
    // Nothing goes out to a relay: the server reads the answer.
    expect(sent).toEqual([]);
  });
});
