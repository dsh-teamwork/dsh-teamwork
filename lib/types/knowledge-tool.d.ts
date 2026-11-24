/**
 * `teamwork_knowledge`: the agent proposes a change to a team knowledge document (docs/tech/knowledge.md in the
 * platform repository). Reading needs no tool, since the agent searches the synced copy (src/knowledge-sync.ts) with
 * its own file tools. The one action is `propose`: a plugin's change is always a proposal, recorded as the agent's,
 * and only an editor of the document's space makes it a version. Nothing here writes a version or changes access.
 */
import type { Context } from '@deepseek-ai/cordis';
import { type TeamworkClient } from './client.js';
import { type KnowledgeSync } from './knowledge-sync.js';
/** The server's limit on a document's text, checked here so a text too large is not read or sent at all. */
export declare const MAX_TEXT: number;
/**
 * The text a proposal sends: `content`, or the file at `path`, which must resolve inside the session's folder after
 * following links. The copy's `knowledge:` front matter line is removed; one naming another document, or a version
 * other than `baseVersion`, is refused, since the change would then not be the one the agent meant.
 */
export declare function proposalText(cwd: string | undefined, documentId: string, baseVersion: number, content: string | undefined, path: string | undefined): Promise<string>;
export interface KnowledgeToolOptions {
    client: TeamworkClient;
    knowledge: KnowledgeSync;
}
export declare function registerKnowledgeTool(ctx: Context, options: KnowledgeToolOptions): void;
//# sourceMappingURL=knowledge-tool.d.ts.map