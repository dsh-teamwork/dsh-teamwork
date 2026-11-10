import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export interface PresetContext {
  teamId: string; id: string; name: string; version: number; modelConfigId?: string;
  description: string; instructions: string; outputDescription: string; systemPrompt: string;
  pluginDependencies?: {pluginConfigId:string;version:string}[];
  requiredTools: string[]; optionalTools: string[];
}
declare module '@deepseek-ai/cordis' { interface Context { teamworkPreset: PresetContext } }
export const inject = ['systemPrompt'];
export const Config: z<PresetContext> = z.object({
  teamId: z.string().required(), id: z.string().required(), name: z.string().required(), version: z.number().required(), modelConfigId: z.string(),
  description: z.string().default(''), instructions: z.string().default(''), outputDescription: z.string().default(''), systemPrompt: z.string().default(''),
  pluginDependencies: z.array(z.object({pluginConfigId:z.string().required(),version:z.string().required()})).default([]),
  requiredTools: z.array(z.string()).default([]), optionalTools: z.array(z.string()).default([]),
});
/** Metadata and literal prompt live in the same native preset generation. */
export function apply(ctx: Context, config: PresetContext) {
  ctx.provide('teamworkPreset', Object.freeze(structuredClone(config)));
  if (config.systemPrompt) ctx.effect(() => ctx.systemPrompt.section({name:'teamwork:prompt', order:100, text:config.systemPrompt, interpolate:false}));
}
