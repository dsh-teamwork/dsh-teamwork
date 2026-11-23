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
    /** Whether the PIN lock is on: an entry exists, even one whose PIN was reset or that is locked. */
    enabled(): Promise<boolean>;
    /** Whether a PIN is set; a reset one is not until the owner sets it again. */
    has(): Promise<boolean>;
    locked(): Promise<boolean>;
    /** Checks a PIN, counting a wrong one before answering; a locked PIN refuses even the right one. */
    check(pin: string): Promise<PinCheck>;
    /** Sets the PIN, from the panel on this computer. */
    set(pin: string): Promise<void>;
    /** Clears the PIN and its lock but keeps the lock on: no device works until the owner sets a new one. */
    resetPin(): Promise<void>;
    /** Turns the PIN lock off. */
    clear(): Promise<void>;
}
//# sourceMappingURL=pin-lock.d.ts.map