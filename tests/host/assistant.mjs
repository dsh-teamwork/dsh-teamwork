import { reportResult } from './result.mjs';
// Real-host feasibility checks for inherited models, approval and private archives.
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
export const inject = [
  'agents',
  'agentPresets',
  'tools',
  'pluginManager',
  'dshTeamwork',
  'commands',
];
export function apply(ctx) {
  const timer = setTimeout(async () => {
    let server;
    const disposers = [];
    try {
      const preset = 'assistant-feasibility';
      disposers.push(
        await ctx.agentPresets.register({ id: preset, name: 'Assistant feasibility', plugins: [] }),
      );
      const id = `assistant-${process.pid}`;
      await ctx.agents.create({
        sessionId: id,
        meta: { cwd: process.env.TEAMWORK_TEST_CWD, agentPreset: preset },
        setup: async (child) => {
          await ctx.agentPresets.mount(child, preset);
        },
      });
      const agent = ctx.agents.get(id);
      agent.model.select({ provider: 'local-fixture', model: 'local-model' });
      await ctx.agentPresets.select(agent, preset);
      assert.deepEqual(agent.model.current(), { provider: 'local-fixture', model: 'local-model' });
      const snapshot = JSON.parse(await readFile(process.env.TEAMWORK_TEST_SNAPSHOT, 'utf8'));
      snapshot.configs.push({
        id: 'assistant',
        builtin: 'team-assistant',
        kind: 'preset',
        name: 'Team assistant',
        version: 1,
        data: {
          inheritModel: true,
          systemPrompt: 'Help the team',
          requiredTools: [],
          optionalTools: [],
        },
      });
      await writeFile(process.env.TEAMWORK_TEST_CACHE, JSON.stringify({ teams: [snapshot] }));
      await ctx.dshTeamwork.reload();
      const selection = await ctx.commands.execute(
        agent,
        '/teamwork use assistant',
        [],
        new AbortController().signal,
      );
      assert.equal(selection.result.kind, 'success', selection.result.text);
      assert.deepEqual(
        agent.model.current(),
        { provider: 'local-fixture', model: 'local-model' },
        'Team inherited preset must preserve model',
      );
      const freshResult = await ctx.commands.execute(
        agent,
        '/teamwork new assistant',
        [],
        new AbortController().signal,
      );
      assert.equal(freshResult.result.kind, 'success', freshResult.result.text);
      const freshId = freshResult.result.text.match(/Created session ([a-z0-9-]+)/)[1];
      assert.deepEqual(
        ctx.agents.get(freshId).model.current(),
        agent.model.current(),
        'New inherited session retains the current model',
      );
      const toolSet = await ctx.tools.resolve({
        agent,
        modelSelection: agent.model.current(),
        signal: new AbortController().signal,
      });
      const query = await ctx.tools.execute({
        agent,
        toolSet,
        signal: new AbortController().signal,
        calls: [
          {
            type: 'tool-call',
            id: 'assistant-status',
            name: 'teamwork_query',
            arguments: '{"action":"status"}',
          },
        ],
      });
      assert(JSON.stringify(query).includes('host-smoke'), 'Query uses the bound team');
      agent.session.append('turn/start', { turn: 1 });
      agent.session.append('approval/policy', { policy: 'never' });
      const denied = await ctx.tools.execute({
        agent,
        toolSet,
        signal: new AbortController().signal,
        calls: [
          {
            type: 'tool-call',
            id: 'teamwork-real-denied',
            name: 'teamwork_manage',
            arguments: JSON.stringify({
              action: 'createConfig',
              input: { kind: 'preset', name: 'Never publish', data: { inheritModel: true } },
            }),
          },
        ],
      });
      assert(
        /denied|DENIED|rejected/.test(JSON.stringify(denied)),
        'Real Teamwork mutation cannot bypass host approval',
      );
      agent.session.append('approval/policy', { policy: 'ask' });
      let invalidate = false;
      const answer = ctx.on(
        'approval/request',
        async (req, next) => {
          if (req.toolName !== 'teamwork_new_session') return next();
          if (invalidate)
            await ctx.commands.execute(agent, '/teamwork logout', [], new AbortController().signal);
          return 'allowed-once';
        },
        { prepend: true },
      );
      try {
        const accepted = await ctx.tools.execute({
          agent,
          toolSet,
          signal: new AbortController().signal,
          calls: [
            {
              type: 'tool-call',
              id: 'teamwork-approved',
              name: 'teamwork_new_session',
              arguments: '{"id":"assistant"}',
            },
          ],
        });
        assert(
          JSON.stringify(accepted).includes('Created session'),
          'Trusted host approval executes the real Teamwork operation',
        );
        invalidate = true;
        const expired = await ctx.tools.execute({
          agent,
          toolSet,
          signal: new AbortController().signal,
          calls: [
            {
              type: 'tool-call',
              id: 'teamwork-expired',
              name: 'teamwork_new_session',
              arguments: '{"id":"assistant"}',
            },
          ],
        });
        assert(
          JSON.stringify(expired).includes('Approval expired'),
          'Account changes during host approval invalidate the operation',
        );
      } finally {
        answer();
      }
      toolSet.dispose();
      let mutations = 0;
      disposers.push(
        ctx.tools.register({
          name: 'assistant_feasibility',
          description: 'Test confirmation',
          parameters: {
            type: 'object',
            properties: { confirm: { type: 'boolean' } },
            additionalProperties: false,
          },
          output: {
            schema: {
              type: 'object',
              properties: { ok: { type: 'boolean' } },
              required: ['ok'],
              additionalProperties: false,
            },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
          },
          execute: async () => {
            mutations++;
            return { ok: true };
          },
        }),
      );
      disposers.push(
        ctx.on('tools/pre-execute', (exec, next) =>
          exec.name === 'assistant_feasibility'
            ? { kind: 'ask', reason: 'Approve exact test mutation' }
            : next(),
        ),
      );
      agent.session.append('approval/policy', { policy: 'never' });
      const result = await ctx.tools.execute({
        agent,
        signal: new AbortController().signal,
        calls: [
          {
            type: 'tool-call',
            id: 'assistant-denied',
            name: 'assistant_feasibility',
            arguments: '{"confirm":true}',
          },
        ],
      });
      assert.equal(mutations, 0, 'Model arguments cannot grant approval');
      assert(
        JSON.stringify(result).includes('denied') ||
          JSON.stringify(result).includes('DENIED') ||
          JSON.stringify(result).includes('rejected'),
        'Approval must refuse this call',
      );
      const archive = await readFile(process.env.TEAMWORK_TEST_ARCHIVE);
      const token = randomBytes(16).toString('hex');
      server = createServer((req, res) => {
        if (req.headers.authorization !== `Bearer ${token}`) {
          res.writeHead(401);
          res.end();
          return;
        }
        res.end(archive);
      });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const url = `http://127.0.0.1:${server.address().port}/package`;
      assert.equal((await fetch(url)).status, 401);
      const bytes = Buffer.from(
        await (await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).arrayBuffer(),
      );
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        createHash('sha256').update(archive).digest('hex'),
      );
      const path = `${process.env.TEAMWORK_TEST_CWD}/private-fixture.tgz`;
      await writeFile(path, bytes, { mode: 0o600 });
      const installed = await ctx.pluginManager.installBundle(path, {
        saveExact: true,
        enabled: false,
      });
      assert(!installed.error, JSON.stringify(installed.error));
      const bundle = (await ctx.pluginManager.listBundles()).find(
        (b) => b.name === '@teamwork-test/fixture',
      );
      assert(bundle?.installed, 'Local archive installed through real manager');
      assert.equal(bundle.enabled, false, 'Private plugin starts disabled');
      await rm(path);
      assert(
        (await ctx.pluginManager.listBundles()).some(
          (b) => b.name === '@teamwork-test/fixture' && b.installed,
        ),
        'Installed package survives source deletion',
      );
      await reportResult({
          passed: true,
          checks: [
            'inherited local model',
            'registered tool uses real executor',
            'trusted host approval executes operation',
            'account change invalidates approval',
            'model confirm cannot bypass host approval',
            'authenticated private download',
            'digest verification',
            'local archive installation disabled',
            'installed package survives source deletion',
          ],
        });
    } catch (error) {
      await reportResult({ passed: false, error: String(error), stack: error.stack });
    } finally {
      if (server) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      for (const dispose of disposers.reverse()) await dispose();
    }
  }, 3000);
  ctx.effect(() => () => clearTimeout(timer));
}
