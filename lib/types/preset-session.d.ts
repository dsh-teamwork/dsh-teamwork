import { z } from 'zod/v4';
import type { PresetContext } from './preset-context.js';
declare const stampSchema: z.ZodObject<{
    teamId: z.ZodString;
    id: z.ZodString;
    version: z.ZodNumber;
}, z.core.$strip>;
export type PresetStamp = z.infer<typeof stampSchema> | null;
/**
 * The team preset revision each session started on, so a resumed session whose
 * preset has since changed is stopped instead of silently running the new one.
 *
 * Kept in a file of the plugin's own, beside the configuration cache, and not in
 * the session log: DSH refuses to reopen a session whose log holds an event type
 * it does not know, and a third-party plugin cannot write the ignorable records it
 * accepts. A fork is a new session id, so it starts without a stamp and takes the
 * revision it first runs on.
 */
export declare class PresetStamps {
    readonly path: string;
    private stamps;
    private writes;
    constructor(path: string);
    /** Reads the file; a missing or unreadable one starts empty, since a lost stamp is retaken on the next request. */
    load(): Promise<void>;
    get(sessionId: string): PresetStamp;
    set(sessionId: string, preset: Pick<PresetContext, 'teamId' | 'id' | 'version'>): Promise<void>;
    clear(sessionId: string): Promise<void>;
    /** Writes are serialized and atomic, with the same 0600 file mode as the configuration cache. */
    private save;
}
/** The stamp file sits beside the configuration cache: `teamwork-cache.json` → `teamwork-cache.sessions.json`. */
export declare function presetStampPath(cachePath: string): string;
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