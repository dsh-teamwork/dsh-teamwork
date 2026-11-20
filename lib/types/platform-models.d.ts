import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai';
import type { AdapterRegistrationHandle, LlmAdapter } from '@deepseek-ai/dsh-llm';
import { type TeamworkClient } from './client.js';
/** Each team is its own provider route, so DSH's model menu groups a team's models under the team's name. */
export declare const teamProvider: (teamId: string) => string;
export declare const isTeamProvider: (provider: string | undefined) => boolean;
/** Provider credentials never exist here: the adapter authenticates only to platform. */
/** How DSH's model picker heads a team's models: `Teamwork <team>`, apart from the member's own providers. */
export declare const teamGroupName: (teamName: string) => string;
export declare function platformAdapter(client: TeamworkClient): PiAiAdapter;
/**
 * Keeps DSH's routes equal to the synced teams: one per team, replaced as teams are joined or left. DSH refuses an
 * empty first registration, so the first is made once there is a team.
 */
export declare function teamRoutes(llm: {
    registerAdapter(providers: string[], adapter: LlmAdapter): AdapterRegistrationHandle;
}, client: TeamworkClient, adapter: LlmAdapter): {
    sync(): void;
    dispose(): void;
};
//# sourceMappingURL=platform-models.d.ts.map