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
  /** False when the model it references is gone from the team, or cannot run here (`contextWindowMissing`, `modelOffline`). */
  modelAvailable: boolean;
  /** The model it calls has no context window configured, so it is not offered (`unsizedModel`, `src/client.ts`). */
  contextWindowMissing: boolean;
  /** The hosted model it calls is taken out of service, so it is not offered (`offlineModel`, `src/client.ts`). */
  modelOffline: boolean;
  /** Checked against the current session; `unknown` without one. */
  tools: Array<{ name: string; required: boolean; state: ToolState }>;
  plugins: PanelPlugin[];
}

/**
 * The outbound link to the hosted mobile relay (`src/relay.ts`). `off`: not
 * signed in, or the server runs no relay. `connecting`: discovering or dialling.
 * `connected`: the relay welcomed this computer. `refused`: the relay refused
 * the sign-in (expired, or the account is in no team), or another connection
 * from this computer replaced this one; it waits for the member to sign in
 * again, or, refused for want of a team, for a sync that finds one.
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

export interface PanelState {
  /** The language the panel speaks: the Teamwork account's once read, the system's before (`src/messages.ts`). */
  locale: Locale;
  authRevision: number;
  authenticated: boolean;
  /**
   * Every team the member is in (platform ADR 0013), each with its web console. Teams cached from an earlier
   * sign-in are shown, but not usable, until the member signs in again.
   */
  teams: Array<{
    id: string; name: string; role: 'admin' | 'member'; consoleUrl: string;
    /** Where a session started for this team from a phone or the web console lands (src/team-workspaces.ts). */
    workspace: string | null;
  }>;
  /** The server this DSH signs in to and syncs from, and the one it uses unless the member picks another. */
  server: string;
  defaultServer: string;
  sync: { auto: boolean; running: boolean; lastSuccess?: string; lastError?: string };
  /** The phone's way in through the hosted relay (`src/relay.ts`); `off` where the server runs none. */
  relay: RelayStatus;
  /** Phones paired with this computer; empty while the relay is not connected. */
  phones: PanelPhone[];
  ownerPinEnabled?: boolean;
  /**
   * The owner's native Web switch (`src/web-relay.ts`), on a personal computer only. `blocked` says what keeps it
   * from working: a device PIN is set, or DSH serves no Web here.
   */
  nativeWeb?: { enabled: boolean; blocked?: 'pin' | 'web'; active: { tunnels: number; lastActivity?: string } };
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
  /** `contextWindowMissing`: the model has no context window configured; `modelOffline`: its service took it out of service. Either way it cannot be selected. */
  models: Array<{
    id: string; teamId: string; teamName: string; name: string; version: number;
    /** The model the configuration calls, shown under the name where it differs: the console's and the phone's rule (relay-client's modelDetail), with no provider. */
    model: string;
    contextWindow?: number; maxTokens?: number; vision?: boolean;
    contextWindowMissing: boolean; modelOffline: boolean;
  }>;
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

/** One team's `GET /api/teams/{teamId}/summary`, reduced to what the panel shows: the member's budget. */
export interface PanelSummary {
  budget: PanelQuota;
}

/**
 * The member's own last 30 days in one team, for its settings page, laid out as the web console's My usage: what
 * they called, spent and sent (the team's `summary` and `usage/stats`, both in the caller's own scope), each day's
 * points, which models and meters it went to, their budget, and the limits near their end.
 */
export interface PanelTeamUsage {
  since: string;
  /** Points are decimal strings; calls without a price yet are counted in `unpriced` instead. Input includes cache
   * reads, and output includes reasoning. */
  totals: { calls: number; points: string; unpriced: number; input: number; cacheRead: number; output: number; reasoning: number };
  /** Every calendar day of the period on this computer, oldest first, spent on or not. */
  days: Array<{ day: string; calls: number; points: string }>;
  /** Most points first; a meter's `labels` name it in each language its edition registered. */
  sources: Array<{ kind: 'model' | 'meter'; name: string; labels: Record<string, string>; calls: number; points: string }>;
  budget: PanelQuota;
  nearLimit: Array<{ scope: 'team' | 'member' | 'provider'; period: 'day' | 'month'; threshold: number }>;
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
  teamUsage(teamId: string): Promise<PanelTeamUsage>;
  profile(): Promise<PanelProfile>;
  updateProfile(input: { name?: string | null; locale: Locale }): Promise<PanelProfile>;
  state(sessionId: string | undefined): Promise<PanelState>;
  /** The sign-in page; `automatic` when the code comes back to this DSH by itself (src/login-callback.ts). */
  login(manual?: boolean): Promise<{ url: string; automatic: boolean }>;
  authorize(code: string): Promise<void>;
  sync(): Promise<void>;
  logout(): Promise<void>;
  /** Sets a team's default workspace: where DSH started, or one of DSH's workspaces (the panel picks from DSH's own menu). */
  setWorkspace(teamId: string, path: string): Promise<void>;
  /** Points the plugin at another server, or back to the default with `null`; signs out of the current one. */
  setServer(server: string | null): Promise<void>;
  /** Selects a team model or preset for the session; returns what changed. */
  use(sessionId: string, id: string): Promise<string>;
  /** Installs a pinned plugin at exactly the version the member confirmed. */
  install(id: string, version: string): Promise<string>;
  /** A fresh pairing code from the relay; earlier unused codes stop working. */
  setOwnerPin(pin: string | null): Promise<void>;
  /** Turns native Web on or off for the account signed in here; on is refused while it is blocked. */
  setNativeWeb(on: boolean): Promise<void>;
  /** Ends every native Web session the server holds for this computer, and every tunnel open here. */
  disconnectNativeWeb(): Promise<void>;
  pairPhone(): Promise<PanelPairingOffer>;
  /** Confirms or refuses a phone that redeemed a code. */
  decidePhone(id: string, accept: boolean, safetyCode?: string): Promise<void>;
  /** Cuts a paired phone off. */
  revokePhone(id: string): Promise<void>;
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
type RouteField = 'field.team' | 'field.code' | 'field.server' | 'field.session' | 'field.config' | 'field.plugin' | 'field.version' | 'field.device' | 'field.key' | 'field.email' | 'field.workspace';


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
      const origin = request.headers.get('origin');
      const site = request.headers.get('sec-fetch-site');
      if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
        || (site && site !== 'same-origin')
        || (origin && site !== 'same-origin' && origin !== new URL(request.url).origin)) {
        return json({ error: say('request.invalid') }, 403);
      }
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
    post('team-usage', (body) => ops.teamUsage(text(body.teamId, 'field.team'))),
    post('update-profile', (body) => {
      if (body.name !== undefined && body.name !== null && (typeof body.name !== 'string' || body.name.length > 80)) throw new Error(say('profile.nameTooLong'));
      if (body.locale !== 'en' && body.locale !== 'zh-CN') throw new Error(say('profile.badLocale'));
      return ops.updateProfile(body.name === undefined ? { locale: body.locale } : { name: body.name as string | null, locale: body.locale });
    }),
    post('login', (body) => ops.login(body.manual === true)),
    post('authorize', (body) => ops.authorize(text(body.code, 'field.code'))),
    post('sync', () => ops.sync()),
    post('logout', () => ops.logout()),
    // A path is taken as given, never trimmed: a folder's name may end in a space.
    post('workspace', (body) => {
      if (typeof body.path !== 'string' || !body.path) throw new Error(say('request.missing', { field: say('field.workspace') }));
      return ops.setWorkspace(text(body.teamId, 'field.team'), body.path);
    }),
    post('server', (body) => ops.setServer(body.server === null ? null : text(body.server, 'field.server'))),
    post('use', async (body) => ({ message: await ops.use(text(body.sessionId, 'field.session'), text(body.id, 'field.config')) })),
    post('install', async (body) => ({ message: await ops.install(text(body.id, 'field.plugin'), text(body.version, 'field.version')) })),
    post('owner-pin', body => {
      if (body.pin !== null && typeof body.pin !== 'string') throw new Error(say('request.invalid'));
      return ops.setOwnerPin(body.pin);
    }),
    post('native-web', body => {
      if (typeof body.enabled !== 'boolean') throw new Error(say('request.invalid'));
      return ops.setNativeWeb(body.enabled);
    }),
    post('native-web-disconnect', () => ops.disconnectNativeWeb()),
    post('pair-phone', () => ops.pairPhone()),
    post('decide-phone', (body) => ops.decidePhone(text(body.id, 'field.device'), body.accept === true, typeof body.safetyCode === 'string' ? body.safetyCode : undefined)),
    post('revoke-phone', (body) => ops.revokePhone(text(body.id, 'field.device'))),
  ];
}
