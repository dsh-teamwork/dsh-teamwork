import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const SKILLS_DIR = fileURLToPath(new URL('../skills/', import.meta.url));
/** The folder of each bundled skill, by name. */
export function bundledSkills() {
    return readdirSync(SKILLS_DIR, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && existsSync(SKILLS_DIR + entry.name + '/SKILL.md'))
        .map(entry => SKILLS_DIR + entry.name + '/');
}
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
export function registerBundledSkills(ctx) {
    const skills = ctx.get('skills');
    if (!skills)
        return;
    for (const dir of bundledSkills()) {
        const path = dir + 'SKILL.md';
        const dispose = skills.register({ ...parseSkill(readFileSync(path, 'utf8')), source: 'bundled', path, resourceBase: { kind: 'directory', path: dir } });
        ctx.effect(() => dispose);
    }
}
//# sourceMappingURL=bundled-skills.js.map