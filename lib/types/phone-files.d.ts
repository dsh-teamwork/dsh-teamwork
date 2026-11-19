/** How much one answer carries, so it fits one message of the encrypted channel with room to spare. */
export declare const FILE_LIMITS: {
    entries: number;
    matches: number;
    visited: number;
    textBytes: number;
};
export interface FileEntry {
    name: string;
    kind: 'file' | 'directory';
    bytes?: number;
}
/** One folder's entries, folders first, each by name; a link is shown as what it reaches, and dropped when that leaves. */
export declare function listDirectory(root: string, path: string): Promise<{
    path: string;
    entries: FileEntry[];
    truncated: boolean;
}>;
/** Files whose name holds `query` (any case), nearest first, walking no link and none of `SKIPPED`. */
export declare function searchFiles(root: string, query: string): Promise<{
    matches: string[];
    truncated: boolean;
}>;
/** A text file's content, its first `FILE_LIMITS.textBytes` when longer; one with a NUL byte is not text. */
export declare function readText(root: string, path: string): Promise<{
    path: string;
    text: string;
    bytes: number;
    truncated: boolean;
}>;
//# sourceMappingURL=phone-files.d.ts.map