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
export declare function outcomeText(outcome: string): string;
export declare function recoveryHint(code: string | null, outcome: string): "登录或凭据无效：团队模型请 /team login；本地模型请检查本地凭据。" | "模型限流：稍后再显式继续，不自动重复任务。" | "工具条件不满足：运行 /team tools 和 /team plugins 检查。" | "模型连接或服务异常：检查连接后显式继续；原始任务可能已经执行部分操作。" | "任务已取消；历史与已完成的文件修改保留，继续前请检查现有结果。" | "任务未完成：查看 DSH 会话错误，检查权限、工具与已有修改后再继续。" | "达到输出上限：检查结果后使用 /team continue <后续指令>。" | "继续时发送新的后续指令；不会回滚文件或清空历史。";
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
export declare const retryInstruction = "\u8BF7\u4ECE\u5F53\u524D\u4F1A\u8BDD\u7684\u5DF2\u6709\u7ED3\u679C\u7EE7\u7EED\u5B8C\u6210\u4E0A\u6B21\u672A\u5B8C\u6210\u7684\u4EFB\u52A1\u3002\u5148\u68C0\u67E5\u5DF2\u7ECF\u6267\u884C\u7684\u64CD\u4F5C\u4E0E\u6587\u4EF6\u53D8\u5316\uFF0C\u907F\u514D\u91CD\u590D\u5199\u5165\u3001\u63D0\u4EA4\u6216\u6267\u884C\u6709\u526F\u4F5C\u7528\u7684\u547D\u4EE4\uFF1B\u9047\u5230\u4E0D\u786E\u5B9A\u7684\u64CD\u4F5C\u5148\u5411\u6211\u786E\u8BA4\u3002";
export {};
//# sourceMappingURL=task-session.d.ts.map