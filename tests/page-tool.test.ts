import { test, expect } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pageFiles, pageTeam, pageUrl, writePage, LIMITS } from '../src/page-tool.js';
import type { Snapshot } from '../src/client.js';

const team = (teamId: string) => ({ teamId, teamName: teamId.toUpperCase(), role: 'member' as const, configs: [] });

test('a page goes to the preset team, the only team, or the one named among the member\'s', () => {
  const two: Snapshot = { teams: [team('a'), team('b')] };
  expect(pageTeam(two, 'b', undefined)).toBe('b');
  expect(pageTeam({ teams: [team('a')] }, undefined, undefined)).toBe('a');
  expect(pageTeam(two, undefined, 'a')).toBe('a');
  expect(() => pageTeam(two, undefined, undefined)).toThrow(/Name the team with teamId: A \(a\), B \(b\)/);
  expect(() => pageTeam(two, undefined, 'z')).toThrow(/one of your teams/);
  expect(() => pageTeam(two, 'a', 'b')).toThrow(/preset belongs to team a/);
  expect(() => pageTeam({ teams: [] }, undefined, undefined)).toThrow(/join a team/);
});

test('a page folder is read whole, inside the workspace, and refused before upload when it breaks a rule', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'page-tool-'));
  const outside = await mkdtemp(join(tmpdir(), 'page-outside-'));
  try {
    await mkdir(join(cwd, 'report', 'img'), { recursive: true });
    await writeFile(join(cwd, 'report', 'index.html'), '<h1>Q4</h1>');
    await writeFile(join(cwd, 'report', 'img', 'chart.svg'), '<svg/>');
    const files = await pageFiles(cwd, 'html', undefined, 'report');
    expect(files.map((f) => f.path)).toEqual(['img/chart.svg', 'index.html']);

    expect((await pageFiles(cwd, 'markdown', '# Notes', undefined))).toEqual([{ path: 'index.md', bytes: new TextEncoder().encode('# Notes') }]);
    await expect(pageFiles(cwd, 'html', undefined, outside)).rejects.toThrow(/inside this session's workspace/);
    await expect(pageFiles(cwd, 'html', undefined, '../')).rejects.toThrow(/inside this session's workspace/);
    await expect(pageFiles(cwd, 'svg', undefined, 'report')).rejects.toThrow(/needs index.svg/);

    await writeFile(join(cwd, 'report', '.env'), 'SECRET=1');
    await expect(pageFiles(cwd, 'html', undefined, 'report')).rejects.toThrow(/Hidden files are not published: .env/);
    await rm(join(cwd, 'report', '.env'));

    await writeFile(join(outside, 'secret.txt'), 'x');
    await symlink(join(outside, 'secret.txt'), join(cwd, 'report', 'leak.txt'));
    await expect(pageFiles(cwd, 'html', undefined, 'report')).rejects.toThrow(/Links are not published: leak.txt/);
    await rm(join(cwd, 'report', 'leak.txt'));

    await writeFile(join(cwd, 'report', 'big.png'), Buffer.alloc(LIMITS.fileBytes + 1));
    await expect(pageFiles(cwd, 'html', undefined, 'report')).rejects.toThrow(/at most 5 MiB: big.png/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('an opened page is written into a new or empty folder of the workspace, and nowhere else', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'page-open-'));
  const outside = await mkdtemp(join(tmpdir(), 'page-open-outside-'));
  const files = [{ path: 'index.html', bytes: new TextEncoder().encode('<h1>x</h1>') }, { path: 'img/a.svg', bytes: new TextEncoder().encode('<svg/>') }];
  try {
    expect(await writePage(cwd, 'copy', files)).toEqual(['index.html', 'img/a.svg']);
    expect(await readFile(join(cwd, 'copy', 'img', 'a.svg'), 'utf8')).toBe('<svg/>');
    // What was opened publishes again as it was.
    expect((await pageFiles(cwd, 'html', undefined, 'copy')).map((f) => f.path)).toEqual(['img/a.svg', 'index.html']);
    await expect(writePage(cwd, 'copy', files)).rejects.toThrow(/not empty/);
    await expect(writePage(cwd, join(outside, 'x'), files)).rejects.toThrow(/inside this session's workspace/);
    await expect(writePage(cwd, 'fresh', [{ path: '../escape.html', bytes: new Uint8Array() }])).rejects.toThrow(/outside the page/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('a published page links to the console route that opens it', () => {
  expect(pageUrl('https://www.dshteamwork.com', 'team_1', '8Ina8H_vD15J66EjAybnS')).toBe('https://www.dshteamwork.com/teams/team_1/pages/8Ina8H_vD15J66EjAybnS');
});
