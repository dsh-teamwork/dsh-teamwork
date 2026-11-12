import { expect, test } from 'vitest';
import { snapshotSchema, modelData } from '../src/client.js';
import { assertBlank, sameRevision, toolReport, PresetStamps, presetStampPath } from '../src/preset-session.js';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
});
test('snapshot resolves referenced model capabilities locally and missing references never fall back', () => {
  const snapshot = snapshotSchema.parse({teamId:'t',teamName:'T',role:'member',configs:[{id:'m',kind:'model',name:'Kimi',version:2,data:{provider:'kimi',model:'kimi',contextWindow:128000,maxTokens:8192}},{id:'p',kind:'preset',name:'Review',version:1,data:{modelConfigId:'m',description:'Review code',requiredTools:['Read']}}]});
  expect(modelData(snapshot,snapshot.configs[1])?.maxTokens).toBe(8192);
  expect(modelData({...snapshot,configs:[snapshot.configs[1]]},snapshot.configs[1])).toBeUndefined();
  expect(snapshotSchema.safeParse({teamId:'t',teamName:'T',role:'member',configs:[{id:'p',kind:'preset',name:'bad',version:1,data:{modelConfigId:'m',provider:'local',model:'secret'}}]}).success).toBe(false);
});
test('preset stamps live in a file of the plugin, survive a restart, and never in the session log', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'stamps-'));
  const path = presetStampPath(join(dir, 'teamwork-cache.json'));
  expect(path).toBe(join(dir, 'teamwork-cache.sessions.json'));
  const first = new PresetStamps(path); await first.load();
  await first.set('s1', preset);
  // A host restart reads them back, so a resumed session still knows the revision it started on.
  const second = new PresetStamps(path); await second.load();
  expect(second.get('s1')).toEqual({teamId:'t',id:'p',version:1});
  expect(sameRevision(second.get('s1'),{...preset,version:2})).toBe(false);
  expect((await stat(path)).mode & 0o777).toBe(0o600);
  await second.clear('s1');
  expect(JSON.parse(await readFile(path,'utf8'))).toEqual({});
  // An unreadable file starts empty: the stamp is retaken on the next request.
  await writeFile(path, 'not json');
  const third = new PresetStamps(path); await third.load();
  expect(third.get('s1')).toBeNull();
});
