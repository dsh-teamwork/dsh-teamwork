import { z } from 'zod';
export declare const snapshotSchema: z.ZodObject<{
    teamId: z.ZodString;
    configs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"model">;
        data: z.ZodObject<{
            provider: z.ZodString;
            model: z.ZodString;
            contextWindow: z.ZodOptional<z.ZodNumber>;
            maxTokens: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        id: z.ZodString;
        name: z.ZodString;
        version: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"preset">;
        data: z.ZodObject<{
            provider: z.ZodOptional<z.ZodString>;
            model: z.ZodOptional<z.ZodString>;
            modelConfigId: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            instructions: z.ZodOptional<z.ZodString>;
            outputDescription: z.ZodOptional<z.ZodString>;
            pluginDependencies: z.ZodOptional<z.ZodArray<z.ZodObject<{
                pluginConfigId: z.ZodString;
                version: z.ZodString;
            }, z.core.$strip>>>;
            requiredTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            optionalTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            systemPrompt: z.ZodDefault<z.ZodString>;
            contextWindow: z.ZodOptional<z.ZodNumber>;
            maxTokens: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        id: z.ZodString;
        name: z.ZodString;
        version: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"plugin">;
        data: z.ZodObject<{
            package: z.ZodString;
            version: z.ZodString;
            providesTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            description: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>;
        id: z.ZodString;
        name: z.ZodString;
        version: z.ZodNumber;
    }, z.core.$strip>], "kind">>;
}, z.core.$strip>;
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
                provider: string;
                model: string;
                contextWindow?: number | undefined;
                maxTokens?: number | undefined;
            };
            id: string;
            name: string;
            version: number;
        } | {
            kind: "preset";
            data: {
                systemPrompt: string;
                provider?: string | undefined;
                model?: string | undefined;
                modelConfigId?: string | undefined;
                description?: string | undefined;
                instructions?: string | undefined;
                outputDescription?: string | undefined;
                pluginDependencies?: {
                    pluginConfigId: string;
                    version: string;
                }[] | undefined;
                requiredTools?: string[] | undefined;
                optionalTools?: string[] | undefined;
                contextWindow?: number | undefined;
                maxTokens?: number | undefined;
            };
            id: string;
            name: string;
            version: number;
        } | {
            kind: "plugin";
            data: {
                package: string;
                version: string;
                description: string;
                providesTools?: string[] | undefined;
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
                provider: string;
                model: string;
                contextWindow?: number | undefined;
                maxTokens?: number | undefined;
            };
            id: string;
            name: string;
            version: number;
        } | {
            kind: "preset";
            data: {
                systemPrompt: string;
                provider?: string | undefined;
                model?: string | undefined;
                modelConfigId?: string | undefined;
                description?: string | undefined;
                instructions?: string | undefined;
                outputDescription?: string | undefined;
                pluginDependencies?: {
                    pluginConfigId: string;
                    version: string;
                }[] | undefined;
                requiredTools?: string[] | undefined;
                optionalTools?: string[] | undefined;
                contextWindow?: number | undefined;
                maxTokens?: number | undefined;
            };
            id: string;
            name: string;
            version: number;
        } | {
            kind: "plugin";
            data: {
                package: string;
                version: string;
                description: string;
                providesTools?: string[] | undefined;
            };
            id: string;
            name: string;
            version: number;
        })[];
    } | undefined>;
    platformCredential(): string;
    sessionRevision(): number;
    authenticated(): boolean;
    current(): {
        teamId: string;
        configs: ({
            kind: "model";
            data: {
                provider: string;
                model: string;
                contextWindow?: number | undefined;
                maxTokens?: number | undefined;
            };
            id: string;
            name: string;
            version: number;
        } | {
            kind: "preset";
            data: {
                systemPrompt: string;
                provider?: string | undefined;
                model?: string | undefined;
                modelConfigId?: string | undefined;
                description?: string | undefined;
                instructions?: string | undefined;
                outputDescription?: string | undefined;
                pluginDependencies?: {
                    pluginConfigId: string;
                    version: string;
                }[] | undefined;
                requiredTools?: string[] | undefined;
                optionalTools?: string[] | undefined;
                contextWindow?: number | undefined;
                maxTokens?: number | undefined;
            };
            id: string;
            name: string;
            version: number;
        } | {
            kind: "plugin";
            data: {
                package: string;
                version: string;
                description: string;
                providesTools?: string[] | undefined;
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
/** References resolve within the current team snapshot only; never fall back to local models. */
export declare function modelData(snapshot: Snapshot, config: TeamConfig): {
    systemPrompt: string;
    provider?: string | undefined;
    model?: string | undefined;
    modelConfigId?: string | undefined;
    description?: string | undefined;
    instructions?: string | undefined;
    outputDescription?: string | undefined;
    pluginDependencies?: {
        pluginConfigId: string;
        version: string;
    }[] | undefined;
    requiredTools?: string[] | undefined;
    optionalTools?: string[] | undefined;
    contextWindow?: number | undefined;
    maxTokens?: number | undefined;
} | {
    provider: string;
    model: string;
    contextWindow?: number | undefined;
    maxTokens?: number | undefined;
} | undefined;
//# sourceMappingURL=client.d.ts.map