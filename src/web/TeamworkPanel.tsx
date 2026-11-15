import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  Badge, Banner, BrandMark, Button, Card, Confirm, DefinitionList, EmptyState, Field, Icon, Input, Item, ItemBody, Notice, Panel,
  Skeleton, Tabs, Toast, Select, Monogram, type Tone,
} from '@dsh-teamwork/ui';
import qrcode from 'qrcode-generator';
import type { PanelPairingOffer, PanelPhone, PanelPlugin, PanelPreset, PanelState, PanelProfile, PluginState, ToolState } from '../panel.js';
import { api } from './api.js';
import { currentSessionTracker, type Host } from './host.js';

type Tab = 'presets' | 'models' | 'plugins';
type Page = 'resources' | 'devices' | 'profile' | 'teams' | 'choose';
type Run = (action: () => Promise<unknown>, done?: string | ((result: any) => string)) => Promise<boolean>;

const REFRESH_MS = 5000;
// Restore browsing context when DSH unmounts the panel to show a conversation.
const views = new Map<string, { team: string; tab: Tab; query: string }>();
const profileDrafts = new Map<string, { name: string; locale: 'en' | 'zh-CN' }>();

const pluginText: Record<PluginState, [string, Tone]> = {
  ready: ['已启用', 'success'],
  missing: ['未安装', 'warning'],
  disabled: ['已安装未启用', 'warning'],
  'version-mismatch': ['本地版本不符', 'warning'],
  failed: ['加载失败', 'danger'],
  pending: ['等待加载', 'warning'],
  unknown: ['无法确认', 'neutral'],
  'catalog-changed': ['团队已更改版本', 'warning'],
};
const toolText: Record<ToolState, [string, Tone]> = {
  available: ['可用', 'success'],
  conditional: ['执行时检查', 'neutral'],
  missing: ['缺失', 'warning'],
  unknown: ['待检查', 'neutral'],
};

const host = (server: string) => server.replace(/^https?:\/\//, '');
const missingTools = (preset: PanelPreset) => preset.tools.filter((t) => t.required && (t.state === 'missing' || t.state === 'unknown'));
const pluginsNotReady = (preset: PanelPreset) => preset.plugins.filter((p) => p.state !== 'ready');

function synced(iso: string | undefined) {
  if (!iso) return '尚未同步';
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return '刚刚同步';
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟前同步`;
  return `${new Date(iso).toLocaleTimeString()} 同步`;
}

/** The Teamwork screen in DSH's main column: sign-in, or the team's presets, models and plugins for the open session. */
export function TeamworkPanel({ host: dsh }: { host: Host }) {
  const currentSession = useRef(dsh.currentSession ?? currentSessionTracker(dsh.sessions.list)).current;
  const sessionId = useSyncExternalStore(dsh.sessions.list.subscribe, currentSession);
  const [snapshot, setState] = useState<PanelState>();
  const [loadedSession, setLoadedSession] = useState<string>();
  const state = snapshot && (loadedSession === sessionId ? snapshot : { ...snapshot, session: null });
  const [loadError, setLoadError] = useState<string>();
  const [tab, setTab] = useState<Tab>('presets');
  const [page, setPage] = useState<Page>('resources');
  const [team, setTeam] = useState('all');
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState<PanelProfile>();
  const [profileError, setProfileError] = useState<string>();
  const [profileAttempt, setProfileAttempt] = useState(0);
  const identity = useRef<string>();
  const touched = useRef(false);
  const browsing = useRef({ team, tab, query });
  browsing.current = { team, tab, query };
  const latest = useRef(state);
  latest.current = state;
  const request = useRef<Promise<void>>();
  const context = useRef(sessionId);
  context.current = sessionId;
  const [toast, setToast] = useState<{ message: string; tone: 'neutral' | 'danger' }>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const refresh = useCallback(() => {
    if (request.current) return request.current;
    const session = context.current;
    request.current = (async () => {
      try {
        const next = await api.state(session);
        if (context.current === session) { setLoadedSession(session); setState(next); setLoadError(undefined); }
      } catch (error) { setLoadError((error as Error).message); }
      finally { request.current = undefined; }
    })();
    return request.current;
  }, []);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => { await request.current; if (disposed) return; await refresh(); if (!disposed) timer = setTimeout(poll, REFRESH_MS); };
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [refresh, sessionId]);

  const authenticated = state?.authenticated, server = state?.server;
  useEffect(() => {
    identity.current = undefined;
    touched.current = false;
    setProfile(undefined); setPage('resources'); setTeam('all'); setQuery('');
  }, [authenticated, server]);
  useEffect(() => {
    setProfileError(undefined);
    if (!authenticated) return;
    let cancelled = false;
    void api.profile().then(next => {
      if (cancelled) return;
      setProfile(next);
      const key = `teamwork:team:${server}:${next.id}`;
      if (identity.current === key) return;
      identity.current = key;
      if (touched.current) {
        try { localStorage.setItem(key, browsing.current.team); } catch { /* Memory retains the selection. */ }
        return;
      }
      const view = views.get(key);
      setTab(view?.tab ?? 'presets'); setQuery(view?.query ?? '');
      let saved: string | null = null;
      try { saved = localStorage.getItem(key); } catch { /* Storage may be unavailable in embedded clients. */ }
      saved ??= view?.team ?? null;
      const teams = latest.current?.teams ?? [];
      const selected = saved && (saved === 'all' || teams.some(t => t.id === saved)) ? saved : teams.length === 1 ? teams[0].id : 'all';
      setTeam(selected);
      if (saved === null && teams.length > 1) setPage('choose');
    }).catch(error => { if (!cancelled) setProfileError((error as Error).message); });
    return () => { cancelled = true; };
  }, [authenticated, server, profileAttempt]);

  useEffect(() => {
    if (profile && identity.current) views.set(identity.current, { team, tab, query });
  }, [profile, team, tab, query]);

  const navigate = (next: Page) => { touched.current = true; setPage(next); };

  const selectTeam = (id: string) => {
    touched.current = true;
    setTeam(id); setPage('resources'); setQuery('');
    if (profile) try { localStorage.setItem(`teamwork:team:${server}:${profile.id}`, id); } catch { /* Selection remains usable without persistence. */ }
  };
  useEffect(() => {
    if (state && team !== 'all' && !state.teams.some(t => t.id === team)) {
      setTeam('all'); setQuery('');
      if (profile) try { localStorage.setItem(`teamwork:team:${server}:${profile.id}`, 'all'); } catch { /* Memory retains the selection. */ }
      notify('当前团队已不可用，浏览范围已切换为全部团队。');
    }
  }, [state?.teams, team]);

  const notify = useCallback((message: string, tone: 'neutral' | 'danger' = 'neutral') => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(undefined), tone === 'danger' ? 6000 : 3000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /** Runs one action, reports its outcome, then reloads the state it may have changed. */
  const run: Run = useCallback(async (action, done) => {
    try {
      const result = await action();
      const message = typeof done === 'function' ? done(result) : done;
      if (message) notify(message);
      return true;
    } catch (error) {
      notify((error as Error).message, 'danger');
      return false;
    } finally {
      await request.current;
      await refresh();
    }
  }, [notify, refresh]);

  const toastNode = toast && <Toast tone={toast.tone}>{toast.message}</Toast>;

  if (!state) {
    return (
      <Panel label="Teamwork" header={loadError ? undefined : <HeaderSkeleton />}>
        {loadError
          ? <Banner tone="danger" title="无法读取团队状态" action={<Button size="sm" icon="refresh" onClick={() => void refresh()}>重试</Button>}>{loadError}</Banner>
          : <ListSkeleton />}
      </Panel>
    );
  }
  if (!state.authenticated) {
    return (
      <Panel label="Teamwork" centered>
        <SignIn state={state} run={run} />
        {toastNode}
      </Panel>
    );
  }

  const inTeam = (item: { teamId?: string }) => team === 'all' || item.teamId === team;
  const matches = (item: { name: string; description?: string }) => `${item.name} ${item.description ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const presets = state.presets.filter(inTeam), models = state.models.filter(inTeam), plugins = state.plugins.filter(inTeam);
  const tabs = [{ id: 'presets' as const, label: '预设', count: presets.length }, { id: 'models' as const, label: '模型', count: models.length }, { id: 'plugins' as const, label: '插件', count: plugins.length }];
  const choosing = page === 'choose' && state.teams.length > 1;
  return (
    <Panel label="Teamwork" header={<Header state={state} page={page} team={team} selectTeam={selectTeam} navigate={navigate} />} footer={<Footer state={state} run={run} />}>
      {loadError && <Banner tone="danger" title="状态没有刷新" action={<Button size="sm" icon="refresh" onClick={() => void refresh()}>重试</Button>}>{loadError}</Banner>}
      {state.sync.lastError && (
        <Banner tone="warning" title="同步失败，正在使用上次同步的配置" action={<Button size="sm" icon="refresh" onClick={() => run(() => api.sync(), '团队配置已同步')}>重试</Button>}>
          {state.sync.lastError}
        </Banner>
      )}
      {page !== 'resources' && !choosing && <div><Button variant="ghost" size="sm" onClick={() => navigate('resources')}>返回团队资源</Button></div>}
      {choosing ? <TeamChooser state={state} select={selectTeam} /> : (page === 'resources' || page === 'choose') && <>
        {!state.teams.length ? <EmptyState icon="layers" title="账号已连接，接下来加入团队" action={<div className="twui-row"><Button trailingIcon="external" onClick={() => window.open(`${state.server}/teams`, '_blank', 'noopener')}>加入或创建团队</Button><Button icon="refresh" onClick={() => run(() => api.sync(), '团队列表已刷新')}>我已加入，刷新团队</Button></div>}>在网页中接受邀请或创建团队，完成后回来刷新。</EmptyState> : <>
          <div className="twui-resource-toolbar"><Tabs<Tab> label="资源类型" items={tabs} value={tab} onChange={setTab} /><Input aria-label="搜索团队资源" placeholder="搜索名称或用途" value={query} onChange={e => setQuery(e.target.value)} /></div>
          <div className="twui-resource-list" key={`${team}:${tab}`}>
            {tab === 'presets' && presets.filter(matches).map(p => <PresetItem key={p.id} preset={p} state={state} dsh={dsh} run={run} onInstall={() => setTab('plugins')} />)}
            {tab === 'models' && models.filter(matches).map(m => <ModelItem key={m.id} model={m} state={state} run={run} />)}
            {tab === 'plugins' && plugins.filter(matches).map(p => <PluginItem key={p.id} plugin={p} run={run} />)}
            {!(tab === 'presets' ? presets : tab === 'models' ? models : plugins).filter(matches).length && <EmptyState icon="layers" title={query ? '没有匹配的资源' : '这里还没有资源'}>{query ? '试试其他关键词或切换团队。' : '管理员在网页发布后，资源会同步到这里。'}</EmptyState>}
          </div>
        </>}
      </>}
      {page === 'devices' && <><PageTitle title="手机连接">手机连接的是这台电脑上的 DSH，与当前浏览的团队无关。</PageTitle><Phones state={state} run={run} /></>}
      {page === 'teams' && <><PageTitle title="我的团队">浏览范围不会改变已有会话或手机配对。</PageTitle>{state.teams.map(t => <Item key={t.id} icon="layers" title={t.name} tags={<Badge>{t.role === 'admin' ? '管理员' : '成员'}</Badge>} actions={<><Button onClick={() => selectTeam(t.id)}>浏览资源</Button><Button variant="ghost" trailingIcon="external" onClick={() => window.open(t.consoleUrl, '_blank', 'noopener')}>{t.role === 'admin' ? '管理团队' : '查看团队'}</Button></>} />)}<div><Button trailingIcon="external" onClick={() => window.open(`${state.server}/teams`, '_blank', 'noopener')}>加入或创建团队</Button></div></>}
      {page === 'profile' && <Account state={state} profile={profile} error={profileError} retry={() => setProfileAttempt(n => n + 1)} updated={next => { if (identity.current === `teamwork:team:${state.server}:${next.id}`) setProfile(next); }} run={run} />}
      {toastNode}
    </Panel>
  );
}

function PageTitle({ title, children }: { title: string; children: ReactNode }) {
  return <div className="twui-stack"><h2 className="twui-page-title">{title}</h2><p className="twui-muted">{children}</p></div>;
}

function TeamChooser({ state, select }: { state: PanelState; select(id: string): void }) {
  return <><PageTitle title="先从哪个团队开始？">选择资源的浏览范围；你也可以随时在页面顶部切换。</PageTitle>{state.teams.map(t => <Item key={t.id} icon="layers" title={t.name} tags={<Badge>{t.role === 'admin' ? '管理员' : '成员'}</Badge>} actions={<Button onClick={() => select(t.id)}>选择团队</Button>} />)}<div><Button variant="primary" onClick={() => select('all')}>查看全部团队资源</Button></div></>;
}

function Account({ state, profile, error, retry, updated, run }: {
  state: PanelState; profile?: PanelProfile; error?: string; retry(): void; updated(profile: PanelProfile): void; run: Run;
}) {
  const [name, setName] = useState('');
  const [locale, setLocale] = useState<'en' | 'zh-CN'>('zh-CN');
  const [busy, setBusy] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const saving = useRef(false);
  const key = profile ? `${state.server}:${profile.id}` : undefined;
  const dirty = !!profile && (name.trim() !== (profile.name ?? '') || locale !== (profile.locale ?? 'zh-CN'));
  useEffect(() => {
    const draft = key ? profileDrafts.get(key) : undefined;
    setName(draft?.name ?? profile?.name ?? ''); setLocale(draft?.locale ?? profile?.locale ?? 'zh-CN');
  }, [key, profile?.name, profile?.locale]);
  const edit = (nextName: string, nextLocale: 'en' | 'zh-CN') => {
    setName(nextName); setLocale(nextLocale); setSaveError(undefined);
    if (key) profileDrafts.set(key, { name: nextName, locale: nextLocale });
  };
  const save = async () => {
    if (!profile || !key || saving.current || !dirty) return;
    saving.current = true; setBusy(true); setSaveError(undefined);
    await run(async () => {
      try {
        const next = await api.updateProfile({ name: name.trim() || null, locale });
        profileDrafts.delete(key); updated(next);
      } catch (error) { setSaveError((error as Error).message); throw error; }
    }, '个人资料已保存');
    saving.current = false; setBusy(false);
  };
  return <>
    <PageTitle title="我的账号">管理你的 Teamwork 个人资料和这台 DSH 的连接。</PageTitle>
    <div className="twui-account-grid">
      <section className="twui-stack" aria-label="个人资料">
        {error ? <Banner tone="warning" title="暂时无法读取个人资料" action={<Button onClick={retry}>重试</Button>}>{error}</Banner> : !profile ? <ListSkeleton /> : <>
          <div className="twui-row" style={{ gap: 14 }}><Monogram text={profile.name || profile.email || 'T'} size={44} /><div><h3>{profile.name || 'Teamwork 用户'}</h3><p className="twui-muted">{profile.email || '未设置邮箱'}</p></div></div>
          <form className="twui-stack" onSubmit={e => { e.preventDefault(); void save(); }}>
            <Field label="显示名称" htmlFor="teamwork-name"><Input id="teamwork-name" value={name} maxLength={80} disabled={busy} onChange={e => edit(e.target.value, locale)} autoComplete="name" /></Field>
            <Field label="账号语言" htmlFor="teamwork-locale" hint="用于 Teamwork 网页和手机端；DSH 插件当前使用中文。"><Select id="teamwork-locale" label="账号语言" value={locale} disabled={busy} onChange={value => edit(name, value as 'en' | 'zh-CN')} options={[{ value: 'zh-CN', label: '简体中文' }, { value: 'en', label: 'English' }]} /></Field>
            {dirty && <p className="twui-subtle">有未保存的修改，切换页面时会保留草稿。</p>}
            {saveError && <Notice tone="danger"><span role="alert">{saveError}</span></Notice>}
            <div className="twui-row"><Button type="submit" variant="primary" busy={busy} disabled={!dirty}>保存资料</Button>{dirty && <Button variant="ghost" disabled={busy} onClick={() => { if (key) profileDrafts.delete(key); setName(profile.name ?? ''); setLocale(profile.locale ?? 'zh-CN'); setSaveError(undefined); }}>撤销修改</Button>}</div>
          </form>
        </>}
      </section>
      <section className="twui-stack" aria-label="账号连接">
        <h3>账号与连接</h3><ServerSetting state={state} run={run} />
        <p className="twui-muted">重启 DSH 后需要重新授权。退出会移除当前团队配置并断开手机中转；本地会话与已安装插件保留。</p>
        <div><Button variant="ghost" icon="logout" onClick={() => setLogoutConfirm(true)}>退出此 DSH 的 Teamwork</Button></div>
        {logoutConfirm && <Confirm title="退出 Teamwork？" description="运行中的团队模型请求可能受影响。手机将无法通过当前连接访问此 DSH。" confirmLabel="确认退出" cancelLabel="取消" busy={busy} onCancel={() => setLogoutConfirm(false)} onConfirm={async () => { setBusy(true); await run(() => api.logout(), '已退出 Teamwork'); setBusy(false); }} />}
      </section>
    </div>
  </>;
}

/* ── Sign-in ─────────────────────────────────────────────────────────────── */

function SignIn({ state, run }: { state: PanelState; run: Run }) {
  // `automatic`: the code comes back to this DSH by itself once the member confirms; pasting is the way round.
  const [opened, setOpened] = useState<{ automatic: boolean; url: string; expiresAt: number } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [expired, setExpired] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    if (!opened) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, opened.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [opened]);
  const open = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(undefined);
    try {
      await run(async () => {
        try {
          const { url, automatic } = await api.login();
          setOpened({ automatic, url, expiresAt: Date.now() + 10 * 60 * 1000 }); setExpired(false); setCode('');
          window.open(url, '_blank', 'noopener');
        } catch (failure) { setError((failure as Error).message); throw failure; }
      });
    } finally { locked.current = false; setBusy(false); }
  };
  const authorize = async () => {
    if (locked.current) return;
    locked.current = true; setError(undefined);
    setBusy(true);
    try {
      await run(async () => { try { await api.authorize(code.trim()); } catch (failure) { setError((failure as Error).message); throw failure; } }, '已授权，团队配置已同步');
    } finally { locked.current = false; setBusy(false); }
  };
  const pasteForm = (
    <form style={{ display: 'grid', gap: 12 }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) void authorize(); }}>
      <Field label={opened?.automatic ? '没有自动完成？粘贴网页上显示的那一行' : '网页上显示的那一行'} htmlFor="teamwork-code">
        <Input id="teamwork-code" size="lg" className="twui-mono" value={code} onChange={(e) => setCode(e.target.value)}
          placeholder="/teamwork authorize eyJhbGci…" autoComplete="off" spellCheck={false} autoFocus={!opened?.automatic} />
      </Field>
      <Button type="submit" variant={opened?.automatic ? 'secondary' : 'primary'} size="lg" block busy={busy} disabled={!code.trim() || expired}>完成授权</Button>
    </form>
  );
  return (
    <div style={{ width: '100%', maxWidth: 440, margin: '0 auto', display: 'grid', gap: 24, padding: '24px 0' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 12, textAlign: 'center' }}>
        <BrandMark size={56} title="DSH Teamwork" />
        <div style={{ display: 'grid', gap: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.01em' }}>{state.teams.length ? '重新连接 Teamwork' : '登录 Teamwork'}</h1>
          <p className="twui-muted">团队的模型、预设和插件版本，一处发布，每位成员的 DSH 自动保持一致。</p>
        </div>
      </div>

      <Card padding={20}>
        <div style={{ display: 'grid', gap: 16 }}>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            <Step n={1} state={opened ? 'done' : 'active'}>在浏览器中登录</Step>
            {opened?.automatic === false ? (
              <Step n={2} state="active">确认授权，把网页上显示的那一行粘贴到下方（两分钟内有效）</Step>
            ) : (
              <Step n={2} state={opened ? 'active' : 'todo'}>确认授权，这里会自动完成登录</Step>
            )}
          </ol>
          {error && <Notice tone="danger"><span role="alert">{error}</span></Notice>}
          {expired ? <Banner tone="warning" title="本次登录等待已超时" action={<Button busy={busy} onClick={() => void open()}>重新开始登录</Button>}>请重新打开授权页面，旧页面的授权码不能用于新的登录请求。</Banner>
            : opened ? <>
              {opened.automatic && <p role="status" className="twui-muted">等待浏览器确认授权，完成后这里会自动进入团队资源。</p>}
              <a className="twui-link" href={opened.url} target="_blank" rel="noopener noreferrer">打开授权页面</a>
              {opened.automatic ? <details><summary className="twui-link">没有自动完成？使用授权码</summary><div style={{ paddingTop: 12 }}>{pasteForm}</div></details> : pasteForm}
              <Button variant="ghost" size="sm" busy={busy} onClick={() => void open()}>重新开始登录</Button>
            </> : <Button variant="primary" size="lg" block trailingIcon="external" busy={busy} onClick={() => void open()}>在浏览器中登录</Button>}
        </div>
      </Card>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        <Point icon="shield" title="密钥留在服务器">团队模型由服务器代为调用，provider 密钥不会下发到这台电脑。</Point>
        <Point icon="layers" title="与本地配置并存">团队配置作为独立条目加入，不覆盖你自己的模型和预设。</Point>
        <Point icon="sync" title="自动保持最新">每分钟同步一次；被移出团队后，下一次请求即失效。</Point>
      </ul>

      <ServerSetting state={state} run={run} />
    </div>
  );
}

function Step({ n, state, children }: { n: number; state: 'todo' | 'active' | 'done'; children: ReactNode }) {
  const done = state === 'done';
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 10, color: state === 'todo' ? 'var(--twui-fg-subtle)' : 'var(--twui-fg)' }}>
      <span aria-hidden="true" style={{
        width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none', fontSize: 12, fontWeight: 600,
        border: `1px solid ${state === 'todo' ? 'var(--twui-border-strong)' : 'transparent'}`,
        background: done ? 'var(--twui-success)' : state === 'active' ? 'var(--twui-primary)' : 'transparent',
        color: done || state === 'active' ? 'var(--twui-primary-fg)' : 'inherit',
      }}>{done ? <Icon name="check" size={13} /> : n}</span>
      <span>{children}</span>
    </li>
  );
}

function Point({ icon, title, children }: { icon: 'shield' | 'layers' | 'sync'; title: string; children: ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span className="twui-tile" style={{ width: 32, height: 32 }}><Icon name={icon} size={16} /></span>
      <div style={{ display: 'grid', gap: 2 }}>
        <strong style={{ fontWeight: 600 }}>{title}</strong>
        <span className="twui-muted">{children}</span>
      </div>
    </li>
  );
}

/** Which server to sign in to: the hosted service by default, or the member's own. */
function ServerSetting({ state, run }: { state: PanelState; run: Run }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(state.server);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const isDefault = state.server === state.defaultServer;
  const save = async (server: string | null) => {
    setBusy(true);
    setError(undefined);
    try {
      await api.setServer(server);
      setEditing(false);
      await run(async () => undefined, server === null ? '已恢复为默认服务器' : '服务器已更改');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!editing) {
    return (
      <div className="twui-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', boxShadow: 'none' }}>
        <span style={{ color: 'var(--twui-fg-subtle)' }}><Icon name="server" size={16} /></span>
        <div style={{ flex: 1, minWidth: 0, display: 'grid' }}>
          <span className="twui-subtle">服务器</span>
          <span className="twui-row" style={{ gap: 6 }}>
            <span className="twui-mono" style={{ overflowWrap: 'anywhere' }}>{host(state.server)}</span>
            {isDefault && <Badge tone="accent">官方服务</Badge>}
          </span>
        </div>
        <Button size="sm" onClick={() => { setValue(state.server); setEditing(true); }}>更改</Button>
      </div>
    );
  }
  return (
    <form className="twui-card" style={{ display: 'grid', gap: 12, padding: 16, boxShadow: 'none' }}
      onSubmit={(e) => { e.preventDefault(); void save(value); }}>
      <Field label="服务器地址" htmlFor="teamwork-server" error={error}
        hint="自建团队或本地开发时填写你的 DSH Teamwork 地址，例如 http://localhost:3800。更改后需要重新登录。">
        <Input id="teamwork-server" className="twui-mono" value={value} onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined} autoComplete="off" spellCheck={false} autoFocus />
      </Field>
      <div className="twui-row">
        <Button type="submit" variant="primary" size="sm" busy={busy} disabled={!value.trim() || value.trim() === state.server}>{state.authenticated ? '退出并更换服务器' : '保存'}</Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setEditing(false); setError(undefined); }}>取消</Button>
        {!isDefault && (
          <button type="button" className="twui-link" style={{ marginLeft: 'auto', fontSize: 12 }} disabled={busy} onClick={() => void save(null)}>
            恢复为 {host(state.defaultServer)}
          </button>
        )}
      </div>
    </form>
  );
}

/* ── Signed in ───────────────────────────────────────────────────────────── */

function Header({ state, page, team, selectTeam, navigate }: { state: PanelState; page: Page; team: string; selectTeam(id: string): void; navigate(page: Page): void }) {
  const pending = state.phones.filter(p => p.status === 'pending').length;
  return <>
    <div className="twui-brand-lockup"><button type="button" className="twui-brand-home" aria-label="返回团队资源" onClick={() => navigate('resources')}><BrandMark size={32} title="DSH Teamwork" /></button>
      <div className="twui-row twui-team-scope"><Button variant="ghost" onClick={() => navigate('teams')}>我的团队</Button>
        {!!state.teams.length && <><Icon name="chevronRight" size={14} /><Select label="选择团队" value={team} onActivate={() => navigate('resources')} onChange={selectTeam} options={[{ value: 'all', label: '全部团队' }, ...state.teams.map(t => ({ value: t.id, label: t.name, description: t.role === 'admin' ? '管理员' : '成员' }))]} /></>}
      </div>
    </div>
    <div className="twui-row twui-header-actions">
      <Button variant="ghost" icon="smartphone" aria-current={page === 'devices' ? 'page' : undefined} onClick={() => navigate('devices')}>手机连接{pending ? ` · ${pending}` : ''}</Button>
      <Button variant="ghost" icon="settings" aria-current={page === 'profile' ? 'page' : undefined} onClick={() => navigate('profile')}>我的账号</Button>
    </div>
  </>;
}

function Footer({ state, run }: { state: PanelState; run: Run }) {
  const [busy, setBusy] = useState(false);
  return <>
    <div className="twui-footer-identity"><span className="twui-footer-name">Teamwork</span><span className="twui-footer-service" title={state.server}>{state.server === state.defaultServer ? '官方服务' : host(state.server)} · 本机 DSH</span></div>
    <div className="twui-row twui-footer-actions"><span role="status"><Badge tone={state.sync.lastError ? 'warning' : 'success'} dot>{state.sync.running ? '正在同步…' : state.sync.lastError ? '同步失败' : synced(state.sync.lastSuccess)}</Badge></span>
      <Button variant="ghost" size="sm" icon="refresh" busy={busy || state.sync.running} onClick={async () => { setBusy(true); await run(() => api.sync(), '团队配置已同步'); setBusy(false); }}>刷新</Button>
    </div>
  </>;
}

function PresetItem({ preset, state, dsh, run, onInstall }: { preset: PanelPreset; state: PanelState; dsh: Host; run: Run; onInstall(): void }) {
  const [open, setOpen] = useState(false);
  const missing = missingTools(preset);
  const plugins = pluginsNotReady(preset);
  const active = state.session?.preset?.id === preset.id;
  const blocked = !preset.modelAvailable ? '预设引用的团队模型已不可用，请联系管理员。'
    : plugins.length ? `依赖插件 ${plugins.map((p) => p.name).join('、')} 尚未就绪。`
    : missing.length && state.session ? `缺少必需工具 ${missing.map((t) => t.name).join('、')}，请在 DSH 插件管理器中安装或启用。`
    : undefined;
  const useBlocked = blocked ?? (state.session?.started && !active ? '当前会话已开始对话，预设只能用在新会话里。' : undefined);
  const ready = !blocked;
  return (
    <Item
      icon="layers"
      title={preset.name}
      subtitle={preset.teamName}
      description={preset.description || undefined}
      tags={
        <>
          <Badge><Icon name="cpu" size={12} />{preset.model}</Badge>
          {active ? <Badge tone="accent" dot>本会话正在使用</Badge> : ready ? <Badge tone={!state.session && missing.length ? 'neutral' : 'success'} dot>{!state.session && missing.length ? '启动时检查工具' : '可以使用'}</Badge> : <Badge tone="warning" dot>未就绪</Badge>}
        </>
      }
      actions={
        <>
          <Button variant="ghost" size="sm" trailingIcon={open ? 'chevronDown' : 'chevronRight'} aria-expanded={open} onClick={() => setOpen(!open)}>详情</Button>
          <Button size="sm" variant={!state.session || state.session.started ? 'primary' : 'secondary'} icon="plus" disabled={!ready} onClick={() => {
            dsh.uiWorkspace.startSession(undefined, { agentPreset: `team:${preset.teamId}:${preset.id}` });
            dsh.layout.selectPanel(null);
          }}>新建会话</Button>
          {!active && state.session && !state.session.started && (
            <Button variant="primary" size="sm" disabled={useBlocked !== undefined} onClick={() => run(() => api.use(state.session!.id, preset.id), (r) => r.message)}>
              用于当前空白会话
            </Button>
          )}
        </>
      }
      notice={useBlocked && !active ? (
        <div className="twui-row" style={{ gap: 6 }}>
          <Notice tone={blocked ? 'warning' : 'neutral'}>{useBlocked}</Notice>
          {plugins.length > 0 && <button type="button" className="twui-link" style={{ fontSize: 12 }} onClick={onInstall}>前往安装</button>}
        </div>
      ) : undefined}
    >
      {open && (
        <ItemBody>
          <DefinitionList items={[
            ['模型', preset.model],
            ['工具', preset.tools.length ? (
              <span className="twui-row" style={{ gap: 6 }}>{preset.tools.map((t) => (
                <Badge key={t.name} tone={toolText[t.state][1]} title={t.required ? '必需' : '可选'}>
                  <span className="twui-mono">{t.name}</span>{t.required ? '' : ' · 可选'} · {toolText[t.state][0]}
                </Badge>
              ))}</span>
            ) : '无要求'],
            ['依赖插件', preset.plugins.length ? (
              <span className="twui-row" style={{ gap: 6 }}>{preset.plugins.map((p) => <Badge key={p.id} tone={pluginText[p.state][1]}>{p.name} @{p.version} · {pluginText[p.state][0]}</Badge>)}</span>
            ) : '无'],
            ['版本', `v${preset.version}，管理员发布新版本后下次同步生效`],
          ]} />
          <p className="twui-subtle">工具按当前会话检查；切换会话后和每次请求前都会重新检查。</p>
        </ItemBody>
      )}
    </Item>
  );
}

function ModelItem({ model, state, run }: { model: PanelState['models'][number]; state: PanelState; run: Run }) {
  const s = state.session;
  const active = !!s?.model?.team && s.model.model === model.id;
  return (
    <Item
      icon="cpu"
      title={model.name}
      subtitle={model.teamName}
      description="由团队服务器代为调用，provider 密钥留在服务器上。只改当前会话，不改本地默认模型。"
      tags={<Badge><span className="twui-mono">{model.upstream}</span></Badge>}
      actions={active ? <Badge tone="accent" dot>本会话正在使用</Badge> : (
        <Button variant="primary" size="sm" disabled={!s} onClick={() => run(() => api.use(s!.id, model.id), (r) => r.message)}>用于当前会话</Button>
      )}
      notice={!s ? <Notice>先在 DSH 新建或打开一个会话，再选择模型。</Notice> : undefined}
    />
  );
}

function PluginItem({ plugin, run }: { plugin: PanelPlugin; run: Run }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, tone] = pluginText[plugin.state];
  const spec = `${plugin.package ?? plugin.name}@${plugin.version}`;
  return (
    <Item
      icon="puzzle"
      title={plugin.name}
      subtitle={plugin.teamName}
      description={plugin.description || undefined}
      tags={<>
        <span className="twui-subtle twui-mono">{spec}</span>
        <Badge tone={tone} dot>{label}</Badge>
        {plugin.localVersion && plugin.localVersion !== plugin.version && <Badge>本地 {plugin.localVersion}</Badge>}
      </>}
      actions={plugin.state === 'missing'
        ? !confirming && <Button variant="primary" size="sm" onClick={() => setConfirming(true)}>安装</Button>
        : <span className="twui-subtle">在 DSH 插件管理器中管理</span>}
    >
      {confirming && (
        <Confirm
          title={`安装并启用 ${spec}？`}
          description="这会在你的电脑上运行该插件的代码。版本由团队固定；已经装过的同名插件不会被覆盖。"
          confirmLabel="安装并启用"
          cancelLabel="取消"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            setBusy(true);
            await run(() => api.install(plugin.id, plugin.version), (r) => r.message.split('\n')[0]);
            setBusy(false);
            setConfirming(false);
          }}
        />
      )}
    </Item>
  );
}

/* ── Loading ─────────────────────────────────────────────────────────────── */

function HeaderSkeleton() {
  return (
    <div className="twui-row" style={{ gap: 12 }}>
      <Skeleton width={36} height={36} />
      <div style={{ display: 'grid', gap: 6 }}><Skeleton width={140} height={14} /><Skeleton width={100} height={10} /></div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="twui-item" style={{ padding: 16, display: 'flex', gap: 14 }}>
          <Skeleton width={36} height={36} />
          <div style={{ flex: 1, display: 'grid', gap: 8 }}><Skeleton width="40%" /><Skeleton width="75%" height={12} /><Skeleton width={120} height={20} /></div>
        </div>
      ))}
    </>
  );
}

/* ── Phones ──────────────────────────────────────────────────────────────── */

const relayText: Record<Exclude<PanelState['relay'], 'connected'>, [string, string]> = {
  off: ['手机连接尚未开启', '请确认服务器提供手机中转服务，并且当前账号已加入团队。'],
  connecting: ['正在连接中转服务…', '连上之后就可以在这里配对手机。'],
  refused: ['中转服务拒绝了这台电脑', '登录可能已失效，或另一个 DSH 正以这台电脑的身份连接。退出后重新登录即可重试。'],
};

const shortTime = (iso: string) => new Date(iso).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function Phones({ state, run }: { state: PanelState; run: Run }) {
  const [offer, setOffer] = useState<PanelPairingOffer>();
  const [revoking, setRevoking] = useState<PanelPhone>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [expired, setExpired] = useState(false);
  const locked = useRef(false);
  const pending = state.phones.filter((p) => p.status === 'pending');
  const paired = state.phones.filter((p) => p.status === 'confirmed');
  // A phone redeemed the code: the code is spent, so stop showing it.
  const seen = useRef(new Set(pending.map(p => p.id)));
  useEffect(() => {
    if (pending.some(p => !seen.current.has(p.id))) { setOffer(undefined); setExpired(false); }
    seen.current = new Set(pending.map(p => p.id));
  }, [state.phones]);
  useEffect(() => { if (state.relay !== 'connected') { setOffer(undefined); setExpired(false); } }, [state.relay]);
  const perform = async (key: string, action: () => Promise<unknown>, done?: string) => {
    if (locked.current) return false;
    locked.current = true; setBusy(key); setError(undefined);
    try {
      return await run(async () => { try { return await action(); } catch (failure) { setError((failure as Error).message); throw failure; } }, done);
    } finally { locked.current = false; setBusy(undefined); }
  };
  const pair = () => perform('pair', async () => { setOffer(await api.pairPhone()); setExpired(false); });

  if (state.relay !== 'connected') {
    const [title, body] = relayText[state.relay];
    return <Card><EmptyState icon="smartphone" title={title}>{body}</EmptyState></Card>;
  }
  return (
    <>
      {error && <Banner tone="warning" title="手机操作未完成">{error}</Banner>}
      {expired && <Banner tone="warning" title="配对码已过期" action={<Button busy={busy === 'pair'} disabled={!!busy} onClick={() => void pair()}>重新生成配对码</Button>}>配对码只能使用一次。重新生成后，请在手机上扫描新码。</Banner>}
      <Card>
        {offer
          ? <PairingCode offer={offer} onDone={() => setOffer(undefined)} onExpire={() => { setOffer(undefined); setExpired(true); }} />
          : <EmptyState icon="smartphone" title="在手机上操作这台电脑的 DSH"
              action={!expired && <Button icon="plus" busy={busy === 'pair'} disabled={!!busy} onClick={() => void pair()}>配对新手机</Button>}>
              手机和电脑须登录同一个 Teamwork 账号。配对后可访问本机 DSH 有权限的个人与各团队会话，目前不能只授权一个团队；配对不会增加团队权限，任一端都可解除。
            </EmptyState>}
      </Card>
      {pending.map((phone) => (
        <Item key={phone.id} icon="smartphone" title={phone.deviceName} subtitle={`${shortTime(phone.createdAt)} 申请配对`}
          tags={<Badge tone="warning" dot>等待你确认</Badge>}
          description={`${phone.safetyCode ? `安全码：${phone.safetyCode}。请核对手机上的安全码一致，并在手机上确认。` : '等待手机完成加密握手，暂时无法确认。'} 确认后，手机可查看本机 DSH 可访问的个人与各团队会话，发送消息、回答 Agent 提问和处理审批。目前不能只授权一个团队；配对不会增加团队权限，任一端都可解除。手机与电脑须登录同一账号。`}
          actions={<>
            <Button size="sm" variant="ghost" busy={busy === `reject:${phone.id}`} disabled={!!busy} onClick={() => void perform(`reject:${phone.id}`, () => api.decidePhone(phone.id, false), '已拒绝')}>拒绝</Button>
            <Button size="sm" busy={busy === `accept:${phone.id}`} disabled={!!busy || !phone.safetyCode || !phone.phoneConfirmed} onClick={() => void perform(`accept:${phone.id}`, () => api.decidePhone(phone.id, true), `${phone.deviceName} 已配对`)}>安全码一致，确认配对</Button>
          </>} />
      ))}
      <h3 style={{ fontSize: 15, fontWeight: 500 }}>已配对手机</h3>
      {!paired.length && <p className="twui-muted">尚无已配对手机。配对是可选功能，不影响团队资源的使用。</p>}
      {paired.map((phone) => (
        <Item key={phone.id} icon="smartphone" title={phone.deviceName}
          subtitle={phone.lastUsedAt ? `最近使用 ${shortTime(phone.lastUsedAt)}` : `配对于 ${shortTime(phone.createdAt)}`}
          tags={<Badge tone={phone.verified ? "success" : "warning"} dot>{phone.verified ? "已验证加密设备" : "需要重新配对"}</Badge>}
          actions={<Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setRevoking(phone)}>解除配对</Button>} />
      ))}
      {revoking && (
        <Confirm title={`解除与 ${revoking.deviceName} 的配对？`} description="这台手机会立即断开，之后需要重新扫码配对才能再连到这台电脑。"
          confirmLabel="解除配对" cancelLabel="取消"
          busy={!!busy}
          onCancel={() => setRevoking(undefined)}
          onConfirm={async () => { if (await perform(`revoke:${revoking.id}`, () => api.revokePhone(revoking.id), '已解除配对')) setRevoking(undefined); }} />
      )}
    </>
  );
}

function PairingCode({ offer, onDone, onExpire }: { offer: PanelPairingOffer; onDone(): void; onExpire(): void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const left = Math.max(0, Math.round((Date.parse(offer.expiresAt) - now) / 1000));
  useEffect(() => { if (left === 0) onExpire(); }, [left, onExpire]);
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <QrCode value={offer.link} size={168} />
      <div style={{ display: 'grid', gap: 8, minWidth: 200, flex: '1 1 200px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 650 }}>用 DSH Teamwork App 扫码</h2>
        <span className="twui-subtle">也可以在 App 里手动输入配对码：</span>
        <span className="twui-mono" style={{ fontSize: 20, letterSpacing: '0.12em' }}>{offer.code.slice(0, 3)} {offer.code.slice(3)}</span>
        <span className="twui-subtle">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} 后失效，只能使用一次。扫码后请回到这里确认。</span>
        <span className="twui-subtle">收起后，配对码在到期前仍然有效；手机提交后需在本机确认。</span>
        <div><Button size="sm" variant="ghost" onClick={onDone}>收起配对码</Button></div>
      </div>
    </div>
  );
}

/** A QR code drawn as one SVG path, dark on a light quiet zone so any camera reads it in either theme. */
function QrCode({ value, size }: { value: string; size: number }) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (qr.isDark(row, col)) d += `M${col + 4} ${row + 4}h1v1h-1z`;
  const extent = count + 8;
  return (
    <svg role="img" aria-label="配对二维码" width={size} height={size} viewBox={`0 0 ${extent} ${extent}`} shapeRendering="crispEdges" style={{ borderRadius: 8, flex: 'none' }}>
      <rect width={extent} height={extent} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}
