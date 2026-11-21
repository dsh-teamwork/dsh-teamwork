/**
 * Teamwork search: a web search provider for DSH's web seam (`ctx.web`) that searches through the signed-in
 * Teamwork server, which holds the search key, so a member needs none of their own. It is registered only while the
 * server offers it (the hosted service does; a self-hosted server does not), and a member picks it in DSH's web
 * search settings; DSH's own default stays as it was. Only the query and the result count leave the computer.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { TeamworkClient } from './client.js';

/** What the plugin uses of DSH's web seam (`@deepseek-ai/dsh-web`). */
interface WebSeam {
  registerSearchProvider(provider: {
    id: string; title: string; description: Record<string, string>;
    available(): boolean; ready(): Promise<boolean>;
    search(request: { query: string; maxResults?: number }, signal?: AbortSignal): Promise<{ sources: { url: string; title?: string; snippet?: string; summary?: string; publishedAt?: string }[]; truncated: boolean }>;
  }): () => void;
}

export const PROVIDER_ID = 'teamwork';

/**
 * Registers the provider while the server offers search. `refresh` asks the server again; the plugin calls it after
 * each sync, so a sign-in, a sign-out or another server is seen within one sync. A server that could not be asked
 * keeps whatever was decided last.
 */
export function teamworkSearch(client: Pick<TeamworkClient, 'authenticated' | 'endpoint' | 'webSearchOffered' | 'webSearch'>) {
  let web: WebSeam | undefined, offered = false, dispose: (() => void) | undefined;
  const settle = () => {
    if (web && offered && !dispose) dispose = web.registerSearchProvider({
      id: PROVIDER_ID, title: 'Teamwork',
      description: {
        en: 'Searches through your Teamwork sign-in, on the service’s key: no key of your own. Free for now, within a daily allowance.',
        zh: '通过你的 Teamwork 登录搜索，使用服务方的 key，无需自己配置。目前免费，每天有额度。',
      },
      available: () => client.authenticated(),
      ready: async () => client.authenticated(),
      search: async (request, signal) => ({ sources: await client.webSearch(request.query, request.maxResults, signal), truncated: false }),
    });
    if ((!web || !offered) && dispose) { dispose(); dispose = undefined; }
  };
  return {
    /** For `ctx.inject(['web'], …)`: the seam, while DSH has one. */
    attach(ctx: Context) {
      web = ctx.get('web' as never) as WebSeam | undefined;
      settle();
      ctx.effect(() => () => { web = undefined; settle(); });
    },
    async refresh() {
      const answer = await client.webSearchOffered();
      if (answer === undefined) return;
      offered = answer;
      settle();
    },
    offered: () => !!dispose,
  };
}
