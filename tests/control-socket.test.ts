import { mkdtemp, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { controlSocketPath, serveControlSocket } from '../src/control-socket.js';
import type { FetchRoute, PanelShared } from '../src/panel.js';
import { dshHome, run, socketIn } from '../src/share-cli.js';

const route = (name: string, handle: (body: Record<string, unknown>) => unknown): FetchRoute => ({
  path: `/api/teamwork/${name}`, methods: ['POST'], requestBody: 'buffered',
  fetch: async (request) => {
    const body = JSON.parse((await request.text()) || '{}') as Record<string, unknown>;
    try { return Response.json(await handle(body) ?? {}); } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  },
});

/** A stand-in for the panel: shared mode with one member, an invite, and the plugin's own refusal of a bad key. */
function panel() {
  const calls: Array<[string, Record<string, unknown>]> = [];
  let shared: PanelShared | null = null;
  const record = (name: string, handle: (body: Record<string, unknown>) => unknown) => route(name, (body) => { calls.push([name, body]); return handle(body); });
  let server = 'https://www.dshteamwork.com';
  const routes = [
    record('state', () => ({ shared, server })),
    record('server', (body) => { server = String(body.server); }),
    record('share-enable', (body) => {
      if (body.key !== 'dshh_good') throw new Error('That is not a team host key. Copy it again from the team console.');
      shared = { name: 'vm3', teamName: 'Team', error: null, auditKey: null, members: [{ userId: 'u1', email: 'bob@example.test', devices: ['Phone'], locked: true }] };
    }),
    record('share-invite', () => ({ link: 'dshteamwork://join?x', expiresAt: '2026-11-19T00:00:00Z' })),
  ];
  return { routes, calls };
}

async function serving() {
  const home = await mkdtemp(join(tmpdir(), 'tw-'));
  const socket = socketIn(home);
  const { routes, calls } = panel();
  const logs: string[] = [];
  const close = await serveControlSocket(controlSocketPath(join(home, 'dsh-teamwork', 'cache.json')), routes, (m) => logs.push(m));
  const cli = async (...args: string[]) => {
    const out: string[] = [], err: string[] = [];
    const code = await run(args, socket, (l) => out.push(l), (l) => err.push(l)).catch((e: Error) => { err.push(e.message); return 1; });
    return { code, out: out.join('\n'), err: err.join('\n') };
  };
  return { home, socket, calls, logs, close, cli, routes };
}

test.skipIf(process.platform === 'win32')('the command drives the panel routes through a socket only its user opens', async () => {
  const { home, socket, calls, close, cli } = await serving();
  try {
    expect(socket).toBe(join(home, 'dsh-teamwork', 'cache.sock'));
    expect((await stat(socket)).mode & 0o777).toBe(0o600);
    expect((await stat(join(home, 'dsh-teamwork'))).mode & 0o777).toBe(0o700);

    expect(await cli('share', 'status')).toMatchObject({ code: 0, out: expect.stringContaining('Shared mode is off') });
    expect(await cli('server', 'https://teamwork.example.com')).toMatchObject({ code: 0, out: 'Teamwork server: https://teamwork.example.com' });
    // The plugin's own refusal reaches the command line unchanged.
    expect(await cli('share', 'enable', 'dshh_bad')).toMatchObject({ code: 1, err: 'That is not a team host key. Copy it again from the team console.' });
    const enabled = await cli('share', 'enable', 'dshh_good');
    expect(enabled.code).toBe(0);
    expect(enabled.out).toContain('Shared DSH: vm3');
    expect(enabled.out).toContain('Audit key: not set');
    expect(await cli('share', 'members')).toMatchObject({ out: 'bob@example.test (locked): Phone' });
    const invite = await cli('share', 'invite', 'bob@example.test');
    expect(invite.out).toContain('dshteamwork://join?x');
    expect(calls).toContainEqual(['share-invite', { email: 'bob@example.test' }]);
    expect(await cli('share', 'invite')).toMatchObject({ code: 2 });
  } finally { await close(); }
});

test.skipIf(process.platform === 'win32')('without a running DSH the command says where it looked; a second DSH leaves the live socket alone', async () => {
  const { socket, logs, close, cli, routes } = await serving();
  const second = await serveControlSocket(socket, routes, (m) => logs.push(m));
  expect(logs.join('\n')).toContain('Another DSH using this home already serves');
  await second();
  expect(await cli('share', 'status')).toMatchObject({ code: 0 });
  await close();
  const gone = await cli('share', 'status');
  expect(gone.code).toBe(1);
  expect(gone.err).toContain(`No running DSH with the Teamwork plugin at ${socket}`);
});

test('the home is found as DSH finds it', () => {
  expect(dshHome({})).toBe(join(homedir(), '.dsh'));
  expect(dshHome({ DSH_HOME: '  ' })).toBe(join(homedir(), '.dsh'));
  expect(dshHome({ DSH_HOME: '/srv/dsh' })).toBe('/srv/dsh');
  expect(dshHome({ DSH_HOME: '~/team-dsh' })).toBe(join(homedir(), 'team-dsh'));
});
