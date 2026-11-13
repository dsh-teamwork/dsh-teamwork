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
export class RelayLink {
    options;
    state = 'off';
    socket;
    timer;
    attempt = 0;
    /** Bumped by every refresh and stop, so a late callback of an older run changes nothing. */
    run = 0;
    hostId;
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
    halt() {
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
            const welcome = welcomeSchema.safeParse(parseJson(String(event.data)));
            if (!welcome.success)
                return;
            this.hostId = welcome.data.hostId;
            this.attempt = 0;
            this.set('connected');
        });
        socket.addEventListener('close', (event) => {
            if (run !== this.run || this.socket !== socket)
                return;
            this.socket = undefined;
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