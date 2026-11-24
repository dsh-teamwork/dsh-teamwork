/**
 * `KnowledgeSync`: the read-only local copy of the team knowledge the member reads (docs/tech/knowledge.md in the
 * platform repository, "The sync manifest"), which agents search with their own file tools. It runs in the
 * configuration sync's flight (`ConfigSync`), so it shares its interval and never overlaps itself.
 *
 * The copy is `teamwork-knowledge/{team}/{space}/{folder…}/{title}.md` beside the cache, each file the document's text
 * under the front matter line `knowledge: {documentId}@{version}`, and read-only. `<cache>.knowledge.json` records
 * which version of each document is on disk and where, so a sync fetches only new and changed documents, moves a
 * renamed one, and deletes what the member no longer reads. Signing out removes both (`TeamworkClient.clear`).
 */
import { randomBytes } from 'node:crypto';
import { chmod, lstat, mkdir, readdir, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { KnowledgeError, type KnowledgeManifest, type TeamworkClient } from './client.js';

/** One document on disk: its team, the version it holds, and its path in the copy (`/`-separated). */
export interface KnowledgeEntry { teamId: string; version: number; path: string }
export type KnowledgeState = Record<string, KnowledgeEntry>;
const stateSchema = z.object({ documents: z.record(z.string(), z.object({ teamId: z.string().min(1), version: z.number().int().positive(), path: z.string().min(1) })) });

const FRONT_LINE = /^(---\r?\n)knowledge:[ \t]*([A-Za-z0-9_-]+)@(\d+)[ \t]*\r?\n/;

/**
 * A document's text as the copy holds it: `knowledge: {documentId}@{version}` first in its front matter. A text that
 * opens with front matter of its own gets the line inside it; any other text gets a block of its own.
 */
export function withFrontMatter(documentId: string, version: number, text: string) {
  const line = `knowledge: ${documentId}@${version}`;
  const open = /^---(\r?\n)(?!---(?:\r?\n|$))/.exec(text);
  if (open && /\r?\n---(?:\r?\n|$)/.test(text.slice(open[0].length - open[1].length))) return `---${open[1]}${line}${open[1]}${text.slice(open[0].length)}`;
  return `---\n${line}\n---\n${text}`;
}

/** The inverse of `withFrontMatter`: the text without the `knowledge:` line, and the document and version it named. */
export function stripFrontMatter(text: string): { text: string; documentId?: string; version?: number } {
  const match = FRONT_LINE.exec(text);
  if (!match) return { text };
  let rest = match[1] + text.slice(match[0].length);
  const empty = /^---\r?\n---(?:\r?\n|$)/.exec(rest);
  if (empty) rest = rest.slice(empty[0].length);
  return { text: rest, documentId: match[2], version: Number(match[3]) };
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
/** At most this many UTF-8 bytes per name, leaving room for a ` ({id})` suffix and `.md` under the usual 255. */
const SEGMENT_BYTES = 160;

/**
 * A name as one path segment on any file system: no separators, control or reserved characters, no leading dot (a
 * hidden file is one grep and ripgrep skip), no trailing dot or space, no Windows device name, and bounded in length.
 */
export function segment(name: string) {
  let s = name.normalize('NFC').replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').trim();
  s = s.replace(/^\./, '_').replace(/[. ]+$/, '');
  if (RESERVED.test(s)) s = `_${s}`;
  let bytes = 0, out = '';
  for (const char of s) { bytes += Buffer.byteLength(char); if (bytes > SEGMENT_BYTES) break; out += char; }
  return out.trimEnd() || '_';
}

/**
 * Where each document of a manifest goes in the copy. Names that come out the same after `segment`, compared without
 * case as a case-insensitive file system would, are told apart by the id of the later one.
 */
export function knowledgeLayout(manifest: KnowledgeManifest) {
  const out = new Map<string, KnowledgeEntry>();
  const taken = new Set<string>();
  const claim = (parent: string, name: string, id: string, extension = '') => {
    for (const candidate of [`${name}${extension}`, `${name} (${id})${extension}`]) {
      const path = parent ? `${parent}/${candidate}` : candidate;
      if (!taken.has(path.toLowerCase())) { taken.add(path.toLowerCase()); return path; }
    }
    throw new Error(`Two knowledge entries share the id ${id}`);
  };
  for (const team of manifest.teams) {
    const teamPath = claim('', segment(team.teamName), team.teamId);
    for (const space of team.spaces) {
      const spacePath = claim(teamPath, segment(space.name), space.id);
      for (const document of space.documents) {
        if (out.has(document.id)) continue;
        // A folder never ends in .md, so it cannot be mistaken for a document beside it.
        const folders = document.folders.map(name => segment(name).replace(/\.md$/i, '$&_'));
        const parent = [spacePath, ...folders].join('/');
        out.set(document.id, { teamId: team.teamId, version: document.version, path: claim(parent, segment(document.title), document.id, '.md') });
      }
    }
  }
  return out;
}

/**
 * What a sync does to bring the copy from `state` to `wanted`, given the files `present` on disk: keep what holds the
 * wanted version where it should be, move what holds it elsewhere, and fetch the rest. Whatever is not kept, moved or
 * fetched is left for the sweep to delete.
 */
export function knowledgePlan(state: KnowledgeState, wanted: Map<string, KnowledgeEntry>, present: Set<string>) {
  const keep: [string, KnowledgeEntry][] = [], move: { id: string; from: string; to: KnowledgeEntry }[] = [], fetch: [string, KnowledgeEntry][] = [];
  for (const [id, entry] of wanted) {
    const had = state[id];
    if (!had || had.version !== entry.version || !present.has(had.path)) fetch.push([id, entry]);
    else if (had.path === entry.path) keep.push([id, entry]);
    else move.push({ id, from: had.path, to: entry });
  }
  return { keep, move, fetch };
}

/** Every regular file under `root`, as `/`-separated paths, and every folder, deepest first. */
async function walk(root: string) {
  const files = new Set<string>(), folders: string[] = [];
  const visit = async (at: string, prefix: string) => {
    let entries;
    try { entries = await readdir(at, { withFileTypes: true }); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { await visit(join(at, entry.name), path); folders.push(path); }
      else files.add(path);
    }
  };
  await visit(root, '');
  return { files, folders: folders.sort((a, b) => b.split('/').length - a.split('/').length) };
}

/** A failure of the sync's own, worded for the log as it is. */
class SyncFailure extends Error {}

/** A failure worded without what a transport error can carry: the server's status and code, or the file system's. */
function describe(error: unknown) {
  if (error instanceof KnowledgeError || error instanceof SyncFailure) return error.message;
  const { code, syscall } = error as NodeJS.ErrnoException;
  if (typeof code === 'string' && syscall) return `${code} on ${syscall}`;
  if (error instanceof z.ZodError) return 'the server answered in an unexpected shape';
  return 'the server could not be reached';
}

const CONCURRENCY = 6;

export class KnowledgeSync {
  private state: KnowledgeState = {};
  /** The client's session revision `state` belongs to; another revision's copy was cleared with its sign-in. */
  private revision = -1;
  constructor(private client: TeamworkClient) {}
  /** The copy's folder, which the agent is told about. */
  get root() { return this.client.knowledgePath; }
  /** Reads what the last run left on disk, for the account restored with it. */
  async restore() {
    this.state = await this.readState();
    this.revision = this.client.sessionRevision();
  }
  private current() { return this.revision === this.client.sessionRevision() ? this.state : {}; }
  /** How many documents the copy holds for the signed-in account. */
  count() { return this.client.authenticated() ? Object.keys(this.current()).length : 0; }
  /** The synced document `id`: its team, version and path in the copy. */
  find(id: string): KnowledgeEntry | undefined { return this.client.authenticated() ? this.current()[id] : undefined; }

  private async readState(): Promise<KnowledgeState> {
    try { return stateSchema.parse(JSON.parse(await readFile(this.client.knowledgeStatePath, 'utf8'))).documents; }
    catch { return {}; }
  }
  private async writeState(state: KnowledgeState) {
    const path = this.client.knowledgeStatePath, temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`;
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    try { await writeFile(temporary, JSON.stringify({ documents: state }), { mode: 0o600 }); await rename(temporary, path); }
    finally { await rm(temporary, { force: true }); }
  }
  /** Puts a file written beside the tree at `path` in it, replacing what is there; read-only, as every file of the copy. */
  private async place(temporary: string, path: string) {
    const target = join(this.root, ...path.split('/'));
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await chmod(target, 0o600).catch(() => { /* none there yet; Windows will not replace a read-only file */ });
    await rename(temporary, target);
  }

  /**
   * Brings the copy in step with the server. A document that cannot be fetched keeps the version it had; the sync
   * then fails with how many, after doing everything else. Throws only messages that carry no credentials.
   */
  async sync(signal?: AbortSignal) {
    if (!this.client.authenticated()) return;
    const revision = this.client.sessionRevision();
    const changed = () => this.client.sessionRevision() !== revision;
    if (this.revision !== revision) { this.state = await this.readState(); this.revision = revision; }
    try {
      const manifest = await this.client.knowledgeManifest(signal);
      if (changed()) throw new SyncFailure('the account changed during the sync');
      const wanted = knowledgeLayout(manifest);
      const before = await walk(this.root);
      const plan = knowledgePlan(this.state, wanted, before.files);
      const next: KnowledgeState = Object.fromEntries(plan.keep);
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      // Moves go through a name of their own first, so two documents can swap paths.
      const moving = [];
      for (const { id, from, to } of plan.move) {
        const temporary = join(this.root, `.move-${randomBytes(8).toString('hex')}`);
        await rename(join(this.root, ...from.split('/')), temporary);
        moving.push({ id, temporary, to });
      }
      for (const { id, temporary, to } of moving) { await this.place(temporary, to.path); next[id] = to; }
      let failed = 0;
      const queue = [...plan.fetch];
      const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          const [id, entry] = item;
          if (changed()) return;
          const temporary = join(this.root, `.write-${randomBytes(8).toString('hex')}`);
          try {
            const document = await this.client.readKnowledge(entry.teamId, id, entry.version, signal);
            if (changed()) return;
            await writeFile(temporary, withFrontMatter(id, document.version, document.text), { mode: 0o600 });
            await chmod(temporary, 0o444);
            await this.place(temporary, entry.path);
            next[id] = { ...entry, version: document.version };
          } catch {
            failed++;
            await rm(temporary, { force: true });
            // The version it had stays where it was, unless another document now goes there.
            const had = this.state[id];
            if (had && before.files.has(had.path) && ![...wanted].some(([other, entry]) => other !== id && entry.path === had.path)) next[id] = had;
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      if (changed()) throw new SyncFailure('the account changed during the sync');
      // The sweep: files the state does not name (removed documents, left-over temporary files), then empty folders.
      const kept = new Set(Object.values(next).map(entry => entry.path));
      const after = await walk(this.root);
      for (const path of after.files) if (!kept.has(path)) await rm(join(this.root, ...path.split('/')), { force: true });
      for (const folder of after.folders) await rmdir(join(this.root, ...folder.split('/'))).catch(() => { /* not empty */ });
      await this.writeState(next);
      this.state = next;
      if (failed) throw new SyncFailure(`${failed} of ${plan.fetch.length} changed documents could not be fetched; they are tried again on the next sync`);
    } catch (error) {
      throw new Error(`Teamwork knowledge sync failed: ${describe(error)}`);
    } finally {
      // A sign-out that cleared the copy while this sync wrote to it is cleared again, now that nothing writes.
      if (changed()) { await rm(this.root, { recursive: true, force: true }); await rm(this.client.knowledgeStatePath, { force: true }); }
    }
  }
}
