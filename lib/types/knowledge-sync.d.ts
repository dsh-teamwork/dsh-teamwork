import { type KnowledgeManifest, type TeamworkClient } from './client.js';
/** One attachment on disk: the digest of the bytes it holds, and its path in the copy (`/`-separated). */
export interface KnowledgeFile {
    digest: string;
    path: string;
}
/** One document on disk: its team, the version it holds, its path in the copy, and its attachments by name. */
export interface KnowledgeEntry {
    teamId: string;
    version: number;
    path: string;
    attachments: Record<string, KnowledgeFile>;
}
export type KnowledgeState = Record<string, KnowledgeEntry>;
/**
 * A document's text as the copy holds it: `knowledge: {documentId}@{version}` first in its front matter. A text that
 * opens with front matter of its own gets the line inside it; any other text gets a block of its own.
 */
export declare function withFrontMatter(documentId: string, version: number, text: string): string;
/** The inverse of `withFrontMatter`: the text without the `knowledge:` line, and the document and version it named. */
export declare function stripFrontMatter(text: string): {
    text: string;
    documentId?: string;
    version?: number;
};
/**
 * A name as one path segment on any file system: no separators, control or reserved characters, no leading dot (a
 * hidden file is one grep and ripgrep skip), no trailing dot or space, no Windows device name, and bounded in length.
 */
export declare function segment(name: string): string;
/**
 * An attachment's name as one path segment, split before its extension: `segment` on the part before it, so the
 * length bound never cuts the extension off, and the extension as it is (letters and digits only).
 */
export declare function attachmentSegment(name: string): {
    stem: string;
    extension: string;
};
/**
 * Where each document of a manifest goes in the copy, and its attachments in `{title}.files/` beside it. Names that
 * come out the same after `segment`, compared without case as a case-insensitive file system would, are told apart by
 * the id of the later document, or the start of the later attachment's digest. An attachment larger than the server's
 * limit is left out, should a manifest ever list one.
 */
export declare function knowledgeLayout(manifest: KnowledgeManifest): Map<string, KnowledgeEntry>;
/** One attachment of a sync's plan: its document and name, and where its wanted bytes go. */
export interface KnowledgeAttachmentItem {
    id: string;
    teamId: string;
    name: string;
    file: KnowledgeFile;
}
/**
 * What a sync does to bring the copy from `state` to `wanted`, given the files `present` on disk: keep what holds the
 * wanted version or digest where it should be, move what holds it elsewhere, and fetch the rest. A document's text
 * and its attachments are planned apart, so a renamed document's attachments move with it whether or not its text
 * changed. Whatever is not kept, moved or fetched is left for the sweep to delete.
 */
export declare function knowledgePlan(state: KnowledgeState, wanted: Map<string, KnowledgeEntry>, present: Set<string>): {
    keep: [string, KnowledgeEntry][];
    move: {
        id: string;
        from: string;
        to: KnowledgeEntry;
    }[];
    fetch: [string, KnowledgeEntry][];
    files: {
        keep: KnowledgeAttachmentItem[];
        move: {
            item: KnowledgeAttachmentItem;
            from: string;
        }[];
        fetch: KnowledgeAttachmentItem[];
    };
};
export declare class KnowledgeSync {
    private client;
    private state;
    /** The client's session revision `state` belongs to; another revision's copy was cleared with its sign-in. */
    private revision;
    constructor(client: TeamworkClient);
    /** The copy's folder, which the agent is told about. */
    get root(): string;
    /** Reads what the last run left on disk, for the account restored with it. */
    restore(): Promise<void>;
    private current;
    /** How many documents the copy holds for the signed-in account. */
    count(): number;
    /** The synced document `id`: its team, version and path in the copy. */
    find(id: string): KnowledgeEntry | undefined;
    private readState;
    private writeState;
    /** Puts a file written beside the tree at `path` in it, replacing what is there; read-only, as every file of the copy. */
    private place;
    /**
     * Brings the copy in step with the server. A document that cannot be fetched keeps the version it had; the sync
     * then fails with how many, after doing everything else. Throws only messages that carry no credentials.
     */
    sync(signal?: AbortSignal): Promise<void>;
}
//# sourceMappingURL=knowledge-sync.d.ts.map