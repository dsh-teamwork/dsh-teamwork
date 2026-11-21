import { PiAiAdapter, type ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai';
import type { Context } from '@deepseek-ai/cordis';
import { resolveImageAttachmentAccess, resolveRetryPolicy } from '@deepseek-ai/dsh-llm';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import type { Model } from '@earendil-works/pi-ai';
import type { AdapterRegistrationHandle, LlmAdapter } from '@deepseek-ai/dsh-llm';
import { modelData, type TeamworkClient, type Snapshot } from './client.js';
const prefix = 'teamwork-platform-';
/** Each team is its own provider route, so DSH's model menu groups a team's models under the team's name. */
export const teamProvider = (teamId: string) => prefix + teamId;
export const isTeamProvider = (provider: string | undefined) => !!provider?.startsWith(prefix);
/** Provider credentials never exist here: the adapter authenticates only to platform. */
/** How DSH's model picker heads a team's models: `Teamwork <team>`, apart from the member's own providers. */
export const teamGroupName = (teamName: string) => `Teamwork ${teamName}`;

export function platformAdapter(client: TeamworkClient, ctx?: Context): PiAiAdapter {
  let previous: Snapshot | undefined;
  let profiles = new Map<string, ResolvedPiAiProviderProfile>();
  const api = openAICompletionsApi();
  class TeamworkAdapter extends PiAiAdapter {
    override async listModels(provider: string) {
      const models = await super.listModels(provider);
      const team = client.current()?.teams.find(team => teamProvider(team.teamId) === provider);
      const modelIds = new Set(team?.configs.filter(config => config.kind === 'model').map(config => config.id));
      return models.filter(model => modelIds.has(model.id));
    }
  }
  return new TeamworkAdapter({
    profiles: () => {
      const snapshot = client.current();
      if (snapshot === previous) return profiles;
      previous = snapshot;
      const baseUrl = `${client.endpoint.replace(/\/$/, '')}/api/llm`;
      profiles = new Map((snapshot?.teams ?? []).map(team => {
        const provider = teamProvider(team.teamId);
        // A model without its contextWindow, or one taken offline, is not offered at all (see modelLimitProblem); the
        // plugin says why.
        const models: Model<'openai-completions'>[] = team.configs.flatMap(c => {
          const data = c.kind === 'plugin' ? undefined : modelData(snapshot!, c);
          if (data?.contextWindow === undefined || ('offline' in data && data.offline)) return [];
          return [{
            id: c.id, name: c.name, provider, api: 'openai-completions' as const, baseUrl,
            reasoning: false, input: 'vision' in data && data.vision ? ['text' as const, 'image' as const] : ['text' as const], contextWindow: data.contextWindow, maxTokens: data.maxTokens ?? Math.min(4096, data.contextWindow),
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
        } satisfies ResolvedPiAiProviderProfile] as const;
      }));
      return profiles;
    },
    resolveApiKey: async () => client.platformCredential(),
    resolveAttachments: () => ctx?.get('attachments'),
    resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(
      attachments, hostPath => ctx?.get('fs')?.processPathFromHostPath(hostPath), ref,
    ),
    auth: {
      credentials: { read: async () => undefined, list: async () => [], modify: async () => undefined, delete: async () => {} },
      authContext: { env: async () => undefined, fileExists: async () => false },
    },
  });
}

/**
 * Keeps DSH's routes equal to the synced teams: one per team, replaced as teams are joined or left. DSH refuses an
 * empty first registration, so the first is made once there is a team.
 */
export function teamRoutes(llm: { registerAdapter(providers: string[], adapter: LlmAdapter): AdapterRegistrationHandle }, client: TeamworkClient, adapter: LlmAdapter) {
  let handle: AdapterRegistrationHandle | undefined;
  return {
    sync() {
      const providers = (client.current()?.teams ?? []).map(team => teamProvider(team.teamId));
      if (handle) handle.replace(providers);
      else if (providers.length) handle = llm.registerAdapter(providers, adapter);
    },
    dispose() { handle?.(); handle = undefined; },
  };
}
