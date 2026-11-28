/**
 * The outbound connection to the server's relay (its `docs/tech/relay.md`).
 * While a member is signed in, and only when their server announces a relay at
 * `GET /api/relay`, this DSH holds one WebSocket to it and is recorded there as
 * a host. A server without a relay, an older one, answers 404, and no socket is
 * opened.
 *
 * The frames restate the server's `server/relay/protocol.go`; a change there
 * changes this file in the same working session.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { hostname } from 'node:os';
import { dirname } from 'node:path';
import { z } from 'zod';
import { decodePacket, encodePacket, securePacket } from './secure-channel.js';
const endSchema = z.object({ t: z.enum(['detach', 'revoked']), pairingId: z.string().min(1).max(64) });
/** The relay's close codes this side acts on; any other close reconnects. */
export const RELAY_CLOSE = { badHello: 4400, unauthorized: 4401, replaced: 4409 };
const discoverySchema = z.object({ url: z.string().url() });
const welcomeSchema = z.object({ t: z.literal('welcome'), hostId: z.string().min(1) });
const replySchema = z.object({ t: z.literal('reply'), id: z.string(), value: z.unknown().optional(), error: z.string().optional() });
const eventSchema = z.union([
    z.object({ t: z.literal('paired') }).loose(),
    z.object({ t: z.literal('revoked'), pairingId: z.string() }),
]);
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
/**
 * How often a connected socket asks the relay for a `pong` (the server's `server/relay/protocol.go`), and how long it
 * waits for one. A computer that slept or changed networks may hold a socket nobody answers on; it reconnects within
 * seconds instead of leaving its phones to time out. Any frame heard counts as an answer, and the wait outlasts a
 * large record already being written to a slow link.
 */
export const PING_EVERY_MS = 15_000;
export const PONG_TIMEOUT_MS = 20_000;
const webDialSchema = z.object({ t: z.literal('webDial'), id: z.string().regex(/^[a-f0-9]{64}$/) });
export class RelayLink {
    options;
    state = 'off';
    socket;
    socketLifetime;
    timer;
    attempt = 0;
    /** Bumped by every refresh and stop, so a late callback of an older run changes nothing. */
    run = 0;
    hostId;
    /** Why the relay refused this computer: a token that names no team member can recover, a replaced socket cannot. */
    refusal;
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
    /**
     * After a sync found this account in a team: a relay that refused it as no member (it was in none, say after its
     * last team was deleted) tries again. A computer replaced by another connection stays refused, so the two do not
     * take turns kicking each other off.
     */
    rejoin() {
        if (this.state === 'refused' && this.refusal === RELAY_CLOSE.unauthorized)
            this.refresh();
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
    /**
     * Pass a frame to the relay: a phone's answer (`src/bridge.ts`), or `waiting`
     * when an agent waits on its member. Dropped while not connected.
     */
    send(frame) {
        // An encryption record goes as a binary message (`encodePacket`); everything else is JSON.
        if (this.state === 'connected' && this.socket?.readyState === 1)
            this.socket.send(securePacket(frame) ? encodePacket(frame) : JSON.stringify(frame));
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
        this.socketLifetime?.abort();
        this.socketLifetime = undefined;
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
        const web = await this.options.webAvailable?.().catch(() => false);
        const hello = { t: 'hello', token, web, clientId: await this.clientId(), name: this.options.name ?? hostname(), dshVersion: this.options.dshVersion ?? dshVersion(), pluginVersion: this.options.pluginVersion ?? pluginVersion(), os: hostOs() };
        if (run !== this.run)
            return;
        const Socket = this.options.WebSocket ?? globalThis.WebSocket;
        // Node has a global WebSocket from 22 on; on an older runtime the phone's way in stays closed.
        if (Socket === undefined)
            return this.set('off');
        const socket = new Socket(url);
        socket.binaryType = 'arraybuffer';
        this.socket = socket;
        const lifetime = this.socketLifetime = new AbortController();
        socket.addEventListener('close', () => lifetime.abort(), { once: true });
        socket.addEventListener('open', () => socket.send(JSON.stringify(hello)));
        let heard = Date.now();
        const heartbeat = () => {
            const beat = setInterval(() => {
                if (this.socket !== socket)
                    return clearInterval(beat);
                const asked = Date.now();
                socket.send(JSON.stringify({ t: 'ping' }));
                setTimeout(() => { if (heard < asked && this.socket === socket)
                    this.lost(run, socket); }, PONG_TIMEOUT_MS).unref?.();
            }, PING_EVERY_MS);
            beat.unref?.();
            lifetime.signal.addEventListener('abort', () => clearInterval(beat), { once: true });
        };
        socket.addEventListener('message', (event) => {
            if (run !== this.run)
                return;
            heard = Date.now();
            if (typeof event.data !== 'string') {
                const packet = decodePacket(event.data);
                if (packet)
                    this.options.onForward?.(packet);
                return;
            }
            const frame = parseJson(event.data);
            const dial = webDialSchema.safeParse(frame);
            if (web && dial.success && this.state === 'connected') {
                const dataURL = new URL('/relay/web/tunnel', url);
                this.options.onWebDial?.(dataURL, dial.data.id, lifetime.signal);
                return;
            }
            const welcome = welcomeSchema.safeParse(frame);
            if (welcome.success) {
                this.hostId = welcome.data.hostId;
                this.attempt = 0;
                heartbeat();
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
            const ended = endSchema.safeParse(frame);
            if (ended.success)
                this.options.onForward?.(ended.data);
            const pushed = eventSchema.safeParse(frame);
            if (pushed.success)
                this.options.onEvent?.(pushed.data);
        });
        socket.addEventListener('close', (event) => {
            if (run !== this.run || this.socket !== socket)
                return;
            this.socket = undefined;
            this.failRequests();
            if (event.code === RELAY_CLOSE.unauthorized || event.code === RELAY_CLOSE.replaced) {
                this.refusal = event.code;
                return this.set('refused');
            }
            this.set('connecting');
            this.retry(run, this.backoff());
        });
    }
    /** A socket that stopped answering: given up at once, without waiting for a close handshake it cannot finish. */
    lost(run, socket) {
        if (run !== this.run || this.socket !== socket)
            return;
        this.socket = undefined;
        this.socketLifetime?.abort();
        this.socketLifetime = undefined;
        this.failRequests();
        try {
            socket.close(4000, 'no pong');
        }
        catch { /* already closing */ }
        this.attempt = 0;
        this.set('connecting');
        this.retry(run, this.backoff());
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
/**
 * This computer's operating system as the relay names it, for the member's phone and browser to show; left out where
 * the relay names none (it refuses a value it does not know).
 */
export function hostOs(platform = process.platform) {
    return { darwin: 'macos', win32: 'windows', linux: 'linux' }[platform];
}
/** This plugin's own version, from its package (`lib/relay.js` sits one level below it); left out when unreadable. */
function pluginVersion() {
    try {
        return createRequire(import.meta.url)('../package.json').version || undefined;
    }
    catch {
        return undefined;
    }
}
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
    if (text.length > 1024 * 1024)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=relay.js.map