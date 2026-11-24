import { test, expect, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, stat, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KnowledgeError, TeamworkClient, type KnowledgeManifest } from '../src/client.js';
import { KnowledgeSync, knowledgeLayout, knowledgePlan, segment, stripFrontMatter, withFrontMatter } from '../src/knowledge-sync.js';
import { proposalText, registerKnowledgeTool } from '../src/knowledge-tool.js';

test('a path segment is safe on every file system and never hidden', () => {
  expect(segment('Runbook')).toBe('Runbook');
  expect(segment('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
  expect(segment('../etc')).toBe('_._etc');
  expect(segment('.env')).toBe('_env');
  expect(segment('..')).toBe('_');
  expect(segment('Notes. ')).toBe('Notes');
  expect(segment('CON')).toBe('_CON');
  expect(segment('nul.txt')).toBe('_nul.txt');
  expect(segment('tab\there\nnewline')).toBe('tab here newline');
  expect(segment('   ')).toBe('_');
  expect(segment('产品规则')).toBe('产品规则');
  const long = segment('文'.repeat(200));
  expect(Buffer.byteLength(long)).toBeLessThanOrEqual(160);
  expect(long).toBe('文'.repeat(53));
});

const manifest = (documents: { id: string; folders?: string[]; title: string; version: number }[], extra: KnowledgeManifest['teams'] = []): KnowledgeManifest => ({
  teams: [{ teamId: 't1', teamName: 'Core', spaces: [{ id: 's1', name: 'Handbook', documents: documents.map(d => ({ folders: [], ...d })) }] }, ...extra],
});

test('the layout is team, space, folders and title, telling apart names that collide', () => {
  const layout = knowledgeLayout(manifest([
    { id: 'd1', title: 'Glossary', version: 1 },
    { id: 'd2', folders: ['Ops', 'On call'], title: 'Runbook', version: 3 },
    { id: 'd3', title: 'glossary', version: 1 },
    { id: 'd4', folders: ['Glossary.md'], title: 'x', version: 1 },
  ], [{ teamId: 't2', teamName: 'core', spaces: [] }]));
  expect(Object.fromEntries([...layout].map(([id, e]) => [id, e.path]))).toEqual({
    d1: 'Core/Handbook/Glossary.md',
    d2: 'Core/Handbook/Ops/On call/Runbook.md',
    d3: 'Core/Handbook/glossary (d3).md',
    d4: 'Core/Handbook/Glossary.md_/x.md',
  });
  expect(layout.get('d2')).toEqual({ teamId: 't1', version: 3, path: 'Core/Handbook/Ops/On call/Runbook.md' });
});

test('the plan keeps what is current, moves what was renamed and fetches only what changed or is new', () => {
  const state = {
    same: { teamId: 't', version: 2, path: 'a.md' },
    renamed: { teamId: 't', version: 1, path: 'old.md' },
    newer: { teamId: 't', version: 1, path: 'n.md' },
    missing: { teamId: 't', version: 1, path: 'gone.md' },
    removed: { teamId: 't', version: 1, path: 'r.md' },
  };
  const wanted = new Map(Object.entries({
    same: { teamId: 't', version: 2, path: 'a.md' },
    renamed: { teamId: 't', version: 1, path: 'new.md' },
    newer: { teamId: 't', version: 2, path: 'n.md' },
    missing: { teamId: 't', version: 1, path: 'gone.md' },
    fresh: { teamId: 't', version: 1, path: 'f.md' },
  }));
  const plan = knowledgePlan(state, wanted, new Set(['a.md', 'old.md', 'n.md', 'r.md']));
  expect(plan.keep.map(([id]) => id)).toEqual(['same']);
  expect(plan.move).toEqual([{ id: 'renamed', from: 'old.md', to: wanted.get('renamed') }]);
  expect(plan.fetch.map(([id]) => id)).toEqual(['newer', 'missing', 'fresh']);
});

test('front matter is added on sync and removed exactly on propose', () => {
  const texts = ['# Title\n\nBody', '', '---\nowner: ana\n---\n# T', '---\n---\nBody', '---\nunclosed', 'x\r\n---\r\n'];
  for (const text of texts) {
    const copy = withFrontMatter('doc_1', 4, text);
    expect(copy.startsWith('---\nknowledge: doc_1@4\n')).toBe(true);
    expect(stripFrontMatter(copy)).toEqual({ text, documentId: 'doc_1', version: 4 });
  }
  expect(withFrontMatter('d', 1, '# T')).toBe('---\nknowledge: d@1\n---\n# T');
  expect(withFrontMatter('d', 1, '---\nowner: ana\n---\n# T')).toBe('---\nknowledge: d@1\nowner: ana\n---\n# T');
  expect(stripFrontMatter('# no front matter')).toEqual({ text: '# no front matter' });
});

test('a proposal reads content or a file inside the workspace, without the copy\'s front matter', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'knowledge-tool-'));
  const outside = await mkdtemp(join(tmpdir(), 'knowledge-outside-'));
  try {
    await writeFile(join(cwd, 'Runbook.md'), withFrontMatter('d1', 2, '# Runbook\n\nNew step'));
    expect(await proposalText(cwd, 'd1', 2, undefined, 'Runbook.md')).toBe('# Runbook\n\nNew step');
    expect(await proposalText(undefined, 'd1', 2, '# Plain', undefined)).toBe('# Plain');
    await expect(proposalText(cwd, 'd2', 2, undefined, 'Runbook.md')).rejects.toThrow(/copy of document d1, not d2/);
    await expect(proposalText(cwd, 'd1', 3, undefined, 'Runbook.md')).rejects.toThrow(/starts from version 2/);
    await writeFile(join(outside, 'x.md'), '# x');
    await expect(proposalText(cwd, 'd1', 2, undefined, join(outside, 'x.md'))).rejects.toThrow(/inside this session's workspace/);
    await symlink(join(outside, 'x.md'), join(cwd, 'link.md'));
    await expect(proposalText(cwd, 'd1', 2, undefined, 'link.md')).rejects.toThrow(/inside this session's workspace/);
    await expect(proposalText(cwd, 'd1', 2, 'x'.repeat((1 << 20) + 1), undefined)).rejects.toThrow(/at most 1 MiB/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

/** A server holding documents by id, each a list of versions' texts; it counts what the plugin fetches. */
function server(teams: () => KnowledgeManifest) {
  const texts = new Map<string, string[]>();
  const fetched: string[] = [];
  const proposals: unknown[] = [];
  const request = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const { pathname, searchParams } = new URL(String(url));
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (pathname === '/api/knowledge') return json(200, teams());
    const document = /^\/api\/teams\/[^/]+\/knowledge\/documents\/([^/]+)(\/proposals)?$/.exec(pathname);
    if (document) {
      const versions = texts.get(document[1]!)!;
      if (document[2]) {
        const body = JSON.parse(String(init!.body));
        if (body.baseVersion !== versions.length) return json(409, { error: 'knowledge_stale' });
        proposals.push(body);
        return json(201, { id: 'p1', documentId: document[1], documentTitle: 'T', baseVersion: body.baseVersion, state: 'pending' });
      }
      const n = Number(searchParams.get('version') || versions.length);
      fetched.push(`${document[1]}@${n}`);
      return json(200, { id: document[1], title: 'T', version: n, text: versions[n - 1] });
    }
    return json(404, { error: 'not_found' });
  });
  return { texts, fetched, proposals, request };
}

async function signedIn(request: typeof fetch) {
  const dir = await mkdtemp(join(tmpdir(), 'knowledge-sync-'));
  const client = new TeamworkClient('https://teamwork.example', join(dir, 'cache.json'), request);
  await writeFile(client.tokenPath, JSON.stringify({ server: 'https://teamwork.example', token: 'token' }));
  await client.restore();
  return { dir, client };
}

test('a sync writes read-only files, then fetches only what changed, moves renamed ones and deletes removed ones', async () => {
  let documents = [{ id: 'd1', title: 'Glossary', version: 1 }, { id: 'd2', folders: ['Ops'], title: 'Runbook', version: 1 }, { id: 'd3', folders: ['Old'], title: 'Gone', version: 1 }];
  const s = server(() => manifest(documents));
  s.texts.set('d1', ['# Glossary']).set('d2', ['# Runbook']).set('d3', ['# Gone']);
  const { dir, client } = await signedIn(s.request as unknown as typeof fetch);
  try {
    const knowledge = new KnowledgeSync(client);
    await knowledge.restore();
    await knowledge.sync();
    const root = join(dir, 'teamwork-knowledge');
    expect(knowledge.root).toBe(root);
    expect(await readFile(join(root, 'Core', 'Handbook', 'Ops', 'Runbook.md'), 'utf8')).toBe('---\nknowledge: d2@1\n---\n# Runbook');
    expect((await stat(join(root, 'Core', 'Handbook', 'Glossary.md'))).mode & 0o777).toBe(0o444);
    expect(s.fetched.sort()).toEqual(['d1@1', 'd2@1', 'd3@1']);
    expect(knowledge.count()).toBe(3);
    expect(knowledge.find('d2')).toEqual({ teamId: 't1', version: 1, path: 'Core/Handbook/Ops/Runbook.md' });

    // Unchanged: nothing is fetched.
    s.fetched.length = 0;
    await knowledge.sync();
    expect(s.fetched).toEqual([]);

    // d1 has a new version, d2 is renamed into another folder, d3 is no longer readable.
    s.texts.set('d1', ['# Glossary', '# Glossary v2']);
    documents = [{ id: 'd1', title: 'Glossary', version: 2 }, { id: 'd2', folders: ['Ops', 'Night'], title: 'On call', version: 1 }];
    await knowledge.sync();
    expect(s.fetched).toEqual(['d1@2']);
    expect(await readFile(join(root, 'Core', 'Handbook', 'Glossary.md'), 'utf8')).toBe('---\nknowledge: d1@2\n---\n# Glossary v2');
    expect(await readFile(join(root, 'Core', 'Handbook', 'Ops', 'Night', 'On call.md'), 'utf8')).toBe('---\nknowledge: d2@1\n---\n# Runbook');
    expect((await readdir(join(root, 'Core', 'Handbook'))).sort()).toEqual(['Glossary.md', 'Ops']);
    expect(await readdir(join(root, 'Core', 'Handbook', 'Ops'))).toEqual(['Night']);
    expect(knowledge.find('d3')).toBeUndefined();

    // A state that survives a restart is read back, so the next sync still fetches nothing.
    const again = new KnowledgeSync(client);
    await again.restore();
    s.fetched.length = 0;
    await again.sync();
    expect(s.fetched).toEqual([]);

    // Signing out removes the copy and its state.
    await client.logout();
    await expect(stat(root)).rejects.toThrow();
    await expect(stat(client.knowledgeStatePath)).rejects.toThrow();
    expect(again.count()).toBe(0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a document that cannot be fetched keeps its version and fails the sync without the transport detail', async () => {
  const s = server(() => manifest([{ id: 'd1', title: 'A', version: 2 }]));
  s.texts.set('d1', ['# v1', '# v2']);
  const { dir, client } = await signedIn(s.request as unknown as typeof fetch);
  try {
    const knowledge = new KnowledgeSync(client);
    await knowledge.restore();
    s.request.mockImplementationOnce(async () => new Response(JSON.stringify({ teams: manifest([{ id: 'd1', title: 'A', version: 1 }]).teams }), { status: 200 }));
    await knowledge.sync();
    s.request.mockImplementation(async (url: string | URL) => {
      if (new URL(String(url)).pathname === '/api/knowledge') return new Response(JSON.stringify(manifest([{ id: 'd1', title: 'A', version: 2 }])), { status: 200 });
      throw new Error('connect ECONNREFUSED token=secret');
    });
    await expect(knowledge.sync()).rejects.toThrow(/^Teamwork knowledge sync failed: 1 of 1 changed documents could not be fetched/);
    expect(knowledge.find('d1')?.version).toBe(1);
    expect(await readFile(join(dir, 'teamwork-knowledge', 'Core', 'Handbook', 'A.md'), 'utf8')).toBe('---\nknowledge: d1@1\n---\n# v1');
    s.request.mockImplementation(async () => { throw new Error('connect ECONNREFUSED token=secret'); });
    const failure = await knowledge.sync().catch((error: Error) => error.message);
    expect(failure).toBe('Teamwork knowledge sync failed: the server could not be reached');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a server without knowledge holds none, and a stale proposal is refused with its code', async () => {
  const s = server(() => manifest([{ id: 'd1', title: 'A', version: 1 }]));
  s.texts.set('d1', ['# v1', '# v2']);
  const { dir, client } = await signedIn(s.request as unknown as typeof fetch);
  try {
    const signal = new AbortController().signal;
    const input = { baseVersion: 1, text: '# mine', note: 'n', computer: 'c', sessionId: 's' };
    const refused = await client.proposeKnowledge('t1', 'd1', input, signal).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(KnowledgeError);
    expect((refused as KnowledgeError).code).toBe('knowledge_stale');
    expect(await client.readKnowledge('t1', 'd1', undefined, signal)).toEqual({ id: 'd1', title: 'T', version: 2, text: '# v2' });
    expect(await client.proposeKnowledge('t1', 'd1', { ...input, baseVersion: 2 }, signal)).toMatchObject({ id: 'p1', state: 'pending' });
    s.request.mockImplementationOnce(async () => new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }));
    expect(await client.knowledgeManifest()).toEqual({ teams: [] });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the tool proposes to the synced document\'s team without front matter, and answers a stale base with the current text', async () => {
  const s = server(() => manifest([{ id: 'd1', title: 'A', version: 1 }]));
  s.texts.set('d1', ['# v1']);
  const { dir, client } = await signedIn(s.request as unknown as typeof fetch);
  try {
    const knowledge = new KnowledgeSync(client);
    await knowledge.restore();
    await knowledge.sync();
    let tool: any;
    registerKnowledgeTool({ effect: (f: () => unknown) => f(), tools: { register: (t: unknown) => { tool = t; return () => {}; } } } as never, { client, knowledge });
    expect(tool.name).toBe('teamwork_knowledge');
    const exec = { agent: { session: { header: { id: 'session-1', cwd: dir } } }, signal: new AbortController().signal };
    const copy = await readFile(join(dir, 'teamwork-knowledge', 'Core', 'Handbook', 'A.md'), 'utf8');
    const sent = await tool.execute({ action: 'propose', documentId: 'd1', baseVersion: 1, note: 'Add a step', content: copy.replace('# v1', '# v1\n\nA step') }, exec);
    expect(sent).toEqual({ teamId: 't1', documentId: 'd1', title: 'T', proposalId: 'p1', baseVersion: 1 });
    expect(s.proposals).toEqual([expect.objectContaining({ baseVersion: 1, text: '# v1\n\nA step', note: 'Add a step', sessionId: 'session-1' })]);
    expect(tool.output.presentationMeta({}, sent)).toEqual({ teamworkKnowledgeProposal: sent });
    expect(tool.output.render({}, sent)[0].text).toMatch(/an editor of its space reviews the difference/);

    // Someone else's change was accepted meanwhile: the answer is the current version and its text.
    s.texts.set('d1', ['# v1', '# v2']);
    const stale = await tool.execute({ action: 'propose', documentId: 'd1', baseVersion: 1, note: 'Again', content: '# mine' }, exec);
    expect(stale).toEqual({ teamId: 't1', documentId: 'd1', title: 'T', stale: true, version: 2, text: '# v2' });
    expect(tool.output.presentationMeta({}, stale)).toBeNull();
    expect(tool.output.render({}, stale)[0].text).toMatch(/at version 2 now[\s\S]*baseVersion 2\.\n\n# v2$/);
    await expect(tool.execute({ action: 'propose', documentId: 'nope', baseVersion: 1, note: 'x', content: '#' }, exec)).rejects.toThrow(/not in this member's synced knowledge/);
    await expect(tool.execute({ action: 'write', documentId: 'd1', baseVersion: 1, note: 'x', content: '#' }, exec)).rejects.toThrow();
  } finally { await rm(dir, { recursive: true, force: true }); }
});
