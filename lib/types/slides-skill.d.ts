/**
 * The `teamwork-slides` skill (`skills/teamwork-slides/` in this package): how an agent plans a talk, writes it as an
 * HTML deck with speaker notes, and publishes it with `teamwork_page`. It is registered with DSH's skill registry
 * whenever the host has one, so the presentation preset a team makes from the console's template finds it with no
 * install, and any session can use it. Its `template/` folder is the deck runtime the skill tells the agent to copy.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const SLIDES_DIR: string;
/** A SKILL.md's front matter name and description, and the body after it. */
export declare function parseSkill(text: string): {
    name: string;
    description: string;
    content: string;
};
export declare function registerSlidesSkill(ctx: Context): void;
//# sourceMappingURL=slides-skill.d.ts.map