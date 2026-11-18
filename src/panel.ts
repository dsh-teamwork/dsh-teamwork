/**
 * The Teamwork sidebar panel's wire: what the browser half (`src/web/`) asks
 * the host half for, and the routes that answer it. The routes run the same
 * functions as the `/teamwork` command, in the host process, so the platform
 * token stays here and never reaches the browser. DSH admits only its owner
 * peer to an exact route.
 *
 * This file is imported by both halves, so it imports nothing from the host:
 * `panelRoutes` is handed the host's words (`src/messages.ts`) by its caller.
 */

import type { PluginState } from './plugin-status.js';
import type { Locale } from './locale.js';
export type { PluginState };

export type ToolState = 'available' | 'conditional' | 'missing' | 'unknown';

export interface PanelPlugin {
  id: string;
  teamId?: string;
  teamName?: string;
  name: string;
  package?: string;
  version: string;
  description: string;
  /** The version installed locally, if any. */
  localVersion?: string;
  state: PluginState;
}

export interface PanelPreset {
  id: string;
  /** The team that publishes it; a member in several teams sees each team's presets. */
  teamId: string;
  teamName: string;
  name: string;
  version: number;
  /** Its avatar's id in the platform's shared library, which the console and the phone draw; none when the admin chose none. */
  avatar?: string;
  description: string;
  /** The team model the preset calls, or its own provider/model; null when it runs on the session's own model. */
  model: string | null;
  /** The assistant every team is given (`builtin: team-assistant`), shown first. */
  assistant: boolean;
  /** False when the model it references is gone from the team, or cannot run here (`contextWindowMissing`). */
  modelAvailable: boolean;
  /** The model it calls has no context window configured, so it is not offered (`unsizedModel`, `src/client.ts`). */
  contextWindowMissing: boolean;
  /** Checked against the current session; `unknown` without one. */
  tools: Array<{ name: string; required: boolean; state: ToolState }>;
  plugins: PanelPlugin[];
}

/**
 * The outbound link to the hosted mobile relay (`src/relay.ts`). `off`: not
 * signed in, or the server runs no relay. `connecting`: discovering or dialling.
 * `connected`: the relay welcomed this computer. `refused`: the relay refused
 * the sign-in, or another connection from this computer replaced this one; it
 * waits for the member to sign in again.
 */
export type RelayStatus = 'off' | 'connecting' | 'connected' | 'refused';

/** A phone paired with this computer through the relay; `pending` until the member confirms it here. */
export interface PanelPhone {
  id: string;
  deviceName: string;
  status: 'pending' | 'confirmed';
  createdAt: string;
  lastUsedAt: string | null;
  safetyCode?: string;
  phoneConfirmed?: boolean;
  verified?: boolean;
  /** What the device said it is when it paired (src/phone-security.ts); absent for one paired before devices said. */
  deviceKind?: 'ios' | 'android' | 'web';
}

/** A single-use pairing code, and the link the app's QR scanner reads. */
export interface PanelPairingOffer {
  code: string;
  expiresAt: string;
  /** `dshteamwork://pair?server=…&code=…`, drawn as a QR code. */
  link: string;
}

/**
 * This DSH as its team's shared DSH (`src/shared-mode.ts`), for whoever runs it: null when shared mode is off. Its
 * members are those the server lists as allowed to reach it, with the devices each has joined by invite here.
 */
export interface PanelShared {
  name: string | null;
  teamName: string | null;
  /** Why the key stopped working, when it did; the machine is then not reachable. */
  error: string | null;
  /** The audit key's fingerprint, or null: no member is admitted until one is set (`src/audit-archive.ts`). */
  auditKey: string | null;
  members: Array<{ userId: string; email: string | null; devices: string[]; locked: boolean }>;
}

export interface PanelState {
  /** The language the panel speaks: the Teamwork account's once read, the system's before (`src/messages.ts`). */
  locale: Locale;
  authRevision: number;
  authenticated: boolean;
  /**
   * Every team the member is in (platform ADR 0013), each with its web console. Teams cached from an earlier
   * sign-in are shown, but not usable, until the member signs in again.
   */
  teams: Array<{ id: string; name: string; role: 'admin' | 'member'; consoleUrl: string }>;
  /** The server this DSH signs in to and syncs from, and the one it uses unless the member picks another. */
  server: string;
  defaultServer: string;
  sync: { auto: boolean; running: boolean; lastSuccess?: string; lastError?: string };
  /** The phone's way in through the hosted relay (`src/relay.ts`); `off` where the server runs none. */
  relay: RelayStatus;
  /** Phones paired with this computer; empty while the relay is not connected. */
  phones: PanelPhone[];
  shared: PanelShared | null;
  /** The session the member has open, when the host has it loaded. */
  session: {
    id: string;
    /** The model the session runs on: a team model id when `team` is true. */
    model: { provider: string; model: string; team: boolean } | null;
    preset: { id: string; name: string; version: number } | null;
    /** A preset can be chosen only before the first turn. */
    started: boolean;
  } | null;
  presets: PanelPreset[];
  /** `contextWindowMissing`: the model has no context window configured, so it cannot be selected. */
  models: Array<{ id: string; teamId: string; teamName: string; name: string; version: number; upstream: string; contextWindowMissing: boolean }>;
  plugins: PanelPlugin[];
}

/** Advisory own-member availability. The gateway remains the admission authority. */
export interface PanelQuota {
  remaining: string | null;
  state: 'known' | 'unlimited' | 'unconfirmed';
  resetAt: string | null;
  tokenLimited: boolean;
  exhausted: boolean;
}

/** One team's `GET /api/teams/{teamId}/summary`, reduced to what the panel shows: the member's budget and the reviews waiting. */
export interface PanelSummary {
  budget: PanelQuota;
  /** Submissions awaiting review: the team's for an admin, the member's own otherwise. */
  pendingReviews: number;
}

export interface PanelProfile {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  locale: Locale | null;
}

/** What the host half implements for the routes. Each throws an `Error` whose message is shown to the member. */
export interface PanelOps {
  summary(teamId: string): Promise<PanelSummary>;
  profile(): Promise<PanelProfile>;
  updateProfile(input: { name: string | null; locale: Locale }): Promise<PanelProfile>;
  state(sessionId: string | undefined): Promise<PanelState>;
  /** The sign-in page; `automatic` when the code comes back to this DSH by itself (src/login-callback.ts). */
  login(): Promise<{ url: string; automatic: boolean }>;
  authorize(code: string): Promise<void>;
  sync(): Promise<void>;
  logout(): Promise<void>;
  /** Points the plugin at another server, or back to the default with `null`; signs out of the current one. */
  setServer(server: string | null): Promise<void>;
  /** Selects a team model or preset for the session; returns what changed. */
  use(sessionId: string, id: string): Promise<string>;
  /** Installs a pinned plugin at exactly the version the member confirmed. */
  install(id: string, version: string): Promise<string>;
  /** A fresh pairing code from the relay; earlier unused codes stop working. */
  pairPhone(): Promise<PanelPairingOffer>;
  /** Confirms or refuses a phone that redeemed a code. */
  decidePhone(id: string, accept: boolean): Promise<void>;
  /** Cuts a paired phone off. */
  revokePhone(id: string): Promise<void>;
  /** Makes this DSH its team's shared DSH with a team host key; a personal sign-in ends first. */
  shareEnable(key: string): Promise<void>;
  shareDisable(): Promise<void>;
  /** Seals the archive to the admin's audit public key; returns its fingerprint. */
  shareAuditKey(key: string): Promise<{ fingerprint: string }>;
  /** A single-use invite for one listed member, to hand over outside the server. */
  shareInvite(email: string): Promise<{ link: string; expiresAt: string }>;
  /** Clears a member's PIN and lock. */
  shareUnlock(email: string): Promise<void>;
}

export const ROUTE_PREFIX = '/api/teamwork';

/** The shape `connection.fetch.register` takes (`@deepseek-ai/dsh-client-connection`). */
export interface FetchRoute {
  path: string;
  methods: Array<'GET' | 'HEAD' | 'POST'>;
  requestBody: 'buffered' | 'streaming';
  fetch(request: Request): Promise<Response>;
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value ?? null), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/** The host's words the routes themselves use, and the request scope that sets their language. */
export interface RouteVoice {
  say(key: 'request.invalid' | 'request.failed' | 'request.missing' | 'profile.nameTooLong' | 'profile.badLocale' | RouteField, values?: Record<string, string>): string;
  /** Runs one request in the panel's language. */
  speak<T>(answer: () => T): T;
}
type RouteField = 'field.team' | 'field.code' | 'field.server' | 'field.session' | 'field.config' | 'field.plugin' | 'field.version' | 'field.device' | 'field.key' | 'field.email';


export function panelRoutes(ops: PanelOps, voice: RouteVoice): FetchRoute[] {
  const { say } = voice;
  const text = (value: unknown, field: RouteField) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(say('request.missing', { field: say(field) }));
    return value.trim();
  };
  const post = (name: string, handle: (body: Record<string, unknown>) => unknown): FetchRoute => ({
    path: `${ROUTE_PREFIX}/${name}`,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: (request) => voice.speak(async () => {
      let body: Record<string, unknown> = {};
      try {
        const raw = await request.text();
        if (raw) body = JSON.parse(raw);
      } catch {
        return json({ error: say('request.invalid') }, 400);
      }
      try {
        return json((await handle(body)) ?? {});
      } catch (error) {
        return json({ error: (error as Error).message || say('request.failed') }, 400);
      }
    }),
  });
  const session = (body: Record<string, unknown>) => (typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : undefined);
  return [
    post('state', (body) => ops.state(session(body))),
    post('profile', () => ops.profile()),
    post('summary', (body) => ops.summary(text(body.teamId, 'field.team'))),
    post('update-profile', (body) => {
      if (body.name !== null && (typeof body.name !== 'string' || body.name.length > 80)) throw new Error(say('profile.nameTooLong'));
      if (body.locale !== 'en' && body.locale !== 'zh-CN') throw new Error(say('profile.badLocale'));
      return ops.updateProfile({ name: body.name as string | null, locale: body.locale });
    }),
    post('login', () => ops.login()),
    post('authorize', (body) => ops.authorize(text(body.code, 'field.code'))),
    post('sync', () => ops.sync()),
    post('logout', () => ops.logout()),
    post('server', (body) => ops.setServer(body.server === null ? null : text(body.server, 'field.server'))),
    post('use', async (body) => ({ message: await ops.use(text(body.sessionId, 'field.session'), text(body.id, 'field.config')) })),
    post('install', async (body) => ({ message: await ops.install(text(body.id, 'field.plugin'), text(body.version, 'field.version')) })),
    post('pair-phone', () => ops.pairPhone()),
    post('decide-phone', (body) => ops.decidePhone(text(body.id, 'field.device'), body.accept === true)),
    post('revoke-phone', (body) => ops.revokePhone(text(body.id, 'field.device'))),
    post('share-enable', (body) => ops.shareEnable(text(body.key, 'field.key'))),
    post('share-disable', () => ops.shareDisable()),
    post('share-audit-key', (body) => ops.shareAuditKey(text(body.key, 'field.key'))),
    post('share-invite', (body) => ops.shareInvite(text(body.email, 'field.email'))),
    post('share-unlock', (body) => ops.shareUnlock(text(body.email, 'field.email'))),
  ];
}
