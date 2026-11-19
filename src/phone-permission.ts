/**
 * A session's permission preset as a phone or the console sees and switches it (DSH's own `/permission`, from
 * `@deepseek-ai/dsh-permission-presets`): the presets DSH offers, the session's current one, and which of them a
 * remote device may pick. A preset that leaves the workspace's sandbox or skips approval is `risky`: a client confirms
 * it once, and on a shared DSH no member may pick it remotely, since the machine is the team's (only its keyboard can).
 */

/** What the plugin reads of DSH's `permissionPresets` service. */
export interface PermissionPresets {
  catalog(): { options: { value: string; name: string; description?: string }[]; defaultPreset: string };
  current(session: unknown): string;
  resolve(name: string): { sandbox: string; approval: string };
}

export interface PhonePermissions {
  /** The session's preset, or `custom` when its settings match none; null for a session not started yet. */
  current: string | null;
  /** The preset a new session starts with. */
  defaultPreset: string;
  options: { id: string; name: string; description?: string; risky: boolean; allowed: boolean }[];
}

/** A preset name as `/permission` takes it: one word, so nothing more can ride on the command line. */
export const PRESET_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function riskyPreset(presets: PermissionPresets, name: string): boolean {
  try {
    const spec = presets.resolve(name);
    return spec.sandbox === 'danger-full-access' || spec.approval === 'never';
  } catch {
    return true;
  }
}

export function phonePermissions(presets: PermissionPresets, shared: boolean, session?: unknown): PhonePermissions {
  const catalog = presets.catalog();
  return {
    current: session === undefined ? null : presets.current(session),
    defaultPreset: catalog.defaultPreset,
    options: catalog.options.map((option) => {
      const risky = riskyPreset(presets, option.value);
      return { id: option.value, name: option.name, ...(option.description ? { description: option.description } : {}), risky, allowed: !(shared && risky) };
    }),
  };
}
