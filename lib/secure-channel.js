/** Noise-authenticated native AES-GCM transport. Keep the mobile wire copy byte-identical; interop tests exercise both. */
import { noise, pureJsCrypto } from '@chainsafe/libp2p-noise';
import { privateKeyFromRaw, publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys';
import { peerIdFromPublicKey } from '@libp2p/peer-id';
import { defaultLogger } from '@libp2p/logger';
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
export const MAX_MESSAGE = 1024 * 1024;
const MAX_BUFFER = 2 * MAX_MESSAGE;
const PACKET_BYTES = 384 * 1024;
const RECORD_PLAINTEXT = PACKET_BYTES - 4 - 16;
// Reconnect before either key's counter or conservative GCM usage budget is exhausted.
const MAX_RECORDS = 0xffffffff;
const MAX_KEY_BYTES = 64 * 1024 * 1024 * 1024;
const DOMAIN = 'dsh-e2ee-aesgcm';
const encode = (value) => new TextEncoder().encode(JSON.stringify(value));
export function base64(bytes) {
    const parts = [];
    for (let i = 0; i < bytes.length; i += 4096)
        parts.push(String.fromCharCode(...bytes.subarray(i, i + 4096)));
    return btoa(parts.join(''));
}
export function unbase64(value) {
    if (value.length > 2 * MAX_MESSAGE ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
        throw new Error('invalid_ciphertext');
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function join(a, b) {
    const value = new Uint8Array(a.length + b.length);
    value.set(a);
    value.set(b, a.length);
    return value;
}
export function securePacket(value) {
    if (!value || typeof value !== 'object')
        return false;
    const f = value;
    return (f.t === 'sealed' &&
        typeof f.pairingId === 'string' &&
        f.pairingId.length > 0 &&
        f.pairingId.length <= 64 &&
        typeof f.channelId === 'string' &&
        /^[A-Za-z0-9_-]{22}$/.test(f.channelId) &&
        ['commit', 'reveal', 'noise', 'data'].includes(f.kind) &&
        typeof f.data === 'string' &&
        f.data.length <= 700000);
}
export async function deviceIdentity(seed) {
    const bytes = unbase64(seed);
    if (bytes.length !== 32)
        throw new Error('invalid_identity');
    // Import the complete Ed25519 key: recent Node versions reject JWKs with an empty public key.
    const privateKey = privateKeyFromRaw(join(bytes, ed25519.getPublicKey(bytes)));
    return { privateKey, publicKey: base64(publicKeyToProtobuf(privateKey.publicKey)) };
}
export function newChannelId(random) {
    return base64(random(16)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** Bounded async input: unauthenticated peers cannot grow a suspended handshake without limit. */
class Queue {
    items = [];
    bytes = 0;
    wake;
    ended = false;
    push(value) {
        if (this.ended)
            throw new Error('channel_closed');
        if (!value.length || this.items.length >= 1024)
            throw new Error('channel_overflow');
        if (this.bytes + value.length > MAX_BUFFER)
            throw new Error('channel_overflow');
        this.bytes += value.length;
        this.items.push(value);
        this.wake?.();
        this.wake = undefined;
    }
    /** Takes what is queued, oldest first, while it fits in `room` bytes. */
    drain(room) {
        const taken = [];
        while (this.items.length && this.items[0].length <= room) {
            const value = this.items.shift();
            this.bytes -= value.length;
            room -= value.length;
            taken.push(value);
        }
        return taken;
    }
    end() {
        this.ended = true;
        this.items = [];
        this.bytes = 0;
        this.wake?.();
        this.wake = undefined;
    }
    async *source() {
        while (!this.ended) {
            const value = this.items.shift();
            if (value) {
                this.bytes -= value.length;
                yield value;
            }
            else
                await new Promise((resolve) => {
                    this.wake = resolve;
                });
        }
    }
}
/**
 * Pairing commits to and reveals identities and fresh random salts before Noise, which prevents adaptive grinding of
 * the safety code. A channel between devices that already pinned each other's keys (`pinned`) has no code to grind and
 * goes straight to Noise XX, which authenticates both pinned keys; the platform's ADR 0071.
 */
export class SecureChannel {
    options;
    incoming = new Queue();
    outgoing = new Queue();
    records = new Queue();
    bootstrapDone = false;
    sendKey;
    receiveKey;
    sendCount = 0;
    receiveCount = 0;
    sentBytes = 0;
    receivedBytes = 0;
    remoteCommit;
    remoteReveal;
    revealSent = false;
    started = false;
    dead = false;
    salt;
    commitment;
    timer;
    flushTimer;
    wire = new Uint8Array(0);
    abort = new AbortController();
    readyState = false;
    isVerified = false;
    constructor(options) {
        this.options = options;
        this.salt = base64(options.random(32));
        this.commitment = this.commit(options.initiator, options.identity.publicKey, this.salt);
        this.timer = setTimeout(() => this.close(new Error('verification_timeout')), 20000);
    }
    get id() {
        return this.options.channelId;
    }
    start() {
        if (!this.options.pinned)
            return this.packet('commit', this.commitment);
        if (!this.options.expectedKey)
            return this.close(new Error('device_verification_required'));
        this.started = true;
        this.remoteReveal = { key: this.options.expectedKey, salt: '' };
        void this.handshake().catch((error) => this.close(error));
    }
    commit(initiator, key, salt) {
        return base64(sha256(encode([DOMAIN, this.options.pairingId, this.options.channelId, initiator, key, salt])));
    }
    packet(kind, data) {
        if (this.dead)
            return;
        this.options.send({
            t: 'sealed',
            pairingId: this.options.pairingId,
            channelId: this.options.channelId,
            kind,
            data,
        });
    }
    receive(packet) {
        if (this.dead)
            return;
        try {
            if (packet.pairingId !== this.options.pairingId || packet.channelId !== this.options.channelId)
                throw new Error('channel_mismatch');
            if (this.options.pinned && (packet.kind === 'commit' || packet.kind === 'reveal'))
                throw new Error('unexpected_commitment');
            if (packet.kind === 'commit') {
                if (this.remoteCommit || unbase64(packet.data).length !== 32)
                    throw new Error('invalid_commitment');
                this.remoteCommit = packet.data;
                this.revealSent = true;
                this.packet('reveal', JSON.stringify({ key: this.options.identity.publicKey, salt: this.salt }));
            }
            else if (packet.kind === 'reveal') {
                if (!this.remoteCommit || !this.revealSent || this.remoteReveal || packet.data.length > 512)
                    throw new Error('invalid_reveal');
                const reveal = JSON.parse(packet.data);
                if (typeof reveal.key !== 'string' ||
                    typeof reveal.salt !== 'string' ||
                    unbase64(reveal.salt).length !== 32 ||
                    this.commit(!this.options.initiator, reveal.key, reveal.salt) !== this.remoteCommit)
                    throw new Error('invalid_commitment');
                const key = publicKeyFromProtobuf(unbase64(reveal.key));
                if (key.type !== 'Ed25519' || (this.options.expectedKey && this.options.expectedKey !== reveal.key))
                    throw new Error('device_key_changed');
                this.remoteReveal = reveal;
                this.started = true;
                void this.handshake().catch((error) => this.close(error));
            }
            else {
                if (!this.started)
                    throw new Error('handshake_required');
                const bytes = unbase64(packet.data);
                if (bytes.length > PACKET_BYTES)
                    throw new Error('message_too_large');
                if (packet.kind === 'noise') {
                    if (this.bootstrapDone)
                        throw new Error('unexpected_noise');
                    this.incoming.push(bytes);
                }
                else if (packet.kind === 'data') {
                    // A fast peer may finish key import before us; bounded records wait for our keys.
                    if (bytes.length < 21)
                        throw new Error('invalid_ciphertext');
                    this.records.push(bytes);
                }
                else
                    throw new Error('invalid_ciphertext');
            }
        }
        catch (error) {
            this.close(error);
        }
    }
    flush() {
        clearTimeout(this.flushTimer);
        this.flushTimer = undefined;
        if (this.wire.length) {
            const bytes = this.wire;
            this.wire = new Uint8Array(0);
            this.packet('noise', base64(bytes));
        }
    }
    async handshake() {
        const { identity, initiator, random, expectedKey } = this.options;
        const local = { key: identity.publicKey, salt: this.salt };
        const remote = this.remoteReveal;
        const transcript = this.options.pinned
            ? encode([
                DOMAIN,
                'pinned',
                this.options.pairingId,
                this.options.channelId,
                ...(initiator ? [local.key, remote.key] : [remote.key, local.key]),
            ])
            : encode([
                DOMAIN,
                this.options.pairingId,
                this.options.channelId,
                ...(initiator ? [local, remote] : [remote, local]),
            ]);
        const crypto = {
            ...pureJsCrypto,
            generateX25519KeyPair: () => pureJsCrypto.generateX25519KeyPairFromSeed(random(32)),
        };
        const components = {
            peerId: peerIdFromPublicKey(identity.privateKey.publicKey),
            privateKey: identity.privateKey,
            logger: defaultLogger(),
        };
        // No libp2p host or stream muxer is needed: only its tested Noise XX encrypter.
        const encrypter = noise({ crypto, prologueBytes: transcript })(components);
        const network = {
            source: this.incoming.source(),
            sink: async (source) => {
                try {
                    for await (const chunk of source) {
                        if (this.dead)
                            return;
                        const bytes = chunk.subarray();
                        if (this.wire.length + bytes.length > PACKET_BYTES)
                            this.flush();
                        this.wire = join(this.wire, bytes);
                        this.flushTimer ??= setTimeout(() => this.flush(), 0);
                    }
                    this.flush();
                }
                catch (error) {
                    this.close(error);
                    throw error;
                }
            },
        };
        const settings = {
            remotePeer: peerIdFromPublicKey(publicKeyFromProtobuf(unbase64(expectedKey ?? remote.key))),
            signal: this.abort.signal,
            skipStreamMuxerNegotiation: true,
        };
        const secured = await (initiator
            ? encrypter.secureOutbound(network, settings)
            : encrypter.secureInbound(network, settings));
        if (this.dead)
            return;
        // Noise authenticates and protects a fresh, independent 256-bit key for each sending direction.
        // Business bytes bypass Noise entirely; they are encrypted only by the native AES backend.
        const rawKey = random(32);
        const keyMessage = rawKey.slice();
        const writing = Promise.resolve(secured.conn.sink((async function* () { yield keyMessage; })()));
        void writing.catch((error) => this.close(error));
        const hash = sha256(transcript);
        const digits = String(new DataView(hash.buffer, hash.byteOffset, hash.byteLength).getUint32(0) % 100000000).padStart(8, '0');
        const sendAAD = join(hash, new Uint8Array([initiator ? 1 : 0]));
        const receiveAAD = join(hash, new Uint8Array([initiator ? 0 : 1]));
        let remoteKey = new Uint8Array(0);
        let announced;
        try {
            const sendKey = await this.options.importAesKey(rawKey);
            // Our key leaves before any record sealed under it. From here this end may send: the peer is authenticated, and
            // records that reach it before its own key import wait in its bounded queue. Waiting for the peer's key first
            // would cost every channel one more trip across the relay.
            await writing;
            this.flush();
            if (this.dead)
                return;
            this.sendKey = sendKey;
            this.readyState = true;
            void this.encrypt(sendAAD).catch((error) => this.close(error));
            announced = Promise.resolve(this.options.ready(remote.key, `${digits.slice(0, 4)} ${digits.slice(4)}`));
            void announced.catch((error) => this.close(error));
            for await (const chunk of secured.conn.source) {
                remoteKey = join(remoteKey, chunk.subarray());
                if (remoteKey.length > 32)
                    throw new Error('invalid_aes_key');
                if (remoteKey.length === 32)
                    break;
            }
            if (remoteKey.length !== 32)
                throw new Error('channel_closed');
            const receiveKey = await this.options.importAesKey(remoteKey);
            if (this.dead)
                return;
            this.receiveKey = receiveKey;
        }
        finally {
            rawKey.fill(0);
            keyMessage.fill(0);
            remoteKey.fill(0);
        }
        this.bootstrapDone = true;
        this.incoming.end();
        clearTimeout(this.timer);
        if (!this.isVerified)
            this.timer = setTimeout(() => this.close(new Error('verification_timeout')), 120000);
        await announced;
        await this.decrypt(receiveAAD);
    }
    nonce(counter) {
        if (counter >= MAX_RECORDS)
            throw new Error('key_exhausted');
        const nonce = new Uint8Array(12);
        new DataView(nonce.buffer).setUint32(8, counter);
        return nonce;
    }
    async encrypt(additionalData) {
        for await (const first of this.outgoing.source()) {
            // A burst (a stream's frames as DSH sends them) goes as one record: one cipher call, one packet and one relay
            // frame instead of one each. The receiver already reads any number of length-prefixed messages from a record.
            await new Promise((resolve) => setTimeout(resolve, 0));
            if (this.dead)
                return;
            let message = first;
            for (const next of this.outgoing.drain(RECORD_PLAINTEXT - first.length))
                message = join(message, next);
            for (let offset = 0; offset < message.length; offset += RECORD_PLAINTEXT) {
                if (this.dead)
                    return;
                const plaintext = message.subarray(offset, offset + RECORD_PLAINTEXT);
                if (this.sentBytes + plaintext.length > MAX_KEY_BYTES)
                    throw new Error('key_exhausted');
                const nonce = this.nonce(this.sendCount);
                // One ordered pump prevents nonce reuse when native calls resolve asynchronously.
                const ciphertext = await this.sendKey.encrypt(plaintext, nonce, additionalData);
                if (this.dead)
                    return;
                this.sendCount++;
                this.sentBytes += plaintext.length;
                this.packet('data', base64(join(nonce.subarray(8), ciphertext)));
            }
        }
    }
    async decrypt(additionalData) {
        let buffer = new Uint8Array(0);
        for await (const record of this.records.source()) {
            if (this.dead)
                return;
            const counter = new DataView(record.buffer, record.byteOffset, record.byteLength).getUint32(0);
            if (counter !== this.receiveCount)
                throw new Error('invalid_counter');
            const ciphertext = record.subarray(4);
            if (this.receivedBytes + ciphertext.length - 16 > MAX_KEY_BYTES)
                throw new Error('key_exhausted');
            const plaintext = await this.receiveKey.decrypt(ciphertext, this.nonce(counter), additionalData);
            if (this.dead)
                return;
            this.receiveCount++;
            this.receivedBytes += plaintext.length;
            buffer = join(buffer, plaintext);
            if (buffer.length > MAX_BUFFER)
                throw new Error('message_too_large');
            while (buffer.length >= 4) {
                const length = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(0);
                if (length > MAX_MESSAGE)
                    throw new Error('message_too_large');
                if (buffer.length < 4 + length)
                    break;
                const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(4, 4 + length)));
                buffer = buffer.slice(4 + length);
                await this.options.message(value);
                if (this.dead)
                    return;
            }
        }
    }
    send(value) {
        if (this.dead || !this.readyState)
            throw new Error('handshake_required');
        const bytes = encode(value);
        if (bytes.length > MAX_MESSAGE)
            throw new Error('message_too_large');
        const length = new Uint8Array(4);
        new DataView(length.buffer).setUint32(0, bytes.length);
        this.outgoing.push(join(length, bytes));
    }
    verified() {
        this.isVerified = true;
        // The bootstrap deadline still holds until the peer's key arrives.
        if (this.bootstrapDone)
            clearTimeout(this.timer);
    }
    close(error = new Error('channel_closed')) {
        if (this.dead)
            return;
        this.dead = true;
        this.abort.abort();
        clearTimeout(this.timer);
        clearTimeout(this.flushTimer);
        this.incoming.end();
        this.outgoing.end();
        this.records.end();
        this.sendKey = undefined;
        this.receiveKey = undefined;
        this.wire.fill(0);
        this.wire = new Uint8Array(0);
        this.options.closed(error);
    }
}
//# sourceMappingURL=secure-channel.js.map