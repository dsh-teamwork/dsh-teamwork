import { test, expect, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, stat, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { attachmentDigest, KnowledgeError, TeamworkClient, type KnowledgeManifest } from '../src/client.js';
import { KnowledgeSync, attachmentSegment, knowledgeLayout, knowledgePlan, segment, stripFrontMatter, withFrontMatter } from '../src/knowledge-sync.js';
import { proposalAttachments, proposalText, registerKnowledgeTool } from '../src/knowledge-tool.js';

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

type Listed = { name: string; size: number; digest: string };
const manifest = (documents: { id: string; folders?: string[]; title: string; version: number; attachments?: Listed[] }[], extra: KnowledgeManifest['teams'] = []): KnowledgeManifest => ({
  teams: [{ teamId: 't1', teamName: 'Core', spaces: [{ id: 's1', name: 'Handbook', documents: documents.map(d => ({ folders: [], attachments: [], ...d })) }] }, ...extra],
});
/** An attachment as the manifest lists it, for these bytes. */
const listed = (name: string, bytes: string): Listed => ({ name, size: Buffer.byteLength(bytes), digest: attachmentDigest(Buffer.from(bytes)) });

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
  expect(layout.get('d2')).toEqual({ teamId: 't1', version: 3, path: 'Core/Handbook/Ops/On call/Runbook.md', attachments: {} });
});

test('attachments go in {title}.files beside their document, keeping the extension and telling apart names that collide', () => {
  expect(attachmentSegment('diagram.png')).toEqual({ stem: 'diagram', extension: '.png' });
  expect(attachmentSegment('a:b.PDF')).toEqual({ stem: 'a_b', extension: '.PDF' });
  expect(attachmentSegment('con.png')).toEqual({ stem: '_con', extension: '.png' });
  expect(attachmentSegment('.png')).toEqual({ stem: '_', extension: '.png' });
  const long = attachmentSegment(`${'图'.repeat(120)}.png`);
  expect(long.extension).toBe('.png');
  expect(Buffer.byteLength(long.stem)).toBeLessThanOrEqual(160);

  const a = listed('Chart.png', 'one'), b = listed('chart.png', 'two'), c = listed('CHART.png', 'one'), d = listed('cHART.png', 'one'), huge = { name: 'big.zip', size: (20 << 20) + 1, digest: 'x' };
  const layout = knowledgeLayout(manifest([
    { id: 'd1', folders: ['Ops'], title: 'Runbook', version: 1, attachments: [a, b, c, d, huge] },
    { id: 'd2', title: 'glossary', version: 1, attachments: [listed('spec.pdf', 'p')] },
    { id: 'd3', title: 'Glossary', version: 1, attachments: [listed('spec.pdf', 'q')] },
    { id: 'd4', folders: ['Runbook.files'], title: 'x', version: 1 },
  ]));
  expect(layout.get('d1')!.attachments).toEqual({
    'Chart.png': { digest: a.digest, path: 'Core/Handbook/Ops/Runbook.files/Chart.png' },
    'chart.png': { digest: b.digest, path: `Core/Handbook/Ops/Runbook.files/chart (${b.digest.slice(0, 8)}).png` },
    'CHART.png': { digest: c.digest, path: `Core/Handbook/Ops/Runbook.files/CHART (${c.digest.slice(0, 8)}).png` },
    // The same bytes again under a name that collides: its digest's suffix is taken too, so it is counted on.
    'cHART.png': { digest: d.digest, path: `Core/Handbook/Ops/Runbook.files/cHART (${d.digest.slice(0, 8)} 2).png` },
  });
  expect(layout.get('d2')!.attachments['spec.pdf']!.path).toBe('Core/Handbook/glossary.files/spec.pdf');
  expect(layout.get('d3')!.path).toBe('Core/Handbook/Glossary (d3).md');
  expect(layout.get('d3')!.attachments['spec.pdf']!.path).toBe('Core/Handbook/Glossary (d3).files/spec.pdf');
  // A folder never ends in .files, so it is never taken for a document's attachments.
  expect(layout.get('d4')!.path).toBe('Core/Handbook/Runbook.files_/x.md');
});

test('the plan keeps what is current, moves what was renamed and fetches only what changed or is new', () => {
  const attachments = {};
  const state = {
    same: { teamId: 't', version: 2, path: 'a.md', attachments },
    renamed: { teamId: 't', version: 1, path: 'old.md', attachments },
    newer: { teamId: 't', version: 1, path: 'n.md', attachments },
    missing: { teamId: 't', version: 1, path: 'gone.md', attachments },
    removed: { teamId: 't', version: 1, path: 'r.md', attachments },
  };
  const wanted = new Map(Object.entries({
    same: { teamId: 't', version: 2, path: 'a.md', attachments },
    renamed: { teamId: 't', version: 1, path: 'new.md', attachments },
    newer: { teamId: 't', version: 2, path: 'n.md', attachments },
    missing: { teamId: 't', version: 1, path: 'gone.md', attachments },
    fresh: { teamId: 't', version: 1, path: 'f.md', attachments },
  }));
  const plan = knowledgePlan(state, wanted, new Set(['a.md', 'old.md', 'n.md', 'r.md']));
  expect(plan.keep.map(([id]) => id)).toEqual(['same']);
  expect(plan.move).toEqual([{ id: 'renamed', from: 'old.md', to: wanted.get('renamed') }]);
  expect(plan.fetch.map(([id]) => id)).toEqual(['newer', 'missing', 'fresh']);
});

test('the plan fetches an attachment that is new or changed its digest, moves one whose document moved, and keeps the rest', () => {
  const file = (digest: string, path: string) => ({ digest, path });
  const state = {
    d1: { teamId: 't', version: 1, path: 'A.md', attachments: { 'same.png': file('s', 'A.files/same.png'), 'changed.png': file('c1', 'A.files/changed.png'), 'gone.png': file('g', 'A.files/gone.png'), 'lost.png': file('l', 'A.files/lost.png') } },
    d2: { teamId: 't', version: 1, path: 'B.md', attachments: { 'x.pdf': file('x', 'B.files/x.pdf') } },
  };
  const wanted = new Map(Object.entries({
    d1: { teamId: 't', version: 2, path: 'A.md', attachments: { 'same.png': file('s', 'A.files/same.png'), 'changed.png': file('c2', 'A.files/changed.png'), 'lost.png': file('l', 'A.files/lost.png'), 'new.png': file('n', 'A.files/new.png') } },
    // d2 was renamed: its text and its attachment move, though neither changed.
    d2: { teamId: 't', version: 1, path: 'Ops/C.md', attachments: { 'x.pdf': file('x', 'Ops/C.files/x.pdf') } },
  }));
  const plan = knowledgePlan(state, wanted, new Set(['A.md', 'A.files/same.png', 'A.files/changed.png', 'A.files/gone.png', 'B.md', 'B.files/x.pdf']));
  expect(plan.fetch.map(([id]) => id)).toEqual(['d1']);
  expect(plan.move.map(({ id, from, to }) => [id, from, to.path])).toEqual([['d2', 'B.md', 'Ops/C.md']]);
  expect(plan.files.keep.map(item => item.name)).toEqual(['same.png']);
  expect(plan.files.fetch.map(item => [item.id, item.name, item.file.digest])).toEqual([['d1', 'changed.png', 'c2'], ['d1', 'lost.png', 'l'], ['d1', 'new.png', 'n']]);
  expect(plan.files.move.map(({ item, from }) => [item.name, from, item.file.path])).toEqual([['x.pdf', 'B.files/x.pdf', 'Ops/C.files/x.pdf']]);
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
  /** Each document's attachments, by `{documentId}/{name}`, as the server holds them. */
  const files = new Map<string, string>();
  const fetched: string[] = [];
  const proposals: unknown[] = [];
  const request = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const { pathname, searchParams } = new URL(String(url));
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (pathname === '/api/knowledge') return json(200, teams());
    const attachment = /^\/api\/teams\/[^/]+\/knowledge\/documents\/([^/]+)\/attachments(?:\/([^/]+))?$/.exec(pathname);
    if (attachment) {
      if (init?.method === 'POST') {
        const file = (init.body as FormData).get('file') as File;
        const key = `${attachment[1]}/${file.name}`, bytes = await file.text();
        if (files.has(key) && files.get(key) !== bytes) return json(409, { error: 'knowledge_name_taken' });
        const created = !files.has(key);
        files.set(key, bytes);
        return json(created ? 201 : 200, { name: file.name, contentType: 'image/png', size: Buffer.byteLength(bytes) });
      }
      const key = `${attachment[1]}/${decodeURIComponent(attachment[2]!)}`;
      if (!files.has(key)) return json(404, { error: 'knowledge_not_found' });
      fetched.push(key);
      return new Response(files.get(key));
    }
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
  return { texts, files, fetched, proposals, request };
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
    expect(knowledge.find('d2')).toEqual({ teamId: 't1', version: 1, path: 'Core/Handbook/Ops/Runbook.md', attachments: {} });

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
    await expect(knowledge.sync()).rejects.toThrow(/^Teamwork knowledge sync failed: 1 of 1 changed documents and attachments could not be fetched/);
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

test('a sync keeps attachments read-only beside their document, fetching new and changed digests, moving and deleting them', async () => {
  let documents: Parameters<typeof manifest>[0] = [];
  const s = server(() => manifest(documents));
  s.texts.set('d1', ['# Runbook ![[chart.png]] [[spec.pdf]]']);
  s.files.set('d1/chart.png', 'png-1').set('d1/spec.pdf', 'pdf-1').set('d1/a b#.png', 'odd');
  documents = [{ id: 'd1', folders: ['Ops'], title: 'Runbook', version: 1, attachments: [listed('chart.png', 'png-1'), listed('spec.pdf', 'pdf-1'), listed('a b#.png', 'odd')] }];
  const { dir, client } = await signedIn(s.request as unknown as typeof fetch);
  try {
    const knowledge = new KnowledgeSync(client);
    await knowledge.restore();
    await knowledge.sync();
    const root = join(dir, 'teamwork-knowledge');
    const files = join(root, 'Core', 'Handbook', 'Ops', 'Runbook.files');
    expect(await readFile(join(files, 'chart.png'), 'utf8')).toBe('png-1');
    expect(await readFile(join(files, 'a b#.png'), 'utf8')).toBe('odd');
    expect((await stat(join(files, 'spec.pdf'))).mode & 0o777).toBe(0o444);
    expect(s.fetched.sort()).toEqual(['d1/a b#.png', 'd1/chart.png', 'd1/spec.pdf', 'd1@1']);
    expect(knowledge.find('d1')!.attachments['chart.png']).toEqual({ digest: listed('chart.png', 'png-1').digest, path: 'Core/Handbook/Ops/Runbook.files/chart.png' });

    // Unchanged: nothing is fetched, and the prune keeps the .files folder and what it holds.
    s.fetched.length = 0;
    await knowledge.sync();
    expect(s.fetched).toEqual([]);
    expect((await readdir(files)).sort()).toEqual(['a b#.png', 'chart.png', 'spec.pdf']);

    // chart.png's bytes changed, spec.pdf is gone, diagram.svg is new, and the document moved with its text unchanged.
    s.files.set('d1/chart.png', 'png-2').set('d1/diagram.svg', '<svg/>');
    documents = [{ id: 'd1', folders: ['Night'], title: 'On call', version: 1, attachments: [listed('chart.png', 'png-2'), listed('a b#.png', 'odd'), listed('diagram.svg', '<svg/>')] }];
    await knowledge.sync();
    expect(s.fetched.sort()).toEqual(['d1/chart.png', 'd1/diagram.svg']);
    const moved = join(root, 'Core', 'Handbook', 'Night', 'On call.files');
    expect((await readdir(moved)).sort()).toEqual(['a b#.png', 'chart.png', 'diagram.svg']);
    expect(await readFile(join(moved, 'chart.png'), 'utf8')).toBe('png-2');
    expect(await readFile(join(root, 'Core', 'Handbook', 'Night', 'On call.md'), 'utf8')).toBe('---\nknowledge: d1@1\n---\n# Runbook ![[chart.png]] [[spec.pdf]]');
    expect(await readdir(join(root, 'Core', 'Handbook'))).toEqual(['Night']);

    // The last attachment gone: so is the folder.
    documents = [{ id: 'd1', folders: ['Night'], title: 'On call', version: 1 }];
    await knowledge.sync();
    expect(await readdir(join(root, 'Core', 'Handbook', 'Night'))).toEqual(['On call.md']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('an attachment that cannot be fetched, or holds other bytes than listed, fails the sync but loses no text', async () => {
  const s = server(() => manifest([{ id: 'd1', title: 'A', version: 1, attachments: [listed('ok.png', 'ok'), listed('bad.png', 'expected'), listed('missing.pdf', 'x')] }]));
  s.texts.set('d1', ['# A']);
  s.files.set('d1/ok.png', 'ok').set('d1/bad.png', 'cut');
  const { dir, client } = await signedIn(s.request as unknown as typeof fetch);
  try {
    const knowledge = new KnowledgeSync(client);
    await knowledge.restore();
    await expect(knowledge.sync()).rejects.toThrow(/^Teamwork knowledge sync failed: 2 of 4 changed documents and attachments could not be fetched/);
    const root = join(dir, 'teamwork-knowledge', 'Core', 'Handbook');
    expect(await readFile(join(root, 'A.md'), 'utf8')).toBe('---\nknowledge: d1@1\n---\n# A');
    expect(await readdir(join(root, 'A.files'))).toEqual(['ok.png']);
    expect(Object.keys(knowledge.find('d1')!.attachments)).toEqual(['ok.png']);
    // Fixed on the server: the next sync fetches only what failed.
    s.files.set('d1/bad.png', 'expected').set('d1/missing.pdf', 'x');
    s.fetched.length = 0;
    await knowledge.sync();
    expect(s.fetched.sort()).toEqual(['d1/bad.png', 'd1/missing.pdf']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the tool uploads attachments under their file names before proposing, and stops on a name the document holds with other bytes', async () => {
  const s = server(() => manifest([{ id: 'd1', title: 'A', version: 1 }]));
  s.texts.set('d1', ['# v1']);
  const { dir, client } = await signedIn(s.request as unknown as typeof fetch);
  const outside = await mkdtemp(join(tmpdir(), 'knowledge-outside-'));
  try {
    const knowledge = new KnowledgeSync(client);
    await knowledge.restore();
    await knowledge.sync();
    let tool: any;
    registerKnowledgeTool({ effect: (f: () => unknown) => f(), tools: { register: (t: unknown) => { tool = t; return () => {}; } } } as never, { client, knowledge });
    const exec = { agent: { session: { header: { id: 'session-1', cwd: dir } } }, signal: new AbortController().signal };
    await mkdir(join(dir, 'out'));
    await writeFile(join(dir, 'out', 'chart.png'), 'png');
    await writeFile(join(dir, 'spec.pdf'), 'pdf');
    const sent = await tool.execute({ action: 'propose', documentId: 'd1', baseVersion: 1, note: 'Add a chart', content: '# v1\n\n![[chart.png]] [[spec.pdf]]', attachments: ['out/chart.png', join(dir, 'spec.pdf')] }, exec);
    expect(sent).toEqual({ teamId: 't1', documentId: 'd1', title: 'T', proposalId: 'p1', baseVersion: 1, attachments: ['chart.png', 'spec.pdf'] });
    expect([...s.files]).toEqual([['d1/chart.png', 'png'], ['d1/spec.pdf', 'pdf']]);
    // The text is sent as it was given: it is what names the attachments.
    expect(s.proposals).toEqual([expect.objectContaining({ text: '# v1\n\n![[chart.png]] [[spec.pdf]]' })]);
    expect(tool.output.render({}, sent)[0].text).toMatch(/Attached chart\.png, spec\.pdf\./);

    // The document holds chart.png with other bytes: nothing is proposed, and the agent is told to rename.
    await writeFile(join(dir, 'chart.png'), 'another png');
    s.proposals.length = 0;
    await expect(tool.execute({ action: 'propose', documentId: 'd1', baseVersion: 1, note: 'x', content: '![[chart.png]]', attachments: ['chart.png'] }, exec))
      .rejects.toThrow(/already has a different file named chart\.png[\s\S]*another name, refer to it by that name in the text/);
    expect(s.proposals).toEqual([]);

    // Files outside the workspace, too large, or two with one name are refused before anything is sent.
    await writeFile(join(outside, 'x.png'), 'x');
    await expect(proposalAttachments(dir, [join(outside, 'x.png')])).rejects.toThrow(/inside this session's workspace/);
    await expect(proposalAttachments(dir, ['chart.png', 'out/chart.png'])).rejects.toThrow(/Two attachments are named chart\.png/);
    await writeFile(join(dir, 'big.zip'), Buffer.alloc((20 << 20) + 1));
    await expect(proposalAttachments(dir, ['big.zip'])).rejects.toThrow(/larger than 20 MiB/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
