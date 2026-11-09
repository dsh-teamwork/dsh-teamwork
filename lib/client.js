import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
const common = { id: z.string().min(1), name: z.string(), version: z.number().int().positive() };
const route = { provider: z.string().min(1), model: z.string().min(1) };
export const snapshotSchema = z.object({ teamId: z.string().min(1), configs: z.array(z.discriminatedUnion('kind', [
        z.object({ ...common, kind: z.literal('model'), data: z.object(route) }),
        z.object({ ...common, kind: z.literal('preset'), data: z.object({ ...route, systemPrompt: z.string().default('') }) }),
        z.object({ ...common, kind: z.literal('plugin'), data: z.object({ package: z.string().regex(/^(?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/), version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/), description: z.string().default('') }) }),
    ])) });
export class TeamworkClient {
    endpoint;
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
    constructor(endpoint, cachePath, request = fetch) {
        this.endpoint = endpoint;
        this.cachePath = cachePath;
        this.request = request;
        const url = new URL(endpoint);
        if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
            throw new Error('HTTPS required outside loopback');
    }
    beginLogin() {
        this.epoch++;
        this.verifier = randomBytes(32).toString('base64url');
        const challenge = createHash('sha256').update(this.verifier).digest('base64url');
        return `${this.endpoint}/?challenge=${challenge}`;
    }
    completeLogin(code) {
        const verifier = this.verifier, epoch = this.epoch;
        return this.enqueue(async () => {
            if (!verifier || epoch !== this.epoch)
                throw new Error('Begin login first');
            const result = z.object({ token: z.string().min(1) }).parse(await this.api('plugin/exchange', 'POST', { code, verifier }));
            if (epoch !== this.epoch) {
                await this.api('plugin/logout', 'POST', { token: result.token }, result.token);
                throw new Error('Login cancelled');
            }
            await this.clear();
            this.verifier = undefined;
            this.token = result.token;
        });
    }
    async api(path, method = 'GET', body, token = this.token) {
        const response = await this.request(`${this.endpoint}/api/v1/${path}`, {
            method, headers: { 'Content-Type': 'application/json', Origin: new URL(this.endpoint).origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
            if (path === 'configs' && [401, 403].includes(response.status))
                await this.clear();
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
        const ids = next.configs.map(c => c.id);
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
    current() { return this.snapshot; }
    async clear() { this.snapshot = undefined; await rm(this.cachePath, { force: true }); }
    logout() { this.epoch++; return this.enqueue(() => this.logoutOnce()); }
    async logoutOnce() {
        try {
            if (this.token)
                await this.api('plugin/logout', 'POST', { token: this.token });
        }
        finally {
            this.token = undefined;
            this.verifier = undefined;
            await this.clear();
        }
    }
}
/** Reconcile only registrations owned by this plugin. The host's local registry is never enumerated or mutated. */
export class TeamOverlay {
    register;
    owned = new Map();
    constructor(register) {
        this.register = register;
    }
    operations = Promise.resolve();
    apply(snapshot) { const next = this.operations.then(() => this.reconcile(snapshot)); this.operations = next.catch(() => { }); return next; }
    async reconcile(snapshot) {
        const desired = new Map((snapshot?.configs ?? []).filter(c => c.kind !== 'plugin').map(c => [`team:${snapshot.teamId}:${c.id}`, c]));
        for (const [id, old] of this.owned)
            if (!desired.has(id) || old.signature !== JSON.stringify(desired.get(id))) {
                await old.dispose();
                this.owned.delete(id);
            }
        for (const [id, config] of desired)
            if (!this.owned.has(id)) {
                const dispose = await this.register(id, config);
                this.owned.set(id, { signature: JSON.stringify(config), dispose });
            }
    }
}
//# sourceMappingURL=client.js.map