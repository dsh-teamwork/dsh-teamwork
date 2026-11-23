import { describe, expect, it } from 'vitest';
import { phonePermissions, PRESET_NAME, type PermissionPresets } from '../src/phone-permission';

const specs: Record<string, { sandbox: string; approval: string }> = {
  'read-only': { sandbox: 'read-only', approval: 'ask' },
  'workspace-write': { sandbox: 'workspace-write', approval: 'ask' },
  'danger-full-access': { sandbox: 'danger-full-access', approval: 'never' },
  auto: { sandbox: 'workspace-write', approval: 'never' },
};
const presets: PermissionPresets = {
  catalog: () => ({ options: Object.keys(specs).map((value) => ({ value, name: value })), defaultPreset: 'workspace-write' }),
  current: () => 'read-only',
  resolve: (name) => { const spec = specs[name]; if (!spec) throw new Error('unknown'); return spec; },
};

describe('a session\'s permission preset from a phone', () => {
  it('marks what leaves the workspace or skips approval as risky, and lets a device pick it', () => {
    const personal = phonePermissions(presets, {});
    expect(personal.current).toBe('read-only');
    expect(personal.options.map((o) => [o.id, o.risky, o.allowed])).toEqual([
      ['read-only', false, true], ['workspace-write', false, true], ['danger-full-access', true, true], ['auto', true, true],
    ]);
    expect(phonePermissions(presets).current).toBeNull();
  });

  it('takes a preset name as one word', () => {
    expect(PRESET_NAME.test('danger-full-access')).toBe(true);
    for (const name of ['', 'a b', 'read-only\n/x', '-flag']) expect(PRESET_NAME.test(name)).toBe(false);
  });
});
