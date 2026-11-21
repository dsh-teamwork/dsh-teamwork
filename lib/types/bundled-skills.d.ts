/**
 * The skills this package ships (`skills/<name>/` beside `lib/`), registered with DSH's skill registry whenever the
 * host has one, so a preset a team makes from one of the console's templates finds its method with no install, and
 * any session can use it:
 *
 * - `teamwork-slides`: plan a talk, write it as an HTML deck with speaker notes, publish it with `teamwork_page`;
 * - `teamwork-research`: research a question from sources, write a cited report, publish it with `teamwork_page`.
 *
 * Each folder holds its `SKILL.md`, the `template/` runtime the skill tells the agent to copy, and a `check.mjs` that
 * runs the runtime's own checks without a browser.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const SKILLS_DIR: string;
/** The folder of each bundled skill, by name. */
export declare function bundledSkills(): string[];
/** A SKILL.md's front matter name and description, and the body after it. */
export declare function parseSkill(text: string): {
    name: string;
    description: string;
    content: string;
};
export declare function registerBundledSkills(ctx: Context): void;
//# sourceMappingURL=bundled-skills.d.ts.map