import { Context } from "@deepseek-ai/cordis";
import { Config } from "./index.js";

export interface TeamPreset {
  id: string;
  name: string;
  provider: string;
  model: string;
}

export interface TeamSkill {
  id: string;
  name: string;
}

export class TeamAssetsService {
  private ctx: Context;
  private config: Config;
  private presets: TeamPreset[] = [];
  private skills: TeamSkill[] = [];

  constructor(ctx: Context, config: Config) {
    this.ctx = ctx;
    this.config = config;
  }

  async pullTeamAssets(): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/v1/teams/default/assets`);
      if (!response.ok) {
        this.ctx.logger.warn("dsh-teamwork: failed to pull team assets");
        return;
      }
      const data = await response.json() as { presets: TeamPreset[]; skills: TeamSkill[] };
      this.presets = data.presets ?? [];
      this.skills = data.skills ?? [];
      this.ctx.logger.info(`dsh-teamwork: pulled ${this.presets.length} presets, ${this.skills.length} skills`);
    } catch (err) {
      this.ctx.logger.warn("dsh-teamwork: team assets pull failed", err);
    }
  }

  getPresets(): TeamPreset[] {
    return this.presets;
  }

  getSkills(): TeamSkill[] {
    return this.skills;
  }
}
