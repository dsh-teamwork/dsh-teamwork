import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { PresetContext } from './preset-context.js';
import type { TeamworkClient } from './client.js';
import { readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { preparePlugin, type PreparedPlugin } from './local-share.js';
import { z } from 'zod';

const filters = z
  .object({
    configId: z.string().optional(),
    userId: z.string().optional(),
    authorId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    kind: z.string().optional(),
    offset: z.string().optional(),
    page: z.string().optional(),
    size: z.string().optional(),
  })
  .strict();
const query = z
  .object({
    filters: filters.optional(),
    action: z.enum([
      'status',
      'sync',
      'configs',
      'usage',
      'budgets',
      'members',
      'submissions',
      'history',
      'providers',
    ]),
  })
  .strict();
/** The server is authoritative for access; the active preset fixes the destination. */
export function registerAssistantTools(
  ctx: Context,
  client: TeamworkClient,
  preset: (agent: Agent) => PresetContext | undefined,
  sync: () => Promise<unknown>,
  install: (id: string, version: string) => Promise<string>,
) {
  const bindings = new Map<
    symbol,
    { epoch: number; teamId: string; presetId: string; version: number }
  >();
  const previews = new Map<
    string,
    { plugin: PreparedPlugin; agentId: string; epoch: number; teamId: string }
  >();
  const writes = new Set([
    'teamwork_prepare_plugin',
    'teamwork_share_plugin',
    'teamwork_share_preset',
    'teamwork_review',
    'teamwork_manage',
    'teamwork_export_usage',
    'teamwork_new_session',
    'teamwork_install',
  ]);
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (!writes.has(exec.name)) return next();
    const policy = await next();
    if (policy.kind === 'deny' || policy.kind === 'cancel') return policy;
    const bound = exec.agent && preset(exec.agent);
    if (!bound) return { kind: 'deny' as const, reason: 'A team-bound preset is required' };
    bindings.set(exec.token, {
      epoch: client.sessionRevision(),
      teamId: bound.teamId,
      presetId: bound.id,
      version: bound.version,
    });
    let preview = '';
    if (exec.name === 'teamwork_share_plugin') {
      const args = z.object({ previewId: z.string() }).passthrough().parse(exec.arguments);
      const saved = previews.get(args.previewId);
      if (
        !saved ||
        saved.agentId !== String(exec.agent?.id) ||
        saved.teamId !== bound.teamId ||
        saved.epoch !== client.sessionRevision()
      )
        return { kind: 'deny' as const, reason: 'Prepared package is unavailable' };
      preview = JSON.stringify({
        package: saved.plugin.package,
        version: saved.plugin.version,
        sha256: saved.plugin.sha256,
        size: saved.plugin.size,
        files: saved.plugin.files,
      });
    }
    if (exec.name === 'teamwork_review') {
      const args = z
        .object({ id: z.string(), revision: z.number() })
        .passthrough()
        .parse(exec.arguments);
      const current = await client.reviewPreview(bound.teamId, args.id, exec.signal);
      if (current.revision !== args.revision)
        return {
          kind: 'deny' as const,
          reason: 'Submission revision changed. Read the current proposal.',
        };
      preview = JSON.stringify(current);
    }
    return {
      kind: 'ask' as const,
      reason: `Team ${bound.teamId}: review the exact ${exec.name} arguments before permitting this operation. ${preview}`,
    };
  });
  ctx.on('tools/result', (exec) => {
    bindings.delete(exec.token);
  });
  ctx.effect(() => async () => {
    await Promise.all(
      [...previews.values()].map((preview) =>
        rm(preview.plugin.directory, { recursive: true, force: true }),
      ),
    );
    previews.clear();
    bindings.clear();
  });
  const output = {
    schema: { type: 'object' as const, additionalProperties: true },
    render: (_args: unknown, value: unknown) => [
      { type: 'text' as const, text: JSON.stringify(value) },
    ],
  };
  const add = (
    name: string,
    description: string,
    schema: Record<string, unknown>,
    execute: (
      input: unknown,
      agent: Agent,
      signal: AbortSignal,
      teamId: string,
    ) => Promise<unknown>,
  ) => {
    ctx.effect(() =>
      ctx.tools.register(
        {
          name,
          description,
          parameters: schema,
          output,
          async execute(input, exec) {
            const bound = exec.agent && preset(exec.agent),
              binding = bindings.get(exec.token);
            if (
              !exec.agent ||
              !bound ||
              !binding ||
              binding.epoch !== client.sessionRevision() ||
              binding.teamId !== bound.teamId ||
              binding.presetId !== bound.id ||
              binding.version !== bound.version
            )
              throw Error('Approval expired because the account or team preset changed');
            return execute(input, exec.agent, exec.signal, bound.teamId);
          },
        },
        { when: ({ agent }) => !!preset(agent) },
      ),
    );
  };
  add(
    'teamwork_prepare_plugin',
    'Prepare a local plugin inside this session workspace without executing lifecycle scripts. Returns the exact archive file list and digest; does not upload. Requires host permission.',
    {
      type: 'object',
      properties: { directory: { type: 'string' } },
      required: ['directory'],
      additionalProperties: false,
    },
    async (input, agent, signal, teamId) => {
      const { directory } = z
        .object({ directory: z.string().min(1) })
        .strict()
        .parse(input);
      if (previews.size >= 20)
        throw Error('Too many prepared packages; restart the plugin to discard old preparations');
      const epoch = client.sessionRevision();
      const cwd = agent.session.header.cwd;
      if (!cwd) throw Error('Session workspace is unavailable');
      const plugin = await preparePlugin(cwd, directory, signal);
      if (epoch !== client.sessionRevision() || preset(agent)?.teamId !== teamId) {
        await rm(plugin.directory, { recursive: true, force: true });
        throw Error('Account or team changed during preparation');
      }
      const previewId = randomUUID();
      previews.set(previewId, { plugin, agentId: String(agent.id), epoch, teamId });
      return {
        previewId,
        teamId,
        package: plugin.package,
        version: plugin.version,
        sha256: plugin.sha256,
        size: plugin.size,
        files: plugin.files,
        uploaded: false,
      };
    },
  );
  add(
    'teamwork_share_plugin',
    'Upload a previously prepared plugin and submit it for administrator review. Show its exact preview to the user first. A configId/baseVersion updates an existing team plugin. This does not publish or install.',
    {
      type: 'object',
      properties: {
        previewId: { type: 'string' },
        name: { type: 'string' },
        note: { type: 'string' },
        configId: { type: 'string' },
        baseVersion: { type: 'integer', minimum: 0 },
      },
      required: ['previewId', 'name', 'note', 'baseVersion'],
      additionalProperties: false,
    },
    async (input, agent, signal, teamId) => {
      const data = z
        .object({
          previewId: z.string(),
          name: z.string().min(1).max(120),
          note: z.string().max(2000),
          configId: z.string().max(32).optional(),
          baseVersion: z.number().int().min(0),
        })
        .strict()
        .parse(input);
      const saved = previews.get(data.previewId);
      if (
        !saved ||
        saved.agentId !== String(agent.id) ||
        saved.epoch !== client.sessionRevision() ||
        saved.teamId !== teamId
      )
        throw Error('Prepared archive is unavailable for this session');
      const bytes = await readFile(saved.plugin.path);
      const result = await client.submitPlugin(
        teamId,
        bytes,
        saved.plugin.sha256,
        {
          name: data.name,
          note: data.note,
          configId: data.configId,
          baseVersion: data.baseVersion,
        },
        signal,
      );
      previews.delete(data.previewId);
      await rm(saved.plugin.directory, { recursive: true, force: true });
      return { teamId, result, published: false };
    },
  );
  add(
    'teamwork_share_preset',
    'Submit the exact proposed preset for administrator review. Use configId and baseVersion for updates. This does not publish. Remove local paths and secrets and map dependencies to this team before submission.',
    {
      type: 'object',
      properties: {
        config: { type: 'object' },
        configId: { type: 'string' },
        baseVersion: { type: 'integer', minimum: 0 },
        note: { type: 'string' },
      },
      required: ['config', 'baseVersion', 'note'],
      additionalProperties: false,
    },
    async (input, _agent, signal, teamId) => {
      const data = z
        .object({
          config: z
            .object({
              kind: z.literal('preset'),
              name: z.string().min(1).max(120),
              data: z.record(z.string(), z.unknown()),
            })
            .strict(),
          configId: z.string().max(32).optional(),
          baseVersion: z.number().int().min(0),
          note: z.string().max(2000),
        })
        .strict()
        .parse(input);
      if (
        /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|sk-[A-Za-z0-9_-]{20,}/.test(
          JSON.stringify(data.config),
        )
      )
        throw Error('Remove potential credentials before sharing');
      const draft = z
        .object({ id: z.string(), revision: z.number() })
        .parse(await client.assistantChange(teamId, 'saveDraft', data, signal));
      const result = await client.assistantChange(teamId, 'submit', draft, signal);
      return { teamId, result, published: false };
    },
  );
  add(
    'teamwork_review',
    'Submit or withdraw your proposal, or explicitly approve/reject as a team administrator. Inspect current submission contents and revision first. Host confirmation is always required; a model flag cannot approve.',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['submit', 'withdraw', 'approve', 'reject'] },
        id: { type: 'string' },
        revision: { type: 'integer', minimum: 1 },
        reason: { type: 'string' },
      },
      required: ['action', 'id', 'revision'],
      additionalProperties: false,
    },
    async (input, _agent, signal, teamId) => {
      const data = z
        .object({
          action: z.enum(['submit', 'withdraw', 'approve', 'reject']),
          id: z.string().min(1).max(32),
          revision: z.number().int().positive(),
          reason: z.string().max(2000).optional(),
        })
        .strict()
        .parse(input);
      const { action, ...body } = data;
      return { teamId, result: await client.assistantChange(teamId, action, body, signal) };
    },
  );
  add(
    'teamwork_manage',
    'Administrator operations on the bound team: create/update/delete configuration, revision-checked budget changes, remove a member, or prepare a historical restore. editDraft edits an owned draft. Query current state first; show the complete proposed change. Provider key entry and account creation with passwords must use secure console forms.',
    {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'createConfig',
            'updateConfig',
            'deleteConfig',
            'setBudget',
            'removeMember',
            'restore',
            'editDraft',
          ],
        },
        input: { type: 'object' },
      },
      required: ['action', 'input'],
      additionalProperties: false,
    },
    async (input, _agent, signal, teamId) => {
      const data = z
        .object({
          action: z.enum([
            'createConfig',
            'updateConfig',
            'deleteConfig',
            'setBudget',
            'removeMember',
            'restore',
            'editDraft',
          ]),
          input: z.record(z.string(), z.unknown()),
        })
        .strict()
        .parse(input);
      if (
        ['updateConfig', 'deleteConfig', 'removeMember', 'restore', 'editDraft'].includes(
          data.action,
        ) &&
        !z
          .string()
          .regex(/^[A-Za-z0-9_-]{1,32}$/)
          .safeParse(data.input.id).success
      )
        throw Error('An exact resource id is required');
      if (data.action === 'setBudget' && !('revision' in data.input))
        throw Error('Read the current budget revision first');
      return {
        teamId,
        result: await client.assistantChange(teamId, data.action, data.input, signal),
      };
    },
  );
  add(
    'teamwork_export_usage',
    'Export authorized usage to a private local CSV file. Members export only their own allowed usage; administrators can filter by member/model/time.',
    {
      type: 'object',
      properties: { filters: { type: 'object', additionalProperties: { type: 'string' } } },
      additionalProperties: false,
    },
    async (input, _agent, signal, teamId) => {
      const data = z.object({ filters: filters.optional() }).strict().parse(input);
      return {
        teamId,
        path: await client.exportUsage(
          teamId,
          (data.filters as Record<string, string>) ?? {},
          signal,
        ),
      };
    },
  );
  add(
    'teamwork_new_session',
    'Create a new session from a preset of the bound team. Does not start a task or change the existing conversation.',
    {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    async (input, agent, signal, teamId) => {
      const { id } = z
        .object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/) })
        .strict()
        .parse(input);
      if (
        !client
          .current()
          ?.teams.find((t) => t.teamId === teamId)
          ?.configs.some((c) => c.id === id && c.kind === 'preset')
      )
        throw Error('Choose a preset in this team');
      const commands = ctx.get('commands');
      if (!commands) throw Error('Host command service is unavailable');
      const result = await commands.execute(agent, `/teamwork new ${id}`, [], signal);
      if (!result) throw Error('Host did not handle session creation');
      if (result.result.kind === 'error') throw Error(result.result.text);
      return { teamId, result: result.result };
    },
  );
  add(
    'teamwork_install',
    'Install and enable an exact published team plugin after explicit host approval. This changes the local DSH profile for all sessions and may execute plugin code. Existing local plugins are protected; upgrades use the local plugin manager.',
    {
      type: 'object',
      properties: { id: { type: 'string' }, version: { type: 'string' } },
      required: ['id', 'version'],
      additionalProperties: false,
    },
    async (input, _agent, _signal, teamId) => {
      const { id, version } = z
        .object({
          id: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
          version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/),
        })
        .strict()
        .parse(input);
      const team = client.current()?.teams.find((t) => t.teamId === teamId);
      if (
        !team?.configs.some((c) => c.id === id && c.kind === 'plugin') &&
        !team?.pluginVersions?.some((c) => c.configId === id)
      )
        throw Error('Choose a plugin in this team');
      return { teamId, result: await install(id, version) };
    },
  );
  ctx.effect(() =>
    ctx.tools.register(
      {
        name: 'teamwork_query',
        description:
          'Inspect the team bound to this preset: status, configuration, personal usage, applicable budgets or members. Administrators receive their permitted team usage. Sync refreshes team configuration. Unknown usage is not zero.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: [
                'status',
                'sync',
                'configs',
                'usage',
                'budgets',
                'members',
                'submissions',
                'history',
                'providers',
              ],
            },
            filters: { type: 'object', additionalProperties: { type: 'string' } },
          },
          required: ['action'],
          additionalProperties: false,
        },
        output: {
          schema: { type: 'object', additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        async execute(input, exec) {
          const { action, filters: requestedFilters } = query.parse(input);
          if (!exec.agent) throw new Error('A team-bound session is required');
          const bound = preset(exec.agent);
          if (!bound) throw new Error('A team-bound preset is required');
          const epoch = client.sessionRevision(),
            teamId = bound.teamId;
          if (action === 'status')
            return {
              teamId,
              authenticated: client.authenticated(),
              team: client.current()?.teams.find((t) => t.teamId === teamId)?.teamName ?? null,
            };
          if (action === 'sync') {
            await sync();
            if (epoch !== client.sessionRevision() || preset(exec.agent)?.teamId !== teamId)
              throw new Error('Session changed during sync');
            return { teamId, synced: true };
          }
          const result = await client.assistantRead(
            teamId,
            action,
            exec.signal,
            requestedFilters as Record<string, string> | undefined,
          );
          if (preset(exec.agent)?.teamId !== teamId)
            throw new Error('Team changed during operation');
          return { teamId, result };
        },
      },
      { when: ({ agent }) => !!preset(agent) },
    ),
  );
}
