// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { TeamworkPanel } from '../../src/web/TeamworkPanel.js';
import { api } from '../../src/web/api.js';
import { presetAvatar } from '../../src/web/avatars.js';
import type { PanelState } from '../../src/panel.js';
import type { Host, RenderFactorySlot } from '../../src/web/host.js';

vi.mock('../../src/web/api.js', async (original) => ({ HostUnreachable: (await original<typeof import('../../src/web/api.js')>()).HostUnreachable, api: { summary: vi.fn().mockRejectedValue(new Error("Unavailable")), state: vi.fn(), profile: vi.fn(), updateProfile: vi.fn(), sync: vi.fn(), use: vi.fn(), login: vi.fn(), authorize: vi.fn(), pairPhone: vi.fn(), decidePhone: vi.fn(), revokePhone: vi.fn(), setWorkspace: vi.fn() } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const profile = { id: 'user', name: 'Ada', email: 'ada@example.com', image: null, locale: 'zh-CN' as const };
const state: PanelState = {
  locale: 'zh-CN', authRevision: 0, authenticated: true, server: 'https://example.com', defaultServer: 'https://example.com',
  sync: { auto: true, running: false }, relay: 'connected', phones: [], session: null,
  teams: [{ id: 'a', name: 'Alpha', role: 'admin', consoleUrl: 'https://example.com/teams/a', workspace: '/home/ada/work' }, { id: 'b', name: 'Beta', role: 'member', consoleUrl: 'https://example.com/teams/b', workspace: '/home/ada' }],
  presets: ['a', 'b'].map(id => ({ id: `preset-${id}`, teamId: id, teamName: id, name: `Preset ${id}`, version: 1, description: 'Review', model: 'Model', assistant: false, modelAvailable: true, contextWindowMissing: false, modelOffline: false, tools: [], plugins: [] })),
  models: [], plugins: [],
};
/** DSH's workspaces: '/home/ada/work' is one, '/home/ada' (where DSH started) is not. */
let workspaces = { items: [{ workspaceId: 'ws-work', path: '/home/ada/work', title: 'Work' }] };
const listeners = new Set<() => void>();
const addWorkspace = (workspace: { workspaceId: string; path: string; title: string }) => { workspaces = { items: [...workspaces.items, workspace] }; listeners.forEach(listener => listener()); };
const host: Host = {
  sessions: { list: { getSnapshot: () => ({ byId: {} }), subscribe: () => () => {} } }, layout: { selectPanel: vi.fn() }, uiWorkspace: { startSession: vi.fn() },
  // DSH's list is a class instance whose methods use `this`, so the panel must not call them detached.
  workspaces: { list: new class { listeners = listeners; getSnapshot() { return workspaces; } subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; } }() },
};
/** Stands in for DSH's `workspace.picker`: open, it offers the existing workspace and "Add workspace…", which reports a new one. */
const renderFactorySlot: RenderFactorySlot = (_name, props) => props.open ? <div role="menu">
  <button onClick={() => props.onPick('ws-work')}>Pick Work</button>
  <button onClick={() => props.onPick('ws-new')}>Add workspace…</button>
</div> : null;
let root: ReturnType<typeof createRoot>;
let scenario = 0;
beforeEach(() => { vi.resetAllMocks(); profile.id = `user-${++scenario}`; vi.mocked(api.state).mockResolvedValue(state); vi.mocked(api.profile).mockResolvedValue(profile); });
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; localStorage.clear(); vi.clearAllMocks(); vi.useRealTimers(); });
async function mount() {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<TeamworkPanel host={host} renderFactorySlot={renderFactorySlot} />); });
}
async function click(text: string) {
  const button = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text);
  expect(button, text).toBeTruthy(); await act(async () => button!.click());
}
async function input(selector: string, value: string) {
  await act(async () => {
    const field = document.querySelector<HTMLInputElement>(selector)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

test('a slow profile never redirects someone who already opened the phone page', async () => {
  let resolve!: (value: typeof profile) => void;
  vi.mocked(api.profile).mockReturnValue(new Promise(r => { resolve = r; }));
  await mount(); await click('设备连接');
  await act(async () => resolve(profile));
  expect(document.body.textContent).toContain('用手机 App 或网页「我的 DSH」操作');
  expect(document.body.textContent).not.toContain('先从哪个团队开始');
});

test('preserves an unsaved profile across pages, keeps it after a failed save, and allows discarding it', async () => {
  vi.mocked(api.updateProfile).mockRejectedValue(new Error('Profile offline'));
  await mount(); await click('我的账号'); await input('#teamwork-name', 'Draft');
  await click('设备连接'); await click('我的账号');
  expect(document.querySelector<HTMLInputElement>('#teamwork-name')!.value).toBe('Draft');
  await click('保存资料');
  expect(document.querySelector<HTMLInputElement>('#teamwork-name')!.value).toBe('Draft');
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Profile offline');
  await click('撤销修改');
  expect(document.querySelector<HTMLInputElement>('#teamwork-name')!.value).toBe('Ada');
});

test('retains revoke confirmation after a failure so the member can retry', async () => {
  const phone = { id: 'phone', deviceName: 'Test phone', status: 'confirmed' as const, createdAt: new Date().toISOString(), lastUsedAt: null };
  vi.mocked(api.state).mockResolvedValue({ ...state, phones: [phone] });
  vi.mocked(api.revokePhone).mockRejectedValueOnce(new Error('Relay offline')).mockResolvedValueOnce(undefined);
  await mount(); await click('设备连接'); await click('解除配对');
  const confirm = () => [...document.querySelectorAll<HTMLButtonElement>('.twui-confirm button')][0];
  await act(async () => confirm().click());
  expect(document.querySelector('.twui-confirm')).not.toBeNull();
  await act(async () => confirm().click());
  expect(api.revokePhone).toHaveBeenCalledTimes(2);
});

test('explains an expired pairing code and offers a new one', async () => {
  vi.useFakeTimers();
  vi.mocked(api.pairPhone).mockResolvedValue({ code: '12345678', link: 'dshteamwork://pair?code=12345678', expiresAt: new Date(Date.now() + 1000).toISOString() });
  await mount(); await click('设备连接'); await click('配对新设备');
  await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
  expect(document.body.textContent).toContain('配对码已过期');
  expect([...document.querySelectorAll('button')].some(b => b.textContent === '重新生成')).toBe(true);
});

test.each([0, 1, 2])('completes first sign-in and lands correctly with %i teams', async count => {
  vi.mocked(api.state).mockResolvedValue({ ...state, authenticated: false, teams: [], presets: [] });
  vi.mocked(api.login).mockResolvedValue({ url: 'https://example.com/plugin', automatic: true });
  vi.mocked(api.authorize).mockImplementation(async () => { vi.mocked(api.state).mockResolvedValue({ ...state, teams: state.teams.slice(0, count), presets: [] }); });
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  try {
    await mount(); await click('在浏览器中登录');
    expect(document.body.textContent).toContain('等待浏览器确认授权');
    expect(document.querySelector('a')?.href).toBe('https://example.com/plugin');
    await input('#teamwork-code', 'code'); await click('完成授权');
    if (!count) expect(document.body.textContent).toContain('接下来加入团队');
    else if (count === 1) expect(document.querySelector('.twui-select-primary')?.textContent).toContain('Alpha');
    else expect(document.body.textContent).toContain('先从哪个团队开始');
  } finally { open.mockRestore(); }
});

test('reports a timed-out login and starts a fresh authorization request', async () => {
  vi.useFakeTimers();
  vi.mocked(api.state).mockResolvedValue({ ...state, authenticated: false, teams: [] });
  vi.mocked(api.login).mockResolvedValue({ url: 'https://example.com/plugin', automatic: true });
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  try {
    await mount(); await click('在浏览器中登录');
    await act(async () => { await vi.advanceTimersByTimeAsync(600001); });
    expect(document.body.textContent).toContain('本次登录等待已超时');
    await click('重新开始登录'); expect(api.login).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).not.toContain('本次登录等待已超时');
  } finally { open.mockRestore(); }
});

test('switches teams and survives a removed membership without changing the phone page or current session', async () => {
  vi.useFakeTimers();
  await mount(); await click('查看全部团队资源');
  await act(async () => document.querySelector<HTMLButtonElement>('.twui-select-trigger')!.click());
  await act(async () => document.querySelector('[role="option"][data-index="2"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(document.body.textContent).toContain('Preset b'); expect(document.body.textContent).not.toContain('Preset a');
  await click('设备连接');
  vi.mocked(api.state).mockResolvedValue({ ...state, teams: state.teams.slice(0, 1), presets: state.presets.slice(0, 1) });
  await act(async () => { await vi.advanceTimersByTimeAsync(5001); });
  expect(document.body.textContent).toContain('用手机 App 或网页「我的 DSH」操作');
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="返回团队资源"]')!.click()); expect(document.querySelector('.twui-select-primary')!.textContent).toContain('全部团队');
  expect(api.use).not.toHaveBeenCalled(); expect(api.decidePhone).not.toHaveBeenCalled();
});

test('sets a team’s default workspace from DSH’s own workspace menu, including a folder added there', async () => {
  vi.mocked(api.setWorkspace).mockResolvedValue(undefined);
  await mount(); await click('我的团队');
  // A workspace shows by its title; where DSH started, which is not one, by its folder name.
  expect([...document.querySelectorAll('button')].map(b => b.textContent).filter(text => text === 'Work' || text === 'ada')).toEqual(['Work', 'ada']);
  await click('ada'); await click('Pick Work');
  expect(api.setWorkspace).toHaveBeenCalledWith('b', '/home/ada/work');
  expect(document.body.textContent).toContain('已保存Beta的默认工作区');
  // A folder added in the menu reaches DSH's list just after the menu reports it.
  await click('ada'); await click('Add workspace…');
  expect(api.setWorkspace).toHaveBeenCalledTimes(1);
  await act(async () => addWorkspace({ workspaceId: 'ws-new', path: '/home/ada/new', title: 'New' }));
  expect(api.setWorkspace).toHaveBeenLastCalledWith('b', '/home/ada/new');
});

test('locks pairing generation and lets the member hide a still-valid code', async () => {
  let resolve!: (value: { code: string; link: string; expiresAt: string }) => void;
  vi.mocked(api.pairPhone).mockReturnValue(new Promise(r => { resolve = r; }));
  await mount(); await click('设备连接'); await click('配对新设备'); await click('配对新设备');
  expect(api.pairPhone).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ code: '12345678', link: 'dshteamwork://pair?code=12345678', expiresAt: new Date(Date.now() + 60000).toISOString() }));
  expect(document.body.textContent).toContain('扫码或输入'); await click('取消');
  expect(document.querySelector('[aria-label="配对二维码"]')).toBeNull();
});

test('retries rejecting a request, then confirms a new request and revokes the resulting pairing', async () => {
  const pending = { id: 'phone', deviceName: 'Test phone', safetyCode: '1234 5678', phoneConfirmed: true, status: 'pending' as const, createdAt: new Date().toISOString(), lastUsedAt: null };
  let current: PanelState = { ...state, phones: [pending] };
  vi.mocked(api.state).mockImplementation(async () => current);
  vi.mocked(api.decidePhone).mockRejectedValueOnce(new Error('Relay offline')).mockImplementation(async (id, accept) => {
    current = { ...current, phones: accept ? [{ ...pending, status: 'confirmed' }] : [] };
  });
  vi.mocked(api.revokePhone).mockImplementation(async () => { current = { ...current, phones: [] }; });
  await mount(); await click('设备连接 · 1');
  // The request is step two, its safety code on its own line, and what pairing grants is one fold away.
  expect(document.body.textContent).toContain('Test phone 请求配对');
  expect(document.body.textContent).toContain('1234 5678');
  expect(document.body.textContent).toContain('目前不能只授权某一个团队');
  await click('拒绝'); expect(document.body.textContent).toContain('等待你确认');
  await click('拒绝'); expect(document.body.textContent).not.toContain('等待你确认');
  current = { ...current, phones: [pending] };
  await click('刷新'); await click('确认配对');
  expect(document.body.textContent).toContain('Test phone 已配对');
  expect(document.body.textContent).not.toContain('等待你确认');
  await click('解除配对'); await act(async () => document.querySelector<HTMLButtonElement>('.twui-confirm button')!.click());
  // With no device left, the page explains pairing in three steps again.
  expect(document.body.textContent).toContain('在手机或浏览器上用这台电脑的 DSH');
});

test('profile read retry stays on the account page instead of opening onboarding', async () => {
  vi.mocked(api.profile).mockRejectedValueOnce(new Error('Profile offline')).mockResolvedValueOnce(profile);
  await mount(); await click('我的账号'); await click('重试');
  expect(document.querySelector<HTMLInputElement>('#teamwork-name')?.value).toBe('Ada');
  expect(document.body.textContent).not.toContain('先从哪个团队开始');
});

test('hides a consumed code when a new pending phone replaces another pending phone', async () => {
  vi.useFakeTimers();
  const phone = { id: 'old', deviceName: 'Old request', status: 'pending' as const, createdAt: new Date().toISOString(), lastUsedAt: null };
  let current: PanelState = { ...state, phones: [phone] };
  vi.mocked(api.state).mockImplementation(async () => current);
  vi.mocked(api.pairPhone).mockResolvedValue({ code: '12345678', link: 'dshteamwork://pair?code=12345678', expiresAt: new Date(Date.now() + 60000).toISOString() });
  await mount(); await click('设备连接 · 1'); await click('配对新设备');
  expect(document.querySelector('[aria-label="配对二维码"]')).not.toBeNull();
  current = { ...current, phones: [{ ...phone, id: 'new', deviceName: 'New request' }] };
  await act(async () => { await vi.advanceTimersByTimeAsync(5001); });
  expect(document.querySelector('[aria-label="配对二维码"]')).toBeNull();
  expect(document.body.textContent).toContain('New request');
});

test('chooses a team, filters its resources without changing sessions, and edits the account through a custom select', async () => {
  vi.mocked(api.state).mockResolvedValue(state); vi.mocked(api.profile).mockResolvedValue(profile);
  vi.mocked(api.updateProfile).mockResolvedValue({ ...profile, locale: 'en' });
  await mount(); expect(document.body.textContent).toContain('先从哪个团队开始');
  await act(async () => document.querySelector('article button')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(document.body.textContent).toContain('Preset a'); expect(document.body.textContent).not.toContain('Preset b');
  expect(api.use).not.toHaveBeenCalled(); expect(host.uiWorkspace.startSession).not.toHaveBeenCalled();
  expect(document.querySelector('header .twui-select')).not.toBeNull();
  expect(document.querySelector('header')!.textContent).not.toContain('刷新');
  expect(document.querySelector('footer')!.textContent).toContain('Teamwork');
  expect(document.querySelector('footer button')!.textContent).toBe('刷新');
  await click('我的账号');
  expect(document.querySelector('select')).toBeNull();
  await act(async () => document.querySelector<HTMLButtonElement>('#teamwork-locale')!.click());
  await act(async () => [...document.querySelectorAll('[role="option"]')].find(o => o.textContent === 'English')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(api.updateProfile).not.toHaveBeenCalled();
  await click('保存资料'); expect(api.updateProfile).toHaveBeenCalledWith({ name: 'Ada', locale: 'en' });
  await click('设备连接'); expect(document.body.textContent).toContain('用手机 App 或网页「我的 DSH」操作');
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="返回团队资源"]')!.click());
  await act(async () => document.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click());
  act(() => root.unmount());
  await mount();
  expect(document.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe('true');
});

test('never overlaps state polling while a slow request is pending', async () => {
  vi.useFakeTimers(); vi.mocked(api.state).mockReturnValue(new Promise(() => {}));
  await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(api.state).toHaveBeenCalledTimes(1);
});

test('switching resource teams discards a late summary and does not block resource rendering', async () => {
  let finish!: (value: Awaited<ReturnType<typeof api.summary>>) => void;
  vi.mocked(api.summary).mockImplementation(id => id === 'a' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ budget: { remaining: '2', state: 'known', resetAt: null, tokenLimited: false, exhausted: false }, pendingReviews: 0 }));
  await mount(); await click('查看全部团队资源');
  const select = async (index: number) => {
    await act(async () => document.querySelector<HTMLButtonElement>('.twui-select-trigger')!.click());
    await act(async () => document.querySelector(`[role="option"][data-index="${index}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  };
  await select(1); expect(document.body.textContent).toContain('Preset a');
  await select(2); expect(document.body.textContent).toContain('预算剩余 2 积分');
  await act(async () => finish({ budget: { remaining: '999', state: 'known', resetAt: null, tokenLimited: false, exhausted: false }, pendingReviews: 0 }));
  expect(document.body.textContent).not.toContain('999');
  expect(api.use).not.toHaveBeenCalled();
});

test('speaks the language the host reports, and every word follows when it changes', async () => {
  vi.useFakeTimers();
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en' });
  await mount();
  expect(document.body.textContent).toContain('Which team first?');
  expect(document.body.textContent).not.toMatch(/[\u4e00-\u9fff]/);
  vi.mocked(api.state).mockResolvedValue(state);
  await act(async () => { await vi.advanceTimersByTimeAsync(5001); });
  expect(document.body.textContent).toContain('先从哪个团队开始');
});

test('words a request that never reached the host in the panel’s language', async () => {
  const { HostUnreachable } = await import('../../src/web/api.js');
  vi.mocked(api.state).mockResolvedValueOnce({ ...state, locale: 'en' }).mockRejectedValue(new HostUnreachable('not-loaded'));
  vi.mocked(api.sync).mockRejectedValue(new HostUnreachable('offline'));
  await mount(); await click('Show every team’s resources'); await click('Refresh');
  expect(document.querySelector('.twui-toast')?.textContent).toContain('Cannot reach DSH.');
  expect(document.querySelector('.twui-banner')?.textContent).toContain('Restart DSH.');
});

test('leads with the team assistant, starts a session with it, and names teams only while all are shown', async () => {
  const assistant = { ...state.presets[0], id: 'assistant-a', name: 'Alpha assistant', assistant: true };
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en', presets: [assistant, ...state.presets] });
  await mount(); await click('Show every team’s resources');
  const featured = document.querySelector('.twui-featured')!;
  expect(featured.textContent).toContain('Alpha assistant'); expect(featured.textContent).toContain('Team assistant');
  expect(featured.textContent).toContain('a');
  expect(document.querySelector('.twui-resource-list')!.textContent).not.toContain('Alpha assistant');
  // Only the assistant's action is primary; every other row's new session is secondary.
  expect([...document.querySelectorAll('.twui-btn[data-variant="primary"]')].map(b => b.textContent)).toEqual(['Ask the assistant']);
  await click('Ask the assistant');
  // Team a's default folder is a DSH workspace, so the session opens there.
  expect(host.uiWorkspace.startSession).toHaveBeenCalledWith('ws-work', { agentPreset: 'team:a:assistant-a' });
  await act(async () => document.querySelector<HTMLButtonElement>('.twui-select-trigger')!.click());
  await act(async () => document.querySelector('[role="option"][data-index="1"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(document.querySelector('.twui-resource-list .twui-item-subtitle')).toBeNull();
  expect(document.querySelector('.twui-featured .twui-item-subtitle')).toBeNull();
});

test('draws each preset with the avatar its admin chose, or the one its name picks', async () => {
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en', presets: [{ ...state.presets[0], avatar: 'legal' }, state.presets[1]] });
  await mount(); await click('Show every team’s resources');
  const plates = [...document.querySelectorAll('.twui-resource-list .twui-tile-media rect')].map(r => r.getAttribute('fill'));
  expect(plates).toEqual([presetAvatar('legal', 'Preset a').plate, presetAvatar(undefined, 'Preset b').plate]);
});

test('shows an admin the reviews waiting in the browsed team, and a member none', async () => {
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en' });
  vi.mocked(api.summary).mockResolvedValue({ budget: { remaining: null, state: 'unlimited', resetAt: null, tokenLimited: false, exhausted: false }, pendingReviews: 2 });
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  try {
    await mount();
    await act(async () => document.querySelector('article button')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await click('2 to review');
    expect(open).toHaveBeenCalledWith('https://example.com/teams/a/sharing', '_blank', 'noopener');
    await act(async () => document.querySelector<HTMLButtonElement>('.twui-select-trigger')!.click());
    await act(async () => document.querySelector('[role="option"][data-index="2"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).not.toContain('to review');
  } finally { open.mockRestore(); }
});

test('marks a team model without its context window, and a preset on it, as not ready with the reason', async () => {
  const session = { id: 's', model: null, preset: null, started: false };
  const model = (id: string, name: string, contextWindowMissing: boolean) => ({ id, teamId: 'a', teamName: 'a', name, version: 1, upstream: `p/${id}`, contextWindowMissing, modelOffline: false });
  const preset = { ...state.presets[0], model: 'Flash', modelAvailable: false, contextWindowMissing: true };
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en', session, presets: [preset], models: [model('sized', 'Sized', false), model('flash', 'Flash', true)] });
  await mount(); await click('Show every team’s resources');
  const reason = 'The team model “Flash” has no context window (contextWindow) configured';
  const row = (title: string) => [...document.querySelectorAll('.twui-item')].find(r => r.querySelector('.twui-item-title')?.firstChild?.textContent === title)!;
  expect(row('Preset a').textContent).toContain(reason);
  const tab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(b => b.textContent?.startsWith('Models'))!;
  await act(async () => tab.click());
  expect(row('Flash').textContent).toContain(reason);
  expect(row('Flash').querySelector('button:disabled')).not.toBeNull();
  expect(row('Sized').textContent).not.toContain('context window');
  expect(row('Sized').querySelector('button:disabled')).toBeNull();
});

test('marks a hosted model taken offline, and a preset on it, as not ready with the reason', async () => {
  const session = { id: 's', model: null, preset: null, started: false };
  const model = (id: string, name: string, modelOffline: boolean) => ({ id, teamId: 'a', teamName: 'a', name, version: 1, upstream: `p/${id}`, contextWindowMissing: false, modelOffline });
  const preset = { ...state.presets[0], model: 'Opus', modelAvailable: false, modelOffline: true };
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en', session, presets: [preset], models: [model('live', 'Live', false), model('opus', 'Opus', true)] });
  await mount(); await click('Show every team’s resources');
  const reason = 'The team model “Opus” has been taken offline by the service that hosts it';
  const row = (title: string) => [...document.querySelectorAll('.twui-item')].find(r => r.querySelector('.twui-item-title')?.firstChild?.textContent === title)!;
  expect(row('Preset a').textContent).toContain(reason);
  const tab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(b => b.textContent?.startsWith('Models'))!;
  await act(async () => tab.click());
  expect(row('Opus').textContent).toContain(reason);
  expect(row('Opus').querySelector('button:disabled')).not.toBeNull();
  expect(row('Live').textContent).not.toContain('taken offline');
  expect(row('Live').querySelector('button:disabled')).toBeNull();
});

test('a request waits for the device before it can be confirmed, and says so', async () => {
  const pending = { id: 'p', deviceName: 'Pixel', safetyCode: '27 81 46', phoneConfirmed: false, status: 'pending' as const, createdAt: new Date().toISOString(), lastUsedAt: null };
  vi.mocked(api.state).mockResolvedValue({ ...state, phones: [pending] });
  await mount(); await click('设备连接 · 1');
  expect(document.body.textContent).toContain('等待设备确认…');
  expect([...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '确认配对')!.disabled).toBe(true);
  // A new code is still one click away while a request waits.
  expect([...document.querySelectorAll('button')].some(b => b.textContent === '配对新设备')).toBe(true);
});

test('while the relay reconnects, paired devices stay listed, dimmed and without actions', async () => {
  const phone = { id: 'phone', deviceName: 'Ada 的 iPhone', deviceKind: 'ios' as const, status: 'confirmed' as const, verified: true, createdAt: new Date().toISOString(), lastUsedAt: null };
  vi.mocked(api.state).mockResolvedValue({ ...state, relay: 'connecting', phones: [phone] });
  await mount(); await click('设备连接');
  expect(document.body.textContent).toContain('正在连接中转服务');
  expect(document.body.textContent).toContain('Ada 的 iPhone');
  expect([...document.querySelectorAll('button')].some(b => b.textContent === '解除配对')).toBe(false);
  expect([...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '配对新设备')!.disabled).toBe(true);
});

test('a paired device shows a badge only when it must pair again, and its kind once', async () => {
  const at = new Date().toISOString();
  vi.mocked(api.state).mockResolvedValue({ ...state, phones: [
    { id: 'web', deviceName: '网页浏览器', deviceKind: 'web' as const, status: 'confirmed' as const, verified: true, createdAt: at, lastUsedAt: null },
    { id: 'old', deviceName: '旧 Pixel', deviceKind: 'android' as const, status: 'confirmed' as const, verified: false, createdAt: at, lastUsedAt: null },
  ] });
  await mount(); await click('设备连接');
  const row = (title: string) => [...document.querySelectorAll('.twui-item')].find(r => r.querySelector('.twui-item-title')?.firstChild?.textContent === title)!;
  expect(row('网页浏览器').textContent).not.toContain('网页浏览器 ·');
  expect(row('网页浏览器').querySelector('.twui-badge, [data-tone]')).toBeNull();
  expect(row('旧 Pixel').textContent).toContain('需重新配对');
  expect(row('旧 Pixel').textContent).toContain('Android 手机 ·');
});

test('a page has no back link: the brand mark and the team menu lead back to the team resources', async () => {
  await mount(); await click('设备连接');
  expect([...document.querySelectorAll('button')].some(b => b.textContent === '返回团队资源')).toBe(false);
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="返回团队资源"]')!.click());
  expect(document.querySelector('[role="tab"]')).not.toBeNull();
});

// Team DSH is offline on the server: the panel offers no way into it, signed out or in.
test('the sign-in screen offers no Team DSH', async () => {
  vi.mocked(api.state).mockResolvedValue({ ...state, authenticated: false, teams: [], presets: [] });
  await mount();
  expect(document.body.textContent).toContain('在浏览器中登录');
  expect(document.body.textContent).not.toContain('团队 DSH');
});

test('the account page offers no Team DSH', async () => {
  vi.mocked(api.state).mockResolvedValue(state);
  await mount();
  await click('我的账号');
  expect(document.body.textContent).toContain('退出此 DSH 的 Teamwork');
  expect(document.body.textContent).not.toContain('团队 DSH');
});
