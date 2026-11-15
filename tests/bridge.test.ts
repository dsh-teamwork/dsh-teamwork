import { describe, expect, it } from 'vitest';
import { ALLOWED_CALLS, ALLOWED_STREAMS, Bridge } from '../src/bridge';
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

function bridge(options: { web?: boolean; expire?: boolean; session?: PhoneSessionOps; denied?: boolean; waitPrompt?: Promise<void>; upload?: boolean } = {}) {
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
  });
  return { b, sent, asked };
}

describe('the phone bridge', () => {
  it('holds the allow-list', () => {
    expect([...ALLOWED_CALLS].sort()).toEqual([
      '$events/result', 'session/cancel', 'session/create', 'session/list', 'session/modelCatalog', 'session/page',
      'session/prompt', 'session/state', 'teamwork/configuration', 'teamwork/selectModel', 'teamwork/uploadCancel', 'teamwork/uploadChunk', 'teamwork/uploadFinish', 'teamwork/uploadStart', 'userQuestions/answer',
    ]);
    expect([...ALLOWED_STREAMS].sort()).toEqual(['$events', 'session/follow']);
  });

  it('changes a model through the session-only handler, never the default-saving native endpoint', async () => {
    const selected: unknown[] = [];
    const session: PhoneSessionOps = { accepted: () => false, configuration: async () => ({}), check: async () => {}, selectModel: async request => { selected.push(request); return { selected: request }; } };
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

  it('checks desktop admission before invoking session configuration operations', async () => {
    let called=false;
    const session: PhoneSessionOps = { accepted: () => false, configuration: async () => { called=true; return {}; }, selectModel: async () => { called=true; return {}; }, check: async () => { called=true; } };
    const { b, sent } = bridge({ session, denied: true });
    b.handle({ t: 'call', pairingId: 'p', id: 'c', method: 'teamwork/configuration', body: { args: { request: { sessionId: 'hidden' } } } });
    for (let i=0;i<6;i++) await tick();
    expect(called).toBe(false);
    expect(sent.at(-1)).toMatchObject({ body: { result: { ok: false, error: { code: 'session/not-found' } } } });
  });

  it('lets the native idempotent path confirm an accepted request before busy and receipt checks', async () => {
    let checked = false;
    const session: PhoneSessionOps = { accepted: (_id, requestId) => requestId === 'already-accepted', configuration: async () => ({}), selectModel: async () => ({}), check: async () => { checked = true; throw new PhoneSessionError('busy'); } };
    const { b, sent, asked } = bridge({ session });
    b.handle({ t: 'call', pairingId: 'p', id: 'retry', method: 'session/prompt', body: { args: { request: { sessionId: 's1', requestId: 'already-accepted', content: [{ type: 'file', receiptId: 'retired' }] } } } });
    for (let i = 0; i < 6; i++) await tick();
    expect(checked).toBe(false);
    expect(asked.some(call => call.url.endsWith('/session/prompt'))).toBe(true);
    expect(sent.at(-1)).toMatchObject({ status: 200, body: { result: { ok: true } } });
  });

  it('coalesces a still-in-flight prompt retry before native admission can race', async () => {
    let release!: () => void;
    const waitPrompt = new Promise<void>(resolve => { release = resolve; });
    const session: PhoneSessionOps = { accepted: () => false, configuration: async () => ({}), selectModel: async () => ({}), check: async () => {} };
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
    const session: PhoneSessionOps = { accepted: () => false, configuration: async () => ({}), selectModel: async () => ({}), check: async () => { checked = true; throw new PhoneSessionError('busy'); } };
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

  it('returns a preflight refusal without submitting the prompt', async () => {
    const session: PhoneSessionOps = { accepted: () => false, configuration: async () => ({}), selectModel: async () => ({}), check: async () => { throw new PhoneSessionError('missing_tools'); } };
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
});
