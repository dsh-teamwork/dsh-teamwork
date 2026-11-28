/** Noise-authenticated native AES-GCM transport. Keep the mobile wire copy byte-identical; interop tests exercise both. */
import { type NoiseComponents } from '@chainsafe/libp2p-noise';
export declare const MAX_MESSAGE: number;
export declare function base64(bytes: Uint8Array): string;
export declare function unbase64(value: string): Uint8Array;
export type SecurePacket = {
    t: 'sealed';
    pairingId: string;
    channelId: string;
    kind: 'commit' | 'reveal' | 'noise' | 'data';
    data: Uint8Array;
};
export declare function securePacket(value: unknown): value is SecurePacket;
/**
 * A packet as one binary WebSocket message (the relay's `server/relay/protocol.go`, `sealedRecord`): its kind in one
 * byte (1 commit, 2 reveal, 3 noise, 4 data), the pairing id's length in one byte, the pairing id, the 22-character
 * channel id, then the record's bytes as they are. No base64 and no JSON: the relay reads the header and passes the
 * message on unchanged.
 */
export declare function encodePacket(packet: SecurePacket): Uint8Array;
/** A binary message read back into a packet, or null when it is not a well-formed one. */
export declare function decodePacket(message: ArrayBuffer | ArrayBufferView): SecurePacket | null;
export type RandomBytes = (length: number) => Uint8Array;
export interface Identity {
    privateKey: NoiseComponents['privateKey'];
    publicKey: string;
}
export declare function deviceIdentity(seed: string): Promise<Identity>;
export declare function newChannelId(random: RandomBytes): string;
/** Implemented by Expo Crypto on mobile and Node/OpenSSL on the desktop. No JS cipher fallback. */
export interface AesKey {
    encrypt(plaintext: Uint8Array, nonce: Uint8Array, additionalData: Uint8Array): Promise<Uint8Array>;
    decrypt(ciphertext: Uint8Array, nonce: Uint8Array, additionalData: Uint8Array): Promise<Uint8Array>;
}
export interface SecureOptions {
    pairingId: string;
    channelId: string;
    initiator: boolean;
    identity: Identity;
    random: RandomBytes;
    importAesKey(bytes: Uint8Array): Promise<AesKey>;
    expectedKey?: string;
    /**
     * Both ends already trust each other's key (`expectedKey`): no commitments are exchanged, Noise starts with the
     * first packet, and no safety code is compared. Pairing never uses it.
     */
    pinned?: boolean;
    send(packet: SecurePacket): void;
    ready(remoteKey: string, safetyCode: string): void | Promise<void>;
    message(value: unknown): void | Promise<void>;
    closed(error: Error): void;
}
/**
 * Pairing commits to and reveals identities and fresh random salts before Noise, which prevents adaptive grinding of
 * the safety code. A channel between devices that already pinned each other's keys (`pinned`) has no code to grind and
 * goes straight to Noise XX, which authenticates both pinned keys; the platform's ADR 0071.
 */
export declare class SecureChannel {
    private readonly options;
    private incoming;
    private outgoing;
    private records;
    private bootstrapDone;
    private sendKey?;
    private receiveKey?;
    private sendCount;
    private receiveCount;
    private sentBytes;
    private receivedBytes;
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
    private readyState;
    private isVerified;
    constructor(options: SecureOptions);
    get id(): string;
    start(): void;
    private commit;
    private packet;
    receive(packet: SecurePacket): void;
    private flush;
    private handshake;
    private nonce;
    private encrypt;
    private decrypt;
    send(value: unknown): void;
    verified(): void;
    close(error?: Error): void;
}
//# sourceMappingURL=secure-channel.d.ts.map