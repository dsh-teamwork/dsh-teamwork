// On a cloud computer (tokenFile) a session that names no model answers with the team's first model.
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
      assert.deepEqual(agent.model.current(), { provider: 'teamwork-platform', model: 'm1' });
      await reportResult({ passed: true, checks: ['cloud session defaults to the team model'] });
    } catch (error) { await reportResult({ passed: false, error: String(error), stack: error.stack }); }
  }, 3000);
  ctx.effect(() => () => clearTimeout(timer));
}
