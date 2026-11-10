import { afterEach, expect, test, vi } from 'vitest';
import { ConfigSync } from '../src/config-sync.js';
import type { TeamworkClient, TeamOverlay } from '../src/client.js';
function fixture() {
  let authenticated = true;
  const client = { authenticated: () => authenticated, current: () => undefined, sync: vi.fn(async () => {}) };
  const overlay = { apply: vi.fn(async () => {}) };
  const sync = new ConfigSync(client as unknown as TeamworkClient, overlay as unknown as TeamOverlay, true, 10000);
  return { client, overlay, sync, revoke: () => { authenticated = false; } };
}
afterEach(() => vi.useRealTimers());
test('polling waits for authentication and stops on disposal', async () => {
  vi.useFakeTimers(); const f = fixture(); f.revoke(); f.sync.start();
  await vi.advanceTimersByTimeAsync(10000); expect(f.client.sync).not.toHaveBeenCalled();
  f.client.authenticated = () => true;
  await vi.advanceTimersByTimeAsync(10000); expect(f.client.sync).toHaveBeenCalledTimes(1);
  expect(f.sync.status().lastSuccess).toBeDefined(); await f.sync.stop();
  await vi.advanceTimersByTimeAsync(30000); expect(f.client.sync).toHaveBeenCalledTimes(1);
});
test('manual and background requests share a flight and never pile up', async () => {
  vi.useFakeTimers(); const f = fixture(); let finish!: () => void;
  f.client.sync.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  f.sync.start(); const first = f.sync.sync(); expect(f.sync.sync()).toBe(first);
  await vi.advanceTimersByTimeAsync(40000); expect(f.client.sync).toHaveBeenCalledTimes(1);
  const stopping = f.sync.stop(); finish(); await first; await stopping;
  await vi.advanceTimersByTimeAsync(30000); expect(f.client.sync).toHaveBeenCalledTimes(1);
});
test('failure still reconciles permissions, hides transport details, and recovers', async () => {
  const f = fixture(); f.client.sync.mockRejectedValueOnce(new Error('sensitive transport detail'));
  await expect(f.sync.sync()).rejects.toThrow(); expect(f.overlay.apply).toHaveBeenCalledTimes(1);
  expect(f.sync.status().lastError).not.toContain('sensitive');
  await f.sync.sync(); expect(f.sync.status().lastError).toBeUndefined();
  f.revoke(); f.client.sync.mockRejectedValueOnce(new Error('403'));
  await expect(f.sync.sync()).rejects.toThrow(); expect(f.sync.status().lastError).toContain('重新登录');
  await f.sync.stop();
});
