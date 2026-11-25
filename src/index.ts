import { connectWebRelay, NativeWebSwitch, WebTunnels } from './web-relay.js';
import { PhoneKeys, PhoneSecurity } from './phone-security.js';
import { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-commands';
import type {} from '@deepseek-ai/dsh-plugin-manager';
import type {} from '@deepseek-ai/dsh-agent-preset-registry';
import { allConfigs, findConfig, ServerChoice, serverAddress, teamOf, TeamOverlay, TeamworkClient } from './client.js';
import { ConfigSync } from './config-sync.js';
import type {} from '@deepseek-ai/dsh-tools';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { PresetContext } from './preset-context.js';
import { PresetStamps, presetStampPath, sameRevision, toolReport, assertBlank } from './preset-session.js';
import { modelData, modelLimitProblem, offlineModel, unsizedModel, inheritsModel, pinnedPlugin, type TeamConfig } from './client.js';
import { taskProjection, stepProjection, TaskActions, recoveryHint, retryInstruction, outcomeText } from './task-session.js';
import { pluginState, stateText, type PluginState } from './plugin-status.js';
import { panelRoutes, type FetchRoute, type PanelCatalogItem, type PanelOps, type PanelPreset } from './panel.js';
import { registerAssistantTools } from './assistant-tools.js';
import { registerArtifactTool } from './artifact-tool.js';
import { KnowledgeSync } from './knowledge-sync.js';
import { registerKnowledgeTool } from './knowledge-tool.js';
import { knowledgeGuide } from './preset-context.js';
import { registerBundledSkills } from './bundled-skills.js';
import { teamworkSearch } from './web-search.js';
import { isTeamProvider, platformAdapter, teamProvider, teamRoutes } from './platform-models.js';
import { Bridge, bridgeRoute } from './bridge.js';
import type { PreviewOfficeKit, WorkspaceChanges } from './phone-files.js';
import { PhoneSessionError, phonePresets } from './phone-session.js';
import { phonePermissions, type PermissionPresets } from './phone-permission.js';
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { listenForCode, type LoginCallback } from './login-callback.js';
import { offerSchema, pairingSchema, RelayError, RelayLink, relayClientIdPath } from './relay.js';
import { watchTokenFile } from './token-file.js';
import { PinStore, pinsPath } from './pin-lock.js';
import { startDirectories, TeamWorkspaces, teamWorkspacesPath } from './team-workspaces.js';
import type { PanelPhone } from './panel.js';
import { panelLocale, say, setLocale, speaking } from './messages.js';
import { controlSocketPath, serveControlSocket } from './control-socket.js';
export const name = 'dsh-teamwork';
export const inject = ['agentPresets', 'agents', 'llm', 'sessionProjections'];

/** What the plugin reads of DSH's workspace registry: its workspaces, and its pin and archive sets (src/bridge.ts). */
interface WorkspaceRegistry {
  list(): { id: string; path: string; title: string; sessionIds: readonly string[] }[];
  readonly pinnedSessionIds: readonly string[];
  readonly archivedSessionIds: readonly string[];
}
/** What the plugin reads of DSH's loader: the profile's entries, to find the default preset's composition. */
interface LoaderEntries { entries(): Iterable<{ options: { name: string; config?: { id?: unknown; plugins?: unknown } } }> }
/**
 * The plugin rows of the profile's declared default preset (DSH's `standard`). A team preset composes them before
 * its own context, so a team session has the tools (read, write, bash, web and the rest), persona, compaction and
 * planning a host session has; a template's required tools are DSH's own. Empty, with a warning, when the profile
 * declares its default some other way: the team preset then carries its context alone.
 */
function hostComposition(ctx: Context): unknown[] {
  const id = ctx.agentPresets.config.default;
  for (const { options } of (ctx.get('loader') as LoaderEntries | undefined)?.entries() ?? []) {
    if (options.name === '@deepseek-ai/dsh-agent-preset' && options.config?.id === id && Array.isArray(options.config.plugins)) return [...options.config.plugins];
  }
  ctx.logger.warn('The default agent preset %s is not a profile row; team presets compose no host tools', id);
  return [];
}
export interface Config { apiEndpoint: string; cachePath: string; autoSync?: boolean; syncIntervalMs?: number; tokenFile?: string; mcpServers?: Record<string, { command: string; args: string[] }>; }
/** The hosted service. A member can pick another server in the panel; the profile's `apiEndpoint` sets the default. */
export const DEFAULT_SERVER = 'https://www.dshteamwork.com';
export const Config: z<Config> = z.object({ apiEndpoint: z.string().default(DEFAULT_SERVER), cachePath: z.string().required(), autoSync: z.boolean().default(true), syncIntervalMs: z.number().default(60000), tokenFile: z.string(),
  // A host that provides the token (a cloud computer) may also provide local MCP servers, such as its desktop's browser.
  mcpServers: z.dict(z.object({ command: z.string().required(), args: z.array(z.string()).default([]) })).default({}) });
export async function apply(ctx: Context, config: Config) {
  const client = new TeamworkClient(config.apiEndpoint, config.cachePath);
  const serverChoice = ServerChoice.beside(config.cachePath);
  // With tokenFile the host names the server in apiEndpoint, and a member's earlier choice does not apply.
  const chosen = config.tokenFile ? undefined : await serverChoice.read();
  if (chosen) await client.setEndpoint(chosen);
  const providers = teamRoutes(ctx.llm, client, platformAdapter(client, ctx));
  ctx.effect(() => () => providers.dispose());
  const taskState = await ctx.sessionProjections.register(taskProjection);
  ctx.effect(() => () => taskState.dispose());
  const stepState = await ctx.sessionProjections.register(stepProjection);
  ctx.effect(() => () => stepState.dispose());
  const stamps = new PresetStamps(presetStampPath(config.cachePath));
  await stamps.load();
  const overlay = new TeamOverlay(async (id, item, team) => ctx.agentPresets.register({
    id, name: `[${team.teamName}] ${item.name}`, description: item.data.description ?? '',
    plugins: [...hostComposition(ctx) as never[], { name: 'cordis:group', group: true, isolate: {teamworkPreset:true}, config: [{ name: new URL('./preset-context.js', import.meta.url).href, config: {
      inheritModel: item.data.inheritModel, builtin: item.builtin, description: item.data.description ?? '', instructions: item.data.instructions ?? '', outputDescription: item.data.outputDescription ?? '',
      pluginDependencies: item.data.pluginDependencies ?? [],
      requiredTools: item.data.requiredTools ?? [], optionalTools: item.data.optionalTools ?? [], systemPrompt: item.data.systemPrompt,
      ...(item.data.modelConfigId ? {modelConfigId: item.data.modelConfigId} : {}),
      teamId: team.teamId, id: item.id, name: item.name, version: item.version,
    } }] }],
  }), () => {
    // A refused route set keeps the previous one; the presets still reconcile.
    try { providers.sync(); } catch (error) { ctx.logger.warn('Could not register the team model providers: %s', (error as Error).message); }
  });
  const restartRequired = new Set<string>();
  const activePreset = (agent: Agent) => ctx.agentPresets.serviceFor(agent, 'teamworkPreset');
  const requirements = (agent: Agent, preset: PresetContext) => {
    const tools = ctx.get('tools');
    return toolReport(preset, name => !tools ? 'unknown' : !tools.get(name, agent) ? 'missing' : tools.executable(name, agent) ? 'available' : 'conditional');
  };
  const readPluginInventory = async () => {
    const manager = ctx.get('pluginManager');
    const bundles = manager ? await manager.listBundles() : [];
    const entries = manager ? await manager.listPlugins() : [];
    return { manager, bundles, entries };
  };
  const plugins = async (preset?: PresetContext, readInventory = readPluginInventory) => {
    const snapshot = client.current();
    const dependencies = preset ? preset.pluginDependencies ?? [] : allConfigs(snapshot).filter(c=>c.kind==='plugin').map(c=>({pluginConfigId:c.id,version:c.data.version}));
    if (!dependencies.length) return [];
    const { manager, bundles, entries } = await readInventory();
    return dependencies.map(dependency=>{
      const item = pinnedPlugin(snapshot,dependency.pluginConfigId,dependency.version);
      // A preset's pin counts only in the preset's own team.
      const valid = (!preset || teamOf(snapshot, dependency.pluginConfigId)?.teamId===preset.teamId) && item?.kind==='plugin' && item.data.version===dependency.version;
      const bundle = item?.kind==='plugin' ? bundles.find(b=>b.name===item.data.package) : undefined;
      const state: PluginState = !valid ? 'catalog-changed' : !manager ? 'unknown' : pluginState(dependency.version,bundle,entries,restartRequired.has(`${item.data.package}@${dependency.version}`));
      return {id:dependency.pluginConfigId,name:item?.name ?? dependency.pluginConfigId,package:item?.kind==='plugin' ? item.data.package : undefined,
        version:dependency.version,description:item?.kind==='plugin' ? item.data.description : '',localVersion:bundle?.version,state,
        text:`${item?.name ?? dependency.pluginConfigId} @${dependency.version} (local ${bundle?.version ?? 'none'}): ${stateText[state]}${state==='missing' ? `; /teamwork install ${dependency.pluginConfigId}@${dependency.version}` : ''}`};
    });
  };
  const checkPlugins = async (preset: PresetContext) => {
    const missing = (await plugins(preset)).filter(p=>p.state!=='ready');
    if (missing.length) throw new PhoneSessionError('missing_plugins', missing.map(p=>p.text).join('\n'));
  };
  // A stamp that fails to save is retaken on the session's next request; the session itself is unaffected.
  const keep = (write: Promise<void>) => { write.catch(error => ctx.logger.warn('Could not save the team preset version record: %s', (error as Error).message)); };
  const stamp = (agent: Agent, preset: PresetContext) => keep(stamps.set(String(agent.id), preset));
  const detail = (agent: Agent, preset: PresetContext, preview = false) => {
    const snapshot = client.current();
    const team = teamOf(snapshot, preset.id);
    const latest = team?.teamId === preset.teamId ? findConfig(snapshot, preset.id) : undefined;
    const tools = requirements(agent, preset);
    const labels = {available:'registered (running it still needs the host’s permission)',conditional:'conditional, checked when run',missing:'missing',unknown:'cannot be checked'};
    const saved = preview ? null : stamps.get(String(agent.id));
    const revision = latest ? latest.version === preset.version ? 'Up to date' : `Version v${latest.version} is available; a started session needs a new session to use it` : 'This preset is no longer in the team configuration';
    return [`${preset.name} · v${preset.version}`, `Source: team ${team?.teamName ?? preset.teamId} / preset ${preset.id}`, revision,
      latest && snapshot && !inheritsModel(latest) && !modelData(snapshot,latest) ? 'The linked model is no longer available. Ask an admin to link a team model again.' : '',
      latest && snapshot ? modelLimitProblem(snapshot,latest) ?? '' : '',
      saved && !sameRevision(saved,preset) ? `This session recorded v${saved.version}, which differs from the loaded version; inference is blocked. Start a new session.` : '',
      `Session model: ${agent.model.current()?.provider ?? "none"}/${agent.model.current()?.model ?? "none"}`,
      `Preset model: ${preset.inheritModel ? 'the session’s model' : preset.modelConfigId ?? 'legacy own model'} · through the platform; the server always applies its current model policy`,
      `Description: ${preset.description || 'not set'}`, `Instructions: ${preset.instructions || 'not set'}`, `Deliverable: ${preset.outputDescription || 'not set'}`,
      'Prompt: your local prompt, followed by the team text below', preset.systemPrompt || '(no team text)',
      ...tools.map(t=>{ const declared=(team?.configs ?? []).filter(c=>c.kind==='plugin' && c.data.providesTools?.includes(t.name)); return `${t.required?'Required':'Optional'} tool ${t.name}: ${labels[t.state]}${declared.length ? '; declared by team plugin '+declared.map(c=>`${c.name} (/teamwork install ${c.id})`).join(', ') : ''}`; }),
      'Install or enable a missing tool in the local plugin manager; a preset never installs a plugin or grants a permission.',
    ].filter(Boolean).join('\n');
  };
  /** Selects a team model, or a preset's own model, for this session only: under its team's provider. */
  const selectTeamModel = (agent: Agent, id: string) => {
    const team = teamOf(client.current(), id);
    if (team) agent.model.select({ provider: teamProvider(team.teamId), model: id });
  };
  /** The reason a team model or preset id cannot run here (see modelLimitProblem), if any. */
  const limitProblem = (id: string) => { const snapshot = client.current(), item = findConfig(snapshot, id); return snapshot && item ? modelLimitProblem(snapshot, item) : undefined; };
  // Runs inside the host's model-switch compaction check, so a model without its window gets this reason, not that failure.
  ctx.on('agent/request', async ({agent}, next) => {
    const selection = agent.model.current();
    const limit = selection && isTeamProvider(selection.provider) ? limitProblem(selection.model) : undefined;
    if (limit) throw new Error(limit);
    const preset = activePreset(agent);
    if (preset) {
      if(preset.inheritModel && !agent.model.current())throw new Error('Choose a working local model first, or ask an admin to link a team model to the assistant.');
      if (preset.pluginDependencies?.length) await checkPlugins(preset);
      const saved = stamps.get(String(agent.id));
      if (saved && !sameRevision(saved,preset)) throw new Error('The team preset changed version since this session started. Start a new session.');
      const missing = requirements(agent,preset).filter(t=>t.required && ['missing','unknown'].includes(t.state));
      if (missing.length) throw new Error(`Required tools are missing: ${missing.map(t=>t.name).join(', ')}. Install or enable them, then try again.`);
      if (!saved) stamp(agent,preset);
    }
    return next();
  });
  ctx.inject(['tools'], child => registerAssistantTools(child, client, activePreset, () => configSync.sync(), async(id,version)=>{const item=pinnedPlugin(client.current(),id,version);if(!item)throw Error('Plugin version is unavailable');return installPlugin(item);}));
  // The relay admits an account in at least one team; one it refused for being in none rejoins once a sync finds one.
  // Teamwork search (src/web-search.ts) is offered while the signed-in server searches; each sync asks it again.
  const search = teamworkSearch(client);
  // The team knowledge copy (src/knowledge-sync.ts) follows each configuration sync in its flight.
  const knowledge = new KnowledgeSync(client);
  const configSync = new ConfigSync(client, overlay, config.autoSync ?? true, config.syncIntervalMs ?? 60000,
    () => { if (client.current()?.teams.length) relay.rejoin(); void search.refresh(); },
    () => knowledge.sync().catch(error => { ctx.logger.warn('%s', (error as Error).message); }));
  /** Whether DSH offers a local model here, as its own catalogue decides: a provider with no key lists none. */
  const localCallable = async (selection: { provider: string; model: string }) => {
    if (!ctx.llm.listProviders().some(provider => provider.id === selection.provider)) return false;
    try { return (await ctx.llm.listModels(selection.provider)).some(model => model.id === selection.model); } catch { return false; }
  };
  /**
   * A cloud computer (tokenFile) has no local key, so a session with no model, or one it cannot call (DSH's own
   * default among them), answers with the team's first model that can run. Called as a session is made and before a prompt.
   */
  const adoptTeamModel = async (agent: Agent) => {
    if (!config.tokenFile || agent.status !== 'idle') return;
    const current = agent.model.current(), snapshot = client.current();
    if (isTeamProvider(current?.provider) || (current && await localCallable(current)) || !snapshot) return;
    const fallback = allConfigs(snapshot).find(c => c.kind === 'model' && modelData(snapshot, c) && !modelLimitProblem(snapshot, c));
    if (fallback && agent.status === 'idle') selectTeamModel(agent, fallback.id);
  };
  const readiness = async (agent:Agent, fresh=false) => {
    const selection=agent.model.current();
    if(!selection) throw new PhoneSessionError('model_unavailable', 'No model is selected. Choose a local model, or run /teamwork use <id>.');
    if(!isTeamProvider(selection.provider) && !await localCallable(selection)) throw new PhoneSessionError('model_unavailable', 'The session’s model is not available on this computer (it has no key here). Choose another model.');
    if(isTeamProvider(selection.provider)) {
      if(!client.authenticated()) throw new PhoneSessionError('not_authenticated', 'Not signed in to the team model, or the sign-in expired. Run /teamwork login.');
      if(fresh) { try {await configSync.sync();} catch {throw new PhoneSessionError('unavailable', 'Could not verify team access. Check the connection and /teamwork status, and sign in again if needed.');} }
      const snapshot=client.current(), item=findConfig(snapshot, selection.model);
      if(!snapshot || !item || !modelData(snapshot,item)) throw new PhoneSessionError('model_unavailable', 'The team model was removed or its link is broken. Choose an available model; for a changed preset, start a new session.');
      const limit=modelLimitProblem(snapshot,item);
      if(limit) throw new PhoneSessionError('model_unavailable', limit);
    }
    const preset=activePreset(agent);
    if(preset) {
      const saved=stamps.get(String(agent.id));
      if(saved && !sameRevision(saved,preset)) throw new PhoneSessionError('preset_changed', 'The resumed session’s preset version differs. Run /teamwork new <presetId>.');
      if(preset.pluginDependencies?.length) await checkPlugins(preset);
      const missing=requirements(agent,preset).filter(t=>t.required && ['missing','unknown'].includes(t.state));
      if(missing.length) throw new PhoneSessionError('missing_tools', `Required tools are missing: ${missing.map(t=>t.name).join(', ')}; run /teamwork info for install guidance.`);
    }
  };
  const actions=new TaskActions(agent=>readiness(agent,true),agent=>{
    const model=agent.model.current(), usesTeam=isTeamProvider(model?.provider) || !!activePreset(agent);
    return JSON.stringify({live:ctx.agents.get(agent.id)===agent,seq:agent.session.seq,model,preset:stamps.get(String(agent.id)),
      ...(usesTeam ? {team:client.current(),authenticated:client.authenticated(),authRevision:client.sessionRevision()} : {})});
  });
  const pendingInstalls = new Map<string, string>();
  // The phone's way in (dsh-teamwork-premium ADR 0008): open only while signed in, and only to a server that runs a relay.
  // Phones paired with this computer, as the relay last listed them; re-read on connecting and whenever one is paired or revoked.
  let phones: PanelPhone[] = [];
  // A paired phone's calls, replayed against this DSH's own web server through the allow-list; set where DSH serves web.
  let launchUrl: (() => string) | undefined;
  // The owner's PIN lock (src/pin-lock.ts).
  const pins = new PinStore(pinsPath(config.cachePath));
  // The owner's native Web switch (src/web-relay.ts), and what keeps it from working while on.
  const nativeWeb = NativeWebSwitch.beside(config.cachePath);
  const webTunnels = new WebTunnels();
  const nativeWebBlocked = async (): Promise<'pin' | 'web' | undefined> =>
    await pins.enabled() ? 'pin' : launchUrl ? undefined : 'web';
  /**
   * Where a session may be started from a phone or the console: the directory DSH was started in, then DSH's own
   * workspaces. A new device with no session yet has no other way to name one.
   */
  let workspaces: WorkspaceRegistry | undefined;
  ctx.inject(['workspaceRegistry'], (scoped) => {
    scoped.effect(() => {
      workspaces = (scoped as unknown as { workspaceRegistry: WorkspaceRegistry }).workspaceRegistry;
      return () => { workspaces = undefined; };
    });
  });
  const directories = () => startDirectories(process.cwd(), workspaces?.list() ?? []);
  /** DSH's permission presets and its command registry, where it composes them (src/phone-permission.ts). */
  const permissionPresets = () => (ctx as unknown as { get(name: string): unknown }).get('permissionPresets') as PermissionPresets | undefined;
  let commandRegistry: { execute(agent: unknown, line: string, attachments: readonly unknown[], signal: AbortSignal): Promise<{ result: { kind: string } } | undefined> } | undefined;
  /** Each synced team's default workspace here (src/team-workspaces.ts), where a phone or the console starts a session. */
  const teamWorkspaces = new TeamWorkspaces(teamWorkspacesPath(config.cachePath));
  /**
   * Where a team that has not chosen lands: DSH's own first-use workspace, which DSH recognises by this title
   * (`DEFAULT_WORKSPACE_DIRECTORY`, @deepseek-ai/dsh-api-workspace-controller), else DSH's first workspace, else the
   * directory DSH started in. A workspace lists its sessions under it; the start directory leaves them Ungrouped.
   */
  const fallbackDirectory = () => {
    const list = workspaces?.list() ?? [];
    return (list.find(workspace => workspace.title === 'default-workspace') ?? list[0])?.path ?? directories()[0];
  };
  const teamDirectories = () => teamWorkspaces.defaults((client.current()?.teams ?? []).map(team => team.teamId), directories(), fallbackDirectory());
  const bridge = new Bridge({
    launchUrl: () => launchUrl?.(),
    // A registry that has not opened yet has no sets to read: the list goes unmarked, as from an older DSH.
    marks: () => {
      try {
        return workspaces && {
          pinned: workspaces.pinnedSessionIds,
          archived: workspaces.archivedSessionIds,
          workspaces: workspaces.list(),
        };
      } catch { return undefined; }
    },
    workspaceAt: (path) => workspaces?.list().find(workspace => workspace.path === path)?.id,
    send: (frame) => security.send(frame),
    log: (message, error) => ctx.logger.warn('%s: %s', message, (error as Error | undefined)?.message ?? ''),
    session: {
      async configuration(sessionId) {
        const agent = sessionAgent(sessionId);
        if (sessionId && !agent) throw new PhoneSessionError('busy');
        const state = await panel.state(sessionId);
        const roster = await ctx.agentPresets.remoteExportList();
        const presets = permissionPresets();
        const imageModels = (await Promise.all(ctx.llm.listProviders().map(async ({ id }) => {
          const models = await ctx.llm.listModels(id).catch(() => []);
          return models.filter(model => model.inputModalities?.includes('image'))
            .map(model => ({ provider: id, model: model.id }));
        }))).flat();
        return { presets: phonePresets(state, [...roster.presets]), directories: directories(), teamDirectories: await teamDirectories(), imageModels,
          // A session's permission preset and those a remote device may pick; none where DSH composes no presets.
          permissions: presets ? phonePermissions(presets, agent?.session) : null,
          // A session's files can be browsed, read only (src/phone-files.ts).
          files: true,
          current: agent ? {
          sessionId: String(agent.id), cwd: agent.session.header.cwd,
          agentPreset: ctx.agentPresets.presetForSession(agent.session), model: agent.model.current() ?? null,
          started: state.session?.started ?? false, running: agent.status !== 'idle',
        } : null };
      },
      async selectModel(request) {
        const agent = sessionAgent(request.sessionId);
        if (!agent) throw new PhoneSessionError('not_found');
        if (agent.status !== 'idle' || agent.inbox.nextTurn.length || agent.inbox.nextStep.length) throw new PhoneSessionError('busy');
        const selection = { provider: request.provider, model: request.model, ...(request.reasoningEffort ? { reasoningEffort: ReasoningEffortId(request.reasoningEffort) } : {}) };
        try {
          const model = (await ctx.llm.listModels(selection.provider)).find(model => model.id === selection.model);
          if (!model) throw new Error('Unavailable model');
          await ctx.llm.resolveCallConfig(selection);
          if (agent.status !== 'idle' || agent.inbox.nextTurn.length || agent.inbox.nextStep.length) throw new PhoneSessionError('busy');
          agent.model.select(selection);
          return { selected: agent.model.current() };
        } catch (error) { if (error instanceof PhoneSessionError) throw error; throw new PhoneSessionError('model_unavailable'); }
      },
      async selectPermission(request) {
        const agent = sessionAgent(request.sessionId);
        if (!agent) throw new PhoneSessionError('not_found');
        if (agent.status !== 'idle' || agent.inbox.nextTurn.length || agent.inbox.nextStep.length) throw new PhoneSessionError('busy');
        const presets = permissionPresets();
        if (!presets || !commandRegistry) throw new PhoneSessionError('unavailable');
        if (!phonePermissions(presets).options.some(item => item.id === request.preset)) throw new PhoneSessionError('invalid_request');
        // The way DSH's own picker switches it: its `/permission` command, logged in the session like any other.
        const run = await commandRegistry.execute(agent, `/permission ${request.preset}`, [], AbortSignal.timeout(10_000));
        if (!run || run.result.kind !== 'success') throw new PhoneSessionError('unavailable');
        return { current: presets.current(agent.session) };
      },
      workspaceChanges() {
        const candidate: unknown = ctx.get('workspaceChanges');
        if (candidate && typeof candidate === 'object' && 'summary' in candidate && typeof candidate.summary === 'function'
          && 'diff' in candidate && typeof candidate.diff === 'function') {
          return candidate as WorkspaceChanges;
        }
        return undefined;
      },
      officeKit() {
        const candidate: unknown = ctx.get('officeKit');
        if (candidate && typeof candidate === 'object' && 'convert' in candidate && typeof candidate.convert === 'function') {
          return candidate as PreviewOfficeKit;
        }
        return undefined;
      },
      async fileRoot(sessionId) {
        const agent = sessionAgent(sessionId);
        const cwd = agent?.session.header.cwd;
        if (!cwd) throw new PhoneSessionError('not_found');
        return cwd;
      },
      accepted(sessionId, requestId) {
        const agent = sessionAgent(sessionId);
        if (!agent) return false;
        const matches = (source: unknown) => typeof source === 'object' && source !== null && 'kind' in source && source.kind === 'user' && 'rpcId' in source && source.rpcId === requestId;
        return [...agent.inbox.nextTurn, ...agent.inbox.nextStep].some(message => matches(message.source)) || agent.session.snapshotEvents().some(event => event.type === 'user/message' && matches(event.data.source));
      },
      async checkImages(sessionId) {
        const selection = sessionAgent(sessionId)?.model.current();
        if (selection) {
          const models = await ctx.llm.listModels(selection.provider).catch(() => []);
          if (models.some(model => model.id === selection.model && model.inputModalities?.includes('image'))) return;
        }
        throw new PhoneSessionError('image_model_unsupported');
      },
      async check(sessionId) {
        const agent = sessionAgent(sessionId);
        if (!agent) throw new PhoneSessionError('not_found');
        if (agent.status !== 'idle' || agent.inbox.nextTurn.length || agent.inbox.nextStep.length) throw new PhoneSessionError('busy');
        await adoptTeamModel(agent);
        await readiness(agent, true);
      },
    },
  });
  let keyScope: { revision: number; value: Promise<string> } | undefined;
  const phoneKeys = new PhoneKeys(config.cachePath.replace(/\.json$/, '') + '.phone-keys.json');
  ctx.inject(['skills'], registerBundledSkills);
  ctx.inject(['web'], child => search.attach(child));
  // Artifacts an agent publishes (src/artifact-tool.ts), for the signed-in member.
  ctx.inject(['tools'], child => registerArtifactTool(child, { client, preset: activePreset }));
  // Team knowledge: every session is told where the copy is while it holds a document, and proposes changes with the tool.
  ctx.inject(['tools'], child => registerKnowledgeTool(child, { client, knowledge }));
  ctx.inject(['systemPrompt'], child => child.effect(() => child.systemPrompt.section({
    name: 'teamwork:knowledge', order: 95, text: () => knowledge.count() ? knowledgeGuide(knowledge.root) : '', interpolate: false,
  })));
  const security = new PhoneSecurity({
    keys: phoneKeys,
    scope: () => {
      const revision = client.sessionRevision();
      if (!keyScope || keyScope.revision !== revision) {
        const value = client.profile().then(profile => `${client.endpoint}|${profile.id}`);
        keyScope = { revision, value };
        void value.catch(() => { if (keyScope?.value === value) keyScope = undefined; });
      }
      return keyScope.value;
    },
    send: frame => relay.send(frame), forward: frame => bridge.handle(frame),
    confirm: async id => { await relay.request({ t: 'decide', pairingId: id, accept: true }); },
    changed: () => {},
    error: error => ctx.logger.warn('phone security: %s', error.message),
    pins,
    pinRequired: () => pins.enabled(),
  });
  const relay: RelayLink = new RelayLink({
    endpoint: () => client.endpoint,
    // A token from tokenFile belongs to a cloud computer, which the server reaches directly; it never opens the relay.
    token: () => !config.tokenFile && client.authenticated() ? client.platformCredential() : undefined,
    clientIdPath: relayClientIdPath(config.cachePath),
    webAvailable: async () => !config.tokenFile && await nativeWeb.on() && !await nativeWebBlocked(),
    onWebDial: (url, id, signal) => {
      void (async () => {
        const launch = launchUrl?.();
        if (launch && await nativeWeb.on() && !await pins.enabled()) await connectWebRelay(launch, url, id, signal, webTunnels);
      })().catch(() => ctx.logger.debug('desktop web relay connection failed'));
    },
    onStatus: (status) => {
      ctx.logger.debug('relay: %s', status);
      if (status === 'connected') void readPhones();
      // Reconnecting, the devices last listed stay for the panel to show, dimmed; off or refused (a sign-out among
      // them), the list goes with the account it belonged to.
      else { if (status !== 'connecting') phones = []; security.reset(); bridge.dropAll(); }
    },
    onEvent: () => void readPhones(),
    onForward: (frame) => void security.handle(frame),
  });
  const readPhones = async () => {
    try {
      phones = pairingSchema.array().parse(await relay.request({ t: 'pairings' }));
      await security.reconcile(phones.map((phone) => phone.id));
    } catch (error) { ctx.logger.warn('Could not read the paired phones: %s', (error as Error).message); }
  };
  const phoneError = (error: unknown): never => {
    if (error instanceof RelayError && error.code === 'not_found') throw new Error(say('phone.notFound'));
    throw new Error(say(relay.status === 'connected' ? 'phone.relayBusy' : 'phone.relayOff'));
  };
  ctx.effect(() => () => relay.stop());
  // The phone's notifications (the server's docs/tech/relay.md, "Push notifications"): when an agent waits on its member,
  // tell the relay which session, and hand on to the answerers untouched. Prepended, so it is told even when one claims the request.
  const reportWaiting = (kind: 'question' | 'approval') => function (this: unknown, request: { agent?: { id?: unknown } } | undefined, next: () => unknown) {
    const agent = request?.agent ?? (this as { id?: unknown } | undefined);
    if (agent?.id !== undefined) relay.send({ t: 'waiting' });
    return next();
  };
  const listen = ctx.on.bind(ctx) as unknown as (name: string, listener: (...args: any[]) => unknown, prepend: boolean) => () => boolean;
  listen('user-questions/request', reportWaiting('question'), true);
  listen('approval/request', reportWaiting('approval'), true);
  // The loopback listener of the sign-in in progress, if any (src/login-callback.ts).
  let callback: LoginCallback | undefined;
  const stopCallback = () => { callback?.close(); callback = undefined; };
  ctx.effect(() => () => stopCallback());
  const hostManaged = () => {
    if (config.tokenFile) throw new Error(say('auth.hostManaged'));
  };
  const authorize = async (code: string) => { hostManaged(); pendingInstalls.clear(); try { await client.completeLogin(code); } finally { await overlay.apply(client.current()); relay.refresh(); } stopCallback(); if (config.autoSync !== false) await configSync.sync(); };
  /** The sign-in page's address, and whether the code comes back by itself; without a listener it is pasted. */
  const beginLogin = async (manual = false) => {
    hostManaged();
    stopCallback();
    if (!manual) callback = await listenForCode(authorize).catch((error: Error) => { ctx.logger.warn('Cannot receive the authorization code on this machine; it has to be pasted: %s', error.message); return undefined; });
    return { url: client.beginLogin(callback?.uri), automatic: callback !== undefined };
  };
  const restore = async () => { await client.restore(); await knowledge.restore(); await overlay.apply(client.current()); relay.refresh(); };
  const logout = async () => { hostManaged(); pendingInstalls.clear(); stopCallback(); try { await client.logout(); } finally { setLocale(null); await nativeWeb.set(false); await overlay.apply(); relay.refresh(); } };
  ctx.provide('dshTeamwork', {
    beginLogin, completeLogin: authorize,
    sync: () => configSync.sync(),
    status: () => configSync.status(),
    reload: restore,
    list: () => client.current(),
    logout,
  });
  // Selecting a team preset chooses a model for that session only, never the local default.
  ctx.on('agent-preset/selected', (sessionId) => {
    const agent = ctx.agents.get(sessionId);
    if (!agent) return;
    const active = activePreset(agent);
    if (active) {
      if (!active.inheritModel) selectTeamModel(agent, active.id);
      if (!sameRevision(stamps.get(String(agent.id)),active)) stamp(agent,active);
    } else keep(stamps.clear(String(agent.id)));
  });
  ctx.on('agent/created', ({ agent, source }) => {
    const snapshot = client.current();
    const selected = ctx.agentPresets.presetForSession(agent.session);
    const item = snapshot?.teams.flatMap(team => team.configs.filter(c => `team:${team.teamId}:${c.id}` === selected))[0];
    const preset = activePreset(agent);
    if (preset && !stamps.get(String(agent.id))) stamp(agent,preset);
    if (source !== 'resume' && item?.kind === 'preset' && !inheritsModel(item)) selectTeamModel(agent, item.id);
    adoptTeamModel(agent).catch(error => ctx.logger.warn('Could not choose a team model: %s', (error as Error).message));
    return undefined;
  });
  ctx.effect(() => async () => { await configSync.stop(); await overlay.apply(); });
  /** `/teamwork use` and the panel's "use": a team model, or a preset before the session's first turn. */
  const useConfig = async (agent: Agent, id: string) => {
    const snapshot = client.current();
    const item = findConfig(snapshot, id), team = teamOf(snapshot, id);
    if (!item || !team || item.kind === 'plugin') throw new Error(say('use.pick'));
    if (!inheritsModel(item) && !modelData(snapshot!,item)) throw new Error(say('use.modelGone'));
    const limit = modelLimitProblem(snapshot!, item);
    if (limit) throw new Error(limit);
    if (item.kind === 'preset') {
      assertBlank(ctx.agents.turnBoundaryOf(agent.session));
      if (item.data.pluginDependencies?.length) await checkPlugins({teamId:team.teamId,pluginDependencies:item.data.pluginDependencies} as PresetContext);
      const candidate = {requiredTools:item.data.requiredTools ?? [],optionalTools:item.data.optionalTools ?? []};
      const unavailable = requirements(agent, candidate as PresetContext).filter(t=>t.required && ['missing','unknown'].includes(t.state));
      if (unavailable.length) throw new Error(say('use.missingTools', { tools: unavailable.map(t=>t.name).join(', ') }));
      await ctx.agentPresets.select(agent, `team:${team.teamId}:${item.id}`);
      const active = activePreset(agent); if (active && !sameRevision(stamps.get(String(agent.id)),active)) stamp(agent,active);
    }
    if (!inheritsModel(item)) selectTeamModel(agent, item.id);
    return { preset: item.kind === 'preset', text: say('use.done', { name: item.name }) };
  };
  /** Installs a pinned plugin disabled, enables it only when it adds configuration and overrides nothing. Callers confirm first. */
  const installPlugin = async (item: Extract<TeamConfig, { kind: 'plugin' }>, agent?: Agent) => {
    const spec = `${item.data.package}@${item.data.version}`;
    const epoch=client.sessionRevision(),signature=JSON.stringify(item);
    const manager = ctx.get('pluginManager');
    if (!manager) throw new Error(say('install.noManager'));
    const existing = (await manager.listBundles()).find(bundle => bundle.name === item.data.package);
    if (existing && (existing.installed || existing.enabled || existing.availability === 'installation')) throw new Error(say('install.exists'));
    const teamId=teamOf(client.current(),item.id)?.teamId;
    const target=item.data.packageId ? await client.downloadPackage(teamId!,item.data.packageId,item.data.sha256!) : spec;
    if(epoch!==client.sessionRevision() || JSON.stringify(pinnedPlugin(client.current(),item.id,item.data.version))!==signature)throw new Error(say('install.changed'));
    const installed = await manager.installBundle(target, { saveExact: true, enabled: false });
    if (installed.error || ['failed', 'cancelled', 'overridden'].includes(installed.application)) throw new Error(say('install.incomplete', { reason: installed.error?.code ?? installed.application }));
    const bundle = (await manager.listBundles()).find(bundle => bundle.name === item.data.package);
    if (!bundle || bundle.error || bundle.version !== item.data.version || bundle.overrides.length || bundle.rows.some(row => row.entryId !== undefined)) {
      throw new Error(say('install.notEnabled'));
    }
    const result = await manager.setBundleEnabled(item.data.package, true);
    if (result.error || ['failed', 'cancelled', 'overridden'].includes(result.application)) throw new Error(result.error?.code ?? result.application);
    if (result.application === 'restart-required') restartRequired.add(spec);
    const refreshed = (await plugins()).find(p=>p.id===item.id);
    const currentPreset = agent && activePreset(agent);
    const missingTools = agent && currentPreset ? requirements(agent,currentPreset).filter(t=>t.required && ['missing','unknown'].includes(t.state)) : [];
    const toolSummary = currentPreset ? `Required tools of the current preset: ${missingTools.length ? missingTools.map(t=>t.name).join(', ') + ' not available yet' : 'all registered (running them still needs the host’s permission)'}` : '';
    return [say(result.application === 'restart-required' ? 'install.restart' : 'install.done'), refreshed?.text ?? '', toolSummary].filter(Boolean).join('\n');
  };
  const sessionAgent = (sessionId: string | undefined) => sessionId ? ctx.agents.get(sessionId as SessionId) : undefined;
  const panel: PanelOps = {
    summary: teamId => client.summary(teamId),
    teamUsage: teamId => client.teamUsage(teamId),
    async catalog(teamId) {
      const synced = new Set(client.current()?.teams.find(t => t.teamId === teamId)?.configs.map(c => c.id) ?? []);
      const { configs, choices, members } = await client.catalog(teamId);
      const text = (value: unknown) => (typeof value === 'string' ? value : '');
      return configs
        .filter(c => (c.kind === 'preset' || c.kind === 'plugin') && !c.builtin && !synced.has(c.id))
        .map((c): PanelCatalogItem => {
          const member = c.assetOwnerId ? members.find(m => m.userId === c.assetOwnerId) : undefined;
          return {
            id: c.id, kind: c.kind as PanelCatalogItem['kind'], name: c.name,
            description: text(c.data.description) || (c.kind === 'plugin' ? `${text(c.data.package)}@${text(c.data.version)}` : ''),
            ...(text(c.data.avatar) ? { avatar: text(c.data.avatar) } : {}),
            author: c.assetOwnerId ? member?.name || member?.email || '' : '',
            users: choices.users[c.id] ?? 0,
            recommended: !c.assetOwnerId || (choices.defaults[c.id]?.version ?? 0) > 0,
          };
        })
        .sort((a, b) => b.users - a.users || a.name.localeCompare(b.name));
    },
    async here(teamId, id, on) {
      await client.setHere(teamId, id, on);
      await configSync.sync();
    },
    // The panel reads the profile as it opens, so the host speaks the account's language from then on.
    profile: async () => { const profile = await client.profile(); setLocale(profile.locale); return profile; },
    updateProfile: async (input) => { const profile = await client.updateProfile(input); setLocale(profile.locale); return profile; },
    async state(sessionId) {
      const status = configSync.status(), snapshot = client.current(), agent = sessionAgent(sessionId);
      // Inventory scans read the whole host. Share one within this response, never across requests.
      let inventory: ReturnType<typeof readPluginInventory> | undefined;
      const readInventory = () => inventory ??= readPluginInventory();
      const presets: PanelPreset[] = [];
      for (const team of snapshot?.teams ?? []) for (const item of team.configs) {
        if (item.kind !== 'preset') continue;
        const linked = item.data.modelConfigId ? team.configs.find(c => c.id === item.data.modelConfigId) : undefined;
        const candidate = {requiredTools:item.data.requiredTools ?? [],optionalTools:item.data.optionalTools ?? []} as PresetContext;
        presets.push({
          id: item.id, teamId: team.teamId, teamName: team.teamName, name: item.name, version: item.version, ...(item.data.avatar ? { avatar: item.data.avatar } : {}), description: item.data.description ?? '',
          model: item.data.inheritModel ? null : item.data.modelConfigId ? linked?.name ?? item.data.modelConfigId : `${item.data.provider}/${item.data.model}`,
          assistant: item.builtin === 'team-assistant',
          modelAvailable: inheritsModel(item) || !!modelData(snapshot!, item) && !unsizedModel(snapshot!, item) && !offlineModel(snapshot!, item),
          contextWindowMissing: !!unsizedModel(snapshot!, item),
          modelOffline: !!offlineModel(snapshot!, item),
          tools: agent ? requirements(agent, candidate) : toolReport(candidate, () => 'unknown'),
          plugins: item.data.pluginDependencies?.length ? await plugins({teamId:team.teamId,pluginDependencies:item.data.pluginDependencies} as PresetContext, readInventory) : [],
        });
      }
      const selection = agent?.model.current(), active = agent && activePreset(agent), boundary = agent && ctx.agents.turnBoundaryOf(agent.session);
      const defaults = await teamDirectories();
      return {
        locale: panelLocale(),
        authRevision: client.sessionRevision(),
        authenticated: status.authenticated,
        teams: (snapshot?.teams ?? []).map(team => ({ id: team.teamId, name: team.teamName, role: team.role, consoleUrl: `${client.endpoint}/teams/${team.teamId}`, workspace: defaults[team.teamId] ?? null })),
        server: client.endpoint,
        defaultServer: serverAddress(config.apiEndpoint),
        sync: { auto: status.autoSync, running: status.syncing, lastSuccess: status.lastSuccess, lastError: status.lastError },
        relay: relay.status,
        ownerPinEnabled: config.tokenFile ? undefined : await pins.enabled(),
        nativeWeb: config.tokenFile ? undefined : { enabled: await nativeWeb.on(), blocked: await nativeWebBlocked(), active: webTunnels.state },
        phones: await Promise.all(phones.map(async phone => ({ ...phone, ...await security.details(phone.id) }))),
        session: agent ? {
          id: String(agent.id),
          model: selection ? { provider: selection.provider, model: selection.model, team: isTeamProvider(selection.provider) } : null,
          preset: active ? { id: active.id, name: active.name, version: active.version } : null,
          started: boundary!.openTurnStartSeq !== null || boundary!.lastTurn > 0,
        } : null,
        presets: presets.sort((a,b) => Number(b.assistant) - Number(a.assistant)),
        models: (snapshot?.teams ?? []).flatMap(team => team.configs.flatMap(c => c.kind === 'model'
          ? [{
            id: c.id, teamId: team.teamId, teamName: team.teamName, name: c.name, version: c.version,
            model: c.data.model,
            contextWindow: c.data.contextWindow, maxTokens: c.data.maxTokens, vision: c.data.vision,
            contextWindowMissing: !!unsizedModel(snapshot!, c), modelOffline: !!offlineModel(snapshot!, c),
          }] : [])),
        plugins: (await plugins(undefined, readInventory)).map(plugin => {
          const team = teamOf(snapshot, plugin.id);
          return { ...plugin, teamId: team?.teamId, teamName: team?.teamName };
        }),
      };
    },
    async setWorkspace(teamId, path) {
      if (!client.current()?.teams.some(team => team.teamId === teamId)) throw new Error(say('workspace.unknownTeam'));
      if (!directories().includes(path)) throw new Error(say('workspace.unknownDirectory'));
      await teamWorkspaces.set(teamId, path);
    },
    login: beginLogin,
    authorize: (code) => authorize(code),
    sync: () => configSync.sync(),
    logout,
    async setServer(server) {
      hostManaged();
      const next = server === null ? serverAddress(config.apiEndpoint) : serverAddress(server);
      pendingInstalls.clear();
      try {
        await client.setEndpoint(next);
        await serverChoice.write(next === serverAddress(config.apiEndpoint) ? undefined : next);
      } finally { setLocale(null); await nativeWeb.set(false); await overlay.apply(client.current()); relay.refresh(); }
    },
    async setNativeWeb(on) {
      if (config.tokenFile) throw new Error('Personal desktop DSH only.');
      const blocked = on ? await nativeWebBlocked() : undefined;
      if (blocked) throw new Error(say(blocked === 'pin' ? 'nativeWeb.pin' : 'nativeWeb.noWeb'));
      await nativeWeb.set(on);
      // Advertise it, or withdraw it and close what the platform has open.
      relay.refresh();
    },
    async disconnectNativeWeb() {
      if (config.tokenFile) throw new Error('Personal desktop DSH only.');
      // Our side first, so nothing keeps moving whether or not the server hears it.
      webTunnels.endAll();
      await relay.request({ t: 'webRevoke' }).catch(phoneError);
    },
    async setOwnerPin(pin) {
      if (config.tokenFile) throw new Error('Personal desktop DSH only.');
      if (pin === null) await pins.clear();
      else await pins.set(pin);
      security.reset();
      bridge.dropAll();
      // Re-advertise native Web and close its existing connections after a PIN change.
      relay.refresh();
    },
    async pairPhone() {
      const offer = offerSchema.parse(await relay.request({ t: 'offer' }).catch(phoneError));
      security.offerCode(offer.expiresAt);
      const key = await security.publicKey();
      const link = `dshteamwork://pair?${new URLSearchParams({ server: client.endpoint, code: offer.code, key })}`;
      return { ...offer, link };
    },
    async decidePhone(id, accept, safetyCode) {
      if (accept) await security.approve(id, safetyCode);
      else { await security.revoke(id); await relay.request({ t: 'decide', pairingId: id, accept: false }).catch(phoneError); }
      await readPhones();
    },
    async revokePhone(id) {
      await security.revoke(id);
      await relay.request({ t: 'revoke', pairingId: id }).catch(phoneError);
      await readPhones();
    },
    async use(sessionId, id) {
      const agent = sessionAgent(sessionId);
      if (!agent) throw new Error(say('use.notLoaded'));
      return (await useConfig(agent, id)).text;
    },
    async install(id, version) {
      const item = pinnedPlugin(client.current(), id,version);
      if (!item || item.kind !== 'plugin') throw new Error(say('install.pick'));
      // The member confirmed this exact version; a sync since then may have changed the pin.
      if (item.data.version !== version) throw new Error(say('install.pinChanged'));
      return installPlugin(item);
    },
  };
  const routes = panelRoutes(panel, { say, speak: answer => speaking(panelLocale(), answer) });
  // The panel's routes exist only where a browser reaches the host (DSH web and desktop), like the panel itself.
  ctx.inject(['connection'], (scoped) => {
    const { connection } = scoped as unknown as { connection: { fetch: { register(route: FetchRoute): () => Promise<void> } } };
    // A cloud computer's server makes a phone's calls here instead of through the relay (src/bridge.ts).
    for (const route of config.tokenFile ? [...routes, bridgeRoute(bridge)] : routes) scoped.effect(() => { const dispose = connection.fetch.register(route); return () => { void dispose(); }; });
  });
  // The host's own MCP servers (a cloud computer's browser, over CDP), registered with DSH's MCP manager for as long as
  // this plugin runs; the owner's own servers in Settings are left as they are. Only a host that provides the token
  // provides them.
  if (config.tokenFile && Object.keys(config.mcpServers ?? {}).length) {
    ctx.inject(['mcpManager'], (scoped) => {
      const { mcpManager } = scoped as unknown as { mcpManager: { register(name: string, entry: { transport: 'stdio'; command: string; args: string[] }): void } };
      for (const [name, server] of Object.entries(config.mcpServers ?? {})) {
        try { mcpManager.register(name, { transport: 'stdio', command: server.command, args: server.args }); }
        catch (error) { ctx.logger.warn('The host MCP server %s could not be registered: %s', name, (error as Error).message); }
      }
    });
  }
  ctx.inject(['connection', 'webServer'], (scoped) => {
    const { connection, webServer } = scoped as unknown as { connection: { authenticatedUrl(base: string): string }; webServer: { getOrigin(): string } };
    scoped.effect(() => {
      launchUrl = () => connection.authenticatedUrl(webServer.getOrigin());
      void nativeWeb.on().then(on => { if (on && relay.status === 'connected') relay.refresh(); });
      return () => { launchUrl = undefined; bridge.dropAll(); void nativeWeb.on().then(on => { if (on) relay.refresh(); }); };
    });
  });
  ctx.inject(['commands'], (child) => {
    child.effect(() => {
      commandRegistry = child.commands as unknown as typeof commandRegistry;
      return () => { commandRegistry = undefined; };
    });
    child.effect(() => child.commands.register({
      name: 'teamwork', description: 'Team sign-in, configuration sync and model selection',
      input: { hint: 'login | authorize <code> | pin reset | sync | status | session [check] | continue <instruction> | cancel | retry [confirm] | list | tools | plugins [presetId] | info [id] | new <id> | use <id> | install <id> confirm | logout' },
      handler: async ({ agent, rawInput }) => {
        const [action, requestedId, confirmation] = rawInput.trim().split(/\s+/);
        const [id,pinVersion]=requestedId?.split('@') ?? [];
        try {
          if (action === 'session') {
            let ready='Local checks passed; team access is verified again before continuing.';
            try { await readiness(agent,id==='check'); if(id==='check') ready='Checks passed; the server still verifies access on the real request.'; } catch(error) {ready=(error as Error).message;}
            const task=taskState.stateOf(agent.session),preset=activePreset(agent),selection=agent.model.current();
            return {kind:'success',text:[`Session: ${agent.id}`,`Status: ${agent.status==='running'?'running':'idle'} · last task: ${outcomeText(task.outcome)}`,`Task: ${task.task || (task.outcome === 'not-started' ? 'no task started yet' : 'non-text task (see the session history)')}`,`Pending input: ${agent.inbox.nextTurn.length} follow-up / ${agent.inbox.nextStep.length} steering`,`Model: ${selection?.provider ?? 'none'}/${selection?.model ?? 'none'}`,`Preset: ${preset ? preset.name+' v'+preset.version : 'local or no team preset'}`,`Recovery check: ${ready}`,recoveryHint(task.failureCode,task.outcome)].join('\n')};
          }
          if (action === 'cancel') { actions.cancel(agent); return {kind:'success',text:'Cancellation requested; run /teamwork session to see whether it stopped. History, finished changes and pending input stay; nothing is rolled back.'}; }
          if (action === 'continue') { await actions.submit(agent,rawInput.trim().slice('continue'.length).trim()); return {kind:'success',text:'The follow-up was handed to DSH; run /teamwork session to see its status.'}; }
          if (action === 'retry') {
            if(id!=='confirm') {actions.review(agent,taskState.stateOf(agent.session).outcome); return {kind:'success',text:'Retrying sends a follow-up asking the agent to check what is done and finish the task, which may still make new changes. It never replays the original tool calls or rolls files back. To confirm, run /teamwork retry confirm (valid for two minutes; confirm again after the session or configuration changes).'};}
            await actions.submit(agent,retryInstruction,true); return {kind:'success',text:'Recovery instruction sent; no original tool call was replayed.'};
          }
          if (action === 'login') {
            const { url, automatic } = await beginLogin();
            return { kind: 'success', text: automatic
              ? `Sign in and authorize in the browser: ${url}\nThis finishes by itself once you confirm. If it does not, paste the line shown on the page here and run it.`
              : `Sign in and authorize in the browser: ${url}\nThen paste the line shown on the page here and run it (/teamwork authorize <code>).` };
          }
          if (action === 'authorize') { await authorize(id ?? ''); return { kind: 'success', text: 'Authorized. Run /teamwork status to see the sync status.' }; }
          if (action === 'sync') {
            await configSync.sync();
            const synced = client.current(), problems = [...new Set(allConfigs(synced).filter(c => c.kind === 'model').flatMap(c => modelLimitProblem(synced!, c) ?? []))];
            return { kind: 'success', text: ['Team configuration synced; your local configuration is unchanged.', ...problems].join('\n') };
          }
          if (action === 'pin' && requestedId === 'reset') {
            if (!await pins.enabled()) return { kind: 'success', text: 'Personal desktop PIN is off.' };
            await pins.resetPin();
            security.reset();
            bridge.dropAll();
            relay.refresh();
            return { kind: 'success', text: 'Your phone PIN and its lock are cleared; set a new PIN in the Teamwork panel or with dsh-teamwork pin set.' };
          }
          if (action === 'logout') { await logout(); return { kind: 'success', text: 'Signed out, and the team configuration removed.' }; }
          if (action === 'status') { const status = configSync.status(); return { kind: 'success', text: [`Signed in: ${status.authenticated ? 'yes' : 'no (a cache is not a valid sign-in)'}`, `Auto sync: ${status.autoSync ? 'on' : 'off'}`, `Teams: ${status.teams.length ? status.teams.join(', ') : 'none'} · configurations: ${status.configCount}`, `Last successful sync: ${status.lastSuccess ?? 'not since this start'}`, status.syncing ? 'Syncing' : '', status.lastError ?? ''].filter(Boolean).join('\n') }; }
          const snapshot = client.current();
          const item = id ? action==='install' && pinVersion ? pinnedPlugin(snapshot,id,pinVersion) : findConfig(snapshot, id) : undefined, team = id ? teamOf(snapshot, id) : undefined;
          if (action === 'tools') {
            const tools = child.get('tools');
            if (!tools) throw new Error('The host offers no tool check service');
            const rows = tools.definitions(agent).map(tool=>{
              const declared = (snapshot?.teams ?? []).flatMap(t => t.configs.filter(c=>c.kind==='plugin' && c.data.providesTools?.includes(tool.name)).map(c => `${c.name} (${t.teamName})`));
              return `${tool.name} · ${tools.executable(tool.name,agent) ? 'registered; running it still needs a permission check' : 'conditional'} · ${declared.length ? 'declared by team plugin '+declared.join(', ') : 'source: the host gives no owner'}`;
            });
            return {kind:'success',text:['Tools visible to this session (a declared source is not a verified runtime owner):',...rows,rows.length?'':'No tools visible'].filter(Boolean).join('\n')};
          }
          if (action === 'plugins') {
            if (id && item?.kind !== 'preset') throw new Error('Choose a team preset ID');
            const preset = item?.kind==='preset' ? {teamId:team!.teamId,pluginDependencies:item.data.pluginDependencies} as PresetContext : undefined;
            return {kind:'success',text:(await plugins(preset)).map(p=>p.text).join('\n') || 'No plugin dependencies.'};
          }
          if (action === 'info') {
            if (!id) { const active = activePreset(agent); return {kind:'success',text:active ? detail(agent,active) + '\n' + (await plugins(active)).map(p=>p.text).join('\n') : 'This session has no team preset. Run /teamwork info <presetId> for details.'}; }
            if (!item || item.kind !== 'preset') throw new Error('Choose a team preset ID');
            const info: PresetContext = {teamId:team!.teamId,id:item.id,name:item.name,version:item.version,description:'',instructions:'',outputDescription:'',requiredTools:[],optionalTools:[],...item.data};
            return {kind:'success',text:detail(agent,info,true) + '\n' + (await plugins(info)).map(p=>p.text).join('\n') + '\nTools are checked for the current session, again after switching and before every request.'};
          }
          if (action === 'new') {
            if (!item || item.kind !== 'preset') throw new Error('Choose a team preset ID');
            if (!inheritsModel(item) && !modelData(snapshot!,item)) throw new Error(say('use.modelGone'));
            const limit = modelLimitProblem(snapshot!, item);
            if (limit) throw new Error(limit);
            const sessionId = `team-${crypto.randomUUID()}` as SessionId;
            const agentPreset = `team:${team!.teamId}:${item.id}`;
            await child.agents.create({sessionId, meta:{cwd:agent.session.header.cwd,agentPreset}, setup:async agentCtx=>{await child.agentPresets.mount(agentCtx,agentPreset);}, ...(inheritsModel(item) && agent.model.current() ? {agentOptions:agent.model.current()} : {})});
            return {kind:'success',text:`Created session ${sessionId} with ${item.name} v${item.version}. Open it from the session list; the original session and its history are unchanged.`};
          }
          if (action === 'use') {
            const chosen = await useConfig(agent, id ?? '');
            return { kind: 'success', text: chosen.text + (chosen.preset ? ' Run /teamwork info for its version and tool status.' : '') };
          }
          if (action === 'install') {
            if (!item || item.kind !== 'plugin') throw new Error(say('install.pick'));
            const spec = `${item.data.package}@${item.data.version}`;
            if (confirmation !== 'confirm') {
              pendingInstalls.set(String(agent.id), `${client.sessionRevision()}:${JSON.stringify(item)}`);
              return { kind: 'success', text: `Installing and enabling ${spec} runs that plugin’s code. To confirm, run /teamwork install ${item.id} confirm` };
            }
            if (pendingInstalls.get(String(agent.id)) !== `${client.sessionRevision()}:${JSON.stringify(item)}`) throw new Error('Read the install note for the current plugin version first, then confirm the install');
            pendingInstalls.delete(String(agent.id));
            return { kind: 'success', text: await installPlugin(item, agent) + '\nRun /teamwork plugins or /teamwork info to check dependencies and tools again.' };
          }
          return { kind: 'success', text: snapshot ? snapshot.teams.flatMap(t => t.configs.map(c => `${c.id} · ${c.kind} · ${c.name} · v${c.version} · ${t.teamName}`)).join('\n') || 'No team configuration' : 'Not synced yet. Run /teamwork login to start.' };
        } catch (error) { return { kind: 'error', text: (error as Error).message }; }
      },
    }));
  });
  try { await restore(); } catch { ctx.logger.warn('The team cache could not be restored; sign in and sync again.'); }
  // A sign-in kept from the last run syncs now rather than at the first interval; offline, the cache stands meanwhile.
  if (!config.tokenFile && client.authenticated() && config.autoSync !== false) void configSync.sync().catch(() => { /* status retains the failure */ });
  // The same routes for `dsh-teamwork` on this machine, once restored state answers them (src/control-socket.ts).
  const closeSocket = await serveControlSocket(controlSocketPath(config.cachePath), routes, message => ctx.logger.warn('%s', message));
  ctx.effect(() => () => { void closeSocket(); });
  if (config.tokenFile) {
    const watcher = watchTokenFile(config.tokenFile, async (token) => {
      pendingInstalls.clear();
      await client.useToken(token);
      await overlay.apply(client.current());
      if (token && config.autoSync !== false) await configSync.sync().catch(() => { /* status retains the failure */ });
    }, error => ctx.logger.warn('Could not read the Teamwork token file: %s', error.message));
    ctx.effect(() => () => watcher.stop());
    await watcher.ready;
  }
  configSync.start();
}
