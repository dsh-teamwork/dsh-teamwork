#!/usr/bin/env node
/**
 * `dsh-teamwork-audit`, run by a team's admin on their own machine (the server's `docs/tech/shared-dsh.md`, "The audit
 * archive"):
 *
 *   dsh-teamwork-audit keygen [file]            writes a new audit key pair to file (default audit-key.json, mode 0600)
 *                                               and prints the public key to give the shared DSH
 *   dsh-teamwork-audit read <archive> [--key file]  opens an archive the team console exported (one segment per line),
 *                                               checks the chain, and prints each record as one JSON line; anything
 *                                               missing, altered or sealed to another key is said on stderr, and the
 *                                               exit code is then 1
 *
 * The private key never leaves the file keygen wrote. A lost key cannot be recovered: its segments stay unreadable.
 */
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { bytesOf, keyFingerprint, segmentHeader, suite, type Segment } from './audit-archive.js';

const sha256 = (data: string) => createHash('sha256').update(data).digest('hex');
const buffer = (base64: string) => new Uint8Array(Buffer.from(base64, 'base64')).buffer;

export async function keygen(file: string) {
  const pair = await suite.kem.generateKeyPair();
  const publicKey = Buffer.from(await suite.kem.serializePublicKey(pair.publicKey)).toString('base64');
  const privateKey = Buffer.from(await suite.kem.serializePrivateKey(pair.privateKey)).toString('base64');
  await writeFile(file, JSON.stringify({ type: 'dsh-teamwork-audit-key', publicKey, privateKey }), { mode: 0o600, flag: 'wx' });
  return { publicKey, fingerprint: keyFingerprint(publicKey) };
}

/** Every record in an exported archive, and every problem with it; the archive's lines are segments in order. */
export async function read(archive: string, key: { publicKey: string; privateKey: string }) {
  const fingerprint = keyFingerprint(key.publicKey);
  const recipientKey = await suite.kem.deserializePrivateKey(buffer(key.privateKey));
  const records: unknown[] = [], problems: string[] = [];
  let expected: { seq: number; prev: string } | undefined;
  for (const line of archive.split('\n').filter((l) => l.trim())) {
    let segment: Segment;
    try { segment = JSON.parse(line) as Segment; } catch { problems.push('A line is not a segment.'); continue; }
    if (!expected && segment.seq !== 1) problems.push(`The archive starts at segment ${segment.seq}: earlier ones are missing.`);
    if (expected && (segment.seq !== expected.seq || segment.prev !== expected.prev))
      problems.push(`Segment ${segment.seq} does not follow segment ${expected.seq - 1}: one is missing or was altered.`);
    expected = { seq: segment.seq + 1, prev: sha256(line) };
    if (segment.key !== fingerprint) { problems.push(`Segment ${segment.seq} is sealed to another key (${segment.key}).`); continue; }
    try {
      const recipient = await suite.createRecipientContext({ recipientKey, enc: buffer(segment.enc) });
      const plain = await recipient.open(buffer(segment.ct), bytesOf(segmentHeader(segment)));
      records.push(...(JSON.parse(new TextDecoder().decode(plain)) as unknown[]));
    } catch { problems.push(`Segment ${segment.seq} does not open: it was altered, or its header was.`); }
  }
  return { records, problems };
}

async function main(args: string[]) {
  const [command, file] = args;
  if (command === 'keygen') {
    const target = file ?? 'audit-key.json';
    const { publicKey, fingerprint } = await keygen(target);
    console.log(`Wrote ${target}. Keep it safe: a lost key cannot be recovered, and whoever holds it reads every session.`);
    console.log(`In the shared DSH, run:\n/teamwork share audit-key ${publicKey}`);
    console.log(`Fingerprint: ${fingerprint}`);
    return 0;
  }
  if (command === 'read' && file) {
    const at = args.indexOf('--key');
    const key = JSON.parse(await readFile(at > 0 ? args[at + 1]! : 'audit-key.json', 'utf8')) as { publicKey: string; privateKey: string };
    const { records, problems } = await read(await readFile(file, 'utf8'), key);
    for (const record of records) console.log(JSON.stringify(record));
    for (const problem of problems) console.error(problem);
    return problems.length ? 1 : 0;
  }
  console.error('usage: dsh-teamwork-audit keygen [file] | dsh-teamwork-audit read <archive.ndjson> [--key audit-key.json]');
  return 2;
}

// Run as a command (through npm's bin link too), not when imported by tests.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (error) => { console.error((error as Error).message); process.exit(1); });
}
