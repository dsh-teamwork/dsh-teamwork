// On a cloud computer (tokenFile) a session whose model cannot be called there answers with the team's first model.
import { reportResult } from './result.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
export const inject = ['dshTeamwork', 'agents'];
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
      await reportResult({ passed: true, checks: ['cloud session defaults to the team model', 'a keyless default model is replaced by the team model'] });
    } catch (error) { await reportResult({ passed: false, error: String(error), stack: error.stack }); }
  }, 3000);
  ctx.effect(() => () => clearTimeout(timer));
}
