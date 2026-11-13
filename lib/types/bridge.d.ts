/**
 * The phone's side of this DSH (dsh-teamwork-premium ADR 0009,
 * `premium/docs/tech/mobile-relay.md`, "The allow-list"). The relay hands this
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
 */
import { z } from 'zod';
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
}
export declare class Bridge {
    private readonly options;
    private links;
    constructor(options: BridgeOptions);
    handle(frame: Forwarded): void;
    /** The relay connection ended: every phone is gone with it. */
    dropAll(): void;
    private link;
    private drop;
    private call;
    private mux;
    private openMux;
    /** Every open stream of a pairing ends, as DSH itself would end it. */
    private closeStreams;
    private fail;
    private origin;
    /** `/connect` with DSH's launch token and `interactions=answer`: an identity that may answer questions and approvals. */
    private cookie;
}
//# sourceMappingURL=bridge.d.ts.map