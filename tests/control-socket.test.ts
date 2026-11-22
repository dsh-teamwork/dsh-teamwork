import { mkdtemp, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { PassThrough, Readable } from 'node:stream';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { controlSocketPath, serveControlSocket } from '../src/control-socket.js';
import { panelRoutes, type FetchRoute, type PanelOps, type PanelPhone } from '../src/panel.js';
import { say, speaking } from '../src/messages.js';
import { dshHome, run, socketIn } from '../src/teamwork-cli.js';

const route = (name: string, handle: (body: Record<string, unknown>) => unknown): FetchRoute => ({
  path: `/api/teamwork/${name}`, methods: ['POST'], requestBody: 'buffered',
  fetch: async (request) => {
    const body = JSON.parse((await request.text()) || '{}') as Record<string, unknown>;
    try { return Response.json(await handle(body) ?? {}); } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  },
});

/**
 * A stand-in for the panel: a sign-in by pasted code, with the plugin's own refusal of a wrong one; and a phone that
 * pairs, first before its handshake, then with a safety code.
 */
function panel() {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const record = (name: string, handle: (body: Record<string, unknown>) => unknown) => route(name, (body) => { calls.push([name, body]); return handle(body); });
  let server = 'https://www.dshteamwork.com';
  let authenticated = false;
  const phones: PanelPhone[] = [];
  const routes = [
    record('state', () => ({ server, authenticated, teams: authenticated ? [{ id: 't', name: 'Team', role: 'member', consoleUrl: '' }] : [], sync: { auto: true, running: false }, relay: 'connected', phones })),
    record('login', () => ({ url: 'https://teamwork.example.com/plugin?challenge=c&redirect_uri=http%3A%2F%2F127.0.0.1%3A38719%2Fcallback', automatic: true })),
    record('authorize', (body) => { if (body.code !== 'ABCD-1234') throw new Error('That code is not valid.'); authenticated = true; }),
    record('sync', () => undefined),
    record('logout', () => { authenticated = false; }),
    record('pair-phone', () => {
      phones.push({ id: 'p1', deviceName: 'Pixel', status: 'pending', createdAt: '', lastUsedAt: null });
      return { code: 'c', expiresAt: new Date(Date.now() + 30_000).toISOString(), link: 'dshteamwork://pair?server=x&code=c&key=k' };
    }),
    record('decide-phone', (body) => {
      const index = phones.findIndex((phone) => phone.id === body.id);
      if (index === -1) throw new Error('Unknown device.');
      if (body.accept) Object.assign(phones[index]!, { status: 'confirmed', verified: true });
      else phones.splice(index, 1);
    }),
    record('revoke-phone', (body) => {
      const index = phones.findIndex((phone) => phone.id === body.id);
      if (index === -1) throw new Error('Unknown device.');
      phones.splice(index, 1);
    }),
    record('server', (body) => { server = String(body.server); }),
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

    expect(await cli('server', 'https://teamwork.example.com')).toMatchObject({ code: 0, out: 'Teamwork server: https://teamwork.example.com' });
    // The plugin's own refusal reaches the command line unchanged.
    expect(await cli('authorize', 'WRONG')).toMatchObject({ code: 1, err: 'That code is not valid.' });
    // Team DSH is offline: the command offers no way into shared mode, and asks the DSH nothing for one.
    const before = calls.length;
    expect(await cli('share', 'enable', 'dshh_good')).toMatchObject({ code: 2, err: expect.stringContaining('usage: dsh-teamwork') });
    expect((await cli('share', 'enable', 'dshh_good')).err).not.toContain('share');
    expect(calls.length).toBe(before);
  } finally { await close(); }
});

test.skipIf(process.platform === 'win32')('without a running DSH the command says where it looked; a second DSH leaves the live socket alone', async () => {
  const { socket, logs, close, cli, routes } = await serving();
  const second = await serveControlSocket(socket, routes, (m) => logs.push(m));
  expect(logs.join('\n')).toContain('Another DSH using this home already serves');
  await second();
  expect(await cli('status')).toMatchObject({ code: 0 });
  await close();
  const gone = await cli('status');
  expect(gone.code).toBe(1);
  expect(gone.err).toContain(`No running DSH with the Teamwork plugin at ${socket}`);
});

test('the home is found as DSH finds it', () => {
  expect(dshHome({})).toBe(join(homedir(), '.dsh'));
  expect(dshHome({ DSH_HOME: '  ' })).toBe(join(homedir(), '.dsh'));
  expect(dshHome({ DSH_HOME: '/srv/dsh' })).toBe('/srv/dsh');
  expect(dshHome({ DSH_HOME: '~/team-dsh' })).toBe(join(homedir(), 'team-dsh'));
});

test.skipIf(process.platform === 'win32')('a personal DSH manages login, sync and the phone pairing lifecycle from the command line', async () => {
  const { calls, phones, close, cli } = await serving();
  try {
    const browserLogin = await cli('login', '--browser');
    expect(browserLogin.out).toContain('redirect_uri=');
    expect(browserLogin.out).toContain('finish automatically');
    const login = await cli('login');
    expect(login.out).not.toContain('redirect_uri=');
    expect(calls).toContainEqual(['login', { manual: true }]);
    expect(login.out).toContain('https://teamwork.example.com/plugin?challenge=c');
    expect(login.out).toContain('dsh-teamwork authorize <code>');
    // The page shows a whole line to paste; its code is what reaches the plugin.
    expect(await cli('authorize', '/teamwork', 'authorize', 'ABCD-1234')).toMatchObject({ code: 0 });
    expect(calls).toContainEqual(['authorize', { code: 'ABCD-1234' }]);
    expect((await cli('status')).out).toContain('Teams: Team (member)');
    expect(await cli('sync')).toMatchObject({ code: 0, out: 'Synced 1 team.' });

    const pair = await cli('device', 'pair');
    expect(pair.out).toContain('dshteamwork://pair?server=x&code=c&key=k');
    expect(pair.out).toMatch(/[█▀▄]/);
    // Before the handshake there is no safety code to compare, so it cannot be accepted.
    expect((await cli('device', 'list')).out).toContain('Waiting for the encrypted connection');
    expect(await cli('device', 'accept', 'p1')).toMatchObject({ code: 1 });
    expect(calls.some(([name]) => name === 'decide-phone')).toBe(false);
    Object.assign(phones[0]!, { safetyCode: '12 34 56', phoneConfirmed: true });
    expect((await cli('device', 'list')).out).toContain('safety code 12 34 56; if the device shows the same, dsh-teamwork device accept p1');
    expect(await cli('device', 'accept', 'p1')).toMatchObject({ code: 0, out: 'Accepted Pixel.' });
    expect(calls).toContainEqual(['decide-phone', { id: 'p1', accept: true, safetyCode: '12 34 56' }]);
    expect((await cli('device', 'list')).out).toBe('p1  Pixel  paired');
    expect(await cli('device', 'revoke', 'p1')).toMatchObject({ code: 0, out: 'Removed.' });
    expect(calls).toContainEqual(['revoke-phone', { id: 'p1' }]);
    expect((await cli('device', 'list')).out).toContain('No device is paired');

    expect((await cli('device', 'pair')).code).toBe(0);
    expect(await cli('device', 'reject', 'p1')).toMatchObject({ code: 0, out: 'Refused.' });
    expect(calls).toContainEqual(['decide-phone', { id: 'p1', accept: false }]);
    expect((await cli('device', 'list')).out).toContain('No device is paired');

    expect((await cli('logout')).code).toBe(0);
    expect(calls).toContainEqual(['logout', {}]);
    const signedOut = await cli('status');
    expect(signedOut.out).toContain('Signed in: no');
    expect(signedOut.out).not.toContain('Teams:');
  } finally { await close(); }
});

test.skipIf(process.platform === 'win32')('guided pairing waits for the phone and checks its code before approval', async () => {
  const { calls, phones, close, socket } = await serving();
  const input = new PassThrough();
  const errors: string[] = [];
  let prompts = 0;
  phones.push({ id: 'old', deviceName: 'Earlier phone', status: 'pending', createdAt: '', lastUsedAt: null, phoneConfirmed: true, safetyCode: '1111 1111' });
  try {
    const exit = await run(['device', 'pair', '--guided'], socket, line => {
      expect(line).not.toContain('Earlier phone');
      const current = phones.find(phone => phone.id === 'p1');
      if (line.startsWith('Waiting for a new device')) Object.assign(current!, { safetyCode: '0557 6515' });
      if (line.includes('confirm it on the device first')) current!.phoneConfirmed = true;
      if (line.startsWith('3.')) {
        expect(calls.some(([name]) => name === 'decide-phone')).toBe(false);
        const entered = prompts++ === 0 ? '11111111' : '05576515';
        setImmediate(() => input.write(entered + '\n'));
      }
    }, line => errors.push(line), input);
    expect(exit).toBe(0);
    expect(errors).toHaveLength(1);
    expect(calls.filter(([name]) => name === 'decide-phone')).toEqual([
      ['decide-phone', { id: 'p1', accept: true, safetyCode: '0557 6515' }],
    ]);
  } finally {
    input.destroy();
    await close();
  }
});


// Through the socket the command reaches the panel's own routes, whose guard admits only a JSON request: the socket
// carries the command's content type on, or every command would be refused as malformed.
test.skipIf(process.platform === 'win32')('the command passes the real panel routes’ request check', async () => {
  const home = await mkdtemp(join(tmpdir(), 'tw-real-'));
  const savedPins: Array<string | null> = [];
  const ops = { setOwnerPin: async (pin: string | null) => { savedPins.push(pin); }, state: async () => ({ server: 'https://teamwork.example.com', authenticated: true, teams: [], sync: { auto: true, running: false }, relay: 'connected', phones: [] }) } as unknown as PanelOps;
  const close = await serveControlSocket(controlSocketPath(join(home, 'dsh-teamwork', 'cache.json')), panelRoutes(ops, { say, speak: (answer) => speaking('en', answer) }), () => {});
  try {
    const out: string[] = [], err: string[] = [];
    const code = await run(['status'], socketIn(home), (l) => out.push(l), (l) => err.push(l)).catch((e: Error) => { err.push(e.message); return 1; });
    expect({ code, err: err.join('\n') }).toEqual({ code: 0, err: '' });
    expect(out.join('\n')).toContain('Teamwork server: https://teamwork.example.com');
    const pinCommand = (args: string[], input: string) => run(args, socketIn(home), l => out.push(l), l => err.push(l), Readable.from([input]));
    expect(await pinCommand(['pin', 'set'], '12a4\n')).toBe(2);
    expect(savedPins).toEqual([]);
    expect(await pinCommand(['pin', 'set'], '0012\n')).toBe(0);
    expect(await pinCommand(['pin', 'clear'], '')).toBe(0);
    expect(savedPins).toEqual(['0012', null]);
    expect([...out, ...err].join('\n')).not.toContain('0012');
  } finally { await close(); }
});

// `dsh-teamwork web on|off` is the panel's native Web switch for a DSH on a server, through the same route: a refusal
// comes back in the host's words, and status says where the switch stands.
test.skipIf(process.platform === 'win32')('native Web is switched and shown from the command line', async () => {
  const home = await mkdtemp(join(tmpdir(), 'tw-web-'));
  let nativeWeb: { enabled: boolean; blocked?: 'pin' | 'web' } = { enabled: false };
  const ops = {
    setNativeWeb: async (on: boolean) => {
      if (on && nativeWeb.blocked) throw new Error(say(nativeWeb.blocked === 'pin' ? 'nativeWeb.pin' : 'nativeWeb.noWeb'));
      nativeWeb = { ...nativeWeb, enabled: on };
    },
    state: async () => ({ server: 'https://teamwork.example.com', authenticated: true, teams: [], sync: { auto: true, running: false }, relay: 'connected', phones: [], nativeWeb }),
  } as unknown as PanelOps;
  const close = await serveControlSocket(controlSocketPath(join(home, 'dsh-teamwork', 'cache.json')), panelRoutes(ops, { say, speak: (answer) => speaking('en', answer) }), () => {});
  const out: string[] = [], err: string[] = [];
  const command = (...args: string[]) => run(args, socketIn(home), l => out.push(l), l => err.push(l)).catch((e: Error) => { err.push(e.message); return 1; });
  try {
    expect(await command('web')).toBe(2);
    expect(await command('web', 'maybe')).toBe(2);
    expect(await command('web', 'on')).toBe(0);
    expect(out.at(-1)).toContain('Native DSH Web is on');
    expect(await command('status')).toBe(0);
    expect(out.at(-1)).toContain('Native Web: on');
    expect(await command('web', 'off')).toBe(0);
    expect(out.at(-1)).toBe('Native DSH Web is off.');
    nativeWeb = { enabled: false, blocked: 'web' };
    expect(await command('web', 'on')).toBe(1);
    expect(err.at(-1)).toContain('DSH Web');
    expect(nativeWeb.enabled).toBe(false);
    expect(await command('status')).toBe(0);
    expect(out.at(-1)).toContain('Native Web: off — needs DSH Web on this machine (dsh web)');
  } finally { await close(); await rm(home, { recursive: true, force: true }); }
});
