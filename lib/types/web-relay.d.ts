export declare function loopbackWebURL(url: URL): boolean;
export declare function pageCookie(launch: URL, lifetime: AbortSignal): Promise<string>;
export declare function rewriteWebRequest(header: Buffer, launch: URL, cookie: string): Buffer;
/** One HTTP connection, or one upgraded WebSocket, to the current DSH instance. */
export declare function connectWebRelay(launchURL: string, dataURL: URL, id: string, lifetime: AbortSignal): Promise<void>;
//# sourceMappingURL=web-relay.d.ts.map