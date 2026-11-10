import {expect,test,vi} from 'vitest';
import type {Agent} from '@deepseek-ai/dsh-agent';
import {TaskActions,taskProjection,recoveryHint} from '../src/task-session.js';
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
  await expect(f.actions.submit(f.agent,'go')).rejects.toThrow('正在执行');
  Object.assign(f.agent,{status:'idle',inbox:{nextTurn:[{}],nextStep:[]}});
  await expect(f.actions.submit(f.agent,'go')).rejects.toThrow('待处理输入');expect(f.inspect).not.toHaveBeenCalled();
});
test('retry requires fresh, one-use consent and does not retry completed tasks',async()=>{
  const f=fixture();await expect(f.actions.submit(f.agent,'continue',true)).rejects.toThrow('确认');
  expect(()=>f.actions.review(f.agent,'completed')).toThrow('没有可重试');
  f.actions.review(f.agent,'error');f.change();await expect(f.actions.submit(f.agent,'continue',true)).rejects.toThrow('变化');
  f.actions.review(f.agent,'aborted');await f.actions.submit(f.agent,'continue',true);
  await expect(f.actions.submit(f.agent,'continue',true)).rejects.toThrow('确认');expect(f.agent.followup).toHaveBeenCalledOnce();
});
test('retry consent expires and failure details never enter the summary projection',async()=>{
  const f=fixture();let now=0;const actions=new TaskActions(f.inspect,()=>'',()=>now);
  actions.review(f.agent,'error');now=120001;await expect(actions.submit(f.agent,'continue',true)).rejects.toThrow('过期');
  const state=taskProjection.init();
  const next=taskProjection.apply(state,{type:'turn/end',data:{turn:1,reason:{kind:'error',error:{code:'RATE_LIMIT',message:'private upstream diagnostics'}}}} as never);
  expect(next.failureCode).toBe('RATE_LIMIT');expect(JSON.stringify(next)).not.toContain('private');expect(recoveryHint(next.failureCode,next.outcome)).toContain('限流');
});
test('permission failure, changed context and cancellation during inspection never launch work',async()=>{
  const f=fixture();f.inspect.mockRejectedValueOnce(new Error('revoked'));
  await expect(f.actions.submit(f.agent,'go')).rejects.toThrow('revoked');
  f.inspect.mockImplementationOnce(async()=>{f.change();});
  await expect(f.actions.submit(f.agent,'go')).rejects.toThrow('变化');
  let release!:()=>void;f.inspect.mockImplementationOnce(()=>new Promise<void>(resolve=>{release=resolve;}));
  const pending=f.actions.submit(f.agent,'go');
  await expect(f.actions.submit(f.agent,'again')).rejects.toThrow('重复提交');
  f.actions.cancel(f.agent);release();await expect(pending).rejects.toThrow('已取消');
  expect(f.agent.cancel).toHaveBeenCalledWith({kind:'user'},{keepInbox:true});expect(f.agent.followup).not.toHaveBeenCalled();
});
