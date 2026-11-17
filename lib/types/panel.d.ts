/**
 * The Teamwork sidebar panel's wire: what the browser half (`src/web/`) asks
 * the host half for, and the routes that answer it. The routes run the same
 * functions as the `/teamwork` command, in the host process, so the platform
 * token stays here and never reaches the browser. DSH admits only its owner
 * peer to an exact route.
 *
 * This file is imported by both halves: the browser takes its types and
 * `ROUTE_PREFIX`; `panelRoutes` and the host's messages are tree-shaken out of it.
 */
import type { PluginState } from './plugin-status.js';
import type { Locale } from './locale.js';
export type { PluginState };
export type ToolState = 'available' | 'conditional' | 'missing' | 'unknown';
export interface PanelPlugin {
    id: string;
    teamId?: string;
    teamName?: string;
    name: string;
    package?: string;
    version: string;
    description: string;
    /** The version installed locally, if any. */
    localVersion?: string;
    state: PluginState;
}
export interface PanelPreset {
    id: string;
    /** The team that publishes it; a member in several teams sees each team's presets. */
    teamId: string;
    teamName: string;
    name: string;
    version: number;
    description: string;
    /** The team model the preset calls, or its own provider/model; null when it runs on the session's own model. */
    model: string | null;
    /** The assistant every team is given (`builtin: team-assistant`), shown first. */
    assistant: boolean;
    /** False when the model it references is gone from the team. */
    modelAvailable: boolean;
    /** Checked against the current session; `unknown` without one. */
    tools: Array<{
        name: string;
        required: boolean;
        state: ToolState;
    }>;
    plugins: PanelPlugin[];
}
/**
 * The outbound link to the hosted mobile relay (`src/relay.ts`). `off`: not
 * signed in, or the server runs no relay. `connecting`: discovering or dialling.
 * `connected`: the relay welcomed this computer. `refused`: the relay refused
 * the sign-in, or another connection from this computer replaced this one; it
 * waits for the member to sign in again.
 */
export type RelayStatus = 'off' | 'connecting' | 'connected' | 'refused';
/** A phone paired with this computer through the relay; `pending` until the member confirms it here. */
export interface PanelPhone {
    id: string;
    deviceName: string;
    status: 'pending' | 'confirmed';
    createdAt: string;
    lastUsedAt: string | null;
    safetyCode?: string;
    phoneConfirmed?: boolean;
    verified?: boolean;
}
/** A single-use pairing code, and the link the app's QR scanner reads. */
export interface PanelPairingOffer {
    code: string;
    expiresAt: string;
    /** `dshteamwork://pair?server=…&code=…`, drawn as a QR code. */
    link: string;
}
export interface PanelState {
    /** The language the panel speaks: the Teamwork account's once read, the system's before (`src/messages.ts`). */
    locale: Locale;
    authRevision: number;
    authenticated: boolean;
    /**
     * Every team the member is in (platform ADR 0013), each with its web console. Teams cached from an earlier
     * sign-in are shown, but not usable, until the member signs in again.
     */
    teams: Array<{
        id: string;
        name: string;
        role: 'admin' | 'member';
        consoleUrl: string;
    }>;
    /** The server this DSH signs in to and syncs from, and the one it uses unless the member picks another. */
    server: string;
    defaultServer: string;
    sync: {
        auto: boolean;
        running: boolean;
        lastSuccess?: string;
        lastError?: string;
    };
    /** The phone's way in through the hosted relay (`src/relay.ts`); `off` where the server runs none. */
    relay: RelayStatus;
    /** Phones paired with this computer; empty while the relay is not connected. */
    phones: PanelPhone[];
    /** The session the member has open, when the host has it loaded. */
    session: {
        id: string;
        /** The model the session runs on: a team model id when `team` is true. */
        model: {
            provider: string;
            model: string;
            team: boolean;
        } | null;
        preset: {
            id: string;
            name: string;
            version: number;
        } | null;
        /** A preset can be chosen only before the first turn. */
        started: boolean;
    } | null;
    presets: PanelPreset[];
    models: Array<{
        id: string;
        teamId: string;
        teamName: string;
        name: string;
        version: number;
        upstream: string;
    }>;
    plugins: PanelPlugin[];
}
/** Advisory own-member availability. The gateway remains the admission authority. */
export interface PanelQuota {
    remaining: string | null;
    state: 'known' | 'unlimited' | 'unconfirmed';
    resetAt: string | null;
    tokenLimited: boolean;
    exhausted: boolean;
}
/** One team's `GET /api/teams/{teamId}/summary`, reduced to what the panel shows: the member's budget and the reviews waiting. */
export interface PanelSummary {
    budget: PanelQuota;
    /** Submissions awaiting review: the team's for an admin, the member's own otherwise. */
    pendingReviews: number;
}
export interface PanelProfile {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    locale: Locale | null;
}
/** What the host half implements for the routes. Each throws an `Error` whose message is shown to the member. */
export interface PanelOps {
    summary(teamId: string): Promise<PanelSummary>;
    profile(): Promise<PanelProfile>;
    updateProfile(input: {
        name: string | null;
        locale: Locale;
    }): Promise<PanelProfile>;
    state(sessionId: string | undefined): Promise<PanelState>;
    /** The sign-in page; `automatic` when the code comes back to this DSH by itself (src/login-callback.ts). */
    login(): Promise<{
        url: string;
        automatic: boolean;
    }>;
    authorize(code: string): Promise<void>;
    sync(): Promise<void>;
    logout(): Promise<void>;
    /** Points the plugin at another server, or back to the default with `null`; signs out of the current one. */
    setServer(server: string | null): Promise<void>;
    /** Selects a team model or preset for the session; returns what changed. */
    use(sessionId: string, id: string): Promise<string>;
    /** Installs a pinned plugin at exactly the version the member confirmed. */
    install(id: string, version: string): Promise<string>;
    /** A fresh pairing code from the relay; earlier unused codes stop working. */
    pairPhone(): Promise<PanelPairingOffer>;
    /** Confirms or refuses a phone that redeemed a code. */
    decidePhone(id: string, accept: boolean): Promise<void>;
    /** Cuts a paired phone off. */
    revokePhone(id: string): Promise<void>;
}
export declare const ROUTE_PREFIX = "/api/teamwork";
/** The shape `connection.fetch.register` takes (`@deepseek-ai/dsh-client-connection`). */
export interface FetchRoute {
    path: string;
    methods: Array<'GET' | 'HEAD' | 'POST'>;
    requestBody: 'buffered' | 'streaming';
    fetch(request: Request): Promise<Response>;
}
export declare function panelRoutes(ops: PanelOps): FetchRoute[];
//# sourceMappingURL=panel.d.ts.map