import type { TeamworkClient, TeamOverlay } from './client.js';
/** One shared flight for manual and scheduled configuration synchronization. */
export declare class ConfigSync {
    private client;
    private overlay;
    private enabled;
    private interval;
    private synced;
    private timer?;
    private flight?;
    private stopped;
    private lastSuccess?;
    private lastError?;
    /** `synced` hears every successful sync, manual or scheduled. */
    constructor(client: TeamworkClient, overlay: TeamOverlay, enabled: boolean, interval: number, synced: () => void);
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