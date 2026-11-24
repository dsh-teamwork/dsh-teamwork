/**
 * `teamwork_artifact`: the agent publishes an artifact it made (a report, a deck, a dashboard, a diagram) to its
 * team's server, private to the member whose session made it (docs/tech/artifacts.md in the platform repository). The
 * tool never shares: only a person does, in the console or the app, so nothing an agent reads can get an artifact
 * shared. Its result carries no content, only the console link the agent gives the member; clients find the artifact
 * through `presentationMeta`, which DSH keeps in the session beside the model's text.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { z } from 'zod';
import { type Snapshot, type TeamworkClient } from './client.js';
import type { PresetContext } from './preset-context.js';
/** The server's limits, checked here only so an artifact too large is not read and sent at all. */
export declare const LIMITS: {
    files: number;
    fileBytes: number;
    versionBytes: number;
};
declare const kinds: readonly ["html", "svg"];
type Kind = (typeof kinds)[number];
declare const input: z.ZodObject<{
    action: z.ZodEnum<{
        create: "create";
        update: "update";
        open: "open";
    }>;
    artifactId: z.ZodOptional<z.ZodString>;
    baseVersion: z.ZodOptional<z.ZodNumber>;
    version: z.ZodOptional<z.ZodNumber>;
    teamId: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    kind: z.ZodOptional<z.ZodEnum<{
        html: "html";
        svg: "svg";
    }>>;
    note: z.ZodDefault<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    directory: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type ArtifactInput = z.infer<typeof input>;
/**
 * The team an artifact goes to: the session's team preset's, else the member's only team, else the one the agent
 * names among the member's teams. A name outside them, or none where there is a choice, is refused with the choices.
 */
export declare function artifactTeam(snapshot: Snapshot | undefined, presetTeam: string | undefined, requested: string | undefined): string;
/** Where a member opens an artifact in the console: the team's Artifacts, the artifact selected. Only who may read it can. */
export declare function artifactUrl(server: string, teamId: string, artifactId: string): string;
/**
 * The files an artifact holds: `content` as the kind's one entry file, or every file under `directory`, which must
 * resolve inside the session's folder after following links. Hidden files and anything past the limits are refused
 * before a byte is sent, naming the rule.
 */
export declare function artifactFiles(cwd: string, kind: Kind, content: string | undefined, directory: string | undefined): Promise<{
    path: string;
    bytes: Uint8Array;
}[]>;
/**
 * Writes an artifact's files into `directory`, a folder inside the session's workspace that is new or empty, so an
 * agent can change an artifact it did not make and publish the change with `update`.
 */
export declare function writeArtifact(cwd: string, directory: string, files: {
    path: string;
    bytes: Uint8Array;
}[]): Promise<string[]>;
export interface ArtifactToolOptions {
    client: TeamworkClient;
    preset: (agent: Agent) => PresetContext | undefined;
}
export declare function registerArtifactTool(ctx: Context, options: ArtifactToolOptions): void;
export {};
//# sourceMappingURL=artifact-tool.d.ts.map