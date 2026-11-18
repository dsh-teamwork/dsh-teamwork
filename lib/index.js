import { PhoneKeys, PhoneSecurity } from './phone-security.js';
import z from '@deepseek-ai/schemastery';
import { allConfigs, findConfig, ServerChoice, serverAddress, teamOf, TeamOverlay, TeamworkClient } from './client.js';
import { ConfigSync } from './config-sync.js';
import { PresetStamps, presetStampPath, sameRevision, toolReport, assertBlank } from './preset-session.js';
import { modelData, modelLimitProblem, unsizedModel, inheritsModel, pinnedPlugin } from './client.js';
import { taskProjection, stepProjection, TaskActions, recoveryHint, retryInstruction, outcomeText } from './task-session.js';
import { pluginState, stateText } from './plugin-status.js';
import { panelRoutes } from './panel.js';
import { registerAssistantTools } from './assistant-tools.js';
import { platformAdapter, platformProvider } from './platform-models.js';
import { Bridge } from './bridge.js';
import { PhoneSessionError, phonePresets } from './phone-session.js';
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { listenForCode } from './login-callback.js';
import { offerSchema, pairingSchema, RelayError, RelayLink, relayClientIdPath } from './relay.js';
import { watchTokenFile } from './token-file.js';
import { SharedMode, sharedKeyPath } from './shared-mode.js';
import { SharedRoster, sharedRosterPath } from './shared-roster.js';
import { OwnerFilter, startDirectories } from './shared-owner.js';
import { PinStore, pinsPath } from './pin-lock.js';
import { TeamWorkspaces, teamWorkspacesPath } from './team-workspaces.js';
import { AuditArchive, auditArchivePath } from './audit-archive.js';
import { panelLocale, say, setLocale, speaking } from './messages.js';
import { controlSocketPath, serveControlSocket } from './control-socket.js';
export const name = 'dsh-teamwork';
export const inject = ['agentPresets', 'agents', 'llm', 'sessionProjections'];
/** The hosted service. A member can pick another server in the panel; the profile's `apiEndpoint` sets the default. */
export const DEFAULT_SERVER = 'https://www.dshteamwork.com';
export const Config = z.object({ apiEndpoint: z.string().default(DEFAULT_SERVER), cachePath: z.string().required(), autoSync: z.boolean().default(true), syncIntervalMs: z.number().default(60000), tokenFile: z.string() });
export async function apply(ctx, config) {
    const client = new TeamworkClient(config.apiEndpoint, config.cachePath);
    const serverChoice = ServerChoice.beside(config.cachePath);
    // With tokenFile the host names the server in apiEndpoint, and a member's earlier choice does not apply.
    const chosen = config.tokenFile ? undefined : await serverChoice.read();
    if (chosen)
        await client.setEndpoint(chosen);
    ctx.effect(() => ctx.llm.registerAdapter([platformProvider], platformAdapter(client)));
    const taskState = await ctx.sessionProjections.register(taskProjection);
    ctx.effect(() => () => taskState.dispose());
    const stepState = await ctx.sessionProjections.register(stepProjection);
    ctx.effect(() => () => stepState.dispose());
    const stamps = new PresetStamps(presetStampPath(config.cachePath));
    await stamps.load();
    const overlay = new TeamOverlay(async (id, item, team) => ctx.agentPresets.register({
        id, name: `[${team.teamName}] ${item.name}`,
        ...(item.kind === 'preset' ? { description: item.data.description ?? '' } : {}),
        plugins: item.kind === 'preset' ? [{ name: 'cordis:group', group: true, isolate: { teamworkPreset: true }, config: [{ name: new URL('./preset-context.js', import.meta.url).href, config: {
                            inheritModel: item.data.inheritModel, builtin: item.builtin, description: item.data.description ?? '', instructions: item.data.instructions ?? '', outputDescription: item.data.outputDescription ?? '',
                            pluginDependencies: item.data.pluginDependencies ?? [],
                            requiredTools: item.data.requiredTools ?? [], optionalTools: item.data.optionalTools ?? [], systemPrompt: item.data.systemPrompt,
                            ...(item.data.modelConfigId ? { modelConfigId: item.data.modelConfigId } : {}),
                            teamId: team.teamId, id: item.id, name: item.name, version: item.version,
                        } }] }] : [],
    }));
    const restartRequired = new Set();
    const activePreset = (agent) => ctx.agentPresets.serviceFor(agent, 'teamworkPreset');
    const requirements = (agent, preset) => {
        const tools = ctx.get('tools');
        return toolReport(preset, name => !tools ? 'unknown' : !tools.get(name, agent) ? 'missing' : tools.executable(name, agent) ? 'available' : 'conditional');
    };
    const readPluginInventory = async () => {
        const manager = ctx.get('pluginManager');
        const bundles = manager ? await manager.listBundles() : [];
        const entries = manager ? await manager.listPlugins() : [];
        return { manager, bundles, entries };
    };
    const plugins = async (preset, readInventory = readPluginInventory) => {
        const snapshot = client.current();
        const dependencies = preset ? preset.pluginDependencies ?? [] : allConfigs(snapshot).filter(c => c.kind === 'plugin').map(c => ({ pluginConfigId: c.id, version: c.data.version }));
        if (!dependencies.length)
            return [];
        const { manager, bundles, entries } = await readInventory();
        return dependencies.map(dependency => {
            const item = pinnedPlugin(snapshot, dependency.pluginConfigId, dependency.version);
            // A preset's pin counts only in the preset's own team.
            const valid = (!preset || teamOf(snapshot, dependency.pluginConfigId)?.teamId === preset.teamId) && item?.kind === 'plugin' && item.data.version === dependency.version;
            const bundle = item?.kind === 'plugin' ? bundles.find(b => b.name === item.data.package) : undefined;
            const state = !valid ? 'catalog-changed' : !manager ? 'unknown' : pluginState(dependency.version, bundle, entries, restartRequired.has(`${item.data.package}@${dependency.version}`));
            return { id: dependency.pluginConfigId, name: item?.name ?? dependency.pluginConfigId, package: item?.kind === 'plugin' ? item.data.package : undefined,
                version: dependency.version, description: item?.kind === 'plugin' ? item.data.description : '', localVersion: bundle?.version, state,
                text: `${item?.name ?? dependency.pluginConfigId} @${dependency.version} (local ${bundle?.version ?? 'none'}): ${stateText[state]}${state === 'missing' ? `; /teamwork install ${dependency.pluginConfigId}@${dependency.version}` : ''}` };
        });
    };
    const checkPlugins = async (preset) => {
        const missing = (await plugins(preset)).filter(p => p.state !== 'ready');
        if (missing.length)
            throw new PhoneSessionError('missing_plugins', missing.map(p => p.text).join('\n'));
    };
    // A stamp that fails to save is retaken on the session's next request; the session itself is unaffected.
    const keep = (write) => { write.catch(error => ctx.logger.warn('Could not save the team preset version record: %s', error.message)); };
    const stamp = (agent, preset) => keep(stamps.set(String(agent.id), preset));
    const detail = (agent, preset, preview = false) => {
        const snapshot = client.current();
        const team = teamOf(snapshot, preset.id);
        const latest = team?.teamId === preset.teamId ? findConfig(snapshot, preset.id) : undefined;
        const tools = requirements(agent, preset);
        const labels = { available: 'registered (running it still needs the host’s permission)', conditional: 'conditional, checked when run', missing: 'missing', unknown: 'cannot be checked' };
        const saved = preview ? null : stamps.get(String(agent.id));
        const revision = latest ? latest.version === preset.version ? 'Up to date' : `Version v${latest.version} is available; a started session needs a new session to use it` : 'This preset is no longer in the team configuration';
        return [`${preset.name} · v${preset.version}`, `Source: team ${team?.teamName ?? preset.teamId} / preset ${preset.id}`, revision,
            latest && snapshot && !inheritsModel(latest) && !modelData(snapshot, latest) ? 'The linked model is no longer available. Ask an admin to link a team model again.' : '',
            latest && snapshot ? modelLimitProblem(snapshot, latest) ?? '' : '',
            saved && !sameRevision(saved, preset) ? `This session recorded v${saved.version}, which differs from the loaded version; inference is blocked. Start a new session.` : '',
            `Session model: ${agent.model.current()?.provider ?? "none"}/${agent.model.current()?.model ?? "none"}`,
            `Preset model: ${preset.inheritModel ? 'the session’s model' : preset.modelConfigId ?? 'legacy own model'} · through the platform; the server always applies its current model policy`,
            `Description: ${preset.description || 'not set'}`, `Instructions: ${preset.instructions || 'not set'}`, `Deliverable: ${preset.outputDescription || 'not set'}`,
            'Prompt: your local prompt, followed by the team text below', preset.systemPrompt || '(no team text)',
            ...tools.map(t => { const declared = (team?.configs ?? []).filter(c => c.kind === 'plugin' && c.data.providesTools?.includes(t.name)); return `${t.required ? 'Required' : 'Optional'} tool ${t.name}: ${labels[t.state]}${declared.length ? '; declared by team plugin ' + declared.map(c => `${c.name} (/teamwork install ${c.id})`).join(', ') : ''}`; }),
            'Install or enable a missing tool in the local plugin manager; a preset never installs a plugin or grants a permission.',
        ].filter(Boolean).join('\n');
    };
    /** The reason a team model or preset id cannot run here (see modelLimitProblem), if any. */
    const limitProblem = (id) => { const snapshot = client.current(), item = findConfig(snapshot, id); return snapshot && item ? modelLimitProblem(snapshot, item) : undefined; };
    // Runs inside the host's model-switch compaction check, so a model without its window gets this reason, not that failure.
    ctx.on('agent/request', async ({ agent }, next) => {
        const selection = agent.model.current();
        const limit = selection?.provider === platformProvider ? limitProblem(selection.model) : undefined;
        if (limit)
            throw new Error(limit);
        const preset = activePreset(agent);
        if (preset) {
            if (preset.inheritModel && !agent.model.current())
                throw new Error('Choose a working local model first, or ask an admin to link a team model to the assistant.');
            if (preset.pluginDependencies?.length)
                await checkPlugins(preset);
            const saved = stamps.get(String(agent.id));
            if (saved && !sameRevision(saved, preset))
                throw new Error('The team preset changed version since this session started. Start a new session.');
            const missing = requirements(agent, preset).filter(t => t.required && ['missing', 'unknown'].includes(t.state));
            if (missing.length)
                throw new Error(`Required tools are missing: ${missing.map(t => t.name).join(', ')}. Install or enable them, then try again.`);
            if (!saved)
                stamp(agent, preset);
        }
        return next();
    });
    ctx.inject(['tools'], child => registerAssistantTools(child, client, activePreset, () => configSync.sync(), async (id, version) => { const item = pinnedPlugin(client.current(), id, version); if (!item)
        throw Error('Plugin version is unavailable'); return installPlugin(item); }));
    const configSync = new ConfigSync(client, overlay, config.autoSync ?? true, config.syncIntervalMs ?? 60000);
    const readiness = async (agent, fresh = false) => {
        const selection = agent.model.current();
        if (!selection)
            throw new PhoneSessionError('model_unavailable', 'No model is selected. Choose a local model, or run /teamwork use <id>.');
        if (selection.provider === platformProvider) {
            if (!client.authenticated())
                throw new PhoneSessionError('not_authenticated', 'Not signed in to the team model, or the sign-in expired. Run /teamwork login.');
            if (fresh) {
                try {
                    await configSync.sync();
                }
                catch {
                    throw new PhoneSessionError('unavailable', 'Could not verify team access. Check the connection and /teamwork status, and sign in again if needed.');
                }
            }
            const snapshot = client.current(), item = findConfig(snapshot, selection.model);
            if (!snapshot || !item || !modelData(snapshot, item))
                throw new PhoneSessionError('model_unavailable', 'The team model was removed or its link is broken. Choose an available model; for a changed preset, start a new session.');
            const limit = modelLimitProblem(snapshot, item);
            if (limit)
                throw new PhoneSessionError('model_unavailable', limit);
        }
        const preset = activePreset(agent);
        if (preset) {
            const saved = stamps.get(String(agent.id));
            if (saved && !sameRevision(saved, preset))
                throw new PhoneSessionError('preset_changed', 'The resumed session’s preset version differs. Run /teamwork new <presetId>.');
            if (preset.pluginDependencies?.length)
                await checkPlugins(preset);
            const missing = requirements(agent, preset).filter(t => t.required && ['missing', 'unknown'].includes(t.state));
            if (missing.length)
                throw new PhoneSessionError('missing_tools', `Required tools are missing: ${missing.map(t => t.name).join(', ')}; run /teamwork info for install guidance.`);
        }
    };
    const actions = new TaskActions(agent => readiness(agent, true), agent => {
        const model = agent.model.current(), usesTeam = model?.provider === platformProvider || !!activePreset(agent);
        return JSON.stringify({ live: ctx.agents.get(agent.id) === agent, seq: agent.session.seq, model, preset: stamps.get(String(agent.id)),
            ...(usesTeam ? { team: client.current(), authenticated: client.authenticated(), authRevision: client.sessionRevision() } : {}) });
    });
    const pendingInstalls = new Map();
    // The phone's way in (dsh-teamwork-premium ADR 0008): open only while signed in, and only to a server that runs a relay.
    // Phones paired with this computer, as the relay last listed them; re-read on connecting and whenever one is paired or revoked.
    let phones = [];
    // A paired phone's calls, replayed against this DSH's own web server through the allow-list; set where DSH serves web.
    let launchUrl;
    // A shared DSH's own roster and who owns each session (src/shared-roster.ts, src/shared-owner.ts).
    const roster = new SharedRoster(sharedRosterPath(config.cachePath));
    // The PIN lock (src/pin-lock.ts): per member on a shared DSH, the one `owner` on a personal computer.
    const pins = new PinStore(pinsPath(config.cachePath));
    // The audit archive (src/audit-archive.ts): every frame of a member's, sealed to the team admin's key.
    const archive = new AuditArchive({
        path: auditArchivePath(config.cachePath),
        hostId: () => shared?.status().hostId,
        identity: () => phoneKeys.identity(),
        upload: async (body) => {
            const response = await fetch(`${client.endpoint}/relay/shared/archive`, { method: 'POST', headers: { Authorization: `Bearer ${client.platformCredential()}`, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(30000) });
            return { status: response.status };
        },
        log: (message) => ctx.logger.warn('%s', message),
    });
    ctx.effect(() => () => archive.stop());
    /** Records a frame between a member's device and this shared DSH, in either direction. */
    const audit = (frame, dir) => {
        const pairingId = frame?.pairingId;
        if (!shared?.enabled || typeof pairingId !== 'string')
            return;
        void roster.memberOf(pairingId).then((member) => { if (member)
            archive.record({ member, device: pairingId, dir, frame }); });
    };
    /**
     * Where a session may be started from a phone or the console: the directory DSH was started in, then DSH's own
     * workspaces. A new device, or a member of a shared DSH with no session yet, has no other way to name one.
     */
    let workspaces;
    ctx.inject(['workspaceRegistry'], (scoped) => {
        scoped.effect(() => {
            workspaces = scoped.workspaceRegistry;
            return () => { workspaces = undefined; };
        });
    });
    const directories = () => startDirectories(process.cwd(), workspaces?.list() ?? []);
    /** Each synced team's default workspace here (src/team-workspaces.ts), where a phone or the console starts a session. */
    const teamWorkspaces = new TeamWorkspaces(teamWorkspacesPath(config.cachePath));
    const teamDirectories = () => teamWorkspaces.defaults((client.current()?.teams ?? []).map(team => team.teamId), directories());
    const owners = new OwnerFilter(roster, (pairingId) => roster.memberOf(pairingId), directories);
    /** Who the server lets reach this shared DSH, as the relay last said; and members whose handsets wait to join. */
    let sharedMembers = [];
    const joining = new Map();
    const bridge = new Bridge({
        launchUrl: () => launchUrl?.(),
        owners: () => shared?.enabled ? owners : undefined,
        send: (frame) => { audit(frame, 'out'); security.send(frame); },
        log: (message, error) => ctx.logger.warn('%s: %s', message, error?.message ?? ''),
        session: {
            async configuration(sessionId) {
                const agent = sessionAgent(sessionId);
                if (sessionId && !agent)
                    throw new PhoneSessionError('busy');
                const state = await panel.state(sessionId);
                const roster = await ctx.agentPresets.remoteExportList();
                return { presets: phonePresets(state, [...roster.presets]), directories: directories(), teamDirectories: await teamDirectories(), current: agent ? {
                        sessionId: String(agent.id), cwd: agent.session.header.cwd,
                        agentPreset: ctx.agentPresets.presetForSession(agent.session), model: agent.model.current() ?? null,
                        started: state.session?.started ?? false, running: agent.status !== 'idle',
                    } : null };
            },
            async selectModel(request) {
                const agent = sessionAgent(request.sessionId);
                if (!agent)
                    throw new PhoneSessionError('not_found');
                if (agent.status !== 'idle' || agent.inbox.nextTurn.length || agent.inbox.nextStep.length)
                    throw new PhoneSessionError('busy');
                const selection = { provider: request.provider, model: request.model, ...(request.reasoningEffort ? { reasoningEffort: ReasoningEffortId(request.reasoningEffort) } : {}) };
                try {
                    const model = (await ctx.llm.listModels(selection.provider)).find(model => model.id === selection.model);
                    if (!model)
                        throw new Error('Unavailable model');
                    await ctx.llm.resolveCallConfig(selection);
                    if (agent.status !== 'idle' || agent.inbox.nextTurn.length || agent.inbox.nextStep.length)
                        throw new PhoneSessionError('busy');
                    agent.model.select(selection);
                    return { selected: agent.model.current() };
                }
                catch (error) {
                    if (error instanceof PhoneSessionError)
                        throw error;
                    throw new PhoneSessionError('model_unavailable');
                }
            },
            accepted(sessionId, requestId) {
                const agent = sessionAgent(sessionId);
                if (!agent)
                    return false;
                const matches = (source) => typeof source === 'object' && source !== null && 'kind' in source && source.kind === 'user' && 'rpcId' in source && source.rpcId === requestId;
                return [...agent.inbox.nextTurn, ...agent.inbox.nextStep].some(message => matches(message.source)) || agent.session.snapshotEvents().some(event => event.type === 'user/message' && matches(event.data.source));
            },
            async check(sessionId) {
                const agent = sessionAgent(sessionId);
                if (!agent)
                    throw new PhoneSessionError('not_found');
                if (agent.status !== 'idle' || agent.inbox.nextTurn.length || agent.inbox.nextStep.length)
                    throw new PhoneSessionError('busy');
                await readiness(agent, true);
            },
        },
    });
    let keyScope;
    const phoneKeys = new PhoneKeys(config.cachePath.replace(/\.json$/, '') + '.phone-keys.json');
    // Shared mode (src/shared-mode.ts): the team host key signs this DSH in for its team, as no person. A host-provided
    // token (tokenFile) is a cloud computer's, which is never shared this way.
    const shared = config.tokenFile ? undefined : new SharedMode({
        path: sharedKeyPath(config.cachePath),
        server: () => client.endpoint,
        identity: () => phoneKeys.identity(),
        onToken: async (token) => {
            pendingInstalls.clear();
            await client.useToken(token);
            await overlay.apply(client.current());
            // The relay started before this token was restored, and stopped for want of one: a DSH restarted in shared
            // mode stayed off the relay, so no member could reach it. A renewal while connected changes nothing here.
            if (token && relay.status === 'off')
                relay.refresh();
            if (token && config.autoSync !== false)
                await configSync.sync().catch(() => { });
        },
        log: message => ctx.logger.warn('%s', message),
    });
    ctx.effect(() => () => shared?.stop());
    const security = new PhoneSecurity({
        keys: phoneKeys,
        scope: () => {
            const revision = client.sessionRevision();
            if (!keyScope || keyScope.revision !== revision) {
                // A shared DSH has no profile: its phones are trusted under its shared host.
                const hostId = shared?.enabled ? shared.status().hostId : undefined;
                const value = hostId ? Promise.resolve(`${client.endpoint}|shared:${hostId}`) : client.profile().then(profile => `${client.endpoint}|${profile.id}`);
                keyScope = { revision, value };
                void value.catch(() => { if (keyScope?.value === value)
                    keyScope = undefined; });
            }
            return keyScope.value;
        },
        send: frame => relay.send(frame), forward: frame => { audit(frame, 'in'); bridge.handle(frame); },
        confirm: async (id) => { await relay.request({ t: 'decide', pairingId: id, accept: true }); },
        changed: () => { },
        error: error => ctx.logger.warn('phone security: %s', error.message),
        joining: (pairingId) => shared?.enabled ? joining.get(pairingId) : undefined,
        pins,
        pinMember: async (pairingId) => shared?.enabled ? roster.memberOf(pairingId) : 'owner',
        admit: async (input) => {
            // No member joins before the admin's audit key is set: nothing they do would be archived.
            if (!(await archive.ready())) {
                ctx.logger.warn('A member tried to join before the audit key was set (/teamwork share audit-key).');
                return false;
            }
            if (!sharedMembers.some((m) => m.userId === input.userId))
                return false;
            const admitted = await roster.accept({ inviteId: input.inviteId, secret: input.secret, userId: input.userId, pairingId: input.pairingId, deviceName: input.name });
            if (admitted)
                joining.delete(input.pairingId);
            return admitted;
        },
    });
    const relay = new RelayLink({
        endpoint: () => client.endpoint,
        // A token from tokenFile belongs to a cloud computer, which the server reaches directly; it never opens the relay.
        // A shared DSH reaches it with its host token, as its team's host.
        token: () => !config.tokenFile && client.authenticated() ? client.platformCredential() : undefined,
        clientIdPath: relayClientIdPath(config.cachePath),
        onStatus: (status) => {
            ctx.logger.debug('relay: %s', status);
            if (status === 'connected')
                void readPhones();
            else {
                phones = [];
                security.reset();
                bridge.dropAll();
            }
        },
        onEvent: (event) => {
            if (event.t === 'members')
                void sharedList(event.members);
            else
                void readPhones();
        },
        onForward: (frame) => void security.handle(frame),
    });
    /** The server's list changed: whoever left loses their devices here too, whatever the relay already cut. */
    const sharedList = async (members) => {
        sharedMembers = members;
        try {
            for (const pairingId of await roster.prune(new Set(members.map((m) => m.userId))))
                await security.revoke(pairingId);
        }
        catch (error) {
            ctx.logger.warn('Could not update the shared roster: %s', error.message);
        }
    };
    const readPhones = async () => {
        try {
            const listed = pairingSchema.array().parse(await relay.request({ t: 'pairings' }));
            joining.clear();
            for (const phone of listed)
                if (phone.status === 'pending' && phone.userId)
                    joining.set(phone.id, phone.userId);
            phones = listed.map(({ userId: _userId, ...phone }) => phone);
            await security.reconcile(phones.map((phone) => phone.id));
        }
        catch (error) {
            ctx.logger.warn('Could not read the paired phones: %s', error.message);
        }
    };
    const phoneError = (error) => {
        if (error instanceof RelayError && error.code === 'not_found')
            throw new Error(say('phone.notFound'));
        throw new Error(say(relay.status === 'connected' ? 'phone.relayBusy' : 'phone.relayOff'));
    };
    ctx.effect(() => () => relay.stop());
    // The phone's notifications (the server's docs/tech/relay.md, "Push notifications"): when an agent waits on its member,
    // tell the relay which session, and hand on to the answerers untouched. Prepended, so it is told even when one claims the request.
    const reportWaiting = (kind) => function (request, next) {
        const agent = request?.agent ?? this;
        if (agent?.id !== undefined)
            relay.send({ t: 'waiting' });
        return next();
    };
    const listen = ctx.on.bind(ctx);
    listen('user-questions/request', reportWaiting('question'), true);
    listen('approval/request', reportWaiting('approval'), true);
    // The loopback listener of the sign-in in progress, if any (src/login-callback.ts).
    let callback;
    const stopCallback = () => { callback?.close(); callback = undefined; };
    ctx.effect(() => () => stopCallback());
    const hostManaged = () => {
        if (config.tokenFile)
            throw new Error(say('auth.hostManaged'));
        if (shared?.enabled)
            throw new Error(say('auth.shared'));
    };
    /** `/teamwork share enable <key>`: personal sign-in ends first, so this DSH is never both a person's and the team's. */
    const shareEnable = async (key) => {
        if (!shared)
            throw new Error(say('auth.hostManaged'));
        pendingInstalls.clear();
        stopCallback();
        if (!shared.enabled && client.authenticated()) {
            await client.logout();
            setLocale(null);
            await overlay.apply();
            await pins.reset();
        }
        await shared.enable(key);
        relay.refresh();
    };
    const shareDisable = async () => {
        if (!shared?.enabled)
            throw new Error(say('shared.off'));
        await archive.clear();
        await shared.disable();
        await roster.clear();
        await pins.reset();
        sharedMembers = [];
        joining.clear();
        relay.refresh();
    };
    /** The listed member with that email, or the reason there is none, in the member's words. */
    const listedMember = (email) => {
        if (!shared?.enabled)
            throw new Error(say('shared.off'));
        const member = sharedMembers.find((m) => m.email?.toLowerCase() === email.trim().toLowerCase());
        if (!member?.email)
            throw new Error(say('shared.notListed', { email }));
        return { userId: member.userId, email: member.email };
    };
    /** `/teamwork share unlock <email>`: clears one member's PIN and lock. */
    const shareUnlock = async (email) => { await pins.clear(listedMember(email).userId); };
    /** `/teamwork share audit-key <key>`: seals the archive to the admin's key; members are admitted from then on. */
    const shareAuditKey = async (key) => {
        if (!shared?.enabled)
            throw new Error(say('shared.off'));
        return archive.setKey(key);
    };
    /** What the panel shows of shared mode: the machine, its audit key, and its members with their devices. */
    const sharedView = async () => {
        const status = shared?.status();
        if (!status?.enabled)
            return null;
        const devices = Object.values(await roster.devices());
        return {
            name: status.name ?? null, teamName: client.current()?.teams[0]?.teamName ?? null, error: status.error ?? null,
            auditKey: (await archive.fingerprint()) ?? null,
            members: await Promise.all(sharedMembers.map(async (m) => ({
                userId: m.userId, email: m.email ?? null, devices: devices.filter((d) => d.userId === m.userId).map((d) => d.name), locked: await pins.locked(m.userId),
            }))),
        };
    };
    /** `/teamwork share invite <email>`: a single-use link for one member the server lists, to hand over outside it. */
    const shareInvite = async (email) => {
        const status = shared?.status();
        if (!status?.enabled || !status.hostId)
            throw new Error(say('shared.off'));
        const member = listedMember(email);
        const { id, secret, expiresAt } = await roster.invite({ userId: member.userId, email: member.email });
        const query = new URLSearchParams({ server: client.endpoint, host: status.hostId, key: await security.publicKey(), invite: id, secret });
        return { link: `dshteamwork://join?${query}`, expiresAt: new Date(expiresAt).toISOString() };
    };
    const authorize = async (code) => { hostManaged(); pendingInstalls.clear(); try {
        await client.completeLogin(code);
    }
    finally {
        await overlay.apply(client.current());
        relay.refresh();
    } stopCallback(); if (config.autoSync !== false)
        await configSync.sync(); };
    /** The sign-in page's address, and whether the code comes back by itself; without a listener it is pasted. */
    const beginLogin = async () => {
        hostManaged();
        stopCallback();
        callback = await listenForCode(authorize).catch((error) => { ctx.logger.warn('Cannot receive the authorization code on this machine; it has to be pasted: %s', error.message); return undefined; });
        return { url: client.beginLogin(callback?.uri), automatic: callback !== undefined };
    };
    const restore = async () => { await client.restore(); await overlay.apply(client.current()); relay.refresh(); };
    const logout = async () => { hostManaged(); pendingInstalls.clear(); stopCallback(); try {
        await client.logout();
        await pins.reset();
    }
    finally {
        setLocale(null);
        await overlay.apply();
        relay.refresh();
    } };
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
        if (!agent)
            return;
        const active = activePreset(agent);
        if (active) {
            if (!active.inheritModel)
                agent.model.select({ provider: platformProvider, model: active.id });
            if (!sameRevision(stamps.get(String(agent.id)), active))
                stamp(agent, active);
        }
        else
            keep(stamps.clear(String(agent.id)));
    });
    ctx.on('agent/created', ({ agent, source }) => {
        const snapshot = client.current();
        const selected = ctx.agentPresets.presetForSession(agent.session);
        const item = snapshot?.teams.flatMap(team => team.configs.filter(c => `team:${team.teamId}:${c.id}` === selected))[0];
        const preset = activePreset(agent);
        if (preset && !stamps.get(String(agent.id)))
            stamp(agent, preset);
        if (source !== 'resume' && item && item.kind !== 'plugin' && !inheritsModel(item))
            agent.model.select({ provider: platformProvider, model: item.id });
        return undefined;
    });
    ctx.effect(() => async () => { await configSync.stop(); await overlay.apply(); });
    /** `/teamwork use` and the panel's "use": a team model, or a preset before the session's first turn. */
    const useConfig = async (agent, id) => {
        const snapshot = client.current();
        const item = findConfig(snapshot, id), team = teamOf(snapshot, id);
        if (!item || !team || item.kind === 'plugin')
            throw new Error(say('use.pick'));
        if (!inheritsModel(item) && !modelData(snapshot, item))
            throw new Error(say('use.modelGone'));
        const limit = modelLimitProblem(snapshot, item);
        if (limit)
            throw new Error(limit);
        if (item.kind === 'preset') {
            assertBlank(ctx.agents.turnBoundaryOf(agent.session));
            if (item.data.pluginDependencies?.length)
                await checkPlugins({ teamId: team.teamId, pluginDependencies: item.data.pluginDependencies });
            const candidate = { requiredTools: item.data.requiredTools ?? [], optionalTools: item.data.optionalTools ?? [] };
            const unavailable = requirements(agent, candidate).filter(t => t.required && ['missing', 'unknown'].includes(t.state));
            if (unavailable.length)
                throw new Error(say('use.missingTools', { tools: unavailable.map(t => t.name).join(', ') }));
            await ctx.agentPresets.select(agent, `team:${team.teamId}:${item.id}`);
            const active = activePreset(agent);
            if (active && !sameRevision(stamps.get(String(agent.id)), active))
                stamp(agent, active);
        }
        if (!inheritsModel(item))
            agent.model.select({ provider: platformProvider, model: item.id });
        return { preset: item.kind === 'preset', text: say('use.done', { name: item.name }) };
    };
    /** Installs a pinned plugin disabled, enables it only when it adds configuration and overrides nothing. Callers confirm first. */
    const installPlugin = async (item, agent) => {
        const spec = `${item.data.package}@${item.data.version}`;
        const epoch = client.sessionRevision(), signature = JSON.stringify(item);
        const manager = ctx.get('pluginManager');
        if (!manager)
            throw new Error(say('install.noManager'));
        const existing = (await manager.listBundles()).find(bundle => bundle.name === item.data.package);
        if (existing && (existing.installed || existing.enabled || existing.availability === 'installation'))
            throw new Error(say('install.exists'));
        const teamId = teamOf(client.current(), item.id)?.teamId;
        const target = item.data.artifactId ? await client.downloadArtifact(teamId, item.data.artifactId, item.data.sha256) : spec;
        if (epoch !== client.sessionRevision() || JSON.stringify(pinnedPlugin(client.current(), item.id, item.data.version)) !== signature)
            throw new Error(say('install.changed'));
        const installed = await manager.installBundle(target, { saveExact: true, enabled: false });
        if (installed.error || ['failed', 'cancelled', 'overridden'].includes(installed.application))
            throw new Error(say('install.incomplete', { reason: installed.error?.code ?? installed.application }));
        const bundle = (await manager.listBundles()).find(bundle => bundle.name === item.data.package);
        if (!bundle || bundle.error || bundle.version !== item.data.version || bundle.overrides.length || bundle.rows.some(row => row.entryId !== undefined)) {
            throw new Error(say('install.notEnabled'));
        }
        const result = await manager.setBundleEnabled(item.data.package, true);
        if (result.error || ['failed', 'cancelled', 'overridden'].includes(result.application))
            throw new Error(result.error?.code ?? result.application);
        if (result.application === 'restart-required')
            restartRequired.add(spec);
        const refreshed = (await plugins()).find(p => p.id === item.id);
        const currentPreset = agent && activePreset(agent);
        const missingTools = agent && currentPreset ? requirements(agent, currentPreset).filter(t => t.required && ['missing', 'unknown'].includes(t.state)) : [];
        const toolSummary = currentPreset ? `Required tools of the current preset: ${missingTools.length ? missingTools.map(t => t.name).join(', ') + ' not available yet' : 'all registered (running them still needs the host’s permission)'}` : '';
        return [say(result.application === 'restart-required' ? 'install.restart' : 'install.done'), refreshed?.text ?? '', toolSummary].filter(Boolean).join('\n');
    };
    const sessionAgent = (sessionId) => sessionId ? ctx.agents.get(sessionId) : undefined;
    const panel = {
        summary: teamId => client.summary(teamId),
        // The panel reads the profile as it opens, so the host speaks the account's language from then on.
        profile: async () => { const profile = await client.profile(); setLocale(profile.locale); return profile; },
        updateProfile: async (input) => { const profile = await client.updateProfile(input); setLocale(profile.locale); return profile; },
        async state(sessionId) {
            const status = configSync.status(), snapshot = client.current(), agent = sessionAgent(sessionId);
            // Inventory scans read the whole host. Share one within this response, never across requests.
            let inventory;
            const readInventory = () => inventory ??= readPluginInventory();
            const presets = [];
            for (const team of snapshot?.teams ?? [])
                for (const item of team.configs) {
                    if (item.kind !== 'preset')
                        continue;
                    const linked = item.data.modelConfigId ? team.configs.find(c => c.id === item.data.modelConfigId) : undefined;
                    const candidate = { requiredTools: item.data.requiredTools ?? [], optionalTools: item.data.optionalTools ?? [] };
                    presets.push({
                        id: item.id, teamId: team.teamId, teamName: team.teamName, name: item.name, version: item.version, description: item.data.description ?? '',
                        model: item.data.inheritModel ? null : item.data.modelConfigId ? linked?.name ?? item.data.modelConfigId : `${item.data.provider}/${item.data.model}`,
                        assistant: item.builtin === 'team-assistant',
                        modelAvailable: inheritsModel(item) || !!modelData(snapshot, item) && !unsizedModel(snapshot, item),
                        contextWindowMissing: !!unsizedModel(snapshot, item),
                        tools: agent ? requirements(agent, candidate) : toolReport(candidate, () => 'unknown'),
                        plugins: item.data.pluginDependencies?.length ? await plugins({ teamId: team.teamId, pluginDependencies: item.data.pluginDependencies }, readInventory) : [],
                    });
                }
            const selection = agent?.model.current(), active = agent && activePreset(agent), boundary = agent && ctx.agents.turnBoundaryOf(agent.session);
            const defaults = await teamDirectories();
            return {
                locale: panelLocale(),
                authRevision: client.sessionRevision(),
                authenticated: status.authenticated,
                teams: (snapshot?.teams ?? []).map(team => ({ id: team.teamId, name: team.teamName, role: team.role, consoleUrl: `${client.endpoint}/teams/${team.teamId}`, workspace: defaults[team.teamId] ?? null })),
                directories: directories(),
                server: client.endpoint,
                defaultServer: serverAddress(config.apiEndpoint),
                sync: { auto: status.autoSync, running: status.syncing, lastSuccess: status.lastSuccess, lastError: status.lastError },
                relay: relay.status,
                phones: await Promise.all(phones.map(async (phone) => ({ ...phone, ...await security.details(phone.id) }))),
                shared: await sharedView(),
                session: agent ? {
                    id: String(agent.id),
                    model: selection ? { provider: selection.provider, model: selection.model, team: selection.provider === platformProvider } : null,
                    preset: active ? { id: active.id, name: active.name, version: active.version } : null,
                    started: boundary.openTurnStartSeq !== null || boundary.lastTurn > 0,
                } : null,
                presets: presets.sort((a, b) => Number(b.assistant) - Number(a.assistant)),
                models: (snapshot?.teams ?? []).flatMap(team => team.configs.flatMap(c => c.kind === 'model'
                    ? [{ id: c.id, teamId: team.teamId, teamName: team.teamName, name: c.name, version: c.version, upstream: `${c.data.provider}/${c.data.model}`, contextWindowMissing: !!unsizedModel(snapshot, c) }] : [])),
                plugins: (await plugins(undefined, readInventory)).map(plugin => {
                    const team = teamOf(snapshot, plugin.id);
                    return { ...plugin, teamId: team?.teamId, teamName: team?.teamName };
                }),
            };
        },
        async setWorkspace(teamId, path) {
            if (!client.current()?.teams.some(team => team.teamId === teamId))
                throw new Error(say('workspace.unknownTeam'));
            if (!directories().includes(path))
                throw new Error(say('workspace.unknownDirectory'));
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
            }
            finally {
                setLocale(null);
                await overlay.apply(client.current());
                relay.refresh();
            }
        },
        async pairPhone() {
            const offer = offerSchema.parse(await relay.request({ t: 'offer' }).catch(phoneError));
            security.offerCode(offer.expiresAt);
            const key = await security.publicKey();
            const link = `dshteamwork://pair?${new URLSearchParams({ server: client.endpoint, code: offer.code, key })}`;
            return { ...offer, link };
        },
        async decidePhone(id, accept) {
            if (accept)
                await security.approve(id);
            else {
                await security.revoke(id);
                await relay.request({ t: 'decide', pairingId: id, accept: false }).catch(phoneError);
            }
            await readPhones();
        },
        async revokePhone(id) {
            await security.revoke(id);
            await relay.request({ t: 'revoke', pairingId: id }).catch(phoneError);
            await readPhones();
        },
        shareEnable,
        shareDisable,
        shareAuditKey: async (key) => ({ fingerprint: await shareAuditKey(key) }),
        shareInvite,
        shareUnlock,
        async use(sessionId, id) {
            const agent = sessionAgent(sessionId);
            if (!agent)
                throw new Error(say('use.notLoaded'));
            return (await useConfig(agent, id)).text;
        },
        async install(id, version) {
            const item = pinnedPlugin(client.current(), id, version);
            if (!item || item.kind !== 'plugin')
                throw new Error(say('install.pick'));
            // The member confirmed this exact version; a sync since then may have changed the pin.
            if (item.data.version !== version)
                throw new Error(say('install.pinChanged'));
            return installPlugin(item);
        },
    };
    const routes = panelRoutes(panel, { say, speak: answer => speaking(panelLocale(), answer) });
    // The panel's routes exist only where a browser reaches the host (DSH web and desktop), like the panel itself.
    ctx.inject(['connection'], (scoped) => {
        const { connection } = scoped;
        for (const route of routes)
            scoped.effect(() => { const dispose = connection.fetch.register(route); return () => { void dispose(); }; });
    });
    ctx.inject(['connection', 'webServer'], (scoped) => {
        const { connection, webServer } = scoped;
        scoped.effect(() => {
            launchUrl = () => connection.authenticatedUrl(webServer.getOrigin());
            return () => { launchUrl = undefined; bridge.dropAll(); };
        });
    });
    ctx.inject(['commands'], (child) => {
        child.effect(() => child.commands.register({
            name: 'teamwork', description: 'Team sign-in, configuration sync and model selection',
            input: { hint: 'login | authorize <code> | share enable <key> | share disable | share status | share invite <email> | share members | share unlock <email> | share audit-key <key> | pin reset | sync | status | session [check] | continue <instruction> | cancel | retry [confirm] | list | tools | plugins [presetId] | info [id] | new <id> | use <id> | install <id> confirm | logout' },
            handler: async ({ agent, rawInput }) => {
                const [action, requestedId, confirmation] = rawInput.trim().split(/\s+/);
                const [id, pinVersion] = requestedId?.split('@') ?? [];
                try {
                    if (action === 'session') {
                        let ready = 'Local checks passed; team access is verified again before continuing.';
                        try {
                            await readiness(agent, id === 'check');
                            if (id === 'check')
                                ready = 'Checks passed; the server still verifies access on the real request.';
                        }
                        catch (error) {
                            ready = error.message;
                        }
                        const task = taskState.stateOf(agent.session), preset = activePreset(agent), selection = agent.model.current();
                        return { kind: 'success', text: [`Session: ${agent.id}`, `Status: ${agent.status === 'running' ? 'running' : 'idle'} · last task: ${outcomeText(task.outcome)}`, `Task: ${task.task || (task.outcome === 'not-started' ? 'no task started yet' : 'non-text task (see the session history)')}`, `Pending input: ${agent.inbox.nextTurn.length} follow-up / ${agent.inbox.nextStep.length} steering`, `Model: ${selection?.provider ?? 'none'}/${selection?.model ?? 'none'}`, `Preset: ${preset ? preset.name + ' v' + preset.version : 'local or no team preset'}`, `Recovery check: ${ready}`, recoveryHint(task.failureCode, task.outcome)].join('\n') };
                    }
                    if (action === 'cancel') {
                        actions.cancel(agent);
                        return { kind: 'success', text: 'Cancellation requested; run /teamwork session to see whether it stopped. History, finished changes and pending input stay; nothing is rolled back.' };
                    }
                    if (action === 'continue') {
                        await actions.submit(agent, rawInput.trim().slice('continue'.length).trim());
                        return { kind: 'success', text: 'The follow-up was handed to DSH; run /teamwork session to see its status.' };
                    }
                    if (action === 'retry') {
                        if (id !== 'confirm') {
                            actions.review(agent, taskState.stateOf(agent.session).outcome);
                            return { kind: 'success', text: 'Retrying sends a follow-up asking the agent to check what is done and finish the task, which may still make new changes. It never replays the original tool calls or rolls files back. To confirm, run /teamwork retry confirm (valid for two minutes; confirm again after the session or configuration changes).' };
                        }
                        await actions.submit(agent, retryInstruction, true);
                        return { kind: 'success', text: 'Recovery instruction sent; no original tool call was replayed.' };
                    }
                    if (action === 'login') {
                        const { url, automatic } = await beginLogin();
                        return { kind: 'success', text: automatic
                                ? `Sign in and authorize in the browser: ${url}\nThis finishes by itself once you confirm. If it does not, paste the line shown on the page here and run it.`
                                : `Sign in and authorize in the browser: ${url}\nThen paste the line shown on the page here and run it (/teamwork authorize <code>).` };
                    }
                    if (action === 'authorize') {
                        await authorize(id ?? '');
                        return { kind: 'success', text: 'Authorized. Run /teamwork status to see the sync status.' };
                    }
                    if (action === 'share') {
                        if (requestedId === 'enable') {
                            await shareEnable(confirmation ?? '');
                            const st = shared.status();
                            return { kind: 'success', text: `This DSH is now the Team DSH “${st.name}” of its team. Personal sign-in is off while it is shared; /teamwork share disable ends it.` };
                        }
                        if (requestedId === 'disable') {
                            await shareDisable();
                            return { kind: 'success', text: 'This DSH is no longer a Team DSH, and its key is deleted. Sign in with /teamwork login to use this DSH as yourself.' };
                        }
                        if (requestedId === 'invite') {
                            const invite = await shareInvite(confirmation ?? '');
                            return { kind: 'success', text: [`Invite for ${confirmation}, single use, valid until ${invite.expiresAt}:`, invite.link, 'Hand it over yourself, in person or through a channel your team trusts, never through the Teamwork server. Whoever opens it signed in as that member pairs a device with this DSH.'].join('\n') };
                        }
                        if (requestedId === 'audit-key') {
                            const fingerprint = await shareAuditKey(confirmation ?? '');
                            return { kind: 'success', text: `Audit key set (fingerprint ${fingerprint}). Every member's session on this DSH is now archived, sealed to it; members can join.` };
                        }
                        if (requestedId === 'unlock') {
                            await shareUnlock(confirmation ?? '');
                            return { kind: 'success', text: `${confirmation}'s PIN and lock are cleared; they set a new PIN on their next connection.` };
                        }
                        if (requestedId === 'members') {
                            const devices = await roster.devices();
                            const rows = sharedMembers.map((m) => `${m.email ?? m.userId}: ${Object.values(devices).filter((d) => d.userId === m.userId).map((d) => d.name).join(', ') || 'no device yet'}`);
                            return { kind: 'success', text: rows.length ? ['Members who may reach this Team DSH, and their devices:', ...rows].join('\n') : 'Nobody is listed yet, or the relay is not connected.' };
                        }
                        const st = shared?.status() ?? { enabled: false };
                        return { kind: 'success', text: st.enabled ? [`Team DSH: ${st.name ?? st.hostId ?? 'not yet confirmed'}`, `Team: ${st.teamId ?? 'unknown'}`, st.expiresAt ? `Host token valid until ${st.expiresAt}` : '', st.error ?? ''].filter(Boolean).join('\n') : 'This DSH is not a Team DSH. A team admin creates a team host key under Team assets → Team DSH in the console; run /teamwork share enable <key> here.' };
                    }
                    if (action === 'sync') {
                        await configSync.sync();
                        const synced = client.current(), problems = [...new Set(allConfigs(synced).filter(c => c.kind === 'model').flatMap(c => modelLimitProblem(synced, c) ?? []))];
                        return { kind: 'success', text: ['Team configuration synced; your local configuration is unchanged.', ...problems].join('\n') };
                    }
                    if (action === 'pin' && requestedId === 'reset') {
                        if (shared?.enabled)
                            throw new Error('On a Team DSH, clear a member\'s PIN with /teamwork share unlock <email>.');
                        await pins.clear('owner');
                        return { kind: 'success', text: 'Your phone PIN and its lock are cleared; set a new PIN on your phone\'s next connection.' };
                    }
                    if (action === 'logout') {
                        await logout();
                        return { kind: 'success', text: 'Signed out, and the team configuration removed.' };
                    }
                    if (action === 'status') {
                        const status = configSync.status();
                        return { kind: 'success', text: [`Signed in: ${status.authenticated ? 'yes' : 'no (a cache is not a valid sign-in)'}`, `Auto sync: ${status.autoSync ? 'on' : 'off'}`, `Teams: ${status.teams.length ? status.teams.join(', ') : 'none'} · configurations: ${status.configCount}`, `Last successful sync: ${status.lastSuccess ?? 'not since this start'}`, status.syncing ? 'Syncing' : '', status.lastError ?? ''].filter(Boolean).join('\n') };
                    }
                    const snapshot = client.current();
                    const item = id ? action === 'install' && pinVersion ? pinnedPlugin(snapshot, id, pinVersion) : findConfig(snapshot, id) : undefined, team = id ? teamOf(snapshot, id) : undefined;
                    if (action === 'tools') {
                        const tools = child.get('tools');
                        if (!tools)
                            throw new Error('The host offers no tool check service');
                        const rows = tools.definitions(agent).map(tool => {
                            const declared = (snapshot?.teams ?? []).flatMap(t => t.configs.filter(c => c.kind === 'plugin' && c.data.providesTools?.includes(tool.name)).map(c => `${c.name} (${t.teamName})`));
                            return `${tool.name} · ${tools.executable(tool.name, agent) ? 'registered; running it still needs a permission check' : 'conditional'} · ${declared.length ? 'declared by team plugin ' + declared.join(', ') : 'source: the host gives no owner'}`;
                        });
                        return { kind: 'success', text: ['Tools visible to this session (a declared source is not a verified runtime owner):', ...rows, rows.length ? '' : 'No tools visible'].filter(Boolean).join('\n') };
                    }
                    if (action === 'plugins') {
                        if (id && item?.kind !== 'preset')
                            throw new Error('Choose a team preset ID');
                        const preset = item?.kind === 'preset' ? { teamId: team.teamId, pluginDependencies: item.data.pluginDependencies } : undefined;
                        return { kind: 'success', text: (await plugins(preset)).map(p => p.text).join('\n') || 'No plugin dependencies.' };
                    }
                    if (action === 'info') {
                        if (!id) {
                            const active = activePreset(agent);
                            return { kind: 'success', text: active ? detail(agent, active) + '\n' + (await plugins(active)).map(p => p.text).join('\n') : 'This session has no team preset. Run /teamwork info <presetId> for details.' };
                        }
                        if (!item || item.kind !== 'preset')
                            throw new Error('Choose a team preset ID');
                        const info = { teamId: team.teamId, id: item.id, name: item.name, version: item.version, description: '', instructions: '', outputDescription: '', requiredTools: [], optionalTools: [], ...item.data };
                        return { kind: 'success', text: detail(agent, info, true) + '\n' + (await plugins(info)).map(p => p.text).join('\n') + '\nTools are checked for the current session, again after switching and before every request.' };
                    }
                    if (action === 'new') {
                        if (!item || item.kind !== 'preset')
                            throw new Error('Choose a team preset ID');
                        if (!inheritsModel(item) && !modelData(snapshot, item))
                            throw new Error(say('use.modelGone'));
                        const limit = modelLimitProblem(snapshot, item);
                        if (limit)
                            throw new Error(limit);
                        const sessionId = `team-${crypto.randomUUID()}`;
                        const agentPreset = `team:${team.teamId}:${item.id}`;
                        await child.agents.create({ sessionId, meta: { cwd: agent.session.header.cwd, agentPreset }, setup: async (agentCtx) => { await child.agentPresets.mount(agentCtx, agentPreset); }, ...(inheritsModel(item) && agent.model.current() ? { agentOptions: agent.model.current() } : {}) });
                        return { kind: 'success', text: `Created session ${sessionId} with ${item.name} v${item.version}. Open it from the session list; the original session and its history are unchanged.` };
                    }
                    if (action === 'use') {
                        const chosen = await useConfig(agent, id ?? '');
                        return { kind: 'success', text: chosen.text + (chosen.preset ? ' Run /teamwork info for its version and tool status.' : '') };
                    }
                    if (action === 'install') {
                        if (!item || item.kind !== 'plugin')
                            throw new Error(say('install.pick'));
                        const spec = `${item.data.package}@${item.data.version}`;
                        if (confirmation !== 'confirm') {
                            pendingInstalls.set(String(agent.id), `${client.sessionRevision()}:${JSON.stringify(item)}`);
                            return { kind: 'success', text: `Installing and enabling ${spec} runs that plugin’s code. To confirm, run /teamwork install ${item.id} confirm` };
                        }
                        if (pendingInstalls.get(String(agent.id)) !== `${client.sessionRevision()}:${JSON.stringify(item)}`)
                            throw new Error('Read the install note for the current plugin version first, then confirm the install');
                        pendingInstalls.delete(String(agent.id));
                        return { kind: 'success', text: await installPlugin(item, agent) + '\nRun /teamwork plugins or /teamwork info to check dependencies and tools again.' };
                    }
                    return { kind: 'success', text: snapshot ? snapshot.teams.flatMap(t => t.configs.map(c => `${c.id} · ${c.kind} · ${c.name} · v${c.version} · ${t.teamName}`)).join('\n') || 'No team configuration' : 'Not synced yet. Run /teamwork login to start.' };
                }
                catch (error) {
                    return { kind: 'error', text: error.message };
                }
            },
        }));
    });
    try {
        await restore();
    }
    catch {
        ctx.logger.warn('The team cache could not be restored; sign in and sync again.');
    }
    try {
        await shared?.restore();
        if (shared?.enabled)
            void archive.recover();
    }
    catch (error) {
        ctx.logger.warn('Shared mode could not resume: %s', error.message);
    }
    // The same routes for `dsh-teamwork` on this machine, once restored state answers them (src/control-socket.ts).
    const closeSocket = await serveControlSocket(controlSocketPath(config.cachePath), routes, message => ctx.logger.warn('%s', message));
    ctx.effect(() => () => { void closeSocket(); });
    if (config.tokenFile) {
        const watcher = watchTokenFile(config.tokenFile, async (token) => {
            pendingInstalls.clear();
            await client.useToken(token);
            await overlay.apply(client.current());
            if (token && config.autoSync !== false)
                await configSync.sync().catch(() => { });
        }, error => ctx.logger.warn('Could not read the Teamwork token file: %s', error.message));
        ctx.effect(() => () => watcher.stop());
        await watcher.ready;
    }
    configSync.start();
}
//# sourceMappingURL=index.js.map