export interface Owners {
    ownerOf(sessionId: string): Promise<string | undefined>;
    claim(sessionId: string, userId: string): Promise<void>;
}
/** The session a call names, if any: `args.request.sessionId`, or a follow's `address.sessionId`. */
export declare function namedSession(body: unknown): string | undefined;
/** The session an `$events` item is about: a summary's `sessionId`, an emit's first argument, a question's `agentId`. */
export declare function eventSession(item: unknown): string | undefined;
export declare class OwnerFilter {
    private readonly owners;
    private readonly memberOf;
    private readonly directories;
    /** Per pairing, the events it was shown that can be answered: event id → session. */
    private shown;
    constructor(owners: Owners, memberOf: (pairingId: string) => Promise<string | undefined>, directories?: () => string[]);
    private owns;
    /** Whether a call may reach DSH at all. */
    admitCall(pairingId: string, method: string, body: unknown): Promise<boolean>;
    /** What a member is answered: a new session becomes theirs, a list keeps only theirs. */
    afterCall(pairingId: string, method: string, response: unknown): Promise<unknown>;
    /** Whether a stream may open: a follow must name the member's own session; `$events` is filtered item by item. */
    admitOpen(pairingId: string, endpoint: string, payload: unknown): Promise<boolean>;
    /** An `$events` item as the member may see it, or undefined when it is about someone else's session. */
    eventFor(pairingId: string, item: unknown): Promise<unknown>;
    drop(pairingId: string): void;
}
/** The directories a session may start in: where DSH was started, then its workspaces, each once and in that order. */
export declare function startDirectories(started: string, workspaces: {
    path: string;
}[]): string[];
//# sourceMappingURL=shared-owner.d.ts.map