/**
 * A shared DSH's audit archive (the server's `docs/tech/shared-dsh.md`, "The audit archive", and its ADR 0045): every
 * frame between a member's device and this DSH, recorded with the member, the device and the time, sealed to a key
 * only the team's admin holds, and uploaded to the server, which keeps it and cannot open it.
 *
 * Records collect for a minute, or until they reach 1 MiB, and become one segment: the records as JSON, HPKE-sealed
 * (RFC 9180: DHKEM X25519, HKDF-SHA256, AES-256-GCM) to the audit public key, under a clear header the AEAD binds
 * (host, sequence, the previous segment's SHA-256, the key's fingerprint), signed by this DSH's identity key. A
 * segment is written to a queue on disk before it is uploaded, in order, so a lost connection loses nothing; the chain
 * makes a dropped or altered segment show when the admin reads it (`dsh-teamwork-audit read`, src/audit-cli.ts).
 * A string over 64 KiB in a frame (a file's bytes) is recorded by its length and SHA-256 only.
 *
 * A record reaches disk as it is made, in a journal beside the state (`<path>.journal`, mode 0600, one JSON line each),
 * so a crash before its segment is sealed loses nothing: the next start seals what the journal holds (`recover`). A
 * batch is renamed to `<path>.journal.<id>.sealing` before it is sealed, and the state names the last batch sealed, so
 * a crash between a segment and its batch's removal never seals the batch twice. The journal is clear text for at
 * most a segment's minute, on the machine that holds the same sessions in clear in DSH's own files.
 */
import { createHash, randomBytes } from 'node:crypto';
import { appendFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Aes256Gcm, CipherSuite, DhkemX25519HkdfSha256, HkdfSha256 } from '@hpke/core';
import { z } from 'zod';
export const suite = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
export const SEGMENT_BYTES = 1 << 20;
export const SEGMENT_MS = 60 * 1000;
const LARGE_STRING = 64 * 1024;
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
/** A string's UTF-8 bytes as the ArrayBuffer HPKE takes. */
export const bytesOf = (text) => { const bytes = new TextEncoder().encode(text); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); };
const b64 = (bytes) => Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64');
/** The clear header the AEAD binds: whoever opens a segment knows these were not moved between segments. */
export const segmentHeader = (s) => `dsh-teamwork audit segment\n${s.host}\n${s.seq}\n${s.prev}\n${s.key}`;
/** What this DSH signs, and the server checks before it keeps a segment (its `server/relay/archive.go`). */
export const segmentSigned = (s) => `${segmentHeader(s)}\n${sha256(`${s.enc}.${s.ct}`)}`;
export const keyFingerprint = (publicKey) => sha256(Buffer.from(publicKey, 'base64'));
/** A frame as the archive keeps it: large strings by their length and digest. */
export function recordable(value) {
    if (typeof value === 'string')
        return value.length > LARGE_STRING ? { omitted: value.length, sha256: sha256(value) } : value;
    if (Array.isArray(value))
        return value.map(recordable);
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, recordable(v)]));
    return value;
}
/** The audit key, and where this host's chain stands: a different host starts its own chain. */
const stateSchema = z.object({ publicKey: z.string().optional(), host: z.string().optional(), seq: z.number().int().min(0), prev: z.string(), sealed: z.string().optional() });
export const auditArchivePath = (cachePath) => cachePath.replace(/(\.json)?$/, '.audit.json');
export class AuditArchive {
    options;
    state;
    records = [];
    bytes = 0;
    timer;
    sealing = Promise.resolve();
    draining;
    journaling = Promise.resolve();
    publicKey;
    constructor(options) {
        this.options = options;
    }
    get queue() { return `${this.options.path}.queue`; }
    get journal() { return `${this.options.path}.journal`; }
    load() {
        return (this.state ??= readFile(this.options.path, 'utf8').then((text) => stateSchema.parse(JSON.parse(text)), (error) => { if (error.code === 'ENOENT')
            return { seq: 0, prev: '' }; throw error; }).then((state) => { this.publicKey = state.publicKey; return state; }));
    }
    async save(state) {
        await mkdir(dirname(this.options.path), { recursive: true, mode: 0o700 });
        const temporary = `${this.options.path}.${randomBytes(8).toString('hex')}.tmp`;
        try {
            await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
            await rename(temporary, this.options.path);
        }
        finally {
            await rm(temporary, { force: true });
        }
    }
    /** Whether an audit key is set: a shared DSH admits no member until it is. */
    async ready() { return !!(await this.load()).publicKey; }
    /** The audit key's fingerprint, or undefined before one is set. */
    async fingerprint() { const { publicKey } = await this.load(); return publicKey ? keyFingerprint(publicKey) : undefined; }
    /** The admin's audit public key (raw X25519, base64, from `dsh-teamwork-audit keygen`). New segments are sealed to it. */
    async setKey(publicKey) {
        const raw = Buffer.from(publicKey.trim(), 'base64');
        if (raw.length !== 32)
            throw new Error('That is not an audit public key. Run dsh-teamwork-audit keygen on your own machine and paste the key it prints.');
        await suite.kem.deserializePublicKey(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
        await this.flush();
        this.sealing = this.sealing.then(async () => {
            const state = await this.load();
            state.publicKey = raw.toString('base64');
            this.publicKey = state.publicKey;
            await this.save(state);
        });
        await this.sealing;
        return keyFingerprint(raw.toString('base64'));
    }
    /** Records one frame of a member's; nothing is recorded before an audit key is set. */
    record(entry) {
        if (!this.publicKey)
            return;
        const record = { at: new Date(this.options.now?.() ?? Date.now()).toISOString(), ...entry, frame: recordable(entry.frame) };
        this.records.push(record);
        const line = JSON.stringify(record);
        this.bytes += line.length;
        this.journaling = this.journaling
            .then(async () => { await mkdir(dirname(this.journal), { recursive: true, mode: 0o700 }); await appendFile(this.journal, `${line}\n`, { mode: 0o600 }); })
            .catch((error) => this.options.log?.(`audit archive: a record could not reach disk (${error.message}); it is sealed from memory.`));
        if (this.bytes >= SEGMENT_BYTES)
            void this.flush();
        else if (!this.timer) {
            this.timer = setTimeout(() => void this.flush(), SEGMENT_MS);
            this.timer.unref?.();
        }
    }
    /** Every record made so far is in the journal on disk. */
    settled() { return this.journaling; }
    /** Seals what has collected into the next segment, queues it on disk, and uploads the queue. */
    flush() {
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = undefined;
        const records = this.records.splice(0);
        this.bytes = 0;
        if (records.length) {
            // The journal so far is this batch's: renamed once every record of it is written, so a later record starts a new one.
            const batch = this.journaling.then(async () => {
                const id = randomBytes(8).toString('hex'), path = `${this.journal}.${id}.sealing`;
                try {
                    await rename(this.journal, path);
                    return { id, path };
                }
                catch {
                    return { id, path: undefined };
                }
            });
            this.journaling = batch.then(() => undefined);
            this.sealing = this.sealing.then(async () => {
                const { id, path } = await batch;
                await this.seal(records, id);
                if (path)
                    await rm(path, { force: true });
            }).catch((error) => this.options.log?.(`audit archive: ${error.message}`));
        }
        return this.sealing.then(() => this.drain());
    }
    /**
     * At start: seals what a process that stopped left in the journal, oldest batch first, unless the state says a batch
     * was sealed already, then uploads the queue. A torn last line (the process died writing it) is dropped.
     */
    async recover() {
        const state = await this.load();
        const name = this.journal.split('/').pop(), directory = dirname(this.journal);
        const files = await readdir(directory).catch(() => []);
        const batches = files.filter((f) => f.startsWith(`${name}.`) && f.endsWith('.sealing')).map((f) => join(directory, f));
        const pending = [];
        for (const path of batches) {
            const id = path.slice(this.journal.length + 1, -'.sealing'.length);
            if (id === state.sealed)
                await rm(path, { force: true });
            else
                pending.push(path);
        }
        if (files.includes(name))
            pending.push(this.journal);
        for (const path of pending) {
            const records = (await readFile(path, 'utf8')).split('\n').flatMap((line) => { try {
                return line ? [JSON.parse(line)] : [];
            }
            catch {
                return [];
            } });
            const id = randomBytes(8).toString('hex');
            this.sealing = this.sealing.then(async () => { if (records.length)
                await this.seal(records, id); await rm(path, { force: true }); })
                .catch((error) => this.options.log?.(`audit archive: ${error.message}`));
        }
        await this.sealing;
        return this.drain();
    }
    async seal(records, batch) {
        const state = await this.load(), host = this.options.hostId();
        if (!state.publicKey || !host)
            return;
        if (state.host !== host)
            Object.assign(state, { host, seq: 0, prev: '' });
        const header = { host, seq: state.seq + 1, prev: state.prev, key: keyFingerprint(state.publicKey) };
        const sender = await suite.createSenderContext({ recipientPublicKey: await suite.kem.deserializePublicKey(new Uint8Array(Buffer.from(state.publicKey, 'base64')).buffer) });
        const ct = await sender.seal(bytesOf(JSON.stringify(records)), bytesOf(segmentHeader(header)));
        const unsigned = { ...header, enc: b64(sender.enc), ct: b64(ct) };
        const identity = await this.options.identity();
        const segment = { v: 1, ...unsigned, sig: b64(await identity.privateKey.sign(new TextEncoder().encode(segmentSigned(unsigned)))) };
        const body = JSON.stringify(segment);
        await mkdir(this.queue, { recursive: true, mode: 0o700 });
        await writeFile(join(this.queue, `${String(segment.seq).padStart(12, '0')}.json`), body, { mode: 0o600 });
        await this.save({ ...state, seq: segment.seq, prev: sha256(body), sealed: batch });
        state.seq = segment.seq;
        state.prev = sha256(body);
        state.sealed = batch;
    }
    /** Uploads queued segments in order; one the server refuses as out of order stops the queue and is said. */
    drain() {
        return (this.draining ??= (async () => {
            try {
                const files = (await readdir(this.queue).catch(() => [])).filter((f) => f.endsWith('.json')).sort();
                for (const file of files) {
                    const body = await readFile(join(this.queue, file), 'utf8');
                    const { status } = await this.options.upload(body);
                    if (status === 200 || status === 201) {
                        await rm(join(this.queue, file), { force: true });
                        continue;
                    }
                    this.options.log?.(`audit archive: the server refused segment ${file} (${status}); it stays queued.`);
                    break;
                }
            }
            catch (error) {
                this.options.log?.(`audit archive: could not upload (${error.message}); retrying with the next segment.`);
            }
            finally {
                this.draining = undefined;
            }
        })());
    }
    stop() { if (this.timer)
        clearTimeout(this.timer); this.timer = undefined; }
    /**
     * Shared mode ended: what collected is sealed and sent if it can be, then the key goes, so nothing more is recorded.
     * The chain's place stays: the same shared host enabled again continues its chain rather than restarting it.
     */
    async clear() {
        await this.flush();
        this.stop();
        this.publicKey = undefined;
        this.sealing = this.sealing.then(async () => { const state = await this.load(); delete state.publicKey; await this.save(state); });
        await this.sealing;
    }
}
//# sourceMappingURL=audit-archive.js.map