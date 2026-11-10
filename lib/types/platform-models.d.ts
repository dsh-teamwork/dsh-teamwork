import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai';
import { type TeamworkClient } from './client.js';
export declare const platformProvider = "teamwork-platform";
/** Provider credentials never exist here: the adapter authenticates only to platform. */
export declare function platformAdapter(client: TeamworkClient): PiAiAdapter;
//# sourceMappingURL=platform-models.d.ts.map