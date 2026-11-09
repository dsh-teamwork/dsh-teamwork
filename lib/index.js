import { z } from "@deepseek-ai/cordis";

export const name = "dsh-teamwork";

export const Config = z.object({
  apiEndpoint: z.string().default("https://api.dsh-teamwork.com"),
  autoSync: z.boolean().default(true),
  syncIntervalMs: z.number().default(300000),
});

export const inject = ["logger", "sessions"];

export function apply(ctx, config) {
  ctx.logger.info("dsh-teamwork plugin applied");

  ctx.on("ready", async () => {
    ctx.logger.info("dsh-teamwork plugin ready");
  });

  ctx.on("dispose", async () => {
    ctx.logger.info("dsh-teamwork plugin disposing");
  });
}
