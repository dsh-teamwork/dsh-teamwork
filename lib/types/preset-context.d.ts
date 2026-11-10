import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export interface PresetContext {
    teamId: string;
    id: string;
    name: string;
    version: number;
    modelConfigId?: string;
    description: string;
    instructions: string;
    outputDescription: string;
    systemPrompt: string;
    pluginDependencies?: {
        pluginConfigId: string;
        version: string;
    }[];
    requiredTools: string[];
    optionalTools: string[];
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        teamworkPreset: PresetContext;
    }
}
export declare const inject: string[];
export declare const Config: z<PresetContext>;
/** Metadata and literal prompt live in the same native preset generation. */
export declare function apply(ctx: Context, config: PresetContext): void;
//# sourceMappingURL=preset-context.d.ts.map