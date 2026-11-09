import { Context } from "@deepseek-ai/cordis";
import { Config } from "./index.js";

export class SyncService {
  private ctx: Context;
  private config: Config;
  private pending: unknown[] = [];

  constructor(ctx: Context, config: Config) {
    this.ctx = ctx;
    this.config = config;
  }

  async queueSession(sessionId: string): Promise<void> {
    if (!this.config.autoSync) {
      this.ctx.logger.debug(`dsh-teamwork: auto-sync disabled, skipping ${sessionId}`);
      return;
    }
    this.pending.push({ sessionId, queuedAt: new Date().toISOString() });
    this.ctx.logger.info(`dsh-teamwork: queued session ${sessionId} for sync`);
  }

  async flush(): Promise<void> {
    if (this.pending.length === 0) return;
    // TODO: upload pending sessions to api.dsh-teamwork.com
    this.ctx.logger.info(`dsh-teamwork: flushed ${this.pending.length} pending sync items`);
    this.pending = [];
  }
}
