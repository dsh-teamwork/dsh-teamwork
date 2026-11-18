import type { FetchRoute } from './panel.js';
export declare const controlSocketPath: (cachePath: string) => string;
/** Serves the routes on the socket at path until the returned close is called; failures go to log and leave nothing open. */
export declare function serveControlSocket(path: string, routes: FetchRoute[], log: (message: string) => void): Promise<() => Promise<void>>;
//# sourceMappingURL=control-socket.d.ts.map