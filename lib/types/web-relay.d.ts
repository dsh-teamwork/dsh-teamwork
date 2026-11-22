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
export declare function loopbackWebURL(url: URL): boolean;
export declare function pageCookie(launch: URL, lifetime: AbortSignal): Promise<string>;
export declare function rewriteWebRequest(header: Buffer, launch: URL, cookie: string): Buffer;
/** One HTTP connection, or one upgraded WebSocket, to the current DSH instance. */
export declare function connectWebRelay(launchURL: string, dataURL: URL, id: string, lifetime: AbortSignal): Promise<void>;
//# sourceMappingURL=web-relay.d.ts.map