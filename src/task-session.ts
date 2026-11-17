import { z } from 'zod/v4';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection';
const taskSchema = z.object({task:z.string(),outcome:z.string(),failureCode:z.string().nullable(),turn:z.number()});
export type TaskState = z.infer<typeof taskSchema>;
declare module '@deepseek-ai/dsh-session-projection/types' { interface SessionProjectionMap { teamworkTask: TaskState; teamworkStep: StepState } }
export const taskProjection = {
  key:'teamworkTask',stateSchema:taskSchema,init:()=>({task:'',outcome:'not-started',failureCode:null,turn:0}),
  apply:(state,event)=>{
    if(event.type==='user/message' && event.data.source.kind==='user') {
      const text=event.data.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');
      return {...state,task:text.slice(0,240) || 'non-text task (see the session history)'};
    }
    if(event.type==='turn/start') return {...state,turn:event.data.turn,outcome:'running',failureCode:null};
    if(event.type==='turn/end') return {...state,outcome:event.data.reason.kind,failureCode:event.data.reason.kind==='error' ? event.data.reason.error.code ?? 'UNKNOWN' : null};
    return state;
  },wire:{viewSchema:taskSchema,view:state=>state},stateVersion:1,
} satisfies ProjectionDefinition<'teamworkTask',TaskState>;
const stepSchema = z.object({turn:z.number(),count:z.number(),tool:z.string(),target:z.string()});
export type StepState = z.infer<typeof stepSchema>;
/** The most of a step's target a session summary carries: a path or a command's first line, never a file's contents. */
const TARGET_CHARS = 120;
/** What a tool call works on, as the phone's session view names it; '' when its arguments name nothing. */
export function stepTarget(args:string) {
  try {
    const parsed:unknown = JSON.parse(args);
    if (parsed && typeof parsed==='object') for (const key of ['command','path','file_path','query','url','description']) {
      const value = (parsed as Record<string,unknown>)[key];
      if (typeof value==='string') return value.split('\n')[0]!.slice(0,TARGET_CHARS);
    }
  } catch { /* Not JSON: nothing worth showing. */ }
  return '';
}
/**
 * The running turn's progress for the phone's session list: how many tool calls
 * it has made and what the latest works on. A new turn starts at zero and an
 * ended one clears, so an idle session says nothing.
 */
export const stepProjection = {
  key:'teamworkStep',stateSchema:stepSchema,init:()=>({turn:0,count:0,tool:'',target:''}),
  apply:(state,event)=>{
    if(event.type==='turn/start') return {turn:event.data.turn,count:0,tool:'',target:''};
    if(event.type==='tool/call') return {...state,count:state.count+1,tool:event.data.name.slice(0,100),target:stepTarget(event.data.arguments)};
    if(event.type==='turn/end') return {...state,count:0,tool:'',target:''};
    return state;
  },wire:{viewSchema:stepSchema,view:state=>state},stateVersion:1,
} satisfies ProjectionDefinition<'teamworkStep',StepState>;
export function outcomeText(outcome:string) { return ({'not-started':'not started',running:'running',completed:'completed',aborted:'cancelled',blocked:'blocked',error:'failed',interrupted:'interrupted before a restart','max-tokens':'hit the output limit',forked:'inherited from a fork'} as Record<string,string>)[outcome] ?? 'unknown'; }
export function recoveryHint(code:string|null, outcome:string) {
  if (['AUTH','AUTHENTICATION','UNAUTHORIZED','MISSING_CREDENTIAL'].includes(code ?? '')) return 'Sign-in or credentials are invalid: for a team model run /teamwork login; for a local model check its credentials.';
  if(code==='RATE_LIMIT') return 'The model is rate limited: continue explicitly later; the task is not repeated automatically.';
  if(code==='TOOL_ACTIVATION_FAILED') return 'A tool condition is not met: run /teamwork tools and /teamwork plugins to check.';
  if(['TRANSPORT','TIMEOUT','SERVER'].includes(code ?? '')) return 'The model connection or service failed: check the connection, then continue explicitly; the task may already have done part of its work.';
  if(outcome==='aborted') return 'The task was cancelled; history and finished file changes stay. Check what is there before continuing.';
  if(outcome==='error' || outcome==='blocked' || outcome==='interrupted') return 'The task did not finish: read the DSH session error, check permissions, tools and existing changes, then continue.';
  if(outcome==='max-tokens') return 'The output limit was reached: check the result, then run /teamwork continue <instruction>.';
  return 'To continue, send a new follow-up; files are never rolled back and history is never cleared.';
}
export function assertIdle(agent:Pick<Agent,'status'|'inbox'>) {
  if(agent.status!=='idle') throw new Error('A task is running. Wait for it to finish, or run /teamwork cancel first.');
  if(agent.inbox.nextTurn.length || agent.inbox.nextStep.length) throw new Error('There is pending input. Check or handle it in DSH’s pending input first, so nothing is submitted twice.');
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
    if(!['error','aborted','blocked','interrupted','max-tokens'].includes(outcome)) throw new Error('There is no failed or interrupted task to retry. Use /teamwork continue <instruction>.');
    this.tickets.set(agent,{fingerprint:this.fingerprint(agent),expires:this.now()+120000});
  }
  async submit(agent:Agent,text:string,retry=false) {
    assertIdle(agent);
    if(this.busy.has(agent)) throw new Error('This session is being checked; do not submit again.');
    if(!text.trim() || text.length>16000) throw new Error('Enter a follow-up of 1 to 16000 characters.');
    const cancellation=this.cancellations.get(agent) ?? 0;
    const before=this.fingerprint(agent),ticket=this.tickets.get(agent);
    this.tickets.delete(agent);
    if(retry && (!ticket || ticket.expires<this.now() || ticket.fingerprint!==before)) throw new Error('The retry confirmation expired, or the session configuration changed. Run /teamwork retry again.');
    this.busy.add(agent);
    try {
      await this.inspect(agent);
      assertIdle(agent);
      if((this.cancellations.get(agent) ?? 0)!==cancellation) throw new Error('The follow-up was cancelled.');
      if(this.fingerprint(agent)!==before) throw new Error('The session or team configuration changed during the check. Run /teamwork session, then submit again.');
      agent.followup(createUserMessage({content:[{type:'text',text}],source:{kind:'user'}}));
    } finally { this.busy.delete(agent); }
  }
}
// Sent to the model as the member's follow-up; it answers in the conversation's own language.
export const retryInstruction='Continue the unfinished task from what this session has already done. First check the actions already taken and the files already changed, so nothing is written, committed or run with side effects twice; ask me before any action you are unsure of.';
