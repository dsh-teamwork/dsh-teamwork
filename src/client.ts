import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { say } from './messages.js';
import type { PanelProfile, PanelSummary, PanelTeamUsage } from './panel.js';
import type { Locale } from './locale.js';
const common = { builtin: z.literal('team-assistant').optional(), id: z.string().min(1), name: z.string(), version: z.number().int().positive() };
const route = { provider: z.string().min(1), model: z.string().min(1), contextWindow: z.number().int().positive().max(10000000).optional(), maxTokens: z.number().int().positive().max(10000000).optional() };
const pluginDataSchema = z.object({ packageId: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/).optional(), sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(), package: z.string().regex(/^(?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/), version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/), providesTools: z.array(z.string().min(1)).optional(), description: z.string().default('') });
const teamSchema = z.object({ teamId: z.string().min(1), teamName: z.string(), role: z.enum(['admin', 'member']), pluginVersions:z.array(z.object({configId:z.string(),name:z.string(),data:pluginDataSchema})).optional(), configs: z.array(z.discriminatedUnion('kind', [
  // `offline`: a hosted model its service took out of service; it stays in the team and comes back with it.
  z.object({ ...common, kind: z.literal('model'), data: z.object({ ...route, vision: z.boolean().optional(), reasoningEfforts: z.array(z.enum(['minimal', 'low', 'medium', 'high', 'xhigh', 'max'])).optional(), offline: z.boolean().optional() }) }),
  z.object({ ...common, kind: z.literal('preset'), data: z.object({
    ...route, inheritModel: z.boolean().optional(), provider: route.provider.optional(), model: route.model.optional(), modelConfigId: z.string().min(1).optional(),
    avatar: z.string().optional(), description: z.string().optional(), instructions: z.string().optional(), outputDescription: z.string().optional(),
    pluginDependencies: z.array(z.object({pluginConfigId:z.string().min(1),version:z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/)})).max(30).optional(),
    requiredTools: z.array(z.string().min(1)).optional(), optionalTools: z.array(z.string().min(1)).optional(),
    systemPrompt: z.string().default(''),
  }).refine(d => d.inheritModel ? !d.modelConfigId && !d.provider && !d.model && d.contextWindow === undefined && d.maxTokens === undefined : d.modelConfigId ? !d.provider && !d.model && d.contextWindow === undefined && d.maxTokens === undefined : !!d.provider && !!d.model, 'Invalid preset model reference') }),
  z.object({ ...common, kind: z.literal('plugin'), data: pluginDataSchema }),
])) });
/** `GET /api/configs`: every team the member is in, each with its configuration (platform ADR 0013). */
export const snapshotSchema = z.object({ teams: z.array(teamSchema) });
export type Snapshot = z.infer<typeof snapshotSchema>;
export type TeamSnapshot = Snapshot['teams'][number];
export type TeamConfig = TeamSnapshot['configs'][number];
/** Every team's configuration in one list. Ids are the server's primary keys, so they are unique across teams. */
export const allConfigs = (snapshot?: Snapshot): TeamConfig[] => (snapshot?.teams ?? []).flatMap(team => team.configs);
export const findConfig = (snapshot: Snapshot | undefined, id: string) => allConfigs(snapshot).find(c => c.id === id);
/** The team a configuration belongs to. */
export const teamOf = (snapshot: Snapshot | undefined, configId: string) => snapshot?.teams.find(team => team.configs.some(c => c.id === configId) || team.pluginVersions?.some(p=>p.configId===configId));
/**
 * A server address as the plugin stores and calls it: https anywhere, plain http only on
 * this machine, no query or fragment, no trailing slash. Throws a message for the member.
 */
export function serverAddress(input: string) {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error(say('server.invalid')); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error(say('server.https'));
  if (url.search || url.hash || url.username || url.password) throw new Error(say('server.extra'));
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}
/** An artifact the server refused: its status, code (`artifact_stale`, `artifact_too_large`, …) and what it said was wrong. */
export class ArtifactError extends Error {
  constructor(readonly status:number,readonly code:string,readonly detail:string) { super(`Artifact refused (${status}${code?` ${code}`:''})${detail?`: ${detail}`:''}`); }
}
/** A knowledge request the server refused: its status and code (`knowledge_stale`, `knowledge_not_found`, …). */
export class KnowledgeError extends Error {
  constructor(readonly status:number,readonly code:string,readonly detail:string) { super(`Knowledge request refused (${status}${code?` ${code}`:''})${detail?`: ${detail}`:''}`); }
}
/** `GET /api/knowledge` (platform docs/tech/knowledge.md, "The sync manifest"): every document the member reads, per team and space. */
export const knowledgeManifestSchema = z.object({ teams: z.array(z.object({ teamId: z.string().min(1), teamName: z.string(), spaces: z.array(z.object({
  id: z.string().min(1), name: z.string(),
  documents: z.array(z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/), folders: z.array(z.string()), title: z.string(), version: z.number().int().positive(),
    attachments: z.array(z.object({ name: z.string().min(1), size: z.number().int().nonnegative(), digest: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) })) })),
})) })) });
/** The server's limit on one knowledge attachment, which the copy and the tool hold too. */
export const MAX_ATTACHMENT = 20 << 20;
/** An attachment's digest as the manifest names it: the first 24 bytes of its SHA-256, base64url. */
export const attachmentDigest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest().subarray(0, 24).toString('base64url');
export type KnowledgeManifest = z.infer<typeof knowledgeManifestSchema>;
const pointsSchema = z.string().regex(/^\d+(?:\.\d{1,9})?$/);
const budgetSchema = z.object({
  remaining: pointsSchema.nullable(),
  state: z.enum(['known', 'unlimited', 'unconfirmed']), resetAt: z.string().nullable(),
  tokenLimited: z.boolean(), exhausted: z.boolean(),
});
export class TeamworkClient {
  private token?: string;
  private verifier?: string;
  private snapshot?: Snapshot;
  private epoch = 0;
  private operations: Promise<unknown> = Promise.resolve();
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operations.then(operation, operation); this.operations = next.catch(() => {}); return next;
  }
  private server: string;
  constructor(endpoint: string, readonly cachePath: string, private request: typeof fetch = fetch) {
    this.server = serverAddress(endpoint);
  }
  /** The DSH Teamwork server this client signs in to and syncs from. */
  get endpoint() { return this.server; }
  /**
   * Points the client at another server. A token and a team belong to one server, so
   * this signs out and drops the cached configuration, as `logout` does.
   */
  setEndpoint(endpoint: string) {
    const next = serverAddress(endpoint);
    if (next === this.server) return Promise.resolve();
    const out = this.logout(); // revokes the token at the server that issued it
    this.server = next;
    return out;
  }
  /**
   * Where the sign-in is kept across restarts (platform ADR 0060): the token and the server it belongs to, beside the
   * cache and readable by this user alone. The server can revoke it, and it lapses after 30 days unused.
   */
  get tokenPath() { return this.cachePath.replace(/\.json$/, '') + '.token.json'; }
  private async saveToken(token: string) {
    await mkdir(dirname(this.tokenPath), { recursive: true, mode: 0o700 });
    const temporary = `${this.tokenPath}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify({ server: this.server, token }), { mode: 0o600 });
      await rename(temporary, this.tokenPath);
    } finally { await rm(temporary, { force: true }); }
  }
  private forgetToken() { return rm(this.tokenPath, { force: true }); }
  /** Best effort: a token the server is not told about still lapses after 30 days unused. */
  private async revoke(server: string, token: string) {
    try { await this.request(`${server}/api/auth/plugin/token`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000), redirect: 'error' }); }
    catch { /* offline: the grant lapses on its own */ }
  }
  /** The sign-in page's address; with `redirectUri`, the page sends the code there instead of showing it. */
  beginLogin(redirectUri?: string) {
    this.epoch++;
    this.verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(this.verifier).digest('base64url');
    return `${this.endpoint}/plugin?${new URLSearchParams({ challenge, ...(redirectUri ? { redirect_uri: redirectUri } : {}) })}`;
  }
  /** Takes the code alone or the whole `/teamwork authorize <code>` line the sign-in page shows, so the panel accepts what was copied. */
  completeLogin(pasted: string) {
    const code = pasted.trim().replace(/^\/?teamwork\s+authorize\s+/i, '');
    const verifier = this.verifier, epoch = this.epoch;
    return this.enqueue(async () => {
      if (!verifier || epoch !== this.epoch) throw new Error('Begin login first');
      const result = z.object({ token: z.string().min(1) }).parse(await this.api('auth/plugin/token', 'POST', { code, verifier }));
      if (epoch !== this.epoch) { await this.revoke(this.server, result.token); throw new Error('Login cancelled'); }
      await this.clear();
      this.epoch++; this.verifier = undefined; this.token = result.token;
      await this.saveToken(result.token);
    });
  }
  private async api(path: string, method = 'GET', body?: unknown, token = this.token): Promise<any> {
    const response = await this.request(`${this.endpoint}/api/${path}`, {
      method, headers: { 'Content-Type': 'application/json', Origin: new URL(this.endpoint).origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (path === 'configs' && [401, 403].includes(response.status)) { this.token = undefined; await this.clear(); await this.forgetToken(); }
      throw new Error(`Teamwork request failed (${response.status})`);
    }
    return response.json();
  }
  async downloadPackage(teamId:string,id:string,digest:string) {
    if(!this.token || !/^[A-Za-z0-9_-]{1,32}$/.test(id) || !/^[a-f0-9]{64}$/.test(digest))throw new Error('Invalid package');
    const epoch=this.epoch;
    const response=await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/packages/${id}/download`,{headers:{Authorization:`Bearer ${this.token}`},signal:AbortSignal.timeout(30000),redirect:'error'});
    if(!response.ok)throw new Error(`Package download failed (${response.status})`);
    const reader=response.body?.getReader();if(!reader)throw new Error('Missing package body');
    const chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>10*1024*1024)throw new Error('Package exceeds 10 MiB');chunks.push(part.value);}}finally{await reader.cancel();}
    const bytes=Buffer.concat(chunks);
    if(createHash('sha256').update(bytes).digest('hex')!==digest)throw new Error('Package digest mismatch');
    if(epoch!==this.epoch)throw new Error('Account changed during download');
    const directory=join(dirname(this.cachePath),'teamwork-packages');await mkdir(directory,{recursive:true,mode:0o700});
    const path=join(directory,`${digest}.tgz`),temporary=`${path}.${randomBytes(8).toString('hex')}.tmp`;
    try{await writeFile(temporary,bytes,{mode:0o600});await rename(temporary,path);}finally{await rm(temporary,{force:true});}
    return path;
  }
  /**
   * Publishes an artifact (docs/tech/artifacts.md in the platform repository): a new one, or a version on top of
   * `baseVersion`. `files` are paths within the artifact and their bytes; the server holds every rule and limit, and says which broke.
   */
  async publishArtifact(teamId:string,input:{artifactId?:string;title?:string;kind:'html'|'svg';note:string;sessionId:string;computer:string;baseVersion?:number},files:{path:string;bytes:Uint8Array}[],signal:AbortSignal) {
    if(!this.token)throw new Error('Sign in to Teamwork first');
    const epoch=this.epoch,form=new FormData();
    const {artifactId,...meta}=input;
    form.append('meta',JSON.stringify(meta));
    for(const file of files)form.append(file.path,new Blob([new Uint8Array(file.bytes)]),file.path.split('/').pop());
    const path=artifactId?`artifacts/${encodeURIComponent(artifactId)}/versions`:'artifacts';
    const response=await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/${path}`,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,Origin:new URL(this.endpoint).origin},body:form,signal,redirect:'error'});
    const body=await response.json().catch(()=>({})) as {error?:string;issues?:{message:string}[]};
    if(!response.ok)throw new ArtifactError(response.status,String(body.error??''),(body.issues??[]).map(i=>i.message).join('; '));
    const artifact=z.object({id:z.string().min(1),teamId:z.string(),version:z.number().int().positive(),title:z.string(),kind:z.enum(['html','svg'])}).parse(body);
    if(epoch!==this.epoch)throw new Error('Account changed during upload');
    return artifact;
  }
  /**
   * Whether the signed-in server searches the web for its members (the hosted service does, on its own key; a
   * self-hosted server has no such route): true, false, or undefined when the server could not be asked.
   */
  async webSearchOffered(signal?:AbortSignal):Promise<boolean|undefined> {
    if(!this.token)return false;
    try{
      const response=await this.request(`${this.endpoint}/api/web/search`,{headers:{Authorization:`Bearer ${this.token}`},signal:signal??AbortSignal.timeout(10000),redirect:'error'});
      if(response.status===404||response.status===401||response.status===403)return false;
      if(!response.ok)return undefined;
      return (await response.json() as {available?:unknown}).available===true;
    }catch{return undefined;}
  }
  /** One web search through the signed-in server; only the query and the count leave this computer. */
  async webSearch(query:string,count:number|undefined,signal?:AbortSignal) {
    if(!this.token)throw new Error('Teamwork search needs a Teamwork sign-in: run /teamwork login, or choose another search provider in DSH settings.');
    const response=await this.request(`${this.endpoint}/api/web/search`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.token}`,Origin:new URL(this.endpoint).origin},body:JSON.stringify({query,...(count?{count:Math.min(count,20)}:{})}),signal:signal??AbortSignal.timeout(30000),redirect:'error'});
    const body=await response.json().catch(()=>({})) as {error?:string};
    if(!response.ok)throw new Error(response.status===429?'Today’s Teamwork search allowance is used up; it renews at 00:00 UTC. Choose another search provider in DSH settings to keep searching.'
      :response.status===401?'The Teamwork sign-in has lapsed: run /teamwork login, then search again.'
      :`Teamwork search failed (${response.status}${body.error?` ${body.error}`:''}); try again shortly.`);
    return z.object({sources:z.array(z.object({url:z.string(),title:z.string().optional(),snippet:z.string().optional(),summary:z.string().optional(),publishedAt:z.string().optional()}))}).parse(body).sources;
  }
  /** The knowledge copy beside the cache (src/knowledge-sync.ts), as `teamwork-packages` is beside it. */
  get knowledgePath() { return join(dirname(this.cachePath), 'teamwork-knowledge'); }
  /** Which version of each document the copy holds, and where. */
  get knowledgeStatePath() { return this.cachePath.replace(/\.json$/, '') + '.knowledge.json'; }
  private async knowledgeRequest(path:string,init:RequestInit,signal?:AbortSignal):Promise<unknown> {
    if(!this.token)throw new Error('Sign in to Teamwork first');
    const response=await this.request(`${this.endpoint}/api/${path}`,{...init,headers:{Authorization:`Bearer ${this.token}`,Origin:new URL(this.endpoint).origin,...(typeof init.body==='string'?{'Content-Type':'application/json'}:{})},signal:signal??AbortSignal.timeout(15000),redirect:'error'});
    const body=await response.json().catch(()=>({})) as {error?:string;issues?:{message:string}[]};
    if(!response.ok)throw new KnowledgeError(response.status,String(body.error??''),(body.issues??[]).map(i=>i.message).join('; '));
    return body;
  }
  /** What the member reads of every team's knowledge; a server without knowledge (404) holds none. */
  async knowledgeManifest(signal?:AbortSignal):Promise<KnowledgeManifest> {
    try{return knowledgeManifestSchema.parse(await this.knowledgeRequest('knowledge',{},signal));}
    catch(error){if(error instanceof KnowledgeError&&error.status===404)return {teams:[]};throw error;}
  }
  /** One document's text at `version`, or at its current version when none is named. */
  async readKnowledge(teamId:string,documentId:string,version:number|undefined,signal?:AbortSignal) {
    const query=version?`?version=${version}`:'';
    return z.object({id:z.string(),title:z.string(),version:z.number().int().positive(),text:z.string()})
      .parse(await this.knowledgeRequest(`teams/${encodeURIComponent(teamId)}/knowledge/documents/${encodeURIComponent(documentId)}${query}`,{},signal));
  }
  private attachmentPath(teamId:string,documentId:string) { return `teams/${encodeURIComponent(teamId)}/knowledge/documents/${encodeURIComponent(documentId)}/attachments`; }
  /** One attachment's bytes, held to the manifest's `digest` and to the size limit, so a cut-off body never lands in the copy. */
  async readKnowledgeAttachment(teamId:string,documentId:string,name:string,digest:string,signal?:AbortSignal) {
    if(!this.token)throw new Error('Sign in to Teamwork first');
    const epoch=this.epoch;
    const response=await this.request(`${this.endpoint}/api/${this.attachmentPath(teamId,documentId)}/${encodeURIComponent(name)}`,{headers:{Authorization:`Bearer ${this.token}`},signal:signal??AbortSignal.timeout(60000),redirect:'error'});
    if(!response.ok){const body=await response.json().catch(()=>({})) as {error?:string};throw new KnowledgeError(response.status,String(body.error??''),'');}
    const reader=response.body?.getReader();if(!reader)throw new KnowledgeError(response.status,'','no body');
    const chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_ATTACHMENT)throw new KnowledgeError(response.status,'','attachment exceeds 20 MiB');chunks.push(part.value);}}finally{await reader.cancel();}
    const bytes=Buffer.concat(chunks);
    if(attachmentDigest(bytes)!==digest)throw new KnowledgeError(response.status,'','attachment digest mismatch');
    if(epoch!==this.epoch)throw new Error('Account changed during download');
    return bytes;
  }
  /**
   * Uploads `bytes` as the attachment `name` of a document the member reads. The same name with the same bytes is
   * the same attachment (200); other bytes are `knowledge_name_taken`, since a name keeps its bytes for the document's life.
   */
  async attachKnowledge(teamId:string,documentId:string,name:string,bytes:Uint8Array,signal:AbortSignal) {
    const epoch=this.epoch,form=new FormData();
    form.append('file',new Blob([new Uint8Array(bytes)]),name);
    const attached=z.object({name:z.string(),contentType:z.string(),size:z.number().int()})
      .parse(await this.knowledgeRequest(this.attachmentPath(teamId,documentId),{method:'POST',body:form},signal));
    if(epoch!==this.epoch)throw new Error('Account changed during upload');
    return attached;
  }
  /** Proposes `text` as a document's next version on `baseVersion`. A plugin's change is always a proposal: an editor accepts it. */
  async proposeKnowledge(teamId:string,documentId:string,input:{baseVersion:number;text:string;note:string;computer:string;sessionId:string},signal:AbortSignal) {
    const epoch=this.epoch;
    const proposal=z.object({id:z.string().min(1),documentId:z.string(),documentTitle:z.string(),baseVersion:z.number().int(),state:z.string()})
      .parse(await this.knowledgeRequest(`teams/${encodeURIComponent(teamId)}/knowledge/documents/${encodeURIComponent(documentId)}/proposals`,{method:'POST',body:JSON.stringify(input)},signal));
    if(epoch!==this.epoch)throw new Error('Account changed during the proposal');
    return proposal;
  }
  /** The files of an artifact's version, fetched through a view address minted for this member, as the console's frame fetches them. */
  async readArtifact(teamId:string,artifactId:string,version:number,signal:AbortSignal) {
    if(!this.token)throw new Error('Sign in to Teamwork first');
    const epoch=this.epoch;
    const response=await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/artifacts/${encodeURIComponent(artifactId)}/versions/${version}/view`,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,Origin:new URL(this.endpoint).origin},signal,redirect:'error'});
    const body=await response.json().catch(()=>({})) as {error?:string};
    if(!response.ok)throw new ArtifactError(response.status,String(body.error??''),'');
    const view=z.object({url:z.string().url(),files:z.array(z.object({path:z.string(),size:z.number()}))}).parse(body);
    const files:{path:string;bytes:Uint8Array}[]=[];
    for(const file of view.files){
      const got=await this.request(view.url+file.path.split('/').map(encodeURIComponent).join('/'),{signal,redirect:'error'});
      if(!got.ok)throw new Error(`Could not read ${file.path} (${got.status})`);
      files.push({path:file.path,bytes:new Uint8Array(await got.arrayBuffer())});
    }
    if(epoch!==this.epoch)throw new Error('Account changed during download');
    return files;
  }
  async publishPlugin(teamId:string,bytes:Buffer,sha256:string,input:{name:string;note:string;configId?:string;baseVersion:number},signal:AbortSignal) {
    if(!this.token || createHash('sha256').update(bytes).digest('hex')!==sha256)throw new Error('Prepared archive changed');
    const epoch=this.epoch;
    const response=await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/packages`,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,Origin:new URL(this.endpoint).origin,'Content-Type':'application/octet-stream'},body:new Uint8Array(bytes),signal,redirect:'error'});
    if(!response.ok)throw new Error(`Upload failed (${response.status}): ${String((await response.json().catch(()=>({}))).error ?? '')}`);
    const uploaded=z.object({id:z.string().min(1),package:z.string(),version:z.string(),sha256:z.string()}).parse(await response.json());
    if(epoch!==this.epoch)throw new Error('Account changed during upload');
    if(uploaded.sha256!==sha256)throw new Error('Uploaded archive digest mismatch');
    const { name, note, configId, baseVersion } = input;
    const config = {
      kind: 'plugin',
      name,
      memberAsset: true,
      data: { package: uploaded.package, version: uploaded.version, packageId: uploaded.id, sha256, description: note },
    };
    return this.assistantChange(teamId, configId ? 'updateConfig' : 'createConfig',
      configId ? { ...config, id: configId, version: baseVersion } : config, signal);
  }
  async assistantChange(teamId:string,action:string,input:Record<string,unknown>,signal:AbortSignal):Promise<unknown> {
    if(!this.token)throw new Error('Sign in first');const epoch=this.epoch;
    const id=typeof input.id==='string'?encodeURIComponent(input.id):'';
    const {id:_id,...payload}=input;
    const routes:Record<string,{path:string;method:string;body:unknown}>={
      createConfig:{path:'configs',method:'POST',body:payload},
      updateConfig:{path:`configs/${id}`,method:'PATCH',body:payload},
      deleteConfig:{path:`configs/${id}`,method:'DELETE',body:undefined},
      setBudget:{path:'budgets',method:'PUT',body:payload},
      removeMember:{path:`members/${id}`,method:'DELETE',body:undefined},
      restore:{path:`history/${id}/restore`,method:'POST',body:payload},
    };
    const route=routes[action];if(!route)throw new Error('Unsupported operation');
    const response=await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/${route.path}`,{method:route.method,headers:{Authorization:`Bearer ${this.token}`,Origin:new URL(this.endpoint).origin,'Content-Type':'application/json'},body:JSON.stringify(route.body),signal,redirect:'error'});
    if(!response.ok)throw new Error(`Teamwork operation failed (${response.status}): ${failure(await response.json().catch(()=>({})))}`);
    const result=response.status===204?null:await response.json();if(epoch!==this.epoch)throw new Error('Account changed during operation');return result;
  }
  async exportUsage(teamId:string,filters:Record<string,string>,signal:AbortSignal) {
    if(!this.token)throw Error('Sign in first');const epoch=this.epoch;
    const response=await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}/usage/export?${new URLSearchParams(filters)}`,{headers:{Authorization:`Bearer ${this.token}`},signal,redirect:'error'});
    if(!response.ok)throw Error(`Usage export failed (${response.status})`);
    const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>10*1024*1024)throw Error('Export exceeds local size limit');if(epoch!==this.epoch)throw Error('Account changed');
    const directory=join(dirname(this.cachePath),'teamwork-exports');await mkdir(directory,{recursive:true,mode:0o700});const path=join(directory,`usage-${randomBytes(8).toString('hex')}.csv`);await writeFile(path,bytes,{mode:0o600});return path;
  }
  /** Narrow team operations; credentials never enter model-visible results. */
  async assistantRead(teamId: string, action: 'configs'|'usage'|'budgets'|'members'|'submissions'|'history'|'providers', signal: AbortSignal, filters:Record<string,string>={}) {
    if (!this.token) throw new Error('Sign in first');
    const epoch = this.epoch;
    const path = action === 'members' ? '' : `/${action}`;
    const response = await this.request(`${this.endpoint}/api/teams/${encodeURIComponent(teamId)}${path}?${new URLSearchParams(filters)}`, {
      headers: {Authorization:`Bearer ${this.token}`}, signal,redirect:'error',
    });
    if (!response.ok) throw new Error(`Teamwork request failed (${response.status}): ${failure(await response.json().catch(() => ({})))}`);
    const data = await response.json();
    if (epoch !== this.epoch) throw new Error('Session changed during operation');
    return data;
  }
  sync() { return this.enqueue(() => this.syncOnce()); }
  private async syncOnce() {
    if (!this.token) throw new Error('Sign in first');
    const epoch = this.epoch;
    const next = snapshotSchema.parse(await this.api('configs'));
    if (epoch !== this.epoch) throw new Error('Session changed during synchronization');
    const ids = allConfigs(next).map(c => c.id); if (new Set(ids).size !== ids.length) throw new Error('Duplicate configuration ID');
    await mkdir(dirname(this.cachePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.cachePath}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
      await rename(temporary, this.cachePath);
    } finally { await rm(temporary, { force: true }); } this.snapshot = next; return next;
  }
  /** The cached configuration, and the sign-in kept for this server, as the last run left them. */
  async restore() {
    if (!this.token) {
      try {
        const kept = z.object({ server: z.string(), token: z.string().min(1) }).parse(JSON.parse(await readFile(this.tokenPath, 'utf8')));
        if (kept.server === this.server && !this.token) { this.epoch++; this.token = kept.token; }
      } catch { /* none kept, or unreadable: sign in again */ }
    }
    try { this.snapshot = snapshotSchema.parse(JSON.parse(await readFile(this.cachePath, 'utf8'))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; this.snapshot = undefined; }
    return this.snapshot;
  }
  platformCredential() { if (!this.token) throw new Error('Sign in to platform first'); return this.token; }
  sessionRevision() { return this.epoch; }
  authenticated() { return !!this.token; }
  /** Independent of configuration sync: only the member's own budget and a count of reviews leave the host. */
  async summary(teamId: string): Promise<PanelSummary> {
    if (!this.token || !this.snapshot?.teams.some(team => team.teamId === teamId)) throw new Error(say('summary.team'));
    const epoch = this.epoch, endpoint = this.endpoint, token = this.token;
    const response = await this.request(`${endpoint}/api/teams/${encodeURIComponent(teamId)}/summary`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(say('summary.unavailable'));
    const result = z.object({ budget: budgetSchema, pendingReviews: z.number().int().nonnegative() }).parse(await response.json());
    if (epoch !== this.epoch || endpoint !== this.endpoint || this.token !== token) throw new Error(say('auth.changed'));
    return { budget: result.budget, pendingReviews: result.pendingReviews };
  }
  /** The member's own last 30 days in one team, for its settings page; dropped if the account changed meanwhile. */
  async teamUsage(teamId: string): Promise<PanelTeamUsage> {
    if (!this.token || !this.snapshot?.teams.some(team => team.teamId === teamId)) throw new Error(say('summary.team'));
    const epoch = this.epoch, endpoint = this.endpoint, token = this.token;
    /** One read, its failure named by the route and what went wrong, so the panel can say why it has nothing. */
    const read = async <T>(path: string, schema: z.ZodType<T>): Promise<T> => {
      const response = await this.request(`${endpoint}/api/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`${say('summary.unavailable')} (${path}: HTTP ${response.status})`);
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
    if (epoch !== this.epoch || endpoint !== this.endpoint || this.token !== token) throw new Error(say('auth.changed'));
    return { since: own.since, totals, days, sources, budget: own.budget, nearLimit: own.nearLimit.map(({ scope, period, threshold }) => ({ scope, period, threshold })) };
  }
  profile(): Promise<PanelProfile> {
    if (!this.token) return Promise.reject(new Error(say('auth.signedOut')));
    return this.api('profile');
  }
  updateProfile(input: { name?: string | null; locale: Locale }): Promise<PanelProfile> {
    if (!this.token) return Promise.reject(new Error(say('auth.signedOut')));
    return this.api('profile', 'PATCH', input);
  }
  current() { return this.snapshot; }
  /**
   * Takes a token the host's supervisor provides instead of a browser sign-in (`tokenFile`, docs/development.md).
   * Replacing one token with another keeps the session revision, since short-lived tokens are renewed for the
   * same computer; signing in from none, or out to none, moves it and drops the cached configuration on the way out.
   */
  useToken(token: string | undefined) {
    return this.enqueue(async () => {
      if (token === this.token) return;
      this.verifier = undefined;
      if (!token) { this.epoch++; this.token = undefined; await this.clear(); return; }
      if (!this.token) this.epoch++;
      this.token = token;
    });
  }
  /** Drops the configuration and the knowledge copy, which belong to the account that synced them. */
  async clear() {
    this.snapshot = undefined;
    await rm(this.cachePath, { force: true });
    await rm(this.knowledgePath, { recursive: true, force: true });
    await rm(this.knowledgeStatePath, { force: true });
  }
  logout() { this.epoch++; const server = this.server; return this.enqueue(() => this.logoutOnce(server)); }
  /** Forgets the token here and revokes it at the server that issued it, so a copy of it opens nothing either. */
  private async logoutOnce(server: string) {
    const token = this.token;
    this.token = undefined; this.verifier = undefined; await this.clear(); await this.forgetToken();
    if (token) await this.revoke(server, token);
  }
}
/**
 * Reconcile only registrations owned by this plugin, for every team at once. The host's local registry is never
 * enumerated or mutated. A registration is `team:<teamId>:<configId>`, and a team's new name re-registers its entries.
 * Only presets are registered: a team model is already in the model picker through `platformAdapter`, and an
 * empty preset that only selected it listed every model a second time in the mode menu.
 */
export class TeamOverlay {
  private owned = new Map<string, { signature: string; dispose: () => Promise<void> }>();
  /** `teams` runs first on every apply, with the teams as synced: the plugin keeps one model provider per team there. */
  constructor(private register: (id: string, preset: Extract<TeamConfig, { kind: 'preset' }>, team: TeamSnapshot) => Promise<() => Promise<void>>,
    private teams: () => void) {}
  private operations: Promise<void> = Promise.resolve();
  apply(snapshot?: Snapshot) { const next = this.operations.then(() => this.reconcile(snapshot)); this.operations = next.catch(() => {}); return next; }
  private async reconcile(snapshot?: Snapshot) {
    this.teams();
    const desired = new Map((snapshot?.teams ?? []).flatMap(team => team.configs.filter((c): c is Extract<TeamConfig, { kind: 'preset' }> => c.kind === 'preset')
      .map(config => [`team:${team.teamId}:${config.id}` as string, { config, team, signature: JSON.stringify([team.teamName, config]) }] as const)));
    for (const [id, old] of this.owned) if (old.signature !== desired.get(id)?.signature) { await old.dispose(); this.owned.delete(id); }
    for (const [id, { config, team, signature }] of desired) if (!this.owned.has(id)) {
      const dispose = await this.register(id, config, team); this.owned.set(id, { signature, dispose });
    }
  }
}

export function pinnedPlugin(snapshot:Snapshot|undefined,id:string,version:string):Extract<TeamConfig,{kind:'plugin'}>|undefined {
 const team=snapshot?.teams.find(t=>t.configs.some(c=>c.id===id)||t.pluginVersions?.some(p=>p.configId===id));
 const current=team?.configs.find(c=>c.id===id&&c.kind==='plugin');
 if(current?.kind==='plugin'&&current.data.version===version)return current;
 const old=team?.pluginVersions?.find(p=>p.configId===id&&p.data.version===version);
 return old ? {id,kind:'plugin',name:old.name,version:1,data:old.data} : undefined;
}
export const inheritsModel = (config: TeamConfig) => config.kind === 'preset' && config.data.inheritModel === true;

/** References resolve within the configuration's own team only; never across teams, never to local models. */
export function modelData(snapshot: Snapshot, config: TeamConfig) {
  if (config.kind === 'plugin' || config.kind === 'preset' && config.data.inheritModel) return undefined;
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
export function unsizedModel(snapshot: Snapshot, config: TeamConfig): string | undefined {
  const data = modelData(snapshot, config);
  if (!data || data.contextWindow !== undefined) return undefined;
  const model = config.kind === 'preset' && config.data.modelConfigId ? findConfig(snapshot, config.data.modelConfigId) : undefined;
  return model?.name ?? (config.kind === 'preset' ? `${data.provider}/${data.model}` : config.name);
}
/**
 * The name of the hosted model, or of the one a preset calls, that its service has taken out of service (`offline`):
 * offered to no session until it is back, when the team's configuration still names it.
 */
export function offlineModel(snapshot: Snapshot, config: TeamConfig): string | undefined {
  const data = modelData(snapshot, config);
  if (!data || !('offline' in data) || !data.offline) return undefined;
  const model = config.kind === 'preset' && config.data.modelConfigId ? findConfig(snapshot, config.data.modelConfigId) : undefined;
  return model?.name ?? config.name;
}
/** Why a team model, or the model a preset calls, cannot run here, as the member reads it; the panel words its own. */
export function modelLimitProblem(snapshot: Snapshot, config: TeamConfig): string | undefined {
  const offline = offlineModel(snapshot, config);
  if (offline !== undefined) return say('model.offline', { name: offline });
  const name = unsizedModel(snapshot, config);
  return name === undefined ? undefined : say('model.noContextWindow', { name });
}

/**
 * A refusal as the model can act on it: the server's error code and, for a request it could not accept, which field
 * and why (`issues`, never a value the caller did not send).
 */
function failure(body: { error?: unknown; issues?: unknown }) {
  const issues = Array.isArray(body.issues) ? body.issues.slice(0, 5).map((i: { path?: unknown; message?: unknown }) =>
    `${Array.isArray(i.path) ? i.path.join('.') : ''}: ${String(i.message ?? '')}`) : [];
  return [String(body.error ?? ''), ...issues].join('; ');
}

/**
 * The server the member picked in the panel, kept beside the configuration cache
 * (`teamwork-cache.json` → `teamwork-cache.server.json`). Absent, the profile's
 * `apiEndpoint` applies, which defaults to the hosted service.
 */
export class ServerChoice {
  constructor(readonly path: string) {}
  static beside(cachePath: string) { return new ServerChoice(cachePath.replace(/(\.json)?$/, '.server.json')); }
  async read(): Promise<string | undefined> {
    try { return serverAddress(z.object({ server: z.string() }).parse(JSON.parse(await readFile(this.path, 'utf8'))).server); }
    catch { return undefined; }
  }
  async write(server: string | undefined) {
    if (server === undefined) { await rm(this.path, { force: true }); return; }
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${randomBytes(8).toString('hex')}.tmp`;
    try { await writeFile(temporary, JSON.stringify({ server }), { mode: 0o600 }); await rename(temporary, this.path); }
    finally { await rm(temporary, { force: true }); }
  }
}
