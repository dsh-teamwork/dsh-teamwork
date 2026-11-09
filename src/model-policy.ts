import { Context } from "@deepseek-ai/cordis";
import { Config } from "./index";

export interface ModelPolicy {
  allowedProviders: string[];
  allowedModels: string[];
  defaultProvider: string;
  defaultModel: string;
}

export class ModelPolicyService {
  private ctx: Context;
  private config: Config;
  private policy: ModelPolicy | null = null;

  constructor(ctx: Context, config: Config) {
    this.ctx = ctx;
    this.config = config;
  }

  async fetchPolicy(): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/v1/teams/default/model-policy`);
      if (!response.ok) return;
      this.policy = await response.json() as ModelPolicy;
      this.ctx.logger.info("dsh-teamwork: model policy loaded");
    } catch (err) {
      this.ctx.logger.warn("dsh-teamwork: failed to load model policy", err);
    }
  }

  getPolicy(): ModelPolicy | null {
    return this.policy;
  }
}
