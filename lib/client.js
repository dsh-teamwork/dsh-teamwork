import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
const common = { id: z.string().min(1), name: z.string(), version: z.number().int().positive() };
const route = { provider: z.string().min(1), model: z.string().min(1), contextWindow: z.number().int().positive().max(10000000).optional(), maxTokens: z.number().int().positive().max(10000000).optional() };
const teamSchema = z.object({ teamId: z.string().min(1), teamName: z.string(), role: z.enum(['admin', 'member']), configs: z.array(z.discriminatedUnion('kind', [
        z.object({ ...common, kind: z.literal('model'), data: z.object(route) }),
        z.object({ ...common, kind: z.literal('preset'), data: z.object({
                ...route, provider: route.provider.optional(), model: route.model.optional(), modelConfigId: z.string().min(1).optional(),
                description: z.string().optional(), instructions: z.string().optional(), outputDescription: z.string().optional(),
                pluginDependencies: z.array(z.object({ pluginConfigId: z.string().min(1), version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/) })).max(30).optional(),
                requiredTools: z.array(z.string().min(1)).optional(), optionalTools: z.array(z.string().min(1)).optional(),
                systemPrompt: z.string().default(''),
            }).refine(d => d.modelConfigId ? !d.provider && !d.model && d.contextWindow === undefined && d.maxTokens === undefined : !!d.provider && !!d.model, 'Invalid preset model reference') }),
        z.object({ ...common, kind: z.literal('plugin'), data: z.object({ package: z.string().regex(/^(?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/), version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/), providesTools: z.array(z.string().min(1)).optional(), description: z.string().default('') }) }),
    ])) });
/** `GET /api/configs`: every team the member is in, each with its configuration (platform ADR 0013). */
export const snapshotSchema = z.object({ teams: z.array(teamSchema) });
/** Every team's configuration in one list. Ids are the server's primary keys, so they are unique across teams. */
export const allConfigs = (snapshot) => (snapshot?.teams ?? []).flatMap(team => team.configs);
export const findConfig = (snapshot, id) => allConfigs(snapshot).find(c => c.id === id);
/** The team a configuration belongs to. */
export const teamOf = (snapshot, configId) => snapshot?.teams.find(team => team.configs.some(c => c.id === configId));
/**
 * A server address as the plugin stores and calls it: https anywhere, plain http only on
 * this machine, no query or fragment, no trailing slash. Throws a message for the member.
 */
export function serverAddress(input) {
    let url;
    try {
        url = new URL(input.trim());
    }
    catch {
        throw new Error('服务器地址无效，请输入完整地址，例如 https://www.dshteamwork.com');
    }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
        throw new Error('服务器地址必须使用 https；只有本机地址（localhost）可以用 http');
    if (url.search || url.hash || url.username || url.password)
        throw new Error('服务器地址不能包含查询参数、片段或账号信息');
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}
export class TeamworkClient {
    cachePath;
    request;
    token;
    verifier;
    snapshot;
    epoch = 0;
    operations = Promise.resolve();
    enqueue(operation) {
        const next = this.operations.then(operation, operation);
        this.operations = next.catch(() => { });
        return next;
    }
    server;
    constructor(endpoint, cachePath, request = fetch) {
        this.cachePath = cachePath;
        this.request = request;
        this.server = serverAddress(endpoint);
    }
    /** The DSH Teamwork server this client signs in to and syncs from. */
    get endpoint() { return this.server; }
    /**
     * Points the client at another server. A token and a team belong to one server, so
     * this signs out and drops the cached configuration, as `logout` does.
     */
    setEndpoint(endpoint) {
        const next = serverAddress(endpoint);
        if (next === this.server)
            return Promise.resolve();
        this.server = next;
        return this.logout();
    }
    /** The sign-in page's address; with `redirectUri`, the page sends the code there instead of showing it. */
    beginLogin(redirectUri) {
        this.epoch++;
        this.verifier = randomBytes(32).toString('base64url');
        const challenge = createHash('sha256').update(this.verifier).digest('base64url');
        return `${this.endpoint}/plugin?${new URLSearchParams({ challenge, ...(redirectUri ? { redirect_uri: redirectUri } : {}) })}`;
    }
    /** Takes the code alone or the whole `/teamwork authorize <code>` line the sign-in page shows, so the panel accepts what was copied. */
    completeLogin(pasted) {
        const code = pasted.trim().replace(/^\/?teamwork\s+authorize\s+/i, '');
        const verifier = this.verifier, epoch = this.epoch;
        return this.enqueue(async () => {
            if (!verifier || epoch !== this.epoch)
                throw new Error('Begin login first');
            const result = z.object({ token: z.string().min(1) }).parse(await this.api('auth/plugin/token', 'POST', { code, verifier }));
            // Platform tokens are stateless and cannot be revoked server-side; a late one is simply dropped.
            if (epoch !== this.epoch)
                throw new Error('Login cancelled');
            await this.clear();
            this.verifier = undefined;
            this.token = result.token;
        });
    }
    async api(path, method = 'GET', body, token = this.token) {
        const response = await this.request(`${this.endpoint}/api/${path}`, {
            method, headers: { 'Content-Type': 'application/json', Origin: new URL(this.endpoint).origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
            if (path === 'configs' && [401, 403].includes(response.status)) {
                this.token = undefined;
                await this.clear();
            }
            throw new Error(`Teamwork request failed (${response.status})`);
        }
        return response.json();
    }
    sync() { return this.enqueue(() => this.syncOnce()); }
    async syncOnce() {
        if (!this.token)
            throw new Error('Sign in first');
        const epoch = this.epoch;
        const next = snapshotSchema.parse(await this.api('configs'));
        if (epoch !== this.epoch)
            throw new Error('Session changed during synchronization');
        const ids = allConfigs(next).map(c => c.id);
        if (new Set(ids).size !== ids.length)
            throw new Error('Duplicate configuration ID');
        await mkdir(dirname(this.cachePath), { recursive: true, mode: 0o700 });
        const temporary = `${this.cachePath}.${randomBytes(8).toString('hex')}.tmp`;
        try {
            await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
            await rename(temporary, this.cachePath);
        }
        finally {
            await rm(temporary, { force: true });
        }
        this.snapshot = next;
        return next;
    }
    async restore() {
        try {
            this.snapshot = snapshotSchema.parse(JSON.parse(await readFile(this.cachePath, 'utf8')));
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
            this.snapshot = undefined;
        }
        return this.snapshot;
    }
    platformCredential() { if (!this.token)
        throw new Error('Sign in to platform first'); return this.token; }
    sessionRevision() { return this.epoch; }
    authenticated() { return !!this.token; }
    current() { return this.snapshot; }
    async clear() { this.snapshot = undefined; await rm(this.cachePath, { force: true }); }
    logout() { this.epoch++; return this.enqueue(() => this.logoutOnce()); }
    /** Forgets the token locally; the platform cannot revoke it, but a removed member is refused on every request. */
    async logoutOnce() {
        this.token = undefined;
        this.verifier = undefined;
        await this.clear();
    }
}
/**
 * Reconcile only registrations owned by this plugin, for every team at once. The host's local registry is never
 * enumerated or mutated. A registration is `team:<teamId>:<configId>`, and a team's new name re-registers its entries.
 */
export class TeamOverlay {
    register;
    owned = new Map();
    constructor(register) {
        this.register = register;
    }
    operations = Promise.resolve();
    apply(snapshot) { const next = this.operations.then(() => this.reconcile(snapshot)); this.operations = next.catch(() => { }); return next; }
    async reconcile(snapshot) {
        const desired = new Map((snapshot?.teams ?? []).flatMap(team => team.configs.filter(c => c.kind !== 'plugin')
            .map(config => [`team:${team.teamId}:${config.id}`, { config, team, signature: JSON.stringify([team.teamName, config]) }])));
        for (const [id, old] of this.owned)
            if (old.signature !== desired.get(id)?.signature) {
                await old.dispose();
                this.owned.delete(id);
            }
        for (const [id, { config, team, signature }] of desired)
            if (!this.owned.has(id)) {
                const dispose = await this.register(id, config, team);
                this.owned.set(id, { signature, dispose });
            }
    }
}
/** References resolve within the configuration's own team only; never across teams, never to local models. */
export function modelData(snapshot, config) {
    if (config.kind === 'plugin')
        return undefined;
    if (config.kind === 'preset' && config.data.modelConfigId) {
        const model = teamOf(snapshot, config.id)?.configs.find(c => c.id === config.data.modelConfigId && c.kind === 'model');
        return model?.kind === 'model' ? model.data : undefined;
    }
    return config.data;
}
/**
 * The server the member picked in the panel, kept beside the configuration cache
 * (`teamwork-cache.json` → `teamwork-cache.server.json`). Absent, the profile's
 * `apiEndpoint` applies, which defaults to the hosted service.
 */
export class ServerChoice {
    path;
    constructor(path) {
        this.path = path;
    }
    static beside(cachePath) { return new ServerChoice(cachePath.replace(/(\.json)?$/, '.server.json')); }
    async read() {
        try {
            return serverAddress(z.object({ server: z.string() }).parse(JSON.parse(await readFile(this.path, 'utf8'))).server);
        }
        catch {
            return undefined;
        }
    }
    async write(server) {
        if (server === undefined) {
            await rm(this.path, { force: true });
            return;
        }
        await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
        const temporary = `${this.path}.${randomBytes(8).toString('hex')}.tmp`;
        try {
            await writeFile(temporary, JSON.stringify({ server }), { mode: 0o600 });
            await rename(temporary, this.path);
        }
        finally {
            await rm(temporary, { force: true });
        }
    }
}
//# sourceMappingURL=client.js.map