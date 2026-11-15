/** Authenticated Noise transport. Keep the mobile wire copy byte-identical; interop tests exercise both. */
import { type NoiseComponents } from '@chainsafe/libp2p-noise';
export declare const MAX_MESSAGE: number;
export declare function base64(bytes: Uint8Array): string;
export declare function unbase64(value: string): Uint8Array;
export type SecurePacket = {
    t: 'sealed';
    pairingId: string;
    channelId: string;
    kind: 'commit' | 'reveal' | 'noise';
    data: string;
};
export declare function securePacket(value: unknown): value is SecurePacket;
export type RandomBytes = (length: number) => Uint8Array;
export interface Identity {
    privateKey: NoiseComponents['privateKey'];
    publicKey: string;
}
export declare function deviceIdentity(seed: string): Promise<Identity>;
export declare function newChannelId(random: RandomBytes): string;
export interface SecureOptions {
    pairingId: string;
    channelId: string;
    initiator: boolean;
    identity: Identity;
    random: RandomBytes;
    expectedKey?: string;
    send(packet: SecurePacket): void;
    ready(remoteKey: string, safetyCode: string): void | Promise<void>;
    message(value: unknown): void | Promise<void>;
    closed(error: Error): void;
}
/** Commit/reveal identities and fresh random salts before Noise prevents adaptive short-code grinding. */
export declare class SecureChannel {
    private readonly options;
    private incoming;
    private outgoing;
    private remoteCommit?;
    private remoteReveal?;
    private revealSent;
    private started;
    private dead;
    private salt;
    private commitment;
    private timer;
    private flushTimer?;
    private wire;
    private abort;
    private serial;
    private readyState;
    constructor(options: SecureOptions);
    get id(): string;
    start(): void;
    private commit;
    private packet;
    receive(packet: SecurePacket): void;
    private flush;
    private handshake;
    send(value: unknown): void;
    verified(): void;
    close(error?: Error): void;
}
//# sourceMappingURL=secure-channel.d.ts.map