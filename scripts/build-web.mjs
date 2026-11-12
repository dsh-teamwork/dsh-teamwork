// Bundles the browser half (src/web, with @dsh-teamwork/ui compiled in) into
// lib/web/client.js in the shape DSH loads a client module: CommonJS inside
// `window.__ModuleLoader__.load`, whose factory hands in the host's `require`.
// React stays external, so the panel renders with the host's own copy.
import { build, context } from 'esbuild';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { name } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [join(root, 'src', 'web', 'index.tsx')],
  outfile: join(root, 'lib', 'web', 'client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom'],
  charset: 'utf8',
  legalComments: 'none',
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
  banner: { js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(name)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;` },
  footer: { js: 'return module.exports; } });' },
};

if (watch) await (await context(options)).watch();
else await build(options);
