/** The paired phone's session configuration, with no credentials or desktop-default mutation. */
import type { PanelState } from './panel.js';
export type PhoneFailure = 'busy' | 'not_found' | 'not_authenticated' | 'missing_tools' | 'missing_plugins' | 'preset_changed' | 'model_unavailable' | 'invalid_request' | 'unavailable' | 'file_name' | 'file_type' | 'file_too_large' | 'invalid_upload' | 'upload_expired' | 'upload_failed';
export declare class PhoneSessionError extends Error {
    readonly code: PhoneFailure;
    constructor(code: PhoneFailure, message?: string);
}
export interface PhoneModel {
    provider: string;
    model: string;
    reasoningEffort?: string;
}
export interface PhoneSessionOps {
    configuration(sessionId?: string): Promise<unknown>;
    selectModel(request: PhoneModel & {
        sessionId: string;
    }): Promise<unknown>;
    check(sessionId: string): Promise<void>;
    accepted(sessionId: string, requestId: string): boolean;
}
/** Native preset ids remain the create API's ids; team metadata only enriches their presentation. */
export declare function phonePresets(state: PanelState, roster: {
    id: string;
    name?: string;
    description?: string;
    broken?: string;
    isDefault: boolean;
}[]): {
    blocked: string | null;
    tools: {
        name: string;
        required: boolean;
        state: import("./panel.js").ToolState;
    }[];
    dependencies: {
        name: string;
        version: string;
        state: import("./plugin-status.js").PluginState;
    }[];
    teamId?: string | undefined;
    teamName?: string | undefined;
    version?: number | undefined;
    model?: {
        provider: string;
        model: string;
    } | undefined;
    id: string;
    name: string;
    description: string;
    isDefault: boolean;
}[];
//# sourceMappingURL=phone-session.d.ts.map