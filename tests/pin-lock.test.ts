import { randomBytes } from 'node:crypto';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importAesKey } from '../src/aes-gcm.js';
import { PhoneKeys, PhoneSecurity } from '../src/phone-security.js';
import { IDLE_MS, PinStore } from '../src/pin-lock.js';
import { SecureChannel, base64, deviceIdentity, newChannelId } from '../src/secure-channel.js';

const until = async (predicate: () => boolean) => {
  for (let i = 0; i < 500; i++) { if (predicate()) return; await new Promise((r) => setTimeout(r, 5)); }
  throw new Error('Timed out');
};

describe('the PIN store', () => {
  it('locks a member after five wrong PINs, refusing even the right one, across restarts until cleared', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'pins-')), 'pins.json');
    const pins = new PinStore(path);
    expect(await pins.check('ada', '1234')).toEqual({ ok: false, reason: 'unset' });
    await expect(pins.set('ada', '12a4')).rejects.toThrow();
    await pins.set('ada', '1234');
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(await pins.check('ada', '1234')).toEqual({ ok: true });
    for (const left of [4, 3, 2, 1]) expect(await pins.check('ada', '0000')).toEqual({ ok: false, reason: 'wrong', left });
    const restarted = new PinStore(path);
    expect(await restarted.check('ada', '0000')).toEqual({ ok: false, reason: 'locked' });
    expect(await restarted.check('ada', '1234')).toEqual({ ok: false, reason: 'locked' });
    expect(await restarted.has('bob')).toBe(false);
    await restarted.clear('ada');
    expect(await restarted.has('ada')).toBe(false);
  });
});

describe('a channel behind the PIN', () => {
  it('carries nothing until the member sets or gives their PIN, and locks again when idle', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pin-channel-'));
    const keys = new PhoneKeys(join(dir, 'keys.json'));
    const pins = new PinStore(join(dir, 'pins.json'));
    const identity = await deviceIdentity(base64(randomBytes(32)));
    await keys.trust('scope', 'pair', identity.publicKey, 'phone');
    let now = 1_000_000;
    const forwarded: unknown[] = [], messages: any[] = [];
    let phone: SecureChannel;
    const host = new PhoneSecurity({
      keys, scope: async () => 'scope', send: (p) => queueMicrotask(() => phone.receive(p)), forward: (f) => forwarded.push(f),
      confirm: async () => {}, changed: () => {}, error: () => {}, pins, pinMember: async () => 'owner', now: () => now,
    });
    phone = new SecureChannel({
      importAesKey, pairingId: 'pair', channelId: newChannelId((n) => randomBytes(n)), identity, initiator: true, random: (n) => randomBytes(n),
      send: (p) => queueMicrotask(() => void host.handle(p)), ready: () => {},
      message: (value: any) => { if (value?.t === 'secureReady') phone.verified(); messages.push(value); }, closed: () => {},
    });
    const last = () => messages.at(-1);
    const call = (id: string) => phone.send({ t: 'call', pairingId: 'pair', id, method: 'session/list', body: {} });
    phone.start();
    await until(() => messages.some((m) => m.t === 'pinRequired'));
    expect(messages.find((m) => m.t === 'pinRequired')).toEqual({ t: 'pinRequired', set: true });

    // Locked: the call fails here and never reaches DSH.
    call('1');
    await until(() => last()?.t === 'result');
    expect(last().body.result.error.code).toBe('teamwork/locked');
    phone.send({ t: 'setPin', pin: '2468' });
    await until(() => last()?.t === 'unlocked');
    call('2');
    await until(() => forwarded.length === 1);

    // Fifteen minutes idle: locked again, and asked for the PIN it now has.
    now += IDLE_MS + 1;
    call('3');
    await until(() => last()?.t === 'pinRequired' || last()?.t === 'result');
    await until(() => messages.some((m) => m.t === 'pinRequired' && m.set === false));
    expect(forwarded).toHaveLength(1);

    for (const left of [4, 3, 2, 1]) { phone.send({ t: 'unlock', pin: '0000' }); await until(() => last()?.t === 'pinWrong' && last().left === left); }
    phone.send({ t: 'unlock', pin: '0000' });
    await until(() => last()?.t === 'pinLocked');
    phone.send({ t: 'unlock', pin: '2468' });
    await until(() => messages.filter((m) => m.t === 'pinLocked').length === 2);
    // A new PIN needs the old one, which a locked member cannot give.
    phone.send({ t: 'setPin', pin: '1357', old: '2468' });
    await until(() => messages.filter((m) => m.t === 'pinLocked').length === 3);
    expect(forwarded).toHaveLength(1);
    phone.close();
  });
});
