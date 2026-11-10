export type PluginState = 'missing' | 'disabled' | 'version-mismatch' | 'failed' | 'pending' | 'ready' | 'unknown' | 'catalog-changed';
export declare function pluginState(expected: string, bundle: {
    version?: string;
    availability: string;
    enabled: boolean;
    error?: unknown;
    rows: {
        entryId?: string;
    }[];
} | undefined, entries: {
    entryId: string;
    enabled: boolean;
    fiberPhase: string | null;
}[], restartRequired?: boolean): PluginState;
export declare const stateText: Record<PluginState, string>;
//# sourceMappingURL=plugin-status.d.ts.map