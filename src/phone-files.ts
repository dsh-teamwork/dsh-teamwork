/**
 * A session's workspace as a phone or the console browses it: the folders and files under the session's working
 * directory, a search of their names, and a text file's content, read only. Everything stays under that directory: a
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

/** A text file's content, its first `FILE_LIMITS.textBytes` when longer; one with a NUL byte is not text. */
export async function readText(root: string, path: string) {
  const { base, target } = await within(root, path);
  const info = await stat(target);
  if (!info.isFile()) throw new PhoneSessionError('not_found');
  const handle = await open(target, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(info.size, FILE_LIMITS.textBytes));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const bytes = buffer.subarray(0, bytesRead);
    if (bytes.includes(0)) throw new PhoneSessionError('not_text');
    // A cut may fall inside a character: the decoder's replacement mark at the very end is dropped.
    const text = new TextDecoder('utf-8').decode(bytes).replace(/�$/, '');
    return { path: shown(base, target), text, bytes: info.size, truncated: info.size > bytesRead };
  } finally {
    await handle.close();
  }
}


type OfficeExtension = 'doc' | 'docx' | 'ppt' | 'pptx';

export interface PreviewOfficeKit {
  convert(request: {
    extension: OfficeExtension;
    priority: 'foreground';
    source: { key: string; version: string; bytes: number; read(signal: AbortSignal, maxBytes: number): Promise<{ bytes: Uint8Array; version: string }> };
  }, signal: AbortSignal): Promise<{ pdf: Uint8Array; generation: string; cacheKey: string }>;
}

const DOCUMENT_LIMIT = 16 * 1024 * 1024;
const DOCUMENT_CHUNK = 128 * 1024;
/** How long the last Office render is kept for the ranges after its first: a client reads them one after another. */
const RENDER_KEPT_MS = 2 * 60_000;

/** The last Office file rendered, by its real path and the version of its source, so each range does not convert it again. */
let lastRender: { key: string; revision: string; pdf: Uint8Array; timer: ReturnType<typeof setTimeout> } | undefined;
function keepRender(key: string, revision: string, pdf: Uint8Array) {
  if (lastRender) clearTimeout(lastRender.timer);
  const timer = setTimeout(() => { if (lastRender?.timer === timer) lastRender = undefined; }, RENDER_KEPT_MS);
  timer.unref?.();
  lastRender = { key, revision, pdf, timer };
  return lastRender;
}

/** Transfer one display document range, including PDFs rendered from Office files by the Host. */
export async function readDocument(root: string, path: string, offset: number, version?: string, office?: PreviewOfficeKit) {
  const { target } = await within(root, path);
  const extension = /\.(pdf|xlsx?|docx?|pptx?)$/i.exec(target)?.[1]?.toLowerCase();
  if (extension !== 'pdf' && extension !== 'xls' && extension !== 'xlsx' && extension !== 'doc' && extension !== 'docx' && extension !== 'ppt' && extension !== 'pptx') {
    throw new PhoneSessionError('file_type');
  }
  const stamp = (value: BigIntStats) =>
    [value.dev, value.ino, value.size, value.mtimeNs, value.ctimeNs].join(':');
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
  if (extension === 'pdf' || extension === 'xls' || extension === 'xlsx') {
    ensureRange(sourceVersion, bytes);
    const chunk = await read(offset, Math.min(DOCUMENT_CHUNK, bytes - offset));
    return { version: sourceVersion, size: bytes, offset, data: chunk.toString('base64') };
  }
  const key = JSON.stringify([target, sourceVersion]);
  if (lastRender?.key === key) {
    const { revision, pdf } = keepRender(key, lastRender.revision, lastRender.pdf);
    ensureRange(revision, pdf.length);
    return { version: revision, size: pdf.length, offset, data: Buffer.from(pdf.subarray(offset, offset + DOCUMENT_CHUNK)).toString('base64') };
  }
  if (!office) throw new PhoneSessionError('preview_unavailable');
  // Within every caller's wait: the live relay's 75 s for this call, a cloud computer's server's 60 s for a response.
  const signal = AbortSignal.timeout(55_000);
  let rendered: Awaited<ReturnType<PreviewOfficeKit['convert']>>;
  try {
    rendered = await office.convert({ extension, priority: 'foreground', source: {
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
  keepRender(key, revision, rendered.pdf);
  return { version: revision, size, offset, data: Buffer.from(rendered.pdf.subarray(offset, offset + DOCUMENT_CHUNK)).toString('base64') };
}
