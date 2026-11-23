/**
 * `teamwork_page`: the agent publishes a page it made (a report, a deck, a dashboard) to its team's server, private to
 * the member whose session made it (docs/tech/pages.md in the platform repository). The tool never shares: only a
 * person does, in the console or the app, so nothing an agent reads can get a page shared. Its result carries no
 * content, only the console link the agent gives the member; clients find the page through `presentationMeta`,
 * which DSH keeps in the session beside the model's text.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { z } from 'zod';
import { type Snapshot, type TeamworkClient } from './client.js';
import type { PresetContext } from './preset-context.js';
/** The server's limits, checked here only so a page too large is not read and sent at all. */
export declare const LIMITS: {
    files: number;
    fileBytes: number;
    versionBytes: number;
};
declare const kinds: readonly ["html", "markdown", "svg"];
type Kind = (typeof kinds)[number];
declare const input: z.ZodObject<{
    action: z.ZodEnum<{
        open: "open";
        create: "create";
        update: "update";
    }>;
    pageId: z.ZodOptional<z.ZodString>;
    baseVersion: z.ZodOptional<z.ZodNumber>;
    version: z.ZodOptional<z.ZodNumber>;
    teamId: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    kind: z.ZodOptional<z.ZodEnum<{
        html: "html";
        markdown: "markdown";
        svg: "svg";
    }>>;
    note: z.ZodDefault<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    directory: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type PageInput = z.infer<typeof input>;
/**
 * The team a page goes to: the session's team preset's, else the member's only team, else the one the agent names
 * among the member's teams. A name outside them, or none where there is a choice, is refused with the choices.
 */
export declare function pageTeam(snapshot: Snapshot | undefined, presetTeam: string | undefined, requested: string | undefined): string;
/** Where a member opens a page in the console: the team's Pages, the page selected. Only who may read it can. */
export declare function pageUrl(server: string, teamId: string, pageId: string): string;
/**
 * The files a page holds: `content` as the kind's one entry file, or every file under `directory`, which must resolve
 * inside the session's folder after following links. Hidden files and anything past the limits are refused before
 * a byte is sent, naming the rule.
 */
export declare function pageFiles(cwd: string, kind: Kind, content: string | undefined, directory: string | undefined): Promise<{
    path: string;
    bytes: Uint8Array;
}[]>;
/**
 * Writes a page's files into `directory`, a folder inside the session's workspace that is new or empty, so an agent
 * can change a page it did not make and publish the change with `update`.
 */
export declare function writePage(cwd: string, directory: string, files: {
    path: string;
    bytes: Uint8Array;
}[]): Promise<string[]>;
export interface PageToolOptions {
    client: TeamworkClient;
    preset: (agent: Agent) => PresetContext | undefined;
}
export declare function registerPageTool(ctx: Context, options: PageToolOptions): void;
export {};
//# sourceMappingURL=page-tool.d.ts.map