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
/** The hosted service. A member can pick another server in the panel; the profile's `apiEndpoint` sets the default. */
export declare const DEFAULT_SERVER = "https://www.dshteamwork.com";
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    apiEndpoint: z<string, string, "defined">;
    cachePath: z<string, string, "defined">;
    autoSync: z<boolean, boolean, "defined">;
    syncIntervalMs: z<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    apiEndpoint: z<string, string, "defined">;
    cachePath: z<string, string, "defined">;
    autoSync: z<boolean, boolean, "defined">;
    syncIntervalMs: z<number, number, "defined">;
}>>, "plain">;
export declare function apply(ctx: Context, config: Config): Promise<void>;
//# sourceMappingURL=index.d.ts.map