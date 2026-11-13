import { z } from 'zod';
import { type Forwarded } from './bridge.js';
import type { RelayStatus } from './panel.js';
export type { RelayStatus };
/** The relay's close codes this side acts on; any other close reconnects. */
export declare const RELAY_CLOSE: {
    readonly badHello: 4400;
    readonly unauthorized: 4401;
    readonly replaced: 4409;
};
/** What the relay pushes unasked: a phone redeemed this computer's code, or a pairing ended. */
export type RelayEvent = {
    t: 'paired';
} | {
    t: 'revoked';
    pairingId: string;
};
/** A request the relay answers once welcomed (its `src/protocol.ts`, `PluginRequestSchema`). */
export type RelayRequest = {
    t: 'offer';
} | {
    t: 'pairings';
} | {
    t: 'decide';
    pairingId: string;
    accept: boolean;
} | {
    t: 'revoke';
    pairingId: string;
};
/** A pairing as the relay lists it (`src/pairing.ts`, `PairingView`). */
export declare const pairingSchema: z.ZodObject<{
    id: z.ZodString;
    deviceName: z.ZodString;
    status: z.ZodEnum<{
        pending: "pending";
        confirmed: "confirmed";
    }>;
    createdAt: z.ZodString;
    lastUsedAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const offerSchema: z.ZodObject<{
    code: z.ZodString;
    expiresAt: z.ZodString;
}, z.core.$strip>;
/** The relay answered a request with one of its error codes (`invalid_code`, `not_found`, `internal`). */
export declare class RelayError extends Error {
    readonly code: string;
    constructor(code: string);
}
export interface RelayLinkOptions {
    /** The server the member signed in to, read on every attempt. */
    endpoint: () => string;
    /** The member's Bearer, or undefined while signed out. */
    token: () => string | undefined;
    /** Where this computer's stable relay id is kept. */
    clientIdPath: string;
    name?: string;
    dshVersion?: string;
    request?: typeof fetch;
    /** The WebSocket class to dial with: Node's global by default. */
    WebSocket?: typeof globalThis.WebSocket;
    onStatus?: (status: RelayStatus) => void;
    onEvent?: (event: RelayEvent) => void;
    /** A phone's frame for this computer, or the news that its phone left or lost its pairing (`src/bridge.ts`). */
    onForward?: (frame: Forwarded) => void;
    /** Longest wait between reconnection attempts. */
    maxBackoffMs?: number;
    /** How long to wait before asking a server without a relay again. */
    rediscoverMs?: number;
}
export declare class RelayLink {
    private readonly options;
    private state;
    private socket?;
    private timer?;
    private attempt;
    /** Bumped by every refresh and stop, so a late callback of an older run changes nothing. */
    private run;
    private hostId?;
    private requests;
    constructor(options: RelayLinkOptions);
    get status(): RelayStatus;
    /** The relay's id for this computer, once welcomed. */
    get host(): string | undefined;
    /** Start over: after sign-in, sign-out or a change of server. */
    refresh(): void;
    stop(): void;
    /** Ask the relay something, once connected; rejects when it is not, or does not answer in time. */
    request(request: RelayRequest): Promise<unknown>;
    /**
     * Pass a frame to the relay: a phone's answer (`src/bridge.ts`), or `waiting`
     * when an agent waits on its member. Dropped while not connected.
     */
    send(frame: unknown): void;
    private failRequests;
    private halt;
    private set;
    private retry;
    private backoff;
    private connect;
    /** A random id generated once per computer, so the relay keeps one host across restarts. */
    private clientId;
}
/** `<cache>.host.json`, beside the cache, like the other per-computer files. */
export declare const relayClientIdPath: (cachePath: string) => string;
//# sourceMappingURL=relay.d.ts.map