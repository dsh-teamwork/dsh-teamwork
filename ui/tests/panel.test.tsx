// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { TeamworkPanel } from '../../src/web/TeamworkPanel.js';
import { api } from '../../src/web/api.js';
import { presetAvatar } from '../../src/web/avatars.js';
import type { PanelState } from '../../src/panel.js';
import type { Host, RenderFactorySlot } from '../../src/web/host.js';

vi.mock('../../src/web/api.js', async (original) => ({ HostUnreachable: (await original<typeof import('../../src/web/api.js')>()).HostUnreachable, api: { summary: vi.fn().mockRejectedValue(new Error("Unavailable")), state: vi.fn(), profile: vi.fn(), updateProfile: vi.fn(), logout: vi.fn(), sync: vi.fn(), use: vi.fn(), login: vi.fn(), authorize: vi.fn(), pairPhone: vi.fn(), decidePhone: vi.fn(), revokePhone: vi.fn(), setWorkspace: vi.fn(), teamUsage: vi.fn() } }));
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
  sessions: { list: { getSnapshot: () => ({ byId: {} }), subscribe: () => () => {} } }, uiWorkspace: { startSession: vi.fn(), connectWorkspace: vi.fn(), openSession: vi.fn() },
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
beforeEach(() => { vi.resetAllMocks(); profile.id = `user-${++scenario}`; vi.mocked(api.state).mockResolvedValue(state); vi.mocked(api.profile).mockResolvedValue(profile); vi.mocked(api.teamUsage).mockRejectedValue(new Error('Unavailable')); });
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

test.each([
  ['example.com', '切换账号', '退出并切换'],
  ['我的账号', '退出登录', '确认退出'],
])('confirms sign-out from %s before returning to sign-in', async (entry, action, confirm) => {
  vi.mocked(api.logout).mockImplementation(async () => {
    vi.mocked(api.state).mockResolvedValue({ ...state, authenticated: false, teams: [], presets: [] });
  });
  await mount();
  expect(document.querySelector('footer button[aria-label="DSH 连接 · example.com"]')?.textContent).toBe('example.com');
  await click(entry); await click(action);
  expect(api.logout).not.toHaveBeenCalled();
  await click('取消');
  expect(document.querySelector('.twui-confirm')).toBeNull();
  await click(action); await click(confirm);
  expect(api.logout).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).toContain('在浏览器中登录');
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
    else if (count === 1) {
      expect(document.querySelector('header .twui-team-name')?.textContent).toBe('Alpha');
      expect(document.querySelector('header .twui-select-trigger')).toBeNull();
    }
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
  localStorage.setItem(`teamwork:team:${state.server}:${profile.id}`, 'all');
  await mount();
  expect(document.querySelector('.twui-select-primary')?.textContent).toContain('Alpha');
  await act(async () => document.querySelector<HTMLButtonElement>('.twui-select-trigger')!.click());
  expect([...document.querySelectorAll('[role="option"]')].map(option => option.getAttribute('data-index'))).toEqual(['0', '1']);
  await act(async () => document.querySelector('[role="option"][data-index="1"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(document.body.textContent).toContain('Preset b'); expect(document.body.textContent).not.toContain('Preset a');
  await click('设备连接');
  vi.mocked(api.state).mockResolvedValue({ ...state, teams: state.teams.slice(0, 1), presets: state.presets.slice(0, 1) });
  await act(async () => { await vi.advanceTimersByTimeAsync(5001); });
  expect(document.body.textContent).toContain('用手机 App 或网页「我的 DSH」操作');
  await click('Alpha');
  expect(document.querySelector('header .twui-team-name')?.textContent).toBe('Alpha');
  expect(document.body.textContent).toContain('Preset a');
  expect(api.use).not.toHaveBeenCalled(); expect(api.decidePhone).not.toHaveBeenCalled();
});

const settingsOf = async (team: string) => {
  await click('我的团队');
  const row = [...document.querySelectorAll('.twui-item')].find(r => r.querySelector('.twui-item-title')?.firstChild?.textContent === team)!;
  await act(async () => [...row.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '设置')!.click());
};

test('sets a team’s default workspace from DSH’s own workspace menu on its settings page, including a folder added there', async () => {
  vi.mocked(api.setWorkspace).mockResolvedValue(undefined);
  await mount(); await settingsOf('Beta');
  // Where DSH started, which is not a workspace, shows by its folder name.
  expect([...document.querySelectorAll('button')].some(b => b.textContent === 'ada')).toBe(true);
  await click('ada'); await click('Pick Work');
  expect(api.setWorkspace).toHaveBeenCalledWith('b', '/home/ada/work');
  expect(document.body.textContent).toContain('已保存Beta的默认工作区');
  // A folder added in the menu reaches DSH's list just after the menu reports it.
  await click('ada'); await click('Add workspace…');
  expect(api.setWorkspace).toHaveBeenCalledTimes(1);
  await act(async () => addWorkspace({ workspaceId: 'ws-new', path: '/home/ada/new', title: 'New' }));
  expect(api.setWorkspace).toHaveBeenLastCalledWith('b', '/home/ada/new');
});

test('a team’s settings show the member’s own usage as the console does, in whole points, and their budget, and lead to its resources', async () => {
  vi.mocked(api.teamUsage).mockResolvedValue({
    since: '2026-10-21T00:00:00Z',
    totals: { calls: 12, points: '1234.916349266', unpriced: 1, input: 24000, cacheRead: 8000, output: 6000, reasoning: 2000 },
    days: [{ day: '2026-11-19', calls: 2, points: '0.4' }, { day: '2026-11-20', calls: 10, points: '1234.516349266' }],
    sources: [
      { kind: 'model', name: 'Claude Opus', labels: {}, calls: 10, points: '1234.5' },
      { kind: 'meter', name: 'cloud.computer', labels: { 'zh-CN': '云电脑' }, calls: 2, points: '0.4' },
    ],
    budget: { remaining: '96.5', state: 'known', resetAt: '2026-12-01T00:00:00Z', tokenLimited: false, exhausted: false },
    nearLimit: [{ scope: 'member', period: 'month', threshold: 80 }],
  });
  await mount(); await settingsOf('Alpha');
  expect(api.teamUsage).toHaveBeenCalledWith('a');
  const text = document.body.textContent!;
  for (const shown of ['Alpha', '默认工作区', '1,235', '1 次尚无积分', '24,000', '其中缓存命中 8,000', '6,000', '其中推理 2,000', '每日积分', '单日最高 1,235 积分', 'Claude Opus', '1,235 积分 · 10 次', '云电脑', '0 积分 · 2 次', '预算剩余 97 积分', '你的本月预算已用 80%']) expect(text).toContain(shown);
  // Amounts are whole points everywhere on the page.
  expect(text).not.toMatch(/\d\.\d+ ?积分|1234\.9|96\.5/);
  // A meter shows by its name in the panel's language, never by its key.
  expect(text).not.toContain('cloud.computer');
  await click('打开工具箱');
  expect(document.querySelector('.twui-select-primary')!.textContent).toContain('Alpha');
});

test('a team’s settings say so when its usage cannot be read, and why', async () => {
  vi.mocked(api.teamUsage).mockRejectedValue(new Error('团队摘要暂不可用。 (teams/b/usage/stats: HTTP 403)'));
  await mount(); await settingsOf('Beta');
  expect(document.body.textContent).toContain('暂时读取不到');
  expect(document.body.textContent).toContain('teams/b/usage/stats: HTTP 403');
  expect(document.body.textContent).toContain('默认工作区');
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
  // The request is step two, its safety code on its own line.
  expect(document.body.textContent).toContain('Test phone 请求配对');
  expect(document.body.textContent).toContain('1234 5678');
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
  expect(document.querySelector('.twui-account-identity strong')?.textContent).toBe('Ada');
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

test('chooses a team, filters its resources without changing sessions, and shows the account identity', async () => {
  vi.mocked(api.state).mockResolvedValue(state); vi.mocked(api.profile).mockResolvedValue(profile);
  await mount(); expect(document.body.textContent).toContain('先从哪个团队开始');
  await act(async () => document.querySelector('article button')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(document.body.textContent).toContain('Preset a'); expect(document.body.textContent).not.toContain('Preset b');
  expect(api.use).not.toHaveBeenCalled(); expect(host.uiWorkspace.startSession).not.toHaveBeenCalled();
  expect(document.querySelector('header .twui-select')).not.toBeNull();
  expect(document.querySelector('header')!.textContent).not.toContain('刷新');
  expect(document.querySelector('footer')!.textContent).toContain('Teamwork');
  expect(document.querySelector('footer')!.textContent).toContain('刷新');
  await click('我的账号');
  const account = document.querySelector('.twui-account')!;
  expect(account.textContent).toContain(profile.email);
  expect(account.textContent).toContain('简体中文');
  expect(account.querySelector('input, form')).toBeNull();
  expect(account.querySelector('a[target="_blank"]')?.getAttribute('href')).toBe(`${state.server}/account`);
  const memberships = [...account.querySelectorAll('.twui-account-team')].map(row => row.textContent);
  expect(memberships).toEqual(['Alpha管理员', 'Beta成员']);
  const leaveLinks = [...account.querySelectorAll<HTMLAnchorElement>('.twui-account-team-leave')];
  expect(leaveLinks.map(link => [link.href, link.target, link.getAttribute('aria-label')])).toEqual([
    [state.teams[1].consoleUrl, '_blank', '在网页退出 Beta'],
  ]);
  await act(async () => account.querySelectorAll<HTMLButtonElement>('.twui-account-team')[1].click());
  expect(document.body.textContent).toContain('Preset b');
  expect(document.body.textContent).not.toContain('Preset a');
  await click('设备连接'); expect(document.body.textContent).toContain('用手机 App 或网页「我的 DSH」操作');
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="返回团队工具箱"]')!.click());
  await act(async () => document.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click());
  act(() => root.unmount());
  await mount();
  expect(document.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe('true');
});

test('saves the selected language immediately and keeps the account identity', async () => {
  vi.mocked(api.updateProfile).mockImplementation(async input => {
    vi.mocked(api.state).mockResolvedValue({ ...state, locale: input.locale });
    return { ...profile, locale: input.locale };
  });
  await mount(); await click('我的账号');
  await act(async () => document.querySelector<HTMLButtonElement>('#teamwork-locale')!.click());
  await act(async () => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent === 'English')!.click());
  expect(api.updateProfile).toHaveBeenCalledWith({ locale: 'en' });
  expect(document.querySelector('.twui-account h2')?.textContent).toBe('Account');
  expect(document.querySelector('#teamwork-locale')?.textContent).toBe('English');
  expect(document.querySelector('.twui-account-identity')?.textContent).toContain(profile.email);
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
  await mount(); await click('选择团队');
  const select = async (index: number) => {
    await act(async () => document.querySelector<HTMLButtonElement>('.twui-select-trigger')!.click());
    await act(async () => document.querySelector(`[role="option"][data-index="${index}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  };
  expect(document.body.textContent).toContain('Preset a');
  await select(1); expect(document.body.textContent).toContain('预算剩余 2 积分');
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
  await mount(); await click('Choose'); await click('Refresh');
  expect(document.querySelector('.twui-toast')?.textContent).toContain('Cannot reach DSH.');
  expect(document.querySelector('.twui-banner')?.textContent).toContain('Restart DSH.');
});

test('leads with the team assistant, starts a session with it, and displays only the selected team', async () => {
  const assistant = { ...state.presets[0], id: 'assistant-a', name: 'Alpha assistant', assistant: true };
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en', presets: [assistant, ...state.presets] });
  await mount(); await click('Choose');
  const featured = document.querySelector('.twui-featured')!;
  expect(featured.textContent).toContain('Alpha assistant'); expect(featured.textContent).toContain('Team assistant');
  expect(document.body.textContent).not.toContain('Preset b');
  expect(document.querySelector('.twui-resource-list')!.textContent).not.toContain('Alpha assistant');
  // Only the assistant's action is primary; every other row's new session is secondary.
  expect([...document.querySelectorAll('.twui-btn[data-variant="primary"]')].map(b => b.textContent)).toEqual(['Ask the assistant']);
  await click('Ask the assistant');
  // Team a's default folder is a DSH workspace, so the session opens there.
  expect(host.uiWorkspace.startSession).toHaveBeenCalledWith('ws-work', { agentPreset: 'team:a:assistant-a' });
  // An example question opens the same session with the question in its input, unsent.
  await click('What did I spend this month?');
  expect(host.uiWorkspace.startSession).toHaveBeenLastCalledWith('ws-work', { agentPreset: 'team:a:assistant-a', prompt: 'What did I spend this month?', whenDraftExists: 'replace' });
  expect(document.querySelector('.twui-resource-list .twui-item-subtitle')).toBeNull();
  expect(document.querySelector('.twui-featured .twui-item-subtitle')).toBeNull();
});

test('still offers a new session with the assistant while the open session already uses it', async () => {
  const assistant = { ...state.presets[0], id: 'assistant-a', name: 'Alpha assistant', assistant: true };
  const session = { id: 's1', model: null, preset: { id: 'assistant-a', name: 'Alpha assistant', version: 1 }, started: false };
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en', session, presets: [assistant, ...state.presets] });
  await mount(); await click('Choose');
  const featured = document.querySelector('.twui-featured')!;
  expect(featured.textContent).not.toContain('In use'); expect(featured.textContent).not.toContain('Use here');
  await click('Ask the assistant');
  expect(host.uiWorkspace.startSession).toHaveBeenLastCalledWith('ws-work', { agentPreset: 'team:a:assistant-a' });
});

test('a preset always starts a session, even the one a started open session uses, and never switches the open one', async () => {
  const session = { id: 's1', model: null, preset: { id: 'preset-a', name: 'Preset a', version: 1 }, started: true };
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en', session });
  await mount(); await click('Choose');
  const rows = document.querySelector('.twui-resource-list')!;
  expect(rows.textContent).not.toContain('In use'); expect(rows.textContent).not.toContain('blank session');
  expect(rows.textContent).not.toContain('has started');
  const starts = [...rows.querySelectorAll<HTMLButtonElement>('button')].filter(b => b.textContent === 'Start a session');
  expect(starts.map(b => b.disabled)).toEqual([false]);
  await act(async () => starts[0].click());
  expect(host.uiWorkspace.startSession).toHaveBeenLastCalledWith('ws-work', { agentPreset: 'team:a:preset-a' });
  expect(api.use).not.toHaveBeenCalled();
});

test('draws each preset with the avatar its admin chose, or the one its name picks', async () => {
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en', presets: [{ ...state.presets[0], avatar: 'legal' }, state.presets[1]] });
  await mount(); await click('Choose');
  const plate = () => document.querySelector('.twui-resource-list .twui-tile-media rect')?.getAttribute('fill');
  expect(plate()).toBe(presetAvatar('legal', 'Preset a').plate);
  await act(async () => document.querySelector<HTMLButtonElement>('.twui-select-trigger')!.click());
  await act(async () => document.querySelector<HTMLElement>('[role="option"][data-index="1"]')!.click());
  expect(plate()).toBe(presetAvatar(undefined, 'Preset b').plate);
});

test('ignores pending approval counts from older servers', async () => {
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en' });
  vi.mocked(api.summary).mockResolvedValue({ budget: { remaining: null, state: 'unlimited', resetAt: null, tokenLimited: false, exhausted: false }, pendingReviews: 2 });
  await mount();
  await act(async () => document.querySelector('article button')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(document.body.textContent).not.toContain('to review');
});

test('marks a team model without its context window, and a preset on it, as not ready with the reason', async () => {
  const session = { id: 's', model: null, preset: null, started: false };
  const model = (id: string, name: string, contextWindowMissing: boolean) => ({ id, teamId: 'a', teamName: 'a', name, version: 1, model: id, contextWindowMissing, modelOffline: false });
  const preset = { ...state.presets[0], model: 'Flash', modelAvailable: false, contextWindowMissing: true };
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en', session, presets: [preset], models: [
    { ...model('sized', 'Sized', false), contextWindow: 131072, maxTokens: 8192, vision: true },
    model('flash', 'Flash', true),
    { ...model('glm-5.3', 'glm-5.3', false), contextWindow: 131072 },
  ] });
  await mount(); await click('Choose');
  const reason = 'The team model “Flash” has no context window (contextWindow) configured';
  const row = (title: string) => [...document.querySelectorAll('.twui-item')].find(r => r.querySelector('.twui-item-title')?.firstChild?.textContent === title)!;
  expect(row('Preset a').textContent).toContain(reason);
  const tab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(b => b.textContent?.startsWith('Models'))!;
  await act(async () => tab.click());
  expect(row('Flash').textContent).toContain(reason);
  expect(row('Flash').querySelector('button:disabled')).not.toBeNull();
  expect(row('Flash').querySelector('[aria-label="Input: text. Output: text. Image input is unspecified."] svg')).not.toBeNull();
  expect([...row('Sized').querySelectorAll('.twui-item-tags .twui-badge')].map(badge => badge.textContent)).toEqual([
    '0.131M tokens context window', '0.00819M tokens max output',
  ]);
  expect(row('Sized').querySelectorAll('[aria-label="Input: text and images. Output: text."] svg')).toHaveLength(4);
  expect(row('Sized').querySelector('[title="8,192 tokens max output"]')).not.toBeNull();
  // The model the configuration calls, with no provider (relay-client's modelDetail); none where it repeats the name.
  expect(row('Sized').querySelector('.twui-item-title .twui-item-subtitle')?.textContent).toBe('sized');
  expect(row('glm-5.3').querySelector('.twui-item-subtitle')).toBeNull();
  expect(row('Sized').querySelector('[title="131,072 tokens context window"]')).not.toBeNull();
  expect(row('Sized').querySelector('button:disabled')).toBeNull();
});

test('marks a hosted model taken offline, and a preset on it, as not ready with the reason', async () => {
  const session = { id: 's', model: null, preset: null, started: false };
  const model = (id: string, name: string, modelOffline: boolean) => ({ id, teamId: 'a', teamName: 'a', name, version: 1, model: id, contextWindowMissing: false, modelOffline });
  const preset = { ...state.presets[0], model: 'Opus', modelAvailable: false, modelOffline: true };
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en', session, presets: [preset], models: [model('live', 'Live', false), model('opus', 'Opus', true)] });
  await mount(); await click('Choose');
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

test('a team model always starts a session on it, even the one the open session runs on', async () => {
  const session = { id: 's', model: { provider: 'teamwork', model: 'live', team: true }, preset: null, started: true };
  const model = { id: 'live', teamId: 'a', teamName: 'a', name: 'Live', version: 1, model: 'live', contextWindowMissing: false, modelOffline: false };
  vi.mocked(api.state).mockResolvedValue({ ...state, locale: 'en', session, models: [model] });
  vi.mocked(host.uiWorkspace.connectWorkspace).mockResolvedValue('blank');
  await mount(); await click('Choose');
  const tab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(b => b.textContent?.startsWith('Models'))!;
  await act(async () => tab.click());
  expect(document.body.textContent).not.toContain('In use');
  await click('Start a session');
  // Team a's default folder is a DSH workspace: its blank session gets the model before it is shown.
  expect(host.uiWorkspace.connectWorkspace).toHaveBeenCalledWith('ws-work');
  expect(api.use).toHaveBeenCalledWith('blank', 'live');
  expect(host.uiWorkspace.openSession).toHaveBeenCalledWith('blank');
  expect(vi.mocked(api.use).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(host.uiWorkspace.openSession).mock.invocationCallOrder[0]);
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

test('a page has no back link: the brand mark and the team menu lead back to the team toolbox', async () => {
  await mount(); await click('设备连接');
  expect([...document.querySelectorAll('button')].some(b => b.textContent === '返回团队工具箱')).toBe(false);
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="返回团队工具箱"]')!.click());
  expect(document.querySelector('[role="tab"]')).not.toBeNull();
});
