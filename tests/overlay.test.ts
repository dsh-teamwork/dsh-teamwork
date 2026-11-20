import { expect, test } from 'vitest';
import { TeamOverlay, TeamworkClient, type Snapshot } from '../src/client.js';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const team1 = { teamId: 'team1', teamName: 'Team one', role: 'member' as const, configs: [{ id: 'p1', name: 'Same name', kind: 'preset' as const, version: 1, data: { provider: 'deepseek', model: 'chat', systemPrompt: 'Review' } }] };
const snapshot: Snapshot = { teams: [team1] };
test('team updates and removal never touch a same-named local registration', async () => {
  const registrations = new Map<string, string>([['local', 'Same name']]); let count = 0;
  const overlay = new TeamOverlay(async (id, config) => { if (registrations.has(id)) throw new Error('collision'); registrations.set(id, config.name); count++; return async () => { registrations.delete(id); }; }, () => {});
  await overlay.apply(snapshot); await overlay.apply(snapshot); expect(count).toBe(1);
  await overlay.apply({ teams: [{ ...team1, configs: [{ ...team1.configs[0]!, name: 'Updated', version: 2 }] }] });
  expect(registrations.get('local')).toBe('Same name'); expect(registrations.get('team:team1:p1')).toBe('Updated');
  await overlay.apply(); expect([...registrations]).toEqual([['local', 'Same name']]);
});
test('registers every team’s entries under its own team, and re-registers a team that was renamed', async () => {
  const registrations = new Map<string, string>();
  const overlay = new TeamOverlay(async (id, config, team) => { registrations.set(id, `[${team.teamName}] ${config.name}`); return async () => { registrations.delete(id); }; }, () => {});
  const team2 = { teamId: 'team2', teamName: 'Team two', role: 'admin' as const, configs: [{ ...team1.configs[0]!, id: 'p2' }] };
  await overlay.apply({ teams: [team1, team2] });
  expect(Object.fromEntries(registrations)).toEqual({ 'team:team1:p1': '[Team one] Same name', 'team:team2:p2': '[Team two] Same name' });
  await overlay.apply({ teams: [{ ...team1, teamName: 'Team uno' }, team2] });
  expect(registrations.get('team:team1:p1')).toBe('[Team uno] Same name');
  await overlay.apply({ teams: [team2] });
  expect([...registrations.keys()]).toEqual(['team:team2:p2']);
});
test('registers presets only: a team model stays in the model picker, not the mode menu', async () => {
  const registered: string[] = [];
  const overlay = new TeamOverlay(async id => { registered.push(id); return async () => {}; }, () => {});
  const model = { id: 'm1', name: 'Flash', kind: 'model' as const, version: 1, data: { provider: 'deepseek', model: 'chat', contextWindow: 65536 } };
  await overlay.apply({ teams: [{ ...team1, configs: [...team1.configs, model] }] });
  expect(registered).toEqual(['team:team1:p1']);
});
test('network and malformed replies preserve cache; revoked membership clears it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'teamwork-')); const path = join(dir, 'cache.json'); let mode = 'ok';
  const request: typeof fetch = async (input) => {
    if (String(input).endsWith('/auth/plugin/token')) return Response.json({ token: 'test-token' });
    if (mode === 'network') throw new Error('offline');
    if (mode === 'bad') return Response.json({ teamId: 'old-shape', configs: [] });
    if (mode === 'revoked') return new Response('', { status: 403 });
    return Response.json(snapshot);
  };
  try {
    const client = new TeamworkClient('http://localhost:3800', path, request); client.beginLogin(); await client.completeLogin('code'); await client.sync();
    const original = await readFile(path, 'utf8'); mode = 'network'; await expect(client.sync()).rejects.toThrow(); expect(await readFile(path, 'utf8')).toBe(original);
    mode = 'bad'; await expect(client.sync()).rejects.toThrow(); expect(await readFile(path, 'utf8')).toBe(original);
    const restored = new TeamworkClient('http://localhost:3800', path, request); expect(await restored.restore()).toEqual(snapshot);
    mode = 'revoked'; await expect(client.sync()).rejects.toThrow(); expect(client.current()).toBeUndefined(); expect(client.authenticated()).toBe(false); await expect(readFile(path)).rejects.toThrow();
  } finally { await rm(dir, { recursive: true }); }
});

test('logout cancels an in-flight sync without resurrecting its cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'teamwork-race-')), path = join(dir, 'cache.json');
  let resolveResponse!: (response: Response) => void;
  let started!: () => void;
  const fetching = new Promise<void>(resolve => { started = resolve; });
  const request: typeof fetch = async input => {
    if (String(input).endsWith('/auth/plugin/token')) return Response.json({ token: 'test-token' });
    started(); return new Promise<Response>(resolve => { resolveResponse = resolve; });
  };
  try {
    const client = new TeamworkClient('http://localhost:3800', path, request);
    client.beginLogin(); await client.completeLogin('code');
    const syncing = client.sync(); const rejected = expect(syncing).rejects.toThrow('Session changed');
    await fetching; const logout = client.logout(); resolveResponse(Response.json(snapshot));
    await rejected; await logout;
    expect(client.current()).toBeUndefined(); await expect(readFile(path)).rejects.toThrow();
  } finally { await rm(dir, { recursive: true }); }
});

test('late login completion cannot reauthenticate after logout', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'teamwork-login-'));
  let complete!: (response: Response) => void, started!: () => void;
  const fetching = new Promise<void>(resolve => { started = resolve; });
  const calls: string[] = [];
  const request: typeof fetch = async (input, init) => {
    calls.push(`${init?.method ?? 'GET'} ${new URL(String(input)).pathname} ${new Headers(init?.headers).get('Authorization') ?? ''}`.trim());
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    if (String(input).endsWith('/auth/plugin/token')) { started(); return new Promise(resolve => { complete = resolve; }); }
    return Response.json(snapshot);
  };
  try {
    const client = new TeamworkClient('http://localhost:3800', join(dir, 'cache.json'), request);
    client.beginLogin(); const login = client.completeLogin('code'); const rejected = expect(login).rejects.toThrow('Login cancelled');
    await fetching; const logout = client.logout(); complete(Response.json({ token: 'late-token' }));
    await rejected; await logout; await expect(client.sync()).rejects.toThrow('Sign in first');
    // The late token is revoked, never used or kept.
    expect(calls).toEqual(['POST /api/auth/plugin/token', 'DELETE /api/auth/plugin/token Bearer late-token']);
    await expect(readFile(client.tokenPath)).rejects.toThrow();
  } finally { await rm(dir, { recursive: true }); }
});

test('a sign-in outlives a restart for its own server only, and signing out revokes it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'teamwork-kept-')), path = join(dir, 'cache.json');
  const calls: string[] = []; let configs = 200;
  const request: typeof fetch = async (input, init) => {
    calls.push(`${init?.method ?? 'GET'} ${new URL(String(input)).host}${new URL(String(input)).pathname} ${new Headers(init?.headers).get('Authorization') ?? ''}`.trim());
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    if (String(input).endsWith('/auth/plugin/token')) return Response.json({ token: 'kept-token' });
    return configs === 200 ? Response.json(snapshot) : new Response('', { status: configs });
  };
  try {
    const first = new TeamworkClient('http://localhost:3800', path, request);
    first.beginLogin(); await first.completeLogin('code');
    if (process.platform !== 'win32') expect((await stat(first.tokenPath)).mode & 0o777).toBe(0o600);

    const restarted = new TeamworkClient('http://localhost:3800', path, request); await restarted.restore();
    expect(restarted.authenticated()).toBe(true);
    await restarted.sync(); expect(calls.at(-1)).toBe('GET localhost:3800/api/configs Bearer kept-token');
    const elsewhere = new TeamworkClient('http://127.0.0.1:3800', path, request); await elsewhere.restore();
    expect(elsewhere.authenticated()).toBe(false);

    await restarted.logout();
    expect(calls.at(-1)).toBe('DELETE localhost:3800/api/auth/plugin/token Bearer kept-token');
    await expect(readFile(restarted.tokenPath)).rejects.toThrow();
    const afterLogout = new TeamworkClient('http://localhost:3800', path, request); await afterLogout.restore();
    expect(afterLogout.authenticated()).toBe(false);

    // A token the server no longer accepts is forgotten here too.
    first.beginLogin(); await first.completeLogin('code'); configs = 401;
    await expect(first.sync()).rejects.toThrow(); await expect(readFile(first.tokenPath)).rejects.toThrow();

    // Changing servers revokes the token at the server that issued it.
    configs = 200; first.beginLogin(); await first.completeLogin('code'); await first.setEndpoint('http://127.0.0.1:3800');
    expect(calls.at(-1)).toBe('DELETE localhost:3800/api/auth/plugin/token Bearer kept-token');
  } finally { await rm(dir, { recursive: true }); }
});

test('summary reads keep only the own budget and review count, fail closed and discard an old account response', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'teamwork-summary-'));
  const budget = { remaining: '9.85', state: 'known', resetAt: null, tokenLimited: true, exhausted: false };
  let reply = Response.json({ since: '2026-10-18T00:00:00Z', calls: 4, points: '12', unpriced: 0, unresolved: 1, failedNotices: 0, nearLimit: [{ scope: 'member', subjectId: 'other', period: 'month', threshold: 80 }], budget, pendingReviews: 2 });
  let finish: ((response: Response) => void) | undefined;
  const calls: Array<[string, RequestInit | undefined]> = [];
  const request: typeof fetch = async (input, init) => {
    const url = String(input); calls.push([url, init]);
    if (url.endsWith('/auth/plugin/token')) return Response.json({ token: 'secret' });
    if (url.endsWith('/configs')) return Response.json(snapshot);
    return finish === undefined ? reply : new Promise<Response>(resolve => { finish = resolve; });
  };
  const client = new TeamworkClient('https://example.com', join(dir, 'cache.json'), request);
  try {
    client.beginLogin(); await client.completeLogin('code'); await client.sync();
    await expect(client.summary('other')).rejects.toThrow();
    const own = await client.summary('team1');
    expect(own).toEqual({ budget, pendingReviews: 2 });
    expect(JSON.stringify(own)).not.toContain('secret'); expect(JSON.stringify(own)).not.toContain('subjectId');
    expect(calls.at(-1)?.[0]).toBe('https://example.com/api/teams/team1/summary');
    expect(calls.at(-1)?.[1]?.headers).toEqual({ Authorization: 'Bearer secret' });
    reply = new Response('', { status: 404 }); await expect(client.summary('team1')).rejects.toThrow();
    reply = Response.json({ budget: {}, pendingReviews: 0 }); await expect(client.summary('team1')).rejects.toThrow();
    finish = () => {};
    const pending = client.summary('team1');
    await client.setEndpoint('https://other.example.com');
    finish(Response.json({ budget, pendingReviews: 0 })); await expect(pending).rejects.toThrow();
    expect(client.current()).toBeUndefined();
  } finally { await rm(dir, { recursive: true }); }
});
