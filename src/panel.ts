/**
 * The Teamwork sidebar panel's wire: what the browser half (`src/web/`) asks
 * the host half for, and the routes that answer it. The routes run the same
 * functions as the `/teamwork` command, in the host process, so the platform
 * token stays here and never reaches the browser. DSH admits only its owner
 * peer to an exact route.
 *
 * This file is imported by both halves: types only, no Node or host imports.
 */

import type { PluginState } from './plugin-status.js';
export type { PluginState };

export type ToolState = 'available' | 'conditional' | 'missing' | 'unknown';

export interface PanelPlugin {
  id: string;
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
  name: string;
  version: number;
  description: string;
  /** The team model the preset calls, or its own provider/model. */
  model: string;
  /** False when the model it references is gone from the team. */
  modelAvailable: boolean;
  /** Checked against the current session; `unknown` without one. */
  tools: Array<{ name: string; required: boolean; state: ToolState }>;
  plugins: PanelPlugin[];
}

export interface PanelState {
  authenticated: boolean;
  /** A team cached from an earlier sign-in is shown, but not usable, until the member signs in again. */
  team: { id: string; name: string; role: 'admin' | 'member' } | null;
  /** The web console, for an admin. */
  consoleUrl: string;
  /** The server this DSH signs in to and syncs from, and the one it uses unless the member picks another. */
  server: string;
  defaultServer: string;
  sync: { auto: boolean; running: boolean; lastSuccess?: string; lastError?: string };
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
  models: Array<{ id: string; name: string; version: number; upstream: string }>;
  plugins: PanelPlugin[];
}

/** What the host half implements for the routes. Each throws an `Error` whose message is shown to the member. */
export interface PanelOps {
  state(sessionId: string | undefined): Promise<PanelState>;
  login(): string;
  authorize(code: string): Promise<void>;
  sync(): Promise<void>;
  logout(): Promise<void>;
  /** Points the plugin at another server, or back to the default with `null`; signs out of the current one. */
  setServer(server: string | null): Promise<void>;
  /** Selects a team model or preset for the session; returns what changed. */
  use(sessionId: string, id: string): Promise<string>;
  /** Installs a pinned plugin at exactly the version the member confirmed. */
  install(id: string, version: string): Promise<string>;
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

const text = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`缺少 ${field}`);
  return value.trim();
};

export function panelRoutes(ops: PanelOps): FetchRoute[] {
  const post = (name: string, handle: (body: Record<string, unknown>) => unknown): FetchRoute => ({
    path: `${ROUTE_PREFIX}/${name}`,
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      let body: Record<string, unknown> = {};
      try {
        const raw = await request.text();
        if (raw) body = JSON.parse(raw);
      } catch {
        return json({ error: '请求格式无效' }, 400);
      }
      try {
        return json((await handle(body)) ?? {});
      } catch (error) {
        return json({ error: (error as Error).message || '操作失败' }, 400);
      }
    },
  });
  const session = (body: Record<string, unknown>) => (typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : undefined);
  return [
    post('state', (body) => ops.state(session(body))),
    post('login', () => ({ url: ops.login() })),
    post('authorize', (body) => ops.authorize(text(body.code, '授权码'))),
    post('sync', () => ops.sync()),
    post('logout', () => ops.logout()),
    post('server', (body) => ops.setServer(body.server === null ? null : text(body.server, '服务器地址'))),
    post('use', async (body) => ({ message: await ops.use(text(body.sessionId, '会话'), text(body.id, '配置 ID')) })),
    post('install', async (body) => ({ message: await ops.install(text(body.id, '插件 ID'), text(body.version, '版本')) })),
  ];
}
