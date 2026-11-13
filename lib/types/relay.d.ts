import type { RelayStatus } from './panel.js';
export type { RelayStatus };
/** The relay's close codes this side acts on; any other close reconnects. */
export declare const RELAY_CLOSE: {
    readonly badHello: 4400;
    readonly unauthorized: 4401;
    readonly replaced: 4409;
};
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
    constructor(options: RelayLinkOptions);
    get status(): RelayStatus;
    /** The relay's id for this computer, once welcomed. */
    get host(): string | undefined;
    /** Start over: after sign-in, sign-out or a change of server. */
    refresh(): void;
    stop(): void;
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