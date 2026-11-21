export const PROVIDER_ID = 'teamwork';
/**
 * Registers the provider while the server offers search. `refresh` asks the server again; the plugin calls it after
 * each sync, so a sign-in, a sign-out or another server is seen within one sync. A server that could not be asked
 * keeps whatever was decided last.
 */
export function teamworkSearch(client) {
    let web, offered = false, dispose;
    const settle = () => {
        if (web && offered && !dispose)
            dispose = web.registerSearchProvider({
                id: PROVIDER_ID, title: 'Teamwork',
                description: {
                    en: 'Searches through your Teamwork sign-in, on the service’s key: no key of your own. Free for now, within a daily allowance.',
                    zh: '通过你的 Teamwork 登录搜索，使用服务方的 key，无需自己配置。目前免费，每天有额度。',
                },
                available: () => client.authenticated(),
                ready: async () => client.authenticated(),
                search: async (request, signal) => ({ sources: await client.webSearch(request.query, request.maxResults, signal), truncated: false }),
            });
        if ((!web || !offered) && dispose) {
            dispose();
            dispose = undefined;
        }
    };
    return {
        /** For `ctx.inject(['web'], …)`: the seam, while DSH has one. */
        attach(ctx) {
            web = ctx.get('web');
            settle();
            ctx.effect(() => () => { web = undefined; settle(); });
        },
        async refresh() {
            const answer = await client.webSearchOffered();
            if (answer === undefined)
                return;
            offered = answer;
            settle();
        },
        offered: () => !!dispose,
    };
}
//# sourceMappingURL=web-search.js.map