import { readFile, realpath, stat } from 'node:fs/promises';
import { hostname } from 'node:os';
import { basename, isAbsolute, resolve, sep } from 'node:path';
import { z } from 'zod';
import { KnowledgeError, MAX_ATTACHMENT } from './client.js';
import { stripFrontMatter } from './knowledge-sync.js';
/** The server's limit on a document's text, checked here so a text too large is not read or sent at all. */
export const MAX_TEXT = 1 << 20;
const input = z
    .object({
    action: z.literal('propose'),
    documentId: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
    baseVersion: z.number().int().positive(),
    note: z.string().trim().min(1).max(200),
    content: z.string().optional(),
    path: z.string().min(1).optional(),
    attachments: z.array(z.string().min(1)).max(20).optional(),
})
    .strict()
    .refine((v) => (v.content === undefined) !== (v.path === undefined), 'propose takes either content or path');
/** The file at `path`, which must resolve inside the session's folder `cwd` after following links: its real path and size. */
async function workspaceFile(cwd, path) {
    if (!cwd)
        throw new Error('This session has no workspace to read a file from; give the text as content');
    const root = await realpath(cwd);
    const file = await realpath(isAbsolute(path) ? path : resolve(cwd, path)).catch(() => {
        throw new Error(`No file ${path} in this session's workspace`);
    });
    if (file !== root && !file.startsWith(root + sep))
        throw new Error("The file must be inside this session's workspace; copy a synced document there to change it");
    const info = await stat(file);
    if (!info.isFile())
        throw new Error(`${path} is not a file`);
    return { file, size: info.size };
}
/**
 * The files a proposal attaches: each inside the session's folder, as `path` is, at most 20 MiB, and named by its base
 * name, which must differ from every other one's.
 */
export async function proposalAttachments(cwd, paths) {
    const out = [];
    for (const path of paths) {
        const { file, size } = await workspaceFile(cwd, path);
        if (size > MAX_ATTACHMENT)
            throw new Error(`${path} is larger than 20 MiB, the most an attachment may be`);
        const name = basename(path);
        if (out.some(other => other.name === name))
            throw new Error(`Two attachments are named ${name}; an attachment is named by its file's name, so rename one`);
        out.push({ name, bytes: await readFile(file) });
    }
    return out;
}
/**
 * The text a proposal sends: `content`, or the file at `path`, which must resolve inside the session's folder after
 * following links. The copy's `knowledge:` front matter line is removed; one naming another document, or a version
 * other than `baseVersion`, is refused, since the change would then not be the one the agent meant.
 */
export async function proposalText(cwd, documentId, baseVersion, content, path) {
    let text = content;
    if (text === undefined) {
        const { file, size } = await workspaceFile(cwd, path);
        if (size > MAX_TEXT + 256)
            throw new Error('A document is at most 1 MiB');
        text = await readFile(file, 'utf8');
    }
    const stripped = stripFrontMatter(text);
    if (stripped.documentId !== undefined && stripped.documentId !== documentId)
        throw new Error(`This text is a copy of document ${stripped.documentId}, not ${documentId}`);
    if (stripped.version !== undefined && stripped.version !== baseVersion)
        throw new Error(`This text starts from version ${stripped.version}; give that as baseVersion, or the text of version ${baseVersion}`);
    if (Buffer.byteLength(stripped.text) > MAX_TEXT)
        throw new Error('A document is at most 1 MiB');
    return stripped.text;
}
export function registerKnowledgeTool(ctx, options) {
    const { client, knowledge } = options;
    ctx.effect(() => ctx.tools.register({
        name: 'teamwork_knowledge',
        description: "Propose a change to one of the team's knowledge documents (pages), which you read in the read-only synced copy. " +
            'Give its documentId and, as baseVersion, the version your change starts from: both are in the copy\'s front matter line knowledge: {documentId}@{version}. ' +
            'Give the complete new Markdown text as content, or as path, a file in this workspace holding it (a copy of the synced file with your change is fine; its knowledge: line is removed). ' +
            'To attach images or files, name each in the text as ![[name]] (an image, shown) or [[name]] (a file, linked) and pass the files as attachments; they are uploaded under their file names before the proposal. ' +
            'The proposal is not a new version: an editor of the document\'s space reviews the difference and accepts or declines it. You cannot write a version or change who may read a document.',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['propose'] },
                documentId: { type: 'string', description: 'The document, from its knowledge: line' },
                baseVersion: { type: 'integer', minimum: 1, description: 'The version your change starts from, from its knowledge: line' },
                note: { type: 'string', maxLength: 200, description: 'One line for the editor: what changed and why' },
                content: { type: 'string', description: 'The complete new Markdown text' },
                path: { type: 'string', description: 'A file in this workspace holding the complete new Markdown text' },
                attachments: { type: 'array', items: { type: 'string' }, maxItems: 20, description: 'Files in this workspace to attach, each at most 20 MiB, named in the text by its file name as ![[name]] or [[name]]' },
            },
            required: ['action', 'documentId', 'baseVersion', 'note'],
            additionalProperties: false,
        },
        output: {
            schema: {
                type: 'object',
                properties: {
                    teamId: { type: 'string' }, documentId: { type: 'string' }, title: { type: 'string' }, proposalId: { type: 'string' },
                    baseVersion: { type: 'integer' }, stale: { type: 'boolean' }, version: { type: 'integer' }, text: { type: 'string' },
                    attachments: { type: 'array', items: { type: 'string' } },
                },
                required: ['teamId', 'documentId'],
                additionalProperties: false,
            },
            render: (_args, value) => {
                const v = value;
                const attached = v.attachments?.length ? ` Attached ${v.attachments.join(', ')}.` : '';
                const text = v.stale
                    ? `Not proposed: document ${v.documentId} is at version ${v.version} now, not the version your change started from. Its current text follows. Reapply your change to it, then propose again with baseVersion ${v.version}.\n\n${v.text}`
                    : `Proposed a change to "${v.title}" (document ${v.documentId}, on version ${v.baseVersion}) as proposal ${v.proposalId}.${attached} It is not in the document yet: an editor of its space reviews the difference and accepts or declines it. Tell the member so.`;
                return [{ type: 'text', text }];
            },
            // Only a sent proposal is a card in the conversation; a stale answer is the agent's to act on.
            presentationMeta: (_args, value) => (value.stale ? null : { teamworkKnowledgeProposal: value }),
        },
        async execute(raw, exec) {
            const args = input.parse(raw);
            const agent = exec.agent;
            const synced = knowledge.find(args.documentId);
            if (!synced)
                throw new Error(`Document ${args.documentId} is not in this member's synced knowledge; check the id in its knowledge: line, or run /teamwork sync`);
            const text = await proposalText(agent?.session.header.cwd, args.documentId, args.baseVersion, args.content, args.path);
            const files = await proposalAttachments(agent?.session.header.cwd, args.attachments ?? []);
            try {
                for (const file of files) {
                    try {
                        await client.attachKnowledge(synced.teamId, args.documentId, file.name, file.bytes, exec.signal);
                    }
                    catch (error) {
                        if (!(error instanceof KnowledgeError))
                            throw error;
                        if (error.code === 'knowledge_name_taken')
                            throw new Error(`Not proposed: document ${args.documentId} already has a different file named ${file.name}, and a name keeps its file for the document's life. Give your file another name, refer to it by that name in the text, and propose again.`);
                        if (error.code === 'knowledge_team_full')
                            throw new Error('Not proposed: the team\'s knowledge attachments are at their 2 GiB limit; tell the member, since an administrator has to make room');
                        if (error.status === 400)
                            throw new Error(`Not proposed: ${file.name} cannot be attached${error.detail ? `: ${error.detail}` : ''}. An attachment is an image, PDF, text, CSV, JSON, Office or zip file whose name holds none of [ ] | # ^`);
                        throw error;
                    }
                }
                const proposal = await client.proposeKnowledge(synced.teamId, args.documentId, {
                    baseVersion: args.baseVersion, text, note: args.note, computer: hostname().slice(0, 64), sessionId: agent ? String(agent.session.header.id) : '',
                }, exec.signal);
                return { teamId: synced.teamId, documentId: args.documentId, title: proposal.documentTitle, proposalId: proposal.id, baseVersion: proposal.baseVersion, ...(files.length ? { attachments: files.map(file => file.name) } : {}) };
            }
            catch (error) {
                if (!(error instanceof KnowledgeError))
                    throw error;
                if (error.code === 'knowledge_stale') {
                    const current = await client.readKnowledge(synced.teamId, args.documentId, undefined, exec.signal);
                    return { teamId: synced.teamId, documentId: args.documentId, title: current.title, stale: true, version: current.version, text: current.text };
                }
                if (error.code === 'knowledge_not_found')
                    throw new Error(`Document ${args.documentId} is not one this member may read any more`);
                if (error.code === 'knowledge_too_large')
                    throw new Error('A document is at most 1 MiB, and an attachment 20 MiB');
                throw error;
            }
        },
    }));
}
//# sourceMappingURL=knowledge-tool.js.map