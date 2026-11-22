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
type OfficeExtension = 'doc' | 'docx' | 'ppt' | 'pptx';
export interface PreviewOfficeKit {
    convert(request: {
        extension: OfficeExtension;
        priority: 'foreground';
        source: {
            key: string;
            version: string;
            bytes: number;
            read(signal: AbortSignal, maxBytes: number): Promise<{
                bytes: Uint8Array;
                version: string;
            }>;
        };
    }, signal: AbortSignal): Promise<{
        pdf: Uint8Array;
        generation: string;
        cacheKey: string;
    }>;
}
/** Transfer one display document range, including PDFs rendered from Office files by the Host. */
export declare function readDocument(root: string, path: string, offset: number, version?: string, office?: PreviewOfficeKit): Promise<{
    version: string;
    size: number;
    offset: number;
    data: string;
}>;
export {};
//# sourceMappingURL=phone-files.d.ts.map