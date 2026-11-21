import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSkill, registerSlidesSkill, SLIDES_DIR } from '../src/slides-skill.js';

describe('teamwork-slides skill', () => {
  it('ships a SKILL.md the registry accepts, beside the template it names', () => {
    const skill = parseSkill(readFileSync(SLIDES_DIR + 'SKILL.md', 'utf8'));
    expect(skill.name).toBe('teamwork-slides');
    expect(skill.description.length).toBeGreaterThan(40);
    expect(skill.content).toContain('template/index.html');
    expect(existsSync(SLIDES_DIR + 'template/index.html')).toBe(true);
    expect(existsSync(SLIDES_DIR + 'template/deck.js')).toBe(true);
    expect(existsSync(SLIDES_DIR + 'check.mjs')).toBe(true);
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(manifest.files).toContain('skills');
  });

  it('pins the PowerPoint library the deck loads by version and integrity', () => {
    const html = readFileSync(SLIDES_DIR + 'template/index.html', 'utf8');
    expect(html).toMatch(/pptxgenjs@\d+\.\d+\.\d+\/dist\/pptxgen\.bundle\.js/);
    expect(html).toMatch(/PPTX_SRI = "sha256-[A-Za-z0-9+/]{43}="/);
  });

  it('registers with the host registry and unregisters with the plugin', () => {
    const registered: { name: string; resourceBase: { path: string } }[] = [];
    let disposed = 0, effect: (() => () => void) | undefined;
    const ctx = {
      get: () => ({ register: (s: (typeof registered)[number]) => { registered.push(s); return () => { disposed++; }; } }),
      effect: (f: () => () => void) => { effect = f; },
    };
    registerSlidesSkill(ctx as never);
    expect(registered.map(s => s.name)).toEqual(['teamwork-slides']);
    expect(registered[0]!.resourceBase.path).toBe(SLIDES_DIR);
    effect!()();
    expect(disposed).toBe(1);
  });

  // check.mjs runs the checks block of the template the page runs, so the agent's check and the page's agree.
  const check = (folder: string) => {
    try { return { code: 0, issues: JSON.parse(execFileSync(process.execPath, [SLIDES_DIR + 'check.mjs', folder], { encoding: 'utf8' })) as string[] }; }
    catch (error) { const e = error as { status: number; stdout: string }; return { code: e.status, issues: JSON.parse(e.stdout) as string[] }; }
  };
  it('finds nothing wrong with the example deck', () => {
    expect(check(SLIDES_DIR + 'template')).toEqual({ code: 0, issues: [] });
  });
  it('reports what a deck would lose or lacks, and a deck.js that does not run', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deck-'));
    writeFileSync(join(dir, 'deck.js'), 'window.DECK = ' + JSON.stringify({ lang: 'en', slides: [
      { layout: 'bullets', title: 'Too much', bullets: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], notes: 'n' },
      { layout: 'table', title: 'Rows', columns: ['x'], rows: Array.from({ length: 9 }, (_, i) => [String(i)]), notes: 'n' },
      { layout: 'chart', title: 'Chart', chart: { categories: ['a', 'b'], series: [{ name: 's', values: [1] }] } },
      { layout: 'nope', title: 'x', notes: 'n' },
    ] }));
    const { code, issues } = check(dir);
    expect(code).toBe(1);
    expect(issues).toEqual([
      '1: 7 bullet lines; split the slide (at most 6)',
      '2: table shows at most 8 rows; the rest are cut off',
      '3: chart series "s" has 1 values for 2 categories',
      '3: no speaker notes',
      '4: unknown layout "nope"',
    ]);
    writeFileSync(join(dir, 'deck.js'), 'window.DECK = { slides: [');
    expect(check(dir).issues[0]).toMatch(/^deck\.js does not run/);
  });

  it('refuses a SKILL.md without its front matter', () => {
    expect(() => parseSkill('# no front matter')).toThrow(/front matter/);
    expect(() => parseSkill('---\nname: x\n---\nbody')).toThrow(/description/);
  });
});
