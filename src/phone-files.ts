/**
 * A session's workspace as a phone or the console browses it: the folders and files under the session's working
 * directory, a search of their names, and a text file's content, read only. Everything stays under that directory: a
 * path is resolved to its real path first, so neither `..` nor a symbolic link reaches past it, and an absolute path is
 * taken only when it lies inside. DSH's own `workspaceFiles` reads beyond the workspace, so it is not passed on.
 */
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
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
