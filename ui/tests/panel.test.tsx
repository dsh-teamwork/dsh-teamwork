// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { TeamworkPanel } from '../../src/web/TeamworkPanel.js';
import { api } from '../../src/web/api.js';
import type { PanelState } from '../../src/panel.js';
import type { Host } from '../../src/web/host.js';

vi.mock('../../src/web/api.js', () => ({ api: { quota: vi.fn().mockRejectedValue(new Error("Unavailable")), state: vi.fn(), profile: vi.fn(), updateProfile: vi.fn(), sync: vi.fn(), use: vi.fn(), login: vi.fn(), authorize: vi.fn(), pairPhone: vi.fn(), decidePhone: vi.fn(), revokePhone: vi.fn() } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const profile = { id: 'user', name: 'Ada', email: 'ada@example.com', image: null, locale: 'zh-CN' as const };
const state: PanelState = {
  authRevision: 0, authenticated: true, server: 'https://example.com', defaultServer: 'https://example.com',
  sync: { auto: true, running: false }, relay: 'connected', phones: [], session: null,
  teams: [{ id: 'a', name: 'Alpha', role: 'admin', consoleUrl: 'https://example.com/teams/a' }, { id: 'b', name: 'Beta', role: 'member', consoleUrl: 'https://example.com/teams/b' }],
  presets: ['a', 'b'].map(id => ({ id: `preset-${id}`, teamId: id, teamName: id, name: `Preset ${id}`, version: 1, description: 'Review', model: 'Model', modelAvailable: true, tools: [], plugins: [] })),
  models: [], plugins: [],
};
const host: Host = { sessions: { list: { getSnapshot: () => ({ byId: {} }), subscribe: () => () => {} } }, layout: { selectPanel: vi.fn() }, uiWorkspace: { startSession: vi.fn() } };
let root: ReturnType<typeof createRoot>;
let scenario = 0;
beforeEach(() => { vi.resetAllMocks(); profile.id = `user-${++scenario}`; vi.mocked(api.state).mockResolvedValue(state); vi.mocked(api.profile).mockResolvedValue(profile); });
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; localStorage.clear(); vi.clearAllMocks(); vi.useRealTimers(); });
async function mount() {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<TeamworkPanel host={host} />); });
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
  await mount(); await click('手机连接');
  await act(async () => resolve(profile));
  expect(document.body.textContent).toContain('手机连接的是这台电脑');
  expect(document.body.textContent).not.toContain('先从哪个团队开始');
});

test('preserves an unsaved profile across pages, keeps it after a failed save, and allows discarding it', async () => {
  vi.mocked(api.updateProfile).mockRejectedValue(new Error('Profile offline'));
  await mount(); await click('我的账号'); await input('#teamwork-name', 'Draft');
  await click('手机连接'); await click('我的账号');
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
  await mount(); await click('手机连接'); await click('解除配对');
  const confirm = () => [...document.querySelectorAll<HTMLButtonElement>('.twui-confirm button')][0];
  await act(async () => confirm().click());
  expect(document.querySelector('.twui-confirm')).not.toBeNull();
  await act(async () => confirm().click());
  expect(api.revokePhone).toHaveBeenCalledTimes(2);
});

test('explains an expired pairing code and offers a new one', async () => {
  vi.useFakeTimers();
  vi.mocked(api.pairPhone).mockResolvedValue({ code: '12345678', link: 'dshteamwork://pair?code=12345678', expiresAt: new Date(Date.now() + 1000).toISOString() });
  await mount(); await click('手机连接'); await click('配对新手机');
  await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
  expect(document.body.textContent).toContain('配对码已过期');
  expect([...document.querySelectorAll('button')].some(b => b.textContent === '重新生成配对码')).toBe(true);
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
  await click('手机连接');
  vi.mocked(api.state).mockResolvedValue({ ...state, teams: state.teams.slice(0, 1), presets: state.presets.slice(0, 1) });
  await act(async () => { await vi.advanceTimersByTimeAsync(5001); });
  expect(document.body.textContent).toContain('手机连接的是这台电脑');
  await click('返回团队资源'); expect(document.querySelector('.twui-select-primary')!.textContent).toContain('全部团队');
  expect(api.use).not.toHaveBeenCalled(); expect(api.decidePhone).not.toHaveBeenCalled();
});

test('locks pairing generation and lets the member hide a still-valid code', async () => {
  let resolve!: (value: { code: string; link: string; expiresAt: string }) => void;
  vi.mocked(api.pairPhone).mockReturnValue(new Promise(r => { resolve = r; }));
  await mount(); await click('手机连接'); await click('配对新手机'); await click('配对新手机');
  expect(api.pairPhone).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ code: '12345678', link: 'dshteamwork://pair?code=12345678', expiresAt: new Date(Date.now() + 60000).toISOString() }));
  expect(document.body.textContent).toContain('收起配对码'); await click('收起配对码');
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
  await mount(); await click('手机连接 · 1');
  expect(document.body.textContent).toContain('目前不能只授权一个团队');
  await click('拒绝'); expect(document.body.textContent).toContain('等待你确认');
  await click('拒绝'); expect(document.body.textContent).not.toContain('等待你确认');
  current = { ...current, phones: [pending] };
  await click('刷新'); await click('安全码一致，确认配对');
  expect(document.body.textContent).not.toContain('等待你确认');
  await click('解除配对'); await act(async () => document.querySelector<HTMLButtonElement>('.twui-confirm button')!.click());
  expect(document.body.textContent).toContain('尚无已配对手机');
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
  await mount(); await click('手机连接 · 1'); await click('配对新手机');
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
  await click('手机连接'); expect(document.body.textContent).toContain('与当前浏览的团队无关');
  await click('返回团队资源');
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

test('switching resource teams discards a late quota and does not block resource rendering', async () => {
  let finish!: (value: Awaited<ReturnType<typeof api.quota>>) => void;
  vi.mocked(api.quota).mockImplementation(id => id === 'a' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ remaining: '2', state: 'known', resetAt: null, tokenLimited: false, exhausted: false }));
  await mount(); await click('查看全部团队资源');
  const select = async (index: number) => {
    await act(async () => document.querySelector<HTMLButtonElement>('.twui-select-trigger')!.click());
    await act(async () => document.querySelector(`[role="option"][data-index="${index}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  };
  await select(1); expect(document.body.textContent).toContain('Preset a');
  await select(2); expect(document.body.textContent).toContain('预算剩余 2 积分');
  await act(async () => finish({ remaining: '999', state: 'known', resetAt: null, tokenLimited: false, exhausted: false }));
  expect(document.body.textContent).not.toContain('999');
  expect(api.use).not.toHaveBeenCalled();
});
