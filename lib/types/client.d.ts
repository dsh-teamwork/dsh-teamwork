import { z } from 'zod';
import type { PanelProfile, PanelSummary, PanelTeamUsage } from './panel.js';
import type { Locale } from './locale.js';
/** `GET /api/configs`: every team the member is in, each with its configuration (platform ADR 0013). */
export declare const snapshotSchema: z.ZodObject<{
    teams: z.ZodArray<z.ZodObject<{
        teamId: z.ZodString;
        teamName: z.ZodString;
        role: z.ZodEnum<{
            admin: "admin";
            member: "member";
        }>;
        pluginVersions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            configId: z.ZodString;
            name: z.ZodString;
            data: z.ZodObject<{
                packageId: z.ZodOptional<z.ZodString>;
                sha256: z.ZodOptional<z.ZodString>;
                package: z.ZodString;
                version: z.ZodString;
                providesTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
                description: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>;
        }, z.core.$strip>>>;
        configs: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"model">;
            data: z.ZodObject<{
                vision: z.ZodOptional<z.ZodBoolean>;
                reasoningEfforts: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    minimal: "minimal";
                    low: "low";
                    medium: "medium";
                    high: "high";
                    xhigh: "xhigh";
                    max: "max";
                }>>>;
                offline: z.ZodOptional<z.ZodBoolean>;
                provider: z.ZodString;
                model: z.ZodString;
                contextWindow: z.ZodOptional<z.ZodNumber>;
                maxTokens: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
            builtin: z.ZodOptional<z.ZodLiteral<"team-assistant">>;
            id: z.ZodString;
            name: z.ZodString;
            version: z.ZodNumber;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"preset">;
            data: z.ZodObject<{
                inheritModel: z.ZodOptional<z.ZodBoolean>;
                provider: z.ZodOptional<z.ZodString>;
                model: z.ZodOptional<z.ZodString>;
                modelConfigId: z.ZodOptional<z.ZodString>;
                avatar: z.ZodOptional<z.ZodString>;
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
            builtin: z.ZodOptional<z.ZodLiteral<"team-assistant">>;
            id: z.ZodString;
            name: z.ZodString;
            version: z.ZodNumber;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"plugin">;
            data: z.ZodObject<{
                packageId: z.ZodOptional<z.ZodString>;
                sha256: z.ZodOptional<z.ZodString>;
                package: z.ZodString;
                version: z.ZodString;
                providesTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
                description: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>;
            builtin: z.ZodOptional<z.ZodLiteral<"team-assistant">>;
            id: z.ZodString;
            name: z.ZodString;
            version: z.ZodNumber;
        }, z.core.$strip>], "kind">>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type TeamSnapshot = Snapshot['teams'][number];
export type TeamConfig = TeamSnapshot['configs'][number];
/** Every team's configuration in one list. Ids are the server's primary keys, so they are unique across teams. */
export declare const allConfigs: (snapshot?: Snapshot) => TeamConfig[];
export declare const findConfig: (snapshot: Snapshot | undefined, id: string) => {
    kind: "model";
    data: {
        provider: string;
        model: string;
        vision?: boolean | undefined;
        reasoningEfforts?: ("minimal" | "low" | "medium" | "high" | "xhigh" | "max")[] | undefined;
        offline?: boolean | undefined;
        contextWindow?: number | undefined;
        maxTokens?: number | undefined;
    };
    id: string;
    name: string;
    version: number;
    builtin?: "team-assistant" | undefined;
} | {
    kind: "preset";
    data: {
        systemPrompt: string;
        inheritModel?: boolean | undefined;
        provider?: string | undefined;
        model?: string | undefined;
        modelConfigId?: string | undefined;
        avatar?: string | undefined;
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
    builtin?: "team-assistant" | undefined;
} | {
    kind: "plugin";
    data: {
        package: string;
        version: string;
        description: string;
        packageId?: string | undefined;
        sha256?: string | undefined;
        providesTools?: string[] | undefined;
    };
    id: string;
    name: string;
    version: number;
    builtin?: "team-assistant" | undefined;
} | undefined;
/** The team a configuration belongs to. */
export declare const teamOf: (snapshot: Snapshot | undefined, configId: string) => {
    teamId: string;
    teamName: string;
    role: "admin" | "member";
    configs: ({
        kind: "model";
        data: {
            provider: string;
            model: string;
            vision?: boolean | undefined;
            reasoningEfforts?: ("minimal" | "low" | "medium" | "high" | "xhigh" | "max")[] | undefined;
            offline?: boolean | undefined;
            contextWindow?: number | undefined;
            maxTokens?: number | undefined;
        };
        id: string;
        name: string;
        version: number;
        builtin?: "team-assistant" | undefined;
    } | {
        kind: "preset";
        data: {
            systemPrompt: string;
            inheritModel?: boolean | undefined;
            provider?: string | undefined;
            model?: string | undefined;
            modelConfigId?: string | undefined;
            avatar?: string | undefined;
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
        builtin?: "team-assistant" | undefined;
    } | {
        kind: "plugin";
        data: {
            package: string;
            version: string;
            description: string;
            packageId?: string | undefined;
            sha256?: string | undefined;
            providesTools?: string[] | undefined;
        };
        id: string;
        name: string;
        version: number;
        builtin?: "team-assistant" | undefined;
    })[];
    pluginVersions?: {
        configId: string;
        name: string;
        data: {
            package: string;
            version: string;
            description: string;
            packageId?: string | undefined;
            sha256?: string | undefined;
            providesTools?: string[] | undefined;
        };
    }[] | undefined;
} | undefined;
/**
 * A server address as the plugin stores and calls it: https anywhere, plain http only on
 * this machine, no query or fragment, no trailing slash. Throws a message for the member.
 */
export declare function serverAddress(input: string): string;
/** An artifact the server refused: its status, code (`artifact_stale`, `artifact_too_large`, …) and what it said was wrong. */
export declare class ArtifactError extends Error {
    readonly status: number;
    readonly code: string;
    readonly detail: string;
    constructor(status: number, code: string, detail: string);
}
export declare class TeamworkClient {
    readonly cachePath: string;
    private request;
    private token?;
    private verifier?;
    private snapshot?;
    private epoch;
    private operations;
    private enqueue;
    private server;
    constructor(endpoint: string, cachePath: string, request?: typeof fetch);
    /** The DSH Teamwork server this client signs in to and syncs from. */
    get endpoint(): string;
    /**
     * Points the client at another server. A token and a team belong to one server, so
     * this signs out and drops the cached configuration, as `logout` does.
     */
    setEndpoint(endpoint: string): Promise<void>;
    /**
     * Where the sign-in is kept across restarts (platform ADR 0060): the token and the server it belongs to, beside the
     * cache and readable by this user alone. The server can revoke it, and it lapses after 30 days unused.
     */
    get tokenPath(): string;
    private saveToken;
    private forgetToken;
    /** Best effort: a token the server is not told about still lapses after 30 days unused. */
    private revoke;
    /** The sign-in page's address; with `redirectUri`, the page sends the code there instead of showing it. */
    beginLogin(redirectUri?: string): string;
    /** Takes the code alone or the whole `/teamwork authorize <code>` line the sign-in page shows, so the panel accepts what was copied. */
    completeLogin(pasted: string): Promise<void>;
    private api;
    downloadPackage(teamId: string, id: string, digest: string): Promise<string>;
    /**
     * Publishes an artifact (docs/tech/artifacts.md in the platform repository): a new one, or a version on top of
     * `baseVersion`. `files` are paths within the artifact and their bytes; the server holds every rule and limit, and says which broke.
     */
    publishArtifact(teamId: string, input: {
        artifactId?: string;
        title?: string;
        kind: 'html' | 'svg';
        note: string;
        sessionId: string;
        computer: string;
        baseVersion?: number;
    }, files: {
        path: string;
        bytes: Uint8Array;
    }[], signal: AbortSignal): Promise<{
        id: string;
        teamId: string;
        version: number;
        title: string;
        kind: "html" | "svg";
    }>;
    /**
     * Whether the signed-in server searches the web for its members (the hosted service does, on its own key; a
     * self-hosted server has no such route): true, false, or undefined when the server could not be asked.
     */
    webSearchOffered(signal?: AbortSignal): Promise<boolean | undefined>;
    /** One web search through the signed-in server; only the query and the count leave this computer. */
    webSearch(query: string, count: number | undefined, signal?: AbortSignal): Promise<{
        url: string;
        title?: string | undefined;
        snippet?: string | undefined;
        summary?: string | undefined;
        publishedAt?: string | undefined;
    }[]>;
    /** The files of an artifact's version, fetched through a view address minted for this member, as the console's frame fetches them. */
    readArtifact(teamId: string, artifactId: string, version: number, signal: AbortSignal): Promise<{
        path: string;
        bytes: Uint8Array;
    }[]>;
    submitPlugin(teamId: string, bytes: Buffer, sha256: string, input: {
        name: string;
        note: string;
        configId?: string;
        baseVersion: number;
    }, signal: AbortSignal): Promise<unknown>;
    assistantChange(teamId: string, action: string, input: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
    reviewPreview(teamId: string, id: string, signal: AbortSignal): Promise<{
        revision: number;
        proposal: unknown;
        configId: string;
        baseVersion: number;
    }>;
    exportUsage(teamId: string, filters: Record<string, string>, signal: AbortSignal): Promise<string>;
    /** Narrow team operations; credentials never enter model-visible results. */
    assistantRead(teamId: string, action: 'configs' | 'usage' | 'budgets' | 'members' | 'submissions' | 'history' | 'providers', signal: AbortSignal, filters?: Record<string, string>): Promise<any>;
    sync(): Promise<{
        teams: {
            teamId: string;
            teamName: string;
            role: "admin" | "member";
            configs: ({
                kind: "model";
                data: {
                    provider: string;
                    model: string;
                    vision?: boolean | undefined;
                    reasoningEfforts?: ("minimal" | "low" | "medium" | "high" | "xhigh" | "max")[] | undefined;
                    offline?: boolean | undefined;
                    contextWindow?: number | undefined;
                    maxTokens?: number | undefined;
                };
                id: string;
                name: string;
                version: number;
                builtin?: "team-assistant" | undefined;
            } | {
                kind: "preset";
                data: {
                    systemPrompt: string;
                    inheritModel?: boolean | undefined;
                    provider?: string | undefined;
                    model?: string | undefined;
                    modelConfigId?: string | undefined;
                    avatar?: string | undefined;
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
                builtin?: "team-assistant" | undefined;
            } | {
                kind: "plugin";
                data: {
                    package: string;
                    version: string;
                    description: string;
                    packageId?: string | undefined;
                    sha256?: string | undefined;
                    providesTools?: string[] | undefined;
                };
                id: string;
                name: string;
                version: number;
                builtin?: "team-assistant" | undefined;
            })[];
            pluginVersions?: {
                configId: string;
                name: string;
                data: {
                    package: string;
                    version: string;
                    description: string;
                    packageId?: string | undefined;
                    sha256?: string | undefined;
                    providesTools?: string[] | undefined;
                };
            }[] | undefined;
        }[];
    }>;
    private syncOnce;
    /** The cached configuration, and the sign-in kept for this server, as the last run left them. */
    restore(): Promise<{
        teams: {
            teamId: string;
            teamName: string;
            role: "admin" | "member";
            configs: ({
                kind: "model";
                data: {
                    provider: string;
                    model: string;
                    vision?: boolean | undefined;
                    reasoningEfforts?: ("minimal" | "low" | "medium" | "high" | "xhigh" | "max")[] | undefined;
                    offline?: boolean | undefined;
                    contextWindow?: number | undefined;
                    maxTokens?: number | undefined;
                };
                id: string;
                name: string;
                version: number;
                builtin?: "team-assistant" | undefined;
            } | {
                kind: "preset";
                data: {
                    systemPrompt: string;
                    inheritModel?: boolean | undefined;
                    provider?: string | undefined;
                    model?: string | undefined;
                    modelConfigId?: string | undefined;
                    avatar?: string | undefined;
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
                builtin?: "team-assistant" | undefined;
            } | {
                kind: "plugin";
                data: {
                    package: string;
                    version: string;
                    description: string;
                    packageId?: string | undefined;
                    sha256?: string | undefined;
                    providesTools?: string[] | undefined;
                };
                id: string;
                name: string;
                version: number;
                builtin?: "team-assistant" | undefined;
            })[];
            pluginVersions?: {
                configId: string;
                name: string;
                data: {
                    package: string;
                    version: string;
                    description: string;
                    packageId?: string | undefined;
                    sha256?: string | undefined;
                    providesTools?: string[] | undefined;
                };
            }[] | undefined;
        }[];
    } | undefined>;
    platformCredential(): string;
    sessionRevision(): number;
    authenticated(): boolean;
    /** Independent of configuration sync: only the member's own budget and a count of reviews leave the host. */
    summary(teamId: string): Promise<PanelSummary>;
    /** The member's own last 30 days in one team, for its settings page; dropped if the account changed meanwhile. */
    teamUsage(teamId: string): Promise<PanelTeamUsage>;
    profile(): Promise<PanelProfile>;
    updateProfile(input: {
        name?: string | null;
        locale: Locale;
    }): Promise<PanelProfile>;
    current(): {
        teams: {
            teamId: string;
            teamName: string;
            role: "admin" | "member";
            configs: ({
                kind: "model";
                data: {
                    provider: string;
                    model: string;
                    vision?: boolean | undefined;
                    reasoningEfforts?: ("minimal" | "low" | "medium" | "high" | "xhigh" | "max")[] | undefined;
                    offline?: boolean | undefined;
                    contextWindow?: number | undefined;
                    maxTokens?: number | undefined;
                };
                id: string;
                name: string;
                version: number;
                builtin?: "team-assistant" | undefined;
            } | {
                kind: "preset";
                data: {
                    systemPrompt: string;
                    inheritModel?: boolean | undefined;
                    provider?: string | undefined;
                    model?: string | undefined;
                    modelConfigId?: string | undefined;
                    avatar?: string | undefined;
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
                builtin?: "team-assistant" | undefined;
            } | {
                kind: "plugin";
                data: {
                    package: string;
                    version: string;
                    description: string;
                    packageId?: string | undefined;
                    sha256?: string | undefined;
                    providesTools?: string[] | undefined;
                };
                id: string;
                name: string;
                version: number;
                builtin?: "team-assistant" | undefined;
            })[];
            pluginVersions?: {
                configId: string;
                name: string;
                data: {
                    package: string;
                    version: string;
                    description: string;
                    packageId?: string | undefined;
                    sha256?: string | undefined;
                    providesTools?: string[] | undefined;
                };
            }[] | undefined;
        }[];
    } | undefined;
    /**
     * Takes a token the host's supervisor provides instead of a browser sign-in (`tokenFile`, docs/development.md).
     * Replacing one token with another keeps the session revision, since short-lived tokens are renewed for the
     * same computer; signing in from none, or out to none, moves it and drops the cached configuration on the way out.
     */
    useToken(token: string | undefined): Promise<void>;
    clear(): Promise<void>;
    logout(): Promise<void>;
    /** Forgets the token here and revokes it at the server that issued it, so a copy of it opens nothing either. */
    private logoutOnce;
}
/**
 * Reconcile only registrations owned by this plugin, for every team at once. The host's local registry is never
 * enumerated or mutated. A registration is `team:<teamId>:<configId>`, and a team's new name re-registers its entries.
 * Only presets are registered: a team model is already in the model picker through `platformAdapter`, and an
 * empty preset that only selected it listed every model a second time in the mode menu.
 */
export declare class TeamOverlay {
    private register;
    private teams;
    private owned;
    /** `teams` runs first on every apply, with the teams as synced: the plugin keeps one model provider per team there. */
    constructor(register: (id: string, preset: Extract<TeamConfig, {
        kind: 'preset';
    }>, team: TeamSnapshot) => Promise<() => Promise<void>>, teams: () => void);
    private operations;
    apply(snapshot?: Snapshot): Promise<void>;
    private reconcile;
}
export declare function pinnedPlugin(snapshot: Snapshot | undefined, id: string, version: string): Extract<TeamConfig, {
    kind: 'plugin';
}> | undefined;
export declare const inheritsModel: (config: TeamConfig) => boolean;
/** References resolve within the configuration's own team only; never across teams, never to local models. */
export declare function modelData(snapshot: Snapshot, config: TeamConfig): {
    systemPrompt: string;
    inheritModel?: boolean | undefined;
    provider?: string | undefined;
    model?: string | undefined;
    modelConfigId?: string | undefined;
    avatar?: string | undefined;
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
    vision?: boolean | undefined;
    reasoningEfforts?: ("minimal" | "low" | "medium" | "high" | "xhigh" | "max")[] | undefined;
    offline?: boolean | undefined;
    contextWindow?: number | undefined;
    maxTokens?: number | undefined;
} | undefined;
/**
 * The name of the team model, or of the model a preset calls, that cannot run here. Without its `contextWindow`
 * the adapter cannot size it: a guessed window either overstates the model or leaves the host's
 * compaction, which reserves its headroom out of the window, no room at all. Nothing is guessed;
 * the model stays unusable until the team configures the real window.
 */
export declare function unsizedModel(snapshot: Snapshot, config: TeamConfig): string | undefined;
/**
 * The name of the hosted model, or of the one a preset calls, that its service has taken out of service (`offline`):
 * offered to no session until it is back, when the team's configuration still names it.
 */
export declare function offlineModel(snapshot: Snapshot, config: TeamConfig): string | undefined;
/** Why a team model, or the model a preset calls, cannot run here, as the member reads it; the panel words its own. */
export declare function modelLimitProblem(snapshot: Snapshot, config: TeamConfig): string | undefined;
/**
 * The server the member picked in the panel, kept beside the configuration cache
 * (`teamwork-cache.json` → `teamwork-cache.server.json`). Absent, the profile's
 * `apiEndpoint` applies, which defaults to the hosted service.
 */
export declare class ServerChoice {
    readonly path: string;
    constructor(path: string);
    static beside(cachePath: string): ServerChoice;
    read(): Promise<string | undefined>;
    write(server: string | undefined): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map