/**
 * The outbound connection to the hosted mobile relay (dsh-teamwork-premium,
 * `premium/docs/tech/mobile-relay.md`). While a member is signed in, and only
 * when their server announces a relay at `GET /api/relay`, this DSH holds one
 * WebSocket to it and is recorded there as a host. A server without a relay,
 * such as every self-hosted community edition, answers 404, and no socket is
 * opened.
 *
 * The frames restate the relay's `src/protocol.ts`; a change there changes this
 * file in the same working session.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { hostname } from 'node:os';
import { dirname } from 'node:path';
import { z } from 'zod';
/** The relay's close codes this side acts on; any other close reconnects. */
export const RELAY_CLOSE = { badHello: 4400, unauthorized: 4401, replaced: 4409 };
const discoverySchema = z.object({ url: z.string().url() });
const welcomeSchema = z.object({ t: z.literal('welcome'), hostId: z.string().min(1) });
const replySchema = z.object({ t: z.literal('reply'), id: z.string(), value: z.unknown().optional(), error: z.string().optional() });
const eventSchema = z.union([z.object({ t: z.literal('paired') }).loose(), z.object({ t: z.literal('revoked'), pairingId: z.string() })]);
/** A pairing as the relay lists it (`src/pairing.ts`, `PairingView`). */
export const pairingSchema = z.object({
    id: z.string(), deviceName: z.string(), status: z.enum(['pending', 'confirmed']), createdAt: z.string(), lastUsedAt: z.string().nullable(),
});
export const offerSchema = z.object({ code: z.string().min(1), expiresAt: z.string() });
/** The relay answered a request with one of its error codes (`invalid_code`, `not_found`, `internal`). */
export class RelayError extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
const REQUEST_TIMEOUT_MS = 10_000;
export class RelayLink {
    options;
    state = 'off';
    socket;
    timer;
    attempt = 0;
    /** Bumped by every refresh and stop, so a late callback of an older run changes nothing. */
    run = 0;
    hostId;
    requests = new Map();
    constructor(options) {
        this.options = options;
    }
    get status() { return this.state; }
    /** The relay's id for this computer, once welcomed. */
    get host() { return this.hostId; }
    /** Start over: after sign-in, sign-out or a change of server. */
    refresh() {
        this.halt();
        const run = ++this.run;
        if (!this.options.token())
            return this.set('off');
        this.set('connecting');
        void this.connect(run);
    }
    stop() {
        this.run++;
        this.halt();
        this.set('off');
    }
    /** Ask the relay something, once connected; rejects when it is not, or does not answer in time. */
    request(request) {
        const socket = this.socket;
        if (this.state !== 'connected' || !socket)
            return Promise.reject(new Error('relay not connected'));
        const id = randomBytes(8).toString('hex');
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { this.requests.delete(id); reject(new Error('relay did not answer')); }, REQUEST_TIMEOUT_MS);
            this.requests.set(id, { resolve, reject, timer });
            socket.send(JSON.stringify({ ...request, id }));
        });
    }
    failRequests() {
        for (const [id, pending] of this.requests) {
            clearTimeout(pending.timer);
            pending.reject(new Error('relay connection closed'));
            this.requests.delete(id);
        }
    }
    halt() {
        this.failRequests();
        clearTimeout(this.timer);
        this.timer = undefined;
        const socket = this.socket;
        this.socket = undefined;
        if (socket && socket.readyState <= 1)
            socket.close(1000, 'stopped');
    }
    set(next) {
        if (this.state === next)
            return;
        this.state = next;
        this.options.onStatus?.(next);
    }
    retry(run, delay) {
        if (run !== this.run)
            return;
        this.timer = setTimeout(() => { if (run === this.run)
            void this.connect(run); }, delay);
    }
    backoff() {
        const max = this.options.maxBackoffMs ?? 60_000;
        const base = Math.min(max, 1000 * 2 ** this.attempt++);
        return base / 2 + Math.random() * base / 2;
    }
    async connect(run) {
        const token = this.options.token();
        if (!token)
            return this.set('off');
        let url;
        try {
            const response = await (this.options.request ?? fetch)(`${this.options.endpoint()}/api/relay`, { signal: AbortSignal.timeout(15_000) });
            if (run !== this.run)
                return;
            if (response.status === 404) {
                this.set('off');
                return this.retry(run, this.options.rediscoverMs ?? 10 * 60_000);
            }
            if (!response.ok)
                throw new Error(`relay discovery failed (${response.status})`);
            url = discoverySchema.parse(await response.json()).url;
        }
        catch {
            if (run !== this.run)
                return;
            this.set('connecting');
            return this.retry(run, this.backoff());
        }
        const hello = { t: 'hello', token, clientId: await this.clientId(), name: this.options.name ?? hostname(), dshVersion: this.options.dshVersion ?? dshVersion() };
        if (run !== this.run)
            return;
        const Socket = this.options.WebSocket ?? globalThis.WebSocket;
        // Node has a global WebSocket from 22 on; on an older runtime the phone's way in stays closed.
        if (Socket === undefined)
            return this.set('off');
        const socket = new Socket(url);
        this.socket = socket;
        socket.addEventListener('open', () => socket.send(JSON.stringify(hello)));
        socket.addEventListener('message', (event) => {
            if (run !== this.run)
                return;
            const frame = parseJson(String(event.data));
            const welcome = welcomeSchema.safeParse(frame);
            if (welcome.success) {
                this.hostId = welcome.data.hostId;
                this.attempt = 0;
                return this.set('connected');
            }
            const reply = replySchema.safeParse(frame);
            if (reply.success) {
                const pending = this.requests.get(reply.data.id);
                if (!pending)
                    return;
                this.requests.delete(reply.data.id);
                clearTimeout(pending.timer);
                return reply.data.error ? pending.reject(new RelayError(reply.data.error)) : pending.resolve(reply.data.value);
            }
            const pushed = eventSchema.safeParse(frame);
            if (pushed.success)
                this.options.onEvent?.(pushed.data);
        });
        socket.addEventListener('close', (event) => {
            if (run !== this.run || this.socket !== socket)
                return;
            this.socket = undefined;
            this.failRequests();
            if (event.code === RELAY_CLOSE.unauthorized || event.code === RELAY_CLOSE.replaced)
                return this.set('refused');
            this.set('connecting');
            this.retry(run, this.backoff());
        });
    }
    /** A random id generated once per computer, so the relay keeps one host across restarts. */
    async clientId() {
        const path = this.options.clientIdPath;
        const saved = await readFile(path, 'utf8').then(text => z.object({ clientId: z.string().min(8) }).parse(JSON.parse(text)).clientId, () => undefined);
        if (saved)
            return saved;
        const clientId = randomBytes(16).toString('base64url');
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        await writeFile(path, JSON.stringify({ clientId }), { mode: 0o600 });
        return clientId;
    }
}
/** `<cache>.host.json`, beside the cache, like the other per-computer files. */
export const relayClientIdPath = (cachePath) => cachePath.replace(/\.json$/, '') + '.host.json';
/** The DSH release this plugin runs in, read from a package every release pins to its own version. */
function dshVersion() {
    try {
        return createRequire(import.meta.url)('@deepseek-ai/dsh-agent/package.json').version;
    }
    catch {
        return 'unknown';
    }
}
function parseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=relay.js.map