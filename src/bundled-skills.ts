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
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** What the plugin uses of DSH's skill registry (`@deepseek-ai/dsh-skill`). */
interface SkillRegistry {
  register(skill: {
    name: string; description: string; content: string; source: string; path: string;
    resourceBase: { kind: 'directory'; path: string };
  }): () => void;
}

export const SKILLS_DIR = fileURLToPath(new URL('../skills/', import.meta.url));

/** The folder of each bundled skill, by name. */
export function bundledSkills() {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(SKILLS_DIR + entry.name + '/SKILL.md'))
    .map(entry => SKILLS_DIR + entry.name + '/');
}

/** A SKILL.md's front matter name and description, and the body after it. */
export function parseSkill(text: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) throw new Error('SKILL.md has no front matter');
  const field = (key: string) => new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(match[1]!)?.[1]?.trim() ?? '';
  const name = field('name'), description = field('description');
  if (!name || !description) throw new Error('SKILL.md needs a name and a description');
  return { name, description, content: match[2]!.trim() };
}

export function registerBundledSkills(ctx: Context) {
  const skills = ctx.get('skills' as never) as SkillRegistry | undefined;
  if (!skills) return;
  for (const dir of bundledSkills()) {
    const path = dir + 'SKILL.md';
    const dispose = skills.register({ ...parseSkill(readFileSync(path, 'utf8')), source: 'bundled', path, resourceBase: { kind: 'directory', path: dir } });
    ctx.effect(() => dispose);
  }
}
