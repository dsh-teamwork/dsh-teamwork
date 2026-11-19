import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TeamWorkspaces, teamWorkspacesPath } from '../src/team-workspaces.js';

const store = async () => {
  const path = teamWorkspacesPath(join(await mkdtemp(join(tmpdir(), 'tw-workspaces-')), 'cache.json'));
  return { path, workspaces: new TeamWorkspaces(path) };
};

describe('team workspaces', () => {
  it('gives every team the directory DSH started in until one is chosen', async () => {
    const { workspaces } = await store();
    expect(await workspaces.defaults(['a', 'b'], ['/start', '/work'])).toEqual({ a: '/start', b: '/start' });
  });

  it('keeps a chosen default across instances, in a private file', async () => {
    const { path, workspaces } = await store();
    await workspaces.set('b', '/work');
    expect(await new TeamWorkspaces(path).defaults(['a', 'b'], ['/start', '/work'])).toEqual({ a: '/start', b: '/work' });
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ b: '/work' });
    if (process.platform !== 'win32') expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('falls back to the start directory when a chosen one is no longer offered', async () => {
    const { workspaces } = await store();
    await workspaces.set('a', '/gone');
    expect(await workspaces.defaults(['a'], ['/start', '/work'])).toEqual({ a: '/start' });
  });

  it('names no default where no directory is offered', async () => {
    const { workspaces } = await store();
    expect(await workspaces.defaults(['a'], [])).toEqual({});
  });
});
