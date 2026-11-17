import { type Identity, type SecurePacket } from './secure-channel.js';
import { type Forwarded } from './bridge.js';
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
    }>;
    private updates;
    private update;
    trust(scope: string, id: string, key: string, name: string): Promise<void>;
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
    });
    offerCode(expiresAt: string): void;
    publicKey(): Promise<string>;
    status(id: string): {
        deviceName?: string | undefined;
        safetyCode: string | undefined;
        phoneConfirmed: boolean;
    };
    details(id: string): Promise<{
        status?: "pending" | undefined;
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
    reset(): void;
}
//# sourceMappingURL=phone-security.d.ts.map