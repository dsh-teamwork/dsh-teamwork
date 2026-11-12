import { ROUTE_PREFIX, type PanelState } from '../panel.js';

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
    throw new Error('无法连接 DSH 服务');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 404 && !data) throw new Error('DSH 还没有加载 Teamwork 插件的服务端，请重启 DSH');
    throw new Error(data?.error || `请求失败（HTTP ${response.status}）`);
  }
  return data as T;
}

export const api = {
  state: (sessionId: string | undefined) => call<PanelState>('state', { sessionId }),
  login: () => call<{ url: string }>('login'),
  authorize: (code: string) => call('authorize', { code }),
  sync: () => call('sync'),
  logout: () => call('logout'),
  setServer: (server: string | null) => call('server', { server }),
  use: (sessionId: string, id: string) => call<{ message: string }>('use', { sessionId, id }),
  install: (id: string, version: string) => call<{ message: string }>('install', { id, version }),
};
