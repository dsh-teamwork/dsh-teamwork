/**
 * Teamwork search: a web search provider for DSH's web seam (`ctx.web`) that searches through the signed-in
 * Teamwork server, which holds the search key, so a member needs none of their own. It is registered only while the
 * server offers it (the hosted service does; a self-hosted server does not), and a member picks it in DSH's web
 * search settings; DSH's own default stays as it was. Only the query and the result count leave the computer.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { TeamworkClient } from './client.js';
export declare const PROVIDER_ID = "teamwork";
/**
 * Registers the provider while the server offers search. `refresh` asks the server again; the plugin calls it after
 * each sync, so a sign-in, a sign-out or another server is seen within one sync. A server that could not be asked
 * keeps whatever was decided last.
 */
export declare function teamworkSearch(client: Pick<TeamworkClient, 'authenticated' | 'endpoint' | 'webSearchOffered' | 'webSearch'>): {
    /** For `ctx.inject(['web'], …)`: the seam, while DSH has one. */
    attach(ctx: Context): void;
    refresh(): Promise<void>;
    offered: () => boolean;
};
//# sourceMappingURL=web-search.d.ts.map