/**
 * A session's permission preset as a phone or the console sees and switches it (DSH's own `/permission`, from
 * `@deepseek-ai/dsh-permission-presets`): the presets DSH offers, the session's current one, and which of them a
 * remote device may pick. A preset that leaves the workspace's sandbox or skips approval is `risky`: a client confirms
 * it once.
 */
/** What the plugin reads of DSH's `permissionPresets` service. */
export interface PermissionPresets {
    catalog(): {
        options: {
            value: string;
            name: string;
            description?: string;
        }[];
        defaultPreset: string;
    };
    current(session: unknown): string;
    resolve(name: string): {
        sandbox: string;
        approval: string;
    };
}
export interface PhonePermissions {
    /** The session's preset, or `custom` when its settings match none; null for a session not started yet. */
    current: string | null;
    /** The preset a new session starts with. */
    defaultPreset: string;
    options: {
        id: string;
        name: string;
        description?: string;
        risky: boolean;
    }[];
}
/** A preset name as `/permission` takes it: one word, so nothing more can ride on the command line. */
export declare const PRESET_NAME: RegExp;
export declare function riskyPreset(presets: PermissionPresets, name: string): boolean;
export declare function phonePermissions(presets: PermissionPresets, session?: unknown): PhonePermissions;
//# sourceMappingURL=phone-permission.d.ts.map