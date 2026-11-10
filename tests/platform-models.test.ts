import { test, expect } from 'vitest';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TeamworkClient } from '../src/client.js';
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
  const client = new TeamworkClient(`http://127.0.0.1:${port}`, join(dir,'cache'), async input => Response.json(String(input).endsWith('/auth/plugin/token') ? {token:'platform-session-only'} : {teamId:'t', configs:[{id:'config1',kind:'model',name:'Team Kimi',version:1,data:{provider:'kimi',model:'kimi-for-coding',contextWindow:131072,maxTokens:8192}}]}));
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
