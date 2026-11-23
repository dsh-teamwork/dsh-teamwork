import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  Badge, Banner, BrandMark, Button, Card, Confirm, DefinitionList, EmptyState, Field, Icon, Input, Item, ItemBody, Notice, Panel,
  Skeleton, Tabs, Toast, Select, Monogram, type Tone,
} from '@dsh-teamwork/ui';
import qrcode from 'qrcode-generator';
import type { Locale } from '../locale.js';
import type { PanelPairingOffer, PanelPhone, PanelPlugin, PanelPreset, PanelState, PanelProfile, PanelSummary, PanelTeamUsage, PluginState, ToolState } from '../panel.js';
import { api, HostUnreachable } from './api.js';
import { PresetAvatar } from './PresetAvatar.js';
import { currentSessionTracker, workspaceAt, type Host, type RenderFactorySlot } from './host.js';
import { useT, Words, words, type PanelMessage, type Translate } from './messages.js';

type Tab = 'presets' | 'models' | 'plugins';
type Page = 'resources' | 'devices' | 'profile' | 'connection' | 'teams' | 'team' | 'choose';
type Run = (action: () => Promise<unknown>, done?: string | ((result: any) => string)) => Promise<boolean>;

const REFRESH_MS = 5000;
const SUMMARY_MS = 30000;
// Restore browsing context when DSH unmounts the panel to show a conversation.
const views = new Map<string, { team: string; tab: Tab; query: string }>();

const pluginText: Record<PluginState, [PanelMessage, Tone]> = {
  ready: ['plugin.ready', 'success'],
  missing: ['plugin.missing', 'warning'],
  disabled: ['plugin.disabled', 'warning'],
  'version-mismatch': ['plugin.versionMismatch', 'warning'],
  failed: ['plugin.failed', 'danger'],
  pending: ['plugin.pending', 'warning'],
  unknown: ['plugin.unknown', 'neutral'],
  'catalog-changed': ['plugin.catalogChanged', 'warning'],
};
const toolText: Record<ToolState, [PanelMessage, Tone]> = {
  available: ['tool.available', 'success'],
  conditional: ['tool.conditional', 'neutral'],
  missing: ['tool.missing', 'warning'],
  unknown: ['tool.unknown', 'neutral'],
};

const host = (server: string) => server.replace(/^https?:\/\//, '');
const missingTools = (preset: PanelPreset) => preset.tools.filter((t) => t.required && (t.state === 'missing' || t.state === 'unknown'));
const pluginsNotReady = (preset: PanelPreset) => preset.plugins.filter((p) => p.state !== 'ready');
const role = (t: Translate, value: 'admin' | 'member') => t(value === 'admin' ? 'common.admin' : 'common.member');
const open = (url: string) => window.open(url, '_blank', 'noopener');

/** An error's words for the member: the host words its own; a request that never reached it is worded here. */
function describe(t: Translate, error: unknown) {
  if (error instanceof HostUnreachable) {
    return error.reason === 'offline' ? t('error.offline') : error.reason === 'not-loaded' ? t('error.notLoaded') : t('error.status', { status: error.status ?? '' });
  }
  return (error as Error).message;
}

function synced(t: Translate, iso: string | undefined) {
  if (!iso) return t('sync.never');
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return t('sync.justNow');
  if (seconds < 3600) return t('sync.minutes', { minutes: Math.round(seconds / 60) });
  return t('sync.at', { time: new Date(iso).toLocaleTimeString(t.locale) });
}

/**
 * One team's summary for the member: their budget and the reviews waiting, read every half minute while that team
 * is browsed. Advisory: a failed read shows as unavailable, never as unlimited.
 */
function useSummary(team: string | undefined, revision: string) {
  const [summary, setSummary] = useState<PanelSummary | null>();
  useEffect(() => {
    setSummary(undefined);
    if (!team) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      let next: PanelSummary | null = null;
      try { next = await api.summary(team); } catch { /* Shown as unavailable. */ }
      if (active) { setSummary(next); timer = setTimeout(load, SUMMARY_MS); }
    };
    void load();
    return () => { active = false; clearTimeout(timer); };
  }, [team, revision]);
  return summary;
}

/** The Teamwork screen in DSH's main column: sign-in, or the team's presets, models and plugins for the open session. */
export function TeamworkPanel({ host: dsh, renderFactorySlot }: { host: Host; renderFactorySlot: RenderFactorySlot }) {
  const currentSession = useRef(dsh.currentSession ?? currentSessionTracker(dsh.sessions.list)).current;
  const sessionId = useSyncExternalStore(dsh.sessions.list.subscribe, currentSession);
  const [snapshot, setState] = useState<PanelState>();
  const [loadedSession, setLoadedSession] = useState<string>();
  const state = snapshot && (loadedSession === sessionId ? snapshot : { ...snapshot, session: null });
  const [loadError, setLoadError] = useState<unknown>();
  const [tab, setTab] = useState<Tab>('presets');
  const [page, setPage] = useState<Page>('resources');
  /** The team whose settings page is open (`team`). */
  const [settingsTeam, setSettingsTeam] = useState<string>();
  const [selectedTeam, setTeam] = useState('');
  const browsed = state?.authenticated
    ? state.teams.find(x => x.id === selectedTeam) ?? state.teams[0]
    : undefined;
  const team = browsed?.id ?? '';
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState<PanelProfile>();
  const [profileError, setProfileError] = useState<unknown>();
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
  // Before the host answers, the browser's language; after, the account's (or the system's) as the host reports it.
  const locale: Locale = state?.locale ?? (navigator.language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en');
  const t = useMemo(() => words(locale), [locale]);

  const refresh = useCallback(() => {
    if (request.current) return request.current;
    const session = context.current;
    request.current = (async () => {
      try {
        const next = await api.state(session);
        if (context.current === session) { setLoadedSession(session); setState(next); setLoadError(undefined); }
      } catch (error) { setLoadError(error); }
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
    setProfile(undefined); setPage('resources'); setTeam(''); setQuery('');
  }, [authenticated, server]);
  useEffect(() => {
    setProfileError(undefined);
    if (!authenticated) return;
    let cancelled = false;
    void api.profile().then(next => {
      if (cancelled) return;
      setProfile(next);
      // Reading the profile set the host's language; show it now rather than at the next poll.
      void refresh();
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
      setTeam(teams.find(t => t.id === saved)?.id ?? teams[0]?.id ?? '');
      if (saved === null && teams.length > 1) setPage('choose');
    }).catch(error => { if (!cancelled) setProfileError(error); });
    return () => { cancelled = true; };
  }, [authenticated, server, profileAttempt]);

  useEffect(() => {
    if (profile && identity.current) views.set(identity.current, { team, tab, query });
  }, [profile, team, tab, query]);

  const navigate = (next: Page) => {
    touched.current = true;
    if (next === 'profile' && profile) setProfileAttempt(n => n + 1);
    setPage(next);
  };
  const openTeamSettings = (id: string) => { setSettingsTeam(id); navigate('team'); };

  const selectTeam = (id: string) => {
    touched.current = true;
    setTeam(id); setPage('resources'); setQuery('');
    if (profile) try { localStorage.setItem(`teamwork:team:${server}:${profile.id}`, id); } catch { /* Selection remains usable without persistence. */ }
  };
  useEffect(() => {
    if (authenticated && selectedTeam && selectedTeam !== team) {
      setTeam(team); setQuery('');
      if (profile) try { localStorage.setItem(`teamwork:team:${server}:${profile.id}`, team); } catch { /* Memory retains the selection. */ }
      notify(t('team.gone'));
    }
  }, [authenticated, selectedTeam, team]);

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
      notify(describe(t, error), 'danger');
      return false;
    } finally {
      await request.current;
      await refresh();
    }
  }, [notify, refresh, t]);

  const summary = useSummary(browsed?.id, `${state?.server}:${state?.authRevision}`);

  const toastNode = toast && <Toast tone={toast.tone}>{toast.message}</Toast>;
  const retry = <Button size="sm" icon="refresh" onClick={() => void refresh()}>{t('common.retry')}</Button>;

  if (!state) {
    return (
      <Words.Provider value={t}>
        <Panel label="Teamwork" header={loadError ? undefined : <HeaderSkeleton />}>
          {loadError ? <Banner tone="danger" title={t('load.failed')} action={retry}>{describe(t, loadError)}</Banner> : <ListSkeleton />}
        </Panel>
      </Words.Provider>
    );
  }
  if (!state.authenticated) {
    return (
      <Words.Provider value={t}>
        <Panel label="Teamwork" centered>
          <SignIn state={state} run={run} />
          {toastNode}
        </Panel>
      </Words.Provider>
    );
  }

  const inTeam = (item: { teamId?: string }) => item.teamId === team;
  const matches = (item: { name: string; description?: string }) => `${item.name} ${item.description ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const presets = state.presets.filter(inTeam), models = state.models.filter(inTeam), plugins = state.plugins.filter(inTeam);
  // The assistant leads the presets as its own card while nothing is searched; a search lists it with the rest.
  const assistants = query ? [] : presets.filter(p => p.assistant);
  const listed = (tab === 'presets' ? presets.filter(p => !assistants.includes(p)) : tab === 'models' ? models : plugins).filter(matches);
  const tabs = [{ id: 'presets' as const, label: t('tabs.presets'), count: presets.length }, { id: 'models' as const, label: t('tabs.models'), count: models.length }, { id: 'plugins' as const, label: t('tabs.plugins'), count: plugins.length }];
  const choosing = page === 'choose' && state.teams.length > 1;
  return (
    <Words.Provider value={t}>
      <Panel label="Teamwork" header={<Header state={state} page={page} team={team} reviews={browsed?.role === 'admin' ? summary?.pendingReviews ?? 0 : 0} reviewUrl={browsed ? `${browsed.consoleUrl}/sharing` : ''} selectTeam={selectTeam} navigate={navigate} />}
        footer={<Footer state={state} connectionOpen={page === 'connection'} openConnection={() => navigate('connection')} budget={browsed ? (summary === undefined ? undefined : summary?.budget ?? null) : false} run={run} />}>
        {loadError !== undefined && <Banner tone="danger" title={t('load.stale')} action={retry}>{describe(t, loadError)}</Banner>}
        {state.sync.lastError && (
          <Banner tone="warning" title={t('sync.failedTitle')} action={<Button size="sm" icon="refresh" onClick={() => run(() => api.sync(), t('sync.done'))}>{t('common.retry')}</Button>}>
            {/* The host's own text is English for the terminal (/teamwork status); the panel words it. */}
            {t('sync.failedBody')}
          </Banner>
        )}
        {choosing ? <TeamChooser state={state} select={selectTeam} /> : (page === 'resources' || page === 'choose') && <>
          {!state.teams.length ? <EmptyState icon="layers" title={t('noTeam.title')} action={<div className="twui-row"><Button trailingIcon="external" onClick={() => open(`${state.server}/teams`)}>{t('noTeam.open')}</Button><Button icon="refresh" onClick={() => run(() => api.sync(), t('noTeam.refreshed'))}>{t('noTeam.refresh')}</Button></div>}>{t('noTeam.body')}</EmptyState> : <>
            <div className="twui-resource-toolbar">
              <Tabs<Tab> label={t('tabs.label')} items={tabs} value={tab} onChange={setTab} />
              <div className="twui-resource-toolbar-actions">
                <Input aria-label={t('search.label')} placeholder={t('search.placeholder')} value={query} onChange={e => setQuery(e.target.value)} />
                <Button icon="settings" onClick={() => openTeamSettings(team)}>
                  {t('teams.settings')}
                </Button>
              </div>
            </div>
            {tab === 'presets' && assistants.map(p => <AssistantItem key={p.id} preset={p} state={state} dsh={dsh} />)}
            <div className="twui-resource-list" key={`${team}:${tab}`}>
              {tab === 'presets' && (listed as PanelPreset[]).map(p => <PresetItem key={p.id} preset={p} state={state} dsh={dsh} onInstall={() => setTab('plugins')} />)}
              {tab === 'models' && (listed as PanelState['models']).map(m => <ModelItem key={m.id} model={m} state={state} dsh={dsh} run={run} />)}
              {tab === 'plugins' && (listed as PanelPlugin[]).map(p => <PluginItem key={p.id} plugin={p} run={run} />)}
              {!listed.length && !(tab === 'presets' && assistants.length) && <EmptyState icon="layers" title={query ? t('empty.noMatch') : t('empty.none')}>{query ? t('empty.noMatchBody') : t('empty.noneBody')}</EmptyState>}
            </div>
          </>}
        </>}
        {page === 'devices' && <Phones state={state} run={run} />}
        {page === 'teams' && <><PageTitle title={t('teams.title')}>{t('teams.body')}</PageTitle>{state.teams.map(x => <Item key={x.id} icon="layers" title={x.name} onActivate={() => selectTeam(x.id)} tags={<Badge tone={x.role === 'admin' ? 'brand' : 'neutral'}>{role(t, x.role)}</Badge>} actions={<><Button icon="settings" onClick={() => openTeamSettings(x.id)}>{t('teams.settings')}</Button><Button variant="ghost" trailingIcon="external" onClick={() => open(x.consoleUrl)}>{t(x.role === 'admin' ? 'teams.manage' : 'teams.view')}</Button></>} />)}<div><Button trailingIcon="external" onClick={() => open(`${state.server}/teams`)}>{t('teams.joinOrCreate')}</Button></div></>}
        {page === 'team' && (() => {
          // A team left or deleted meanwhile has no settings to show: back to the list.
          const settings = state.teams.find(x => x.id === settingsTeam);
          return settings
            ? <TeamSettings key={settings.id} team={settings} locale={state.locale} dsh={dsh} renderFactorySlot={renderFactorySlot} run={run} browse={() => selectTeam(settings.id)} />
            : <><PageTitle title={t('teams.title')}>{t('teams.body')}</PageTitle><div><Button onClick={() => navigate('teams')}>{t('nav.teams')}</Button></div></>;
        })()}
        {page === 'profile' && <Account state={state} profile={profile} error={profileError} retry={() => setProfileAttempt(n => n + 1)} run={run} selectTeam={selectTeam}
          onLocaleChange={async locale => {
            if (!profile) return;
            await run(async () => {
              const next = await api.updateProfile({ locale });
              if (identity.current === `teamwork:team:${state.server}:${next.id}`) setProfile(next);
            }, words(locale)('account.languageSaved'));
          }} />}
        {page === 'connection' && <Connection state={state} run={run} />}
        {toastNode}
      </Panel>
    </Words.Provider>
  );
}

/**
 * A team's default workspace: where a session for this team opens, from a preset here, a phone or the web console,
 * unless its member picks another folder there. Until one is picked it is where DSH was started; the choice is DSH's
 * own workspace menu, whose "Add workspace…" registers any folder as a workspace first.
 */
function TeamWorkspace({ team, dsh, renderFactorySlot, run }: { team: PanelState['teams'][number]; dsh: Host; renderFactorySlot: RenderFactorySlot; run: Run }) {
  const t = useT();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const current = useSyncExternalStore(listener => dsh.workspaces.list.subscribe(listener), () => workspaceAt(dsh, team.workspace));
  if (!team.workspace) return null;
  const pick = async (workspaceId: string) => {
    setOpen(false);
    const path = await workspacePath(dsh, workspaceId);
    if (path) await run(() => api.setWorkspace(team.id, path), t('teams.workspaceSaved', { team: team.name }));
  };
  return (
    <div className="twui-stack" style={{ gap: 8 }}>
      <div className="twui-row">
        <Button ref={anchor} aria-haspopup="menu" aria-expanded={open} title={team.workspace} onClick={() => setOpen(value => !value)}>
          {current?.title ?? team.workspace.split(/[\\/]/).filter(Boolean).pop() ?? team.workspace}
        </Button>
        {renderFactorySlot('workspace.picker', { open, anchorRef: anchor, selectedId: current?.workspaceId, onPick: id => void pick(id), onClose: () => setOpen(false) }) as ReactNode}
      </div>
      <p className="twui-muted">{t('teams.workspaceHint')}</p>
    </div>
  );
}

/**
 * One team's settings, as its member sees them: where its sessions open, what they spent there in the last 30 days and
 * on which models, and their budget with the limits near their end. The team itself is managed in the web console.
 */
function TeamSettings({ team, locale, dsh, renderFactorySlot, run, browse }: {
  team: PanelState['teams'][number]; locale: string; dsh: Host; renderFactorySlot: RenderFactorySlot; run: Run; browse(): void;
}) {
  const t = useT();
  const [usage, setUsage] = useState<PanelTeamUsage | null>();
  /** Why the usage could not be read, as the plugin or the server put it. */
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    let alive = true;
    api.teamUsage(team.id).then(next => { if (alive) setUsage(next); }, error => { if (alive) { setUsage(null); setFailure(describe(t, error)); } });
    return () => { alive = false; };
  }, [team.id]);
  const unavailable = <div className="twui-stack" style={{ gap: 4 }}><p className="twui-muted">{t('team.usageUnavailable')}</p>{failure && <p className="twui-subtle">{failure}</p>}</div>;
  const section = (title: string) => <h3 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h3>;
  return (
    <>
      <div className="twui-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div className="twui-stack" style={{ minWidth: 0, flex: '1 1 240px', gap: 6 }}>
          <h2 className="twui-page-title">{team.name}</h2>
          <div><Badge tone={team.role === 'admin' ? 'brand' : 'neutral'}>{role(t, team.role)}</Badge></div>
        </div>
        <div className="twui-row" style={{ gap: 8 }}>
          <Button onClick={browse}>{t('teams.browse')}</Button>
          <Button variant="ghost" trailingIcon="external" onClick={() => open(team.consoleUrl)}>{t(team.role === 'admin' ? 'teams.manage' : 'teams.view')}</Button>
        </div>
      </div>

      {team.workspace && <>{section(t('team.workspaceTitle'))}<Card><TeamWorkspace team={team} dsh={dsh} renderFactorySlot={renderFactorySlot} run={run} /></Card></>}

      {section(t('team.usageTitle'))}
      {usage === undefined ? <Card><p className="twui-muted">{t('team.usageLoading')}</p></Card>
        : usage === null ? <Card>{unavailable}</Card>
        : <>
            <UsageTotals usage={usage} />
            <UsageDaily usage={usage} />
            <Card>
              <div className="twui-stack" style={{ gap: 12 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600 }}>{t('team.byModel')}</h4>
                {usage.sources.length === 0
                  ? <span className="twui-muted">{t('team.noUsage')}</span>
                  : <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }} aria-label={t('team.byModel')}>
                      {usage.sources.slice(0, 8).map(source => (
                        <li key={`${source.kind}:${source.name}`} className="twui-row" style={{ justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{source.labels[locale] ?? source.name}</span>
                          <span className="twui-subtle" style={{ whiteSpace: 'nowrap' }}>{t('team.pointsCount', { points: formatPoints(source.points, t.locale) })} · {t('team.callsCount', { count: source.calls })}</span>
                        </li>
                      ))}
                    </ul>}
                <div><Button size="sm" variant="ghost" trailingIcon="external" onClick={() => open(`${team.consoleUrl}/my-usage`)}>{t('team.usageDetail')}</Button></div>
              </div>
            </Card>
          </>}

      {section(t('team.budgetTitle'))}
      <Card>
        {usage === undefined ? <p className="twui-muted">{t('team.usageLoading')}</p>
          : usage === null ? unavailable
          : <div className="twui-stack" style={{ gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{budgetLabel(t, usage.budget)}</span>
              {usage.budget.resetAt && <span className="twui-subtle">{t('team.budgetReset', { time: shortTime(t, usage.budget.resetAt) })}</span>}
              {usage.nearLimit.map(limit => (
                <Notice key={`${limit.scope}:${limit.period}:${limit.threshold}`} tone={limit.threshold >= 100 ? 'danger' : 'warning'}>
                  {t('team.nearLimit', { who: t(`team.scope.${limit.scope}`), period: t(`team.period.${limit.period}`), threshold: String(limit.threshold) })}
                </Notice>
              ))}
            </div>}
      </Card>
    </>
  );
}

/**
 * A point amount as a whole number, rounded half up and grouped for the reader, as the web console shows it
 * (`formatPoints` in the platform's `@dsh-teamwork/shared`). The server's points are decimal strings with up to nine
 * places; anything else is shown as it came.
 */
function formatPoints(value: string | number, locale: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value).trim());
  if (!match) return String(value);
  const [, sign, whole, fraction = ''] = match;
  const rounded = Number(whole) + (fraction !== '' && fraction[0]! >= '5' ? 1 : 0);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(sign && rounded !== 0 ? -rounded : rounded);
}

/** The period's four figures, as the web console's My usage tiles them: calls, points, input and output tokens. */
function UsageTotals({ usage }: { usage: PanelTeamUsage }) {
  const t = useT();
  const number = new Intl.NumberFormat(t.locale);
  const { totals } = usage;
  const cells = [
    { label: t('team.calls'), value: number.format(totals.calls), note: totals.unpriced > 0 ? t('team.unpriced', { count: totals.unpriced }) : t('team.callsNote') },
    { label: t('team.points'), value: formatPoints(totals.points, t.locale), note: t('team.pointsNote') },
    { label: t('team.input'), value: number.format(totals.input), note: t('team.inputNote', { cached: number.format(totals.cacheRead) }) },
    { label: t('team.output'), value: number.format(totals.output), note: t('team.outputNote', { reasoning: number.format(totals.reasoning) }) },
  ];
  // A one-pixel gap over the border colour draws the dividers however the tiles wrap.
  return (
    <dl className="twui-card" style={{ margin: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, background: 'var(--twui-border)' }}>
      {cells.map(cell => (
        <div key={cell.label} className="twui-stack" style={{ gap: 2, padding: 16, background: 'var(--twui-surface)' }}>
          <dt className="twui-muted">{cell.label}</dt>
          <dd style={{ margin: 0, fontSize: 22, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{cell.value}</dd>
          <dd className="twui-subtle" style={{ margin: 0 }}>{cell.note}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Each day's points as columns from one baseline, as the web console draws them. Hovering or focusing a day reads it
 * out above the plot; with none, the readout is the busiest day.
 */
function UsageDaily({ usage }: { usage: PanelTeamUsage }) {
  const t = useT();
  const [active, setActive] = useState<number | null>(null);
  const { days } = usage;
  const values = days.map(day => Number(day.points));
  const max = Math.max(0, ...values);
  const date = new Intl.DateTimeFormat(t.locale, { month: 'short', day: 'numeric' });
  const label = (day: string) => date.format(new Date(`${day}T00:00:00`));
  const shown = active === null ? undefined : days[active];
  const ticks = days.length === 0 ? [] : [0, Math.floor((days.length - 1) / 2), days.length - 1];
  return (
    <Card>
      <div className="twui-stack" style={{ gap: 12 }}>
        <div className="twui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h4 style={{ fontSize: 14, fontWeight: 600 }}>{t('team.daily')}</h4>
          <p aria-live="polite" style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {shown
              ? <><span style={{ fontWeight: 600 }}>{t('team.pointsCount', { points: formatPoints(shown.points, t.locale) })}</span> <span className="twui-muted">{t('team.dayDetail', { day: label(shown.day), count: shown.calls })}</span></>
              : <span className="twui-muted">{t('team.peak', { points: formatPoints(max, t.locale) })}</span>}
          </p>
        </div>
        {max === 0 ? <p className="twui-muted" style={{ padding: '32px 0', textAlign: 'center' }}>{t('team.noUsage')}</p> : <div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140, borderBottom: '1px solid var(--twui-border)' }} onPointerLeave={() => setActive(null)}>
            {days.map((day, i) => (
              <button
                key={day.day}
                type="button"
                aria-label={`${label(day.day)}: ${t('team.pointsCount', { points: formatPoints(day.points, t.locale) })}, ${t('team.callsCount', { count: day.calls })}`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                style={{ flex: '1 1 0', minWidth: 0, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0, border: 0, background: 'none', cursor: 'default' }}
              >
                {/* At most 24px wide, rounded at its tip and square on the baseline; the hit area is the whole column. */}
                <span style={{ width: '100%', maxWidth: 24, height: `${(values[i]! / max) * 100}%`, borderRadius: '4px 4px 0 0', background: 'var(--twui-accent)', opacity: active === i ? 1 : 0.75 }} />
              </button>
            ))}
          </div>
          <div className="twui-subtle" style={{ position: 'relative', height: 16, marginTop: 6 }}>
            {ticks.map((i, n) => (
              <span key={n} style={{ position: 'absolute', ...(n === 0 ? { left: 0 } : n === 1 ? { left: '50%', transform: 'translateX(-50%)' } : { right: 0 }) }}>{label(days[i]!.day)}</span>
            ))}
          </div>
        </div>}
      </div>
    </Card>
  );
}

/** A picked workspace's folder. One just added reaches DSH's list a moment after the menu reports it, so wait a little. */
function workspacePath(dsh: Host, workspaceId: string) {
  const find = () => dsh.workspaces.list.getSnapshot().items.find(workspace => workspace.workspaceId === workspaceId)?.path;
  return find() ?? new Promise<string | undefined>(resolve => {
    const stop = dsh.workspaces.list.subscribe(() => { const path = find(); if (path) { stop(); clearTimeout(timer); resolve(path); } });
    const timer = setTimeout(() => { stop(); resolve(undefined); }, 5000);
  });
}

function PageTitle({ title, children }: { title: string; children: ReactNode }) {
  return <div className="twui-stack"><h2 className="twui-page-title">{title}</h2><p className="twui-muted">{children}</p></div>;
}

function TeamChooser({ state, select }: { state: PanelState; select(id: string): void }) {
  const t = useT();
  return <><PageTitle title={t('choose.title')}>{t('choose.body')}</PageTitle>{state.teams.map(x => <Item key={x.id} icon="layers" title={x.name} tags={<Badge tone={x.role === 'admin' ? 'brand' : 'neutral'}>{role(t, x.role)}</Badge>} actions={<Button onClick={() => select(x.id)}>{t('choose.pick')}</Button>} />)}</>;
}

function Account({ state, profile, error, retry, run, selectTeam, onLocaleChange }: {
  state: PanelState; profile?: PanelProfile; error?: unknown; retry(): void; run: Run; selectTeam(id: string): void; onLocaleChange(locale: Locale): Promise<void>;
}) {
  const t = useT();
  const [savingLanguage, setSavingLanguage] = useState(false);
  return <div className="twui-account">
    <div className="twui-row twui-account-heading">
      <h2 className="twui-page-title">{t('account.title')}</h2>
      <a className="twui-btn" href={`${state.server}/account`} target="_blank" rel="noopener noreferrer">
        {t('account.editOnWeb')} <Icon name="external" size={14} />
      </a>
    </div>
    {error !== undefined ? <Banner tone="warning" title={t('account.readFailed')} action={<Button onClick={retry}>{t('common.retry')}</Button>}>{describe(t, error)}</Banner> : !profile ? <ListSkeleton /> : <Card>
      <div className="twui-account-identity">
        <Monogram text={profile.name || profile.email || 'T'} size={44} />
        <div><strong>{profile.name || t('account.unnamed')}</strong><p className="twui-muted">{profile.email || t('account.noEmail')}</p></div>
      </div>
      <div className="twui-account-language">
        <Field label={t('account.language')} htmlFor="teamwork-locale">
          <Select id="teamwork-locale" label={t('account.language')} value={profile.locale ?? t.locale} disabled={savingLanguage}
            options={[{ value: 'en', label: 'English' }, { value: 'zh-CN', label: '简体中文' }]}
            onChange={async locale => {
              setSavingLanguage(true);
              try { await onLocaleChange(locale as Locale); } finally { setSavingLanguage(false); }
            }} />
        </Field>
      </div>
    </Card>}
    <section className="twui-stack" aria-labelledby="teamwork-account-teams">
      <h3 id="teamwork-account-teams">{t('nav.teams')}</h3>
      <Card>
        {state.teams.length ? <ul className="twui-account-teams">
          {state.teams.map(team => <li key={team.id}>
            <button type="button" className="twui-account-team" onClick={() => selectTeam(team.id)}>
              <span>{team.name}</span>
              <Badge tone={team.role === 'admin' ? 'brand' : 'neutral'}>{role(t, team.role)}</Badge>
              <Icon name="chevronRight" size={14} />
            </button>
            {team.role === 'member' && <a className="twui-btn twui-account-team-leave" data-variant="ghost"
              href={team.consoleUrl} target="_blank" rel="noopener noreferrer"
              aria-label={t('account.leaveTeamLabel', { team: team.name })} title={t('account.leaveTeamHint')}>
              {t('account.leaveTeam')} <Icon name="external" size={14} />
            </a>}
          </li>)}
        </ul> : <p className="twui-muted">{t('account.noTeams')}</p>}
      </Card>
    </section>
    <SignOutAction run={run} />
  </div>;
}

function Connection({ state, run }: { state: PanelState; run: Run }) {
  const t = useT();
  return <div className="twui-account">
    <h2 className="twui-page-title">{t('account.connection')}</h2>
    <div className="twui-stack">
      <ServerSetting state={state} run={run} />
      <p className="twui-subtle">{t('account.restartNote')}</p>
      <SignOutAction run={run} switchAccount />
    </div>
  </div>;
}

function SignOutAction({ run, switchAccount = false }: { run: Run; switchAccount?: boolean }) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    await run(() => api.logout(), t('account.signedOut'));
    setBusy(false);
  };
  return <div className="twui-stack twui-sign-out">
    <div><Button variant="danger" icon="logout" disabled={busy} aria-expanded={confirm} onClick={() => setConfirm(open => !open)}>
      {t(switchAccount ? 'account.switch' : 'account.signOut')}
    </Button></div>
    {confirm && <Confirm
      title={t(switchAccount ? 'account.switchTitle' : 'account.signOutTitle')}
      description={t('account.signOutBody')}
      confirmLabel={t(switchAccount ? 'account.switchConfirm' : 'account.signOutConfirm')}
      cancelLabel={t('common.cancel')} busy={busy} onCancel={() => setConfirm(false)} onConfirm={signOut}
    />}
  </div>;
}

/* ── Sign-in ─────────────────────────────────────────────────────────────── */

function SignIn({ state, run }: { state: PanelState; run: Run }) {
  const t = useT();
  // `automatic`: the code comes back to this DSH by itself once the member confirms; pasting is the way round.
  const [opened, setOpened] = useState<{ automatic: boolean; url: string; expiresAt: number } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [expired, setExpired] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    if (!opened) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, opened.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [opened]);
  const begin = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(undefined);
    try {
      await run(async () => {
        try {
          const { url, automatic } = await api.login();
          setOpened({ automatic, url, expiresAt: Date.now() + 10 * 60 * 1000 }); setExpired(false); setCode('');
          open(url);
        } catch (failure) { setError(failure); throw failure; }
      });
    } finally { locked.current = false; setBusy(false); }
  };
  const authorize = async () => {
    if (locked.current) return;
    locked.current = true; setError(undefined);
    setBusy(true);
    try {
      await run(async () => { try { await api.authorize(code.trim()); } catch (failure) { setError(failure); throw failure; } }, t('signIn.done'));
    } finally { locked.current = false; setBusy(false); }
  };
  const pasteForm = (
    <form style={{ display: 'grid', gap: 12 }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) void authorize(); }}>
      <Field label={opened?.automatic ? t('signIn.pasteAuto') : t('signIn.paste')} htmlFor="teamwork-code">
        <Input id="teamwork-code" size="lg" className="twui-mono" value={code} onChange={(e) => setCode(e.target.value)}
          placeholder="/teamwork authorize eyJhbGci…" autoComplete="off" spellCheck={false} autoFocus={!opened?.automatic} />
      </Field>
      <Button type="submit" variant={opened?.automatic ? 'secondary' : 'primary'} size="lg" block busy={busy} disabled={!code.trim() || expired}>{t('signIn.finish')}</Button>
    </form>
  );
  return (
    <div style={{ width: '100%', maxWidth: 440, margin: '0 auto', display: 'grid', gap: 24, padding: '24px 0' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 12, textAlign: 'center' }}>
        <BrandMark size={56} title="DSH Teamwork" />
        <div style={{ display: 'grid', gap: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.01em' }}>{state.teams.length ? t('signIn.reconnect') : t('signIn.title')}</h1>
          <p className="twui-muted">{t('signIn.lede')}</p>
        </div>
      </div>

      <Card padding={20}>
        <div style={{ display: 'grid', gap: 16 }}>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            <Step n={1} state={opened ? 'done' : 'active'}>{t('signIn.step1')}</Step>
            {opened?.automatic === false ? (
              <Step n={2} state="active">{t('signIn.step2Paste')}</Step>
            ) : (
              <Step n={2} state={opened ? 'active' : 'todo'}>{t('signIn.step2Auto')}</Step>
            )}
          </ol>
          {error !== undefined && <Notice tone="danger"><span role="alert">{describe(t, error)}</span></Notice>}
          {expired ? <Banner tone="warning" title={t('signIn.expiredTitle')} action={<Button busy={busy} onClick={() => void begin()}>{t('signIn.restart')}</Button>}>{t('signIn.expiredBody')}</Banner>
            : opened ? <>
              {opened.automatic && <p role="status" className="twui-muted">{t('signIn.waiting')}</p>}
              <a className="twui-link" href={opened.url} target="_blank" rel="noopener noreferrer">{t('signIn.openPage')}</a>
              {opened.automatic ? <details><summary className="twui-link">{t('signIn.useCode')}</summary><div style={{ paddingTop: 12 }}>{pasteForm}</div></details> : pasteForm}
              <Button variant="ghost" size="sm" busy={busy} onClick={() => void begin()}>{t('signIn.restart')}</Button>
            </> : <Button variant="primary" size="lg" block trailingIcon="external" busy={busy} onClick={() => void begin()}>{t('signIn.start')}</Button>}
        </div>
      </Card>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        <Point icon="shield" title={t('signIn.keysTitle')}>{t('signIn.keysBody')}</Point>
        <Point icon="layers" title={t('signIn.sideTitle')}>{t('signIn.sideBody')}</Point>
        <Point icon="sync" title={t('signIn.syncTitle')}>{t('signIn.syncBody')}</Point>
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
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(state.server);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const isDefault = state.server === state.defaultServer;
  const save = async (server: string | null) => {
    setBusy(true);
    setError(undefined);
    try {
      await api.setServer(server);
      setEditing(false);
      await run(async () => undefined, server === null ? t('server.wasReset') : t('server.changed'));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  if (!editing) {
    return (
      <div className="twui-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', boxShadow: 'none' }}>
        <span style={{ color: 'var(--twui-fg-subtle)' }}><Icon name="server" size={16} /></span>
        <div style={{ flex: 1, minWidth: 0, display: 'grid' }}>
          <span className="twui-subtle">{t('server.label')}</span>
          <span className="twui-row" style={{ gap: 6 }}>
            <span className="twui-mono" style={{ overflowWrap: 'anywhere' }}>{host(state.server)}</span>
            {isDefault && <Badge tone="accent">{t('common.officialService')}</Badge>}
          </span>
        </div>
        <Button size="sm" onClick={() => { setValue(state.server); setEditing(true); }}>{t('server.change')}</Button>
      </div>
    );
  }
  return (
    <form className="twui-card" style={{ display: 'grid', gap: 12, padding: 16, boxShadow: 'none' }}
      onSubmit={(e) => { e.preventDefault(); void save(value); }}>
      <Field label={t('server.field')} htmlFor="teamwork-server" error={error === undefined ? undefined : describe(t, error)} hint={t('server.hint')}>
        <Input id="teamwork-server" className="twui-mono" value={value} onChange={(e) => setValue(e.target.value)}
          aria-invalid={error !== undefined ? true : undefined} autoComplete="off" spellCheck={false} autoFocus />
      </Field>
      <div className="twui-row">
        <Button type="submit" variant="primary" size="sm" busy={busy} disabled={!value.trim() || value.trim() === state.server}>{state.authenticated ? t('server.saveSignOut') : t('server.save')}</Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setEditing(false); setError(undefined); }}>{t('common.cancel')}</Button>
        {!isDefault && (
          <button type="button" className="twui-link" style={{ marginLeft: 'auto', fontSize: 12 }} disabled={busy} onClick={() => void save(null)}>
            {t('server.reset', { host: host(state.defaultServer) })}
          </button>
        )}
      </div>
    </form>
  );
}

/* ── Signed in ───────────────────────────────────────────────────────────── */

function Header({ state, page, team, reviews, reviewUrl, selectTeam, navigate }: {
  state: PanelState; page: Page; team: string; reviews: number; reviewUrl: string; selectTeam(id: string): void; navigate(page: Page): void;
}) {
  const t = useT();
  const pending = state.phones.filter(p => p.status === 'pending').length;
  return <>
    <div className="twui-brand-lockup"><button type="button" className="twui-brand-home" aria-label={t('nav.home')} onClick={() => navigate('resources')}><BrandMark size={32} title="DSH Teamwork" /></button>
      <div className="twui-row twui-team-scope"><Button variant="ghost" onClick={() => navigate('teams')}>{t('nav.teams')}</Button>
        {!!state.teams.length && <>
          <Icon name="chevronRight" size={14} />
          {state.teams.length === 1
            ? <Button variant="ghost" className="twui-team-name" onClick={() => navigate('resources')}><span>{state.teams[0].name}</span></Button>
            : <Select label={t('nav.chooseTeam')} value={team} onActivate={() => navigate('resources')} onChange={selectTeam} options={state.teams.map(x => ({ value: x.id, label: x.name, description: role(t, x.role) }))} />}
        </>}
        {state.teams.find(x => x.id === team)?.role === 'admin' && <Badge tone="brand">{t('common.admin')}</Badge>}
      </div>
    </div>
    <div className="twui-row twui-header-actions">
      {/* Amber marks what waits on the reader (docs/design.md): an admin's reviews, a phone's pairing. */}
      {reviews > 0 && <Button variant="ghost" trailingIcon="external" title={t('nav.reviewsHint')} onClick={() => open(reviewUrl)}><span className="twui-signal-dot" aria-hidden="true" />{t('nav.reviews', { count: reviews })}</Button>}
      <Button variant="ghost" icon="smartphone" aria-current={page === 'devices' ? 'page' : undefined} onClick={() => navigate('devices')}>{t('nav.phones')}{pending ? <>{` · ${pending}`}<span className="twui-signal-dot" aria-hidden="true" /></> : null}</Button>
      <Button variant="ghost" icon="settings" aria-current={page === 'profile' ? 'page' : undefined} onClick={() => navigate('profile')}>{t('nav.account')}</Button>
    </div>
  </>;
}

/** A member's budget in one team, in a few words: used up, being reconciled, what is left, or no limit. */
const budgetLabel = (t: Translate, budget: PanelSummary['budget']) => budget.exhausted ? t('budget.exhausted')
  : budget.state === 'unconfirmed' ? t('budget.unconfirmed')
  : budget.state === 'known' && budget.remaining !== null ? t('budget.remaining', { points: formatPoints(budget.remaining, t.locale) })
  : budget.tokenLimited ? t('budget.tokenLimited') : t('budget.unlimited');

/** The browsed team's budget for this member; changing the browsed team never changes a running conversation. */
function Budget({ budget }: { budget: PanelSummary['budget'] | null | undefined }) {
  const t = useT();
  const label = budget === undefined ? t('budget.loading') : budget === null ? t('budget.unavailable') : budgetLabel(t, budget);
  return <span className="twui-footer-service" role="status" title={t('budget.hint')}>{budget?.exhausted && <span className="twui-signal-dot" aria-hidden="true" />}{label}</span>;
}

/** `budget`: false when there is no team, undefined while it loads, null when it could not be read. */
function Footer({ state, connectionOpen, openConnection, budget, run }: { state: PanelState; connectionOpen: boolean; openConnection(): void; budget: PanelSummary['budget'] | null | undefined | false; run: Run }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  return <>
    <div className="twui-footer-identity">
      <span className="twui-footer-name">Teamwork</span>
      <Button variant="ghost" size="sm" icon="server" className="twui-footer-connection"
        aria-label={`${t('account.connection')} · ${host(state.server)}`} aria-current={connectionOpen ? 'page' : undefined}
        title={state.server} onClick={openConnection}>
        <span className="twui-footer-service">{host(state.server)}</span>
      </Button>
    </div>
    <div className="twui-row twui-footer-actions">{budget !== false && <Budget budget={budget} />}<span role="status"><Badge tone={state.sync.lastError ? 'warning' : 'success'} dot>{state.sync.running ? t('sync.running') : state.sync.lastError ? t('sync.failed') : synced(t, state.sync.lastSuccess)}</Badge></span>
      <Button variant="ghost" size="sm" icon="refresh" busy={busy || state.sync.running} onClick={async () => { setBusy(true); await run(() => api.sync(), t('sync.done')); setBusy(false); }}>{t('sync.refresh')}</Button>
    </div>
  </>;
}

/** What stops a preset from starting a session. */
function presetState(t: Translate, preset: PanelPreset, state: PanelState) {
  const missing = missingTools(preset);
  const plugins = pluginsNotReady(preset);
  const list = (names: string[]) => names.join(t('list.separator'));
  const blocked = !preset.modelAvailable ? preset.modelOffline ? t('model.offline', { name: preset.model ?? '' }) : preset.contextWindowMissing ? t('model.noContextWindow', { name: preset.model ?? '' }) : t('preset.modelGone')
    : plugins.length ? t('preset.pluginsNotReady', { plugins: list(plugins.map((p) => p.name)) })
    : missing.length && state.session ? t('preset.toolsMissing', { tools: list(missing.map((x) => x.name)) })
    : undefined;
  return { missing, plugins, blocked };
}

/**
 * A preset always opens a session, even while the open one already uses it; DSH reuses an unsent blank session
 * in the workspace instead of piling up new ones. It opens in its team's default workspace when that folder is
 * one of DSH's workspaces.
 * A `prompt` is left in its input, unsent, in place of anything typed there before.
 * DSH closes this panel itself once the session opens; closing it here first would abort that pending navigation
 * (`layout.selectPanel` supersedes it) and leave the previous session on screen.
 */
function startSession(dsh: Host, preset: PanelPreset, state: PanelState, prompt?: string) {
  const workspace = workspaceAt(dsh, state.teams.find(team => team.id === preset.teamId)?.workspace);
  const agentPreset = `team:${preset.teamId}:${preset.id}`;
  dsh.uiWorkspace.startSession(workspace?.workspaceId, prompt === undefined ? { agentPreset } : { agentPreset, prompt, whenDraftExists: 'replace' });
}

/**
 * The team's assistant, ahead of the other presets: what it is for, what to ask it, and how to start; an example
 * question opens a session with it typed in.
 */
function AssistantItem({ preset, state, dsh }: { preset: PanelPreset; state: PanelState; dsh: Host }) {
  const t = useT();
  const { blocked } = presetState(t, preset, state);
  return (
    <div className="twui-featured">
      <Item
        media={<PresetAvatar avatar={preset.avatar} name={preset.name} />}
        title={<>{preset.name}<Badge tone="brand">{t('assistant.label')}</Badge></>}
        description={t('assistant.body')}
        tags={<>
          <span className="twui-subtle">{t('assistant.examples')}</span>
          {(['assistant.example1', 'assistant.example2', 'assistant.example3'] as const).map(key => (
            <Button key={key} size="sm" disabled={!!blocked} onClick={() => startSession(dsh, preset, state, t(key))}>{t(key)}</Button>
          ))}
        </>}
        actions={<Button variant="primary" size="sm" icon="plus" disabled={!!blocked} onClick={() => startSession(dsh, preset, state)}>{t('assistant.ask')}</Button>}
        notice={blocked ? <Notice tone="warning">{blocked}</Notice> : undefined}
      />
    </div>
  );
}

function PresetItem({ preset, state, dsh, onInstall }: { preset: PanelPreset; state: PanelState; dsh: Host; onInstall(): void }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const { missing, plugins, blocked } = presetState(t, preset, state);
  const model = preset.model ?? t('preset.sessionModel');
  return (
    <Item
      media={<PresetAvatar avatar={preset.avatar} name={preset.name} />}
      title={preset.name}
      description={preset.description || undefined}
      tags={
        <>
          <Badge><Icon name="cpu" size={12} />{model}</Badge>
          {!blocked ? <Badge tone={!state.session && missing.length ? 'neutral' : 'success'} dot>{!state.session && missing.length ? t('preset.checkOnStart') : t('preset.ready')}</Badge> : <Badge tone="warning" dot>{t('preset.notReady')}</Badge>}
        </>
      }
      actions={
        <>
          <Button variant="ghost" size="sm" trailingIcon={expanded ? 'chevronDown' : 'chevronRight'} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{t('preset.details')}</Button>
          <Button size="sm" icon="plus" disabled={!!blocked} onClick={() => startSession(dsh, preset, state)}>{t('preset.newSession')}</Button>
        </>
      }
      notice={blocked ? (
        <div className="twui-row" style={{ gap: 6 }}>
          <Notice tone="warning">{blocked}</Notice>
          {plugins.length > 0 && <button type="button" className="twui-link" style={{ fontSize: 12 }} onClick={onInstall}>{t('preset.goInstall')}</button>}
        </div>
      ) : undefined}
    >
      {expanded && (
        <ItemBody>
          <DefinitionList items={[
            [t('preset.model'), model],
            [t('preset.tools'), preset.tools.length ? (
              <span className="twui-row" style={{ gap: 6 }}>{preset.tools.map((x) => (
                <Badge key={x.name} tone={toolText[x.state][1]} title={x.required ? t('preset.required') : t('preset.optional')}>
                  <span className="twui-mono">{x.name}</span>{x.required ? '' : ` · ${t('preset.optional')}`} · {t(toolText[x.state][0])}
                </Badge>
              ))}</span>
            ) : t('preset.noTools')],
            [t('preset.plugins'), preset.plugins.length ? (
              <span className="twui-row" style={{ gap: 6 }}>{preset.plugins.map((p) => <Badge key={p.id} tone={pluginText[p.state][1]}>{p.name} @{p.version} · {t(pluginText[p.state][0])}</Badge>)}</span>
            ) : t('preset.noPlugins')],
            [t('preset.version'), t('preset.versionValue', { version: preset.version })],
          ]} />
          <p className="twui-subtle">{t('preset.toolsNote')}</p>
        </ItemBody>
      )}
    </Item>
  );
}

/**
 * A team model always opens a session on it: DSH reuses an unsent blank session in the workspace or creates one,
 * the model is chosen there before it is shown, and the session already open keeps its own model. The workspace
 * is the team's default folder when DSH has it, else the open session's, else DSH's first.
 */
async function startModelSession(t: Translate, dsh: Host, model: PanelState['models'][number], state: PanelState) {
  const workspaces = dsh.workspaces.list.getSnapshot().items, current = dsh.currentSession?.();
  const workspace = workspaceAt(dsh, state.teams.find(team => team.id === model.teamId)?.workspace)
    ?? workspaces.find(item => current !== undefined && item.sessionIds?.includes(current)) ?? workspaces[0];
  if (!workspace) throw new Error(t('model.noWorkspace'));
  const sessionId = await dsh.uiWorkspace.connectWorkspace(workspace.workspaceId);
  await api.use(sessionId, model.id);
  dsh.uiWorkspace.openSession(sessionId);
}

function ModelItem({ model, state, dsh, run }: { model: PanelState['models'][number]; state: PanelState; dsh: Host; run: Run }) {
  const t = useT();
  const number = new Intl.NumberFormat(t.locale);
  const millions = new Intl.NumberFormat(t.locale, { maximumSignificantDigits: 3 });
  const shortTokens = (tokens: number) => `${millions.format(tokens / 1_000_000)}M`;
  const modalities = t(model.vision === undefined ? 'model.ioUnknown' : model.vision ? 'model.ioImage' : 'model.ioText');
  return (
    <Item
      icon="cpu"
      title={model.name}
      subtitle={model.model !== model.name ? <span className="twui-mono">{model.model}</span> : undefined}
      description={t('model.body')}
      tags={<>
        <span className="twui-model-modalities" role="img" aria-label={modalities} title={modalities}>
          <Icon name="text" />
          {model.vision && <Icon name="image" />}
          <Icon name="arrowRight" size={14} />
          <Icon name="text" />
        </span>
        {model.contextWindow !== undefined && <Badge title={t('model.context', { tokens: number.format(model.contextWindow) })}>
          {t('model.context', { tokens: shortTokens(model.contextWindow) })}
        </Badge>}
        {model.maxTokens !== undefined && <Badge title={t('model.maxOutput', { tokens: number.format(model.maxTokens) })}>
          {t('model.maxOutput', { tokens: shortTokens(model.maxTokens) })}
        </Badge>}
        {(model.contextWindowMissing || model.modelOffline) && <Badge tone="warning" dot>{t('preset.notReady')}</Badge>}
      </>}
      actions={<Button size="sm" icon="plus" disabled={model.contextWindowMissing || model.modelOffline} onClick={() => run(() => startModelSession(t, dsh, model, state))}>{t('preset.newSession')}</Button>}
      notice={model.modelOffline ? <Notice tone="warning">{t('model.offline', { name: model.name })}</Notice>
        : model.contextWindowMissing ? <Notice tone="warning">{t('model.noContextWindow', { name: model.name })}</Notice> : undefined}
    />
  );
}

function PluginItem({ plugin, run }: { plugin: PanelPlugin; run: Run }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, tone] = pluginText[plugin.state];
  const spec = `${plugin.package ?? plugin.name}@${plugin.version}`;
  return (
    <Item
      icon="puzzle"
      title={plugin.name}
      description={plugin.description || undefined}
      tags={<>
        <span className="twui-subtle twui-mono">{spec}</span>
        <Badge tone={tone} dot>{t(label)}</Badge>
        {plugin.localVersion && plugin.localVersion !== plugin.version && <Badge>{t('plugin.local', { version: plugin.localVersion })}</Badge>}
      </>}
      actions={plugin.state === 'missing'
        ? !confirming && <Button size="sm" onClick={() => setConfirming(true)}>{t('plugin.install')}</Button>
        : <span className="twui-subtle">{t('plugin.managed')}</span>}
    >
      {confirming && (
        <Confirm
          title={t('plugin.confirmTitle', { spec })}
          description={t('plugin.confirmBody')}
          confirmLabel={t('plugin.confirm')}
          cancelLabel={t('common.cancel')}
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

const relayText: Record<Exclude<PanelState['relay'], 'connected'>, [PanelMessage, PanelMessage]> = {
  off: ['relay.offTitle', 'relay.offBody'],
  connecting: ['relay.connectingTitle', 'relay.connectingBody'],
  refused: ['relay.refusedTitle', 'relay.refusedBody'],
};

/** A paired device's kind, as it said when it paired; one paired before devices said shows none. */
const deviceIcon = (device: PanelPhone) => (device.deviceKind === 'web' ? 'monitor' : 'smartphone');
/** A device's kind, then the rest; a device named after its kind (the default name) says it once, in its title. */
const deviceLine = (t: Translate, device: PanelPhone, rest: string) => {
  const kind = device.deviceKind ? t(`devices.kind.${device.deviceKind}`) : undefined;
  return kind && kind !== device.deviceName ? `${kind} · ${rest}` : rest;
};
const shortTime = (t: Translate, iso: string) => new Date(iso).toLocaleString(t.locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * The owner's native Web switch (`src/web-relay.ts`, platform ADR 0064): off by default. On, My DSH on the web and the
 * phone's computer switcher open this DSH's whole Web interface for the account signed in here, through the platform.
 * Turning it on asks first; a device PIN or a DSH with no Web server keeps it from working, and says so.
 */
function NativeWeb({ state, busy, perform }: {
  state: NonNullable<PanelState['nativeWeb']>;
  busy?: string;
  perform(key: string, action: () => Promise<unknown>, done?: string): Promise<unknown>;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const { enabled, blocked, active } = state;
  const set = (on: boolean) => void perform('native-web', async () => { await api.setNativeWeb(on); setConfirming(false); }, t(on ? 'phones.webTurnedOn' : 'phones.webTurnedOff'));
  const disconnect = () => void perform('native-web-disconnect', () => api.disconnectNativeWeb(), t('phones.webDisconnected'));
  // Who is using it, as far as this computer can tell: tunnels open now, or when one last moved.
  const use = active.tunnels > 0 ? t('phones.webInUse', { count: active.tunnels })
    : active.lastActivity ? t('phones.webLastUsed', { time: shortTime(t, active.lastActivity) }) : undefined;
  return (
    <Item
      icon="external"
      title={t('phones.webTitle')}
      tags={<Badge tone={enabled && !blocked ? 'success' : 'neutral'} dot>{t(enabled ? 'phones.webOn' : 'phones.webOff')}</Badge>}
      description={blocked ? t(blocked === 'pin' ? 'phones.webBlockedPin' : 'phones.webBlockedWeb') : enabled && use ? `${t('phones.webHint')} ${use}` : t('phones.webHint')}
      actions={!confirming && (enabled
        ? <>
          <Button size="sm" variant="secondary" disabled={!!busy} busy={busy === 'native-web-disconnect'} onClick={disconnect}>{t('phones.webDisconnect')}</Button>
          <Button size="sm" variant="ghost" disabled={!!busy} busy={busy === 'native-web'} onClick={() => set(false)}>{t('phones.webDisable')}</Button>
        </>
        : <Button size="sm" variant="primary" disabled={!!busy || !!blocked} onClick={() => setConfirming(true)}>{t('phones.webEnable')}</Button>)}
      >
      {confirming && <ItemBody>
        <Confirm title={t('phones.webEnableTitle')} description={t('phones.webEnableBody')} confirmLabel={t('phones.webEnable')} cancelLabel={t('common.cancel')}
          busy={busy === 'native-web'} onConfirm={() => set(true)} onCancel={() => setConfirming(false)} />
      </ItemBody>}
    </Item>
  );
}

/**
 * The personal desktop's own PIN for its paired devices (`src/pin-lock.ts`): off by default, set here with the
 * computer's own authority, so changing or turning it off asks for no old PIN; it closes every open device channel.
 */
function OwnerPin({ enabled, busy, perform }: {
  enabled: boolean;
  busy?: string;
  perform(key: string, action: () => Promise<unknown>, done?: string): Promise<unknown>;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [turningOff, setTurningOff] = useState(false);
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const digits = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 4);
  const mismatch = again.length === 4 && pin !== again;
  const close = () => { setEditing(false); setPin(''); setAgain(''); };
  const save = () => void perform('pin', async () => { await api.setOwnerPin(pin); close(); }, t(enabled ? 'phones.pinChanged' : 'phones.pinTurnedOn'));
  const off = () => void perform('pin', async () => { await api.setOwnerPin(null); setTurningOff(false); }, t('phones.pinTurnedOff'));
  return (
    <Item
      icon="key"
      title={t('phones.pinTitle')}
      tags={<Badge tone={enabled ? 'success' : 'neutral'} dot>{t(enabled ? 'phones.pinOn' : 'phones.pinOff')}</Badge>}
      description={t('phones.pinHint')}
      actions={!editing && !turningOff && <>
        <Button size="sm" variant={enabled ? 'secondary' : 'primary'} disabled={!!busy} onClick={() => setEditing(true)}>
          {t(enabled ? 'phones.pinChange' : 'phones.pinEnable')}
        </Button>
        {enabled && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setTurningOff(true)}>{t('phones.pinDisable')}</Button>}
      </>}
      >
      {editing && <ItemBody>
        <form className="twui-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }} onSubmit={event => { event.preventDefault(); if (pin.length === 4 && pin === again) save(); }}>
          <Field label={t('phones.pin')} htmlFor="teamwork-owner-pin">
            <Input id="teamwork-owner-pin" className="twui-mono" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password" autoFocus
              value={pin} disabled={!!busy} onChange={event => setPin(digits(event.target.value))} />
          </Field>
          <Field label={t('phones.pinConfirm')} htmlFor="teamwork-owner-pin-again" error={mismatch ? t('phones.pinMismatch') : undefined}>
            <Input id="teamwork-owner-pin-again" className="twui-mono" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password"
              value={again} disabled={!!busy} onChange={event => setAgain(digits(event.target.value))} />
          </Field>
          <Button type="submit" variant="primary" busy={busy === 'pin'} disabled={!!busy || pin.length !== 4 || pin !== again}>{t('phones.pinSave')}</Button>
          <Button variant="ghost" disabled={!!busy} onClick={close}>{t('phones.pinCancel')}</Button>
        </form>
        <p className="twui-subtle" style={{ marginTop: 8 }}>{t('phones.pinChangeNote')}</p>
      </ItemBody>}
      {turningOff && <ItemBody>
        <Confirm title={t('phones.pinDisableTitle')} description={t('phones.pinDisableBody')} confirmLabel={t('phones.pinDisable')} cancelLabel={t('phones.pinCancel')}
          busy={busy === 'pin'} onConfirm={off} onCancel={() => setTurningOff(false)} />
      </ItemBody>}
    </Item>
  );
}

/**
 * The devices page, in the order a visitor needs it: a pairing in progress first (the code, then each request with its
 * safety code, then a moment of "paired"), the paired devices next, and the device PIN last as a security setting.
 * With no device yet, pairing is explained in three steps; with some, "Pair a device" sits in the header.
 */
function Phones({ state, run }: { state: PanelState; run: Run }) {
  const t = useT();
  const [offer, setOffer] = useState<PanelPairingOffer>();
  const [revoking, setRevoking] = useState<PanelPhone>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<unknown>();
  const [expired, setExpired] = useState(false);
  const [justPaired, setJustPaired] = useState<{ id: string; name: string }>();
  const locked = useRef(false);
  const connected = state.relay === 'connected';
  const pending = state.phones.filter((p) => p.status === 'pending');
  const paired = state.phones.filter((p) => p.status === 'confirmed');
  // A phone redeemed the code: the code is spent, and its request takes the code's place as the next step.
  const seen = useRef(new Set(pending.map(p => p.id)));
  useEffect(() => {
    if (pending.some(p => !seen.current.has(p.id))) { setOffer(undefined); setExpired(false); }
    seen.current = new Set(pending.map(p => p.id));
  }, [state.phones]);
  useEffect(() => { if (!connected) { setOffer(undefined); setExpired(false); } }, [connected]);
  useEffect(() => {
    if (!justPaired) return;
    const timer = setTimeout(() => setJustPaired(undefined), 3000);
    return () => clearTimeout(timer);
  }, [justPaired]);
  const perform = async (key: string, action: () => Promise<unknown>, done?: string) => {
    if (locked.current) return false;
    locked.current = true; setBusy(key); setError(undefined);
    try {
      return await run(async () => { try { return await action(); } catch (failure) { setError(failure); throw failure; } }, done);
    } finally { locked.current = false; setBusy(undefined); }
  };
  const pair = () => perform('pair', async () => { setOffer(await api.pairPhone()); setExpired(false); });
  const accept = (phone: PanelPhone) => perform(`accept:${phone.id}`, async () => { await api.decidePhone(phone.id, true); setJustPaired({ id: phone.id, name: phone.deviceName }); }, t('phones.accepted', { device: phone.deviceName }));

  // "Paired" shows for a moment, and only while that device still is.
  const done = justPaired && paired.some((p) => p.id === justPaired.id) ? justPaired.name : undefined;
  const pairing = !!offer || expired || pending.length > 0;
  const pairButton = <Button variant="primary" icon="plus" busy={busy === 'pair'} disabled={!!busy || !connected} onClick={() => void pair()}>{t('phones.pair')}</Button>;
  const relayBanner = state.relay !== 'connected' && <Banner tone={state.relay === 'connecting' ? 'neutral' : 'warning'} title={t(relayText[state.relay][0])}>{t(relayText[state.relay][1])}</Banner>;

  return (
    <>
      <div className="twui-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div className="twui-stack" style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h2 className="twui-page-title">{t('phones.title')}</h2>
          <p className="twui-muted">{t('phones.body')}</p>
        </div>
        {/* A code on screen is its own way forward; otherwise, with any device or request, a new code is one click. */}
        {(paired.length > 0 || pending.length > 0) && !offer && !expired && pairButton}
      </div>
      {relayBanner}
      {error !== undefined && <Banner tone="warning" title={t('phones.failed')}>{describe(t, error)}</Banner>}

      {offer && <Card><div className="twui-stack" style={{ gap: 16 }}><PairSteps at={1} /><PairingCode offer={offer} onCancel={() => setOffer(undefined)} onExpire={() => { setOffer(undefined); setExpired(true); }} /></div></Card>}
      {expired && !offer && (
        <Card><div className="twui-stack" style={{ gap: 16 }}>
          <PairSteps at={1} />
          <div className="twui-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span>{t('phones.expiredTitle')}</span>
            <div className="twui-row" style={{ gap: 8 }}>
              <Button variant="ghost" disabled={!!busy} onClick={() => setExpired(false)}>{t('phones.hide')}</Button>
              <Button variant="primary" busy={busy === 'pair'} disabled={!!busy || !connected} onClick={() => void pair()}>{t('phones.newCode')}</Button>
            </div>
          </div>
        </div></Card>
      )}
      {pending.map((phone) => {
        const ready = !!phone.safetyCode && !!phone.phoneConfirmed;
        return (
          <Card key={phone.id}><div className="twui-stack" style={{ gap: 14 }}>
            <PairSteps at={2} />
            <div className="twui-row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px' }}>
              <span className="twui-tile" aria-hidden="true"><Icon name={deviceIcon(phone)} size={18} /></span>
              <strong style={{ fontWeight: 600 }}>{t('phones.requestTitle', { device: phone.deviceName })}</strong>
              <span className="twui-subtle">{deviceLine(t, phone, t('phones.requested', { time: shortTime(t, phone.createdAt) }))}</span>
              <Badge tone="warning" dot>{t('phones.waiting')}</Badge>
            </div>
            {phone.safetyCode
              ? <div className="twui-stack" style={{ gap: 4 }}>
                  <span className="twui-subtle">{t('phones.safetyLabel')}</span>
                  <span className="twui-mono" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '0.14em' }}>{phone.safetyCode}</span>
                  <span className="twui-muted">{t('phones.confirmOrder')}</span>
                </div>
              : <span className="twui-muted">{t('phones.handshake')}</span>}
            <div className="twui-row" style={{ justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              {phone.safetyCode && !phone.phoneConfirmed && <span className="twui-subtle" style={{ flex: '1 1 auto' }}>{t('phones.waitDevice')}</span>}
              <Button variant="ghost" busy={busy === `reject:${phone.id}`} disabled={!!busy} onClick={() => void perform(`reject:${phone.id}`, () => api.decidePhone(phone.id, false), t('phones.rejected'))}>{t('phones.reject')}</Button>
              <Button variant="primary" busy={busy === `accept:${phone.id}`} disabled={!!busy || !ready || !connected} onClick={() => void accept(phone)}>{t('phones.accept')}</Button>
            </div>
          </div></Card>
        );
      })}
      {done && <Card><div className="twui-stack" style={{ gap: 12 }}><PairSteps at={3} /><span>{t('phones.accepted', { device: done })}</span></div></Card>}

      {paired.length === 0 && !pairing && connected && (
        <Card><div className="twui-stack" style={{ gap: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>{t('phones.emptyTitle')}</h3>
          {/* What to do, in order: read as instructions, not as steps not yet reached. */}
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
            <li>{t('phones.how1')}</li>
            <li>{t('phones.how2')}</li>
            <li>{t('phones.how3')}</li>
          </ol>
          <div>{pairButton}</div>
        </div></Card>
      )}

      {paired.length > 0 && <>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>{t('phones.pairedCount', { count: paired.length })}</h3>
        {/* While the relay reconnects, the devices it last listed stay, dimmed: their pairings are intact. */}
        <div className="twui-stack" style={{ gap: 12, opacity: connected ? 1 : 0.55 }}>
          {paired.map((phone) => (
            <Item key={phone.id} icon={deviceIcon(phone)} title={phone.deviceName}
              description={deviceLine(t, phone, phone.lastUsedAt ? t('phones.lastUsed', { time: shortTime(t, phone.lastUsedAt) }) : t('phones.pairedAt', { time: shortTime(t, phone.createdAt) }))}
              tags={phone.verified ? undefined : <Badge tone="warning" dot>{t('phones.repair')}</Badge>}
              actions={connected && <>
                {!phone.verified && <Button size="sm" disabled={!!busy || pairing} onClick={() => void pair()}>{t('phones.repairAction')}</Button>}
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setRevoking(phone)}>{t('phones.unpair')}</Button>
              </>} />
          ))}
        </div>
      </>}
      {revoking && (
        <Confirm title={t('phones.unpairTitle', { device: revoking.deviceName })} description={t('phones.unpairBody')}
          confirmLabel={t('phones.unpair')} cancelLabel={t('common.cancel')}
          busy={!!busy}
          onCancel={() => setRevoking(undefined)}
          onConfirm={async () => { if (await perform(`revoke:${revoking.id}`, () => api.revokePhone(revoking.id), t('phones.unpaired'))) setRevoking(undefined); }} />
      )}

      {state.ownerPinEnabled !== undefined && <>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>{t('phones.security')}</h3>
        <OwnerPin enabled={state.ownerPinEnabled} busy={busy} perform={perform} />
        {state.nativeWeb && <NativeWeb state={state.nativeWeb} busy={busy} perform={perform} />}
      </>}
    </>
  );
}

/** Where a pairing stands: the code, the safety code, done. */
function PairSteps({ at }: { at: 1 | 2 | 3 }) {
  const t = useT();
  const labels = [t('phones.step1'), t('phones.step2'), t('phones.step3')];
  return (
    <ol aria-label={t('phones.stepsLabel')} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
      {labels.map((label, i) => <Step key={label} n={i + 1} state={i + 1 < at || at === 3 ? 'done' : i + 1 === at ? 'active' : 'todo'}>{label}</Step>)}
    </ol>
  );
}

function PairingCode({ offer, onCancel, onExpire }: { offer: PanelPairingOffer; onCancel(): void; onExpire(): void }) {
  const t = useT();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const left = Math.max(0, Math.round((Date.parse(offer.expiresAt) - now) / 1000));
  useEffect(() => { if (left === 0) onExpire(); }, [left, onExpire]);
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <QrCode value={offer.link} size={168} label={t('phones.qr')} />
      <div style={{ display: 'grid', gap: 6, minWidth: 200, flex: '1 1 200px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 650 }}>{t('phones.scan')}</h2>
        <span className="twui-subtle">{t('phones.manual')}</span>
        <span className="twui-mono" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '0.16em' }}>{offer.code.slice(0, 3)} {offer.code.slice(3)}</span>
        <span className="twui-subtle">{t('phones.expires', { time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` })}</span>
        <div><Button size="sm" variant="ghost" onClick={onCancel}>{t('phones.hide')}</Button></div>
      </div>
    </div>
  );
}

/** A QR code drawn as one SVG path, dark on a light quiet zone so any camera reads it in either theme. */
function QrCode({ value, size, label }: { value: string; size: number; label: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (qr.isDark(row, col)) d += `M${col + 4} ${row + 4}h1v1h-1z`;
  const extent = count + 8;
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${extent} ${extent}`} shapeRendering="crispEdges" style={{ borderRadius: 8, flex: 'none' }}>
      <rect width={extent} height={extent} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}
