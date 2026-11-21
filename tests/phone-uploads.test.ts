import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { PhoneUploads, uploadLimits } from '../src/phone-uploads.js';

const input = (bytes: number) => ({ sessionId: 's1', name: 'fixture.txt', bytes });
function sink(size: number, received: (bytes: Buffer) => void = () => {}) {
  return async (stream: AsyncIterable<Buffer>) => {
    for await (const bytes of stream) received(bytes);
    return { receiptId: 'receipt', file: { attachmentId: 'hash', name: 'fixture.txt', bytes: size } };
  };
}
describe('phone uploads', () => {
  it('streams 20 MiB in bounded chunks and returns only the host receipt after finish', async () => {
    const uploads = new PhoneUploads();
    const size = uploadLimits.maxFileBytes;
    const hash = createHash('sha256'); let count = 0;
    const start = uploads.start('p1', input(size), sink(size, bytes => { hash.update(bytes); count += bytes.length; }));
    const chunk = Buffer.alloc(start.chunkBytes, 37); const expected = createHash('sha256');
    for (let offset = 0; offset < size; offset += chunk.length) {
      expected.update(chunk);
      expect(await uploads.chunk('p1', 's1', start.uploadId, offset, chunk.toString('base64'))).toEqual({ received: offset + chunk.length });
    }
    const receipt = await uploads.finish('p1', 's1', start.uploadId);
    expect(count).toBe(size); expect(hash.digest('hex')).toBe(expected.digest('hex'));
    expect(receipt.receiptId).toBe('receipt');
    expect(uploads.validate('p1', 's1', [{ type: 'file', receiptId: 'receipt' }])).toEqual([start.uploadId]);
    expect(await uploads.finish('p1', 's1', start.uploadId)).toEqual(receipt);
    uploads.drop('p1');
  });
  it('never accepts a foreign pairing, session, missing receipt or partial file', async () => {
    const uploads = new PhoneUploads(); const start = uploads.start('p', input(3), sink(3));
    await expect(uploads.chunk('other', 's1', start.uploadId, 0, 'YWJj')).rejects.toMatchObject({ code: 'upload_expired' });
    await expect(uploads.chunk('p', 'other', start.uploadId, 0, 'YWJj')).rejects.toMatchObject({ code: 'upload_expired' });
    await expect(uploads.finish('p', 's1', start.uploadId)).rejects.toMatchObject({ code: 'invalid_upload' });
    await uploads.chunk('p', 's1', start.uploadId, 0, 'YWJj'); await uploads.finish('p', 's1', start.uploadId);
    expect(() => uploads.validate('other', 's1', [{ type: 'file', receiptId: 'receipt' }])).toThrowError('upload_expired');
    expect(() => uploads.validate('p', 'other', [{ type: 'file', receiptId: 'receipt' }])).toThrowError('upload_expired');
    expect(() => uploads.validate('p', 's1', Array(6).fill({ type: 'file', receiptId: 'receipt' }))).toThrowError('file_too_large');
    uploads.drop('p');
  });
  it('enforces ordered canonical chunks, actual length and concurrent-transfer budgets', async () => {
    const uploads = new PhoneUploads(); const start = uploads.start('p', input(3), sink(3));
    expect(() => uploads.start('p', input(1), sink(1))).toThrowError('busy');
    await expect(uploads.chunk('p', 's1', start.uploadId, 1, 'YWJj')).rejects.toMatchObject({ code: 'invalid_upload' });
    await expect(uploads.chunk('p', 's1', start.uploadId, 0, 'YWJjZA==')).rejects.toMatchObject({ code: 'invalid_upload' });
    await expect(uploads.chunk('p', 's1', start.uploadId, 0, 'YWJj!')).rejects.toMatchObject({ code: 'invalid_upload' });
    uploads.drop('p');
    expect(() => uploads.start('p', { ...input(1), name: '../file.txt' }, sink(1))).toThrowError('file_name');
    expect(() => uploads.start('p', { ...input(1), name: 'image.heic' }, sink(1))).toThrowError('file_type');
    expect(() => uploads.start('p', input(uploadLimits.maxFileBytes + 1), sink(1))).toThrowError('file_too_large');
  });
  it('resolves each completed image receipt to its exact bytes in selection order', async () => {
    const uploads = new PhoneUploads();
    const data = Buffer.alloc(uploadLimits.chunkBytes + 1, 42);
    const parts = [];
    for (const name of ['first.png', 'second.jpg']) {
      const { uploadId, chunkBytes } = uploads.start('p', { ...input(data.length), name }, async () => {
        throw new Error('image must be staged locally');
      });
      for (let offset = 0; offset < data.length; offset += chunkBytes) {
        await uploads.chunk('p', 's1', uploadId, offset, data.subarray(offset, offset + chunkBytes).toString('base64'));
      }
      parts.push({ type: 'file', receiptId: (await uploads.finish('p', 's1', uploadId)).receiptId });
    }
    expect(() => uploads.validate('other', 's1', parts)).toThrowError('upload_expired');
    const ids = uploads.validate('p', 's1', parts);
    expect(uploads.resolveImages(parts, ids)).toEqual([
      { type: 'image', name: 'first.png', mediaType: 'image/png', data: data.toString('base64') },
      { type: 'image', name: 'second.jpg', mediaType: 'image/jpeg', data: data.toString('base64') },
    ]);
    uploads.drop('p');
  });
  it('aborts backpressured writes and native intake on detach', async () => {
    const uploads = new PhoneUploads(); let aborted = false;
    const start = uploads.start('p', input(uploadLimits.chunkBytes), async (_stream, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); })));
    const writing = uploads.chunk('p', 's1', start.uploadId, 0, Buffer.alloc(uploadLimits.chunkBytes).toString('base64'));
    const rejected = expect(writing).rejects.toMatchObject({ code: 'upload_expired' });
    uploads.drop('p'); await rejected; expect(aborted).toBe(true);
    await expect(uploads.finish('p', 's1', start.uploadId)).rejects.toMatchObject({ code: 'upload_expired' });
  });
  it('accepts empty files and releases completed receipt authority on cancellation', async () => {
    const uploads = new PhoneUploads(); const start = uploads.start('p', input(0), sink(0));
    await uploads.finish('p', 's1', start.uploadId); uploads.cancel('other', 's1', start.uploadId);
    expect(uploads.validate('p', 's1', [{ type: 'file', receiptId: 'receipt' }])).toHaveLength(1);
    uploads.cancel('p', 's1', start.uploadId);
    expect(() => uploads.validate('p', 's1', [{ type: 'file', receiptId: 'receipt' }])).toThrowError('upload_expired');
  });
});
