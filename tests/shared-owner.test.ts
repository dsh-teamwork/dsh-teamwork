import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OwnerFilter, eventSession, startDirectories } from '../src/shared-owner.js';
import { SharedRoster, sharedRosterPath } from '../src/shared-roster.js';

async function roster(now = () => Date.now()) {
  const dir = await mkdtemp(join(tmpdir(), 'shared-roster-'));
  const path = sharedRosterPath(join(dir, 'teamwork-cache.json'));
  return { roster: new SharedRoster(path, now), path };
}

describe('the shared roster', () => {
  it('admits a device once, for its member, with the invite secret, and keeps only a hash', async () => {
    const { roster: r, path } = await roster();
    const invite = await r.invite({ userId: 'ada', email: 'ada@x.io' });
    const base = { inviteId: invite.id, userId: 'ada', pairingId: 'p1', deviceName: 'phone' };
    expect(await r.accept({ ...base, secret: 'wrong' })).toBe(false);
    expect(await r.accept({ ...base, userId: 'bob', secret: invite.secret })).toBe(false);
    expect(await r.accept({ ...base, secret: invite.secret })).toBe(true);
    expect(await r.accept({ ...base, pairingId: 'p2', secret: invite.secret })).toBe(false);
    expect(await r.memberOf('p1')).toBe('ada');
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(await import('node:fs/promises').then((fs) => fs.readFile(path, 'utf8')))).not.toContain(invite.secret);
  });

  it('refuses an expired invite and drops those the server no longer lists', async () => {
    let now = 1_000;
    const { roster: r } = await roster(() => now);
    const late = await r.invite({ userId: 'ada', email: 'ada@x.io' });
    now += 25 * 60 * 60 * 1000;
    expect(await r.accept({ inviteId: late.id, secret: late.secret, userId: 'ada', pairingId: 'p1', deviceName: 'a' })).toBe(false);
    const ok = await r.invite({ userId: 'bob', email: 'bob@x.io' });
    await r.accept({ inviteId: ok.id, secret: ok.secret, userId: 'bob', pairingId: 'p2', deviceName: 'b' });
    expect(await r.prune(new Set(['ada']))).toEqual(['p2']);
    expect(await r.memberOf('p2')).toBeUndefined();
  });
});

describe('sessions belong to their starter', () => {
  const setup = async () => {
    const { roster: r } = await roster();
    for (const [userId, pairingId] of [['ada', 'pa'], ['bob', 'pb']]) {
      const invite = await r.invite({ userId: userId!, email: `${userId}@x.io` });
      await r.accept({ inviteId: invite.id, secret: invite.secret, userId: userId!, pairingId: pairingId!, deviceName: 'phone' });
    }
    return new OwnerFilter(r, (id) => r.memberOf(id), () => ['/srv/project', '/srv/docs']);
  };
  const created = (sessionId: string) => ({ result: { ok: true, value: { sessionId } } });
  const call = (sessionId: string) => ({ args: { request: { sessionId } } });

  it('records a new session as its starter\'s and keeps everyone else out of it', async () => {
    const filter = await setup();
    await filter.afterCall('pa', 'session/create', created('session-a'));
    expect(await filter.admitCall('pa', 'session/prompt', call('session-a'))).toBe(true);
    for (const method of ['session/prompt', 'session/state', 'session/cancel', 'teamwork/uploadStart', 'teamwork/selectModel',
      'session/rename', 'teamwork/selectPermission', 'teamwork/listFiles', 'teamwork/readFile', 'teamwork/searchFiles', 'workspace/pinSession', 'workspace/unpinSession', 'workspace/archiveSession', 'workspace/unarchiveSession'])
      expect(await filter.admitCall('pb', method, call('session-a'))).toBe(false);
    expect(await filter.admitCall('pa', 'workspace/archiveSession', call('session-a'))).toBe(true);
    expect(await filter.admitCall('pa', 'session/rename', call('session-keyboard'))).toBe(false);
    expect(await filter.admitCall('pb', 'session/prompt', { args: { request: {} } })).toBe(false);
    expect(await filter.admitCall('px', 'session/list', {})).toBe(false);
    expect(await filter.admitOpen('pb', 'session/follow', { args: { request: { address: { kind: 'session', sessionId: 'session-a' } } } })).toBe(false);
    expect(await filter.admitOpen('pa', 'session/follow', { args: { request: { address: { kind: 'session', sessionId: 'session-a' } } } })).toBe(true);
  });

  it('lists a member\'s own sessions alone, with no sub-agents and none started at the keyboard', async () => {
    const filter = await setup();
    await filter.afterCall('pa', 'session/create', created('session-a'));
    const item = (sessionId: string, subagent: unknown = null) => ({ sessionId, projections: { values: { subagent } } });
    const listed = await filter.afterCall('pa', 'session/list', { result: { ok: true, value: { items: [item('session-a'), item('child-1', { mode: 'continuable' }), item('session-keyboard')] } } });
    expect((listed as { result: { value: { items: { sessionId: string }[] } } }).result.value.items.map((i) => i.sessionId)).toEqual(['session-a']);
  });

  it('shows a member only their own sessions\' events, and takes answers only to questions it showed them', async () => {
    const filter = await setup();
    await filter.afterCall('pa', 'session/create', created('session-a'));
    // The shapes DSH 0.2.2-rc.3 sent in step 0 of the plan.
    const question = { type: 'waterfall', event: 'user-questions/request', eventId: 'e1', agentId: 'session-a', request: {} };
    const status = { type: 'emit', event: 'api-session/status', args: ['session-a', true] };
    const added = { type: 'emit', event: 'api-session/added', args: [{ sessionId: 'session-a' }] };
    expect([question, status, added].map(eventSession)).toEqual(['session-a', 'session-a', 'session-a']);
    expect(await filter.eventFor('pb', question)).toBeUndefined();
    expect(await filter.eventFor('pb', status)).toBeUndefined();
    expect(await filter.admitCall('pb', '$events/result', { args: { eventId: 'e1' } })).toBe(false);
    expect(await filter.eventFor('pa', question)).toBe(question);
    expect(await filter.admitCall('pa', '$events/result', { args: { eventId: 'e1' } })).toBe(true);
    expect(await filter.eventFor('pb', { type: 'ready', clientId: 'c' })).toBeTruthy();
    // DSH 0.2.2-rc.4's announcement of a changed automation task names no session, so it reaches no member.
    expect(await filter.eventFor('pa', { type: 'emit', event: 'schedule/changed', args: [] })).toBeUndefined();
  });
});

describe('where a member may start a session', () => {
  it('admits a new session only in one of the DSH\'s directories', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'shared-roster-'));
    const r = new SharedRoster(sharedRosterPath(join(dir, 'teamwork-cache.json')));
    const invite = await r.invite({ userId: 'ada', email: 'ada@x.io' });
    await r.accept({ inviteId: invite.id, secret: invite.secret, userId: 'ada', pairingId: 'pa', deviceName: 'phone' });
    const filter = new OwnerFilter(r, (id) => r.memberOf(id), () => ['/srv/project']);
    const create = (cwd?: string) => ({ args: { request: cwd === undefined ? {} : { cwd } } });
    expect(await filter.admitCall('pa', 'session/create', create('/srv/project'))).toBe(true);
    expect(await filter.admitCall('pa', 'session/create', create('/etc'))).toBe(false);
    expect(await filter.admitCall('pa', 'session/create', create())).toBe(false);
    expect(await filter.admitCall('px', 'session/create', create('/srv/project'))).toBe(false);
  });

  it('lists where DSH was started first, then its workspaces, each once', async () => {
    const started = await mkdtemp(join(tmpdir(), 'started-'));
    const real = await import('node:fs/promises').then((fs) => fs.realpath(started));
    expect(startDirectories(started, [{ path: '/srv/a' }, { path: real }, { path: '/srv/b' }])).toEqual([real, '/srv/a', '/srv/b']);
    expect(startDirectories('/no/such/dir', [])).toEqual(['/no/such/dir']);
  });
});
