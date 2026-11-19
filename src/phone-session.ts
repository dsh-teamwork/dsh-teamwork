/** The paired phone's session configuration, with no credentials or desktop-default mutation. */
import type { PanelState } from './panel.js';

export type PhoneFailure = 'busy' | 'not_found' | 'not_authenticated' | 'missing_tools' | 'missing_plugins' | 'preset_changed' | 'model_unavailable' | 'invalid_request' | 'unavailable' | 'file_name' | 'file_type' | 'file_too_large' | 'invalid_upload' | 'upload_expired' | 'upload_failed';
export class PhoneSessionError extends Error {
  constructor(readonly code: PhoneFailure, message: string = code) { super(message); }
}
export interface PhoneModel { provider: string; model: string; reasoningEffort?: string }
export interface PhoneSessionOps {
  configuration(sessionId?: string): Promise<unknown>;
  selectModel(request: PhoneModel & { sessionId: string }): Promise<unknown>;
  check(sessionId: string): Promise<void>;
  accepted(sessionId: string, requestId: string): boolean;
}

/** Native preset ids remain the create API's ids; team metadata only enriches their presentation. */
export function phonePresets(state: PanelState, roster: { id: string; name?: string; description?: string; broken?: string; isDefault: boolean }[]) {
  return roster.map(row => {
    const team = state.presets.find(preset => `team:${preset.teamId}:${preset.id}` === row.id);
    return {
      id: row.id, name: team?.name ?? row.name ?? row.id, description: row.description ?? '', isDefault: row.isDefault,
      ...(team ? { teamId: team.teamId, teamName: team.teamName, version: team.version, ...(team.avatar ? { avatar: team.avatar } : {}), model: { provider: 'teamwork-platform', model: team.id } } : {}),
      blocked: row.broken ? 'preset_unavailable' : team && !team.modelAvailable ? 'model_unavailable' : team?.plugins.some(plugin => plugin.state !== 'ready') ? 'missing_plugins' : team?.tools.some(tool => tool.required && tool.state === 'missing') ? 'missing_tools' : null,
      tools: team?.tools ?? [], dependencies: team?.plugins.map(plugin => ({ name: plugin.name, version: plugin.version, state: plugin.state })) ?? [],
    };
  });
}
