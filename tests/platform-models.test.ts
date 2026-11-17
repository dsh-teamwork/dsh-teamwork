import { test, expect } from 'vitest';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findConfig, modelLimitProblem, TeamworkClient, unsizedModel } from '../src/client.js';
import { platformAdapter, platformProvider } from '../src/platform-models.js';
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
  const client = new TeamworkClient(`http://127.0.0.1:${port}`, join(dir,'cache'), async input => Response.json(String(input).endsWith('/auth/plugin/token') ? {token:'platform-session-only'} : {teams:[{teamId:'t', teamName:'T', role:'member', configs:[{id:'config1',kind:'model',name:'Team Kimi',version:1,data:{provider:'kimi',model:'kimi-for-coding',contextWindow:131072,maxTokens:8192}}]}]}));
  try {
    client.beginLogin(); await client.completeLogin('code'); await client.sync();
    const adapter = platformAdapter(client);
    const info = await adapter.resolveModel(platformProvider, 'config1');
    expect(info.context?.contextWindow).toBe(131072);
    expect((await adapter.listModels(platformProvider))[0]?.id).toBe('config1');
    let text = ''; const chunks = [];
    for await (const chunk of adapter.stream({provider:platformProvider,model:'config1',messages:[{role:'user',content:[{type:'text',text:'Hello'}]}]})) { chunks.push(chunk); if(chunk.type==='text-delta') text+=chunk.text; }
    expect(text, JSON.stringify(chunks)).toBe('OK');
    expect(path).toBe('/api/llm/chat/completions'); expect(authorization).toBe('Bearer platform-session-only'); expect(wire.model).toBe('config1'); expect(wire.max_tokens ?? wire.max_completion_tokens).toBe(8192);
    await client.logout();
    await expect((async () => { for await (const chunk of adapter.stream({provider:platformProvider,model:'config1',messages:[]})) { if(chunk.type==='finish' && chunk.reason.kind==='error') throw new Error('unauthorized'); } })()).rejects.toThrow();
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
    expect((await adapter.listModels(platformProvider)).map(m => m.id)).toEqual(['sized']);
    expect((await adapter.resolveModel(platformProvider, 'sized')).context?.contextWindow).toBe(131072);
    const snapshot = client.current()!, config = (id: string) => findConfig(snapshot, id)!;
    expect(modelLimitProblem(snapshot, config('sized'))).toBeUndefined();
    expect(modelLimitProblem(snapshot, config('inherits'))).toBeUndefined();
    expect(unsizedModel(snapshot, config('unsized'))).toBe('DeepSeek Flash');
    expect(unsizedModel(snapshot, config('uses-unsized'))).toBe('DeepSeek Flash');
    expect(unsizedModel(snapshot, config('legacy'))).toBe('openai/gpt');
    expect(modelLimitProblem(snapshot, config('unsized'))).toContain('“DeepSeek Flash” has no context window');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
