/** Local-only preparation. npm lifecycle scripts are never run. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, relative, join, basename } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { npmCommand } from './npm-command.js';
const exec = promisify(execFile);
export interface PreparedPlugin {
  path: string;
  directory: string;
  package: string;
  version: string;
  sha256: string;
  size: number;
  files: string[];
}
export async function preparePlugin(
  cwd: string,
  input: string,
  signal: AbortSignal,
): Promise<PreparedPlugin> {
  const root = await realpath(resolve(cwd, input));
  const workspace = await realpath(cwd);
  const rel = relative(workspace, root);
  if (rel === '..' || rel.startsWith('../') || resolve(workspace, rel) !== root)
    throw Error('Choose a directory inside this session workspace');
  const directory = await mkdtemp(join(tmpdir(), 'teamwork-share-'));
  try {
    const command = npmCommand(['pack', '--ignore-scripts', '--json', '--pack-destination', directory]);
    const { stdout } = await exec(
      command.file,
      command.args,
      { cwd: root, signal, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
    );
    const [result] = JSON.parse(stdout) as {
      name: string;
      version: string;
      filename: string;
      size: number;
      files: { path: string }[];
    }[];
    if (
      !result ||
      result.size > 10 * 1024 * 1024 ||
      result.files.length > 2000 ||
      basename(result.filename) !== result.filename
    )
      throw Error('Archive exceeds sharing limits');
    const path = join(directory, result.filename),
      bytes = await readFile(path);
    if (bytes.length > 10 * 1024 * 1024) throw Error('Archive exceeds sharing limits');
    const unpacked = gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 });
    const files: string[] = [];
    const seen = new Set<string>();
    const field = (offset: number, count: number) =>
      unpacked
        .subarray(offset, offset + count)
        .toString('utf8')
        .split('\0')[0];
    for (let offset = 0; offset + 512 <= unpacked.length; ) {
      signal.throwIfAborted();
      if (unpacked.subarray(offset, offset + 512).every((v) => v === 0)) break;
      const prefix = field(offset + 345, 155);
      const full = (prefix ? `${prefix}/` : '') + field(offset, 100);
      const type = field(offset + 156, 1);
      const size = Number.parseInt(field(offset + 124, 12).trim(), 8);
      if (
        !full.startsWith('package/') ||
        full.includes('..') ||
        full.includes('\\') ||
        full.includes(':') ||
        seen.has(full) ||
        seen.size >= 2000 ||
        !['', '0', '5'].includes(type) ||
        !Number.isFinite(size) ||
        size < 0 ||
        offset + 512 + size > unpacked.length
      )
        throw Error('Unsafe archive entry');
      seen.add(full);
      const name = full.slice(8),
        base = basename(name).toLowerCase();
      if (
        base === '.env' ||
        base.startsWith('.env.') ||
        ['.npmrc', '.netrc'].includes(base) ||
        /\.(pem|key)$/.test(base) ||
        name.includes('.aws/') ||
        name.includes('.ssh/') ||
        name.includes('.git/')
      )
        throw Error(`Remove private file before sharing: ${name}`);
      if (type !== '5') {
        const content = unpacked.subarray(offset + 512, offset + 512 + size);
        if (
          /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/.test(
            content.toString('utf8'),
          )
        )
          throw Error(`Potential credential: ${name}`);
        files.push(name);
      }
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    return {
      path,
      directory,
      package: result.name,
      version: result.version,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      size: bytes.length,
      files,
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
