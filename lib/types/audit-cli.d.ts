#!/usr/bin/env node
export declare function keygen(file: string): Promise<{
    publicKey: string;
    fingerprint: string;
}>;
/** Every record in an exported archive, and every problem with it; the archive's lines are segments in order. */
export declare function read(archive: string, key: {
    publicKey: string;
    privateKey: string;
}): Promise<{
    records: unknown[];
    problems: string[];
}>;
//# sourceMappingURL=audit-cli.d.ts.map