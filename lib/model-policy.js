export class ModelPolicyService {
    ctx;
    config;
    policy = null;
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
    }
    async fetchPolicy() {
        try {
            const response = await fetch(`${this.config.apiEndpoint}/v1/teams/default/model-policy`);
            if (!response.ok)
                return;
            this.policy = await response.json();
            this.ctx.logger.info("dsh-teamwork: model policy loaded");
        }
        catch (err) {
            this.ctx.logger.warn("dsh-teamwork: failed to load model policy", err);
        }
    }
    getPolicy() {
        return this.policy;
    }
}
//# sourceMappingURL=model-policy.js.map