import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

/** Run npm's JS entry on Windows: execFile cannot execute npm.cmd directly. */
export function npmCommand(args: string[]) {
  if (process.platform !== 'win32') return { file: 'npm', args };
  const directories = [dirname(process.execPath), ...(process.env.PATH ?? '').split(delimiter)];
  for (const directory of directories) {
    if (!directory) continue;
    const root = directory.replace(/^"(.*)"$/, '$1');
    const cli = join(root, 'node_modules', 'npm', 'bin', 'npm-cli.js');
    if (!existsSync(cli)) continue;
    const node = join(root, 'node.exe');
    return { file: existsSync(node) ? node : process.execPath, args: [cli, ...args] };
  }
  throw new Error('npm was not found on PATH. Install Node.js with npm to share a local plugin.');
}
