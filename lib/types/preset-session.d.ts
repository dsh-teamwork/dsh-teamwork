import { z } from 'zod/v4';
import type { PresetContext } from './preset-context.js';
declare const schema: z.ZodNullable<z.ZodObject<{
    teamId: z.ZodString;
    id: z.ZodString;
    version: z.ZodNumber;
}, z.core.$strip>>;
export type PresetStamp = z.infer<typeof schema>;
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        'teamwork/preset': {
            teamId: string;
            id: string;
            version: number;
        };
    }
}
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionMap {
        teamworkPreset: PresetStamp;
    }
}
export declare const presetProjection: {
    key: "teamworkPreset";
    stateSchema: z.ZodNullable<z.ZodObject<{
        teamId: z.ZodString;
        id: z.ZodString;
        version: z.ZodNumber;
    }, z.core.$strip>>;
    init: () => null;
    apply: (state: NoInfer<{
        teamId: string;
        id: string;
        version: number;
    } | null>, event: import("@deepseek-ai/dsh-session").SessionEvent) => {
        teamId: string;
        id: string;
        version: number;
    } | null;
    wire: {
        viewSchema: z.ZodNullable<z.ZodObject<{
            teamId: z.ZodString;
            id: z.ZodString;
            version: z.ZodNumber;
        }, z.core.$strip>>;
        view: (state: NoInfer<{
            teamId: string;
            id: string;
            version: number;
        } | null>) => {
            teamId: string;
            id: string;
            version: number;
        } | null;
    };
    stateVersion: number;
};
export declare function sameRevision(stamp: PresetStamp, current: PresetContext): boolean;
export declare function toolReport(preset: Pick<PresetContext, 'requiredTools' | 'optionalTools'>, lookup: (name: string) => 'available' | 'conditional' | 'missing' | 'unknown'): {
    state: "unknown" | "available" | "conditional" | "missing";
    name: string;
    required: boolean;
}[];
export declare function assertBlank(boundary: {
    openTurnStartSeq: unknown;
    lastTurn: number;
}): void;
export {};
//# sourceMappingURL=preset-session.d.ts.map