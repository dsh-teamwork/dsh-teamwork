import { test, expect } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { preparePlugin } from '../src/local-share.js';

test('packs exact files without running lifecycle scripts and rejects credentials before upload', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sharing test & shell-'));
  let prepared;
  try {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'teamwork-share-fixture',
        version: '1.0.0',
        files: ['index.js'],
        scripts: { prepare: "node -e \"require('fs').writeFileSync('ran-script','bad')\"" },
      }),
    );
    await writeFile(join(root, 'index.js'), 'export function apply() {}');
    prepared = await preparePlugin(root, '.', new AbortController().signal);
    expect(prepared.files).toContain('index.js');
    expect(prepared.files).toContain('package.json');
    expect(prepared.sha256).toBe(
      createHash('sha256')
        .update(await readFile(prepared.path))
        .digest('hex'),
    );
    await expect(access(join(root, 'ran-script'))).rejects.toThrow();
    await writeFile(join(root, 'index.js'), '-----BEGIN PRIVATE KEY-----');
    await expect(preparePlugin(root, '.', new AbortController().signal)).rejects.toThrow(
      'Potential credential',
    );
  } finally {
    if (prepared) await rm(prepared.directory, { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  }
}, 30000);
