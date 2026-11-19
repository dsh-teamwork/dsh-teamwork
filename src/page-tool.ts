/**
 * `teamwork_page`: the agent publishes a page it made (a report, a deck, a dashboard) to its team's server, private to
 * the member whose session made it (docs/tech/pages.md in the platform repository). The tool never shares: only a
 * person does, in the console or the app, so nothing an agent reads can get a page shared. Its result carries no
 * content; clients find the page through `presentationMeta`, which DSH keeps in the session beside the model's text.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { hostname } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { PageError, type Snapshot, type TeamworkClient } from './client.js';
import type { PresetContext } from './preset-context.js';

/** The server's limits, checked here only so a page too large is not read and sent at all. */
export const LIMITS = { files: 255, fileBytes: 5 << 20, versionBytes: 16 << 20 };

const kinds = ['html', 'markdown', 'svg'] as const;
type Kind = (typeof kinds)[number];
const entries: Record<Kind, string> = { html: 'index.html', markdown: 'index.md', svg: 'index.svg' };

const input = z
  .object({
    action: z.enum(['create', 'update']),
    pageId: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/).optional(),
    baseVersion: z.number().int().positive().optional(),
    teamId: z.string().min(1).optional(),
    title: z.string().trim().max(120).optional(),
    kind: z.enum(kinds),
    note: z.string().trim().max(200).default(''),
    content: z.string().optional(),
    directory: z.string().min(1).optional(),
  })
  .strict()
  .refine((v) => (v.content === undefined) !== (v.directory === undefined), 'Give either content or directory')
  .refine((v) => v.action === 'create' ? !!v.title && !v.pageId : !!v.pageId && v.baseVersion !== undefined, 'create needs a title; update needs pageId and baseVersion');
export type PageInput = z.infer<typeof input>;

/**
 * The team a page goes to: the session's team preset's, else the member's only team, else the one the agent names
 * among the member's teams. A name outside them, or none where there is a choice, is refused with the choices.
 */
export function pageTeam(snapshot: Snapshot | undefined, presetTeam: string | undefined, requested: string | undefined) {
  const teams = snapshot?.teams ?? [];
  const names = () => teams.map((t) => `${t.teamName} (${t.teamId})`).join(', ');
  if (requested) {
    if (!teams.some((t) => t.teamId === requested)) throw new Error(`teamId must be one of your teams: ${names()}`);
    if (presetTeam && presetTeam !== requested) throw new Error(`This session's preset belongs to team ${presetTeam}`);
    return requested;
  }
  if (presetTeam) return presetTeam;
  if (teams.length === 1) return teams[0].teamId;
  if (!teams.length) throw new Error('Sign in to Teamwork and join a team first');
  throw new Error(`Name the team with teamId: ${names()}`);
}

/**
 * The files a page holds: `content` as the kind's one entry file, or every file under `directory`, which must resolve
 * inside the session's folder after following links. Hidden files and anything past the limits are refused before
 * a byte is sent, naming the rule.
 */
export async function pageFiles(cwd: string, kind: Kind, content: string | undefined, directory: string | undefined) {
  if (content !== undefined) {
    const bytes = new TextEncoder().encode(content);
    if (bytes.length > LIMITS.fileBytes) throw new Error('A page file is at most 5 MiB');
    return [{ path: entries[kind], bytes }];
  }
  const root = await realpath(cwd);
  const dir = await realpath(isAbsolute(directory!) ? directory! : resolve(cwd, directory!)).catch(() => {
    throw new Error(`No folder ${directory} in this session's workspace`);
  });
  if (dir !== root && !dir.startsWith(root + sep)) throw new Error('The page folder must be inside this session\'s workspace');
  const files: { path: string; bytes: Uint8Array }[] = [];
  let total = 0;
  const walk = async (at: string): Promise<void> => {
    for (const entry of (await readdir(at, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = resolve(at, entry.name);
      const path = relative(dir, full).split(sep).join('/');
      if (entry.name.startsWith('.')) throw new Error(`Hidden files are not published: ${path}`);
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) throw new Error(`Links are not published: ${path}`);
      if (stat.isDirectory()) { await walk(full); continue; }
      if (!stat.isFile()) continue;
      if (files.length === LIMITS.files) throw new Error(`A page holds at most ${LIMITS.files} files`);
      if (stat.size > LIMITS.fileBytes) throw new Error(`A page file is at most 5 MiB: ${path}`);
      if ((total += stat.size) > LIMITS.versionBytes) throw new Error('A page is at most 16 MiB');
      files.push({ path, bytes: await readFile(full) });
    }
  };
  await walk(dir);
  if (!files.some((f) => f.path === entries[kind])) throw new Error(`A ${kind} page needs ${entries[kind]} at the top of the folder`);
  return files;
}

export interface PageToolOptions {
  client: TeamworkClient;
  preset: (agent: Agent) => PresetContext | undefined;
  /**
   * On a Team DSH, the member a session belongs to (its roster); `undefined`, returned at once, on a computer that
   * is no Team DSH, where the signed-in member is the author.
   */
  starterOf?: (sessionId: string) => Promise<string | undefined> | undefined;
  /** The name this DSH goes by, recorded with each version. */
  computer?: () => string;
}

export function registerPageTool(ctx: Context, options: PageToolOptions) {
  const { client, preset, starterOf, computer = () => hostname() } = options;
  ctx.effect(() =>
    ctx.tools.register({
      name: 'teamwork_page',
      description:
        'Publish a page you made for the member (a report, a deck, a dashboard, a diagram) to their Teamwork team, where they can open it on any device. ' +
        'kind html: an index.html and the files it loads (relative paths; scripts and styles may also come from cdnjs, jsdelivr or unpkg); markdown: one index.md; svg: one index.svg. ' +
        'Give content for a single file, or directory for a folder in this workspace. create makes a new page, private to the member; update adds a version on top of baseVersion. ' +
        'You cannot share a page: the member shares it themselves.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update'] },
          pageId: { type: 'string', description: 'update: the page' },
          baseVersion: { type: 'integer', minimum: 1, description: 'update: the version your change starts from' },
          teamId: { type: 'string', description: "Only when asked to choose: one of the member's teams" },
          title: { type: 'string', maxLength: 120 },
          kind: { type: 'string', enum: [...kinds] },
          note: { type: 'string', maxLength: 200, description: 'One line on what this version is' },
          content: { type: 'string', description: "The entry file's text" },
          directory: { type: 'string', description: 'A folder in this workspace holding the entry file and its files' },
        },
        required: ['action', 'kind'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            teamId: { type: 'string' }, pageId: { type: 'string' }, version: { type: 'integer' }, title: { type: 'string' }, kind: { type: 'string' },
          },
          required: ['teamId', 'pageId', 'version', 'title', 'kind'],
          additionalProperties: false,
        },
        render: (_args, value) => {
          const v = value as { pageId: string; version: number; title: string };
          return [{ type: 'text', text: `Published "${v.title}" as page ${v.pageId}, version ${v.version}. It is private to the member until they share it from Pages in Teamwork.` }];
        },
        presentationMeta: (_args, value) => ({ teamworkPage: value }),
      },
      async execute(raw, exec) {
        const args = input.parse(raw);
        const agent = exec.agent;
        const sessionId = agent ? String(agent.session.header.id) : '';
        const cwd = agent?.session.header.cwd;
        if (!cwd && args.directory) throw new Error("This session has no workspace to publish a folder from");
        const teamId = pageTeam(client.current(), agent ? preset(agent)?.teamId : undefined, args.teamId);
        const pending = starterOf?.(sessionId);
        const starter = pending ? await pending : undefined;
        if (pending && !starter) throw new Error('This session has no member to publish for');
        const files = await pageFiles(cwd ?? '', args.kind, args.content, args.directory);
        try {
          const page = await client.publishPage(teamId, {
            pageId: args.pageId, title: args.title, kind: args.kind, note: args.note, sessionId, computer: computer(),
            baseVersion: args.action === 'update' ? args.baseVersion : undefined, starter,
          }, files, exec.signal);
          return { teamId, pageId: page.id, version: page.version, title: page.title, kind: page.kind };
        } catch (error) {
          if (error instanceof PageError && error.code === 'page_stale')
            throw new Error(`Version ${args.baseVersion} is no longer the newest: someone added a version since. Ask the member before replacing their change.`);
          throw error;
        }
      },
    }),
  );
}
