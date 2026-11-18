import { type Identity, type SecurePacket } from './secure-channel.js';
import { type Forwarded } from './bridge.js';
import { type PinStore } from './pin-lock.js';
/** What a paired device is, as it says when it pairs: the phone app on iOS or Android, or a web browser. */
export declare const DEVICE_KINDS: readonly ["ios", "android", "web"];
export type DeviceKind = (typeof DEVICE_KINDS)[number];
export declare class PhoneKeys {
    private readonly path;
    private state?;
    private writes;
    constructor(path: string);
    private load;
    private save;
    identity(): Promise<Identity>;
    peer(scope: string, id: string): Promise<{
        key: string;
        name: string;
        kind?: "ios" | "android" | "web" | undefined;
    }>;
    private updates;
    private update;
    trust(scope: string, id: string, key: string, name: string, kind?: DeviceKind): Promise<void>;
    forget(scope: string, id: string): Promise<void>;
    /** Forgets every phone of `scope` outside `kept`, and answers which ones went. */
    forgetExcept(scope: string, kept: ReadonlySet<string>): Promise<string[]>;
}
export declare class PhoneSecurity {
    private readonly options;
    private links;
    private opening;
    private blocked;
    private offer?;
    private epoch;
    constructor(options: {
        keys: PhoneKeys;
        scope(): Promise<string>;
        send(packet: SecurePacket): void;
        forward(frame: Forwarded): void;
        confirm(id: string): Promise<void>;
        changed(): void;
        error(error: Error): void;
        /**
         * On a shared DSH, the member a pending pairing belongs to, as the relay said when they joined; and whether their
         * invite admits this device. Absent on a personal computer, which pairs by code alone.
         */
        joining?(pairingId: string): string | undefined;
        admit?(input: {
            pairingId: string;
            userId: string;
            inviteId: string;
            secret: string;
            name: string;
        }): Promise<boolean>;
        /**
         * The PIN lock: every member's PINs, and whose PIN a pairing answers to (its member on a shared DSH, `owner` on a
         * personal computer). Without them no channel is locked.
         */
        pins?: PinStore;
        pinMember?(pairingId: string): Promise<string | undefined>;
        now?(): number;
    });
    offerCode(expiresAt: string): void;
    publicKey(): Promise<string>;
    status(id: string): {
        deviceKind?: "ios" | "android" | "web" | undefined;
        deviceName?: string | undefined;
        safetyCode: string | undefined;
        phoneConfirmed: boolean;
    };
    details(id: string): Promise<{
        status?: "pending" | undefined;
        deviceKind?: "ios" | "android" | "web" | undefined;
        deviceName?: string | undefined;
        verified: boolean;
        safetyCode: string | undefined;
        phoneConfirmed: boolean;
    }>;
    handle(frame: SecurePacket | {
        t: 'detach' | 'revoked';
        pairingId: string;
    }): Promise<void>;
    send(value: unknown): void;
    approve(id: string): Promise<void>;
    revoke(id: string): Promise<void>;
    /**
     * The relay's list of this computer's unrevoked pairings: a phone trusted here but absent from it was
     * revoked while this computer was offline (the phone no longer waits for an acknowledgement), so its
     * trust goes now.
     */
    reconcile(listed: readonly string[]): Promise<void>;
    private now;
    /** Whether a channel may carry the member's work now: unlocked, and not idle past the limit. */
    private open;
    /** Tells the phone a PIN is needed: to set one, to enter it, or that the member is locked out. */
    private askPin;
    /** `unlock` with the PIN, or `setPin`: the first PIN, or a new one with the old. */
    private pinMessage;
    /** What a locked channel answers its member's work with: the call fails, the stream ends, and nothing reaches DSH. */
    private refuseLocked;
    reset(): void;
}
//# sourceMappingURL=phone-security.d.ts.map