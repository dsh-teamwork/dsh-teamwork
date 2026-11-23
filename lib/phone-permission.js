/**
 * A session's permission preset as a phone or the console sees and switches it (DSH's own `/permission`, from
 * `@deepseek-ai/dsh-permission-presets`): the presets DSH offers, the session's current one, and which of them a
 * remote device may pick. A preset that leaves the workspace's sandbox or skips approval is `risky`: a client confirms
 * it once.
 */
/** A preset name as `/permission` takes it: one word, so nothing more can ride on the command line. */
export const PRESET_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export function riskyPreset(presets, name) {
    try {
        const spec = presets.resolve(name);
        return spec.sandbox === 'danger-full-access' || spec.approval === 'never';
    }
    catch {
        return true;
    }
}
export function phonePermissions(presets, session) {
    const catalog = presets.catalog();
    return {
        current: session === undefined ? null : presets.current(session),
        defaultPreset: catalog.defaultPreset,
        options: catalog.options.map((option) => {
            const risky = riskyPreset(presets, option.value);
            return { id: option.value, name: option.name, ...(option.description ? { description: option.description } : {}), risky };
        }),
    };
}
//# sourceMappingURL=phone-permission.js.map