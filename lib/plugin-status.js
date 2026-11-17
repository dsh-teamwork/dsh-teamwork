export function pluginState(expected, bundle, entries, restartRequired = false) {
    if (!bundle || bundle.availability === 'missing')
        return 'missing';
    if (bundle.error)
        return 'failed';
    if (bundle.version !== expected)
        return 'version-mismatch';
    if (!bundle.enabled)
        return 'disabled';
    const rows = bundle.rows.map(r => entries.find(e => e.entryId === r.entryId));
    if (rows.some(e => e?.fiberPhase === 'failed'))
        return 'failed';
    if (restartRequired || rows.some(e => !e || !e.enabled || e.fiberPhase !== 'active'))
        return 'pending';
    return rows.length ? 'ready' : 'unknown';
}
export const stateText = {
    missing: 'not installed: read the install note, then confirm the install', disabled: 'installed but not enabled: enable it in the DSH plugin manager',
    'version-mismatch': 'different version: check it in the local plugin manager; team actions never overwrite an installed version', failed: 'failed to load: check the diagnostics in the local plugin manager',
    pending: 'not ready: waiting to load; if the install asked for a restart, restart DSH and check again', ready: 'ready', unknown: 'cannot confirm its state: check it in the local plugin manager',
    'catalog-changed': 'missing from the catalog or its version changed: ask an admin to update the preset’s dependencies',
};
//# sourceMappingURL=plugin-status.js.map