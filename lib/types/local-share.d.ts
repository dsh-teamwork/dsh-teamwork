export interface PreparedPlugin {
    path: string;
    directory: string;
    package: string;
    version: string;
    sha256: string;
    size: number;
    files: string[];
}
export declare function preparePlugin(cwd: string, input: string, signal: AbortSignal): Promise<PreparedPlugin>;
//# sourceMappingURL=local-share.d.ts.map