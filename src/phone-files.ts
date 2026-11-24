/**
 * A session's workspace as a phone or the console browses it: the folders and files under the session's working
 * directory, a search of their names, a text file's content page by page, a document's or an image's bytes, a file's
 * version to notice a change by, and what each turn changed with DSH's own comparison of it, all read only. Everything stays under that directory: a
 * path is resolved to its real path first, so neither `..` nor a symbolic link reaches past it, and an absolute path is
 * taken only when it lies inside. DSH's own `workspaceFiles` reads beyond the workspace, so it is not passed on.
 */
import { createHash } from 'node:crypto';
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { constants, type BigIntStats } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { PhoneSessionError } from './phone-session.js';

/** How much one answer carries, so it fits one message of the encrypted channel with room to spare. */
export const FILE_LIMITS = { entries: 500, matches: 200, visited: 20_000, textBytes: 256 * 1024 };
/** Folders a name search does not walk into: they are large, and never what a member looks for. */
const SKIPPED = new Set(['.git', 'node_modules']);

export interface FileEntry { name: string; kind: 'file' | 'directory'; bytes?: number }

/** The real path of `path` under `root`, or `not_found` when it does not exist or leaves `root`. */
async function within(root: string, path: string): Promise<{ base: string; target: string }> {
  const base = await realpath(root).catch(() => { throw new PhoneSessionError('not_found'); });
  const target = await realpath(resolve(base, path || '.')).catch(() => { throw new PhoneSessionError('not_found'); });
  if (target !== base && !target.startsWith(base + sep)) throw new PhoneSessionError('not_found');
  return { base, target };
}

/** A path under the workspace as the clients show it: relative, with `/` on every system; "" is the workspace. */
const shown = (base: string, target: string) => relative(base, target).split(sep).join('/');

/** One folder's entries, folders first, each by name; a link is shown as what it reaches, and dropped when that leaves. */
export async function listDirectory(root: string, path: string) {
  const { base, target } = await within(root, path);
  if (!(await stat(target)).isDirectory()) throw new PhoneSessionError('not_found');
  const names = (await readdir(target)).sort((a, b) => a.localeCompare(b));
  const entries: FileEntry[] = [];
  for (const name of names) {
    if (entries.length >= FILE_LIMITS.entries) break;
    try {
      const real = await within(base, resolve(target, name));
      const info = await stat(real.target);
      if (info.isDirectory()) entries.push({ name, kind: 'directory' });
      else if (info.isFile()) entries.push({ name, kind: 'file', bytes: info.size });
    } catch { /* Leaves the workspace, or went away while listed. */ }
  }
  entries.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'directory' ? -1 : 1));
  return { path: shown(base, target), entries, truncated: names.length > entries.length && entries.length >= FILE_LIMITS.entries };
}

/** Files whose name holds `query` (any case), nearest first, walking no link and none of `SKIPPED`. */
export async function searchFiles(root: string, query: string) {
  const { base } = await within(root, '');
  const needle = query.toLocaleLowerCase();
  const matches: string[] = [];
  const queue = [base];
  let visited = 0;
  let truncated = false;
  while (queue.length) {
    const folder = queue.shift()!;
    let names: string[];
    try { names = (await readdir(folder)).sort((a, b) => a.localeCompare(b)); } catch { continue; }
    for (const name of names) {
      if (++visited > FILE_LIMITS.visited || matches.length >= FILE_LIMITS.matches) { truncated = true; break; }
      const path = resolve(folder, name);
      const info = await lstat(path).catch(() => null);
      if (!info) continue;
      if (info.isDirectory()) { if (!SKIPPED.has(name)) queue.push(path); }
      else if (info.isFile() && name.toLocaleLowerCase().includes(needle)) matches.push(shown(base, path));
    }
    if (truncated) break;
  }
  return { matches, truncated };
}

/** What a file is now, to tell a later read it changed: its device, inode, size and both times. */
const stampOf = (value: BigIntStats) => [value.dev, value.ino, value.size, value.mtimeNs, value.ctimeNs].join(':');

/** Where a UTF-8 cut at the end of `bytes` must fall so no character is split: before a lead byte whose tail is missing. */
export function characterEnd(bytes: Uint8Array): number {
  for (let back = 1; back <= Math.min(4, bytes.length); back++) {
    const byte = bytes[bytes.length - back]!;
    if ((byte & 0xc0) === 0x80) continue;
    const length = byte >= 0xf0 ? 4 : byte >= 0xe0 ? 3 : byte >= 0xc0 ? 2 : 1;
    return length > back ? bytes.length - back : bytes.length;
  }
  return bytes.length;
}

/**
 * A text file's content from byte `offset`, `FILE_LIMITS.textBytes` at most, cut between characters; `next` is where
 * the following page starts and is absent at the end. `version` says which file the pages belong to: a later page
 * asked of another version is `invalid_request`, as a document's range is. A file with a NUL byte is not text.
 */
export async function readText(root: string, path: string, offset = 0, version?: string) {
  const { base, target } = await within(root, path);
  const info = await stat(target, { bigint: true });
  if (!info.isFile()) throw new PhoneSessionError('not_found');
  const current = stampOf(info);
  const size = Number(info.size);
  if ((version && version !== current) || (offset > 0 && !version) || offset > size) throw new PhoneSessionError('invalid_request');
  const handle = await open(target, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(size - offset, FILE_LIMITS.textBytes));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
    const read = buffer.subarray(0, bytesRead);
    if (read.includes(0)) throw new PhoneSessionError('not_text');
    const more = offset + bytesRead < size;
    const bytes = more ? read.subarray(0, characterEnd(read)) : read;
    const text = new TextDecoder('utf-8').decode(bytes);
    return {
      path: shown(base, target), text, bytes: size, version: current, offset,
      truncated: more, ...(more ? { next: offset + bytes.length } : {}),
    };
  } finally {
    await handle.close();
  }
}

/** A file's version and size, to notice a change without reading it. */
export async function statFile(root: string, path: string) {
  const { target } = await within(root, path);
  const info = await stat(target, { bigint: true });
  if (!info.isFile()) throw new PhoneSessionError('not_found');
  return { version: stampOf(info), bytes: Number(info.size) };
}

type OfficeExtension = 'doc' | 'docx' | 'ppt' | 'pptx';

export interface PreviewOfficeKit {
  convert(request: {
    extension: OfficeExtension;
    priority: 'foreground';
    source: { key: string; version: string; bytes: number; read(signal: AbortSignal, maxBytes: number): Promise<{ bytes: Uint8Array; version: string }> };
  }, signal: AbortSignal): Promise<{ pdf: Uint8Array; generation: string; cacheKey: string; missingFonts?: string[] }>;
}

const DOCUMENT_LIMIT = 16 * 1024 * 1024;
const DOCUMENT_CHUNK = 128 * 1024;

/** Images sent as they are, for the client to draw. */
const IMAGES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg', 'avif']);

/**
 * Transfer one display document range: a PDF, a workbook or an image as it is, or the PDF the Host renders from an
 * Office file, with the font families that rendering lacked (`missingFonts`, Office Kit's own list).
 */
export async function readDocument(root: string, path: string, offset: number, version?: string, office?: PreviewOfficeKit) {
  const { target } = await within(root, path);
  const extension = /\.([a-z]+)$/i.exec(target)?.[1]?.toLowerCase() ?? '';
  const raw = extension === 'pdf' || extension === 'xls' || extension === 'xlsx' || IMAGES.has(extension);
  if (!raw && extension !== 'doc' && extension !== 'docx' && extension !== 'ppt' && extension !== 'pptx') {
    throw new PhoneSessionError('file_type');
  }
  const stamp = stampOf;
  async function check() {
    const info = await stat(target, { bigint: true });
    if (!info.isFile() || (await within(root, path)).target !== target) throw new PhoneSessionError('not_found');
    if (info.size > BigInt(DOCUMENT_LIMIT)) throw new PhoneSessionError('document_too_large');
    return info;
  }

  const source = await check();
  const sourceVersion = stamp(source);
  const bytes = Number(source.size);
  if (!bytes) throw new PhoneSessionError('document_empty');
  async function read(start: number, count: number) {
    const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const current = async () => stamp((await handle.stat({ bigint: true })));
      if (await current() !== sourceVersion) throw new PhoneSessionError('invalid_request');
      const buffer = Buffer.alloc(count);
      let done = 0;
      while (done < count) {
        const { bytesRead } = await handle.read(buffer, done, count - done, start + done);
        if (!bytesRead) throw new PhoneSessionError('invalid_request');
        done += bytesRead;
      }
      if (await current() !== sourceVersion || stamp((await check())) !== sourceVersion) {
        throw new PhoneSessionError('invalid_request');
      }
      return buffer;
    } finally {
      await handle.close();
    }
  }

  const ensureRange = (revision: string, size: number) => {
    if (size > DOCUMENT_LIMIT) throw new PhoneSessionError('document_too_large');
    if (offset >= size || (offset !== 0 && !version) || (version && revision !== version)) {
      throw new PhoneSessionError('invalid_request');
    }
  };
  if (raw) {
    ensureRange(sourceVersion, bytes);
    const chunk = await read(offset, Math.min(DOCUMENT_CHUNK, bytes - offset));
    return { version: sourceVersion, size: bytes, offset, data: chunk.toString('base64') };
  }
  if (!office) throw new PhoneSessionError('preview_unavailable');
  const extensionOf = extension as OfficeExtension;
  // Each range asks the kit again: it keeps its renders by source version and content, so only the first converts.
  // Within every caller's wait: the live relay's 75 s for this call, a cloud computer's server's 60 s for a response.
  const signal = AbortSignal.timeout(55_000);
  let rendered: Awaited<ReturnType<PreviewOfficeKit['convert']>>;
  try {
    rendered = await office.convert({ extension: extensionOf, priority: 'foreground', source: {
      key: target, version: sourceVersion, bytes,
      async read(upstream, maxBytes) {
        upstream.throwIfAborted();
        if (bytes > maxBytes) throw new PhoneSessionError('document_too_large');
        const input = await read(0, bytes);
        upstream.throwIfAborted();
        return { bytes: input, version: sourceVersion };
      },
    } }, signal);
  } catch (error) {
    if (error instanceof PhoneSessionError) throw error;
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    throw new PhoneSessionError(code === 'input-too-large' || code === 'output-too-large' ? 'document_too_large' : code === 'unavailable' ? 'preview_unavailable' : 'unavailable');
  }
  if (stamp((await check())) !== sourceVersion) throw new PhoneSessionError('invalid_request');
  const revision = createHash('sha256').update(JSON.stringify([sourceVersion, rendered.generation, rendered.cacheKey])).digest('hex');
  const size = rendered.pdf.length;
  if (!size) throw new PhoneSessionError('unavailable');
  ensureRange(revision, size);
  return {
    version: revision, size, offset, data: Buffer.from(rendered.pdf.subarray(offset, offset + DOCUMENT_CHUNK)).toString('base64'),
    missingFonts: (rendered.missingFonts ?? []).slice(0, 50).map((name) => String(name).slice(0, 200)),
  };
}

/** DSH's per-turn record of what a session changed (its `workspaceChanges` service), as far as a client needs it. */
export interface WorkspaceChanges {
  summary(sessionId: string, seq: number): { turn: number; cwd: string; files: { path: string; display: string; added: number; deleted: number; binary?: true; oversized?: true }[]; total: number; added: number; deleted: number } | undefined;
  diff(sessionId: string, seq: number, index: number, signal: AbortSignal): Promise<
    | { kind: 'text'; path: string; display: string; before: boolean; after: boolean; coarse: boolean; hunks: { oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }[] }
    | { kind: 'binary' | 'oversized'; path: string; display: string }
    | undefined>;
}

/** How much of a turn's record one answer carries, so it fits one message of the encrypted channel. */
export const CHANGE_LIMITS = { files: 200, diffBytes: 192 * 1024, lineChars: 2000 };

/** The files a turn changed, with DSH's line counts: the summary its `workspace/changes` event `seq` announced. */
export function changeSummary(changes: WorkspaceChanges | undefined, sessionId: string, seq: number) {
  if (!changes) throw new PhoneSessionError('preview_unavailable');
  const summary = changes.summary(sessionId, seq);
  if (!summary) throw new PhoneSessionError('not_found');
  return {
    turn: summary.turn, total: summary.total, added: summary.added, deleted: summary.deleted,
    files: summary.files.slice(0, CHANGE_LIMITS.files).map((file) => ({
      path: file.path, display: file.display, added: file.added, deleted: file.deleted,
      ...(file.binary ? { binary: true } : {}), ...(file.oversized ? { oversized: true } : {}),
    })),
  };
}

/**
 * DSH's comparison of one changed file, before and after its turn. Only a file under the session's working directory
 * is compared, as only such a file is read: one elsewhere on the computer is `not_found`. A comparison longer than one
 * message carries is cut after a whole line (`truncated`).
 */
export async function changeDiff(changes: WorkspaceChanges | undefined, root: string, sessionId: string, seq: number, index: number) {
  if (!changes) throw new PhoneSessionError('preview_unavailable');
  const summary = changes.summary(sessionId, seq);
  const file = summary?.files[index];
  if (!summary || !file) throw new PhoneSessionError('not_found');
  const base = await realpath(root).catch(() => { throw new PhoneSessionError('not_found'); });
  const place = resolve(summary.cwd, file.path);
  const inside = (dir: string) => place === dir || place.startsWith(dir + sep);
  if (!inside(resolve(root)) && !inside(base)) throw new PhoneSessionError('not_found');
  // A file that still exists is held to its real path too, so a link cannot lead the comparison out.
  if (await lstat(place).then(() => true, () => false)) await within(root, place);
  const diff = await changes.diff(sessionId, seq, index, AbortSignal.timeout(20_000));
  if (!diff) throw new PhoneSessionError('not_found');
  if (diff.kind !== 'text') return { kind: diff.kind, path: diff.path, display: diff.display };
  let room = CHANGE_LIMITS.diffBytes;
  let truncated = false;
  const hunks: typeof diff.hunks = [];
  for (const hunk of diff.hunks) {
    const lines: string[] = [];
    for (const line of hunk.lines) {
      const kept = line.length > CHANGE_LIMITS.lineChars ? line.slice(0, CHANGE_LIMITS.lineChars) : line;
      room -= Buffer.byteLength(kept) + 4;
      if (room < 0) { truncated = true; break; }
      lines.push(kept);
    }
    if (lines.length) hunks.push({ ...hunk, lines });
    if (truncated) break;
  }
  return { kind: 'text' as const, path: diff.path, display: diff.display, before: diff.before, after: diff.after, coarse: diff.coarse, hunks, truncated };
}
