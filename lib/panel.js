/**
 * The Teamwork sidebar panel's wire: what the browser half (`src/web/`) asks
 * the host half for, and the routes that answer it. The routes run the same
 * functions as the `/teamwork` command, in the host process, so the platform
 * token stays here and never reaches the browser. DSH admits only its owner
 * peer to an exact route.
 *
 * This file is imported by both halves: types only, no Node or host imports.
 */
export const ROUTE_PREFIX = '/api/teamwork';
const json = (value, status = 200) => new Response(JSON.stringify(value ?? null), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const text = (value, field) => {
    if (typeof value !== 'string' || !value.trim())
        throw new Error(`缺少 ${field}`);
    return value.trim();
};
export function panelRoutes(ops) {
    const post = (name, handle) => ({
        path: `${ROUTE_PREFIX}/${name}`,
        methods: ['POST'],
        requestBody: 'buffered',
        async fetch(request) {
            let body = {};
            try {
                const raw = await request.text();
                if (raw)
                    body = JSON.parse(raw);
            }
            catch {
                return json({ error: '请求格式无效' }, 400);
            }
            try {
                return json((await handle(body)) ?? {});
            }
            catch (error) {
                return json({ error: error.message || '操作失败' }, 400);
            }
        },
    });
    const session = (body) => (typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : undefined);
    return [
        post('state', (body) => ops.state(session(body))),
        post('login', () => ({ url: ops.login() })),
        post('authorize', (body) => ops.authorize(text(body.code, '授权码'))),
        post('sync', () => ops.sync()),
        post('logout', () => ops.logout()),
        post('server', (body) => ops.setServer(body.server === null ? null : text(body.server, '服务器地址'))),
        post('use', async (body) => ({ message: await ops.use(text(body.sessionId, '会话'), text(body.id, '配置 ID')) })),
        post('install', async (body) => ({ message: await ops.install(text(body.id, '插件 ID'), text(body.version, '版本')) })),
    ];
}
//# sourceMappingURL=panel.js.map