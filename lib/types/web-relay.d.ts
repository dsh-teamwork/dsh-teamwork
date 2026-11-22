/**
 * The owner's switch for native Web (platform ADR 0064), set in the Teamwork panel: on, the platform may proxy this
 * DSH's whole Web interface to the account signed in here. Off by default, and turned off again by signing out or
 * changing server, so it never carries over to another account or another platform. The file
 * (`<cache>.web.json`, mode 0600) holds nothing; its presence is the switch.
 */
export declare class NativeWebSwitch {
    readonly path: string;
    private value?;
    constructor(path: string);
    static beside(cachePath: string): NativeWebSwitch;
    on(): Promise<boolean>;
    set(on: boolean): Promise<void>;
}
/**
 * The native Web tunnels this computer serves, for the panel and `dsh-teamwork status` to show use, and for
 * "Disconnect all" to end every one at once (the server's ADR 0065).
 */
export declare class WebTunnels {
    private open;
    private last?;
    private ended;
    get state(): {
        tunnels: number;
        lastActivity?: string;
    };
    /** The signal a new tunnel lives under: the control connection's, ended early by endAll. */
    signal(lifetime: AbortSignal): AbortSignal;
    opened(): void;
    closed(): void;
    moved(): void;
    endAll(): void;
}
export declare function loopbackWebURL(url: URL): boolean;
export declare function pageCookie(launch: URL, lifetime: AbortSignal): Promise<string>;
export declare function rewriteWebRequest(header: Buffer, launch: URL, cookie: string): Buffer;
/** One HTTP connection, or one upgraded WebSocket, to the current DSH instance. */
export declare function connectWebRelay(launchURL: string, dataURL: URL, id: string, lifetime: AbortSignal, tunnels?: WebTunnels): Promise<void>;
//# sourceMappingURL=web-relay.d.ts.map