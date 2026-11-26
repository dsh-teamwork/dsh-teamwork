import { ROUTE_PREFIX, type PanelCatalogItem, type PanelPairingOffer, type PanelState, type PanelProfile, type PanelSummary, type PanelTeamUsage } from '../panel.js';
import type { Locale } from '../locale.js';

/** A request that never reached the host's answer; the panel words it in its own language. */
export class HostUnreachable extends Error {
  constructor(readonly reason: 'offline' | 'not-loaded' | 'status', readonly status?: number) { super(reason); }
}

// Relative to the page, like the host's own calls, so a DSH served under a path still reaches it.
const base = ROUTE_PREFIX.slice(1) + '/';

async function call<T>(route: string, payload: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(base + route, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
    });
  } catch {
    throw new HostUnreachable('offline');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 404 && !data) throw new HostUnreachable('not-loaded');
    // The host words its own errors in the member's language (src/messages.ts).
    if (data?.error) throw new Error(data.error);
    throw new HostUnreachable('status', response.status);
  }
  return data as T;
}

export const api = {
  summary: (teamId: string) => call<PanelSummary>('summary', { teamId }),
  teamUsage: (teamId: string) => call<PanelTeamUsage>('team-usage', { teamId }),
  profile: () => call<PanelProfile>('profile'),
  updateProfile: (input: { name?: string | null; locale: Locale }) => call<PanelProfile>('update-profile', input),
  state: (sessionId: string | undefined) => call<PanelState>('state', { sessionId }),
  login: () => call<{ url: string; automatic: boolean }>('login'),
  authorize: (code: string) => call('authorize', { code }),
  sync: () => call('sync'),
  logout: () => call('logout'),
  setWorkspace: (teamId: string, path: string) => call<void>('workspace', { teamId, path }),
  setServer: (server: string | null) => call('server', { server }),
  use: (sessionId: string, id: string) => call<{ message: string }>('use', { sessionId, id }),
  install: (id: string, version: string) => call<{ message: string }>('install', { id, version }),
  catalog: (teamId: string) => call<PanelCatalogItem[]>('catalog', { teamId }),
  here: (teamId: string, id: string, on: boolean) => call<void>('here', { teamId, id, on }),
  setOwnerPin: (pin: string | null) => call<void>('owner-pin', { pin }),
  setNativeWeb: (enabled: boolean) => call<void>('native-web', { enabled }),
  disconnectNativeWeb: () => call<void>('native-web-disconnect'),
  pairPhone: () => call<PanelPairingOffer>('pair-phone', {}),
  decidePhone: (id: string, accept: boolean) => call<void>('decide-phone', { id, accept }),
  revokePhone: (id: string) => call<void>('revoke-phone', { id }),
};
