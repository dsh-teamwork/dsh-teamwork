import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AuditArchive, recordable } from '../src/audit-archive.js';
import { keygen, read } from '../src/audit-cli.js';
import { base64, deviceIdentity } from '../src/secure-channel.js';
import { readFile, writeFile } from 'node:fs/promises';

async function setup(status = 201) {
  const dir = await mkdtemp(join(tmpdir(), 'audit-'));
  const uploaded: string[] = [];
  const open = () => new AuditArchive({
    path: join(dir, 'cache.audit.json'), hostId: () => 'host-1', identity: () => deviceIdentity(base64(randomBytes(32))),
    upload: async (body) => { if (status < 300) uploaded.push(body); return { status }; },
  });
  const archive = open();
  const keyFile = join(dir, 'audit-key.json');
  const { publicKey } = await keygen(keyFile);
  const key = JSON.parse(await readFile(keyFile, 'utf8'));
  return { dir, archive, uploaded, publicKey, key, open };
}

describe('the audit archive', () => {
  it('records nothing before its key, then seals segments the admin alone reads back in order', async () => {
    const { archive, uploaded, publicKey, key } = await setup();
    expect(await archive.ready()).toBe(false);
    archive.record({ member: 'ada', device: 'p1', dir: 'in', frame: { t: 'call', id: 'before' } });
    await expect(archive.setKey('not-a-key')).rejects.toThrow();
    await archive.setKey(publicKey);
    archive.record({ member: 'ada', device: 'p1', dir: 'in', frame: { t: 'call', id: '1', method: 'session/prompt', body: { text: 'PRIVATE' } } });
    await archive.flush();
    archive.record({ member: 'bob', device: 'p2', dir: 'out', frame: { t: 'result', id: '2' } });
    await archive.flush();
    expect(uploaded).toHaveLength(2);
    expect(uploaded.join('')).not.toContain('PRIVATE');
    const { records, problems } = await read(uploaded.join('\n'), key);
    expect(problems).toEqual([]);
    expect(records.map((r: any) => [r.member, r.dir, r.frame.id])).toEqual([['ada', 'in', '1'], ['bob', 'out', '2']]);
  });

  it('says when a segment is missing or altered, or sealed to another key', async () => {
    const { archive, uploaded, publicKey, key } = await setup();
    await archive.setKey(publicKey);
    for (const id of ['1', '2', '3']) { archive.record({ member: 'ada', device: 'p1', dir: 'in', frame: { id } }); await archive.flush(); }
    expect((await read([uploaded[0], uploaded[2]].join('\n'), key)).problems[0]).toMatch(/does not follow/);
    const altered = JSON.parse(uploaded[1]!); altered.ct = altered.ct.replace(/^./, (c: string) => (c === 'A' ? 'B' : 'A'));
    expect((await read([uploaded[0], JSON.stringify(altered), uploaded[2]].join('\n'), key)).problems.some((p) => /does not open/.test(p))).toBe(true);
    const other = await setup();
    expect((await read(uploaded.join('\n'), other.key)).problems.some((p) => /another key/.test(p))).toBe(true);
  });

  it('keeps a segment queued until the server holds it', async () => {
    const { dir, archive, publicKey } = await setup(503);
    await archive.setKey(publicKey);
    archive.record({ member: 'ada', device: 'p1', dir: 'in', frame: { id: '1' } });
    await archive.flush();
    expect(await readdir(join(dir, 'cache.audit.json.queue'))).toHaveLength(1);
  });

  it('keeps a file\'s bytes out, by their length and digest', () => {
    const big = 'x'.repeat(70 * 1024);
    expect(recordable({ data: big, small: 'ok' })).toEqual({ data: { omitted: big.length, sha256: expect.stringMatching(/^[0-9a-f]{64}$/) }, small: 'ok' });
  });

  it('loses no record a crash catches before its segment is sealed', async () => {
    const { archive, uploaded, publicKey, key, open } = await setup();
    await archive.setKey(publicKey);
    archive.record({ member: 'ada', device: 'p1', dir: 'in', frame: { id: '1' } });
    archive.record({ member: 'ada', device: 'p1', dir: 'out', frame: { id: '2' } });
    await archive.settled();
    // The process dies here, before the minute is up; the next one starts.
    archive.stop();
    const next = open();
    await next.recover();
    expect(uploaded).toHaveLength(1);
    const { records, problems } = await read(uploaded.join('\n'), key);
    expect(problems).toEqual([]);
    expect(records.map((r: any) => r.frame.id)).toEqual(['1', '2']);
    await next.recover();
    expect(uploaded).toHaveLength(1);
  });

  it('seals a batch once even when a crash comes between its segment and removing the batch', async () => {
    const { dir, archive, uploaded, publicKey, open } = await setup();
    await archive.setKey(publicKey);
    archive.record({ member: 'ada', device: 'p1', dir: 'in', frame: { id: '1' } });
    await archive.flush();
    expect(uploaded).toHaveLength(1);
    // The batch the segment was sealed from is still on disk, as if the process died before removing it.
    const { sealed } = JSON.parse(await readFile(join(dir, 'cache.audit.json'), 'utf8'));
    await writeFile(join(dir, `cache.audit.json.journal.${sealed}.sealing`), JSON.stringify({ at: 'x', member: 'ada', device: 'p1', dir: 'in', frame: { id: '1' } }) + '\n');
    await open().recover();
    expect(uploaded).toHaveLength(1);
  });
});
