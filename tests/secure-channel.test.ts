import { randomBytes } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  SecureChannel,
  deviceIdentity,
  base64,
  newChannelId,
  unbase64,
  type SecurePacket,
} from '../src/secure-channel.js';
const until = async (predicate: () => boolean) => {
  for (let i = 0; i < 500; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out');
};
async function pair(options: { pin?: string; intercept?: (f: SecurePacket) => SecurePacket } = {}) {
  const a = await deviceIdentity(base64(randomBytes(32))),
    b = await deviceIdentity(base64(randomBytes(32)));
  const sent: SecurePacket[] = [],
    errors: Error[] = [],
    messages: unknown[] = [],
    codes: string[] = [];
  const channelId = newChannelId((n) => randomBytes(n));
  const common = {
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
      p.phone.send({ method: 'session/prompt', text: 'PRIVATE_SENTINEL', data: 'x'.repeat(350000) });
      await until(() => p.messages.length === 1);
      expect((p.messages[0] as any).text).toBe('PRIVATE_SENTINEL');
      expect(JSON.stringify(p.sent)).not.toContain('PRIVATE_SENTINEL');
      expect(JSON.stringify(p.sent)).not.toContain('session/prompt');
      expect(p.sent.every((frame) => JSON.stringify(frame).length < 1024 * 1024)).toBe(true);
      const ciphertext = p.sent.filter((f) => f.kind === 'noise').at(-1)!;
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
      if (!tamper || frame.kind !== 'noise') return frame;
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
    p.host.receive({ ...frame, data: '' });
    expect(p.errors.some(error => error.message === 'channel_overflow')).toBe(true);
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
