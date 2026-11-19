import { teamProvider } from './platform-models.js';
export class PhoneSessionError extends Error {
    code;
    constructor(code, message = code) {
        super(message);
        this.code = code;
    }
}
/** Native preset ids remain the create API's ids; team metadata only enriches their presentation. */
export function phonePresets(state, roster) {
    return roster.map(row => {
        const team = state.presets.find(preset => `team:${preset.teamId}:${preset.id}` === row.id);
        return {
            id: row.id, name: team?.name ?? row.name ?? row.id, description: row.description ?? '', isDefault: row.isDefault,
            ...(team ? { teamId: team.teamId, teamName: team.teamName, version: team.version, ...(team.avatar ? { avatar: team.avatar } : {}), model: { provider: teamProvider(team.teamId), model: team.id } } : {}),
            blocked: row.broken ? 'preset_unavailable' : team && !team.modelAvailable ? 'model_unavailable' : team?.plugins.some(plugin => plugin.state !== 'ready') ? 'missing_plugins' : team?.tools.some(tool => tool.required && tool.state === 'missing') ? 'missing_tools' : null,
            tools: team?.tools ?? [], dependencies: team?.plugins.map(plugin => ({ name: plugin.name, version: plugin.version, state: plugin.state })) ?? [],
        };
    });
}
//# sourceMappingURL=phone-session.js.map