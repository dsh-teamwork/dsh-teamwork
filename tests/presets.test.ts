import { expect, test } from 'vitest';
import { snapshotSchema, modelData } from '../src/client.js';
import { assertBlank, sameRevision, toolReport, presetProjection } from '../src/preset-session.js';
import type { PresetContext } from '../src/preset-context.js';
const preset: PresetContext = {teamId:'t',id:'p',name:'Review',version:1,description:'Review code',instructions:'Provide a diff',outputDescription:'List issues',systemPrompt:'Literal {{text}}',requiredTools:['Read'],optionalTools:['Shell']};
test('native session rules reject started and running conversations, allow blank ones', () => {
  expect(()=>assertBlank({lastTurn:0,openTurnStartSeq:null})).not.toThrow();
  for (const boundary of [{lastTurn:1,openTurnStartSeq:null},{lastTurn:0,openTurnStartSeq:0}]) expect(()=>assertBlank(boundary)).toThrow('新建会话');
});
test('tool checks distinguish registration, conditions, absence, and unavailable host inspection', () => {
  expect(toolReport(preset, name=>name==='Read'?'available':'conditional')).toEqual([{name:'Read',required:true,state:'available'},{name:'Shell',required:false,state:'conditional'}]);
  expect(toolReport(preset, ()=>'missing')[0].state).toBe('missing');
  expect(toolReport(preset, ()=>'unknown')[0].required).toBe(true);
});
test('revision comparison includes team identity and survives a serialized session stamp', () => {
  const stamp = JSON.parse(JSON.stringify({teamId:'t',id:'p',version:1}));
  expect(sameRevision(stamp,preset)).toBe(true);
  expect(sameRevision(stamp,{...preset,version:2})).toBe(false);
  expect(sameRevision(stamp,{...preset,teamId:'other'})).toBe(false);
  expect(presetProjection.stateSchema.parse(stamp)).toEqual(stamp);
});
test('snapshot resolves referenced model capabilities locally and missing references never fall back', () => {
  const snapshot = snapshotSchema.parse({teamId:'t',configs:[{id:'m',kind:'model',name:'Kimi',version:2,data:{provider:'kimi',model:'kimi',contextWindow:128000,maxTokens:8192}},{id:'p',kind:'preset',name:'Review',version:1,data:{modelConfigId:'m',description:'Review code',requiredTools:['Read']}}]});
  expect(modelData(snapshot,snapshot.configs[1])?.maxTokens).toBe(8192);
  expect(modelData({...snapshot,configs:[snapshot.configs[1]]},snapshot.configs[1])).toBeUndefined();
  expect(snapshotSchema.safeParse({teamId:'t',configs:[{id:'p',kind:'preset',name:'bad',version:1,data:{modelConfigId:'m',provider:'local',model:'secret'}}]}).success).toBe(false);
});
