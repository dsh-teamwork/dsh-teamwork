import type { TeamworkClient, TeamOverlay } from './client.js';
/** One shared flight for manual and scheduled configuration synchronization. */
export declare class ConfigSync {
    private client;
    private overlay;
    private enabled;
    private interval;
    private synced;
    private knowledge;
    private timer?;
    private flight?;
    private stopped;
    private lastSuccess?;
    private lastError?;
    /**
     * `synced` hears every successful sync, manual or scheduled. `knowledge` follows it in the same flight
     * (src/knowledge-sync.ts); it reports its own failures, which never fail the configuration's sync.
     */
    constructor(client: TeamworkClient, overlay: TeamOverlay, enabled: boolean, interval: number, synced: () => void, knowledge: () => Promise<void>);
    status(): {
        authenticated: boolean;
        autoSync: boolean;
        syncing: boolean;
        lastSuccess: string | undefined;
        lastError: string | undefined;
        teams: string[];
        configCount: number;
    };
    sync(): Promise<void>;
    start(): void;
    stop(): Promise<void>;
}
//# sourceMappingURL=config-sync.d.ts.map