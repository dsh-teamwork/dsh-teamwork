import type { Identity } from './secure-channel.js';
export declare const sharedKeyPath: (cachePath: string) => string;
/**
 * Team DSH is offline on the server (platform docs/tech/shared-dsh.md), so a DSH left in shared mode is not resumed:
 * its saved team host key is deleted, untouched otherwise (its audit archive holds members' sealed sessions). True
 * when there was one to delete.
 */
export declare function forgetSharedKey(path: string): Promise<boolean>;
/** What the server's refusal means for the key: `invalid` (unknown, rotated or deleted) and `elsewhere` stop renewal. */
export declare class SharedKeyError extends Error {
    readonly code: 'format' | 'invalid' | 'elsewhere' | 'unavailable';
    constructor(code: 'format' | 'invalid' | 'elsewhere' | 'unavailable', message: string);
}
/** The bytes the identity key signs: the nonce, the host and the server, so a signature is good for one exchange only. */
export declare const signedExchange: (nonce: string, hostId: string, server: string) => Uint8Array<ArrayBuffer>;
export interface SharedStatus {
    enabled: boolean;
    hostId?: string;
    teamId?: string;
    name?: string;
    expiresAt?: string;
    error?: string;
}
export interface SharedModeOptions {
    path: string;
    /** The server this DSH talks to, as `TeamworkClient.endpoint` names it; it is the APP_URL the signature names. */
    server: () => string;
    identity: () => Promise<Identity>;
    /** Hears each new host token, and `undefined` when shared mode ends or its key is refused for good. */
    onToken: (token: string | undefined) => Promise<void>;
    request?: typeof fetch;
    log?: (message: string) => void;
    now?: () => number;
}
export declare class SharedMode {
    private readonly options;
    private key?;
    private state;
    private timer?;
    private generation;
    constructor(options: SharedModeOptions);
    get enabled(): boolean;
    status(): SharedStatus;
    /** Resumes shared mode from the saved key, if there is one. A refused key stays saved, so the status says why. */
    restore(): Promise<void>;
    /** Turns shared mode on with a key: it is saved only once the server accepts it for this machine. */
    enable(input: string): Promise<void>;
    /** Turns shared mode off: the key is deleted and the host token dropped. */
    disable(): Promise<void>;
    stop(): void;
    private stopTimer;
    private schedule;
    private renew;
    private exchange;
}
//# sourceMappingURL=shared-mode.d.ts.map