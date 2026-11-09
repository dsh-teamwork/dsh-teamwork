import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export const inject = ['systemPrompt'];
export const Config = z.object({ text: z.string().required() });
/** Team text is an additional scoped section, not a template or a local persona override. */
export function apply(ctx: Context, config: { text: string }) {
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'teamwork:prompt', order: 100, text: config.text, interpolate: false,
  }));
}
