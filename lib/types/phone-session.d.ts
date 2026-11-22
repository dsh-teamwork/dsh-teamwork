/** The paired phone's session configuration, with no credentials or desktop-default mutation. */
import type { PreviewOfficeKit } from './phone-files.js';
import type { PanelState } from './panel.js';
export type PhoneFailure = 'preview_unavailable' | 'document_too_large' | 'document_empty' | 'not_text' | 'permission_refused' | 'busy' | 'not_found' | 'not_authenticated' | 'missing_tools' | 'missing_plugins' | 'preset_changed' | 'model_unavailable' | 'invalid_request' | 'unavailable' | 'file_name' | 'file_type' | 'file_too_large' | 'invalid_upload' | 'upload_expired' | 'upload_failed' | 'image_model_unsupported';
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
    /** Switches a session's permission preset as DSH's `/permission` does (src/phone-permission.ts). */
    selectPermission(request: {
        sessionId: string;
        preset: string;
    }): Promise<unknown>;
    /** The working directory a session's files are browsed under (src/phone-files.ts). */
    fileRoot(sessionId: string): Promise<string>;
    officeKit?(): PreviewOfficeKit | undefined;
    check(sessionId: string): Promise<void>;
    checkImages?(sessionId: string): Promise<void>;
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
    model?: {
        provider: string;
        model: string;
    } | undefined;
    avatar?: string | undefined;
    teamId?: string | undefined;
    teamName?: string | undefined;
    version?: number | undefined;
    id: string;
    name: string;
    description: string;
    isDefault: boolean;
}[];
//# sourceMappingURL=phone-session.d.ts.map