import { reportResult } from './result.mjs';
import {readFile, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
export const inject = ['dshTeamwork','agents','agentPresets','commands'];
export function apply(ctx) {
  const timer = setTimeout(async()=>{
    try {
      const snapshot = JSON.parse(await readFile(process.env.TEAMWORK_TEST_SNAPSHOT,'utf8'));
      const preset = snapshot.configs[0];
      preset.data.description='Team code review'; preset.data.instructions='Provide a diff'; preset.data.requiredTools=[]; preset.data.optionalTools=['missing-optional-fixture'];
      const save = async()=>{await writeFile(process.env.TEAMWORK_TEST_CACHE,JSON.stringify({ teams: [snapshot] }));await ctx.dshTeamwork.reload();};
      await save();
      const id=`preset-${process.pid}`, agentPreset='team:host-smoke:review';
      await ctx.agents.create({sessionId:id,meta:{cwd:process.env.TEAMWORK_TEST_CWD,agentPreset},setup:async child=>{await ctx.agentPresets.mount(child,agentPreset);}});
      const agent=ctx.agents.get(id);
      const execute = text=>ctx.commands.execute(agent,text,[],new AbortController().signal);
      let info=await execute('/teamwork info'); assert.equal(info.result.kind,'success');assert.match(info.result.text,/Team code review/);assert.match(info.result.text,/Optional tool missing-optional-fixture: missing/);
      assert.equal(ctx.agentPresets.serviceFor(agent,'teamworkPreset').version,1);
      preset.version=2; preset.name='Review v2'; preset.data.systemPrompt='new prompt'; await save();
      assert.equal(ctx.agentPresets.serviceFor(agent,'teamworkPreset').version,1,'Existing native generation must stay pinned');
      info=await execute('/teamwork info');assert.match(info.result.text,/Version v2 is available/);
      assert.equal((await execute('/teamwork use review')).result.kind,'success');
      assert.equal(ctx.agentPresets.serviceFor(agent,'teamworkPreset').version,2);
      agent.session.append('turn/start',{turn:1});
      const locked=await execute('/teamwork use review');assert.equal(locked.result.kind,'error');assert.match(locked.result.text,/This session has started/);
      const created=await execute('/teamwork new review');assert.equal(created.result.kind,'success',created.result.text);
      const newId=created.result.text.match(/Created session ([a-z0-9-]+)/)[1];
      const fresh=ctx.agents.get(newId);assert.equal(ctx.agentPresets.serviceFor(fresh,'teamworkPreset').version,2);
      assert.deepEqual(fresh.model.current(),{provider:'teamwork-platform-host-smoke',model:'review'});
      preset.version=3; preset.data.requiredTools=['missing-required-fixture']; await save();
      const missing=await ctx.commands.execute(fresh,'/teamwork use review',[],new AbortController().signal);
      assert.equal(missing.result.kind,'error');assert.match(missing.result.text,/Required tools are missing/);
      assert.equal(ctx.agentPresets.serviceFor(fresh,'teamworkPreset').version,2,'Failed selection must leave existing preset intact');
      const tools=await execute('/teamwork tools');assert.equal(tools.result.kind,'success');assert.match(tools.result.text,/Tools visible to this session/);
      preset.version=4;preset.data.requiredTools=[];preset.data.pluginDependencies=[{pluginConfigId:'fixture',version:'1.0.0'}];await save();
      const dependencies=await execute('/teamwork plugins review');assert.equal(dependencies.result.kind,'success');assert.match(dependencies.result.text,/not installed/);assert.match(dependencies.result.text,/teamwork install fixture/);
      const blockedDependency=await ctx.commands.execute(fresh,'/teamwork use review',[],new AbortController().signal);assert.equal(blockedDependency.result.kind,'error');assert.match(blockedDependency.result.text,/not installed/);
      snapshot.configs[1].data.version='2.0.0';await save();assert.match((await execute('/teamwork plugins review')).result.text,/missing from the catalog or its version changed/);
      const overview=await execute('/teamwork session');assert.equal(overview.result.kind,'success');assert.match(overview.result.text,/Session: /);assert.match(overview.result.text,/teamwork-platform/);assert.match(overview.result.text,/Not signed in/);
      const continued=await execute('/teamwork continue Continue testing');assert.equal(continued.result.kind,'error');assert.match(continued.result.text,/Not signed in/);
      agent.session.append('turn/end',{turn:1,reason:{kind:'aborted',reason:{kind:'user'}}});
      assert.match((await execute('/teamwork session')).result.text,/cancelled/);
      assert.match((await execute('/teamwork retry')).result.text,/retry confirm/);
      assert.equal((await execute('/teamwork retry confirm')).result.kind,'error');
      const cancelled=await execute('/teamwork cancel');assert.equal(cancelled.result.kind,'success');assert.match(cancelled.result.text,/nothing is rolled back/);
      await reportResult({passed:true,checks:['native scoped preset details','optional tool warning','existing generation preserved','update availability shown','blank session updates','started session locked','new session uses latest preset','required tool blocks selection without mutation','session tool inventory','missing plugin installation guidance','required plugin blocks selection','stale dependency version rejected','session overview and login readiness','unauthenticated continuation blocked','durable cancellation outcome and explicit retry','native cancellation command']});
    } catch(error) {await reportResult({passed:false,error:String(error),stack:error.stack});}
  },3000);
  ctx.effect(()=>()=>clearTimeout(timer));
}
