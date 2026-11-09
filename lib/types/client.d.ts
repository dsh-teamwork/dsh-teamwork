import { z } from 'zod';
export declare const snapshotSchema: z.ZodObject<{
    teamId: z.ZodString;
    configs: z.ZodArray<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"model">;
        data: z.ZodObject<{
            provider: z.ZodString;
            model: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            model: string;
            provider: string;
        }, {
            model: string;
            provider: string;
        }>;
        id: z.ZodString;
        name: z.ZodString;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "model";
        data: {
            model: string;
            provider: string;
        };
        id: string;
        name: string;
        version: number;
    }, {
        kind: "model";
        data: {
            model: string;
            provider: string;
        };
        id: string;
        name: string;
        version: number;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"preset">;
        data: z.ZodObject<{
            systemPrompt: z.ZodDefault<z.ZodString>;
            provider: z.ZodString;
            model: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            model: string;
            provider: string;
            systemPrompt: string;
        }, {
            model: string;
            provider: string;
            systemPrompt?: string | undefined;
        }>;
        id: z.ZodString;
        name: z.ZodString;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "preset";
        data: {
            model: string;
            provider: string;
            systemPrompt: string;
        };
        id: string;
        name: string;
        version: number;
    }, {
        kind: "preset";
        data: {
            model: string;
            provider: string;
            systemPrompt?: string | undefined;
        };
        id: string;
        name: string;
        version: number;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"plugin">;
        data: z.ZodObject<{
            package: z.ZodString;
            version: z.ZodString;
            description: z.ZodDefault<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            version: string;
            package: string;
            description: string;
        }, {
            version: string;
            package: string;
            description?: string | undefined;
        }>;
        id: z.ZodString;
        name: z.ZodString;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "plugin";
        data: {
            version: string;
            package: string;
            description: string;
        };
        id: string;
        name: string;
        version: number;
    }, {
        kind: "plugin";
        data: {
            version: string;
            package: string;
            description?: string | undefined;
        };
        id: string;
        name: string;
        version: number;
    }>]>, "many">;
}, "strip", z.ZodTypeAny, {
    teamId: string;
    configs: ({
        kind: "model";
        data: {
            model: string;
            provider: string;
        };
        id: string;
        name: string;
        version: number;
    } | {
        kind: "preset";
        data: {
            model: string;
            provider: string;
            systemPrompt: string;
        };
        id: string;
        name: string;
        version: number;
    } | {
        kind: "plugin";
        data: {
            version: string;
            package: string;
            description: string;
        };
        id: string;
        name: string;
        version: number;
    })[];
}, {
    teamId: string;
    configs: ({
        kind: "model";
        data: {
            model: string;
            provider: string;
        };
        id: string;
        name: string;
        version: number;
    } | {
        kind: "preset";
        data: {
            model: string;
            provider: string;
            systemPrompt?: string | undefined;
        };
        id: string;
        name: string;
        version: number;
    } | {
        kind: "plugin";
        data: {
            version: string;
            package: string;
            description?: string | undefined;
        };
        id: string;
        name: string;
        version: number;
    })[];
}>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type TeamConfig = Snapshot['configs'][number];
export declare class TeamworkClient {
    readonly endpoint: string;
    readonly cachePath: string;
    private request;
    private token?;
    private verifier?;
    private snapshot?;
    private epoch;
    private operations;
    private enqueue;
    constructor(endpoint: string, cachePath: string, request?: typeof fetch);
    beginLogin(): string;
    completeLogin(code: string): Promise<void>;
    private api;
    sync(): Promise<{
        teamId: string;
        configs: ({
            kind: "model";
            data: {
                model: string;
                provider: string;
            };
            id: string;
            name: string;
            version: number;
        } | {
            kind: "preset";
            data: {
                model: string;
                provider: string;
                systemPrompt: string;
            };
            id: string;
            name: string;
            version: number;
        } | {
            kind: "plugin";
            data: {
                version: string;
                package: string;
                description: string;
            };
            id: string;
            name: string;
            version: number;
        })[];
    }>;
    private syncOnce;
    restore(): Promise<{
        teamId: string;
        configs: ({
            kind: "model";
            data: {
                model: string;
                provider: string;
            };
            id: string;
            name: string;
            version: number;
        } | {
            kind: "preset";
            data: {
                model: string;
                provider: string;
                systemPrompt: string;
            };
            id: string;
            name: string;
            version: number;
        } | {
            kind: "plugin";
            data: {
                version: string;
                package: string;
                description: string;
            };
            id: string;
            name: string;
            version: number;
        })[];
    } | undefined>;
    current(): {
        teamId: string;
        configs: ({
            kind: "model";
            data: {
                model: string;
                provider: string;
            };
            id: string;
            name: string;
            version: number;
        } | {
            kind: "preset";
            data: {
                model: string;
                provider: string;
                systemPrompt: string;
            };
            id: string;
            name: string;
            version: number;
        } | {
            kind: "plugin";
            data: {
                version: string;
                package: string;
                description: string;
            };
            id: string;
            name: string;
            version: number;
        })[];
    } | undefined;
    clear(): Promise<void>;
    logout(): Promise<void>;
    private logoutOnce;
}
/** Reconcile only registrations owned by this plugin. The host's local registry is never enumerated or mutated. */
export declare class TeamOverlay {
    private register;
    private owned;
    constructor(register: (id: string, config: TeamConfig) => Promise<() => Promise<void>>);
    private operations;
    apply(snapshot?: Snapshot): Promise<void>;
    private reconcile;
}
//# sourceMappingURL=client.d.ts.map