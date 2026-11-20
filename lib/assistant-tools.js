import { readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { preparePlugin } from './local-share.js';
import { z } from 'zod';
/** Each read's query parameters, as the server names them (api/openapi.yaml in the platform repository). */
const FILTERS = {
    usage: ['userId', 'configId', 'since', 'until', 'page', 'size'],
    export: ['userId', 'configId', 'since', 'until'],
    history: ['configId', 'kind', 'authorId', 'from', 'to', 'offset'],
    submissions: ['state', 'mine', 'offset'],
};
/** A model writes a page size as a number as often as a string; the query string takes either. */
const filters = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]).transform(String));
/** Refuses a filter the action's route would silently ignore, naming the ones it takes. */
export function checkFilters(action, given) {
    const allowed = FILTERS[action] ?? [];
    const unknown = Object.keys(given ?? {}).filter((key) => !allowed.includes(key));
    if (unknown.length)
        throw Error(`${action} takes no filter ${unknown.join(', ')}; it takes ${allowed.join(', ') || 'none'}`);
}
const filterSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        since: { type: 'string', description: 'usage, export: ISO 8601 start, e.g. 2026-11-01T00:00:00Z' },
        until: { type: 'string', description: 'usage, export: ISO 8601 end, exclusive' },
        userId: { type: 'string', description: 'usage, export: one member (administrators)' },
        configId: { type: 'string', description: 'usage, export, history: one model or configuration' },
        page: { type: 'string', description: 'usage: page number from 1' },
        size: { type: 'string', description: 'usage: rows per page, at most 200' },
        state: { type: 'string', enum: ['draft', 'pending', 'published', 'rejected', 'withdrawn'], description: 'submissions: only this state; pending is what awaits review' },
        mine: { type: 'string', enum: ['true'], description: "submissions: only the caller's own" },
        kind: { type: 'string', enum: ['model', 'preset', 'plugin'], description: 'history' },
        authorId: { type: 'string', description: 'history' },
        from: { type: 'string', description: 'history: ISO 8601 start' },
        to: { type: 'string', description: 'history: ISO 8601 end' },
        offset: { type: 'string', description: 'history, submissions' },
    },
};
/** The tools DSH registers by these names; a preset may also name a plugin's. */
const HOST_TOOLS = 'read, write, edit, apply_patch, glob, grep, bash, web_search, web_fetch, todo_write, ask_user_question, skill';
/** A preset as the server stores it, typed so a model writes arrays as arrays (PresetData in api/openapi.yaml). */
const presetData = {
    type: 'object',
    additionalProperties: false,
    description: 'Exactly one model choice: modelConfigId, or inheritModel true.',
    properties: {
        modelConfigId: { type: 'string', description: "The id of one of this team's models (configs)" },
        inheritModel: { type: 'boolean', description: "Use the session's own model instead of a team model" },
        description: { type: 'string', description: 'One line shown in the preset list' },
        systemPrompt: { type: 'string', description: 'Persona, method and deliverable, in the language the team works in' },
        outputDescription: { type: 'string', description: 'What a session under the preset delivers' },
        instructions: { type: 'string', description: 'Notes for people; never sent to the model' },
        requiredTools: { type: 'array', items: { type: 'string' }, description: `Tools it cannot work without. DSH's: ${HOST_TOOLS}` },
        optionalTools: { type: 'array', items: { type: 'string' } },
        pluginDependencies: {
            type: 'array',
            items: {
                type: 'object',
                required: ['pluginConfigId', 'version'],
                additionalProperties: false,
                properties: { pluginConfigId: { type: 'string' }, version: { type: 'string' } },
            },
        },
        avatar: { type: 'string', description: "Keep the one it has; omit it for a new preset and clients pick one" },
    },
};
const presetConfig = {
    type: 'object',
    required: ['kind', 'name', 'data'],
    additionalProperties: false,
    properties: {
        kind: { type: 'string', enum: ['preset'] },
        name: { type: 'string', maxLength: 120 },
        data: presetData,
    },
};
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
export function registerAssistantTools(ctx, client, preset, sync, install) {
    const bindings = new Map();
    const previews = new Map();
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
        if (!writes.has(exec.name))
            return next();
        const policy = await next();
        if (policy.kind === 'deny' || policy.kind === 'cancel')
            return policy;
        const bound = exec.agent && preset(exec.agent);
        if (!bound)
            return { kind: 'deny', reason: 'A team-bound preset is required' };
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
            if (!saved ||
                saved.agentId !== String(exec.agent?.id) ||
                saved.teamId !== bound.teamId ||
                saved.epoch !== client.sessionRevision())
                return { kind: 'deny', reason: 'Prepared package is unavailable' };
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
                    kind: 'deny',
                    reason: 'Submission revision changed. Read the current proposal.',
                };
            preview = JSON.stringify(current);
        }
        return {
            kind: 'ask',
            reason: `Team ${bound.teamId}: review the exact ${exec.name} arguments before permitting this operation. ${preview}`,
        };
    });
    ctx.on('tools/result', (exec) => {
        bindings.delete(exec.token);
    });
    ctx.effect(() => async () => {
        await Promise.all([...previews.values()].map((preview) => rm(preview.plugin.directory, { recursive: true, force: true })));
        previews.clear();
        bindings.clear();
    });
    const output = {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [
            { type: 'text', text: JSON.stringify(value) },
        ],
    };
    const add = (name, description, schema, execute) => {
        ctx.effect(() => ctx.tools.register({
            name,
            description,
            parameters: schema,
            output,
            async execute(input, exec) {
                const bound = exec.agent && preset(exec.agent), binding = bindings.get(exec.token);
                if (!exec.agent ||
                    !bound ||
                    !binding ||
                    binding.epoch !== client.sessionRevision() ||
                    binding.teamId !== bound.teamId ||
                    binding.presetId !== bound.id ||
                    binding.version !== bound.version)
                    throw Error('Approval expired because the account or team preset changed');
                return execute(input, exec.agent, exec.signal, bound.teamId);
            },
        }, { when: ({ agent }) => !!preset(agent) }));
    };
    add('teamwork_prepare_plugin', 'Prepare a local plugin inside this session workspace without executing lifecycle scripts. Returns the exact archive file list and digest; does not upload. Requires host permission.', {
        type: 'object',
        properties: { directory: { type: 'string' } },
        required: ['directory'],
        additionalProperties: false,
    }, async (input, agent, signal, teamId) => {
        const { directory } = z
            .object({ directory: z.string().min(1) })
            .strict()
            .parse(input);
        if (previews.size >= 20)
            throw Error('Too many prepared packages; restart the plugin to discard old preparations');
        const epoch = client.sessionRevision();
        const cwd = agent.session.header.cwd;
        if (!cwd)
            throw Error('Session workspace is unavailable');
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
    });
    add('teamwork_share_plugin', 'Upload a previously prepared plugin and submit it for administrator review. Show its exact preview to the user first. A configId/baseVersion updates an existing team plugin. This does not publish or install.', {
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
    }, async (input, agent, signal, teamId) => {
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
        if (!saved ||
            saved.agentId !== String(agent.id) ||
            saved.epoch !== client.sessionRevision() ||
            saved.teamId !== teamId)
            throw Error('Prepared archive is unavailable for this session');
        const bytes = await readFile(saved.plugin.path);
        const result = await client.submitPlugin(teamId, bytes, saved.plugin.sha256, {
            name: data.name,
            note: data.note,
            configId: data.configId,
            baseVersion: data.baseVersion,
        }, signal);
        previews.delete(data.previewId);
        await rm(saved.plugin.directory, { recursive: true, force: true });
        return { teamId, result, published: false };
    });
    add('teamwork_share_preset', 'Submit a complete preset for administrator review: a new one with baseVersion 0, or a change to a team preset with its configId and current version as baseVersion. This does not publish; an administrator approves it. Remove local paths and secrets and map dependencies to this team first.', {
        type: 'object',
        properties: {
            config: presetConfig,
            configId: { type: 'string', description: 'The team preset this changes; omit for a new one' },
            baseVersion: { type: 'integer', minimum: 0, description: '0 for a new preset, else the version read from configs' },
            note: { type: 'string', description: 'One or two lines for the reviewer: what it is for and what changed' },
        },
        required: ['config', 'baseVersion', 'note'],
        additionalProperties: false,
    }, async (input, _agent, signal, teamId) => {
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
        if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|sk-[A-Za-z0-9_-]{20,}/.test(JSON.stringify(data.config)))
            throw Error('Remove potential credentials before sharing');
        const draft = z
            .object({ id: z.string(), revision: z.number() })
            .parse(await client.assistantChange(teamId, 'saveDraft', data, signal));
        const result = await client.assistantChange(teamId, 'submit', draft, signal);
        return { teamId, result, published: false };
    });
    add('teamwork_review', 'Submit or withdraw your proposal, or explicitly approve/reject as a team administrator. Inspect current submission contents and revision first. Host confirmation is always required; a model flag cannot approve.', {
        type: 'object',
        properties: {
            action: { type: 'string', enum: ['submit', 'withdraw', 'approve', 'reject'] },
            id: { type: 'string' },
            revision: { type: 'integer', minimum: 1 },
            reason: { type: 'string' },
        },
        required: ['action', 'id', 'revision'],
        additionalProperties: false,
    }, async (input, _agent, signal, teamId) => {
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
    });
    add('teamwork_manage', 'Administrator operations on the bound team. createConfig: input {kind, name, data}. updateConfig: input {id, version, kind, name, data}, the whole configuration as configs returned it with the change made, and the version read. deleteConfig and removeMember: input {id}. setBudget: input {scope, subjectId, period, timezone, revision, enabled, notify, points}, with the revision read from budgets (0 for a new budget); its token limits stay unset unless the person asks for one. An enabled budget with any limit refuses every call to a model whose largest possible cost the server cannot bound, today any team model other than the official DeepSeek API: say so, naming the team models it would stop, before asking to set one. restore: input {id} of a history entry. editDraft: input {id, revision, config, baseVersion, note} for a draft of your own. Provider key entry and account creation with passwords use secure console forms.', {
        type: 'object',
        properties: {
            input: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    id: { type: 'string', description: 'The configuration, member, history entry or draft acted on' },
                    version: { type: 'integer', minimum: 1, description: 'updateConfig: the version read from configs' },
                    kind: { type: 'string', enum: ['model', 'preset', 'plugin'] },
                    name: { type: 'string', maxLength: 120 },
                    data: { ...presetData, additionalProperties: true, description: `${presetData.description} A model's data is {provider, model, contextWindow, maxTokens}.` },
                    revision: { type: 'integer', minimum: 0, description: "setBudget: the policy's revision from budgets, 0 for a new one; editDraft: the draft's" },
                    scope: { type: 'string', enum: ['team', 'member', 'default_member', 'provider'], description: 'setBudget: whose spend it limits' },
                    subjectId: { type: 'string', description: "setBudget: a member's user id for member, a provider's name for provider, empty for team and default_member" },
                    period: { type: 'string', enum: ['day', 'month'], description: 'setBudget' },
                    timezone: { type: 'string', description: 'setBudget: IANA name the period follows, e.g. Asia/Shanghai' },
                    enabled: { type: 'boolean', description: 'setBudget' },
                    notify: { type: 'string', enum: ['admins', 'owner', 'both', 'none'], description: 'setBudget: owner and both only for member budgets' },
                    points: { type: ['string', 'null'], description: 'setBudget: the points limit as a decimal string, e.g. "15000"; null for none' },
                },
            },
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
        },
        required: ['action', 'input'],
        additionalProperties: false,
    }, async (input, _agent, signal, teamId) => {
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
        if (['updateConfig', 'deleteConfig', 'removeMember', 'restore', 'editDraft'].includes(data.action) &&
            !z
                .string()
                .regex(/^[A-Za-z0-9_-]{1,32}$/)
                .safeParse(data.input.id).success)
            throw Error('An exact resource id is required');
        if (data.action === 'setBudget' && !('revision' in data.input))
            throw Error('Read the current budget revision first');
        if (data.action === 'setBudget') {
            // The server reads points as a decimal string; a model writes a round limit as a number.
            if (typeof data.input.points === 'number')
                data.input.points = String(data.input.points);
            // Token limits are left out of the schema: a field named input inside input garbles some models' calls.
            data.input = { subjectId: '', input: null, output: null, total: null, ...data.input };
        }
        return {
            teamId,
            result: await client.assistantChange(teamId, data.action, data.input, signal),
        };
    });
    add('teamwork_export_usage', 'Export authorized usage to a private local CSV file. Members export only their own usage; administrators can filter by member, model and time (since, until).', {
        type: 'object',
        properties: { filters: filterSchema },
        additionalProperties: false,
    }, async (input, _agent, signal, teamId) => {
        const data = z.object({ filters: filters.optional() }).strict().parse(input);
        checkFilters('export', data.filters);
        return {
            teamId,
            path: await client.exportUsage(teamId, data.filters ?? {}, signal),
        };
    });
    add('teamwork_new_session', 'Create a new session from a preset of the bound team. Does not start a task or change the existing conversation.', {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
    }, async (input, agent, signal, teamId) => {
        const { id } = z
            .object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/) })
            .strict()
            .parse(input);
        if (!client
            .current()
            ?.teams.find((t) => t.teamId === teamId)
            ?.configs.some((c) => c.id === id && c.kind === 'preset'))
            throw Error('Choose a preset in this team');
        const commands = ctx.get('commands');
        if (!commands)
            throw Error('Host command service is unavailable');
        const result = await commands.execute(agent, `/teamwork new ${id}`, [], signal);
        if (!result)
            throw Error('Host did not handle session creation');
        if (result.result.kind === 'error')
            throw Error(result.result.text);
        return { teamId, result: result.result };
    });
    add('teamwork_install', 'Install and enable an exact published team plugin after explicit host approval. This changes the local DSH profile for all sessions and may execute plugin code. Existing local plugins are protected; upgrades use the local plugin manager.', {
        type: 'object',
        properties: { id: { type: 'string' }, version: { type: 'string' } },
        required: ['id', 'version'],
        additionalProperties: false,
    }, async (input, _agent, _signal, teamId) => {
        const { id, version } = z
            .object({
            id: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
            version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/),
        })
            .strict()
            .parse(input);
        const team = client.current()?.teams.find((t) => t.teamId === teamId);
        if (!team?.configs.some((c) => c.id === id && c.kind === 'plugin') &&
            !team?.pluginVersions?.some((c) => c.configId === id))
            throw Error('Choose a plugin in this team');
        return { teamId, result: await install(id, version) };
    });
    ctx.effect(() => ctx.tools.register({
        name: 'teamwork_query',
        description: "Read the team bound to this preset. status: sign-in and team. sync: refresh this computer's copy of the team configuration. configs: the team's models, presets and plugins with ids and versions. members: the team, the caller's role and the members. usage: a member's own calls, an administrator's whole team; filter a period with since and until. budgets: the budgets that apply. submissions: proposals; an administrator sees the team's, filter state pending for what awaits review. history: published versions. providers: administrators only. Unknown usage is not zero.",
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
                filters: filterSchema,
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
            checkFilters(action, requestedFilters);
            if (!exec.agent)
                throw new Error('A team-bound session is required');
            const bound = preset(exec.agent);
            if (!bound)
                throw new Error('A team-bound preset is required');
            const epoch = client.sessionRevision(), teamId = bound.teamId;
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
            const result = await client.assistantRead(teamId, action, exec.signal, requestedFilters);
            if (preset(exec.agent)?.teamId !== teamId)
                throw new Error('Team changed during operation');
            return { teamId, result };
        },
    }, { when: ({ agent }) => !!preset(agent) }));
}
//# sourceMappingURL=assistant-tools.js.map