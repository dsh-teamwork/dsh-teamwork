export class AuditService {
    ctx;
    config;
    buffer = [];
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
    }
    record(event) {
        this.buffer.push(event);
        this.ctx.logger.debug(`dsh-teamwork: audit event recorded: ${event.type}`);
    }
    async flush() {
        if (this.buffer.length === 0)
            return;
        // TODO: send buffered events to api.dsh-teamwork.com/v1/audit
        this.ctx.logger.info(`dsh-teamwork: flushed ${this.buffer.length} audit events`);
        this.buffer = [];
    }
}
//# sourceMappingURL=audit.js.map