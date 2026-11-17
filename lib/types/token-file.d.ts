/**
 * Follows a token file written by the host's supervisor, as on a cloud computer: reads it now, and again whenever
 * it changes, including when it is replaced. `onToken` hears the trimmed contents only when they change; a missing
 * or empty file is no token. Polling (`watchFile`) is used because a supervisor replaces the file atomically,
 * which a directory watch can miss.
 */
export declare function watchTokenFile(path: string, onToken: (token: string | undefined) => Promise<void>, onError: (error: Error) => void, intervalMs?: number): {
    ready: Promise<void>;
    stop: () => void;
};
//# sourceMappingURL=token-file.d.ts.map