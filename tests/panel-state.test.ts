import { expect, test, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../src/index.js';
import type { FetchRoute, PanelState } from '../src/panel.js';

test('a panel request reads one inventory for every preset and sees changes on the next request', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'teamwork-panel-'));
  const cachePath = join(dir, 'cache.json');
  const configs = [
    { id: 'plugin', kind: 'plugin', name: 'Plugin', version: 1, data: { package: 'fixture', version: '1.0.0' } },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `preset-${i}`, kind: 'preset', name: `Preset ${i}`, version: 1,
      data: { provider: 'fixture', model: 'model', pluginDependencies: [{ pluginConfigId: 'plugin', version: '1.0.0' }] } })),
  ];
  const snapshot = { teams: [{ teamId: 'team', teamName: 'Team', role: 'member', configs }] };
  await writeFile(cachePath, JSON.stringify(snapshot));
  let enabled = true;
  const manager = {
    listBundles: vi.fn(async () => [{ name: 'fixture', version: '1.0.0', availability: 'profile', enabled, rows: [{ entryId: 'entry' }] }]),
    listPlugins: vi.fn(async () => [{ entryId: 'entry', enabled, fiberPhase: 'active' }]),
  };
  const routes = new Map<string, FetchRoute>();
  const cleanup: Array<() => unknown> = [];
  const services: Record<string, any> = { pluginManager: manager };
  const ctx: any = {
    llm: { registerAdapter: () => () => {} },
    sessionProjections: { register: async () => ({ dispose() {} }) },
    agentPresets: { register: async () => async () => {} },
    agents: { get: () => undefined },
    logger: { warn: vi.fn(), debug() {} },
    get: (name: string) => services[name],
    provide: (name: string, service: unknown) => { services[name] = service; },
    on: () => () => {},
    effect: (fn: () => (() => unknown)) => { cleanup.push(fn()); },
    connection: { fetch: { register: (route: FetchRoute) => { routes.set(route.path, route); return async () => {}; } } },
    inject: (names: string[], fn: (ctx: unknown) => void) => { if (names.length === 1 && names[0] === 'connection') fn(ctx); },
  };
  try {
    await apply(ctx, { apiEndpoint: 'http://localhost:3800', cachePath, autoSync: false });
    const read = async (): Promise<PanelState> => {
      const response = await routes.get('/api/teamwork/state')!.fetch(new Request('http://localhost/api/teamwork/state', { method: 'POST', body: '{}' }));
      expect(response.status).toBe(200);
      return response.json();
    };
    const first = await read();
    expect(first.presets).toHaveLength(8);
    expect(first.presets.every(p => p.plugins[0].state === 'ready')).toBe(true);
    expect(manager.listBundles).toHaveBeenCalledTimes(1);
    expect(manager.listPlugins).toHaveBeenCalledTimes(1);
    enabled = false;
    expect((await read()).presets.every(p => p.plugins[0].state === 'disabled')).toBe(true);
    expect(manager.listBundles).toHaveBeenCalledTimes(2);
    expect(manager.listPlugins).toHaveBeenCalledTimes(2);
    await services.dshTeamwork.logout();
    expect((await read()).plugins).toEqual([]);
    expect(manager.listBundles).toHaveBeenCalledTimes(2);
    expect(manager.listPlugins).toHaveBeenCalledTimes(2);
  } finally {
    for (const dispose of cleanup.reverse()) await dispose();
    await rm(dir, { recursive: true, force: true });
  }
});

test('a team model without its context window is shown as not ready and stops a request with the reason', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'teamwork-limits-'));
  const cachePath = join(dir, 'cache.json');
  const configs = [
    { id: 'sized', kind: 'model', name: 'Sized', version: 1, data: { provider: 'kimi', model: 'k2', contextWindow: 131072 } },
    { id: 'unsized', kind: 'model', name: 'DeepSeek Flash', version: 1, data: { provider: 'hosted:billing', model: 'deepseek-flash' } },
    { id: 'writer', kind: 'preset', name: 'Writer', version: 1, data: { modelConfigId: 'unsized' } },
  ];
  await writeFile(cachePath, JSON.stringify({ teams: [{ teamId: 'team', teamName: 'Team', role: 'member', configs }] }));
  const routes = new Map<string, FetchRoute>();
  const listeners = new Map<string, (...args: any[]) => unknown>();
  const services: Record<string, any> = {};
  const ctx: any = {
    llm: { registerAdapter: () => () => {} },
    sessionProjections: { register: async () => ({ dispose() {} }) },
    agentPresets: { register: async () => async () => {}, presetForSession: () => undefined, serviceFor: () => undefined },
    agents: { get: () => undefined },
    logger: { warn: vi.fn(), debug() {} },
    get: (name: string) => services[name],
    provide: (name: string, service: unknown) => { services[name] = service; },
    on: (name: string, listener: (...args: any[]) => unknown) => { listeners.set(name, listener); return () => {}; },
    effect: (fn: () => unknown) => { fn(); },
    connection: { fetch: { register: (route: FetchRoute) => { routes.set(route.path, route); return async () => {}; } } },
    inject: (names: string[], fn: (ctx: unknown) => void) => { if (names.length === 1 && names[0] === 'connection') fn(ctx); },
  };
  try {
    await apply(ctx, { apiEndpoint: 'http://localhost:3800', cachePath, autoSync: false });
    const response = await routes.get('/api/teamwork/state')!.fetch(new Request('http://localhost/api/teamwork/state', { method: 'POST', body: '{}' }));
    const state: PanelState = await response.json();
    expect(state.models.find(m => m.id === 'sized')?.contextWindowMissing).toBe(false);
    expect(state.models.find(m => m.id === 'unsized')?.contextWindowMissing).toBe(true);
    expect(state.presets[0]).toMatchObject({ model: 'DeepSeek Flash', modelAvailable: false, contextWindowMissing: true });

    const request = listeners.get('agent/request')!;
    const agent = (model: string) => ({ id: 's', model: { current: () => ({ provider: 'teamwork-platform', model }) }, session: {} });
    const next = vi.fn(async () => 'config');
    await expect(request({ agent: agent('unsized') }, next)).rejects.toThrow('“DeepSeek Flash” has no context window');
    expect(next).not.toHaveBeenCalled();
    await expect(request({ agent: agent('sized') }, next)).resolves.toBe('config');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
