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
export declare class TeamAssetsService {
    private ctx;
    private config;
    private presets;
    private skills;
    constructor(ctx: Context, config: Config);
    pullTeamAssets(): Promise<void>;
    getPresets(): TeamPreset[];
    getSkills(): TeamSkill[];
}
//# sourceMappingURL=assets.d.ts.map