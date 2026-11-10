import { z } from 'zod/v4';
const schema = z.object({ teamId: z.string(), id: z.string(), version: z.number().int().positive() }).nullable();
export const presetProjection = {
    key: 'teamworkPreset', stateSchema: schema, init: () => null,
    apply: (state, event) => event.type === 'teamwork/preset' ? event.data : event.type === 'agent-preset/selected' ? null : state,
    wire: { viewSchema: schema, view: state => state }, stateVersion: 1,
};
export function sameRevision(stamp, current) {
    return stamp?.teamId === current.teamId && stamp.id === current.id && stamp.version === current.version;
}
export function toolReport(preset, lookup) {
    return [...preset.requiredTools.map(name => ({ name, required: true })), ...preset.optionalTools.map(name => ({ name, required: false }))].map(t => ({ ...t, state: lookup(t.name) }));
}
export function assertBlank(boundary) {
    if (boundary.openTurnStartSeq !== null || boundary.lastTurn > 0)
        throw new Error('会话已开始或正在执行，DSH 不允许切换预设。请新建会话后选择该预设。');
}
//# sourceMappingURL=preset-session.js.map