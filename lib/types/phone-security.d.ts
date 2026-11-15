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
    reset(): void;
}
//# sourceMappingURL=phone-security.d.ts.map