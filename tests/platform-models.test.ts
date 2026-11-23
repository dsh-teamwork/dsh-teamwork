import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { test, expect } from 'vitest';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findConfig, modelLimitProblem, offlineModel, TeamworkClient, unsizedModel } from '../src/client.js';
import { platformAdapter, teamProvider, teamRoutes } from '../src/platform-models.js';
test('team model uses platform only, with session credential and opaque config ID', async () => {
  let authorization = '', wire: any, path = '';
  const server = createServer(async (req, res) => {
    authorization = req.headers.authorization ?? ''; path = req.url ?? '';
    let body = ''; for await (const part of req) body += part;
    wire = JSON.parse(body);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:1,model:'config1',choices:[{index:0,delta:{role:'assistant',content:'OK'},finish_reason:null}]})+'\n\ndata: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:1,model:'config1',choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as {port:number}).port;
  const dir = await mkdtemp(join(tmpdir(), 'platform-adapter-'));
  const configs = [
    { id: 'config1', kind: 'model', name: 'Team Kimi', version: 1, data: { provider: 'kimi', model: 'kimi-for-coding', contextWindow: 131072, maxTokens: 8192, vision: true, reasoningEfforts: ['low', 'max'] } },
    { id: 'preset1', kind: 'preset', name: 'Writer', version: 1, data: { modelConfigId: 'config1' } },
    { id: 'legacy1', kind: 'preset', name: 'Legacy writer', version: 1, data: { provider: 'kimi', model: 'kimi-for-coding', contextWindow: 131072, maxTokens: 8192 } },
  ];
  const client = new TeamworkClient(`http://127.0.0.1:${port}`, join(dir,'cache'), async input => Response.json(String(input).endsWith('/auth/plugin/token') ? {token:'platform-session-only'} : {teams:[{teamId:'t', teamName:'T', role:'member', configs}]}));
  try {
    client.beginLogin(); await client.completeLogin('code'); await client.sync();
    const adapter = platformAdapter(client);
    const info = await adapter.resolveModel(teamProvider('t'), 'config1');
    expect(info.context?.contextWindow).toBe(131072);
    expect(info.reasoning?.efforts.map(({ id }) => id)).toEqual(['low', 'max']);
    expect(info.inputModalities).toEqual(['text', 'image']);
    expect(client.current()?.teams[0]?.configs[0]?.data).toMatchObject({ vision: true });
    const provider = teamProvider('t');
    expect((await adapter.listModels(provider)).map(model => model.id)).toEqual(['config1']);
    // Named by its configuration's id, and described by the model it calls: what DSH, the console and the phone show.
    expect((await adapter.listModels(provider)).map(({ name, description }) => ({ name, description }))).toEqual([{ name: 'Team Kimi', description: 'kimi-for-coding' }]);
    for (const model of ['config1', 'preset1', 'legacy1']) {
      const call = await adapter.prepareCall(provider, model);
      expect(call.model).toMatchObject({ id: model, context: { contextWindow: 131072 }, defaultMaxTokens: 8192 });
      let text = '';
      for await (const chunk of call.stream({ provider, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }] })) {
        if (chunk.type === 'text-delta') text += chunk.text;
      }
      expect(text).toBe('OK');
      expect(path).toBe('/api/llm/chat/completions');
      expect(authorization).toBe('Bearer platform-session-only');
      expect(wire.model).toBe(model);
      expect(wire.max_tokens ?? wire.max_completion_tokens).toBe(8192);
    }
    expect(wire.reasoning_effort).toBeUndefined();
    for await (const chunk of adapter.stream({
      provider: teamProvider('t'), model: 'config1', reasoningEffort: ReasoningEffortId('max'),
      system: 'Instructions', messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    })) {
      if (chunk.type === 'finish') expect(chunk.reason.kind).not.toBe('error');
    }
    expect(wire.reasoning_effort).toBe('max');
    expect(wire.messages[0].role).toBe('system');
    await client.logout();
    await expect((async () => { for await (const chunk of adapter.stream({provider:teamProvider('t'),model:'config1',messages:[]})) { if(chunk.type==='finish' && chunk.reason.kind==='error') throw new Error('unauthorized'); } })()).rejects.toThrow();
  } finally { server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); await rm(dir,{recursive:true,force:true}); }
});
test('a team model without its context window is not offered, and says why', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'platform-limits-'));
  const configs = [
    {id:'sized',kind:'model',name:'Sized',version:1,data:{provider:'kimi',model:'kimi-for-coding',contextWindow:131072}},
    {id:'unsized',kind:'model',name:'DeepSeek Flash',version:1,data:{provider:'hosted:billing',model:'deepseek-flash'}},
    {id:'uses-unsized',kind:'preset',name:'Writer',version:1,data:{modelConfigId:'unsized',systemPrompt:''}},
    {id:'legacy',kind:'preset',name:'Legacy',version:1,data:{provider:'openai',model:'gpt',systemPrompt:''}},
    {id:'inherits',kind:'preset',name:'Inherits',version:1,data:{inheritModel:true,systemPrompt:''}},
  ];
  const client = new TeamworkClient('http://127.0.0.1:9', join(dir,'cache'), async input => Response.json(String(input).endsWith('/auth/plugin/token') ? {token:'t'} : {teams:[{teamId:'t',teamName:'T',role:'member',configs}]}));
  try {
    client.beginLogin(); await client.completeLogin('code'); await client.sync();
    const adapter = platformAdapter(client);
    expect((await adapter.listModels(teamProvider('t'))).map(m => m.id)).toEqual(['sized']);
    expect((await adapter.resolveModel(teamProvider('t'), 'sized')).context?.contextWindow).toBe(131072);
    const snapshot = client.current()!, config = (id: string) => findConfig(snapshot, id)!;
    expect(modelLimitProblem(snapshot, config('sized'))).toBeUndefined();
    expect(modelLimitProblem(snapshot, config('inherits'))).toBeUndefined();
    expect(unsizedModel(snapshot, config('unsized'))).toBe('DeepSeek Flash');
    expect(unsizedModel(snapshot, config('uses-unsized'))).toBe('DeepSeek Flash');
    expect(unsizedModel(snapshot, config('legacy'))).toBe('openai/gpt');
    expect(modelLimitProblem(snapshot, config('unsized'))).toContain('“DeepSeek Flash” has no context window');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('a hosted model taken offline stays in the team but is not offered, and says why; back in service it is offered again', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'platform-offline-'));
  let offline = true;
  const configs = () => [
    {id:'live',kind:'model',name:'Live',version:1,data:{provider:'hosted:billing',model:'live',contextWindow:131072}},
    {id:'opus',kind:'model',name:'Opus',version:offline ? 2 : 3,data:{provider:'hosted:billing',model:'opus',contextWindow:200000,...(offline ? {offline:true} : {})}},
    {id:'uses-opus',kind:'preset',name:'Reviewer',version:1,data:{modelConfigId:'opus',systemPrompt:''}},
  ];
  const client = new TeamworkClient('http://127.0.0.1:9', join(dir,'cache'), async input => Response.json(String(input).endsWith('/auth/plugin/token') ? {token:'t'} : {teams:[{teamId:'t',teamName:'T',role:'member',configs:configs()}]}));
  try {
    client.beginLogin(); await client.completeLogin('code'); await client.sync();
    const adapter = platformAdapter(client);
    expect((await adapter.listModels(teamProvider('t'))).map(m => m.id)).toEqual(['live']);
    const snapshot = client.current()!, config = (id: string) => findConfig(snapshot, id)!;
    expect(offlineModel(snapshot, config('opus'))).toBe('Opus');
    expect(offlineModel(snapshot, config('uses-opus'))).toBe('Opus');
    expect(offlineModel(snapshot, config('live'))).toBeUndefined();
    expect(modelLimitProblem(snapshot, config('uses-opus'))).toContain('“Opus” has been taken offline');
    offline = false; await client.sync();
    expect((await adapter.listModels(teamProvider('t'))).map(m => m.id)).toEqual(['live', 'opus']);
    expect((await adapter.resolveModel(teamProvider('t'), 'uses-opus')).context?.contextWindow).toBe(200000);
    expect(modelLimitProblem(client.current()!, findConfig(client.current()!, 'uses-opus')!)).toBeUndefined();
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('each team is its own provider, headed Teamwork and the team’s name, and the routes follow the teams', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'platform-teams-'));
  const model = (id: string) => ({id,kind:'model',name:'MiniMax-M3',version:1,data:{provider:'minimax',model:'m3',contextWindow:131072}});
  let teams = [{teamId:'a',teamName:'Alpha',role:'member',configs:[model('ma')]},{teamId:'b',teamName:'Beta',role:'admin',configs:[model('mb')]}];
  const client = new TeamworkClient('http://127.0.0.1:9', join(dir,'cache'), async input => Response.json(String(input).endsWith('/auth/plugin/token') ? {token:'t'} : {teams}));
  const registered: string[][] = [], replaced: string[][] = []; let released = 0;
  const llm = { registerAdapter: (providers: string[]) => { registered.push(providers); return Object.assign(() => { released++; }, { replace: (next: string[]) => { replaced.push(next); } }); } };
  try {
    const adapter = platformAdapter(client), routes = teamRoutes(llm, client, adapter);
    routes.sync(); expect(registered).toEqual([]);
    client.beginLogin(); await client.completeLogin('code'); await client.sync(); routes.sync();
    expect(registered).toEqual([[teamProvider('a'), teamProvider('b')]]);
    expect(adapter.providerInfo(teamProvider('a')).name).toBe('Teamwork Alpha');
    expect((await adapter.listModels(teamProvider('a'))).map(m => m.id)).toEqual(['ma']);
    expect((await adapter.listModels(teamProvider('b'))).map(m => m.id)).toEqual(['mb']);
    teams = [teams[1]!]; await client.sync(); routes.sync();
    expect(replaced).toEqual([[teamProvider('b')]]);
    await client.logout(); routes.sync(); expect(replaced.at(-1)).toEqual([]);
    routes.dispose(); expect(released).toBe(1);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
