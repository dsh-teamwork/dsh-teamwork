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
/** Where a UTF-8 cut at the end of `bytes` must fall so no character is split: before a lead byte whose tail is missing. */
export declare function characterEnd(bytes: Uint8Array): number;
/**
 * A text file's content from byte `offset`, `FILE_LIMITS.textBytes` at most, cut between characters; `next` is where
 * the following page starts and is absent at the end. `version` says which file the pages belong to: a later page
 * asked of another version is `invalid_request`, as a document's range is. A file with a NUL byte is not text.
 */
export declare function readText(root: string, path: string, offset?: number, version?: string): Promise<{
    next?: number | undefined;
    path: string;
    text: string;
    bytes: number;
    version: string;
    offset: number;
    truncated: boolean;
}>;
/** A file's version and size, to notice a change without reading it. */
export declare function statFile(root: string, path: string): Promise<{
    version: string;
    bytes: number;
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
        missingFonts?: string[];
    }>;
}
/**
 * Transfer one display document range: a PDF, a workbook or an image as it is, or the PDF the Host renders from an
 * Office file, with the font families that rendering lacked (`missingFonts`, Office Kit's own list).
 */
export declare function readDocument(root: string, path: string, offset: number, version?: string, office?: PreviewOfficeKit): Promise<{
    version: string;
    size: number;
    offset: number;
    data: string;
    missingFonts?: undefined;
} | {
    version: string;
    size: number;
    offset: number;
    data: string;
    missingFonts: string[];
}>;
/** DSH's per-turn record of what a session changed (its `workspaceChanges` service), as far as a client needs it. */
export interface WorkspaceChanges {
    summary(sessionId: string, seq: number): {
        turn: number;
        cwd: string;
        files: {
            path: string;
            display: string;
            added: number;
            deleted: number;
            binary?: true;
            oversized?: true;
        }[];
        total: number;
        added: number;
        deleted: number;
    } | undefined;
    diff(sessionId: string, seq: number, index: number, signal: AbortSignal): Promise<{
        kind: 'text';
        path: string;
        display: string;
        before: boolean;
        after: boolean;
        coarse: boolean;
        hunks: {
            oldStart: number;
            oldLines: number;
            newStart: number;
            newLines: number;
            lines: string[];
        }[];
    } | {
        kind: 'binary' | 'oversized';
        path: string;
        display: string;
    } | undefined>;
}
/** How much of a turn's record one answer carries, so it fits one message of the encrypted channel. */
export declare const CHANGE_LIMITS: {
    files: number;
    diffBytes: number;
    lineChars: number;
};
/** The files a turn changed, with DSH's line counts: the summary its `workspace/changes` event `seq` announced. */
export declare function changeSummary(changes: WorkspaceChanges | undefined, sessionId: string, seq: number): {
    turn: number;
    total: number;
    added: number;
    deleted: number;
    files: {
        oversized?: boolean | undefined;
        binary?: boolean | undefined;
        path: string;
        display: string;
        added: number;
        deleted: number;
    }[];
};
/**
 * DSH's comparison of one changed file, before and after its turn. Only a file under the session's working directory
 * is compared, as only such a file is read: one elsewhere on the computer is `not_found`. A comparison longer than one
 * message carries is cut after a whole line (`truncated`).
 */
export declare function changeDiff(changes: WorkspaceChanges | undefined, root: string, sessionId: string, seq: number, index: number): Promise<{
    kind: "binary" | "oversized";
    path: string;
    display: string;
    before?: undefined;
    after?: undefined;
    coarse?: undefined;
    hunks?: undefined;
    truncated?: undefined;
} | {
    kind: "text";
    path: string;
    display: string;
    before: boolean;
    after: boolean;
    coarse: boolean;
    hunks: {
        oldStart: number;
        oldLines: number;
        newStart: number;
        newLines: number;
        lines: string[];
    }[];
    truncated: boolean;
}>;
export {};
//# sourceMappingURL=phone-files.d.ts.map