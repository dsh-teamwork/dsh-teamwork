import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
export const inject = ['dshTeamwork', 'agentPresets', 'agents', 'commands', 'pluginManager'];
export function apply(ctx) {
 const timer = setTimeout(async () => {
  try {
   const cache = process.env.TEAMWORK_TEST_CACHE;
   const snapshot = JSON.parse(await readFile(process.env.TEAMWORK_TEST_SNAPSHOT, 'utf8'));
   assert.equal(ctx.dshTeamwork.list(), undefined, 'Corrupt cache must not prevent host startup or authenticate');
   await writeFile(cache, JSON.stringify(snapshot)); await ctx.dshTeamwork.reload();
   const releaseLocal = await ctx.agentPresets.register({ id: 'local-review', name: '[团队] Review', plugins: [] });
   const originalRoster = await ctx.agentPresets.list();
   assert(originalRoster.some(p => p.id === 'team:host-smoke:review'));
   const id = `teamwork-host-${process.pid}`;
   await ctx.agents.create({ sessionId: id, meta: { cwd: process.env.TEAMWORK_TEST_CWD, agentPreset: 'team:host-smoke:review' }, setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, 'team:host-smoke:review'); } });
   const agent = ctx.agents.get(id);
   assert(ctx.commands.list(agent).some(c => c.name === 'team'));
   assert.deepEqual(agent.model.current(), { provider: 'deepseek', model: 'deepseek-chat' });
   const require = createRequire(process.env.DSH_CLI);
   const { renderPrompt } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-system-prompt')).href);
   const promptAssembly = await agent.ctx.systemPrompt.assemble({ agent, scope: agent, modelSelection: agent.model.current() });
   // Render the contributed section before a model turn supplies the host's
   // other dynamic variables (model, working directory, etc.).
   const teamSections = promptAssembly.sections.filter(section => section.name === 'teamwork:prompt');
   assert.equal(renderPrompt({ ...promptAssembly, sections: teamSections }), 'Review {{literal_team_token}}.');
   assert(promptAssembly.sections.some(section => section.name === 'teamwork:prompt'));
   assert(promptAssembly.sections.some(section => section.name !== 'teamwork:prompt'), 'Team text must not replace the local prompt');
   const execute = line => ctx.commands.execute(agent, line, [], new AbortController().signal);
   const unprompted = await execute('/team install fixture confirm');
   assert.equal(unprompted.result.kind, 'error');
   const prompt = await execute('/team install fixture');
   assert.equal(prompt.result.kind, 'success'); assert.match(prompt.result.text, /confirm/);
   assert.equal(ctx.get('teamworkFixture'), undefined, 'Unconfirmed install must not run code');
   snapshot.configs[1].data.version = '2.0.0';
   await writeFile(cache, JSON.stringify(snapshot)); await ctx.dshTeamwork.reload();
   const staleConfirmation = await execute('/team install fixture confirm');
   assert.equal(staleConfirmation.result.kind, 'error');
   snapshot.configs[1].data.version = '1.0.0';
   await writeFile(cache, JSON.stringify(snapshot)); await ctx.dshTeamwork.reload();
   await execute('/team install fixture');
   const install = await execute('/team install fixture confirm');
   assert.equal(install.result.kind, 'success', install.result.text);
   const bundle = (await ctx.pluginManager.listBundles()).find(b => b.name === '@teamwork-test/fixture');
   assert(bundle, 'Installed bundle absent');
   if (!install.result.text.includes('重启')) assert.equal(ctx.get('teamworkFixture')?.version, '1.0.0');
   await execute('/team install fixture');
   const duplicate = await execute('/team install fixture confirm');
   assert.equal(duplicate.result.kind, 'error', 'Existing installation must not be silently overwritten');
   const originalPlugins = await ctx.pluginManager.listPlugins();
   await execute('/team install override');
   const blocked = await execute('/team install override confirm');
   assert.equal(blocked.result.kind, 'error'); assert.match(blocked.result.text, /未启用/);
   const disabled = (await ctx.pluginManager.listBundles()).find(b => b.name === '@teamwork-test/override');
   assert(disabled?.installed); assert.equal(disabled.enabled, false);
   assert.equal(ctx.get('teamworkOverride'), undefined, 'Override bundle code must never run');
   const afterPlugins = await ctx.pluginManager.listPlugins();
   for (const before of originalPlugins) { const after = afterPlugins.find(p => p.entryId === before.entryId); assert.equal(after?.enabled, before.enabled, `Changed local plugin ${before.entryId}`); }
   snapshot.configs[0].version = 2; snapshot.configs[0].name = 'Updated review'; snapshot.configs[0].data.model = 'deepseek-reasoner';
   await writeFile(cache, JSON.stringify(snapshot)); await ctx.dshTeamwork.reload();
   const updated = await ctx.agentPresets.list(); assert(updated.some(p => p.id === 'team:host-smoke:review' && p.name === '[团队] Updated review'));
   assert(updated.some(p => p.id === 'local-review'));
   const use = await execute('/team use review'); assert.equal(use.result.kind, 'success', use.result.text);
   assert.equal(agent.model.current().model, 'deepseek-reasoner');
   const logout = await execute('/team logout'); assert.equal(logout.result.kind, 'success');
   const remaining = await ctx.agentPresets.list(); assert(!remaining.some(p => p.id.startsWith('team:host-smoke:')));
   for (const preset of originalRoster.filter(p => !p.id.startsWith('team:host-smoke:'))) assert(remaining.some(p => p.id === preset.id), `Lost local preset ${preset.id}`);
   assert((await ctx.pluginManager.listBundles()).some(b => b.name === '@teamwork-test/fixture'), 'Logout must not uninstall a user-approved plugin');
   await releaseLocal();
   await writeFile(process.env.TEAMWORK_TEST_RESULT, JSON.stringify({ passed: true, checks: ['corrupt cache startup recovery', 'real DSH load', 'preset registration', 'session model selection', 'literal additive team prompt', 'install confirmation', 'stale version confirmation rejected', 'package installation', 'duplicate install protection', 'configuration-overriding bundle blocked before activation', 'preset update', 'local preset preservation', 'logout cleanup', 'installed plugin preserved after logout'] }));
  } catch (error) { await writeFile(process.env.TEAMWORK_TEST_RESULT, JSON.stringify({ passed: false, error: String(error), stack: error.stack })); }
 }, 3000);
 ctx.effect(() => () => clearTimeout(timer));
}
