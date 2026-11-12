import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Badge, Button, Confirm, DefinitionList, EmptyState, Input, Item, ItemBody, Monogram, Notice, Panel, Spinner, Tabs, Toast, type Tone,
} from '@dsh-teamwork/ui';
import type { PanelPlugin, PanelPreset, PanelState, PluginState, ToolState } from '../panel.js';
import { api } from './api.js';
import { currentSessionTracker, type Host } from './host.js';

type Tab = 'presets' | 'models' | 'plugins';
type Notify = (message: string, tone?: 'neutral' | 'danger') => void;

const REFRESH_MS = 5000;

const pluginText: Record<PluginState, [string, Tone]> = {
  ready: ['正常', 'success'],
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
  unknown: ['无法检查', 'neutral'],
};

const missingTools = (preset: PanelPreset) => preset.tools.filter((t) => t.required && (t.state === 'missing' || t.state === 'unknown'));
const pluginsNotReady = (preset: PanelPreset) => preset.plugins.filter((p) => p.state !== 'ready');

function when(iso: string | undefined) {
  if (!iso) return '本次启动尚未同步';
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return '刚刚同步';
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟前同步`;
  return `${new Date(iso).toLocaleString()} 同步`;
}

/** The Teamwork screen in DSH's main column: sign-in, or the team's presets, models and plugins for the open session. */
export function TeamworkPanel({ host }: { host: Host }) {
  const currentSession = useRef(currentSessionTracker(host.sessions.list)).current;
  const sessionId = useSyncExternalStore(host.sessions.list.subscribe, currentSession);
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

  const notify: Notify = useCallback((message, tone = 'neutral') => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(undefined), tone === 'danger' ? 6000 : 3000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /** Runs one action, reports its outcome, then reloads the state it may have changed. */
  const run = useCallback(
    async (action: () => Promise<unknown>, done?: string | ((result: any) => string)) => {
      try {
        const result = await action();
        const message = typeof done === 'function' ? done(result) : done;
        if (message) notify(message);
      } catch (error) {
        notify((error as Error).message, 'danger');
      } finally {
        await refresh();
      }
    },
    [notify, refresh],
  );

  const toastNode = toast && <Toast tone={toast.tone}>{toast.message}</Toast>;

  if (!state) {
    return (
      <Panel label="Teamwork">
        {loadError ? <Notice tone="danger">{loadError}</Notice> : <Notice><Spinner /> 正在读取团队状态…</Notice>}
      </Panel>
    );
  }
  if (!state.authenticated) {
    return (
      <Panel label="Teamwork">
        <SignIn state={state} run={run} />
        {toastNode}
      </Panel>
    );
  }

  const tabs = [
    { id: 'presets' as const, label: '预设', count: state.presets.length },
    { id: 'models' as const, label: '团队模型', count: state.models.length },
    { id: 'plugins' as const, label: '团队插件', count: state.plugins.length },
  ];
  return (
    <Panel label="Teamwork" header={<Header state={state} run={run} />} nav={<Tabs<Tab> label="团队配置" items={tabs} value={tab} onChange={setTab} />}>
      <SessionLine state={state} />
      {loadError && <Notice tone="danger">{loadError}</Notice>}
      {tab === 'presets' &&
        (state.presets.length ? state.presets.map((p) => <PresetItem key={p.id} preset={p} state={state} host={host} run={run} onInstall={() => setTab('plugins')} />)
          : <Notice>团队还没有发布预设。</Notice>)}
      {tab === 'models' &&
        (state.models.length ? state.models.map((m) => <ModelItem key={m.id} model={m} state={state} run={run} />) : <Notice>团队还没有发布模型。</Notice>)}
      {tab === 'plugins' &&
        (state.plugins.length ? state.plugins.map((p) => <PluginItem key={p.id} plugin={p} run={run} />) : <Notice>团队没有固定插件版本。</Notice>)}
      {toastNode}
    </Panel>
  );
}

type Run = (action: () => Promise<unknown>, done?: string | ((result: any) => string)) => Promise<void>;

function SignIn({ state, run }: { state: PanelState; run: Run }) {
  const [opened, setOpened] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const open = () =>
    run(async () => {
      const { url } = await api.login();
      window.open(url, '_blank', 'noopener');
      setOpened(true);
    });
  const authorize = async () => {
    setBusy(true);
    await run(() => api.authorize(code), '已授权，团队配置已同步');
    setBusy(false);
  };
  return (
    <EmptyState mark={<Monogram text="TW" size={44} />} title={state.team ? `重新登录 ${state.team.name}` : '登录你的团队'}
      actions={
        <>
          {!opened ? (
            <Button variant="primary" onClick={open}>在浏览器中登录</Button>
          ) : (
            <form
              style={{ display: 'grid', gap: 8, width: '100%' }}
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) void authorize();
              }}
            >
              <Notice>浏览器里确认后，网页会显示一个两分钟内有效的授权码，粘贴到这里。</Notice>
              <div className="twui-row">
                <Input id="teamwork-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="授权码" autoComplete="off" autoFocus />
                <Button type="submit" variant="primary" busy={busy} disabled={!code.trim()}>授权</Button>
              </div>
              <Button variant="ghost" onClick={open} style={{ justifySelf: 'start' }}>重新打开登录页</Button>
            </form>
          )}
          <p className="twui-subtle">服务器：<span className="twui-mono">{state.server}</span></p>
        </>
      }>
      <p>登录后，团队发布的预设、模型和插件版本会同步到这台 DSH，与你本地的配置并存，不会覆盖。团队模型经服务器调用，provider 密钥不会下发到本机。</p>
    </EmptyState>
  );
}

function Header({ state, run }: { state: PanelState; run: Run }) {
  const team = state.team;
  const { sync } = state;
  return (
    <>
      <div className="twui-row" style={{ minWidth: 0 }}>
        <Monogram text={team?.name ?? 'TW'} />
        <div style={{ minWidth: 0 }}>
          <strong>{team?.name ?? '尚未同步团队'}</strong>{' '}
          {team && <Badge outline>{team.role === 'admin' ? '管理员' : '成员'}</Badge>}
        </div>
      </div>
      <div className="twui-row" style={{ marginLeft: 'auto' }}>
        {sync.running ? (
          <Badge><Spinner /> 正在同步</Badge>
        ) : sync.lastError ? (
          <Badge tone="danger" dot title={sync.lastError}>同步失败，保留上次的配置</Badge>
        ) : (
          <Badge tone="success" dot>{when(sync.lastSuccess)}</Badge>
        )}
        <Button size="sm" busy={sync.running} onClick={() => run(() => api.sync(), '团队配置已同步，本地配置保持不变')}>立即同步</Button>
        {team?.role === 'admin' && (
          <Button size="sm" onClick={() => window.open(state.consoleUrl, '_blank', 'noopener')}>在网页中管理团队 ↗</Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => run(() => api.logout(), '已退出，团队配置已从这台 DSH 移除')}>退出</Button>
      </div>
    </>
  );
}

function SessionLine({ state }: { state: PanelState }) {
  const s = state.session;
  if (!s) return <Notice>打开一个会话后，可以把团队的预设或模型用到这个会话里。</Notice>;
  // A team selection names a model config, or a preset that carries its own model.
  const teamModel = (id: string) => state.models.find((m) => m.id === id)?.name ?? state.presets.find((p) => p.id === id)?.model ?? id;
  const model = s.model ? (s.model.team ? teamModel(s.model.model) : `${s.model.provider}/${s.model.model}`) : '未选择';
  return (
    <Notice>
      当前会话：模型 <strong>{model}</strong>
      {s.preset && <> · 预设 <strong>{s.preset.name} v{s.preset.version}</strong></>}
      {' · '}{s.started ? '已开始对话' : '尚未开始对话'}
    </Notice>
  );
}

function PresetItem({ preset, state, host, run, onInstall }: { preset: PanelPreset; state: PanelState; host: Host; run: Run; onInstall(): void }) {
  const [open, setOpen] = useState(false);
  const missing = missingTools(preset);
  const plugins = pluginsNotReady(preset);
  const active = state.session?.preset?.id === preset.id;
  const blocked = !preset.modelAvailable ? '预设引用的团队模型已不可用，请联系管理员。'
    : plugins.length ? `依赖插件 ${plugins.map((p) => p.name).join('、')} 未就绪，先在"团队插件"里安装。`
    : missing.length && state.session ? `缺少必需工具 ${missing.map((t) => t.name).join('、')}，请在 DSH 插件管理器中安装或启用。`
    : undefined;
  // Without a session the line above the list already says to open one.
  const useBlocked = blocked ?? (!state.session ? '' : state.session.started && !active ? '当前会话已开始对话，预设只能用在新会话里。' : undefined);
  const ready = !blocked;
  return (
    <Item
      title={preset.name}
      subtitle={`${preset.id} · v${preset.version}`}
      description={preset.description || undefined}
      tags={
        <>
          <Badge>{preset.model}</Badge>
          {active ? <Badge tone="accent" dot>本会话正在使用</Badge> : ready ? <Badge tone="success" dot>可以使用</Badge> : <Badge tone="warning" dot>未就绪</Badge>}
        </>
      }
      actions={
        <>
          <Button variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '收起' : '详情'}</Button>
          <Button disabled={!ready || !state.team} onClick={() => {
            host.uiWorkspace.startSession(undefined, { agentPreset: `team:${state.team!.id}:${preset.id}` });
            host.layout.selectPanel(null);
          }}>用它新建会话</Button>
          {!active && (
            <Button variant="primary" disabled={useBlocked !== undefined} onClick={() => run(() => api.use(state.session!.id, preset.id), (r) => r.message)}>
              在当前会话使用
            </Button>
          )}
        </>
      }
      notice={useBlocked && !active ? <Notice tone={blocked ? 'warning' : 'neutral'}>{useBlocked}{plugins.length > 0 && <> <Button size="sm" variant="ghost" onClick={onInstall}>去安装</Button></>}</Notice> : undefined}
    >
      {open && (
        <ItemBody>
          <DefinitionList items={[
            ['模型', <span className="twui-mono">{preset.model}</span>],
            ['工具', preset.tools.length ? (
              <span className="twui-row">{preset.tools.map((t) => (
                <Badge key={t.name} tone={toolText[t.state][1]} title={t.required ? '必需' : '可选'}>
                  <span className="twui-mono">{t.name}</span> {t.required ? '' : '（可选）'}{toolText[t.state][0]}
                </Badge>
              ))}</span>
            ) : '无要求'],
            ['依赖插件', preset.plugins.length ? (
              <span className="twui-row">{preset.plugins.map((p) => <Badge key={p.id} tone={pluginText[p.state][1]}>{p.name} @{p.version} · {pluginText[p.state][0]}</Badge>)}</span>
            ) : '无'],
            ['版本', `v${preset.version}；管理员发布新版本后，下次同步生效`],
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
      title={model.name}
      subtitle={model.id}
      description={`上游：${model.upstream}。经团队服务器调用，provider 密钥留在服务器上。`}
      actions={active ? <Badge tone="accent" dot>本会话正在使用</Badge> : (
        <Button variant="primary" disabled={!s} onClick={() => run(() => api.use(s!.id, model.id), (r) => r.message)}>在当前会话使用</Button>
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
      title={<span className="twui-mono">{plugin.package ?? plugin.name}</span>}
      subtitle={`@${plugin.version}`}
      description={plugin.description || undefined}
      tags={<><Badge tone={tone} dot>{label}</Badge>{plugin.localVersion && plugin.localVersion !== plugin.version && <Badge>本地 {plugin.localVersion}</Badge>}</>}
      actions={plugin.state === 'missing' && !confirming ? <Button variant="primary" onClick={() => setConfirming(true)}>安装</Button>
        : plugin.state === 'missing' ? undefined : <span className="twui-subtle">在 DSH 插件管理器中管理</span>}
    >
      {confirming && (
        <Confirm
          title={`安装并启用 ${spec}？`}
          description="这会在你的电脑上执行该插件的代码。版本由团队固定；已经装过的同名插件不会被覆盖。"
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
