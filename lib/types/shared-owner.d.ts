/**
 * Sessions belong to their starter on a shared DSH (the server's `docs/tech/shared-dsh.md`, "Sessions belong to
 * their starter"). DSH itself attributes nothing to an identity: every client's `$events` sees every session, and any
 * client may answer any question. So the bridge, which knows which member each pairing is, decides here what a call
 * may touch and what an event may reach:
 *
 * - `session/create` records the new session as the member's;
 * - `session/list` keeps the member's own sessions and drops sub-agents, which stay under their parent;
 * - a call or stream that names a session must name one of the member's, else DSH is never asked and the answer is
 *   `not_found`;
 * - `$events` items reach a member only for their own sessions, and `$events/result` answers only an event this
 *   member was shown;
 * - sessions with no owner (started at this DSH's keyboard, or by the agent itself) are reachable by nobody remotely.
 *
 * A personal computer has no filter: its one member owns everything.
 */
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
    /** Per pairing, the events it was shown that can be answered: event id → session. */
    private shown;
    constructor(owners: Owners, memberOf: (pairingId: string) => Promise<string | undefined>);
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
//# sourceMappingURL=shared-owner.d.ts.map