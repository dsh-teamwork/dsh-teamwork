import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const SLIDES_DIR = fileURLToPath(new URL('../skills/teamwork-slides/', import.meta.url));
/** A SKILL.md's front matter name and description, and the body after it. */
export function parseSkill(text) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
    if (!match)
        throw new Error('SKILL.md has no front matter');
    const field = (key) => new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(match[1])?.[1]?.trim() ?? '';
    const name = field('name'), description = field('description');
    if (!name || !description)
        throw new Error('SKILL.md needs a name and a description');
    return { name, description, content: match[2].trim() };
}
export function registerSlidesSkill(ctx) {
    const skills = ctx.get('skills');
    if (!skills)
        return;
    const path = SLIDES_DIR + 'SKILL.md';
    const skill = parseSkill(readFileSync(path, 'utf8'));
    const dispose = skills.register({ ...skill, source: 'bundled', path, resourceBase: { kind: 'directory', path: SLIDES_DIR } });
    ctx.effect(() => dispose);
}
//# sourceMappingURL=slides-skill.js.map