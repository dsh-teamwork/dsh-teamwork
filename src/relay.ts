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
import type { RelayStatus } from './panel.js';

export type { RelayStatus };

/** The relay's close codes this side acts on; any other close reconnects. */
export const RELAY_CLOSE = { badHello: 4400, unauthorized: 4401, replaced: 4409 } as const;


const discoverySchema = z.object({ url: z.string().url() });
const welcomeSchema = z.object({ t: z.literal('welcome'), hostId: z.string().min(1) });

export interface RelayLinkOptions {
  /** The server the member signed in to, read on every attempt. */
  endpoint: () => string;
  /** The member's Bearer, or undefined while signed out. */
  token: () => string | undefined;
  /** Where this computer's stable relay id is kept. */
  clientIdPath: string;
  name?: string;
  dshVersion?: string;
  request?: typeof fetch;
  /** The WebSocket class to dial with: Node's global by default. */
  WebSocket?: typeof globalThis.WebSocket;
  onStatus?: (status: RelayStatus) => void;
  /** Longest wait between reconnection attempts. */
  maxBackoffMs?: number;
  /** How long to wait before asking a server without a relay again. */
  rediscoverMs?: number;
}

export class RelayLink {
  private state: RelayStatus = 'off';
  private socket?: WebSocket;
  private timer?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  /** Bumped by every refresh and stop, so a late callback of an older run changes nothing. */
  private run = 0;
  private hostId?: string;

  constructor(private readonly options: RelayLinkOptions) {}

  get status() { return this.state; }
  /** The relay's id for this computer, once welcomed. */
  get host() { return this.hostId; }

  /** Start over: after sign-in, sign-out or a change of server. */
  refresh() {
    this.halt();
    const run = ++this.run;
    if (!this.options.token()) return this.set('off');
    this.set('connecting');
    void this.connect(run);
  }

  stop() {
    this.run++;
    this.halt();
    this.set('off');
  }

  private halt() {
    clearTimeout(this.timer);
    this.timer = undefined;
    const socket = this.socket;
    this.socket = undefined;
    if (socket && socket.readyState <= 1) socket.close(1000, 'stopped');
  }

  private set(next: RelayStatus) {
    if (this.state === next) return;
    this.state = next;
    this.options.onStatus?.(next);
  }

  private retry(run: number, delay: number) {
    if (run !== this.run) return;
    this.timer = setTimeout(() => { if (run === this.run) void this.connect(run); }, delay);
  }

  private backoff() {
    const max = this.options.maxBackoffMs ?? 60_000;
    const base = Math.min(max, 1000 * 2 ** this.attempt++);
    return base / 2 + Math.random() * base / 2;
  }

  private async connect(run: number) {
    const token = this.options.token();
    if (!token) return this.set('off');
    let url: string;
    try {
      const response = await (this.options.request ?? fetch)(`${this.options.endpoint()}/api/relay`, { signal: AbortSignal.timeout(15_000) });
      if (run !== this.run) return;
      if (response.status === 404) {
        this.set('off');
        return this.retry(run, this.options.rediscoverMs ?? 10 * 60_000);
      }
      if (!response.ok) throw new Error(`relay discovery failed (${response.status})`);
      url = discoverySchema.parse(await response.json()).url;
    } catch {
      if (run !== this.run) return;
      this.set('connecting');
      return this.retry(run, this.backoff());
    }
    const hello = { t: 'hello', token, clientId: await this.clientId(), name: this.options.name ?? hostname(), dshVersion: this.options.dshVersion ?? dshVersion() };
    if (run !== this.run) return;
    const Socket = this.options.WebSocket ?? globalThis.WebSocket;
    // Node has a global WebSocket from 22 on; on an older runtime the phone's way in stays closed.
    if (Socket === undefined) return this.set('off');
    const socket = new Socket(url);
    this.socket = socket;
    socket.addEventListener('open', () => socket.send(JSON.stringify(hello)));
    socket.addEventListener('message', (event) => {
      if (run !== this.run) return;
      const welcome = welcomeSchema.safeParse(parseJson(String(event.data)));
      if (!welcome.success) return;
      this.hostId = welcome.data.hostId;
      this.attempt = 0;
      this.set('connected');
    });
    socket.addEventListener('close', (event) => {
      if (run !== this.run || this.socket !== socket) return;
      this.socket = undefined;
      if (event.code === RELAY_CLOSE.unauthorized || event.code === RELAY_CLOSE.replaced) return this.set('refused');
      this.set('connecting');
      this.retry(run, this.backoff());
    });
  }

  /** A random id generated once per computer, so the relay keeps one host across restarts. */
  private async clientId() {
    const path = this.options.clientIdPath;
    const saved = await readFile(path, 'utf8').then(text => z.object({ clientId: z.string().min(8) }).parse(JSON.parse(text)).clientId, () => undefined);
    if (saved) return saved;
    const clientId = randomBytes(16).toString('base64url');
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, JSON.stringify({ clientId }), { mode: 0o600 });
    return clientId;
  }
}

/** `<cache>.host.json`, beside the cache, like the other per-computer files. */
export const relayClientIdPath = (cachePath: string) => cachePath.replace(/\.json$/, '') + '.host.json';

/** The DSH release this plugin runs in, read from a package every release pins to its own version. */
function dshVersion() {
  try {
    return (createRequire(import.meta.url)('@deepseek-ai/dsh-agent/package.json') as { version: string }).version;
  } catch {
    return 'unknown';
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
