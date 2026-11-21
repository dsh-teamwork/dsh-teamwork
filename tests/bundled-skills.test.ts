import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundledSkills, parseSkill, registerBundledSkills, SKILLS_DIR } from '../src/bundled-skills.js';

// Each skill's check.mjs runs the checks block of the template the page runs, so the agent's check and the page's agree.
const check = (skill: string, folder: string) => {
  try { return { code: 0, issues: JSON.parse(execFileSync(process.execPath, [SKILLS_DIR + skill + '/check.mjs', folder], { encoding: 'utf8' })) as string[] }; }
  catch (error) { const e = error as { status: number; stdout: string }; return { code: e.status, issues: JSON.parse(e.stdout) as string[] }; }
};
const folderWith = (file: string, content: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'skill-'));
  writeFileSync(join(dir, file), content);
  return dir;
};

describe('bundled skills', () => {
  it('ships each skill with a SKILL.md the registry accepts, its template, its example and its check', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(manifest.files).toContain('skills');
    const found = Object.fromEntries(bundledSkills().map(dir => [parseSkill(readFileSync(dir + 'SKILL.md', 'utf8')).name, dir]));
    expect(Object.keys(found).sort()).toEqual(['teamwork-research', 'teamwork-slides']);
    for (const [name, data] of [['teamwork-slides', 'deck.js'], ['teamwork-research', 'report.js']]) {
      const skill = parseSkill(readFileSync(found[name] + 'SKILL.md', 'utf8'));
      expect(skill.description.length).toBeGreaterThan(40);
      expect(skill.content).toContain('template/index.html');
      expect(skill.content).toContain('check.mjs');
      for (const file of ['template/index.html', 'template/' + data, 'check.mjs']) expect(existsSync(found[name] + file), name + ' ' + file).toBe(true);
    }
  });

  it('registers every skill with the host registry and unregisters them with the plugin', () => {
    const registered: { name: string; resourceBase: { path: string } }[] = [];
    let disposed = 0;
    const effects: (() => () => void)[] = [];
    registerBundledSkills({
      get: () => ({ register: (s: (typeof registered)[number]) => { registered.push(s); return () => { disposed++; }; } }),
      effect: (f: () => () => void) => { effects.push(f); },
    } as never);
    expect(registered.map(s => s.name).sort()).toEqual(['teamwork-research', 'teamwork-slides']);
    for (const s of registered) expect(s.resourceBase.path).toBe(SKILLS_DIR + s.name + '/');
    effects.forEach(f => f()());
    expect(disposed).toBe(2);
  });

  it('registers nothing on a host without a skill registry', () => {
    let effects = 0;
    registerBundledSkills({ get: () => undefined, effect: () => { effects++; } } as never);
    expect(effects).toBe(0);
  });

  it('refuses a SKILL.md without its front matter', () => {
    expect(() => parseSkill('# no front matter')).toThrow(/front matter/);
    expect(() => parseSkill('---\nname: x\n---\nbody')).toThrow(/description/);
  });
});

describe('teamwork-slides', () => {
  it('pins the PowerPoint library the deck loads by version and integrity', () => {
    const html = readFileSync(SKILLS_DIR + 'teamwork-slides/template/index.html', 'utf8');
    expect(html).toMatch(/pptxgenjs@\d+\.\d+\.\d+\/dist\/pptxgen\.bundle\.js/);
    expect(html).toMatch(/PPTX_SRI = "sha256-[A-Za-z0-9+/]{43}="/);
  });

  it('finds nothing wrong with the example deck', () => {
    expect(check('teamwork-slides', SKILLS_DIR + 'teamwork-slides/template')).toEqual({ code: 0, issues: [] });
  });

  it('reports what a deck would lose or lacks, and a deck.js that does not run', () => {
    const dir = folderWith('deck.js', 'window.DECK = ' + JSON.stringify({ lang: 'en', slides: [
      { layout: 'bullets', title: 'Too much', bullets: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], notes: 'n' },
      { layout: 'table', title: 'Rows', columns: ['x'], rows: Array.from({ length: 9 }, (_, i) => [String(i)]), notes: 'n' },
      { layout: 'chart', title: 'Chart', chart: { categories: ['a', 'b'], series: [{ name: 's', values: [1] }] } },
      { layout: 'nope', title: 'x', notes: 'n' },
    ] }));
    expect(check('teamwork-slides', dir)).toEqual({ code: 1, issues: [
      '1: 7 bullet lines; split the slide (at most 6)',
      '2: table shows at most 8 rows; the rest are cut off',
      '3: chart series "s" has 1 values for 2 categories',
      '3: no speaker notes',
      '4: unknown layout "nope"',
    ] });
    writeFileSync(join(dir, 'deck.js'), 'window.DECK = { slides: [');
    expect(check('teamwork-slides', dir).issues[0]).toMatch(/^deck\.js does not run/);
  });
});

describe('teamwork-research', () => {
  it('finds nothing wrong with the example report', () => {
    expect(check('teamwork-research', SKILLS_DIR + 'teamwork-research/template')).toEqual({ code: 0, issues: [] });
  });

  it('reports citations to nothing, sources nobody can check or cites, uncited figures and a missing answer', () => {
    const dir = folderWith('report.js', 'window.REPORT = ' + JSON.stringify({
      title: 'T', lang: 'en', question: 'Q?', summary: { answer: '' },
      sections: [{ title: 'S', blocks: [
        { type: 'text', text: 'Revenue grew 40% last year.' },
        { type: 'text', text: 'Costs are known [1] and [3].' },
        { type: 'table', columns: ['a', 'b'], rows: [['1']] },
        { type: 'chart' },
      ] }],
      sources: [
        { id: 1, title: 'Fine', url: 'https://example.org/a', accessed: '2026-11-20', kind: 'primary' },
        { id: 2, title: 'Unused, no link', url: 'example.org/b', accessed: 'yesterday', kind: 'blog' },
      ],
    }));
    expect(check('teamwork-research', dir)).toEqual({ code: 1, issues: [
      'source 2: has no http(s) url, so nobody can check it',
      'source 2: has no accessed date (YYYY-MM-DD)',
      'source 2: kind is not primary, secondary or data',
      'section 1: table row 1 has 1 cells for 2 columns',
      'section 1: unknown block type "chart"',
      'section 1: a figure has no citation: "Revenue grew 40% last year."',
      'section 1: cites [3], which is not in sources',
      'source 2: is never cited',
      'source 1: has no quote from the page that supports what cites it',
      'summary: no answer to the question',
    ] });
    writeFileSync(join(dir, 'report.js'), 'window.REPORT = {');
    expect(check('teamwork-research', dir).issues[0]).toMatch(/^report\.js does not run/);
  });
});
