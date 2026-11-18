export declare const INVITE_TTL_MS: number;
export declare const sharedRosterPath: (cachePath: string) => string;
export declare class SharedRoster {
    private readonly path;
    private readonly now;
    private state?;
    private writes;
    constructor(path: string, now?: () => number);
    private load;
    /** One change at a time, saved before the next begins. */
    private change;
    /** A new invite for a member; the secret is returned once and never kept. */
    invite(member: {
        userId: string;
        email: string;
    }): Promise<{
        id: string;
        secret: string;
        expiresAt: number;
    }>;
    /**
     * Spends an invite for a device when it is unspent, unexpired, for this member, and the secret matches its hash: the
     * device then belongs to the member. False changes nothing, so a wrong guess cannot spend someone's invite.
     */
    accept(input: {
        inviteId: string;
        secret: string;
        userId: string;
        pairingId: string;
        deviceName: string;
    }): Promise<boolean>;
    /** The member a paired device belongs to. */
    memberOf(pairingId: string): Promise<string>;
    ownerOf(sessionId: string): Promise<string>;
    claim(sessionId: string, userId: string): Promise<void>;
    devices(): Promise<Record<string, {
        userId: string;
        name: string;
    }>>;
    forgetDevice(pairingId: string): Promise<void>;
    /**
     * Keeps only the members the server still lists: their devices stay, everyone else's go, with their unspent
     * invites. Sessions keep their owners, so a member who comes back finds them. Returns the pairings dropped.
     */
    prune(allowed: ReadonlySet<string>): Promise<string[]>;
    /** Shared mode ended: the roster goes with it. */
    clear(): Promise<void>;
}
//# sourceMappingURL=shared-roster.d.ts.map