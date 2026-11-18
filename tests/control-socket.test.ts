import { mkdtemp, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { controlSocketPath, serveControlSocket } from '../src/control-socket.js';
import type { FetchRoute, PanelPhone, PanelShared } from '../src/panel.js';
import { dshHome, run, socketIn } from '../src/teamwork-cli.js';

const route = (name: string, handle: (body: Record<string, unknown>) => unknown): FetchRoute => ({
  path: `/api/teamwork/${name}`, methods: ['POST'], requestBody: 'buffered',
  fetch: async (request) => {
    const body = JSON.parse((await request.text()) || '{}') as Record<string, unknown>;
    try { return Response.json(await handle(body) ?? {}); } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  },
});

/**
 * A stand-in for the panel: shared mode with one member, an invite, and the plugin's own refusal of a bad key; a
 * sign-in by pasted code; and a phone that pairs, first before its handshake, then with a safety code.
 */
function panel() {
  const calls: Array<[string, Record<string, unknown>]> = [];
  let shared: PanelShared | null = null;
  const record = (name: string, handle: (body: Record<string, unknown>) => unknown) => route(name, (body) => { calls.push([name, body]); return handle(body); });
  let server = 'https://www.dshteamwork.com';
  let authenticated = false;
  const phones: PanelPhone[] = [];
  const routes = [
    record('state', () => ({ shared, server, authenticated, teams: authenticated ? [{ id: 't', name: 'Team', role: 'member', consoleUrl: '' }] : [], sync: { auto: true, running: false }, relay: 'connected', phones })),
    record('login', () => ({ url: 'https://teamwork.example.com/plugin?challenge=c', automatic: true })),
    record('authorize', (body) => { if (body.code !== 'ABCD-1234') throw new Error('That code is not valid.'); authenticated = true; }),
    record('sync', () => undefined),
    record('pair-phone', () => {
      phones.push({ id: 'p1', deviceName: 'Pixel', status: 'pending', createdAt: '', lastUsedAt: null });
      return { code: 'c', expiresAt: '2026-11-19T00:00:00Z', link: 'dshteamwork://pair?server=x&code=c&key=k' };
    }),
    record('decide-phone', (body) => { if (body.accept) Object.assign(phones[0]!, { status: 'confirmed', verified: true }); }),
    record('server', (body) => { server = String(body.server); }),
    record('share-enable', (body) => {
      if (body.key !== 'dshh_good') throw new Error('That is not a team host key. Copy it again from the team console.');
      shared = { name: 'vm3', teamName: 'Team', error: null, auditKey: null, members: [{ userId: 'u1', email: 'bob@example.test', devices: ['Phone'], locked: true }] };
    }),
    record('share-invite', () => ({ link: 'dshteamwork://join?x', expiresAt: '2026-11-19T00:00:00Z' })),
  ];
  return { routes, calls, phones };
}

async function serving() {
  const home = await mkdtemp(join(tmpdir(), 'tw-'));
  const socket = socketIn(home);
  const { routes, calls, phones } = panel();
  const logs: string[] = [];
  const close = await serveControlSocket(controlSocketPath(join(home, 'dsh-teamwork', 'cache.json')), routes, (m) => logs.push(m));
  const cli = async (...args: string[]) => {
    const out: string[] = [], err: string[] = [];
    const code = await run(args, socket, (l) => out.push(l), (l) => err.push(l)).catch((e: Error) => { err.push(e.message); return 1; });
    return { code, out: out.join('\n'), err: err.join('\n') };
  };
  return { home, socket, calls, phones, logs, close, cli, routes };
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

test.skipIf(process.platform === 'win32')('a personal DSH signs in, syncs and pairs a phone from the command line', async () => {
  const { calls, phones, close, cli } = await serving();
  try {
    const login = await cli('login');
    expect(login.out).toContain('https://teamwork.example.com/plugin?challenge=c');
    expect(login.out).toContain('dsh-teamwork authorize <code>');
    // The page shows a whole line to paste; its code is what reaches the plugin.
    expect(await cli('authorize', '/teamwork', 'authorize', 'ABCD-1234')).toMatchObject({ code: 0 });
    expect(calls).toContainEqual(['authorize', { code: 'ABCD-1234' }]);
    expect((await cli('status')).out).toContain('Teams: Team (member)');
    expect(await cli('sync')).toMatchObject({ code: 0, out: 'Synced 1 team.' });

    const pair = await cli('phone', 'pair');
    expect(pair.out).toContain('dshteamwork://pair?server=x&code=c&key=k');
    expect(pair.out).toMatch(/[█▀▄]/);
    // Before the handshake there is no safety code to compare, so it cannot be accepted.
    expect((await cli('phone', 'list')).out).toContain('has not finished its encrypted handshake');
    expect(await cli('phone', 'accept', 'p1')).toMatchObject({ code: 1 });
    expect(calls.some(([name]) => name === 'decide-phone')).toBe(false);
    Object.assign(phones[0]!, { safetyCode: '12 34 56', phoneConfirmed: true });
    expect((await cli('phone', 'list')).out).toContain('safety code 12 34 56; if the phone shows the same, dsh-teamwork phone accept p1');
    expect(await cli('phone', 'accept', 'p1')).toMatchObject({ code: 0, out: 'Accepted Pixel.' });
    expect(calls).toContainEqual(['decide-phone', { id: 'p1', accept: true }]);
    expect((await cli('phone', 'list')).out).toBe('p1  Pixel  paired');
  } finally { await close(); }
});

