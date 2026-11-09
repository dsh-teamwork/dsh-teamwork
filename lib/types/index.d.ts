import { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "dsh-teamwork";
export declare const inject: string[];
export interface Config {
    apiEndpoint: string;
    cachePath: string;
    autoSync?: boolean;
    syncIntervalMs?: number;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    apiEndpoint: z<string, string, "defined">;
    cachePath: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    apiEndpoint: z<string, string, "defined">;
    cachePath: z<string, string, "defined">;
}>>, "plain">;
export declare function apply(ctx: Context, config: Config): Promise<void>;
//# sourceMappingURL=index.d.ts.map