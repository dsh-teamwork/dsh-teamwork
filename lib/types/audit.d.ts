import { Context } from "@deepseek-ai/cordis";
import { Config } from "./index.js";
export interface AuditEvent {
    type: string;
    timestamp: string;
    payload: Record<string, unknown>;
}
export declare class AuditService {
    private ctx;
    private config;
    private buffer;
    constructor(ctx: Context, config: Config);
    record(event: AuditEvent): void;
    flush(): Promise<void>;
}
//# sourceMappingURL=audit.d.ts.map