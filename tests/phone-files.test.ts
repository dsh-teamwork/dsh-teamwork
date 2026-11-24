import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { changeDiff, changeSummary, characterEnd, FILE_LIMITS, listDirectory, readDocument, readText, searchFiles, statFile, type WorkspaceChanges } from '../src/phone-files';
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
    expect(await readText(root, 'README.md')).toMatchObject({ path: 'README.md', text: '# Hello\n', bytes: 8, offset: 0, truncated: false });
    expect(await readText(root, 'README.md')).not.toHaveProperty('next');
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

  it('reads a long text page by page, never splitting a character, and only of the version it began with', async () => {
    const { root } = await workspace();
    // Three-byte characters, so the page limit falls inside one.
    const text = '文'.repeat(Math.ceil(FILE_LIMITS.textBytes / 3) + 10);
    await writeFile(join(root, 'long.md'), text);
    const first = await readText(root, 'long.md');
    expect(first.truncated).toBe(true);
    expect(first.next! % 3).toBe(0);
    expect(first.text).not.toContain('\ufffd');
    const second = await readText(root, 'long.md', first.next, first.version);
    expect(second).toMatchObject({ offset: first.next, truncated: false });
    expect(second).not.toHaveProperty('next');
    expect(first.text + second.text).toBe(text);
    // A later page needs the version, and a file changed since is refused.
    await expect(readText(root, 'long.md', first.next)).rejects.toSatisfy(refused('invalid_request'));
    await writeFile(join(root, 'long.md'), text + 'x');
    await expect(readText(root, 'long.md', first.next, first.version)).rejects.toSatisfy(refused('invalid_request'));
  });

  it('cuts UTF-8 only between characters', () => {
    expect(characterEnd(Buffer.from('ab'))).toBe(2);
    expect(characterEnd(Buffer.from('a文').subarray(0, 3))).toBe(1);
    expect(characterEnd(Buffer.from('a😀').subarray(0, 4))).toBe(1);
    expect(characterEnd(Buffer.from('a😀'))).toBe(5);
  });

  it('tells a file\'s version, which moves when it changes, and only under the working directory', async () => {
    const { root } = await workspace();
    const before = await statFile(root, 'README.md');
    expect(before).toMatchObject({ bytes: 8 });
    expect((await readText(root, 'README.md')).version).toBe(before.version);
    await writeFile(join(root, 'README.md'), '# Hello again\n');
    expect((await statFile(root, 'README.md')).version).not.toBe(before.version);
    await expect(statFile(root, 'secret-link.txt')).rejects.toSatisfy(refused('not_found'));
    await expect(statFile(root, 'src')).rejects.toSatisfy(refused('not_found'));
  });

  it('sends an image as it is, and an Office render\'s missing fonts', async () => {
    const { root } = await workspace();
    const image = await readDocument(root, 'logo.png', 0);
    expect(Buffer.from(image.data, 'base64')).toEqual(Buffer.from([0x89, 0x50, 0x00, 0x47]));
    await writeFile(join(root, 'deck.pptx'), 'office');
    const office = { async convert() { return { pdf: new Uint8Array([1, 2, 3]), generation: 'g', cacheKey: 'k', missingFonts: ['Microsoft YaHei'] }; } };
    expect(await readDocument(root, 'deck.pptx', 0, undefined, office)).toMatchObject({ missingFonts: ['Microsoft YaHei'] });
    await writeFile(join(root, 'notes.zip'), 'zip');
    await expect(readDocument(root, 'notes.zip', 0)).rejects.toSatisfy(refused('file_type'));
  });

  it('passes on what a turn changed, and compares only files under the working directory', async () => {
    const { root, outside } = await workspace();
    const asked: number[] = [];
    const changes: WorkspaceChanges = {
      summary: (sessionId, seq) => (sessionId === 's1' && seq === 7 ? {
        turn: 2, cwd: root, total: 3, added: 12, deleted: 4,
        files: [
          { path: 'src/app.ts', display: 'src/app.ts', added: 10, deleted: 4 },
          { path: join(outside, 'secret.txt'), display: '../secret.txt', added: 1, deleted: 0 },
          { path: 'secret-link.txt', display: 'secret-link.txt', added: 1, deleted: 0 },
        ],
      } : undefined),
      async diff(_sessionId, _seq, index) {
        asked.push(index);
        return { kind: 'text', path: 'src/app.ts', display: 'src/app.ts', before: true, after: true, coarse: false, hunks: [
          { oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: ['-old', '+new', '+x'.repeat(5000)] },
        ] };
      },
    };
    expect(changeSummary(changes, 's1', 7)).toMatchObject({ turn: 2, total: 3, added: 12, deleted: 4, files: [{ display: 'src/app.ts', added: 10 }, {}, {}] });
    expect(() => changeSummary(changes, 's1', 8)).toThrow(PhoneSessionError);
    expect(() => changeSummary(undefined, 's1', 7)).toThrow(PhoneSessionError);
    const diff = await changeDiff(changes, root, 's1', 7, 0);
    expect(diff).toMatchObject({ kind: 'text', truncated: false });
    // A very long line is cut to a bounded length.
    expect((diff as { hunks: { lines: string[] }[] }).hunks[0]!.lines[2]!.length).toBe(2000);
    // Outside the working directory, or through a link that leaves it, nothing is compared.
    await expect(changeDiff(changes, root, 's1', 7, 1)).rejects.toSatisfy(refused('not_found'));
    await expect(changeDiff(changes, root, 's1', 7, 2)).rejects.toSatisfy(refused('not_found'));
    await expect(changeDiff(changes, root, 's1', 7, 9)).rejects.toSatisfy(refused('not_found'));
    expect(asked).toEqual([0]);
  });
});
