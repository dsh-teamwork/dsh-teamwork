import z from '@deepseek-ai/schemastery';
import { ServerChoice, serverAddress, TeamOverlay, TeamworkClient } from './client.js';
import { ConfigSync } from './config-sync.js';
import { PresetStamps, presetStampPath, sameRevision, toolReport, assertBlank } from './preset-session.js';
import { modelData } from './client.js';
import { taskProjection, TaskActions, recoveryHint, retryInstruction, outcomeText } from './task-session.js';
import { pluginState, stateText } from './plugin-status.js';
import { panelRoutes } from './panel.js';
import { platformAdapter, platformProvider } from './platform-models.js';
export const name = 'dsh-teamwork';
export const inject = ['agentPresets', 'agents', 'llm', 'sessionProjections'];
/** The hosted service. A member can pick another server in the panel; the profile's `apiEndpoint` sets the default. */
export const DEFAULT_SERVER = 'https://dshteamwork.com';
export const Config = z.object({ apiEndpoint: z.string().default(DEFAULT_SERVER), cachePath: z.string().required(), autoSync: z.boolean().default(true), syncIntervalMs: z.number().default(60000) });
export async function apply(ctx, config) {
    const client = new TeamworkClient(config.apiEndpoint, config.cachePath);
    const serverChoice = ServerChoice.beside(config.cachePath);
    const chosen = await serverChoice.read();
    if (chosen)
        await client.setEndpoint(chosen);
    ctx.effect(() => ctx.llm.registerAdapter([platformProvider], platformAdapter(client)));
    const taskState = await ctx.sessionProjections.register(taskProjection);
    ctx.effect(() => () => taskState.dispose());
    const stamps = new PresetStamps(presetStampPath(config.cachePath));
    await stamps.load();
    const overlay = new TeamOverlay(async (id, item) => ctx.agentPresets.register({
        id, name: `[团队] ${item.name}`,
        ...(item.kind === 'preset' ? { description: item.data.description ?? '' } : {}),
        plugins: item.kind === 'preset' ? [{ name: 'cordis:group', group: true, isolate: { teamworkPreset: true }, config: [{ name: new URL('./preset-context.js', import.meta.url).href, config: {
                            description: item.data.description ?? '', instructions: item.data.instructions ?? '', outputDescription: item.data.outputDescription ?? '',
                            pluginDependencies: item.data.pluginDependencies ?? [],
                            requiredTools: item.data.requiredTools ?? [], optionalTools: item.data.optionalTools ?? [], systemPrompt: item.data.systemPrompt,
                            ...(item.data.modelConfigId ? { modelConfigId: item.data.modelConfigId } : {}),
                            teamId: client.current().teamId, id: item.id, name: item.name, version: item.version,
                        } }] }] : [],
    }));
    const restartRequired = new Set();
    const activePreset = (agent) => ctx.agentPresets.serviceFor(agent, 'teamworkPreset');
    const requirements = (agent, preset) => {
        const tools = ctx.get('tools');
        return toolReport(preset, name => !tools ? 'unknown' : !tools.get(name, agent) ? 'missing' : tools.executable(name, agent) ? 'available' : 'conditional');
    };
    const plugins = async (preset) => {
        const snapshot = client.current();
        const manager = ctx.get('pluginManager');
        const bundles = manager ? await manager.listBundles() : [];
        const entries = manager ? await manager.listPlugins() : [];
        const dependencies = preset ? preset.pluginDependencies ?? [] : (snapshot?.configs ?? []).filter(c => c.kind === 'plugin').map(c => ({ pluginConfigId: c.id, version: c.data.version }));
        return dependencies.map(dependency => {
            const item = snapshot?.configs.find(c => c.id === dependency.pluginConfigId && c.kind === 'plugin');
            const valid = (!preset || preset.teamId === snapshot?.teamId) && item?.kind === 'plugin' && item.data.version === dependency.version;
            const bundle = item?.kind === 'plugin' ? bundles.find(b => b.name === item.data.package) : undefined;
            const state = !valid ? 'catalog-changed' : !manager ? 'unknown' : pluginState(dependency.version, bundle, entries, restartRequired.has(`${item.data.package}@${dependency.version}`));
            return { id: dependency.pluginConfigId, name: item?.name ?? dependency.pluginConfigId, package: item?.kind === 'plugin' ? item.data.package : undefined,
                version: dependency.version, description: item?.kind === 'plugin' ? item.data.description : '', localVersion: bundle?.version, state,
                text: `${item?.name ?? dependency.pluginConfigId} @${dependency.version}（本地 ${bundle?.version ?? '无'}）：${stateText[state]}${state === 'missing' ? `；/teamwork install ${dependency.pluginConfigId}` : ''}` };
        });
    };
    const checkPlugins = async (preset) => {
        const missing = (await plugins(preset)).filter(p => p.state !== 'ready');
        if (missing.length)
            throw new Error(missing.map(p => p.text).join('\n'));
    };
    // A stamp that fails to save is retaken on the session's next request; the session itself is unaffected.
    const keep = (write) => { write.catch(error => ctx.logger.warn('团队预设版本记录保存失败：%s', error.message)); };
    const stamp = (agent, preset) => keep(stamps.set(String(agent.id), preset));
    const detail = (agent, preset, preview = false) => {
        const snapshot = client.current();
        const latest = snapshot?.teamId === preset.teamId ? snapshot.configs.find(c => c.id === preset.id) : undefined;
        const tools = requirements(agent, preset);
        const labels = { available: '已注册（执行仍受宿主权限约束）', conditional: '条件可用，执行时检查', missing: '缺失', unknown: '无法检查' };
        const saved = preview ? null : stamps.get(String(agent.id));
        const revision = latest ? latest.version === preset.version ? '已是最新版本' : `可用版本 v${latest.version}；开始对话后请新建会话使用更新` : '此预设已不在当前团队配置中';
        return [`${preset.name} · v${preset.version}`, `来源：团队 ${preset.teamId} / 预设 ${preset.id}`, revision,
            latest && snapshot && !modelData(snapshot, latest) ? '关联模型已不可用，请联系管理员重新关联团队模型。' : '',
            saved && !sameRevision(saved, preset) ? `恢复前记录为 v${saved.version}，与当前加载版本不同；已阻止继续推理，请新建会话。` : '',
            `当前会话模型：${agent.model.current()?.provider ?? "未选择"}/${agent.model.current()?.model ?? "未选择"}`,
            `预设关联模型：${preset.modelConfigId ?? '旧版独立模型'} · 经 platform；服务端模型策略始终采用当前值`,
            `简介：${preset.description || '未填写'}`, `使用说明：${preset.instructions || '未填写'}`, `输出要求（说明）：${preset.outputDescription || '未填写'}`,
            '提示词来源：本地原有提示词 + 以下团队字面文本', preset.systemPrompt || '（无团队追加提示词）',
            ...tools.map(t => { const declared = snapshot?.configs.filter(c => c.kind === 'plugin' && c.data.providesTools?.includes(t.name)) ?? []; return `${t.required ? '必需' : '可选'}工具 ${t.name}：${labels[t.state]}${declared.length ? '；团队声明来源：' + declared.map(c => `${c.name}（/teamwork install ${c.id}）`).join(', ') : ''}`; }),
            '缺失工具请通过本地插件管理器安装或启用；预设不会自动安装插件或授予权限。',
        ].filter(Boolean).join('\n');
    };
    ctx.on('agent/request', async ({ agent }, next) => {
        const preset = activePreset(agent);
        if (preset) {
            if (preset.pluginDependencies?.length)
                await checkPlugins(preset);
            const saved = stamps.get(String(agent.id));
            if (saved && !sameRevision(saved, preset))
                throw new Error('恢复会话的团队预设版本已变化，请新建会话。');
            const missing = requirements(agent, preset).filter(t => t.required && ['missing', 'unknown'].includes(t.state));
            if (missing.length)
                throw new Error(`缺少必需工具：${missing.map(t => t.name).join(', ')}。请安装或启用后重试。`);
            if (!saved)
                stamp(agent, preset);
        }
        return next();
    });
    const configSync = new ConfigSync(client, overlay, config.autoSync ?? true, config.syncIntervalMs ?? 60000);
    const readiness = async (agent, fresh = false) => {
        const selection = agent.model.current();
        if (!selection)
            throw new Error('尚未选择模型，请先选择本地模型或 /teamwork use <id>。');
        if (selection.provider === platformProvider) {
            if (!client.authenticated())
                throw new Error('团队模型未登录或会话已失效，请 /teamwork login。');
            if (fresh) {
                try {
                    await configSync.sync();
                }
                catch {
                    throw new Error('无法验证当前团队权限，请检查连接和 /teamwork status，必要时重新登录。');
                }
            }
            const snapshot = client.current(), item = snapshot?.configs.find(c => c.id === selection.model);
            if (!snapshot || !item || !modelData(snapshot, item))
                throw new Error('当前团队模型已删除或引用失效，请选择可用模型；预设变更请新建会话。');
        }
        const preset = activePreset(agent);
        if (preset) {
            const saved = stamps.get(String(agent.id));
            if (saved && !sameRevision(saved, preset))
                throw new Error('恢复会话的预设版本不一致，请 /teamwork new <预设ID>。');
            if (preset.pluginDependencies?.length)
                await checkPlugins(preset);
            const missing = requirements(agent, preset).filter(t => t.required && ['missing', 'unknown'].includes(t.state));
            if (missing.length)
                throw new Error(`缺少必需工具：${missing.map(t => t.name).join(', ')}；运行 /teamwork info 查看安装指引。`);
        }
    };
    const actions = new TaskActions(agent => readiness(agent, true), agent => {
        const model = agent.model.current(), usesTeam = model?.provider === platformProvider || !!activePreset(agent);
        return JSON.stringify({ live: ctx.agents.get(agent.id) === agent, seq: agent.session.seq, model, preset: stamps.get(String(agent.id)),
            ...(usesTeam ? { team: client.current(), authenticated: client.authenticated(), authRevision: client.sessionRevision() } : {}) });
    });
    const pendingInstalls = new Map();
    const authorize = async (code) => { pendingInstalls.clear(); try {
        await client.completeLogin(code);
    }
    finally {
        await overlay.apply(client.current());
    } if (config.autoSync !== false)
        await configSync.sync(); };
    const restore = async () => { await client.restore(); await overlay.apply(client.current()); };
    ctx.provide('dshTeamwork', {
        beginLogin: () => client.beginLogin(), completeLogin: authorize,
        sync: () => configSync.sync(),
        status: () => configSync.status(),
        reload: restore,
        list: () => client.current(),
        async logout() { pendingInstalls.clear(); try {
            await client.logout();
        }
        finally {
            await overlay.apply();
        } },
    });
    // Selecting a team preset chooses a model for that session only, never the local default.
    ctx.on('agent-preset/selected', (sessionId) => {
        const agent = ctx.agents.get(sessionId);
        if (!agent)
            return;
        const active = activePreset(agent);
        if (active) {
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
        const item = snapshot?.configs.find(c => `team:${snapshot.teamId}:${c.id}` === selected);
        const preset = activePreset(agent);
        if (preset && !stamps.get(String(agent.id)))
            stamp(agent, preset);
        if (source !== 'resume' && item && item.kind !== 'plugin')
            agent.model.select({ provider: platformProvider, model: item.id });
        return undefined;
    });
    ctx.effect(() => async () => { await configSync.stop(); await overlay.apply(); });
    /** `/teamwork use` and the panel's "use": a team model, or a preset before the session's first turn. */
    const useConfig = async (agent, id) => {
        const snapshot = client.current();
        const item = snapshot?.configs.find(c => c.id === id);
        if (!item || item.kind === 'plugin')
            throw new Error('请选择团队模型或预设 ID');
        if (!modelData(snapshot, item))
            throw new Error('预设引用的团队模型已不可用，请联系管理员。');
        if (item.kind === 'preset') {
            assertBlank(ctx.agents.turnBoundaryOf(agent.session));
            if (item.data.pluginDependencies?.length)
                await checkPlugins({ teamId: snapshot.teamId, pluginDependencies: item.data.pluginDependencies });
            const candidate = { requiredTools: item.data.requiredTools ?? [], optionalTools: item.data.optionalTools ?? [] };
            const unavailable = requirements(agent, candidate).filter(t => t.required && ['missing', 'unknown'].includes(t.state));
            if (unavailable.length)
                throw new Error(`缺少必需工具：${unavailable.map(t => t.name).join(', ')}。请先通过本地插件管理器安装或启用。`);
            await ctx.agentPresets.select(agent, `team:${snapshot.teamId}:${item.id}`);
            const active = activePreset(agent);
            if (active && !sameRevision(stamps.get(String(agent.id)), active))
                stamp(agent, active);
        }
        agent.model.select({ provider: platformProvider, model: item.id });
        return { preset: item.kind === 'preset', text: `本会话已选择 ${item.name}。本地默认配置未改变。` };
    };
    /** Installs a pinned plugin disabled, enables it only when it adds configuration and overrides nothing. Callers confirm first. */
    const installPlugin = async (item, agent) => {
        const spec = `${item.data.package}@${item.data.version}`;
        const manager = ctx.get('pluginManager');
        if (!manager)
            throw new Error('宿主没有插件管理服务');
        const existing = (await manager.listBundles()).find(bundle => bundle.name === item.data.package);
        if (existing && (existing.installed || existing.enabled || existing.availability === 'installation'))
            throw new Error('插件已存在，请通过本地插件管理器管理，团队同步不会覆盖它');
        const installed = await manager.installBundle(spec, { saveExact: true, enabled: false });
        if (installed.error || ['failed', 'cancelled', 'overridden'].includes(installed.application))
            throw new Error(`安装未完成（${installed.error?.code ?? installed.application}），请在本地插件管理器查看诊断后重新检查。`);
        const bundle = (await manager.listBundles()).find(bundle => bundle.name === item.data.package);
        if (!bundle || bundle.error || bundle.version !== item.data.version || bundle.overrides.length || bundle.rows.some(row => row.entryId !== undefined)) {
            throw new Error('插件已下载但未启用：无法确认它只新增配置，或存在本地配置冲突。请在本地插件管理器中检查');
        }
        const result = await manager.setBundleEnabled(item.data.package, true);
        if (result.error || ['failed', 'cancelled', 'overridden'].includes(result.application))
            throw new Error(result.error?.code ?? result.application);
        if (result.application === 'restart-required')
            restartRequired.add(spec);
        const refreshed = (await plugins()).find(p => p.id === item.id);
        const currentPreset = agent && activePreset(agent);
        const missingTools = agent && currentPreset ? requirements(agent, currentPreset).filter(t => t.required && ['missing', 'unknown'].includes(t.state)) : [];
        const toolSummary = currentPreset ? `当前预设必需工具检查：${missingTools.length ? missingTools.map(t => t.name).join(', ') + ' 尚不可用' : '均已注册（运行权限仍需宿主确认）'}` : '';
        return [(result.application === 'restart-required' ? '已安装，请重启 DSH 生效。' : '插件已安装并启用。'), refreshed?.text ?? '', toolSummary].filter(Boolean).join('\n');
    };
    const sessionAgent = (sessionId) => sessionId ? ctx.agents.get(sessionId) : undefined;
    const panel = {
        async state(sessionId) {
            const status = configSync.status(), snapshot = client.current(), agent = sessionAgent(sessionId);
            const presets = [];
            for (const item of snapshot?.configs ?? []) {
                if (item.kind !== 'preset')
                    continue;
                const linked = item.data.modelConfigId ? snapshot.configs.find(c => c.id === item.data.modelConfigId) : undefined;
                const candidate = { requiredTools: item.data.requiredTools ?? [], optionalTools: item.data.optionalTools ?? [] };
                presets.push({
                    id: item.id, name: item.name, version: item.version, description: item.data.description ?? '',
                    model: item.data.modelConfigId ? linked?.name ?? item.data.modelConfigId : `${item.data.provider}/${item.data.model}`,
                    modelAvailable: !!modelData(snapshot, item),
                    tools: agent ? requirements(agent, candidate) : toolReport(candidate, () => 'unknown'),
                    plugins: item.data.pluginDependencies?.length ? await plugins({ teamId: snapshot.teamId, pluginDependencies: item.data.pluginDependencies }) : [],
                });
            }
            const selection = agent?.model.current(), active = agent && activePreset(agent), boundary = agent && ctx.agents.turnBoundaryOf(agent.session);
            return {
                authenticated: status.authenticated,
                team: snapshot ? { id: snapshot.teamId, name: snapshot.teamName, role: snapshot.role } : null,
                consoleUrl: `${client.endpoint}/team`,
                server: client.endpoint,
                defaultServer: serverAddress(config.apiEndpoint),
                sync: { auto: status.autoSync, running: status.syncing, lastSuccess: status.lastSuccess, lastError: status.lastError },
                session: agent ? {
                    id: String(agent.id),
                    model: selection ? { provider: selection.provider, model: selection.model, team: selection.provider === platformProvider } : null,
                    preset: active ? { id: active.id, name: active.name, version: active.version } : null,
                    started: boundary.openTurnStartSeq !== null || boundary.lastTurn > 0,
                } : null,
                presets,
                models: (snapshot?.configs ?? []).flatMap(c => c.kind === 'model' ? [{ id: c.id, name: c.name, version: c.version, upstream: `${c.data.provider}/${c.data.model}` }] : []),
                plugins: await plugins(),
            };
        },
        login: () => client.beginLogin(),
        authorize: (code) => authorize(code),
        sync: () => configSync.sync(),
        async logout() { pendingInstalls.clear(); try {
            await client.logout();
        }
        finally {
            await overlay.apply();
        } },
        async setServer(server) {
            const next = server === null ? serverAddress(config.apiEndpoint) : serverAddress(server);
            pendingInstalls.clear();
            try {
                await client.setEndpoint(next);
                await serverChoice.write(next === serverAddress(config.apiEndpoint) ? undefined : next);
            }
            finally {
                await overlay.apply(client.current());
            }
        },
        async use(sessionId, id) {
            const agent = sessionAgent(sessionId);
            if (!agent)
                throw new Error('当前会话尚未加载，请先在会话中发送或打开它后再试。');
            return (await useConfig(agent, id)).text;
        },
        async install(id, version) {
            const item = client.current()?.configs.find(c => c.id === id);
            if (!item || item.kind !== 'plugin')
                throw new Error('请选择团队插件 ID');
            // The member confirmed this exact version; a sync since then may have changed the pin.
            if (item.data.version !== version)
                throw new Error('团队已更新这个插件的版本，请重新确认安装。');
            return installPlugin(item);
        },
    };
    // The panel's routes exist only where a browser reaches the host (DSH web and desktop), like the panel itself.
    ctx.inject(['connection'], (scoped) => {
        const { connection } = scoped;
        for (const route of panelRoutes(panel))
            scoped.effect(() => { const dispose = connection.fetch.register(route); return () => { void dispose(); }; });
    });
    ctx.inject(['commands'], (child) => {
        child.effect(() => child.commands.register({
            name: 'teamwork', description: '团队登录、配置同步与模型选择',
            input: { hint: 'login | authorize <code> | sync | status | session [check] | continue <指令> | cancel | retry [confirm] | list | tools | plugins [presetId] | info [id] | new <id> | use <id> | install <id> confirm | logout' },
            handler: async ({ agent, rawInput }) => {
                const [action, id, confirmation] = rawInput.trim().split(/\s+/);
                try {
                    if (action === 'session') {
                        let ready = '本地检查通过；继续前会重新验证团队权限。';
                        try {
                            await readiness(agent, id === 'check');
                            if (id === 'check')
                                ready = '当前检查通过；实际请求仍由服务端校验权限。';
                        }
                        catch (error) {
                            ready = error.message;
                        }
                        const task = taskState.stateOf(agent.session), preset = activePreset(agent), selection = agent.model.current();
                        return { kind: 'success', text: [`会话：${agent.id}`, `运行状态：${agent.status === 'running' ? '运行中' : '空闲'} · 最近任务结果：${outcomeText(task.outcome)}`, `任务摘要：${task.task || '暂无已开始任务'}`, `待处理输入：${agent.inbox.nextTurn.length} 个后续任务 / ${agent.inbox.nextStep.length} 个引导输入`, `模型：${selection?.provider ?? '未选择'}/${selection?.model ?? '未选择'}`, `预设：${preset ? preset.name + ' v' + preset.version : '本地或无团队预设'}`, `恢复检查：${ready}`, recoveryHint(task.failureCode, task.outcome)].join('\n') };
                    }
                    if (action === 'cancel') {
                        actions.cancel(agent);
                        return { kind: 'success', text: '已发出取消请求；使用 /teamwork session 查看是否停止。历史、已完成修改和待处理输入保留，不执行回滚。' };
                    }
                    if (action === 'continue') {
                        await actions.submit(agent, rawInput.trim().slice('continue'.length).trim());
                        return { kind: 'success', text: '后续指令已交给 DSH，使用 /teamwork session 查看状态。' };
                    }
                    if (action === 'retry') {
                        if (id !== 'confirm') {
                            actions.review(agent, taskState.stateOf(agent.session).outcome);
                            return { kind: 'success', text: '重试会发送一条后续指令，请 Agent 核对已有结果后继续未完成任务，仍可能产生新的修改。不会重放原工具调用或回滚文件。确认请运行 /teamwork retry confirm（两分钟内有效，会话或配置变化后需重新确认）。' };
                        }
                        await actions.submit(agent, retryInstruction, true);
                        return { kind: 'success', text: '已提交确认后的恢复指令，没有自动重放原工具调用。' };
                    }
                    if (action === 'login')
                        return { kind: 'success', text: `在浏览器完成登录和授权：${client.beginLogin()}\n然后运行 /teamwork authorize <授权码>` };
                    if (action === 'authorize') {
                        await authorize(id ?? '');
                        return { kind: 'success', text: '已授权。运行 /teamwork status 查看配置同步状态。' };
                    }
                    if (action === 'sync') {
                        await configSync.sync();
                        return { kind: 'success', text: '团队配置已同步，本地配置保持不变。' };
                    }
                    if (action === 'logout') {
                        pendingInstalls.clear();
                        try {
                            await client.logout();
                        }
                        finally {
                            await overlay.apply();
                        }
                        return { kind: 'success', text: '已退出并移除团队配置。' };
                    }
                    if (action === 'status') {
                        const status = configSync.status();
                        return { kind: 'success', text: [`登录：${status.authenticated ? '已登录' : '未登录（缓存不代表有效登录）'}`, `自动同步：${status.autoSync ? '开启' : '关闭'}`, `团队：${status.teamId ?? '无'} · 配置：${status.configCount}`, `最近成功同步：${status.lastSuccess ?? '本次启动尚未同步'}`, status.syncing ? '正在同步' : '', status.lastError ?? ''].filter(Boolean).join('\n') };
                    }
                    const snapshot = client.current();
                    const item = snapshot?.configs.find(c => c.id === id);
                    if (action === 'tools') {
                        const tools = child.get('tools');
                        if (!tools)
                            throw new Error('宿主未提供工具检查服务');
                        const rows = tools.definitions(agent).map(tool => {
                            const declared = snapshot?.configs.filter(c => c.kind === 'plugin' && c.data.providesTools?.includes(tool.name)) ?? [];
                            return `${tool.name} · ${tools.executable(tool.name, agent) ? '已注册，执行仍需权限检查' : '条件可用'} · ${declared.length ? '团队声明来源：' + declared.map(c => c.name).join(', ') : '来源：宿主未提供归属信息'}`;
                        });
                        return { kind: 'success', text: ['当前会话可见工具（声明来源不是已验证的运行时归属）：', ...rows, rows.length ? '' : '无可见工具'].filter(Boolean).join('\n') };
                    }
                    if (action === 'plugins') {
                        if (id && item?.kind !== 'preset')
                            throw new Error('请选择团队预设 ID');
                        const preset = item?.kind === 'preset' ? { teamId: snapshot.teamId, pluginDependencies: item.data.pluginDependencies } : undefined;
                        return { kind: 'success', text: (await plugins(preset)).map(p => p.text).join('\n') || '暂无插件依赖。' };
                    }
                    if (action === 'info') {
                        if (!id) {
                            const active = activePreset(agent);
                            return { kind: 'success', text: active ? detail(agent, active) + '\n' + (await plugins(active)).map(p => p.text).join('\n') : '当前会话没有团队预设。运行 /teamwork info <预设ID> 查看详情。' };
                        }
                        if (!item || item.kind !== 'preset')
                            throw new Error('请选择团队预设 ID');
                        const info = { teamId: snapshot.teamId, id: item.id, name: item.name, version: item.version, description: '', instructions: '', outputDescription: '', requiredTools: [], optionalTools: [], ...item.data };
                        return { kind: 'success', text: detail(agent, info, true) + '\n' + (await plugins(info)).map(p => p.text).join('\n') + '\n工具检查基于当前会话；切换后及每次请求前重新检查。' };
                    }
                    if (action === 'new') {
                        if (!item || item.kind !== 'preset')
                            throw new Error('请选择团队预设 ID');
                        if (!modelData(snapshot, item))
                            throw new Error('预设引用的团队模型已不可用，请联系管理员。');
                        const sessionId = `team-${crypto.randomUUID()}`;
                        const agentPreset = `team:${snapshot.teamId}:${item.id}`;
                        await child.agents.create({ sessionId, meta: { cwd: agent.session.header.cwd, agentPreset }, setup: async (agentCtx) => { await child.agentPresets.mount(agentCtx, agentPreset); } });
                        return { kind: 'success', text: `已创建会话 ${sessionId}，使用 ${item.name} v${item.version}。请在会话列表打开；原会话和历史保持不变。` };
                    }
                    if (action === 'use') {
                        const chosen = await useConfig(agent, id ?? '');
                        return { kind: 'success', text: chosen.text + (chosen.preset ? ' 使用 /teamwork info 查看版本与工具状态。' : '') };
                    }
                    if (action === 'install') {
                        if (!item || item.kind !== 'plugin')
                            throw new Error('请选择团队插件 ID');
                        const spec = `${item.data.package}@${item.data.version}`;
                        if (confirmation !== 'confirm') {
                            pendingInstalls.set(String(agent.id), spec);
                            return { kind: 'success', text: `安装并启用 ${spec} 将执行该插件代码。确认请运行 /teamwork install ${item.id} confirm` };
                        }
                        if (pendingInstalls.get(String(agent.id)) !== spec)
                            throw new Error('请先查看当前插件版本的安装说明，再确认安装');
                        pendingInstalls.delete(String(agent.id));
                        return { kind: 'success', text: await installPlugin(item, agent) + '\n运行 /teamwork plugins 或 /teamwork info 重新检查依赖与工具。' };
                    }
                    return { kind: 'success', text: snapshot ? snapshot.configs.map(c => `${c.id} · ${c.kind} · ${c.name} · v${c.version}`).join('\n') || '暂无团队配置' : '尚未同步。运行 /teamwork login 开始。' };
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
        ctx.logger.warn('团队缓存无法恢复，请登录并重新同步。');
    }
    configSync.start();
}
//# sourceMappingURL=index.js.map