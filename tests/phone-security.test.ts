import { importAesKey } from '../src/aes-gcm.js';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it, expect, vi } from 'vitest';
import { PhoneKeys, PhoneSecurity } from '../src/phone-security.js';
import {
  SecureChannel,
  base64,
  deviceIdentity,
  newChannelId,
  type SecurePacket,
} from '../src/secure-channel.js';
const until = async (predicate: () => boolean) => {
  for (let i = 0; i < 500; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out');
};
it('requires both local approvals, persists trust, and acknowledges durable remote revocation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'phone-security-'));
  const path = join(directory, 'keys.json');
  const keys = new PhoneKeys(path),
    forwarded: unknown[] = [],
    messages: any[] = [],
    codes: string[] = [];
  let confirms = 0;
  const identity = await deviceIdentity(base64(randomBytes(32)));
  let phone: SecureChannel;
  const host = new PhoneSecurity({
    keys,
    scope: async () => 'server|account',
    send: (packet) => queueMicrotask(() => phone.receive(packet)),
    forward: (frame) => forwarded.push(frame),
    confirm: async () => {
      confirms++;
    },
    changed: () => {},
    error: () => {},
  });
  const createPhone = () =>
    new SecureChannel({
      // A desktop may send its verification record while Expo is still importing native keys.
      importAesKey: async bytes => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return importAesKey(bytes);
      },
      pairingId: 'pair',
      channelId: newChannelId((n) => randomBytes(n)),
      identity,
      initiator: true,
      random: (n) => randomBytes(n),
      send: (packet) => queueMicrotask(() => void host.handle(packet)),
      ready: (_key, code) => {
        codes.push(code);
        phone.send({ t: 'pairHello', name: 'My phone' });
      },
      message: (value) => messages.push(value),
      closed: () => {},
    });
  try {
    // Even a relay-generated confirmed row cannot start a first-contact handshake without a local offer.
    const unoffered: SecurePacket = {
      t: 'sealed',
      pairingId: 'unoffered',
      channelId: newChannelId((n) => randomBytes(n)),
      kind: 'commit',
      data: base64(randomBytes(32)),
    };
    await host.handle(unoffered);
    expect(host.status('unoffered').safetyCode).toBeUndefined();
    host.offerCode(new Date(Date.now() + 60000).toISOString());
    phone = createPhone();
    phone.start();
    await until(() => codes.length === 1 && !!host.status('pair').safetyCode);
    expect(codes[0]).toBe(host.status('pair').safetyCode);
    await expect(host.approve('pair')).rejects.toThrow('Compare');
    expect(await keys.peer('server|account', 'pair')).toBeUndefined();
    phone.send({ t: 'pairConfirm' });
    await until(() => host.status('pair').phoneConfirmed);
    await host.approve('pair');
    await until(() => messages.some((m) => m.t === 'pairAccepted'));
    expect(confirms).toBe(1);
    expect((await keys.peer('server|account', 'pair'))?.key).toBe(identity.publicKey);
    expect(await keys.peer('other-account', 'pair')).toBeUndefined();
    expect((await new PhoneKeys(path).identity()).publicKey).toBe((await keys.identity()).publicKey);
    // Windows reports DOS attributes rather than POSIX permission bits.
    if (process.platform !== 'win32') expect((await stat(path)).mode & 0o777).toBe(0o600);
    phone.send({ t: 'call', pairingId: 'pair', id: 'c', method: 'session/list', body: {} });
    await until(() => forwarded.some((f: any) => f.t === 'call'));
    phone.send({ t: 'revoke' });
    await until(() => messages.some((m) => m.t === 'revokedAck'));
    expect(await keys.peer('server|account', 'pair')).toBeUndefined();
    expect(await readFile(path, 'utf8')).not.toContain(identity.publicKey);
    const before = forwarded.filter((f: any) => f.t === 'call').length;
    phone.send({ t: 'call', pairingId: 'pair', id: 'late', method: 'session/list', body: {} });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(forwarded.filter((f: any) => f.t === 'call')).toHaveLength(before);
  } finally {
    phone!.close();
    host.reset();
    await rm(directory, { recursive: true, force: true });
  }
});

it('forgets, from the relay’s list, a phone revoked while this computer was offline', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'phone-reconcile-'));
  const keys = new PhoneKeys(join(directory, 'keys.json'));
  const { publicKey } = await keys.identity();
  await keys.trust('scope', 'kept', publicKey, 'phone');
  await keys.trust('scope', 'revoked', publicKey, 'phone');
  await keys.trust('other-account', 'revoked', publicKey, 'phone');
  const sent: SecurePacket[] = [];
  const host = new PhoneSecurity({keys, scope: async () => 'scope', send: value => sent.push(value), forward: () => {}, confirm: async () => {}, changed: () => {}, error: () => {}});
  try {
    await host.reconcile(['kept']);
    expect(await keys.peer('scope', 'kept')).toBeDefined();
    expect(await keys.peer('scope', 'revoked')).toBeUndefined();
    // Another account's trust on this computer is not this list's to judge.
    expect(await keys.peer('other-account', 'revoked')).toBeDefined();
    // The forgotten phone cannot start over without a fresh pairing offer, nor with one.
    host.offerCode(new Date(Date.now() + 60000).toISOString());
    await host.handle({ t: 'sealed', pairingId: 'revoked', channelId: newChannelId(n => randomBytes(n)), kind: 'commit', data: base64(randomBytes(32)) });
    expect(sent).toHaveLength(0);
  } finally { host.reset(); await rm(directory, {recursive: true, force: true}); }
});

it('keeps a revoked identity blocked when durable trust removal fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'phone-revoke-'));
  const keys = new PhoneKeys(join(directory, 'keys.json'));
  const identity = await keys.identity();
  await keys.trust('scope', 'pair', identity.publicKey, 'phone');
  vi.spyOn(keys, 'forget').mockRejectedValue(new Error('disk unavailable'));
  const sent: SecurePacket[] = [];
  const host = new PhoneSecurity({keys, scope: async () => 'scope', send: value => sent.push(value), forward: () => {}, confirm: async () => {}, changed: () => {}, error: () => {}});
  try {
    await expect(host.revoke('pair')).rejects.toThrow('disk unavailable');
    host.offerCode(new Date(Date.now() + 60000).toISOString());
    await host.handle({ t: 'sealed', pairingId: 'pair', channelId: newChannelId(n => randomBytes(n)), kind: 'commit', data: base64(randomBytes(32)) });
    expect(sent).toHaveLength(0);
  } finally { host.reset(); await rm(directory, {recursive: true, force: true}); }
});
