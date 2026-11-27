import { importAesKey } from '../src/aes-gcm.js';
import { randomBytes } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  SecureChannel,
  deviceIdentity,
  base64,
  newChannelId,
  unbase64,
  type SecurePacket,
  type AesKey,
} from '../src/secure-channel.js';
const until = async (predicate: () => boolean) => {
  for (let i = 0; i < 500; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out');
};
async function pair(options: {
  pin?: string;
  intercept?: (f: SecurePacket) => SecurePacket;
  aes?: (bytes: Uint8Array) => Promise<AesKey>;
} = {}) {
  const a = await deviceIdentity(base64(randomBytes(32))),
    b = await deviceIdentity(base64(randomBytes(32)));
  const sent: SecurePacket[] = [],
    errors: Error[] = [],
    messages: unknown[] = [],
    codes: string[] = [];
  const channelId = newChannelId((n) => randomBytes(n));
  const common = {
    importAesKey: options.aes ?? importAesKey,
    pairingId: 'pair',
    channelId,
    random: (n: number) => randomBytes(n),
    ready: (_key: string, code: string) => {
      codes.push(code);
    },
    closed: (error: Error) => {
      errors.push(error);
    },
  };
  const phone = new SecureChannel({
    ...common,
    initiator: true,
    identity: a,
    expectedKey: options.pin,
    send: (f) => {
      sent.push(f);
      queueMicrotask(() => host.receive(options.intercept?.(f) ?? f));
    },
    message: (value) => {
      messages.push(value);
    },
  });
  const host = new SecureChannel({
    ...common,
    initiator: false,
    identity: b,
    send: (f) => {
      sent.push(f);
      queueMicrotask(() => phone.receive(f));
    },
    message: (value) => {
      messages.push(value);
    },
  });
  phone.start();
  host.start();
  await until(() => codes.length === 2 || errors.length > 0);
  return {
    phone,
    host,
    sent,
    errors,
    messages,
    codes,
    close: () => {
      phone.close();
      host.close();
    },
  };
}
describe('authenticated encrypted channel', () => {
  it('matches security codes and transports large records without leaking application content', async () => {
    const p = await pair();
    try {
      expect(p.codes[0]).toBe(p.codes[1]);
      p.phone.verified();
      p.host.verified();
      const noiseFrames = p.sent.filter(f => f.kind === 'noise').length;
      p.phone.send({ method: 'session/prompt', text: 'PRIVATE_SENTINEL', data: 'x'.repeat(1000000) });
      await until(() => p.messages.length === 1);
      expect((p.messages[0] as any).text).toBe('PRIVATE_SENTINEL');
      expect(JSON.stringify(p.sent)).not.toContain('PRIVATE_SENTINEL');
      expect(JSON.stringify(p.sent)).not.toContain('session/prompt');
      expect(p.sent.every((frame) => JSON.stringify(frame).length < 1024 * 1024)).toBe(true);
      expect(p.sent.filter(f => f.kind === 'noise')).toHaveLength(noiseFrames);
      expect(p.sent.filter(f => f.kind === 'data').length).toBeGreaterThan(1);
      const ciphertext = p.sent.filter((f) => f.kind === 'data').at(-1)!;
      p.host.receive(ciphertext);
      await until(() => p.errors.length > 0);
      expect(p.messages).toHaveLength(1);
    } finally {
      p.close();
    }
  });
  it('refuses a substituted pinned device identity', async () => {
    const identity = await deviceIdentity(base64(randomBytes(32)));
    const p = await pair({ pin: identity.publicKey });
    try {
      expect(p.errors.some((e) => e.message === 'device_key_changed')).toBe(true);
      expect(p.messages).toHaveLength(0);
    } finally {
      p.close();
    }
  });
  it('rejects a changed commitment before any business traffic', async () => {
    const p = await pair({
      intercept: (f) => {
        if (f.kind !== 'reveal') return f;
        const reveal = JSON.parse(f.data);
        const salt = unbase64(reveal.salt); salt[0] ^= 1;
        return { ...f, data: JSON.stringify({ ...reveal, salt: base64(salt) }) };
      },
    });
    try {
      expect(p.errors.length).toBeGreaterThan(0);
      expect(p.messages).toHaveLength(0);
    } finally {
      p.close();
    }
  });
});

it('rejects modified authenticated ciphertext before delivering a message', async () => {
  let tamper = false;
  const p = await pair({
    intercept: (frame) => {
      if (!tamper || frame.kind !== 'data') return frame;
      const bytes = unbase64(frame.data);
      bytes[10] ^= 1;
      return { ...frame, data: base64(bytes) };
    },
  });
  try {
    p.phone.verified();
    p.host.verified();
    tamper = true;
    p.phone.send({ text: 'must never be delivered' });
    await until(() => p.errors.length > 0);
    expect(p.messages).toHaveLength(0);
  } finally {
    p.close();
  }
});
it('cannot reveal identity contributions before receiving their commitment', async () => {
  const p = await pair({
    intercept: (frame) => (frame.kind === 'commit' ? { ...frame, kind: 'reveal', data: '{}' } : frame),
  });
  try {
    expect(p.errors.some((error) => error.message === 'invalid_reveal')).toBe(true);
    expect(p.messages).toHaveLength(0);
  } finally {
    p.close();
  }
});

it('closes on empty ciphertext instead of allowing an unbounded zero-byte input queue', async () => {
  const p = await pair();
  try {
    p.phone.verified(); p.host.verified();
    const frame = p.sent.find(f => f.kind === 'noise')!;
    p.host.receive({ ...frame, kind: 'data', data: '' });
    expect(p.errors.some(error => error.message === 'invalid_ciphertext')).toBe(true);
    expect(p.messages).toHaveLength(0);
  } finally { p.close(); }
});

it('derives the RFC 8032 Ed25519 identity from an existing seed and signs with the full key', async () => {
  const seed = Buffer.from('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60', 'hex');
  const identity = await deviceIdentity(base64(seed));
  expect(Buffer.from(identity.privateKey.publicKey.raw).toString('hex')).toBe('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
  const message = new Uint8Array(0);
  const signature = await identity.privateKey.sign(message);
  expect(await identity.privateKey.publicKey.verify(message, signature)).toBe(true);
});


it('keeps asynchronous native encryption ordered across concurrent sends in both directions', async () => {
  const p = await pair({ aes: async bytes => {
    const key = await importAesKey(bytes);
    return { ...key, encrypt: async (...args) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 3));
      return key.encrypt(...args);
    }};
  }});
  try {
    for (let i = 0; i < 20; i++) { p.phone.send({ from: 'phone', i }); p.host.send({ from: 'host', i }); }
    await until(() => p.messages.length === 40 || p.errors.length > 0);
    expect(p.errors).toHaveLength(0);
    for (const from of ['phone', 'host'])
      expect(p.messages.filter((m: any) => m.from === from).map((m: any) => m.i)).toEqual(Array.from({length: 20}, (_, i) => i));
  } finally { p.close(); }
});

describe('a channel between devices that already pinned each other', () => {
  async function pinned(options: { phoneExpects?: string; hostExpects?: string; hostPinned?: boolean; hostFlights?: number } = {}) {
    let hostSent = 0;
    const a = await deviceIdentity(base64(randomBytes(32))), b = await deviceIdentity(base64(randomBytes(32)));
    const sent: SecurePacket[] = [], errors: Error[] = [], messages: unknown[] = [], ready: string[] = [];
    const common = { importAesKey, pairingId: 'pair', channelId: newChannelId((n) => randomBytes(n)), random: (n: number) => randomBytes(n), closed: (e: Error) => { errors.push(e); } };
    const host: SecureChannel = new SecureChannel({ ...common, initiator: false, identity: b, expectedKey: options.hostExpects ?? a.publicKey, pinned: options.hostPinned ?? true,
      send: (f) => { sent.push(f); if (hostSent++ < (options.hostFlights ?? Infinity)) queueMicrotask(() => phone.receive(f)); }, ready: () => { ready.push('host'); }, message: (v) => { messages.push(v); } });
    const phone: SecureChannel = new SecureChannel({ ...common, initiator: true, identity: a, expectedKey: options.phoneExpects ?? b.publicKey, pinned: true,
      send: (f) => { sent.push(f); queueMicrotask(() => host.receive(f)); }, ready: () => { ready.push('phone'); phone.send({ early: true }); }, message: (v) => { messages.push(v); } });
    host.start();
    phone.start();
    return { phone, host, sent, errors, messages, ready, close: () => { phone.close(); host.close(); } };
  }

  it('opens with Noise alone, exchanges no commitments, and carries work sent as soon as this end is ready', async () => {
    const p = await pinned();
    try {
      await until(() => p.messages.length === 1 || p.errors.length > 0);
      expect(p.errors).toHaveLength(0);
      expect(p.messages).toEqual([{ early: true }]);
      expect(p.sent.some((f) => f.kind === 'commit' || f.kind === 'reveal')).toBe(false);
      p.host.send({ answer: 1 });
      await until(() => p.messages.length === 2);
      expect(p.messages[1]).toEqual({ answer: 1 });
    } finally { p.close(); }
  });

  it('delivers the phone’s first work with nothing from the computer after its one Noise reply', async () => {
    const p = await pinned({ hostFlights: 1 });
    try {
      await until(() => p.messages.length === 1 || p.errors.length > 0);
      expect(p.messages).toEqual([{ early: true }]);
    } finally { p.close(); }
  });

  it('refuses a key other than the pinned one, at either end', async () => {
    const other = (await deviceIdentity(base64(randomBytes(32)))).publicKey;
    for (const options of [{ phoneExpects: other }, { hostExpects: other }]) {
      const p = await pinned(options);
      try {
        await until(() => p.errors.length > 0);
        expect(p.messages).toHaveLength(0);
      } finally { p.close(); }
    }
  });

  it('refuses commitments on a pinned channel', async () => {
    const p = await pinned({ hostPinned: false });
    try {
      await until(() => p.errors.length > 0);
      expect(p.messages).toHaveLength(0);
    } finally { p.close(); }
  });
});

it('sends a burst of messages as one record, delivered in order', async () => {
  const p = await pair();
  try {
    const before = p.sent.filter(f => f.kind === 'data' && f.pairingId === 'pair').length;
    for (let i = 0; i < 50; i++) p.host.send({ delta: i });
    await until(() => p.messages.length === 50 || p.errors.length > 0);
    expect(p.errors).toHaveLength(0);
    expect(p.messages.map((m: any) => m.delta)).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(p.sent.filter(f => f.kind === 'data').length - before).toBe(1);
  } finally { p.close(); }
});

it('rejects out-of-order counters and reflected records', async () => {
  for (const reflect of [false, true]) {
    const p = await pair();
    try {
      p.phone.send({ secret: 'only the host' });
      await until(() => p.messages.length === 1);
      const packet = p.sent.find(f => f.kind === 'data')!;
      if (reflect) p.phone.receive(packet);
      else {
        const bytes = unbase64(packet.data);
        new DataView(bytes.buffer).setUint32(0, 2);
        p.host.receive({...packet, data: base64(bytes)});
      }
      await until(() => p.errors.length > 0);
      expect(p.messages).toHaveLength(1);
    } finally { p.close(); }
  }
});

it('fails closed when the native cipher fails and never sends business through Noise', async () => {
  const p = await pair({ aes: async bytes => {
    const key = await importAesKey(bytes);
    return { ...key, encrypt: async () => { throw new Error('native cipher unavailable'); }};
  }});
  try {
    const before = p.sent.length;
    p.phone.send({ secret: 'must stay local' });
    await until(() => p.errors.length > 0);
    expect(p.sent).toHaveLength(before);
    expect(p.messages).toHaveLength(0);
  } finally { p.close(); }
});

it('discards pending native decryption when the channel is revoked', async () => {
  let complete!: () => void;
  const p = await pair({ aes: async bytes => {
    const key = await importAesKey(bytes);
    return { ...key, decrypt: async (...args) => {
      await new Promise<void>(resolve => { complete = resolve; });
      return key.decrypt(...args);
    }};
  }});
  try {
    p.phone.send({ secret: 'late' });
    await until(() => !!complete);
    p.host.close(); complete();
    await new Promise(resolve => setTimeout(resolve, 15));
    expect(p.messages).toHaveLength(0);
  } finally { p.close(); }
});

it('reconnects before wrapping an AES nonce or exceeding a key usage budget', async () => {
  for (const property of ['sendCount', 'sentBytes']) {
    const p = await pair();
    try {
      (p.phone as any)[property] = property === 'sendCount' ? 0xffffffff : 64 * 1024 ** 3;
      p.phone.send({ message: 'exhausted key' });
      await until(() => p.errors.length > 0);
      expect(p.errors.some(e => e.message === 'key_exhausted')).toBe(true);
      expect(p.sent.some(f => f.kind === 'data')).toBe(false);
    } finally { p.close(); }
  }
});

it('matches the NIST AES-256-GCM zero-key vector and authenticates additional data', async () => {
  const key = await importAesKey(new Uint8Array(32));
  const nonce = new Uint8Array(12), plaintext = new Uint8Array(16), aad = new Uint8Array(0);
  const ciphertext = await key.encrypt(plaintext, nonce, aad);
  expect(Buffer.from(ciphertext).toString('hex')).toBe('cea7403d4d606b6e074ec5d3baf39d18d0d1c8a799996bf0265b98b5d48ab919');
  expect(await key.decrypt(ciphertext, nonce, aad)).toEqual(plaintext);
  await expect(key.decrypt(ciphertext, nonce, new Uint8Array([1]))).rejects.toThrow();
});

it('rejects ciphertext transplanted from a different channel even if relay ids are rewritten', async () => {
  const first = await pair(), second = await pair();
  try {
    first.phone.send({ secret: 'first channel only' });
    await until(() => first.messages.length === 1);
    const record = first.sent.find(f => f.kind === 'data')!;
    const target = second.sent.find(f => f.kind === 'commit')!;
    second.host.receive({ ...record, pairingId: target.pairingId, channelId: target.channelId });
    await until(() => second.errors.length > 0);
    expect(second.messages).toHaveLength(0);
  } finally { first.close(); second.close(); }
});

it('delivers no partial large message when a later record is corrupted', async () => {
  let records = 0;
  const p = await pair({ intercept: packet => {
    if (packet.kind !== 'data' || ++records !== 2) return packet;
    const bytes = unbase64(packet.data); bytes[bytes.length - 1] ^= 1;
    return { ...packet, data: base64(bytes) };
  }});
  try {
    p.phone.send({ data: 'x'.repeat(1000000) });
    await until(() => p.errors.length > 0);
    expect(p.messages).toHaveLength(0);
  } finally { p.close(); }
});
