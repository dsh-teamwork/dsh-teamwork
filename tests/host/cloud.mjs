// On a cloud computer (tokenFile) a session whose model cannot be called there answers with the team's first model,
// and the bridge route its server calls passes a computer's automation tasks to DSH's own Schedule (the server's ADR 0066).
import { reportResult } from './result.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
export const inject = ['dshTeamwork', 'agents', 'connection', 'webServer'];
export function apply(ctx) {
  const timer = setTimeout(async () => {
    try {
      const snapshot = JSON.parse(await readFile(process.env.TEAMWORK_TEST_SNAPSHOT, 'utf8'));
      snapshot.configs.unshift({ id: 'm1', kind: 'model', name: 'Team model', version: 1, data: { provider: 'deepseek', model: 'deepseek-chat', contextWindow: 131072 } });
      await writeFile(process.env.TEAMWORK_TEST_CACHE, JSON.stringify({ teams: [snapshot] })); await ctx.dshTeamwork.reload();
      await ctx.agents.create({ sessionId: 'plain-' + process.pid, meta: { cwd: process.env.TEAMWORK_TEST_CWD } });
      const agent = ctx.agents.get('plain-' + process.pid);
      assert.deepEqual(agent.model.current(), { provider: 'teamwork-platform-host-smoke', model: 'm1' });
      // DSH's own default model, which has no key on a cloud computer, is replaced too.
      await ctx.agents.create({ sessionId: 'keyless-' + process.pid, meta: { cwd: process.env.TEAMWORK_TEST_CWD }, agentOptions: { provider: 'deepseek-official', model: 'deepseek-flash' } });
      const keyless = ctx.agents.get('keyless-' + process.pid);
      for (let i = 0; i < 50 && keyless.model.current()?.provider !== 'teamwork-platform-host-smoke'; i++) await new Promise(resolve => setTimeout(resolve, 100));
      assert.deepEqual(keyless.model.current(), { provider: 'teamwork-platform-host-smoke', model: 'm1' });
      await automationTasks(ctx);
      await reportResult({ passed: true, checks: ['cloud session defaults to the team model', 'a keyless default model is replaced by the team model',
        'automation tasks are created, run, paused, read and deleted through the bridge, and a delivery lands in its session'] });
    } catch (error) { await reportResult({ passed: false, error: String(error), stack: error.stack }); }
  }, 3000);
  ctx.effect(() => () => clearTimeout(timer));
}

/** Drives DSH's Schedule through `POST /api/teamwork/bridge`, as a cloud computer's server does, behind DSH's own sign-in. */
async function automationTasks(ctx) {
  const origin = ctx.webServer.getOrigin();
  const token = new URL(ctx.connection.authenticatedUrl(origin)).searchParams.get('token');
  const entered = await fetch(`${origin}/connect?token=${encodeURIComponent(token)}`, { redirect: 'manual' });
  const cookie = entered.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  let n = 0;
  const call = async (method, request) => {
    const response = await fetch(`${origin}/api/teamwork/bridge`, { method: 'POST', headers: { 'content-type': 'application/json', cookie, origin }, body: JSON.stringify({ id: `c${++n}`, method, body: { args: request === undefined ? {} : { request } } }) });
    return response.json();
  };
  const value = (answer) => { assert.equal(answer.status, 200, JSON.stringify(answer)); assert.equal(answer.body.result?.ok, true, JSON.stringify(answer)); return answer.body.result.value; };
  const { sessionId } = value(await call('session/create', { cwd: process.env.TEAMWORK_TEST_CWD }));
  const created = value(await call('schedule/create', { title: 'Host check', prompt: 'Report the build.', timing: { kind: 'at', at: new Date(Date.now() + 3600_000).toISOString() }, target: { kind: 'session', sessionId } }));
  assert.equal(created.status, 'active');
  assert.ok(value(await call('schedule/catalog')).some(task => task.id === created.id));
  const ran = value(await call('schedule/run', { id: created.id }));
  assert.equal(ran.lastDelivery?.targetSessionId, sessionId);
  const paused = value(await call('schedule/edit', { id: created.id, action: 'update', patch: { active: false }, expectedUpdatedAt: ran.updatedAt }));
  assert.equal(paused.status, 'paused');
  assert.equal(value(await call('schedule/edit', { id: created.id, action: 'update', patch: { title: 'Stale' }, expectedUpdatedAt: ran.updatedAt })).code, 'schedule_conflict');
  assert.equal(value(await call('schedule/history', { id: created.id, limit: 10 })).records[0]?.prompt, 'Report the build.');
  const invalid = await call('schedule/create', { title: ' ', prompt: 'x', timing: { kind: 'after', after_seconds: 60 } });
  assert.equal(invalid.body.result?.error?.code, 'schedule/input-invalid');
  // The delivery is the session's own user turn, framed by DSH.
  let delivered = false;
  for (let i = 0; i < 50 && !delivered; i++) {
    const page = value(await call('session/page', { address: { kind: 'session', sessionId }, maxMessages: 50 }));
    delivered = JSON.stringify(page.records).includes('[SCHEDULE REMINDER]');
    if (!delivered) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(delivered, 'the run reached its session');
  assert.equal(value(await call('schedule/edit', { id: created.id, action: 'delete' })).deleted, true);
  // DSH's other Schedule methods stay off the list.
  assert.equal((await call('schedule/list')).status, 403);
}
