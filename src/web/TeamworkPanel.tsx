import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  Badge, Banner, BrandMark, Button, Card, Confirm, DefinitionList, EmptyState, Field, Icon, Input, Item, ItemBody, Notice, Panel,
  Skeleton, Tabs, Toast, type Tone,
} from '@dsh-teamwork/ui';
import qrcode from 'qrcode-generator';
import type { PanelPairingOffer, PanelPhone, PanelPlugin, PanelPreset, PanelState, PluginState, ToolState } from '../panel.js';
import { api } from './api.js';
import { currentSessionTracker, type Host } from './host.js';

type Tab = 'presets' | 'models' | 'plugins' | 'phones';
type Run = (action: () => Promise<unknown>, done?: string | ((result: any) => string)) => Promise<boolean>;

const REFRESH_MS = 5000;

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
  const currentSession = useRef(currentSessionTracker(dsh.sessions.list)).current;
  const sessionId = useSyncExternalStore(dsh.sessions.list.subscribe, currentSession);
  const [state, setState] = useState<PanelState>();
  const [loadError, setLoadError] = useState<string>();
  const [tab, setTab] = useState<Tab>('presets');
  const [toast, setToast] = useState<{ message: string; tone: 'neutral' | 'danger' }>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const refresh = useCallback(async () => {
    try {
      setState(await api.state(sessionId));
      setLoadError(undefined);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

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

  const tabs = [
    { id: 'presets' as const, label: '预设', count: state.presets.length },
    { id: 'models' as const, label: '团队模型', count: state.models.length },
    { id: 'plugins' as const, label: '团队插件', count: state.plugins.length },
    { id: 'phones' as const, label: '手机', count: state.phones.length },
  ];
  return (
    <Panel label="Teamwork" header={<Header state={state} run={run} />} nav={<Tabs<Tab> label="团队配置" items={tabs} value={tab} onChange={setTab} />}>
      {loadError && <Banner tone="danger" title="状态没有刷新" action={<Button size="sm" icon="refresh" onClick={() => void refresh()}>重试</Button>}>{loadError}</Banner>}
      {state.sync.lastError && (
        <Banner tone="warning" title="同步失败，正在使用上次同步的配置" action={<Button size="sm" icon="refresh" onClick={() => run(() => api.sync(), '团队配置已同步')}>重试</Button>}>
          {state.sync.lastError}
        </Banner>
      )}
      <SessionStrip state={state} />
      {tab === 'presets' && (state.presets.length
        ? state.presets.map((p) => <PresetItem key={p.id} preset={p} state={state} dsh={dsh} run={run} onInstall={() => setTab('plugins')} />)
        : <Card><EmptyState icon="layers" title="团队还没有发布预设">管理员在网页控制台发布预设后，下次同步就会出现在这里。</EmptyState></Card>)}
      {tab === 'models' && (state.models.length
        ? state.models.map((m) => <ModelItem key={m.id} model={m} state={state} run={run} />)
        : <Card><EmptyState icon="cpu" title="团队还没有发布模型">团队模型由服务器代为调用，provider 密钥不会下发到这台电脑。</EmptyState></Card>)}
      {tab === 'plugins' && (state.plugins.length
        ? state.plugins.map((p) => <PluginItem key={p.id} plugin={p} run={run} />)
        : <Card><EmptyState icon="puzzle" title="团队没有固定插件版本">固定的插件版本会出现在这里，由你确认后安装。</EmptyState></Card>)}
      {tab === 'phones' && <Phones state={state} run={run} />}
      {toastNode}
    </Panel>
  );
}

/* ── Sign-in ─────────────────────────────────────────────────────────────── */

function SignIn({ state, run }: { state: PanelState; run: Run }) {
  const [opened, setOpened] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const open = () => run(async () => {
    const { url } = await api.login();
    window.open(url, '_blank', 'noopener');
    setOpened(true);
  });
  const authorize = async () => {
    setBusy(true);
    await run(() => api.authorize(code.trim()), '已授权，团队配置已同步');
    setBusy(false);
  };
  const step = opened ? 2 : 1;
  return (
    <div style={{ width: '100%', maxWidth: 440, margin: '0 auto', display: 'grid', gap: 24, padding: '24px 0' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 12, textAlign: 'center' }}>
        <BrandMark size={56} title="DSH Teamwork" />
        <div style={{ display: 'grid', gap: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.01em' }}>{state.team ? `重新登录 ${state.team.name}` : '登录 DSH Teamwork'}</h1>
          <p className="twui-muted">团队的模型、预设和插件版本，一处发布，每位成员的 DSH 自动保持一致。</p>
        </div>
      </div>

      <Card padding={20}>
        <div style={{ display: 'grid', gap: 16 }}>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            <Step n={1} state={step > 1 ? 'done' : 'active'}>在浏览器中登录并确认授权</Step>
            <Step n={2} state={step === 2 ? 'active' : 'todo'}>复制网页上显示的授权码（两分钟内有效）</Step>
            <Step n={3} state={step === 2 && code.trim() ? 'active' : 'todo'}>粘贴到下方，完成授权</Step>
          </ol>
          {!opened ? (
            <Button variant="primary" size="lg" block trailingIcon="external" onClick={open}>在浏览器中登录</Button>
          ) : (
            <form style={{ display: 'grid', gap: 12 }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) void authorize(); }}>
              <Field label="授权码" htmlFor="teamwork-code">
                <Input id="teamwork-code" size="lg" className="twui-mono" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="例如 7Q4K-M2XP" autoComplete="off" spellCheck={false} autoFocus style={{ letterSpacing: '0.08em' }} />
              </Field>
              <Button type="submit" variant="primary" size="lg" block busy={busy} disabled={!code.trim()}>完成授权</Button>
              <p className="twui-subtle" style={{ textAlign: 'center' }}>
                没看到登录页？<button type="button" className="twui-link" onClick={open}>重新打开</button>
              </p>
            </form>
          )}
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
        <Button type="submit" variant="primary" size="sm" busy={busy} disabled={!value.trim()}>保存</Button>
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

function Header({ state, run }: { state: PanelState; run: Run }) {
  const { team, sync } = state;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 260px' }}>
        <BrandMark size={36} title="DSH Teamwork" />
        <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
          <div className="twui-row" style={{ gap: 8 }}>
            <h1 style={{ fontSize: 15, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team?.name ?? '尚未同步团队'}</h1>
            {team && <Badge outline>{team.role === 'admin' ? '管理员' : '成员'}</Badge>}
          </div>
          <span className="twui-subtle twui-row" style={{ gap: 4 }} title="退出后可以更改服务器">
            <Icon name="server" size={12} /><span className="twui-mono">{host(state.server)}</span>
          </span>
        </div>
      </div>
      <div className="twui-row" style={{ marginLeft: 'auto' }}>
        {state.relay === 'connected' && <Badge tone="success" dot title="手机可以通过 DSH Teamwork App 连到这台电脑">手机可连接</Badge>}
        {state.relay === 'refused' && <Badge tone="warning" dot title="中转服务拒绝了这台电脑的连接：重新登录后会再试">手机连接被拒绝</Badge>}
        {sync.running
          ? <Badge>正在同步…</Badge>
          : sync.lastError ? <Badge tone="warning" dot>同步失败</Badge> : <Badge tone="success" dot>{synced(sync.lastSuccess)}</Badge>}
        <Button size="sm" icon="refresh" aria-label="立即同步" title="立即同步" busy={sync.running}
          onClick={() => run(() => api.sync(), '团队配置已同步，本地配置保持不变')} />
        {team?.role === 'admin' && (
          <Button size="sm" trailingIcon="external" onClick={() => window.open(state.consoleUrl, '_blank', 'noopener')}>管理团队</Button>
        )}
        <Button size="sm" variant="ghost" icon="logout" onClick={() => run(() => api.logout(), '已退出，团队配置已从这台 DSH 移除')}>退出</Button>
      </div>
    </>
  );
}

function SessionStrip({ state }: { state: PanelState }) {
  const s = state.session;
  if (!s) return <Banner title="还没有打开会话">打开一个会话后，可以把团队的预设或模型用到这个会话里。</Banner>;
  // A team selection names a model config, or a preset that carries its own model.
  const teamModel = (id: string) => state.models.find((m) => m.id === id)?.name ?? state.presets.find((p) => p.id === id)?.model ?? id;
  const model = s.model ? (s.model.team ? teamModel(s.model.model) : `${s.model.provider}/${s.model.model}`) : '未选择';
  return (
    <div className="twui-card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 20px', padding: '12px 16px', boxShadow: 'none', background: 'var(--twui-fill)' }}>
      <span className="twui-row" style={{ gap: 6, fontWeight: 600 }}><Icon name="session" size={15} />当前会话</span>
      <Meta label="模型" value={model} />
      <Meta label="预设" value={s.preset ? `${s.preset.name} · v${s.preset.version}` : '无团队预设'} />
      <span style={{ marginLeft: 'auto' }}><Badge tone={s.started ? 'neutral' : 'accent'} dot>{s.started ? '已开始对话' : '尚未开始对话'}</Badge></span>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="twui-row" style={{ gap: 6, minWidth: 0 }}>
      <span className="twui-subtle">{label}</span>
      <span style={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{value}</span>
    </span>
  );
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
  // Without a session the strip above the list already says to open one.
  const useBlocked = blocked ?? (!state.session ? '' : state.session.started && !active ? '当前会话已开始对话，预设只能用在新会话里。' : undefined);
  const ready = !blocked;
  return (
    <Item
      icon="layers"
      title={preset.name}
      subtitle={`${preset.id} · v${preset.version}`}
      description={preset.description || undefined}
      tags={
        <>
          <Badge><Icon name="cpu" size={12} />{preset.model}</Badge>
          {active ? <Badge tone="accent" dot>本会话正在使用</Badge> : ready ? <Badge tone="success" dot>可以使用</Badge> : <Badge tone="warning" dot>未就绪</Badge>}
        </>
      }
      actions={
        <>
          <Button variant="ghost" size="sm" trailingIcon={open ? 'chevronDown' : 'chevronRight'} aria-expanded={open} onClick={() => setOpen(!open)}>详情</Button>
          <Button size="sm" icon="plus" disabled={!ready || !state.team} onClick={() => {
            dsh.uiWorkspace.startSession(undefined, { agentPreset: `team:${state.team!.id}:${preset.id}` });
            dsh.layout.selectPanel(null);
          }}>新建会话</Button>
          {!active && (
            <Button variant="primary" size="sm" disabled={useBlocked !== undefined} onClick={() => run(() => api.use(state.session!.id, preset.id), (r) => r.message)}>
              用于当前会话
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
      subtitle={`${model.id} · v${model.version}`}
      description="由团队服务器代为调用，provider 密钥留在服务器上。只改当前会话，不改本地默认模型。"
      tags={<Badge><span className="twui-mono">{model.upstream}</span></Badge>}
      actions={active ? <Badge tone="accent" dot>本会话正在使用</Badge> : (
        <Button variant="primary" size="sm" disabled={!s} onClick={() => run(() => api.use(s!.id, model.id), (r) => r.message)}>用于当前会话</Button>
      )}
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
      subtitle={spec}
      description={plugin.description || undefined}
      tags={<>
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
  off: ['服务器没有开启手机接入', '只有提供中转服务的服务器（如官方服务 www.dshteamwork.com）才能让手机连到这台电脑。'],
  connecting: ['正在连接中转服务…', '连上之后就可以在这里配对手机。'],
  refused: ['中转服务拒绝了这台电脑', '登录可能已失效，或另一个 DSH 正以这台电脑的身份连接。退出后重新登录即可重试。'],
};

const shortTime = (iso: string) => new Date(iso).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function Phones({ state, run }: { state: PanelState; run: Run }) {
  const [offer, setOffer] = useState<PanelPairingOffer>();
  const [revoking, setRevoking] = useState<PanelPhone>();
  const pending = state.phones.filter((p) => p.status === 'pending');
  const paired = state.phones.filter((p) => p.status === 'confirmed');
  // A phone redeemed the code: the code is spent, so stop showing it.
  const seen = useRef(pending.length);
  useEffect(() => {
    if (pending.length > seen.current) setOffer(undefined);
    seen.current = pending.length;
  }, [pending.length]);

  if (state.relay !== 'connected') {
    const [title, body] = relayText[state.relay];
    return <Card><EmptyState icon="smartphone" title={title}>{body}</EmptyState></Card>;
  }
  return (
    <>
      <Card>
        {offer
          ? <PairingCode offer={offer} onDone={() => setOffer(undefined)} />
          : <EmptyState icon="smartphone" title="在手机上操作这台电脑的 DSH"
              action={<Button icon="plus" onClick={() => run(async () => setOffer(await api.pairPhone()))}>配对新手机</Button>}>
              用 DSH Teamwork App 扫描这里显示的二维码，再在这台电脑上确认，手机就能查看会话、发送消息和处理审批。
            </EmptyState>}
      </Card>
      {pending.map((phone) => (
        <Item key={phone.id} icon="smartphone" title={phone.deviceName} subtitle={`${shortTime(phone.createdAt)} 申请配对`}
          tags={<Badge tone="warning" dot>等待你确认</Badge>}
          description="确认后，这台手机可以查看这台电脑上的会话、发送消息、回答 Agent 的提问和处理审批。不是你本人的手机请拒绝。"
          actions={<>
            <Button size="sm" variant="ghost" onClick={() => run(() => api.decidePhone(phone.id, false), '已拒绝')}>拒绝</Button>
            <Button size="sm" onClick={() => run(() => api.decidePhone(phone.id, true), `${phone.deviceName} 已配对`)}>确认配对</Button>
          </>} />
      ))}
      {paired.map((phone) => (
        <Item key={phone.id} icon="smartphone" title={phone.deviceName}
          subtitle={phone.lastUsedAt ? `最近使用 ${shortTime(phone.lastUsedAt)}` : `配对于 ${shortTime(phone.createdAt)}`}
          tags={<Badge tone="success" dot>已配对</Badge>}
          actions={<Button size="sm" variant="ghost" onClick={() => setRevoking(phone)}>解除配对</Button>} />
      ))}
      {revoking && (
        <Confirm title={`解除与 ${revoking.deviceName} 的配对？`} description="这台手机会立即断开，之后需要重新扫码配对才能再连到这台电脑。"
          confirmLabel="解除配对" cancelLabel="取消"
          onCancel={() => setRevoking(undefined)}
          onConfirm={() => { const phone = revoking; setRevoking(undefined); void run(() => api.revokePhone(phone.id), '已解除配对'); }} />
      )}
    </>
  );
}

function PairingCode({ offer, onDone }: { offer: PanelPairingOffer; onDone(): void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const left = Math.max(0, Math.round((Date.parse(offer.expiresAt) - now) / 1000));
  useEffect(() => { if (left === 0) onDone(); }, [left, onDone]);
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <QrCode value={offer.link} size={168} />
      <div style={{ display: 'grid', gap: 8, minWidth: 200, flex: '1 1 200px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 650 }}>用 DSH Teamwork App 扫码</h2>
        <span className="twui-subtle">也可以在 App 里手动输入配对码：</span>
        <span className="twui-mono" style={{ fontSize: 20, letterSpacing: '0.12em' }}>{offer.code.slice(0, 4)} {offer.code.slice(4)}</span>
        <span className="twui-subtle">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} 后失效，只能使用一次。扫码后请回到这里确认。</span>
        <div><Button size="sm" variant="ghost" onClick={onDone}>取消</Button></div>
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
