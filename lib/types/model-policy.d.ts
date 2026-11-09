import { Context } from "@deepseek-ai/cordis";
import { Config } from "./index.js";
export interface ModelPolicy {
    allowedProviders: string[];
    allowedModels: string[];
    defaultProvider: string;
    defaultModel: string;
}
export declare class ModelPolicyService {
    private ctx;
    private config;
    private policy;
    constructor(ctx: Context, config: Config);
    fetchPolicy(): Promise<void>;
    getPolicy(): ModelPolicy | null;
}
//# sourceMappingURL=model-policy.d.ts.map