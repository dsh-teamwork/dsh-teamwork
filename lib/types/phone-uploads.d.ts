import { PassThrough } from 'node:stream';
import { z } from 'zod';
export declare const uploadLimits: {
    maxFiles: number;
    maxFileBytes: number;
    maxMessageBytes: number;
    chunkBytes: number;
    extensions: string[];
};
export declare const uploadSchemas: {
    'teamwork/uploadStart': z.ZodObject<{
        sessionId: z.ZodString;
        name: z.ZodString;
        bytes: z.ZodNumber;
    }, z.core.$strict>;
    'teamwork/uploadChunk': z.ZodObject<{
        offset: z.ZodNumber;
        data: z.ZodString;
        sessionId: z.ZodString;
        uploadId: z.ZodString;
    }, z.core.$strict>;
    'teamwork/uploadFinish': z.ZodObject<{
        sessionId: z.ZodString;
        uploadId: z.ZodString;
    }, z.core.$strict>;
    'teamwork/uploadCancel': z.ZodObject<{
        sessionId: z.ZodString;
        uploadId: z.ZodString;
    }, z.core.$strict>;
};
declare const receiptSchema: z.ZodObject<{
    receiptId: z.ZodString;
    file: z.ZodObject<{
        attachmentId: z.ZodString;
        name: z.ZodString;
        bytes: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export type UploadReceipt = z.infer<typeof receiptSchema>;
export declare class PhoneUploads {
    private readonly limits;
    private transfers;
    constructor(limits?: {
        maxFiles: number;
        maxFileBytes: number;
        maxMessageBytes: number;
        chunkBytes: number;
        extensions: string[];
    });
    start(pairing: string, input: {
        sessionId: string;
        name: string;
        bytes: number;
    }, upload: (body: PassThrough, signal: AbortSignal) => Promise<unknown>): {
        uploadId: `${string}-${string}-${string}-${string}-${string}`;
        chunkBytes: number;
    };
    chunk(pairing: string, sessionId: string, id: string, offset: number, encoded: string): Promise<{
        received: number;
    }>;
    finish(pairing: string, sessionId: string, id: string): Promise<{
        receiptId: string;
        file: {
            attachmentId: string;
            name: string;
            bytes: number;
        };
    }>;
    validate(pairing: string, sessionId: string, content: unknown): string[];
    cancel(pairing: string, sessionId: string, id: string): void;
    drop(pairing: string): void;
    private get;
}
export {};
//# sourceMappingURL=phone-uploads.d.ts.map