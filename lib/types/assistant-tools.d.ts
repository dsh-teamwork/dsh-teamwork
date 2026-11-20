import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { PresetContext } from './preset-context.js';
import type { TeamworkClient } from './client.js';
/** Refuses a filter the action's route would silently ignore, naming the ones it takes. */
export declare function checkFilters(action: string, given: Record<string, string> | undefined): void;
/** The server is authoritative for access; the active preset fixes the destination. */
export declare function registerAssistantTools(ctx: Context, client: TeamworkClient, preset: (agent: Agent) => PresetContext | undefined, sync: () => Promise<unknown>, install: (id: string, version: string) => Promise<string>): void;
//# sourceMappingURL=assistant-tools.d.ts.map