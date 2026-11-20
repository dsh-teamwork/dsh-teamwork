/**
 * The Teamwork sidebar panel's wire: what the browser half (`src/web/`) asks
 * the host half for, and the routes that answer it. The routes run the same
 * functions as the `/teamwork` command, in the host process, so the platform
 * token stays here and never reaches the browser. DSH admits only its owner
 * peer to an exact route.
 *
 * This file is imported by both halves, so it imports nothing from the host:
 * `panelRoutes` is handed the host's words (`src/messages.ts`) by its caller.
 */
export const ROUTE_PREFIX = '/api/teamwork';
const json = (value, status = 200) => new Response(JSON.stringify(value ?? null), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export function panelRoutes(ops, voice) {
    const { say } = voice;
    const text = (value, field) => {
        if (typeof value !== 'string' || !value.trim())
            throw new Error(say('request.missing', { field: say(field) }));
        return value.trim();
    };
    const post = (name, handle) => ({
        path: `${ROUTE_PREFIX}/${name}`,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: (request) => voice.speak(async () => {
            const origin = request.headers.get('origin');
            const site = request.headers.get('sec-fetch-site');
            if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
                || (site && site !== 'same-origin')
                || (origin && site !== 'same-origin' && origin !== new URL(request.url).origin)) {
                return json({ error: say('request.invalid') }, 403);
            }
            let body = {};
            try {
                const raw = await request.text();
                if (raw)
                    body = JSON.parse(raw);
            }
            catch {
                return json({ error: say('request.invalid') }, 400);
            }
            try {
                return json((await handle(body)) ?? {});
            }
            catch (error) {
                return json({ error: error.message || say('request.failed') }, 400);
            }
        }),
    });
    const session = (body) => (typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : undefined);
    return [
        post('state', (body) => ops.state(session(body))),
        post('profile', () => ops.profile()),
        post('summary', (body) => ops.summary(text(body.teamId, 'field.team'))),
        post('update-profile', (body) => {
            if (body.name !== null && (typeof body.name !== 'string' || body.name.length > 80))
                throw new Error(say('profile.nameTooLong'));
            if (body.locale !== 'en' && body.locale !== 'zh-CN')
                throw new Error(say('profile.badLocale'));
            return ops.updateProfile({ name: body.name, locale: body.locale });
        }),
        post('login', () => ops.login()),
        post('authorize', (body) => ops.authorize(text(body.code, 'field.code'))),
        post('sync', () => ops.sync()),
        post('logout', () => ops.logout()),
        // A path is taken as given, never trimmed: a folder's name may end in a space.
        post('workspace', (body) => {
            if (typeof body.path !== 'string' || !body.path)
                throw new Error(say('request.missing', { field: say('field.workspace') }));
            return ops.setWorkspace(text(body.teamId, 'field.team'), body.path);
        }),
        post('server', (body) => ops.setServer(body.server === null ? null : text(body.server, 'field.server'))),
        post('use', async (body) => ({ message: await ops.use(text(body.sessionId, 'field.session'), text(body.id, 'field.config')) })),
        post('install', async (body) => ({ message: await ops.install(text(body.id, 'field.plugin'), text(body.version, 'field.version')) })),
        post('owner-pin', body => {
            if (body.pin !== null && typeof body.pin !== 'string')
                throw new Error(say('request.invalid'));
            return ops.setOwnerPin(body.pin);
        }),
        post('pair-phone', () => ops.pairPhone()),
        post('decide-phone', (body) => ops.decidePhone(text(body.id, 'field.device'), body.accept === true)),
        post('revoke-phone', (body) => ops.revokePhone(text(body.id, 'field.device'))),
    ];
}
//# sourceMappingURL=panel.js.map