import { z } from 'zod/v4';
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection';
import type { PresetContext } from './preset-context.js';
const schema = z.object({teamId:z.string(),id:z.string(),version:z.number().int().positive()}).nullable();
export type PresetStamp = z.infer<typeof schema>;
declare module '@deepseek-ai/dsh-session/types' { interface SessionEventMap { 'teamwork/preset': { teamId:string; id:string; version:number } } }
declare module '@deepseek-ai/dsh-session-projection/types' { interface SessionProjectionMap { teamworkPreset: PresetStamp } }
export const presetProjection = {
  key:'teamworkPreset', stateSchema:schema, init:()=>null,
  apply:(state,event)=>event.type==='teamwork/preset' ? event.data : event.type==='agent-preset/selected' ? null : state,
  wire:{viewSchema:schema,view:state=>state}, stateVersion:1,
} satisfies ProjectionDefinition<'teamworkPreset',PresetStamp>;
export function sameRevision(stamp: PresetStamp, current: PresetContext) {
  return stamp?.teamId===current.teamId && stamp.id===current.id && stamp.version===current.version;
}
export function toolReport(preset: Pick<PresetContext,'requiredTools'|'optionalTools'>, lookup: (name:string)=>'available'|'conditional'|'missing'|'unknown') {
  return [...preset.requiredTools.map(name=>({name,required:true})),...preset.optionalTools.map(name=>({name,required:false}))].map(t=>({...t,state:lookup(t.name)}));
}
export function assertBlank(boundary: {openTurnStartSeq:unknown;lastTurn:number}) {
  if (boundary.openTurnStartSeq!==null || boundary.lastTurn>0) throw new Error('会话已开始或正在执行，DSH 不允许切换预设。请新建会话后选择该预设。');
}
