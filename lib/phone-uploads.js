/** Bounded phone transfers into DSH's native, session-owned attachment store. */
import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { z } from 'zod';
import { PhoneSessionError } from './phone-session.js';
const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const maxImageBytes = 512 * 1024;
const maxMessageImageBytes = 1536 * 1024;
export const uploadLimits = {
    maxImageBytes, maxMessageImageBytes,
    maxFiles: 5, maxFileBytes: 20 * 1024 * 1024, maxMessageBytes: 50 * 1024 * 1024,
    chunkBytes: 256 * 1024,
    extensions: ['txt', 'text', 'md', 'markdown', 'csv', 'json', 'jsonl', 'log', 'pdf', 'js', 'jsx', 'ts', 'tsx', 'py', 'go', 'rs', 'c', 'cc', 'cpp', 'h', 'hpp', 'java', 'cs', 'css', 'html', 'xml', 'yaml', 'yml', 'toml', 'ini', 'sh', 'sql', 'rb', 'php', 'swift', 'kt', 'patch', 'diff', ...imageExtensions],
};
const identity = { sessionId: z.string().min(1).max(256), uploadId: z.string().uuid() };
export const uploadSchemas = {
    'teamwork/uploadStart': z.object({ sessionId: identity.sessionId, name: z.string().min(1).max(200), bytes: z.number().int().min(0).max(uploadLimits.maxFileBytes) }).strict(),
    'teamwork/uploadChunk': z.object({ ...identity, offset: z.number().int().min(0), data: z.string().min(4).max(Math.ceil(uploadLimits.chunkBytes / 3) * 4) }).strict(),
    'teamwork/uploadFinish': z.object(identity).strict(),
    'teamwork/uploadCancel': z.object(identity).strict(),
};
const receiptSchema = z.object({ receiptId: z.string().min(1), file: z.object({ attachmentId: z.string().min(1), name: z.string(), bytes: z.number().int().nonnegative() }) });
export class PhoneUploads {
    limits;
    transfers = new Map();
    constructor(limits = uploadLimits) {
        this.limits = limits;
    }
    start(pairing, input, upload) {
        if (/[\\/\x00-\x1f\x7f]/.test(input.name))
            throw new PhoneSessionError('file_name');
        const extension = input.name.split('.').pop().toLowerCase();
        if (!this.limits.extensions.includes(extension))
            throw new PhoneSessionError('file_type');
        const isImage = imageExtensions.includes(extension);
        if (isImage && (input.bytes <= 0 || input.bytes > maxImageBytes))
            throw new PhoneSessionError('file_too_large');
        const active = [...this.transfers.values()].filter(t => !t.receipt);
        if (active.some(t => t.pairing === pairing) || active.length >= 2 || this.transfers.size >= 100)
            throw new PhoneSessionError('busy');
        if (input.bytes > this.limits.maxFileBytes)
            throw new PhoneSessionError('file_too_large');
        const id = randomUUID();
        const stream = new PassThrough({ highWaterMark: this.limits.chunkBytes });
        stream.on('error', () => { });
        const controller = new AbortController();
        const expire = () => this.cancel(pairing, input.sessionId, id);
        const t = {
            pairing, sessionId: input.sessionId, size: input.bytes, received: 0, stream, controller,
            timer: setTimeout(expire, 60_000), deadline: setTimeout(expire, 300_000),
            done: Promise.resolve({ error: new PhoneSessionError('upload_expired') }), writing: false, finishing: false,
        };
        t.timer.unref();
        t.deadline.unref();
        this.transfers.set(id, t);
        const uploadImage = async () => {
            const chunks = [];
            for await (const chunk of stream)
                chunks.push(Buffer.from(chunk));
            const mediaType = 'image/' + (extension === 'jpg' ? 'jpeg' : extension);
            t.image = { type: 'image', mediaType, data: Buffer.concat(chunks).toString('base64'), name: input.name };
            return { receiptId: id, file: { attachmentId: id, name: input.name, bytes: input.bytes } };
        };
        t.done = (isImage ? uploadImage() : upload(stream, controller.signal)).then(value => {
            const receipt = receiptSchema.parse(value);
            if (receipt.file.bytes !== t.size || this.transfers.get(id) !== t)
                throw new PhoneSessionError('invalid_upload');
            return { value: receipt };
        }).catch(error => { this.cancel(pairing, t.sessionId, id); return { error }; });
        return { uploadId: id, chunkBytes: this.limits.chunkBytes };
    }
    async chunk(pairing, sessionId, id, offset, encoded) {
        const t = this.get(pairing, sessionId, id);
        if (t.writing || t.finishing || t.receipt || offset !== t.received)
            throw new PhoneSessionError('invalid_upload');
        const data = Buffer.from(encoded, 'base64');
        if (!data.length || data.length > this.limits.chunkBytes || data.toString('base64') !== encoded || t.received + data.length > t.size)
            throw new PhoneSessionError('invalid_upload');
        t.writing = true;
        try {
            await new Promise((resolve, reject) => {
                const abort = () => { cleanup(); reject(new PhoneSessionError('upload_expired')); };
                const cleanup = () => t.controller.signal.removeEventListener('abort', abort);
                t.controller.signal.addEventListener('abort', abort, { once: true });
                t.stream.write(data, error => { cleanup(); error ? reject(error) : resolve(); });
            });
            this.get(pairing, sessionId, id);
            t.received += data.length;
            t.timer.refresh();
            return { received: t.received };
        }
        finally {
            t.writing = false;
        }
    }
    async finish(pairing, sessionId, id) {
        const t = this.get(pairing, sessionId, id);
        if (t.receipt)
            return t.receipt;
        if (t.writing || t.finishing || t.received !== t.size)
            throw new PhoneSessionError('invalid_upload');
        t.finishing = true;
        t.stream.end();
        const result = await t.done;
        this.get(pairing, sessionId, id);
        if ('error' in result)
            throw new PhoneSessionError('upload_failed');
        t.receipt = result.value;
        clearTimeout(t.timer);
        clearTimeout(t.deadline);
        t.timer = setTimeout(() => this.cancel(pairing, sessionId, id), 600_000);
        t.timer.unref();
        return t.receipt;
    }
    validate(pairing, sessionId, content) {
        const parts = z.array(z.object({ type: z.string(), receiptId: z.string().optional() })).parse(content);
        if (parts.some(part => part.type === 'image'))
            throw new PhoneSessionError('invalid_upload');
        const files = parts.filter(p => p.type === 'file');
        if (files.length > this.limits.maxFiles)
            throw new PhoneSessionError('file_too_large');
        let bytes = 0, imageBytes = 0;
        const ids = files.map(part => {
            const entry = [...this.transfers.entries()].find(([, t]) => t.pairing === pairing && t.sessionId === sessionId && t.receipt?.receiptId === part.receiptId);
            if (!entry)
                throw new PhoneSessionError('upload_expired');
            bytes += entry[1].receipt.file.bytes;
            if (entry[1].image)
                imageBytes += entry[1].receipt.file.bytes;
            return entry[0];
        });
        if (bytes > this.limits.maxMessageBytes || imageBytes > maxMessageImageBytes)
            throw new PhoneSessionError('file_too_large');
        return ids;
    }
    resolveImages(content, ids) {
        const images = new Map(ids.flatMap(id => {
            const upload = this.transfers.get(id);
            return upload?.image && upload.receipt ? [[upload.receipt.receiptId, upload.image]] : [];
        }));
        return content.map(part => {
            const receipt = part;
            return receipt?.type === 'file' && receipt.receiptId ? images.get(receipt.receiptId) ?? part : part;
        });
    }
    cancel(pairing, sessionId, id) {
        const t = this.transfers.get(id);
        if (!t || t.pairing !== pairing || t.sessionId !== sessionId)
            return;
        this.transfers.delete(id);
        clearTimeout(t.timer);
        clearTimeout(t.deadline);
        t.controller.abort();
        t.stream.destroy();
    }
    drop(pairing) { for (const [id, t] of this.transfers)
        if (t.pairing === pairing)
            this.cancel(pairing, t.sessionId, id); }
    get(pairing, sessionId, id) {
        const t = this.transfers.get(id);
        if (!t || t.pairing !== pairing || t.sessionId !== sessionId)
            throw new PhoneSessionError('upload_expired');
        return t;
    }
}
//# sourceMappingURL=phone-uploads.js.map