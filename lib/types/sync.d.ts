import { Context } from "@deepseek-ai/cordis";
import { Config } from "./index.js";
export declare class SyncService {
    private ctx;
    private config;
    private pending;
    constructor(ctx: Context, config: Config);
    queueSession(sessionId: string): Promise<void>;
    flush(): Promise<void>;
}
//# sourceMappingURL=sync.d.ts.map