export class TeamAssetsService {
    ctx;
    config;
    presets = [];
    skills = [];
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
    }
    async pullTeamAssets() {
        try {
            const response = await fetch(`${this.config.apiEndpoint}/v1/teams/default/assets`);
            if (!response.ok) {
                this.ctx.logger.warn("dsh-teamwork: failed to pull team assets");
                return;
            }
            const data = await response.json();
            this.presets = data.presets ?? [];
            this.skills = data.skills ?? [];
            this.ctx.logger.info(`dsh-teamwork: pulled ${this.presets.length} presets, ${this.skills.length} skills`);
        }
        catch (err) {
            this.ctx.logger.warn("dsh-teamwork: team assets pull failed", err);
        }
    }
    getPresets() {
        return this.presets;
    }
    getSkills() {
        return this.skills;
    }
}
//# sourceMappingURL=assets.js.map