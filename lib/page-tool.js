import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { PageError } from './client.js';
/** The server's limits, checked here only so a page too large is not read and sent at all. */
export const LIMITS = { files: 255, fileBytes: 5 << 20, versionBytes: 16 << 20 };
const kinds = ['html', 'markdown', 'svg'];
const entries = { html: 'index.html', markdown: 'index.md', svg: 'index.svg' };
const input = z
    .object({
    action: z.enum(['create', 'update', 'open']),
    pageId: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/).optional(),
    baseVersion: z.number().int().positive().optional(),
    version: z.number().int().positive().optional(),
    teamId: z.string().min(1).optional(),
    title: z.string().trim().max(120).optional(),
    kind: z.enum(kinds).optional(),
    note: z.string().trim().max(200).default(''),
    content: z.string().optional(),
    directory: z.string().min(1).optional(),
})
    .strict()
    .refine((v) => v.action === 'open' ? !!v.pageId && !!v.version && !!v.directory && v.content === undefined : !!v.kind && (v.content === undefined) !== (v.directory === undefined), 'create and update take a kind and either content or directory; open takes pageId, version and directory')
    .refine((v) => v.action !== 'create' || (!!v.title && !v.pageId), 'create needs a title')
    .refine((v) => v.action !== 'update' || (!!v.pageId && v.baseVersion !== undefined), 'update needs pageId and baseVersion');
/**
 * The team a page goes to: the session's team preset's, else the member's only team, else the one the agent names
 * among the member's teams. A name outside them, or none where there is a choice, is refused with the choices.
 */
export function pageTeam(snapshot, presetTeam, requested) {
    const teams = snapshot?.teams ?? [];
    const names = () => teams.map((t) => `${t.teamName} (${t.teamId})`).join(', ');
    if (requested) {
        if (!teams.some((t) => t.teamId === requested))
            throw new Error(`teamId must be one of your teams: ${names()}`);
        if (presetTeam && presetTeam !== requested)
            throw new Error(`This session's preset belongs to team ${presetTeam}`);
        return requested;
    }
    if (presetTeam)
        return presetTeam;
    if (teams.length === 1)
        return teams[0].teamId;
    if (!teams.length)
        throw new Error('Sign in to Teamwork and join a team first');
    throw new Error(`Name the team with teamId: ${names()}`);
}
/** Where a member opens a page in the console: the team's Pages, the page selected. Only who may read it can. */
export function pageUrl(server, teamId, pageId) {
    return `${server}/teams/${encodeURIComponent(teamId)}/pages/${encodeURIComponent(pageId)}`;
}
/**
 * The files a page holds: `content` as the kind's one entry file, or every file under `directory`, which must resolve
 * inside the session's folder after following links. Hidden files and anything past the limits are refused before
 * a byte is sent, naming the rule.
 */
export async function pageFiles(cwd, kind, content, directory) {
    if (content !== undefined) {
        const bytes = new TextEncoder().encode(content);
        if (bytes.length > LIMITS.fileBytes)
            throw new Error('A page file is at most 5 MiB');
        return [{ path: entries[kind], bytes }];
    }
    const root = await realpath(cwd);
    const dir = await realpath(isAbsolute(directory) ? directory : resolve(cwd, directory)).catch(() => {
        throw new Error(`No folder ${directory} in this session's workspace`);
    });
    if (dir !== root && !dir.startsWith(root + sep))
        throw new Error('The page folder must be inside this session\'s workspace');
    const files = [];
    let total = 0;
    const walk = async (at) => {
        for (const entry of (await readdir(at, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
            const full = resolve(at, entry.name);
            const path = relative(dir, full).split(sep).join('/');
            if (entry.name.startsWith('.'))
                throw new Error(`Hidden files are not published: ${path}`);
            const stat = await lstat(full);
            if (stat.isSymbolicLink())
                throw new Error(`Links are not published: ${path}`);
            if (stat.isDirectory()) {
                await walk(full);
                continue;
            }
            if (!stat.isFile())
                continue;
            if (files.length === LIMITS.files)
                throw new Error(`A page holds at most ${LIMITS.files} files`);
            if (stat.size > LIMITS.fileBytes)
                throw new Error(`A page file is at most 5 MiB: ${path}`);
            if ((total += stat.size) > LIMITS.versionBytes)
                throw new Error('A page is at most 16 MiB');
            files.push({ path, bytes: await readFile(full) });
        }
    };
    await walk(dir);
    if (!files.some((f) => f.path === entries[kind]))
        throw new Error(`A ${kind} page needs ${entries[kind]} at the top of the folder`);
    return files;
}
/**
 * Writes a page's files into `directory`, a folder inside the session's workspace that is new or empty, so an agent
 * can change a page it did not make and publish the change with `update`.
 */
export async function writePage(cwd, directory, files) {
    const root = await realpath(cwd);
    const target = isAbsolute(directory) ? directory : resolve(cwd, directory);
    const parent = await realpath(dirname(target)).catch(() => {
        throw new Error(`No folder ${dirname(directory)} in this session's workspace`);
    });
    if (parent !== root && !parent.startsWith(root + sep))
        throw new Error("The page folder must be inside this session's workspace");
    const dir = resolve(parent, target.split(sep).pop());
    const existing = await readdir(dir).catch(() => null);
    if (existing && existing.length)
        throw new Error(`${directory} is not empty; open the page into a new folder`);
    for (const file of files) {
        const path = resolve(dir, ...file.path.split('/'));
        if (!path.startsWith(dir + sep))
            throw new Error(`Refused a file outside the page: ${file.path}`);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, file.bytes);
    }
    return files.map((f) => f.path);
}
export function registerPageTool(ctx, options) {
    const { client, preset } = options;
    ctx.effect(() => ctx.tools.register({
        name: 'teamwork_page',
        description: 'Publish a page you made for the member (a report, a deck, a dashboard, a diagram) to their Teamwork team, where they can open it on any device. ' +
            'kind html: an index.html and the files it loads (relative paths; scripts and styles may also come from cdnjs, jsdelivr or unpkg); markdown: one index.md; svg: one index.svg. ' +
            'Give content for a single file, or directory for a folder in this workspace. create makes a new page, private to the member; update adds a version on top of baseVersion; ' +
            'open writes a version of a page the member may read into a new folder of this workspace, to change it and update it. ' +
            'You cannot share a page: the member shares it themselves.',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['create', 'update', 'open'] },
                pageId: { type: 'string', description: 'update and open: the page' },
                version: { type: 'integer', minimum: 1, description: 'open: the version to open' },
                baseVersion: { type: 'integer', minimum: 1, description: 'update: the version your change starts from' },
                teamId: { type: 'string', description: "Only when asked to choose: one of the member's teams" },
                title: { type: 'string', maxLength: 120 },
                kind: { type: 'string', enum: [...kinds] },
                note: { type: 'string', maxLength: 200, description: 'One line on what this version is' },
                content: { type: 'string', description: "The entry file's text" },
                directory: { type: 'string', description: 'create and update: a folder in this workspace holding the entry file and its files; open: a new folder to write the page into' },
            },
            required: ['action'],
            additionalProperties: false,
        },
        output: {
            schema: {
                type: 'object',
                properties: {
                    teamId: { type: 'string' }, pageId: { type: 'string' }, version: { type: 'integer' }, title: { type: 'string' }, kind: { type: 'string' }, url: { type: 'string' },
                    directory: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
                },
                required: ['teamId', 'pageId', 'version'],
                additionalProperties: false,
            },
            render: (_args, value) => {
                const v = value;
                const text = v.files
                    ? `Opened page ${v.pageId}, version ${v.version}, into ${v.directory}: ${v.files.join(', ')}. Change it there, then publish with action update, pageId ${v.pageId} and baseVersion ${v.version}.`
                    : `Published "${v.title}" as page ${v.pageId}, version ${v.version}, at ${v.url} — give the member this link to open it. It is private to them until they share it there.`;
                return [{ type: 'text', text }];
            },
            // Only a published page is a card in the conversation; an opened one is the agent's working copy.
            presentationMeta: (_args, value) => (value.files ? null : { teamworkPage: value }),
        },
        async execute(raw, exec) {
            const args = input.parse(raw);
            const agent = exec.agent;
            const sessionId = agent ? String(agent.session.header.id) : '';
            const cwd = agent?.session.header.cwd;
            if (!cwd && args.directory)
                throw new Error("This session has no workspace to publish a folder from");
            const teamId = pageTeam(client.current(), agent ? preset(agent)?.teamId : undefined, args.teamId);
            if (args.action === 'open') {
                if (!cwd)
                    throw new Error('This session has no workspace to open a page into');
                const opened = await client.readPage(teamId, args.pageId, args.version, exec.signal).catch((error) => {
                    if (error instanceof PageError && error.status === 404)
                        throw new Error(`Page ${args.pageId} version ${args.version} is not one this member may read`);
                    throw error;
                });
                return { teamId, pageId: args.pageId, version: args.version, directory: args.directory, files: await writePage(cwd, args.directory, opened) };
            }
            const files = await pageFiles(cwd ?? '', args.kind, args.content, args.directory);
            try {
                const page = await client.publishPage(teamId, {
                    pageId: args.pageId, title: args.title, kind: args.kind, note: args.note, sessionId, computer: hostname(),
                    baseVersion: args.action === 'update' ? args.baseVersion : undefined,
                }, files, exec.signal);
                return { teamId, pageId: page.id, version: page.version, title: page.title, kind: page.kind, url: pageUrl(client.endpoint, teamId, page.id) };
            }
            catch (error) {
                if (error instanceof PageError && error.code === 'page_stale')
                    throw new Error(`Version ${args.baseVersion} is no longer the newest: someone added a version since. Ask the member before replacing their change.`);
                throw error;
            }
        },
    }));
}
//# sourceMappingURL=page-tool.js.map