import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RELAY_CLOSE, RelayLink, relayClientIdPath, type RelayStatus } from '../src/relay';

/** A WebSocket the test drives by hand: what the plugin sent, and what the relay answers. */
class FakeSocket {
  static made: FakeSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  closedWith?: number;
  private listeners: Record<string, Array<(event: any) => void>> = {};
  constructor(readonly url: string) { FakeSocket.made.push(this); }
  addEventListener(type: string, listener: (event: any) => void) { (this.listeners[type] ??= []).push(listener); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close(code = 1000) { this.closedWith = code; this.readyState = 3; }
  emit(type: string, event: any = {}) { if (type === 'open') this.readyState = 1; for (const l of this.listeners[type] ?? []) l(event); }
}

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

async function link(overrides: { status?: number; token?: string } = {}) {
  FakeSocket.made = [];
  const dir = await mkdtemp(join(tmpdir(), 'relay-'));
  const statuses: RelayStatus[] = [];
  const asked: string[] = [];
  let token: string | undefined = 'token' in overrides ? overrides.token : 'bearer-1';
  const relay = new RelayLink({
    endpoint: () => 'https://www.example.test',
    token: () => token,
    clientIdPath: relayClientIdPath(join(dir, 'cache.json')),
    name: 'laptop', dshVersion: '0.2.2-rc.1',
    request: (async (url: string) => { asked.push(url); const status = overrides.status ?? 200; return new Response(JSON.stringify({ url: 'wss://relay.example.test/plugin' }), { status }); }) as typeof fetch,
    WebSocket: FakeSocket as unknown as typeof WebSocket,
    onStatus: s => statuses.push(s),
    maxBackoffMs: 20, rediscoverMs: 1_000_000,
  });
  return { relay, statuses, asked, dir, signOut: () => { token = undefined; } };
}

describe('the relay link', () => {
  it('stays off while signed out, and asks nothing', async () => {
    const { relay, asked } = await link({ token: undefined });
    relay.refresh(); await tick(5);
    expect(relay.status).toBe('off');
    expect(asked).toEqual([]);
  });

  it('opens no socket when the server runs no relay (a community edition answers 404)', async () => {
    const { relay, asked } = await link({ status: 404 });
    relay.refresh(); await tick(5);
    expect(asked).toEqual(['https://www.example.test/api/relay']);
    expect(relay.status).toBe('off');
    expect(FakeSocket.made).toHaveLength(0);
    relay.stop();
  });

  it('introduces this computer and reports connected once the relay welcomes it', async () => {
    const { relay, dir } = await link();
    relay.refresh(); await tick(5);
    const socket = FakeSocket.made[0]!;
    expect(socket.url).toBe('wss://relay.example.test/plugin');
    socket.emit('open');
    expect(socket.sent[0]).toMatchObject({ t: 'hello', token: 'bearer-1', name: 'laptop', dshVersion: '0.2.2-rc.1', clientId: expect.any(String) });
    expect(relay.status).toBe('connecting');
    socket.emit('message', { data: JSON.stringify({ t: 'welcome', hostId: 'host-1' }) });
    expect(relay.status).toBe('connected');
    expect(relay.host).toBe('host-1');
    // One id per computer, kept beside the cache for the next start.
    const saved = JSON.parse(await readFile(join(dir, 'cache.host.json'), 'utf8'));
    expect(saved.clientId).toBe((socket.sent[0] as { clientId: string }).clientId);
    relay.stop();
  });

  it('reconnects after a dropped socket', async () => {
    const { relay } = await link();
    relay.refresh(); await tick(5);
    FakeSocket.made[0]!.emit('close', { code: 1006 });
    expect(relay.status).toBe('connecting');
    await tick(40);
    expect(FakeSocket.made).toHaveLength(2);
    relay.stop();
  });

  it('stops when the relay refuses the sign-in, or another connection from this computer replaced it', async () => {
    for (const code of [RELAY_CLOSE.unauthorized, RELAY_CLOSE.replaced]) {
      const { relay } = await link();
      relay.refresh(); await tick(5);
      FakeSocket.made[0]!.emit('close', { code });
      await tick(40);
      expect(relay.status).toBe('refused');
      expect(FakeSocket.made).toHaveLength(1);
      relay.stop();
    }
  });

  it('closes the socket on sign-out, and a late close of it changes nothing', async () => {
    const { relay, signOut } = await link();
    relay.refresh(); await tick(5);
    const socket = FakeSocket.made[0]!;
    socket.emit('open');
    signOut(); relay.refresh();
    expect(socket.closedWith).toBe(1000);
    expect(relay.status).toBe('off');
    socket.emit('close', { code: 1006 }); await tick(40);
    expect(FakeSocket.made).toHaveLength(1);
    expect(relay.status).toBe('off');
  });
});
