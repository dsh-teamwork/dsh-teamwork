/**
 * `KnowledgeSync`: the read-only local copy of the team knowledge the member reads (docs/tech/knowledge.md in the
 * platform repository, "The sync manifest"), which agents search with their own file tools. It runs in the
 * configuration sync's flight (`ConfigSync`), so it shares its interval and never overlaps itself.
 *
 * The copy is `teamwork-knowledge/{team}/{space}/{folder…}/{title}.md` beside the cache, each file the document's text
 * under the front matter line `knowledge: {documentId}@{version}`, and read-only. A document's attachments are beside
 * it in `{title}.files/{name}`, read-only too. `<cache>.knowledge.json` records which version of each document and
 * which digest of each attachment is on disk and where, so a sync fetches only new and changed ones, moves a renamed
 * one, and deletes what the member no longer reads. Signing out removes both (`TeamworkClient.clear`).
 */
import { randomBytes } from 'node:crypto';
import { chmod, lstat, mkdir, readdir, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { KnowledgeError, MAX_ATTACHMENT, type KnowledgeManifest, type TeamworkClient } from './client.js';

/** One attachment on disk: the digest of the bytes it holds, and its path in the copy (`/`-separated). */
export interface KnowledgeFile { digest: string; path: string }
/** One document on disk: its team, the version it holds, its path in the copy, and its attachments by name. */
export interface KnowledgeEntry { teamId: string; version: number; path: string; attachments: Record<string, KnowledgeFile> }
export type KnowledgeState = Record<string, KnowledgeEntry>;
const fileSchema = z.object({ digest: z.string().min(1), path: z.string().min(1) });
const stateSchema = z.object({ documents: z.record(z.string(), z.object({
  teamId: z.string().min(1), version: z.number().int().positive(), path: z.string().min(1),
  // A state from before attachments holds none; they are fetched on the next sync.
  attachments: z.record(z.string(), fileSchema).default({}),
})) });

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
 * An attachment's name as one path segment, split before its extension: `segment` on the part before it, so the
 * length bound never cuts the extension off, and the extension as it is (letters and digits only).
 */
export function attachmentSegment(name: string) {
  const extension = /\.[A-Za-z0-9]{1,16}$/.exec(name)?.[0] ?? '';
  return { stem: segment(name.slice(0, name.length - extension.length)), extension };
}

/**
 * Where each document of a manifest goes in the copy, and its attachments in `{title}.files/` beside it. Names that
 * come out the same after `segment`, compared without case as a case-insensitive file system would, are told apart by
 * the id of the later document, or the start of the later attachment's digest. An attachment larger than the server's
 * limit is left out, should a manifest ever list one.
 */
export function knowledgeLayout(manifest: KnowledgeManifest) {
  const out = new Map<string, KnowledgeEntry>();
  const taken = new Set<string>();
  // Two attachments of one document may hold the same bytes, so a suffix that is taken too is counted on.
  const claim = (parent: string, name: string, id: string, extension = '') => {
    for (let n = 0; ; n++) {
      const candidate = `${name}${n === 0 ? '' : n === 1 ? ` (${id})` : ` (${id} ${n})`}${extension}`;
      const path = parent ? `${parent}/${candidate}` : candidate;
      if (!taken.has(path.toLowerCase())) { taken.add(path.toLowerCase()); return path; }
    }
  };
  for (const team of manifest.teams) {
    const teamPath = claim('', segment(team.teamName), team.teamId);
    for (const space of team.spaces) {
      const spacePath = claim(teamPath, segment(space.name), space.id);
      for (const document of space.documents) {
        if (out.has(document.id)) continue;
        // A folder never ends in .md or .files, so it cannot be mistaken for a document or its attachments beside it.
        const folders = document.folders.map(name => segment(name).replace(/\.(md|files)$/i, '$&_'));
        const parent = [spacePath, ...folders].join('/');
        const path = claim(parent, segment(document.title), document.id, '.md');
        // The document's path is unique without case, so its .files folder is too.
        const files = `${path.slice(0, -'.md'.length)}.files`;
        const attachments: Record<string, KnowledgeFile> = {};
        for (const attachment of document.attachments) {
          if (attachment.size > MAX_ATTACHMENT || attachments[attachment.name]) continue;
          const { stem, extension } = attachmentSegment(attachment.name);
          attachments[attachment.name] = { digest: attachment.digest, path: claim(files, stem, attachment.digest.slice(0, 8), extension) };
        }
        out.set(document.id, { teamId: team.teamId, version: document.version, path, attachments });
      }
    }
  }
  return out;
}

/** One attachment of a sync's plan: its document and name, and where its wanted bytes go. */
export interface KnowledgeAttachmentItem { id: string; teamId: string; name: string; file: KnowledgeFile }

/**
 * What a sync does to bring the copy from `state` to `wanted`, given the files `present` on disk: keep what holds the
 * wanted version or digest where it should be, move what holds it elsewhere, and fetch the rest. A document's text
 * and its attachments are planned apart, so a renamed document's attachments move with it whether or not its text
 * changed. Whatever is not kept, moved or fetched is left for the sweep to delete.
 */
export function knowledgePlan(state: KnowledgeState, wanted: Map<string, KnowledgeEntry>, present: Set<string>) {
  const keep: [string, KnowledgeEntry][] = [], move: { id: string; from: string; to: KnowledgeEntry }[] = [], fetch: [string, KnowledgeEntry][] = [];
  const files = { keep: [] as KnowledgeAttachmentItem[], move: [] as { item: KnowledgeAttachmentItem; from: string }[], fetch: [] as KnowledgeAttachmentItem[] };
  for (const [id, entry] of wanted) {
    const had = state[id];
    if (!had || had.version !== entry.version || !present.has(had.path)) fetch.push([id, entry]);
    else if (had.path === entry.path) keep.push([id, entry]);
    else move.push({ id, from: had.path, to: entry });
    for (const [name, file] of Object.entries(entry.attachments)) {
      const item = { id, teamId: entry.teamId, name, file }, was = had?.attachments[name];
      if (!was || was.digest !== file.digest || !present.has(was.path)) files.fetch.push(item);
      else if (was.path === file.path) files.keep.push(item);
      else files.move.push({ item, from: was.path });
    }
  }
  return { keep, move, fetch, files };
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
      // Documents first, then each one's attachments as they land; a document whose text is not on disk keeps none.
      const next: KnowledgeState = Object.fromEntries(plan.keep.map(([id, entry]) => [id, { ...entry, attachments: {} }]));
      const landed = new Map<string, Record<string, KnowledgeFile>>();
      const land = (item: KnowledgeAttachmentItem, file: KnowledgeFile) => {
        const files = landed.get(item.id) ?? {};
        files[item.name] = file;
        landed.set(item.id, files);
      };
      for (const item of plan.files.keep) land(item, item.file);
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      // Moves go through a name of their own first, so two files can swap paths.
      const moving = [];
      for (const { from, ...move } of [...plan.move.map(({ id, from, to }) => ({ from, to: to.path, done: () => { next[id] = { ...to, attachments: {} }; } })),
        ...plan.files.move.map(({ item, from }) => ({ from, to: item.file.path, done: () => land(item, item.file) }))]) {
        const temporary = join(this.root, `.move-${randomBytes(8).toString('hex')}`);
        await rename(join(this.root, ...from.split('/')), temporary);
        moving.push({ temporary, ...move });
      }
      for (const { temporary, to, done } of moving) { await this.place(temporary, to); done(); }
      const wantedPaths = new Set([...wanted.values()].flatMap(entry => [entry.path, ...Object.values(entry.attachments).map(file => file.path)]));
      let failed = 0;
      type Job = { kind: 'document'; id: string; entry: KnowledgeEntry } | { kind: 'attachment'; item: KnowledgeAttachmentItem };
      const queue: Job[] = [...plan.fetch.map(([id, entry]) => ({ kind: 'document' as const, id, entry })), ...plan.files.fetch.map(item => ({ kind: 'attachment' as const, item }))];
      const total = queue.length;
      const worker = async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          if (changed()) return;
          const temporary = join(this.root, `.write-${randomBytes(8).toString('hex')}`);
          try {
            if (job.kind === 'document') {
              const { id, entry } = job;
              const document = await this.client.readKnowledge(entry.teamId, id, entry.version, signal);
              if (changed()) return;
              await writeFile(temporary, withFrontMatter(id, document.version, document.text), { mode: 0o600 });
              await chmod(temporary, 0o444);
              await this.place(temporary, entry.path);
              next[id] = { ...entry, version: document.version, attachments: {} };
            } else {
              const { item } = job;
              const bytes = await this.client.readKnowledgeAttachment(item.teamId, item.id, item.name, item.file.digest, signal);
              if (changed()) return;
              await writeFile(temporary, bytes, { mode: 0o600 });
              await chmod(temporary, 0o444);
              await this.place(temporary, item.file.path);
              land(item, item.file);
            }
          } catch {
            failed++;
            await rm(temporary, { force: true });
            // What it had stays where it was, unless something else now goes there.
            if (job.kind === 'document') {
              const had = this.state[job.id];
              if (had && before.files.has(had.path) && (had.path === job.entry.path || !wantedPaths.has(had.path))) next[job.id] = { ...had, attachments: {} };
            } else {
              const was = this.state[job.item.id]?.attachments[job.item.name];
              if (was && before.files.has(was.path) && (was.path === job.item.file.path || !wantedPaths.has(was.path))) land(job.item, was);
            }
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      if (changed()) throw new SyncFailure('the account changed during the sync');
      for (const [id, entry] of Object.entries(next)) entry.attachments = landed.get(id) ?? {};
      // The sweep: files the state does not name (removed documents and attachments, left-over temporary files), then
      // empty folders, so a .files folder stays while it holds an attachment and goes with its last one.
      const kept = new Set(Object.values(next).flatMap(entry => [entry.path, ...Object.values(entry.attachments).map(file => file.path)]));
      const after = await walk(this.root);
      for (const path of after.files) if (!kept.has(path)) await rm(join(this.root, ...path.split('/')), { force: true });
      for (const folder of after.folders) await rmdir(join(this.root, ...folder.split('/'))).catch(() => { /* not empty */ });
      await this.writeState(next);
      this.state = next;
      if (failed) throw new SyncFailure(`${failed} of ${total} changed documents and attachments could not be fetched; they are tried again on the next sync`);
    } catch (error) {
      throw new Error(`Teamwork knowledge sync failed: ${describe(error)}`);
    } finally {
      // A sign-out that cleared the copy while this sync wrote to it is cleared again, now that nothing writes.
      if (changed()) { await rm(this.root, { recursive: true, force: true }); await rm(this.client.knowledgeStatePath, { force: true }); }
    }
  }
}
