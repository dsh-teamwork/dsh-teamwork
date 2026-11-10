import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    text: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    text: z<string, string, "defined">;
}>>, "plain">;
/** Team text is an additional scoped section, not a template or a local persona override. */
export declare function apply(ctx: Context, config: {
    text: string;
}): void;
//# sourceMappingURL=prompt.d.ts.map