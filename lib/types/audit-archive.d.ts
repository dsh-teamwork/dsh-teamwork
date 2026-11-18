import { CipherSuite } from '@hpke/core';
import type { Identity } from './secure-channel.js';
export declare const suite: CipherSuite;
export declare const SEGMENT_BYTES: number;
export declare const SEGMENT_MS: number;
export interface Segment {
    v: 1;
    host: string;
    seq: number;
    prev: string;
    key: string;
    enc: string;
    ct: string;
    sig: string;
}
export interface AuditRecord {
    at: string;
    member: string;
    device: string;
    dir: 'in' | 'out';
    frame: unknown;
}
/** A string's UTF-8 bytes as the ArrayBuffer HPKE takes. */
export declare const bytesOf: (text: string) => ArrayBuffer;
/** The clear header the AEAD binds: whoever opens a segment knows these were not moved between segments. */
export declare const segmentHeader: (s: Pick<Segment, "host" | "seq" | "prev" | "key">) => string;
/** What this DSH signs, and the server checks before it keeps a segment (its `server/relay/archive.go`). */
export declare const segmentSigned: (s: Omit<Segment, "v" | "sig">) => string;
export declare const keyFingerprint: (publicKey: string) => string;
/** A frame as the archive keeps it: large strings by their length and digest. */
export declare function recordable(value: unknown): unknown;
export interface AuditArchiveOptions {
    /** Where the archive keeps its state (`<path>`) and its queue (`<path>.queue/`). */
    path: string;
    hostId(): string | undefined;
    identity(): Promise<Identity>;
    /** Uploads one segment's bytes; the server answers 201 or 200 when it holds it. */
    upload(body: string): Promise<{
        status: number;
    }>;
    log?(message: string): void;
    now?(): number;
}
export declare const auditArchivePath: (cachePath: string) => string;
export declare class AuditArchive {
    private readonly options;
    private state?;
    private records;
    private bytes;
    private timer?;
    private sealing;
    private draining?;
    private journaling;
    private publicKey?;
    constructor(options: AuditArchiveOptions);
    private get queue();
    private get journal();
    private load;
    private save;
    /** Whether an audit key is set: a shared DSH admits no member until it is. */
    ready(): Promise<boolean>;
    /** The audit key's fingerprint, or undefined before one is set. */
    fingerprint(): Promise<string | undefined>;
    /** The admin's audit public key (raw X25519, base64, from `dsh-teamwork-audit keygen`). New segments are sealed to it. */
    setKey(publicKey: string): Promise<string>;
    /** Records one frame of a member's; nothing is recorded before an audit key is set. */
    record(entry: Omit<AuditRecord, 'at'>): void;
    /** Every record made so far is in the journal on disk. */
    settled(): Promise<void>;
    /** Seals what has collected into the next segment, queues it on disk, and uploads the queue. */
    flush(): Promise<void>;
    /**
     * At start: seals what a process that stopped left in the journal, oldest batch first, unless the state says a batch
     * was sealed already, then uploads the queue. A torn last line (the process died writing it) is dropped.
     */
    recover(): Promise<void>;
    private seal;
    /** Uploads queued segments in order; one the server refuses as out of order stops the queue and is said. */
    drain(): Promise<void>;
    stop(): void;
    /**
     * Shared mode ended: what collected is sealed and sent if it can be, then the key goes, so nothing more is recorded.
     * The chain's place stays: the same shared host enabled again continues its chain rather than restarting it.
     */
    clear(): Promise<void>;
}
//# sourceMappingURL=audit-archive.d.ts.map