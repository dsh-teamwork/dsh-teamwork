import { z } from 'zod/v4';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection';
const taskSchema = z.object({task:z.string(),outcome:z.string(),failureCode:z.string().nullable(),turn:z.number()});
export type TaskState = z.infer<typeof taskSchema>;
declare module '@deepseek-ai/dsh-session-projection/types' { interface SessionProjectionMap { teamworkTask: TaskState } }
export const taskProjection = {
  key:'teamworkTask',stateSchema:taskSchema,init:()=>({task:'',outcome:'not-started',failureCode:null,turn:0}),
  apply:(state,event)=>{
    if(event.type==='user/message' && event.data.source.kind==='user') {
      const text=event.data.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');
      return {...state,task:text.slice(0,240) || '非文本任务（请查看会话历史）'};
    }
    if(event.type==='turn/start') return {...state,turn:event.data.turn,outcome:'running',failureCode:null};
    if(event.type==='turn/end') return {...state,outcome:event.data.reason.kind,failureCode:event.data.reason.kind==='error' ? event.data.reason.error.code ?? 'UNKNOWN' : null};
    return state;
  },wire:{viewSchema:taskSchema,view:state=>state},stateVersion:1,
} satisfies ProjectionDefinition<'teamworkTask',TaskState>;
export function outcomeText(outcome:string) { return ({'not-started':'未开始',running:'执行中',completed:'已完成',aborted:'已取消',blocked:'被阻止',error:'失败',interrupted:'恢复前意外中断','max-tokens':'达到输出上限',forked:'从分支继承'} as Record<string,string>)[outcome] ?? '未知状态'; }
export function recoveryHint(code:string|null, outcome:string) {
  if (['AUTH','AUTHENTICATION','UNAUTHORIZED','MISSING_CREDENTIAL'].includes(code ?? '')) return '登录或凭据无效：团队模型请 /teamwork login；本地模型请检查本地凭据。';
  if(code==='RATE_LIMIT') return '模型限流：稍后再显式继续，不自动重复任务。';
  if(code==='TOOL_ACTIVATION_FAILED') return '工具条件不满足：运行 /teamwork tools 和 /teamwork plugins 检查。';
  if(['TRANSPORT','TIMEOUT','SERVER'].includes(code ?? '')) return '模型连接或服务异常：检查连接后显式继续；原始任务可能已经执行部分操作。';
  if(outcome==='aborted') return '任务已取消；历史与已完成的文件修改保留，继续前请检查现有结果。';
  if(outcome==='error' || outcome==='blocked' || outcome==='interrupted') return '任务未完成：查看 DSH 会话错误，检查权限、工具与已有修改后再继续。';
  if(outcome==='max-tokens') return '达到输出上限：检查结果后使用 /teamwork continue <后续指令>。';
  return '继续时发送新的后续指令；不会回滚文件或清空历史。';
}
export function assertIdle(agent:Pick<Agent,'status'|'inbox'>) {
  if(agent.status!=='idle') throw new Error('任务正在执行，请等待结束或先 /teamwork cancel。');
  if(agent.inbox.nextTurn.length || agent.inbox.nextStep.length) throw new Error('存在待处理输入，请先在 DSH 原生待办输入界面检查或处理，避免重复提交。');
}
export class TaskActions {
  private tickets=new WeakMap<Agent,{fingerprint:string;expires:number}>();
  private busy=new WeakSet<Agent>();
  private cancellations=new WeakMap<Agent,number>();
  constructor(private inspect: (agent:Agent)=>Promise<void>, private fingerprint:(agent:Agent)=>string,private now:()=>number=Date.now) {}
  cancel(agent:Agent) {
    this.tickets.delete(agent);
    this.cancellations.set(agent,(this.cancellations.get(agent) ?? 0)+1);
    agent.cancel({kind:'user'},{keepInbox:true});
  }
  review(agent:Agent,outcome:string) {
    assertIdle(agent);
    if(!['error','aborted','blocked','interrupted','max-tokens'].includes(outcome)) throw new Error('没有可重试的失败或中断任务，请使用 /teamwork continue <指令>。');
    this.tickets.set(agent,{fingerprint:this.fingerprint(agent),expires:this.now()+120000});
  }
  async submit(agent:Agent,text:string,retry=false) {
    assertIdle(agent);
    if(this.busy.has(agent)) throw new Error('正在检查此会话，请勿重复提交。');
    if(!text.trim() || text.length>16000) throw new Error('请输入 1–16000 字符的后续指令。');
    const cancellation=this.cancellations.get(agent) ?? 0;
    const before=this.fingerprint(agent),ticket=this.tickets.get(agent);
    this.tickets.delete(agent);
    if(retry && (!ticket || ticket.expires<this.now() || ticket.fingerprint!==before)) throw new Error('重试确认已过期或会话配置已变化，请重新运行 /teamwork retry。');
    this.busy.add(agent);
    try {
      await this.inspect(agent);
      assertIdle(agent);
      if((this.cancellations.get(agent) ?? 0)!==cancellation) throw new Error('后续指令已取消。');
      if(this.fingerprint(agent)!==before) throw new Error('检查期间会话或团队配置发生变化，请查看 /teamwork session 后重新提交。');
      agent.followup(createUserMessage({content:[{type:'text',text}],source:{kind:'user'}}));
    } finally { this.busy.delete(agent); }
  }
}
export const retryInstruction='请从当前会话的已有结果继续完成上次未完成的任务。先检查已经执行的操作与文件变化，避免重复写入、提交或执行有副作用的命令；遇到不确定的操作先向我确认。';
