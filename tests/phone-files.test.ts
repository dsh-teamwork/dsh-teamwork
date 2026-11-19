import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FILE_LIMITS, listDirectory, readText, searchFiles } from '../src/phone-files';
import { PhoneSessionError } from '../src/phone-session';

async function workspace() {
  const outside = await mkdtemp(join(tmpdir(), 'phone-files-outside-'));
  await writeFile(join(outside, 'secret.txt'), 'outside');
  const root = await mkdtemp(join(tmpdir(), 'phone-files-'));
  await mkdir(join(root, 'src', 'deep'), { recursive: true });
  await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true });
  await writeFile(join(root, 'README.md'), '# Hello\n');
  await writeFile(join(root, 'src', 'app.ts'), 'export const app = 1;\n');
  await writeFile(join(root, 'src', 'deep', 'app.test.ts'), 'test\n');
  await writeFile(join(root, 'node_modules', 'pkg', 'app.js'), 'skipped\n');
  await writeFile(join(root, 'logo.png'), Buffer.from([0x89, 0x50, 0x00, 0x47]));
  await symlink(outside, join(root, 'escape'));
  await symlink(join(outside, 'secret.txt'), join(root, 'secret-link.txt'));
  await symlink(join(root, 'src'), join(root, 'src-link'));
  return { root, outside };
}
const refused = (code: string) => (error: unknown) => error instanceof PhoneSessionError && error.code === code;

describe('a session\'s files from a phone', () => {
  it('lists a folder, folders first, and shows a link only when it stays inside', async () => {
    const { root } = await workspace();
    const listed = await listDirectory(root, '');
    expect(listed.path).toBe('');
    expect(listed.entries.map((e) => [e.name, e.kind])).toEqual([
      ['node_modules', 'directory'], ['src', 'directory'], ['src-link', 'directory'],
      ['logo.png', 'file'], ['README.md', 'file'],
    ]);
    expect((await listDirectory(root, 'src')).entries.map((e) => e.name)).toEqual(['deep', 'app.ts']);
  });

  it('never reaches past the working directory, by .., an absolute path or a link', async () => {
    const { root, outside } = await workspace();
    await expect(listDirectory(root, '..')).rejects.toSatisfy(refused('not_found'));
    await expect(listDirectory(root, 'escape')).rejects.toSatisfy(refused('not_found'));
    await expect(readText(root, join(outside, 'secret.txt'))).rejects.toSatisfy(refused('not_found'));
    await expect(readText(root, 'secret-link.txt')).rejects.toSatisfy(refused('not_found'));
    await expect(readText(root, 'src/../../x')).rejects.toSatisfy(refused('not_found'));
    // An absolute path inside is read, and shown relative.
    expect((await readText(root, join(root, 'src', 'app.ts'))).path).toBe('src/app.ts');
  });

  it('reads text, refuses a binary file, and cuts a long one', async () => {
    const { root } = await workspace();
    expect(await readText(root, 'README.md')).toEqual({ path: 'README.md', text: '# Hello\n', bytes: 8, truncated: false });
    await expect(readText(root, 'logo.png')).rejects.toSatisfy(refused('not_text'));
    await expect(readText(root, 'src')).rejects.toSatisfy(refused('not_found'));
    await writeFile(join(root, 'big.txt'), 'a'.repeat(FILE_LIMITS.textBytes + 10));
    const big = await readText(root, 'big.txt');
    expect([big.text.length, big.truncated]).toEqual([FILE_LIMITS.textBytes, true]);
  });

  it('finds files by name, nearest first, outside node_modules and through no link', async () => {
    const { root } = await workspace();
    expect(await searchFiles(root, 'APP')).toEqual({ matches: ['src/app.ts', 'src/deep/app.test.ts'], truncated: false });
    expect((await searchFiles(root, 'secret')).matches).toEqual([]);
  });
});
