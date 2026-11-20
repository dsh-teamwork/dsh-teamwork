/**
 * The `teamwork-slides` skill (`skills/teamwork-slides/` in this package): how an agent plans a talk, writes it as an
 * HTML deck with speaker notes, and publishes it with `teamwork_page`. It is registered with DSH's skill registry
 * whenever the host has one, so the presentation preset a team makes from the console's template finds it with no
 * install, and any session can use it. Its `template/` folder is the deck runtime the skill tells the agent to copy.
 */
import type { Context } from '@deepseek-ai/cordis';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** What the plugin uses of DSH's skill registry (`@deepseek-ai/dsh-skill`). */
interface SkillRegistry {
  register(skill: {
    name: string; description: string; content: string; source: string; path: string;
    resourceBase: { kind: 'directory'; path: string };
  }): () => void;
}

export const SLIDES_DIR = fileURLToPath(new URL('../skills/teamwork-slides/', import.meta.url));

/** A SKILL.md's front matter name and description, and the body after it. */
export function parseSkill(text: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) throw new Error('SKILL.md has no front matter');
  const field = (key: string) => new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(match[1]!)?.[1]?.trim() ?? '';
  const name = field('name'), description = field('description');
  if (!name || !description) throw new Error('SKILL.md needs a name and a description');
  return { name, description, content: match[2]!.trim() };
}

export function registerSlidesSkill(ctx: Context) {
  const skills = ctx.get('skills' as never) as SkillRegistry | undefined;
  if (!skills) return;
  const path = SLIDES_DIR + 'SKILL.md';
  const skill = parseSkill(readFileSync(path, 'utf8'));
  const dispose = skills.register({ ...skill, source: 'bundled', path, resourceBase: { kind: 'directory', path: SLIDES_DIR } });
  ctx.effect(() => dispose);
}
