// A real DSH host + real package-manager install, using a local npm fixture registry.
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
const presetsOnly = process.argv.includes('--presets');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = process.env.DSH_CLI;
if (!cli) throw new Error('Set DSH_CLI to the installed @deepseek-ai/dsh CLI entry (lib/bin.js).');
const work = await mkdtemp(join(tmpdir(), 'teamwork-host-'));
const packages = new Map();
for (const [shortName, patch, service] of [
  ['fixture', "- insert:\n    - id: teamwork-fixture\n      name: '@teamwork-test/fixture'\n", 'teamworkFixture'],
  ['override', "- id: timer\n  disabled: true\n- insert:\n    - id: teamwork-override\n      name: '@teamwork-test/override'\n", 'teamworkOverride'],
]) {
  const fixture = join(work, shortName); await mkdir(fixture);
  const manifest = { name: `@teamwork-test/${shortName}`, version: '1.0.0', type: 'module', main: 'index.js', dsh: { bundle: { patch: './cordis.patch.yml' } }, files: ['index.js', 'cordis.patch.yml'] };
  await writeFile(join(fixture, 'package.json'), JSON.stringify(manifest));
  await writeFile(join(fixture, 'index.js'), `export function apply(ctx) { ctx.provide('${service}', { version: '1.0.0' }); }\n`);
  await writeFile(join(fixture, 'cordis.patch.yml'), patch);
  const pack = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--cache', join(work, 'npm-cache')], { cwd: fixture, encoding: 'utf8' }));
  const tarball = await readFile(join(fixture, pack[0].filename));
  packages.set(shortName, { manifest, tarball, integrity: 'sha512-' + createHash('sha512').update(tarball).digest('base64'), shasum: createHash('sha1').update(tarball).digest('hex') });
}
let downloads = 0;
const registry = createServer((req, res) => {
  const path = decodeURIComponent(req.url ?? '');
  const shortName = path.endsWith('.tgz') ? path.slice(1, -4) : path.split('/').at(-1);
  const entry = packages.get(shortName);
  if (!entry) { res.writeHead(404); res.end('{}'); return; }
  if (path.endsWith('.tgz')) { downloads++; res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); res.end(entry.tarball); return; }
  const port = registry.address().port;
  const version = { ...entry.manifest, dist: { tarball: `http://127.0.0.1:${port}/${shortName}.tgz`, integrity: entry.integrity, shasum: entry.shasum } };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ name: entry.manifest.name, 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': version }, time: { created: '2020-01-01T00:00:00Z', modified: '2020-01-01T00:00:00Z', '1.0.0': '2020-01-01T00:00:00Z' } }));
});
await new Promise(resolve => registry.listen(0, '127.0.0.1', resolve));
const home = join(work, 'home'), cache = join(work, 'cache.json'), result = join(work, 'result.json');
await mkdir(home); const registryUrl = `http://127.0.0.1:${registry.address().port}/`;
const snapshot = { teamId: 'host-smoke', configs: [
  { id: 'review', kind: 'preset', name: 'Review', version: 1, data: { provider: 'deepseek', model: 'deepseek-chat', systemPrompt: 'Review {{literal_team_token}}.' } },
  { id: 'fixture', kind: 'plugin', name: 'Fixture', version: 1, data: { package: '@teamwork-test/fixture', version: '1.0.0', description: 'Local install fixture' } },
  { id: 'override', kind: 'plugin', name: 'Override fixture', version: 1, data: { package: '@teamwork-test/override', version: '1.0.0', description: 'Must remain disabled' } },
] };
const expectedSnapshot = join(work, 'expected.json');
await writeFile(expectedSnapshot, JSON.stringify(snapshot));
await writeFile(cache, 'invalid-cache-json');
const patch = join(work, 'patch.yml');
await writeFile(patch, `- id: plugin-manager\n  config:\n    registry: ${registryUrl}\n    fallbackRegistries: []\n- insert:\n    - id: dsh-teamwork\n      name: ${JSON.stringify(join(repo, 'lib/index.js'))}\n      config:\n        apiEndpoint: http://localhost:3000\n        cachePath: ${JSON.stringify(cache)}\n    - id: teamwork-test\n      name: ${JSON.stringify(join(repo, presetsOnly ? 'tests/host/presets.mjs' : 'tests/host/validate.mjs'))}\n`);
// Every cache and store the host writes stays under `work`. pnpm puts its store under
// $PNPM_HOME before $XDG_DATA_HOME, and CI sets PNPM_HOME and caches that store, so the
// store directory is named explicitly; otherwise a fixture left there by an earlier run
// is reused and the tarball is never downloaded.
const env = { ...process.env, DSH_HOME: home, XDG_DATA_HOME: join(work, 'data'), XDG_CACHE_HOME: join(work, 'cache'), npm_config_ignore_workspace_root_check: 'true', npm_config_cache: join(work, 'npm-cache'), npm_config_store_dir: join(work, 'pnpm-store'), TEAMWORK_TEST_CACHE: cache, TEAMWORK_TEST_SNAPSHOT: expectedSnapshot, TEAMWORK_TEST_RESULT: result, TEAMWORK_TEST_CWD: work };
const child = spawn(process.execPath, [resolve(cli), 'web', '--patch', patch, '--host', '127.0.0.1', '--port', '0', '--no-open'], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let logs = ''; child.stdout.on('data', d => { logs += d; }); child.stderr.on('data', d => { logs += d; });
let success = false;
try {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    try {
      const report = JSON.parse(await readFile(result, 'utf8'));
      if (!report.passed) throw new Error(report.error);
      if (!presetsOnly && !downloads) throw new Error('Package manager did not download the fixture tarball');
      console.log(JSON.stringify({ ...report, tarballDownloads: downloads }, null, 2)); success = true; break;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (child.exitCode !== null) throw new Error(`DSH exited: ${child.exitCode}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!success) throw new Error('Host verification timed out');
} finally {
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => { const timer = setTimeout(resolve, 5000); timer.unref(); })]);
    if (child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
  }
  registry.closeAllConnections(); await new Promise(resolve => registry.close(resolve));
  if (success) await rm(work, { recursive: true, force: true });
  else { await writeFile(join(work, 'host.log'), logs, { mode: 0o600 }); console.error(`Failure diagnostics retained at ${work}; logs may contain a local browser token.`); }
}
