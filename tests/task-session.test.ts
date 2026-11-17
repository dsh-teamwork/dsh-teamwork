import {expect,test,vi} from 'vitest';
import type {Agent} from '@deepseek-ai/dsh-agent';
import {TaskActions,taskProjection,stepProjection,stepTarget,recoveryHint} from '../src/task-session.js';
function fixture() {
  const agent={status:'idle',inbox:{nextTurn:[],nextStep:[]},followup:vi.fn(),cancel:vi.fn()} as unknown as Agent;
  let fingerprint='initial';const inspect=vi.fn(async()=>{});
  const actions=new TaskActions(inspect,()=>fingerprint);
  return {agent,inspect,actions,change:()=>{fingerprint='changed';}};
}
test('continue creates one native user followup after readiness succeeds',async()=>{
  const f=fixture();await f.actions.submit(f.agent,'Continue the tests');
  expect(f.inspect).toHaveBeenCalledOnce();expect(f.agent.followup).toHaveBeenCalledWith(expect.objectContaining({source:{kind:'user'},content:[{type:'text',text:'Continue the tests'}]}));
});
test('running and queued work are not silently reordered',async()=>{
  const f=fixture();Object.assign(f.agent,{status:'running'});
  await expect(f.actions.submit(f.agent,'go')).rejects.toThrow('A task is running');
  Object.assign(f.agent,{status:'idle',inbox:{nextTurn:[{}],nextStep:[]}});
  await expect(f.actions.submit(f.agent,'go')).rejects.toThrow('pending input');expect(f.inspect).not.toHaveBeenCalled();
});
test('retry requires fresh, one-use consent and does not retry completed tasks',async()=>{
  const f=fixture();await expect(f.actions.submit(f.agent,'continue',true)).rejects.toThrow('retry confirmation');
  expect(()=>f.actions.review(f.agent,'completed')).toThrow('no failed or interrupted task');
  f.actions.review(f.agent,'error');f.change();await expect(f.actions.submit(f.agent,'continue',true)).rejects.toThrow('changed');
  f.actions.review(f.agent,'aborted');await f.actions.submit(f.agent,'continue',true);
  await expect(f.actions.submit(f.agent,'continue',true)).rejects.toThrow('retry confirmation');expect(f.agent.followup).toHaveBeenCalledOnce();
});
test('retry consent expires and failure details never enter the summary projection',async()=>{
  const f=fixture();let now=0;const actions=new TaskActions(f.inspect,()=>'',()=>now);
  actions.review(f.agent,'error');now=120001;await expect(actions.submit(f.agent,'continue',true)).rejects.toThrow('expired');
  const state=taskProjection.init();
  const next=taskProjection.apply(state,{type:'turn/end',data:{turn:1,reason:{kind:'error',error:{code:'RATE_LIMIT',message:'private upstream diagnostics'}}}} as never);
  expect(next.failureCode).toBe('RATE_LIMIT');expect(JSON.stringify(next)).not.toContain('private');expect(recoveryHint(next.failureCode,next.outcome)).toContain('rate limited');
});
test('permission failure, changed context and cancellation during inspection never launch work',async()=>{
  const f=fixture();f.inspect.mockRejectedValueOnce(new Error('revoked'));
  await expect(f.actions.submit(f.agent,'go')).rejects.toThrow('revoked');
  f.inspect.mockImplementationOnce(async()=>{f.change();});
  await expect(f.actions.submit(f.agent,'go')).rejects.toThrow('changed');
  let release!:()=>void;f.inspect.mockImplementationOnce(()=>new Promise<void>(resolve=>{release=resolve;}));
  const pending=f.actions.submit(f.agent,'go');
  await expect(f.actions.submit(f.agent,'again')).rejects.toThrow('submit again');
  f.actions.cancel(f.agent);release();await expect(pending).rejects.toThrow('cancelled');
  expect(f.agent.cancel).toHaveBeenCalledWith({kind:'user'},{keepInbox:true});expect(f.agent.followup).not.toHaveBeenCalled();
});
test('a running turn counts its tool calls and names the latest target, and an ended turn clears it',()=>{
  const call=(name:string,args:unknown)=>({type:'tool/call',data:{turn:2,step:1,callId:name,name,arguments:typeof args==='string' ? args : JSON.stringify(args)}}) as never;
  let state=stepProjection.apply(stepProjection.init(),{type:'turn/start',data:{turn:2}} as never);
  state=stepProjection.apply(state,call('bash',{command:'pnpm test --filter console\nrm -rf later'}));
  state=stepProjection.apply(state,call('edit',{path:'server/relay/relay_test.go',old_string:'secret contents'}));
  expect(state).toEqual({turn:2,count:2,tool:'edit',target:'server/relay/relay_test.go'});
  expect(JSON.stringify(state)).not.toContain('secret');
  expect(stepProjection.apply(state,{type:'user/message',data:{}} as never)).toBe(state);
  expect(stepProjection.apply(state,{type:'turn/end',data:{turn:2,reason:{kind:'completed'}}} as never)).toEqual({turn:2,count:0,tool:'',target:''});
  expect(stepProjection.apply(state,{type:'turn/start',data:{turn:3}} as never)).toEqual({turn:3,count:0,tool:'',target:''});
});
test('a step names only the first line of what it works on, and nothing for arguments it cannot read',()=>{
  expect(stepTarget(JSON.stringify({command:'git status\ngit push'}))).toBe('git status');
  expect(stepTarget(JSON.stringify({query:'x'.repeat(500)}))).toHaveLength(120);
  expect(stepTarget(JSON.stringify({content:'file body'}))).toBe('');
  expect(stepTarget('not json')).toBe('');
});

test('leaves the task empty for a message without text, so the phone titles it in its own language',()=>{
  const image={type:'user/message',data:{source:{kind:'user'},content:[{type:'image'}]}} as never;
  expect(taskProjection.apply(taskProjection.init(),image).task).toBe('');
  const text={type:'user/message',data:{source:{kind:'user'},content:[{type:'text',text:'Fix the build'}]}} as never;
  expect(taskProjection.apply(taskProjection.init(),text).task).toBe('Fix the build');
});
