import z from '@deepseek-ai/schemastery';
import { TeamOverlay, TeamworkClient } from './client.js';
export const name = 'dsh-teamwork';
export const inject = ['agentPresets', 'agents'];
export const Config = z.object({ apiEndpoint: z.string().default('http://localhost:3000'), cachePath: z.string().required() });
export async function apply(ctx, config) {
    const client = new TeamworkClient(config.apiEndpoint, config.cachePath);
    const overlay = new TeamOverlay(async (id, item) => ctx.agentPresets.register({
        id, name: `[团队] ${item.name}`,
        plugins: item.kind === 'preset' && item.data.systemPrompt ? [{ name: new URL('./prompt.js', import.meta.url).href, config: { text: item.data.systemPrompt } }] : [],
    }));
    const pendingInstalls = new Map();
    const authorize = async (code) => { pendingInstalls.clear(); try {
        await client.completeLogin(code);
    }
    finally {
        await overlay.apply(client.current());
    } };
    const restore = async () => { await client.restore(); await overlay.apply(client.current()); };
    ctx.provide('dshTeamwork', {
        beginLogin: () => client.beginLogin(), completeLogin: authorize,
        async sync() { try {
            await client.sync();
        }
        finally {
            await overlay.apply(client.current());
        } },
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
    ctx.on('agent/created', ({ agent }) => {
        const snapshot = client.current();
        const selected = ctx.agentPresets.presetForSession(agent.session);
        const item = snapshot?.configs.find(c => `team:${snapshot.teamId}:${c.id}` === selected);
        if (item && item.kind !== 'plugin')
            agent.model.select({ provider: item.data.provider, model: item.data.model });
        return undefined;
    });
    ctx.effect(() => async () => { await overlay.apply(); });
    ctx.inject(['commands'], (child) => {
        child.effect(() => child.commands.register({
            name: 'team', description: '团队登录、配置同步与模型选择',
            input: { hint: 'login | authorize <code> | sync | list | use <id> | install <id> confirm | logout' },
            handler: async ({ agent, rawInput }) => {
                const [action, id, confirmation] = rawInput.trim().split(/\s+/);
                try {
                    if (action === 'login')
                        return { kind: 'success', text: `在浏览器完成登录和授权：${client.beginLogin()}\n然后运行 /team authorize <授权码>` };
                    if (action === 'authorize') {
                        await authorize(id ?? '');
                        return { kind: 'success', text: '已登录。运行 /team sync 拉取团队配置。' };
                    }
                    if (action === 'sync') {
                        try {
                            await client.sync();
                        }
                        finally {
                            await overlay.apply(client.current());
                        }
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
                    const snapshot = client.current();
                    const item = snapshot?.configs.find(c => c.id === id);
                    if (action === 'use') {
                        if (!item || item.kind === 'plugin')
                            throw new Error('请选择团队模型或预设 ID');
                        if (item.kind === 'preset')
                            await child.agentPresets.select(agent, `team:${snapshot.teamId}:${item.id}`);
                        agent.model.select({ provider: item.data.provider, model: item.data.model });
                        return { kind: 'success', text: `本会话已选择 ${item.name}。本地默认配置未改变。` };
                    }
                    if (action === 'install') {
                        if (!item || item.kind !== 'plugin')
                            throw new Error('请选择团队插件 ID');
                        const spec = `${item.data.package}@${item.data.version}`;
                        if (confirmation !== 'confirm') {
                            pendingInstalls.set(String(agent.id), spec);
                            return { kind: 'success', text: `安装并启用 ${spec} 将执行该插件代码。确认请运行 /team install ${item.id} confirm` };
                        }
                        if (pendingInstalls.get(String(agent.id)) !== spec)
                            throw new Error('请先查看当前插件版本的安装说明，再确认安装');
                        pendingInstalls.delete(String(agent.id));
                        const manager = child.get('pluginManager');
                        if (!manager)
                            throw new Error('宿主没有插件管理服务');
                        const existing = (await manager.listBundles()).find(bundle => bundle.name === item.data.package);
                        if (existing && (existing.installed || existing.enabled || existing.availability === 'installation'))
                            throw new Error('插件已存在，请通过本地插件管理器管理，团队同步不会覆盖它');
                        const installed = await manager.installBundle(spec, { saveExact: true, enabled: false });
                        if (installed.error || ['failed', 'cancelled', 'overridden'].includes(installed.application))
                            throw new Error(installed.error?.code ?? installed.application);
                        const bundle = (await manager.listBundles()).find(bundle => bundle.name === item.data.package);
                        if (!bundle || bundle.error || bundle.version !== item.data.version || bundle.overrides.length || bundle.rows.some(row => row.entryId !== undefined)) {
                            throw new Error('插件已下载但未启用：无法确认它只新增配置，或存在本地配置冲突。请在本地插件管理器中检查');
                        }
                        const result = await manager.setBundleEnabled(item.data.package, true);
                        if (result.error || ['failed', 'cancelled', 'overridden'].includes(result.application))
                            throw new Error(result.error?.code ?? result.application);
                        return { kind: 'success', text: result.application === 'restart-required' ? '已安装，请重启 DSH 生效。' : '插件已安装并启用。' };
                    }
                    return { kind: 'success', text: snapshot ? snapshot.configs.map(c => `${c.id} · ${c.kind} · ${c.name} · v${c.version}`).join('\n') || '暂无团队配置' : '尚未同步。运行 /team login 开始。' };
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
}
//# sourceMappingURL=index.js.map