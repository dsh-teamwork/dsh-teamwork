import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai';
import { resolveRetryPolicy } from '@deepseek-ai/dsh-llm';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { allConfigs, modelData } from './client.js';
export const platformProvider = 'teamwork-platform';
/** Provider credentials never exist here: the adapter authenticates only to platform. */
export function platformAdapter(client) {
    let previous;
    let profiles = new Map();
    const api = openAICompletionsApi();
    return new PiAiAdapter({
        profiles: () => {
            const snapshot = client.current();
            if (snapshot === previous)
                return profiles;
            previous = snapshot;
            const baseUrl = `${client.endpoint.replace(/\/$/, '')}/api/llm`;
            const models = allConfigs(snapshot).filter(c => c.kind !== 'plugin' && modelData(snapshot, c)).map(c => {
                const data = modelData(snapshot, c);
                return ({
                    id: c.id, name: c.name, provider: platformProvider, api: 'openai-completions', baseUrl,
                    reasoning: false, input: ['text'], contextWindow: data.contextWindow ?? Math.max(32768, data.maxTokens ?? 0), maxTokens: data.maxTokens ?? Math.min(4096, data.contextWindow ?? 32768),
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                });
            });
            profiles = new Map([[platformProvider, {
                        provider: platformProvider, displayName: 'Teamwork Platform', api: 'openai-completions', baseURL: baseUrl,
                        streamIdleTimeoutMs: 120000, maxRequestImageBytes: 1048576, maxRequestImages: 1,
                        imageOffloadCountQuantum: 1, requestImagePixelBudget: 1048576, requestImageMaxBytes: 1048576,
                        retryPolicy: resolveRetryPolicy({ mode: 'normal', maxRetries: 0 }, 'teamwork-platform'), modelErrors: new Map(), configuredMaxTokens: new Map(models.map(m => [m.id, m.maxTokens])),
                        piProvider: { id: platformProvider, name: 'Teamwork Platform', baseUrl,
                            auth: { apiKey: { name: 'Platform session', resolve: async ({ credential }) => ({ auth: { apiKey: credential?.key }, source: 'Platform session' }) } },
                            getModels: () => models,
                            stream: (model, context, options) => api.stream(model, context, options),
                            streamSimple: (model, context, options) => api.streamSimple(model, context, options),
                        },
                    }]]);
            return profiles;
        },
        resolveApiKey: async () => client.platformCredential(),
        auth: {
            credentials: { read: async () => undefined, list: async () => [], modify: async () => undefined, delete: async () => { } },
            authContext: { env: async () => undefined, fileExists: async () => false },
        },
    });
}
//# sourceMappingURL=platform-models.js.map