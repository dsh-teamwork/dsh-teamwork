/** Authenticated Noise transport. Keep the mobile wire copy byte-identical; interop tests exercise both. */
import { noise, pureJsCrypto, type NoiseComponents } from '@chainsafe/libp2p-noise';
import { generateKeyPairFromSeed, publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys';
import { peerIdFromPublicKey } from '@libp2p/peer-id';
import { defaultLogger } from '@libp2p/logger';
import { sha256 } from '@noble/hashes/sha256';

export const MAX_MESSAGE = 1024 * 1024;
const MAX_BUFFER = 2 * MAX_MESSAGE;
const PACKET_BYTES = 384 * 1024;
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
export function base64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 4096)
    parts.push(String.fromCharCode(...bytes.subarray(i, i + 4096)));
  return btoa(parts.join(''));
}
export function unbase64(value: string): Uint8Array {
  if (
    value.length > 2 * MAX_MESSAGE ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  )
    throw new Error('invalid_ciphertext');
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function join(a: Uint8Array, b: Uint8Array) {
  const value = new Uint8Array(a.length + b.length);
  value.set(a);
  value.set(b, a.length);
  return value;
}
export type SecurePacket = {
  t: 'sealed';
  pairingId: string;
  channelId: string;
  kind: 'commit' | 'reveal' | 'noise';
  data: string;
};
export function securePacket(value: unknown): value is SecurePacket {
  if (!value || typeof value !== 'object') return false;
  const f = value as SecurePacket;
  return (
    f.t === 'sealed' &&
    typeof f.pairingId === 'string' &&
    f.pairingId.length > 0 &&
    f.pairingId.length <= 64 &&
    typeof f.channelId === 'string' &&
    /^[A-Za-z0-9_-]{22}$/.test(f.channelId) &&
    ['commit', 'reveal', 'noise'].includes(f.kind) &&
    typeof f.data === 'string' &&
    f.data.length <= 700000
  );
}
export type RandomBytes = (length: number) => Uint8Array;
export interface Identity {
  privateKey: NoiseComponents['privateKey'];
  publicKey: string;
}
export async function deviceIdentity(seed: string): Promise<Identity> {
  const bytes = unbase64(seed);
  if (bytes.length !== 32) throw new Error('invalid_identity');
  const privateKey = await generateKeyPairFromSeed('Ed25519', bytes);
  return { privateKey, publicKey: base64(publicKeyToProtobuf(privateKey.publicKey)) };
}
export function newChannelId(random: RandomBytes) {
  return base64(random(16)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Bounded async input: unauthenticated peers cannot grow a suspended handshake without limit. */
class Queue {
  private items: Uint8Array[] = [];
  private bytes = 0;
  private wake?: () => void;
  private ended = false;
  push(value: Uint8Array) {
    if (this.ended) throw new Error('channel_closed');
    if (!value.length || this.items.length >= 1024) throw new Error('channel_overflow');
    if (this.bytes + value.length > MAX_BUFFER) throw new Error('channel_overflow');
    this.bytes += value.length;
    this.items.push(value);
    this.wake?.();
    this.wake = undefined;
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
      } else
        await new Promise<void>((resolve) => {
          this.wake = resolve;
        });
    }
  }
}
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
export class SecureChannel {
  private incoming = new Queue();
  private outgoing = new Queue();
  private remoteCommit?: string;
  private remoteReveal?: { key: string; salt: string };
  private revealSent = false;
  private started = false;
  private dead = false;
  private salt: string;
  private commitment: string;
  private timer: ReturnType<typeof setTimeout>;
  private flushTimer?: ReturnType<typeof setTimeout>;
  private wire = new Uint8Array(0);
  private abort = new AbortController();
  private serial: Promise<void> = Promise.resolve();
  private readyState = false;
  constructor(private readonly options: SecureOptions) {
    this.salt = base64(options.random(32));
    this.commitment = this.commit(options.initiator, options.identity.publicKey, this.salt);
    this.timer = setTimeout(() => this.close(new Error('verification_timeout')), 20000);
  }
  get id() {
    return this.options.channelId;
  }
  start() {
    this.packet('commit', this.commitment);
  }
  private commit(initiator: boolean, key: string, salt: string) {
    return base64(
      sha256(encode(['dsh-e2ee-1', this.options.pairingId, this.options.channelId, initiator, key, salt])),
    );
  }
  private packet(kind: SecurePacket['kind'], data: string) {
    if (this.dead) return;
    this.options.send({
      t: 'sealed',
      pairingId: this.options.pairingId,
      channelId: this.options.channelId,
      kind,
      data,
    });
  }
  receive(packet: SecurePacket) {
    if (this.dead) return;
    try {
      if (packet.pairingId !== this.options.pairingId || packet.channelId !== this.options.channelId)
        throw new Error('channel_mismatch');
      if (packet.kind === 'commit') {
        if (this.remoteCommit || unbase64(packet.data).length !== 32) throw new Error('invalid_commitment');
        this.remoteCommit = packet.data;
        this.revealSent = true;
        this.packet('reveal', JSON.stringify({ key: this.options.identity.publicKey, salt: this.salt }));
      } else if (packet.kind === 'reveal') {
        if (!this.remoteCommit || !this.revealSent || this.remoteReveal || packet.data.length > 512)
          throw new Error('invalid_reveal');
        const reveal = JSON.parse(packet.data) as { key: string; salt: string };
        if (
          typeof reveal.key !== 'string' ||
          typeof reveal.salt !== 'string' ||
          unbase64(reveal.salt).length !== 32 ||
          this.commit(!this.options.initiator, reveal.key, reveal.salt) !== this.remoteCommit
        )
          throw new Error('invalid_commitment');
        const key = publicKeyFromProtobuf(unbase64(reveal.key));
        if (key.type !== 'Ed25519' || (this.options.expectedKey && this.options.expectedKey !== reveal.key))
          throw new Error('device_key_changed');
        this.remoteReveal = reveal;
        this.started = true;
        void this.handshake().catch((error) => this.close(error));
      } else {
        if (!this.started) throw new Error('handshake_required');
        this.incoming.push(unbase64(packet.data));
      }
    } catch (error) {
      this.close(error as Error);
    }
  }
  private flush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    if (this.wire.length) {
      const bytes = this.wire;
      this.wire = new Uint8Array(0);
      this.packet('noise', base64(bytes));
    }
  }
  private async handshake() {
    const { identity, initiator, random, expectedKey } = this.options;
    const local = { key: identity.publicKey, salt: this.salt };
    const remote = this.remoteReveal!;
    const transcript = encode([
      'dsh-e2ee-1',
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
    const encrypter = noise({ crypto, prologueBytes: transcript })(
      components as Parameters<ReturnType<typeof noise>>[0],
    );
    const network = {
      source: this.incoming.source(),
      sink: async (source: AsyncIterable<Uint8Array | { subarray(): Uint8Array }>) => {
        try {
          for await (const chunk of source) {
            if (this.dead) return;
            const bytes = chunk.subarray();
            if (this.wire.length + bytes.length > PACKET_BYTES) this.flush();
            this.wire = join(this.wire, bytes);
            this.flushTimer ??= setTimeout(() => this.flush(), 0);
          }
          this.flush();
        } catch (error) {
          this.close(error as Error);
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
    if (this.dead) return;
    const hash = sha256(transcript);
    const digits = String(
      new DataView(hash.buffer, hash.byteOffset, hash.byteLength).getUint32(0) % 100000000,
    ).padStart(8, '0');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.close(new Error('verification_timeout')), 120000);
    this.readyState = true;
    const pump = secured.conn.sink(this.outgoing.source());
    void Promise.resolve(pump).catch((error) => this.close(error));
    await this.options.ready(remote.key, `${digits.slice(0, 4)} ${digits.slice(4)}`);
    let buffer = new Uint8Array(0);
    for await (const chunk of secured.conn.source) {
      if (this.dead) return;
      buffer = join(buffer, chunk.subarray());
      if (buffer.length > MAX_BUFFER) throw new Error('message_too_large');
      while (buffer.length >= 4) {
        const length = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(0);
        if (length > MAX_MESSAGE) throw new Error('message_too_large');
        if (buffer.length < 4 + length) break;
        const value = JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(4, 4 + length)),
        );
        buffer = buffer.slice(4 + length);
        this.serial = this.serial.then(async () => {
          if (!this.dead) await this.options.message(value);
        });
        await this.serial;
      }
    }
    if (!this.dead) throw new Error('channel_closed');
  }
  send(value: unknown) {
    if (this.dead || !this.readyState) throw new Error('handshake_required');
    const bytes = encode(value);
    if (bytes.length > MAX_MESSAGE) throw new Error('message_too_large');
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, bytes.length);
    this.outgoing.push(join(length, bytes));
  }
  verified() {
    clearTimeout(this.timer);
  }
  close(error = new Error('channel_closed')) {
    if (this.dead) return;
    this.dead = true;
    this.abort.abort();
    clearTimeout(this.timer);
    clearTimeout(this.flushTimer);
    this.incoming.end();
    this.outgoing.end();
    this.wire.fill(0);
    this.wire = new Uint8Array(0);
    this.options.closed(error);
  }
}
