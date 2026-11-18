export declare const PIN: RegExp;
export declare const MAX_FAILURES = 5;
/** How long an unlocked channel stays unlocked with nothing sent on it. */
export declare const IDLE_MS: number;
export declare const pinsPath: (cachePath: string) => string;
export type PinCheck = {
    ok: true;
} | {
    ok: false;
    reason: 'unset' | 'locked';
} | {
    ok: false;
    reason: 'wrong';
    left: number;
};
export declare class PinStore {
    private readonly path;
    private state?;
    private writes;
    constructor(path: string);
    private load;
    /** One change at a time, saved before its result is known, so no guess goes uncounted. */
    private change;
    /** Whether a member has set a PIN; one who has not is asked to set one. */
    has(member: string): Promise<boolean>;
    locked(member: string): Promise<boolean>;
    /** Checks a PIN, counting a wrong one before answering; a locked member is refused even the right one. */
    check(member: string, pin: string): Promise<PinCheck>;
    /** Sets a member's PIN. Only for one with none yet, or after `check` passed with the old one. */
    set(member: string, pin: string): Promise<void>;
    /** Clears a member's PIN and lock: their next connection sets a new one. */
    clear(member: string): Promise<void>;
    /** Shared mode ended, or this DSH changed hands: every PIN goes. */
    reset(): Promise<void>;
}
//# sourceMappingURL=pin-lock.d.ts.map