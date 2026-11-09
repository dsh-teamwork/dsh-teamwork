import { Context } from "@deepseek-ai/cordis";
import { Config } from "./index";

export interface AuditEvent {
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export class AuditService {
  private ctx: Context;
  private config: Config;
  private buffer: AuditEvent[] = [];

  constructor(ctx: Context, config: Config) {
    this.ctx = ctx;
    this.config = config;
  }

  record(event: AuditEvent): void {
    this.buffer.push(event);
    this.ctx.logger.debug(`dsh-teamwork: audit event recorded: ${event.type}`);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    // TODO: send buffered events to api.dsh-teamwork.com/v1/audit
    this.ctx.logger.info(`dsh-teamwork: flushed ${this.buffer.length} audit events`);
    this.buffer = [];
  }
}
