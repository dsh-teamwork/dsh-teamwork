import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai';
import { resolveImageAttachmentAccess, resolveRetryPolicy } from '@deepseek-ai/dsh-llm';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { modelData } from './client.js';
const prefix = 'teamwork-platform-';
/** Each team is its own provider route, so DSH's model menu groups a team's models under the team's name. */
export const teamProvider = (teamId) => prefix + teamId;
export const isTeamProvider = (provider) => !!provider?.startsWith(prefix);
/** Provider credentials never exist here: the adapter authenticates only to platform. */
/** How DSH's model picker heads a team's models: `Teamwork <team>`, apart from the member's own providers. */
export const teamGroupName = (teamName) => `Teamwork ${teamName}`;
export function platformAdapter(client, ctx) {
    let previous;
    let profiles = new Map();
    const api = openAICompletionsApi();
    class TeamworkAdapter extends PiAiAdapter {
        async listModels(provider) {
            const models = await super.listModels(provider);
            const team = client.current()?.teams.find(team => teamProvider(team.teamId) === provider);
            const configs = new Map(team?.configs.flatMap(config => config.kind === 'model' ? [[config.id, config.data.model]] : []));
            // A team model's id is its configuration's, which names nothing a person recognises; the model it calls does.
            // DSH, the console and the phone show it under the name (relay-client's modelDetail).
            return models.filter(model => configs.has(model.id)).map(model => ({ ...model, description: configs.get(model.id) }));
        }
    }
    return new TeamworkAdapter({
        profiles: () => {
            const snapshot = client.current();
            if (snapshot === previous)
                return profiles;
            previous = snapshot;
            const baseUrl = `${client.endpoint.replace(/\/$/, '')}/api/llm`;
            profiles = new Map((snapshot?.teams ?? []).map(team => {
                const provider = teamProvider(team.teamId);
                // A model without its contextWindow, or one taken offline, is not offered at all (see modelLimitProblem); the
                // plugin says why.
                const models = team.configs.flatMap(c => {
                    const data = c.kind === 'plugin' ? undefined : modelData(snapshot, c);
                    if (data?.contextWindow === undefined || ('offline' in data && data.offline))
                        return [];
                    const efforts = 'reasoningEfforts' in data ? data.reasoningEfforts ?? [] : [];
                    const thinkingLevelMap = {
                        off: null,
                        minimal: efforts.includes('minimal') ? 'minimal' : null,
                        low: efforts.includes('low') ? 'low' : null,
                        medium: efforts.includes('medium') ? 'medium' : null,
                        high: efforts.includes('high') ? 'high' : null,
                        xhigh: efforts.includes('xhigh') ? 'xhigh' : null,
                        max: efforts.includes('max') ? 'max' : null,
                    };
                    // The gateway hides the upstream, so pi-ai cannot detect its dialect: send the plain
                    // OpenAI reasoning_effort (the gateway translates it) and a system role every upstream
                    // accepts. Without efforts, `reasoning: false` keeps the effort out of the request.
                    return [{
                            id: c.id, name: c.name, provider, api: 'openai-completions', baseUrl,
                            reasoning: efforts.length > 0, thinkingLevelMap, compat: { supportsDeveloperRole: false, supportsReasoningEffort: true, thinkingFormat: 'openai' }, input: 'vision' in data && data.vision ? ['text', 'image'] : ['text'], contextWindow: data.contextWindow, maxTokens: data.maxTokens ?? Math.min(4096, data.contextWindow),
                            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                        }];
                });
                return [provider, {
                        provider, displayName: teamGroupName(team.teamName), api: 'openai-completions', baseURL: baseUrl,
                        streamIdleTimeoutMs: 120000, maxRequestImageBytes: 1048576, maxRequestImages: 1,
                        imageOffloadCountQuantum: 1, requestImagePixelBudget: 1048576, requestImageMaxBytes: 1048576,
                        retryPolicy: resolveRetryPolicy({ mode: 'normal', maxRetries: 0 }, provider), modelErrors: new Map(), configuredMaxTokens: new Map(models.map(m => [m.id, m.maxTokens])),
                        piProvider: { id: provider, name: teamGroupName(team.teamName), baseUrl,
                            auth: { apiKey: { name: 'Platform session', resolve: async ({ credential }) => ({ auth: { apiKey: credential?.key }, source: 'Platform session' }) } },
                            // Preset IDs remain resolvable for active and saved sessions.
                            getModels: () => models,
                            stream: (model, context, options) => api.stream(model, context, options),
                            streamSimple: (model, context, options) => api.streamSimple(model, context, options),
                        },
                    }];
            }));
            return profiles;
        },
        resolveApiKey: async () => client.platformCredential(),
        resolveAttachments: () => ctx?.get('attachments'),
        resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(attachments, hostPath => ctx?.get('fs')?.processPathFromHostPath(hostPath), ref),
        auth: {
            credentials: { read: async () => undefined, list: async () => [], modify: async () => undefined, delete: async () => { } },
            authContext: { env: async () => undefined, fileExists: async () => false },
        },
    });
}
/**
 * Keeps DSH's routes equal to the synced teams: one per team, replaced as teams are joined or left. DSH refuses an
 * empty first registration, so the first is made once there is a team.
 */
export function teamRoutes(llm, client, adapter) {
    let handle;
    return {
        sync() {
            const providers = (client.current()?.teams ?? []).map(team => teamProvider(team.teamId));
            if (handle)
                handle.replace(providers);
            else if (providers.length)
                handle = llm.registerAdapter(providers, adapter);
        },
        dispose() { handle?.(); handle = undefined; },
    };
}
//# sourceMappingURL=platform-models.js.map