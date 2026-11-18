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
 */
import { z } from 'zod';
import { type PhoneSessionOps } from './phone-session.js';
import type { OwnerFilter } from './shared-owner.js';
/** Unary methods a phone may call. A test holds this list. */
export declare const ALLOWED_CALLS: ReadonlySet<string>;
/** Streams a phone may open on the mux. A test holds this list. */
export declare const ALLOWED_STREAMS: ReadonlySet<string>;
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
    /** On a shared DSH, whose sessions each pairing's member may reach (src/shared-owner.ts); none on a personal computer. */
    owners?: () => OwnerFilter | undefined;
}
export declare class Bridge {
    private readonly options;
    private links;
    private uploads;
    private promptCalls;
    constructor(options: BridgeOptions);
    handle(frame: Forwarded): undefined;
    /** The relay connection ended: every phone is gone with it. */
    dropAll(): void;
    private link;
    private drop;
    private call;
    private mux;
    private muxNow;
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
 * A frame for the phone that fits one message of the encrypted channel, or
 * undefined when nothing can make it fit. A frame that fits is passed as it
 * is. A larger one has its long strings (a tool's output, a file written) cut
 * short, which the phone shows only in part anyway; a follow's opening
 * snapshot then keeps its newest records and says it has more, which
 * `session/page` reads back.
 */
export declare function fitFrame<T>(frame: T): T | undefined;
//# sourceMappingURL=bridge.d.ts.map