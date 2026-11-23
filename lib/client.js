import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { say } from './messages.js';
const common = { builtin: z.literal('team-assistant').optional(), id: z.string().min(1), name: z.string(), version: z.number().int().positive() };
const route = { provider: z.string().min(1), model: z.string().min(1), contextWindow: z.number().int().positive().max(10000000).optional(), maxTokens: z.number().int().positive().max(10000000).optional() };
const pluginDataSchema = z.object({ artifactId: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/).optional(), sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(), package: z.string().regex(/^(?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/), version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/), providesTools: z.array(z.string().min(1)).optional(), description: z.string().default('') });
const teamSchema = z.object({ teamId: z.string().min(1), teamName: z.string(), role: z.enum(['admin', 'member']), pluginVersions: z.array(z.object({ configId: z.string(), name: z.string(), data: pluginDataSchema })).optional(), configs: z.array(z.discriminatedUnion('kind', [
        // `offline`: a hosted model its service took out of service; it stays in the team and comes back with it.
        z.object({ ...common, kind: z.literal('model'), data: z.object({ ...route, vision: z.boolean().optional(), reasoningEfforts: z.array(z.enum(['minimal', 'low', 'medium', 'high', 'xhigh', 'max'])).optional(), offline: z.boolean().optional() }) }),
        z.object({ ...common, kind: z.literal('preset'), data: z.object({
                ...route, inheritModel: z.boolean().optional(), provider: route.provider.optional(), model: route.model.optional(), modelConfigId: z.string().min(1).optional(),
                avatar: z.string().optional(), description: z.string().optional(), instructions: z.string().optional(), outputDescription: z.string().optional(),
                pluginDependencies: z.array(z.object({ pluginConfigId: z.string().min(1), version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/) })).max(30).optional(),
                requiredTools: z.array(z.string().min(1)).optional(), optionalTools: z.array(z.string().min(1)).optional(),
                systemPrompt: z.string().default(''),
            }).refine(d => d.inheritModel ? !d.modelConfigId && !d.provider && !d.model && d.contextWindow === undefined && d.maxTokens === undefined : d.modelConfigId ? !d.provider && !d.model && d.contextWindow === undefined && d.maxTokens === undefined : !!d.provider && !!d.model, 'Invalid preset model reference') }),
        z.object({ ...common, kind: z.literal('plugin'), data: pluginDataSchema }),
    ])) });
/** `GET /api/configs`: every team the member is in, each with its configuration (platform ADR 0013). */
export const snapshotSchema = z.object({ teams: z.array(teamSchema) });
/** Every team's configuration in one list. Ids are the server's primary keys, so they are unique across teams. */
export const allConfigs = (snapshot) => (snapshot?.teams ?? []).flatMap(team => team.configs);
export const findConfig = (snapshot, id) => allConfigs(snapshot).find(c => c.id === id);
/** The team a configuration belongs to. */
export const teamOf = (snapshot, configId) => snapshot?.teams.find(team => team.configs.some(c => c.id === configId) || team.pluginVersions?.some(p => p.configId === configId));
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
        throw new Error(say('server.invalid'));
    }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
        throw new Error(say('server.https'));
    if (url.search || url.hash || url.username || url.password)
        throw new Error(say('server.extra'));
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}
/** A page the server refused: its status, code (`page_stale`, `page_too_large`, …) and what it said was wrong. */
export class PageError extends Error {
    status;
    code;
    detail;
    constructor(status, code, detail) {
        super(`Page refused (${status}${code ? ` ${code}` : ''})${detail ? `: ${detail}` : ''}`);
        this.status = status;
        this.code = code;
        this.detail = detail;
    }
}
const pointsSchema = z.string().regex(/^\d+(?:\.\d{1,9})?$/);
const budgetSchema = z.object({
    remaining: pointsSchema.nullable(),
    state: z.enum(['known', 'unlimited', 'unconfirmed']), resetAt: z.string().nullable(),
    tokenLimited: z.boolean(), exhausted: z.boolean(),
});
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
        const out = this.logout(); // revokes the token at the server that issued it
        this.server = next;
        return out;
    }
    /**
     * Where the sign-in is kept across restarts (platform ADR 0060): the token and the server it belongs to, beside the
     * cache and readable by this user alone. The server can revoke it, and it lapses after 30 days unused.
     */
    get tokenPath() { return this.cachePath.replace(/\.json$/, '') + '.token.json'; }
    async saveToken(token) {
        await mkdir(dirname(this.tokenPath), { recursive: true, mode: 0o700 });
        const temporary = `${this.tokenPath}.${randomBytes(8).toString('hex')}.tmp`;
        try {
            await writeFile(temporary, JSON.stringify({ server: this.server, token }), { mode: 0o600 });
            await rename(temporary, this.tokenPath);
        }
        finally {
            await rm(temporary, { force: true });
        }
    }
    forgetToken() { return rm(this.tokenPath, { force: true }); }
    /** Best effort: a token the server is not told about still lapses after 30 days unused. */
    async revoke(server, token) {
        try {
            await this.request(`${server}/api/auth/plugin/token`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000), redirect: 'error' });
        }
        catch { /* offline: the grant lapses on its own */ }
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
            if (epoch !== this.epoch) {
                await this.revoke(this.server, result.token);
                throw new Error('Login cancelled');
            }
            await this.clear();
            this.epoch++;
            this.verifier = undefined;
            this.token = result.token;
            await this.saveToken(result.token);
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
                await this.forgetToken();
            }
            throw new Error(`Teamwork request failed (${response.status})`);
        }
        return response.json();
    }
    async downloadArtifact(teamId, id, digest) {
        if (!this.token || !/^[A-Za-z0-9_-]{1,32}$/.test(id) || !/^[a-f0-9]{64}$/.test(digest))
            throw new Error('Invalid artifact');
        const epoch = this.epoch;
        const response = await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/artifacts/${id}/download`, { headers: { Authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(30000), redirect: 'error' });
        if (!response.ok)
            throw new Error(`Artifact download failed (${response.status})`);
        const reader = response.body?.getReader();
        if (!reader)
            throw new Error('Missing artifact body');
        const chunks = [];
        let size = 0;
        try {
            for (;;) {
                const part = await reader.read();
                if (part.done)
                    break;
                size += part.value.length;
                if (size > 10 * 1024 * 1024)
                    throw new Error('Artifact exceeds 10 MiB');
                chunks.push(part.value);
            }
        }
        finally {
            await reader.cancel();
        }
        const bytes = Buffer.concat(chunks);
        if (createHash('sha256').update(bytes).digest('hex') !== digest)
            throw new Error('Artifact digest mismatch');
        if (epoch !== this.epoch)
            throw new Error('Account changed during download');
        const directory = join(dirname(this.cachePath), 'teamwork-artifacts');
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const path = join(directory, `${digest}.tgz`), temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`;
        try {
            await writeFile(temporary, bytes, { mode: 0o600 });
            await rename(temporary, path);
        }
        finally {
            await rm(temporary, { force: true });
        }
        return path;
    }
    /**
     * Publishes a page (docs/tech/pages.md in the platform repository): a new one, or a version on top of `baseVersion`.
     * `files` are paths within the page and their bytes; the server holds every rule and limit, and says which broke.
     */
    async publishPage(teamId, input, files, signal) {
        if (!this.token)
            throw new Error('Sign in to Teamwork first');
        const epoch = this.epoch, form = new FormData();
        const { pageId, ...meta } = input;
        form.append('meta', JSON.stringify(meta));
        for (const file of files)
            form.append(file.path, new Blob([new Uint8Array(file.bytes)]), file.path.split('/').pop());
        const path = pageId ? `pages/${encodeURIComponent(pageId)}/versions` : 'pages';
        const response = await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${this.token}`, Origin: new URL(this.endpoint).origin }, body: form, signal, redirect: 'error' });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
            throw new PageError(response.status, String(body.error ?? ''), (body.issues ?? []).map(i => i.message).join('; '));
        const page = z.object({ id: z.string().min(1), teamId: z.string(), version: z.number().int().positive(), title: z.string(), kind: z.enum(['html', 'markdown', 'svg']) }).parse(body);
        if (epoch !== this.epoch)
            throw new Error('Account changed during upload');
        return page;
    }
    /**
     * Whether the signed-in server searches the web for its members (the hosted service does, on its own key; a
     * self-hosted server has no such route): true, false, or undefined when the server could not be asked.
     */
    async webSearchOffered(signal) {
        if (!this.token)
            return false;
        try {
            const response = await this.request(`${this.endpoint}/api/web/search`, { headers: { Authorization: `Bearer ${this.token}` }, signal: signal ?? AbortSignal.timeout(10000), redirect: 'error' });
            if (response.status === 404 || response.status === 401 || response.status === 403)
                return false;
            if (!response.ok)
                return undefined;
            return (await response.json()).available === true;
        }
        catch {
            return undefined;
        }
    }
    /** One web search through the signed-in server; only the query and the count leave this computer. */
    async webSearch(query, count, signal) {
        if (!this.token)
            throw new Error('Teamwork search needs a Teamwork sign-in: run /teamwork login, or choose another search provider in DSH settings.');
        const response = await this.request(`${this.endpoint}/api/web/search`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}`, Origin: new URL(this.endpoint).origin }, body: JSON.stringify({ query, ...(count ? { count: Math.min(count, 20) } : {}) }), signal: signal ?? AbortSignal.timeout(30000), redirect: 'error' });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
            throw new Error(response.status === 429 ? 'Today’s Teamwork search allowance is used up; it renews at 00:00 UTC. Choose another search provider in DSH settings to keep searching.'
                : response.status === 401 ? 'The Teamwork sign-in has lapsed: run /teamwork login, then search again.'
                    : `Teamwork search failed (${response.status}${body.error ? ` ${body.error}` : ''}); try again shortly.`);
        return z.object({ sources: z.array(z.object({ url: z.string(), title: z.string().optional(), snippet: z.string().optional(), summary: z.string().optional(), publishedAt: z.string().optional() })) }).parse(body).sources;
    }
    /** The files of a page's version, fetched through a view address minted for this member, as the console's frame fetches them. */
    async readPage(teamId, pageId, version, signal) {
        if (!this.token)
            throw new Error('Sign in to Teamwork first');
        const epoch = this.epoch;
        const response = await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/pages/${encodeURIComponent(pageId)}/versions/${version}/view`, { method: 'POST', headers: { Authorization: `Bearer ${this.token}`, Origin: new URL(this.endpoint).origin }, signal, redirect: 'error' });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
            throw new PageError(response.status, String(body.error ?? ''), '');
        const view = z.object({ url: z.string().url(), files: z.array(z.object({ path: z.string(), size: z.number() })) }).parse(body);
        const files = [];
        for (const file of view.files) {
            const got = await this.request(view.url + file.path.split('/').map(encodeURIComponent).join('/'), { signal, redirect: 'error' });
            if (!got.ok)
                throw new Error(`Could not read ${file.path} (${got.status})`);
            files.push({ path: file.path, bytes: new Uint8Array(await got.arrayBuffer()) });
        }
        if (epoch !== this.epoch)
            throw new Error('Account changed during download');
        return files;
    }
    async submitPlugin(teamId, bytes, sha256, input, signal) {
        if (!this.token || createHash('sha256').update(bytes).digest('hex') !== sha256)
            throw new Error('Prepared archive changed');
        const epoch = this.epoch;
        const response = await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/artifacts`, { method: 'POST', headers: { Authorization: `Bearer ${this.token}`, Origin: new URL(this.endpoint).origin, 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(bytes), signal, redirect: 'error' });
        if (!response.ok)
            throw new Error(`Upload failed (${response.status}): ${String((await response.json().catch(() => ({}))).error ?? '')}`);
        const artifact = z.object({ id: z.string().min(1), package: z.string(), version: z.string(), sha256: z.string() }).parse(await response.json());
        if (epoch !== this.epoch)
            throw new Error('Account changed during upload');
        if (artifact.sha256 !== sha256)
            throw new Error('Uploaded archive digest mismatch');
        const { name, ...proposalInput } = input;
        const draft = await this.assistantChange(teamId, 'saveDraft', { ...proposalInput, config: { kind: 'plugin', name, data: { package: artifact.package, version: artifact.version, artifactId: artifact.id, sha256 } } }, signal);
        const row = z.object({ id: z.string(), revision: z.number() }).parse(draft);
        return this.assistantChange(teamId, 'submit', { id: row.id, revision: row.revision }, signal);
    }
    async assistantChange(teamId, action, input, signal) {
        if (!this.token)
            throw new Error('Sign in first');
        const epoch = this.epoch;
        const id = typeof input.id === 'string' ? encodeURIComponent(input.id) : '';
        const { id: _id, ...payload } = input;
        const routes = {
            saveDraft: { path: 'submissions', method: 'POST', body: payload },
            editDraft: { path: `submissions/${id}`, method: 'PUT', body: payload },
            createConfig: { path: 'configs', method: 'POST', body: payload },
            updateConfig: { path: `configs/${id}`, method: 'PATCH', body: payload },
            deleteConfig: { path: `configs/${id}`, method: 'DELETE', body: undefined },
            setBudget: { path: 'budgets', method: 'PUT', body: payload },
            removeMember: { path: `members/${id}`, method: 'DELETE', body: undefined },
            restore: { path: `history/${id}/restore`, method: 'POST', body: payload },
            submit: { path: `submissions/${id}/submit`, method: 'POST', body: { revision: input.revision } },
            approve: { path: `submissions/${id}/approve`, method: 'POST', body: { revision: input.revision, reason: input.reason } },
            reject: { path: `submissions/${id}/reject`, method: 'POST', body: { revision: input.revision, reason: input.reason } },
            withdraw: { path: `submissions/${id}/withdraw`, method: 'POST', body: { revision: input.revision } },
        };
        const route = routes[action];
        if (!route)
            throw new Error('Unsupported operation');
        const response = await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/${route.path}`, { method: route.method, headers: { Authorization: `Bearer ${this.token}`, Origin: new URL(this.endpoint).origin, 'Content-Type': 'application/json' }, body: JSON.stringify(route.body), signal, redirect: 'error' });
        if (!response.ok)
            throw new Error(`Teamwork operation failed (${response.status}): ${failure(await response.json().catch(() => ({})))}`);
        const result = response.status === 204 ? null : await response.json();
        if (epoch !== this.epoch)
            throw new Error('Account changed during operation');
        return result;
    }
    async reviewPreview(teamId, id, signal) {
        if (!this.token || !/^[A-Za-z0-9_-]{1,32}$/.test(id))
            throw Error('Invalid submission');
        const epoch = this.epoch;
        const response = await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/submissions/${id}`, { headers: { Authorization: `Bearer ${this.token}` }, signal, redirect: 'error' });
        if (!response.ok)
            throw Error(`Review preview failed (${response.status})`);
        const value = await response.json();
        if (epoch !== this.epoch)
            throw Error('Account changed');
        return value;
    }
    async exportUsage(teamId, filters, signal) {
        if (!this.token)
            throw Error('Sign in first');
        const epoch = this.epoch;
        const response = await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/usage/export?${new URLSearchParams(filters)}`, { headers: { Authorization: `Bearer ${this.token}` }, signal, redirect: 'error' });
        if (!response.ok)
            throw Error(`Usage export failed (${response.status})`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > 10 * 1024 * 1024)
            throw Error('Export exceeds local size limit');
        if (epoch !== this.epoch)
            throw Error('Account changed');
        const directory = join(dirname(this.cachePath), 'teamwork-exports');
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const path = join(directory, `usage-${randomBytes(8).toString('hex')}.csv`);
        await writeFile(path, bytes, { mode: 0o600 });
        return path;
    }
    /** Narrow team operations; credentials never enter model-visible results. */
    async assistantRead(teamId, action, signal, filters = {}) {
        if (!this.token)
            throw new Error('Sign in first');
        const epoch = this.epoch;
        const path = action === 'members' ? '' : `/${action}`;
        const response = await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}${path}?${new URLSearchParams(filters)}`, {
            headers: { Authorization: `Bearer ${this.token}` }, signal, redirect: 'error',
        });
        if (!response.ok)
            throw new Error(`Teamwork request failed (${response.status}): ${failure(await response.json().catch(() => ({})))}`);
        const data = await response.json();
        if (epoch !== this.epoch)
            throw new Error('Session changed during operation');
        return data;
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
    /** The cached configuration, and the sign-in kept for this server, as the last run left them. */
    async restore() {
        if (!this.token) {
            try {
                const kept = z.object({ server: z.string(), token: z.string().min(1) }).parse(JSON.parse(await readFile(this.tokenPath, 'utf8')));
                if (kept.server === this.server && !this.token) {
                    this.epoch++;
                    this.token = kept.token;
                }
            }
            catch { /* none kept, or unreadable: sign in again */ }
        }
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
    /** Independent of configuration sync: only the member's own budget and a count of reviews leave the host. */
    async summary(teamId) {
        if (!this.token || !this.snapshot?.teams.some(team => team.teamId === teamId))
            throw new Error(say('summary.team'));
        const epoch = this.epoch, endpoint = this.endpoint, token = this.token;
        const response = await this.request(`${endpoint}/api/teams/${encodeURIComponent(teamId)}/summary`, {
            headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000),
        });
        if (!response.ok)
            throw new Error(say('summary.unavailable'));
        const result = z.object({ budget: budgetSchema, pendingReviews: z.number().int().nonnegative() }).parse(await response.json());
        if (epoch !== this.epoch || endpoint !== this.endpoint || this.token !== token)
            throw new Error(say('auth.changed'));
        return { budget: result.budget, pendingReviews: result.pendingReviews };
    }
    /** The member's own last 30 days in one team, for its settings page; dropped if the account changed meanwhile. */
    async teamUsage(teamId) {
        if (!this.token || !this.snapshot?.teams.some(team => team.teamId === teamId))
            throw new Error(say('summary.team'));
        const epoch = this.epoch, endpoint = this.endpoint, token = this.token;
        /** One read, its failure named by the route and what went wrong, so the panel can say why it has nothing. */
        const read = async (path, schema) => {
            const response = await this.request(`${endpoint}/api/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
            if (!response.ok)
                throw new Error(`${say('summary.unavailable')} (${path}: HTTP ${response.status})`);
            const parsed = schema.safeParse(await response.json());
            if (!parsed.success) {
                const issue = parsed.error.issues[0];
                throw new Error(`${say('summary.unavailable')} (${path}: ${issue?.path.join('.') || 'answer'} ${issue?.message ?? ''})`.trim());
            }
            return parsed.data;
        };
        const team = `teams/${encodeURIComponent(teamId)}`;
        const [own, me] = await Promise.all([
            read(`${team}/summary`, z.object({
                since: z.string(), budget: budgetSchema,
                nearLimit: z.array(z.object({ scope: z.enum(['team', 'member', 'provider']), period: z.enum(['day', 'month']), threshold: z.number().int() })),
            })),
            read('profile', z.object({ id: z.string().min(1) })),
        ]);
        // An admin's stats are the whole team's unless they name a member: these are the caller's own. Days are this
        // computer's calendar days, as the web console counts them in the browser's.
        const count = z.number().int().nonnegative();
        const query = new URLSearchParams({ userId: me.id, since: own.since, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
        const { totals, days, sources } = await read(`${team}/usage/stats?${query}`, z.object({
            totals: z.object({ calls: count, points: pointsSchema, unpriced: count, input: count, cacheRead: count, output: count, reasoning: count }),
            days: z.array(z.object({ day: z.string(), calls: count, points: pointsSchema })),
            sources: z.array(z.object({
                kind: z.enum(['model', 'meter']), name: z.string(), labels: z.record(z.string(), z.string()).nullable().default({}).transform(labels => labels ?? {}),
                calls: count, points: pointsSchema,
            })),
        }));
        if (epoch !== this.epoch || endpoint !== this.endpoint || this.token !== token)
            throw new Error(say('auth.changed'));
        return { since: own.since, totals, days, sources, budget: own.budget, nearLimit: own.nearLimit.map(({ scope, period, threshold }) => ({ scope, period, threshold })) };
    }
    profile() {
        if (!this.token)
            return Promise.reject(new Error(say('auth.signedOut')));
        return this.api('profile');
    }
    updateProfile(input) {
        if (!this.token)
            return Promise.reject(new Error(say('auth.signedOut')));
        return this.api('profile', 'PATCH', input);
    }
    current() { return this.snapshot; }
    /**
     * Takes a token the host's supervisor provides instead of a browser sign-in (`tokenFile`, docs/development.md).
     * Replacing one token with another keeps the session revision, since short-lived tokens are renewed for the
     * same computer; signing in from none, or out to none, moves it and drops the cached configuration on the way out.
     */
    useToken(token) {
        return this.enqueue(async () => {
            if (token === this.token)
                return;
            this.verifier = undefined;
            if (!token) {
                this.epoch++;
                this.token = undefined;
                await this.clear();
                return;
            }
            if (!this.token)
                this.epoch++;
            this.token = token;
        });
    }
    async clear() { this.snapshot = undefined; await rm(this.cachePath, { force: true }); }
    logout() { this.epoch++; const server = this.server; return this.enqueue(() => this.logoutOnce(server)); }
    /** Forgets the token here and revokes it at the server that issued it, so a copy of it opens nothing either. */
    async logoutOnce(server) {
        const token = this.token;
        this.token = undefined;
        this.verifier = undefined;
        await this.clear();
        await this.forgetToken();
        if (token)
            await this.revoke(server, token);
    }
}
/**
 * Reconcile only registrations owned by this plugin, for every team at once. The host's local registry is never
 * enumerated or mutated. A registration is `team:<teamId>:<configId>`, and a team's new name re-registers its entries.
 * Only presets are registered: a team model is already in the model picker through `platformAdapter`, and an
 * empty preset that only selected it listed every model a second time in the mode menu.
 */
export class TeamOverlay {
    register;
    teams;
    owned = new Map();
    /** `teams` runs first on every apply, with the teams as synced: the plugin keeps one model provider per team there. */
    constructor(register, teams) {
        this.register = register;
        this.teams = teams;
    }
    operations = Promise.resolve();
    apply(snapshot) { const next = this.operations.then(() => this.reconcile(snapshot)); this.operations = next.catch(() => { }); return next; }
    async reconcile(snapshot) {
        this.teams();
        const desired = new Map((snapshot?.teams ?? []).flatMap(team => team.configs.filter((c) => c.kind === 'preset')
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
export function pinnedPlugin(snapshot, id, version) {
    const team = snapshot?.teams.find(t => t.configs.some(c => c.id === id) || t.pluginVersions?.some(p => p.configId === id));
    const current = team?.configs.find(c => c.id === id && c.kind === 'plugin');
    if (current?.kind === 'plugin' && current.data.version === version)
        return current;
    const old = team?.pluginVersions?.find(p => p.configId === id && p.data.version === version);
    return old ? { id, kind: 'plugin', name: old.name, version: 1, data: old.data } : undefined;
}
export const inheritsModel = (config) => config.kind === 'preset' && config.data.inheritModel === true;
/** References resolve within the configuration's own team only; never across teams, never to local models. */
export function modelData(snapshot, config) {
    if (config.kind === 'plugin' || config.kind === 'preset' && config.data.inheritModel)
        return undefined;
    if (config.kind === 'preset' && config.data.modelConfigId) {
        const model = teamOf(snapshot, config.id)?.configs.find(c => c.id === config.data.modelConfigId && c.kind === 'model');
        return model?.kind === 'model' ? model.data : undefined;
    }
    return config.data;
}
/**
 * The name of the team model, or of the model a preset calls, that cannot run here. Without its `contextWindow`
 * the adapter cannot size it: a guessed window either overstates the model or leaves the host's
 * compaction, which reserves its headroom out of the window, no room at all. Nothing is guessed;
 * the model stays unusable until the team configures the real window.
 */
export function unsizedModel(snapshot, config) {
    const data = modelData(snapshot, config);
    if (!data || data.contextWindow !== undefined)
        return undefined;
    const model = config.kind === 'preset' && config.data.modelConfigId ? findConfig(snapshot, config.data.modelConfigId) : undefined;
    return model?.name ?? (config.kind === 'preset' ? `${data.provider}/${data.model}` : config.name);
}
/**
 * The name of the hosted model, or of the one a preset calls, that its service has taken out of service (`offline`):
 * offered to no session until it is back, when the team's configuration still names it.
 */
export function offlineModel(snapshot, config) {
    const data = modelData(snapshot, config);
    if (!data || !('offline' in data) || !data.offline)
        return undefined;
    const model = config.kind === 'preset' && config.data.modelConfigId ? findConfig(snapshot, config.data.modelConfigId) : undefined;
    return model?.name ?? config.name;
}
/** Why a team model, or the model a preset calls, cannot run here, as the member reads it; the panel words its own. */
export function modelLimitProblem(snapshot, config) {
    const offline = offlineModel(snapshot, config);
    if (offline !== undefined)
        return say('model.offline', { name: offline });
    const name = unsizedModel(snapshot, config);
    return name === undefined ? undefined : say('model.noContextWindow', { name });
}
/**
 * A refusal as the model can act on it: the server's error code and, for a request it could not accept, which field
 * and why (`issues`, never a value the caller did not send).
 */
function failure(body) {
    const issues = Array.isArray(body.issues) ? body.issues.slice(0, 5).map((i) => `${Array.isArray(i.path) ? i.path.join('.') : ''}: ${String(i.message ?? '')}`) : [];
    return [String(body.error ?? ''), ...issues].join('; ');
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