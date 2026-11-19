import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('installing Teamwork cannot bring its own DSH core into a host profile', () => {
  // DSH profiles use hoisted dependencies. A bundled core package can shadow the
  // upgraded host even when the Teamwork bundle itself is disabled.
  for (const field of ['dependencies', 'optionalDependencies']) {
    expect(Object.keys(manifest[field] ?? {}).filter(name => name.startsWith('@deepseek-ai/dsh-'))).toEqual([]);
  }
  // rc.3 is the first DSH whose `workspace.picker` the panel's team workspace uses.
  for (const name of ['dsh-tools', 'dsh-session-projection', 'dsh-llm-pi-ai']) {
    const pkg = `@deepseek-ai/${name}`;
    expect(manifest.peerDependencies[pkg]).toBe('>=0.2.2-rc.3 <0.3.0-0');
    expect(manifest.devDependencies[pkg]).toBe('0.2.2-rc.3');
  }
});
