import { z } from 'zod/v4';
import type { Agent } from '@deepseek-ai/dsh-agent';
declare const taskSchema: z.ZodObject<{
    task: z.ZodString;
    outcome: z.ZodString;
    failureCode: z.ZodNullable<z.ZodString>;
    turn: z.ZodNumber;
}, z.core.$strip>;
export type TaskState = z.infer<typeof taskSchema>;
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionMap {
        teamworkTask: TaskState;
        teamworkStep: StepState;
    }
}
export declare const taskProjection: {
    key: "teamworkTask";
    stateSchema: z.ZodObject<{
        task: z.ZodString;
        outcome: z.ZodString;
        failureCode: z.ZodNullable<z.ZodString>;
        turn: z.ZodNumber;
    }, z.core.$strip>;
    init: () => {
        task: string;
        outcome: string;
        failureCode: null;
        turn: number;
    };
    apply: (state: NoInfer<{
        task: string;
        outcome: string;
        failureCode: string | null;
        turn: number;
    }>, event: import("@deepseek-ai/dsh-session").SessionEvent) => {
        task: string;
        outcome: string;
        failureCode: string | null;
        turn: number;
    };
    wire: {
        viewSchema: z.ZodObject<{
            task: z.ZodString;
            outcome: z.ZodString;
            failureCode: z.ZodNullable<z.ZodString>;
            turn: z.ZodNumber;
        }, z.core.$strip>;
        view: (state: NoInfer<{
            task: string;
            outcome: string;
            failureCode: string | null;
            turn: number;
        }>) => {
            task: string;
            outcome: string;
            failureCode: string | null;
            turn: number;
        };
    };
    stateVersion: number;
};
declare const stepSchema: z.ZodObject<{
    turn: z.ZodNumber;
    count: z.ZodNumber;
    tool: z.ZodString;
    target: z.ZodString;
}, z.core.$strip>;
export type StepState = z.infer<typeof stepSchema>;
/** What a tool call works on, as the phone's session view names it; '' when its arguments name nothing. */
export declare function stepTarget(args: string): string;
/**
 * The running turn's progress for the phone's session list: how many tool calls
 * it has made and what the latest works on. A new turn starts at zero and an
 * ended one clears, so an idle session says nothing.
 */
export declare const stepProjection: {
    key: "teamworkStep";
    stateSchema: z.ZodObject<{
        turn: z.ZodNumber;
        count: z.ZodNumber;
        tool: z.ZodString;
        target: z.ZodString;
    }, z.core.$strip>;
    init: () => {
        turn: number;
        count: number;
        tool: string;
        target: string;
    };
    apply: (state: NoInfer<{
        turn: number;
        count: number;
        tool: string;
        target: string;
    }>, event: import("@deepseek-ai/dsh-session").SessionEvent) => {
        turn: number;
        count: number;
        tool: string;
        target: string;
    };
    wire: {
        viewSchema: z.ZodObject<{
            turn: z.ZodNumber;
            count: z.ZodNumber;
            tool: z.ZodString;
            target: z.ZodString;
        }, z.core.$strip>;
        view: (state: NoInfer<{
            turn: number;
            count: number;
            tool: string;
            target: string;
        }>) => {
            turn: number;
            count: number;
            tool: string;
            target: string;
        };
    };
    stateVersion: number;
};
export declare function outcomeText(outcome: string): string;
export declare function recoveryHint(code: string | null, outcome: string): "Sign-in or credentials are invalid: for a team model run /teamwork login; for a local model check its credentials." | "The model is rate limited: continue explicitly later; the task is not repeated automatically." | "A tool condition is not met: run /teamwork tools and /teamwork plugins to check." | "The model connection or service failed: check the connection, then continue explicitly; the task may already have done part of its work." | "The task was cancelled; history and finished file changes stay. Check what is there before continuing." | "The task did not finish: read the DSH session error, check permissions, tools and existing changes, then continue." | "The output limit was reached: check the result, then run /teamwork continue <instruction>." | "To continue, send a new follow-up; files are never rolled back and history is never cleared.";
export declare function assertIdle(agent: Pick<Agent, 'status' | 'inbox'>): void;
export declare class TaskActions {
    private inspect;
    private fingerprint;
    private now;
    private tickets;
    private busy;
    private cancellations;
    constructor(inspect: (agent: Agent) => Promise<void>, fingerprint: (agent: Agent) => string, now?: () => number);
    cancel(agent: Agent): void;
    review(agent: Agent, outcome: string): void;
    submit(agent: Agent, text: string, retry?: boolean): Promise<void>;
}
export declare const retryInstruction = "Continue the unfinished task from what this session has already done. First check the actions already taken and the files already changed, so nothing is written, committed or run with side effects twice; ask me before any action you are unsure of.";
export {};
//# sourceMappingURL=task-session.d.ts.map