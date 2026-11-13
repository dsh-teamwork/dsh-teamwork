import { expect, test } from 'vitest';
import { TeamOverlay, TeamworkClient, type Snapshot } from '../src/client.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const team1 = { teamId: 'team1', teamName: 'Team one', role: 'member' as const, configs: [{ id: 'p1', name: 'Same name', kind: 'preset' as const, version: 1, data: { provider: 'deepseek', model: 'chat', systemPrompt: 'Review' } }] };
const snapshot: Snapshot = { teams: [team1] };
test('team updates and removal never touch a same-named local registration', async () => {
  const registrations = new Map<string, string>([['local', 'Same name']]); let count = 0;
  const overlay = new TeamOverlay(async (id, config) => { if (registrations.has(id)) throw new Error('collision'); registrations.set(id, config.name); count++; return async () => { registrations.delete(id); }; });
  await overlay.apply(snapshot); await overlay.apply(snapshot); expect(count).toBe(1);
  await overlay.apply({ teams: [{ ...team1, configs: [{ ...team1.configs[0]!, name: 'Updated', version: 2 }] }] });
  expect(registrations.get('local')).toBe('Same name'); expect(registrations.get('team:team1:p1')).toBe('Updated');
  await overlay.apply(); expect([...registrations]).toEqual([['local', 'Same name']]);
});
test('registers every team’s entries under its own team, and re-registers a team that was renamed', async () => {
  const registrations = new Map<string, string>();
  const overlay = new TeamOverlay(async (id, config, team) => { registrations.set(id, `[${team.teamName}] ${config.name}`); return async () => { registrations.delete(id); }; });
  const team2 = { teamId: 'team2', teamName: 'Team two', role: 'admin' as const, configs: [{ ...team1.configs[0]!, id: 'p2' }] };
  await overlay.apply({ teams: [team1, team2] });
  expect(Object.fromEntries(registrations)).toEqual({ 'team:team1:p1': '[Team one] Same name', 'team:team2:p2': '[Team two] Same name' });
  await overlay.apply({ teams: [{ ...team1, teamName: 'Team uno' }, team2] });
  expect(registrations.get('team:team1:p1')).toBe('[Team uno] Same name');
  await overlay.apply({ teams: [team2] });
  expect([...registrations.keys()]).toEqual(['team:team2:p2']);
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
  const request: typeof fetch = async input => {
    calls.push(new URL(String(input)).pathname);
    if (String(input).endsWith('/auth/plugin/token')) { started(); return new Promise(resolve => { complete = resolve; }); }
    return Response.json(snapshot);
  };
  try {
    const client = new TeamworkClient('http://localhost:3800', join(dir, 'cache.json'), request);
    client.beginLogin(); const login = client.completeLogin('code'); const rejected = expect(login).rejects.toThrow('Login cancelled');
    await fetching; const logout = client.logout(); complete(Response.json({ token: 'late-token' }));
    await rejected; await logout; await expect(client.sync()).rejects.toThrow('Sign in first');
    // The late token is dropped, never used: no request carried it.
    expect(calls).toEqual(['/api/auth/plugin/token']);
  } finally { await rm(dir, { recursive: true }); }
});
