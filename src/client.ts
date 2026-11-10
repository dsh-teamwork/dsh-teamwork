import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
const common = { id: z.string().min(1), name: z.string(), version: z.number().int().positive() };
const route = { provider: z.string().min(1), model: z.string().min(1), contextWindow: z.number().int().positive().max(10000000).optional(), maxTokens: z.number().int().positive().max(10000000).optional() };
export const snapshotSchema = z.object({ teamId: z.string().min(1), configs: z.array(z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('model'), data: z.object(route) }),
  z.object({ ...common, kind: z.literal('preset'), data: z.object({
    ...route, provider: route.provider.optional(), model: route.model.optional(), modelConfigId: z.string().min(1).optional(),
    description: z.string().optional(), instructions: z.string().optional(), outputDescription: z.string().optional(),
    pluginDependencies: z.array(z.object({pluginConfigId:z.string().min(1),version:z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/)})).max(30).optional(),
    requiredTools: z.array(z.string().min(1)).optional(), optionalTools: z.array(z.string().min(1)).optional(),
    systemPrompt: z.string().default(''),
  }).refine(d => d.modelConfigId ? !d.provider && !d.model && d.contextWindow === undefined && d.maxTokens === undefined : !!d.provider && !!d.model, 'Invalid preset model reference') }),
  z.object({ ...common, kind: z.literal('plugin'), data: z.object({ package: z.string().regex(/^(?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/), version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/), providesTools: z.array(z.string().min(1)).optional(), description: z.string().default('') }) }),
])) });
export type Snapshot = z.infer<typeof snapshotSchema>;
export type TeamConfig = Snapshot['configs'][number];
export class TeamworkClient {
  private token?: string;
  private verifier?: string;
  private snapshot?: Snapshot;
  private epoch = 0;
  private operations: Promise<unknown> = Promise.resolve();
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operations.then(operation, operation); this.operations = next.catch(() => {}); return next;
  }
  constructor(readonly endpoint: string, readonly cachePath: string, private request: typeof fetch = fetch) {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('HTTPS required outside loopback');
  }
  beginLogin() {
    this.epoch++;
    this.verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(this.verifier).digest('base64url');
    return `${this.endpoint}/plugin?challenge=${challenge}`;
  }
  completeLogin(code: string) {
    const verifier = this.verifier, epoch = this.epoch;
    return this.enqueue(async () => {
      if (!verifier || epoch !== this.epoch) throw new Error('Begin login first');
      const result = z.object({ token: z.string().min(1) }).parse(await this.api('auth/plugin/token', 'POST', { code, verifier }));
      // Platform tokens are stateless and cannot be revoked server-side; a late one is simply dropped.
      if (epoch !== this.epoch) throw new Error('Login cancelled');
      await this.clear();
      this.verifier = undefined; this.token = result.token;
    });
  }
  private async api(path: string, method = 'GET', body?: unknown, token = this.token): Promise<any> {
    const response = await this.request(`${this.endpoint}/api/${path}`, {
      method, headers: { 'Content-Type': 'application/json', Origin: new URL(this.endpoint).origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (path === 'team/configs' && [401, 403].includes(response.status)) { this.token = undefined; await this.clear(); }
      throw new Error(`Teamwork request failed (${response.status})`);
    }
    return response.json();
  }
  sync() { return this.enqueue(() => this.syncOnce()); }
  private async syncOnce() {
    if (!this.token) throw new Error('Sign in first');
    const epoch = this.epoch;
    const next = snapshotSchema.parse(await this.api('team/configs'));
    if (epoch !== this.epoch) throw new Error('Session changed during synchronization');
    const ids = next.configs.map(c => c.id); if (new Set(ids).size !== ids.length) throw new Error('Duplicate configuration ID');
    await mkdir(dirname(this.cachePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.cachePath}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
      await rename(temporary, this.cachePath);
    } finally { await rm(temporary, { force: true }); } this.snapshot = next; return next;
  }
  async restore() {
    try { this.snapshot = snapshotSchema.parse(JSON.parse(await readFile(this.cachePath, 'utf8'))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; this.snapshot = undefined; }
    return this.snapshot;
  }
  platformCredential() { if (!this.token) throw new Error('Sign in to platform first'); return this.token; }
  sessionRevision() { return this.epoch; }
  authenticated() { return !!this.token; }
  current() { return this.snapshot; }
  async clear() { this.snapshot = undefined; await rm(this.cachePath, { force: true }); }
  logout() { this.epoch++; return this.enqueue(() => this.logoutOnce()); }
  /** Forgets the token locally; the platform cannot revoke it, but a removed member is refused on every request. */
  private async logoutOnce() {
    this.token = undefined; this.verifier = undefined; await this.clear();
  }
}
/** Reconcile only registrations owned by this plugin. The host's local registry is never enumerated or mutated. */
export class TeamOverlay {
  private owned = new Map<string, { signature: string; dispose: () => Promise<void> }>();
  constructor(private register: (id: string, config: TeamConfig) => Promise<() => Promise<void>>) {}
  private operations: Promise<void> = Promise.resolve();
  apply(snapshot?: Snapshot) { const next = this.operations.then(() => this.reconcile(snapshot)); this.operations = next.catch(() => {}); return next; }
  private async reconcile(snapshot?: Snapshot) {
    const desired = new Map((snapshot?.configs ?? []).filter(c => c.kind !== 'plugin').map(c => [`team:${snapshot!.teamId}:${c.id}`, c]));
    for (const [id, old] of this.owned) if (!desired.has(id) || old.signature !== JSON.stringify(desired.get(id))) { await old.dispose(); this.owned.delete(id); }
    for (const [id, config] of desired) if (!this.owned.has(id)) {
      const dispose = await this.register(id, config); this.owned.set(id, { signature: JSON.stringify(config), dispose });
    }
  }
}

/** References resolve within the current team snapshot only; never fall back to local models. */
export function modelData(snapshot: Snapshot, config: TeamConfig) {
  if (config.kind === 'plugin') return undefined;
  if (config.kind === 'preset' && config.data.modelConfigId) {
    const model = snapshot.configs.find(c => c.id === config.data.modelConfigId && c.kind === 'model');
    return model?.kind === 'model' ? model.data : undefined;
  }
  return config.data;
}
