import { Context, Service, z } from "@deepseek-ai/cordis";
import { AccountService } from "./account";
import { SyncService } from "./sync";
import { TeamAssetsService } from "./assets";
import { ModelPolicyService } from "./model-policy";
import { AuditService } from "./audit";

export const name = "dsh-teamwork";

export const Config = z.object({
  apiEndpoint: z.string().default("https://api.dsh-teamwork.com"),
  autoSync: z.boolean().default(true),
  syncIntervalMs: z.number().default(300000),
});

export const inject = ["logger", "sessions"];

export interface Config {
  apiEndpoint: string;
  autoSync: boolean;
  syncIntervalMs: number;
}

export function apply(ctx: Context, config: Config) {
  const account = new AccountService(ctx, config);
  const sync = new SyncService(ctx, config);
  const assets = new TeamAssetsService(ctx, config);
  const policy = new ModelPolicyService(ctx, config);
  const audit = new AuditService(ctx, config);

  ctx.provide("dshTeamwork", {
    account,
    sync,
    assets,
    policy,
    audit,
  });

  ctx.on("ready", async () => {
    ctx.logger.info("dsh-teamwork plugin ready");
    await account.initialize();
    await assets.pullTeamAssets();
  });

  ctx.on("dispose", async () => {
    await sync.flush();
  });
}
