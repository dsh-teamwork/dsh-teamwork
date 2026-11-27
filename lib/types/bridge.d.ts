/**
 * The phone's side of this DSH (the server's
 * `docs/tech/relay.md`, "The allow-list"). The relay hands this
 * plugin a confirmed pairing's `call` and `mux` frames; the bridge checks each
 * against the allow-list and replays it against DSH's own Remote API on
 * loopback, as an answering identity of that pairing's own, then sends the
 * answer back. Nothing off the list touches DSH.
 *
 * - A `call` is one unary method. Its `body` is the call's `payload`; the
 *   bridge wraps it itself, so the method it checked is the method that runs.
 * - A `mux` frame is one frame of DSH's `/api/remote.mux`. An `open` must name
 *   an allowed stream; `item`, `end` and `cancel` are accepted only for a
 *   stream that pairing opened. Each pairing has its own loopback mux.
 * - Whatever goes back fits one message of the encrypted channel
 *   (`fitFrame`): a frame too large for it would close the channel.
 *
 * A cloud computer (the server's premium ADR 0051) is reached by the server,
 * not the relay: its streams go straight to DSH's mux, and its unary calls to
 * this bridge through `bridgeRoute`, behind DSH's own sign-in.
 */
import { z } from 'zod';
import { type PhoneSessionOps } from './phone-session.js';
import { type FetchRoute } from './panel.js';
/** Unary methods a phone may call. A test holds this list. */
export declare const ALLOWED_CALLS: ReadonlySet<string>;
/** Streams a phone may open on the mux. A test holds this list. */
export declare const ALLOWED_STREAMS: ReadonlySet<string>;
/** Which of the member's sessions DSH's workspace registry pins and archives (its `pinnedSessionIds`, `archivedSessionIds`). */
export interface SessionMarks {
    pinned: readonly string[];
    archived: readonly string[];
    /** DSH's workspaces in its own order, each with the sessions it lists in its own manual order. */
    workspaces: readonly {
        id: string;
        title: string;
        path?: string;
        sessionIds: readonly string[];
    }[];
}
/** A frame the relay passes to the bridge. */
export declare const forwardedSchema: z.ZodUnion<readonly [z.ZodObject<{
    t: z.ZodLiteral<"call">;
    pairingId: z.ZodString;
    id: z.ZodString;
    method: z.ZodString;
    body: z.ZodUnknown;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"mux">;
    pairingId: z.ZodString;
    body: z.ZodUnknown;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodEnum<{
        detach: "detach";
        revoked: "revoked";
    }>;
    pairingId: z.ZodString;
}, z.core.$strip>]>;
export type Forwarded = z.infer<typeof forwardedSchema>;
export interface BridgeOptions {
    /**
     * A fresh sign-in URL for this DSH's own web server (`connection.authenticatedUrl`
     * over `webServer.getOrigin()`), or undefined where DSH serves no web.
     */
    launchUrl: () => string | undefined;
    /** Hands a frame back to the relay. */
    send: (frame: unknown) => void;
    request?: typeof fetch;
    WebSocket?: typeof globalThis.WebSocket;
    log?: (message: string, error?: unknown) => void;
    /** Only these session operations supplement DSH's native calls. */
    session?: PhoneSessionOps;
    /** The pin and archive sets `session/list` marks each item with, under `teamwork`; none while DSH has no registry. */
    marks?: () => SessionMarks | undefined;
    /** The DSH workspace registered at exactly this folder, if any (see `session/create` in `call`). */
    workspaceAt?: (path: string) => string | undefined;
}
export declare class Bridge {
    private readonly options;
    private links;
    private uploads;
    private promptCalls;
    constructor(options: BridgeOptions);
    handle(frame: Forwarded): void;
    /** The relay connection ended: every phone is gone with it. */
    dropAll(): void;
    private link;
    private drop;
    private call;
    /**
     * One unary call under `pairingId`, through the allow-list, and its answer: what the relay's `result` carries, and
     * what a cloud computer's server reads from `POST /api/teamwork/bridge` (`bridgeRoute`).
     */
    answer(pairingId: string, id: string, method: string, body: unknown): Promise<{
        status: number;
        body: unknown;
    }>;
    private run;
    /**
     * A `session/list` answer with each item's place in DSH's sidebar, as `teamwork: { pinned, archived, workspace }`:
     * its pin and archive marks, and the workspace that lists it (`index` among the workspaces, `position` among its
     * sessions, both DSH's own order) or null when DSH lists it under Ungrouped.
     */
    private marked;
    private mux;
    private openMux;
    /**
     * Passes one of DSH's mux frames to the phone, made to fit the channel. One
     * that cannot fit ends its stream at both ends instead: a stream with a
     * frame missing would show the phone a different session.
     */
    private deliver;
    /** Every open stream of a pairing ends, as DSH itself would end it. */
    private closeStreams;
    private fail;
    private origin;
    /** `/connect` with DSH's launch token and `interactions=answer`: an identity that may answer questions and approvals. */
    private cookie;
}
/**
 * What a follow's opening snapshot may take: what the screen shows first, sent ahead of everything else over a link
 * that may cross an ocean. Older records stay one "Show earlier messages" (`session/page`) away.
 */
export declare const SNAPSHOT_BYTES: number;
/**
 * A frame for the phone that fits one message of the encrypted channel, or
 * undefined when nothing can make it fit. A frame that fits is passed as it
 * is. A larger one has its long strings (a tool's output, a file written) cut
 * short, which the phone shows only in part anyway; a follow's opening
 * snapshot then keeps its newest records and says it has more, which
 * `session/page` reads back.
 */
export declare function fitFrame<T>(frame: T, limit?: number): T | undefined;
/** The pairing a cloud computer's server calls the bridge under: there is one, and no phone. */
export declare const CLOUD_PAIRING = "cloud";
/**
 * `POST /api/teamwork/bridge` on DSH's own web server, registered only where a host provides the token (`tokenFile`):
 * a cloud computer's server makes the calls a phone makes through the relay, `{ id, method, body }` as a `call`
 * frame's, and reads `{ status, body }` as its `result`. DSH's sign-in guards it as it guards `/api/`.
 */
export declare function bridgeRoute(bridge: Bridge): FetchRoute;
//# sourceMappingURL=bridge.d.ts.map