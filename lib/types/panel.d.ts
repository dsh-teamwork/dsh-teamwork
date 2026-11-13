/**
 * The Teamwork sidebar panel's wire: what the browser half (`src/web/`) asks
 * the host half for, and the routes that answer it. The routes run the same
 * functions as the `/teamwork` command, in the host process, so the platform
 * token stays here and never reaches the browser. DSH admits only its owner
 * peer to an exact route.
 *
 * This file is imported by both halves: types only, no Node or host imports.
 */
import type { PluginState } from './plugin-status.js';
export type { PluginState };
export type ToolState = 'available' | 'conditional' | 'missing' | 'unknown';
export interface PanelPlugin {
    id: string;
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
    name: string;
    version: number;
    description: string;
    /** The team model the preset calls, or its own provider/model. */
    model: string;
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
}
/** A single-use pairing code, and the link the app's QR scanner reads. */
export interface PanelPairingOffer {
    code: string;
    expiresAt: string;
    /** `dshteamwork://pair?server=…&code=…`, drawn as a QR code. */
    link: string;
}
export interface PanelState {
    authenticated: boolean;
    /** A team cached from an earlier sign-in is shown, but not usable, until the member signs in again. */
    team: {
        id: string;
        name: string;
        role: 'admin' | 'member';
    } | null;
    /** The web console, for an admin. */
    consoleUrl: string;
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
        name: string;
        version: number;
        upstream: string;
    }>;
    plugins: PanelPlugin[];
}
/** What the host half implements for the routes. Each throws an `Error` whose message is shown to the member. */
export interface PanelOps {
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