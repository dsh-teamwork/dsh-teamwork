import { test, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pageFiles, pageTeam, LIMITS } from '../src/page-tool.js';
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
