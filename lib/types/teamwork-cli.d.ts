#!/usr/bin/env node
/** The DSH home as DSH resolves it: a non-blank `$DSH_HOME` (with `~` expanded), else ~/.dsh. */
export declare function dshHome(env?: NodeJS.ProcessEnv): string;
export declare const socketIn: (home: string) => string;
/** One panel route on the socket: its JSON answer, or its error as a thrown message. */
export declare function call(socketPath: string, route: string, body?: Record<string, unknown>): Promise<unknown>;
/** The pairing link as a QR code a terminal shows: two rows per character line, so it stays square. */
export declare function terminalQr(link: string): string;
type TerminalInput = NodeJS.ReadableStream & {
    isTTY?: boolean;
};
/** Runs one command against the DSH on socketPath, writing to out and err; returns the exit code. */
export declare function run(args: string[], socketPath: string, out: (line: string) => void, err: (line: string) => void, input?: TerminalInput): Promise<2 | 0 | 1>;
export {};
//# sourceMappingURL=teamwork-cli.d.ts.map