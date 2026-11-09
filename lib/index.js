export const name = "dsh-teamwork";

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
