/**
 * Sessions belong to their starter on a shared DSH (the server's `docs/tech/shared-dsh.md`, "Sessions belong to
 * their starter"). DSH itself attributes nothing to an identity: every client's `$events` sees every session, and any
 * client may answer any question. So the bridge, which knows which member each pairing is, decides here what a call
 * may touch and what an event may reach:
 *
 * - `session/create` must start in one of the DSH's directories (the one it was started in, or one of its
 *   workspaces), and records the new session as the member's;
 * - `session/list` keeps the member's own sessions and drops sub-agents, which stay under their parent;
 * - a call or stream that names a session must name one of the member's, else DSH is never asked and the answer is
 *   `not_found`; renaming, pinning and archiving included, though pins and archives land in the DSH's one registry,
 *   seen at its keyboard as well;
 * - `$events` items reach a member only for their own sessions, and `$events/result` answers only an event this
 *   member was shown;
 * - sessions with no owner (started at this DSH's keyboard, or by the agent itself) are reachable by nobody remotely.
 *
 * A personal computer has no filter: its one member owns everything.
 */
import { realpathSync } from 'node:fs';

export interface Owners {
  ownerOf(sessionId: string): Promise<string | undefined>;
  claim(sessionId: string, userId: string): Promise<void>;
}

type Body = Record<string, unknown> | null | undefined;
const record = (value: unknown): Body => (value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined);

/** The session a call names, if any: `args.request.sessionId`, or a follow's `address.sessionId`. */
export function namedSession(body: unknown): string | undefined {
  const request = record(record(record(body)?.args)?.request);
  const id = request?.sessionId ?? record(request?.address)?.sessionId;
  return typeof id === 'string' ? id : undefined;
}

/** Calls that act on one session; each must name one the member owns. */
const SESSION_CALLS = new Set(['session/state', 'session/page', 'session/prompt', 'session/cancel', 'teamwork/selectModel', 'teamwork/selectPermission',
  'teamwork/listFiles', 'teamwork/searchFiles', 'teamwork/readFile',
  'teamwork/uploadStart', 'teamwork/uploadChunk', 'teamwork/uploadFinish', 'teamwork/uploadCancel', 'userQuestions/answer',
  'session/rename', 'workspace/pinSession', 'workspace/unpinSession', 'workspace/archiveSession', 'workspace/unarchiveSession']);

/** The session an `$events` item is about: a summary's `sessionId`, an emit's first argument, a question's `agentId`. */
export function eventSession(item: unknown): string | undefined {
  const value = record(item);
  if (!value) return undefined;
  if (typeof value.agentId === 'string') return value.agentId;
  const args = Array.isArray(value.args) ? value.args : [];
  const first = args[0];
  if (typeof first === 'string') return first;
  const summary = record(first);
  return typeof summary?.sessionId === 'string' ? summary.sessionId : undefined;
}

export class OwnerFilter {
  /** Per pairing, the events it was shown that can be answered: event id → session. */
  private shown = new Map<string, Map<string, string>>();
  constructor(
    private readonly owners: Owners,
    private readonly memberOf: (pairingId: string) => Promise<string | undefined>,
    private readonly directories: () => string[] = () => [],
  ) {}

  private async owns(pairingId: string, sessionId: string | undefined) {
    if (!sessionId) return false;
    const member = await this.memberOf(pairingId);
    return !!member && (await this.owners.ownerOf(sessionId)) === member;
  }

  /** Whether a call may reach DSH at all. */
  async admitCall(pairingId: string, method: string, body: unknown) {
    if (!(await this.memberOf(pairingId))) return false;
    if (method === '$events/result') {
      const eventId = record(record(body)?.args)?.eventId;
      return typeof eventId === 'string' && this.shown.get(pairingId)?.has(eventId) === true;
    }
    if (SESSION_CALLS.has(method)) return this.owns(pairingId, namedSession(body));
    if (method === 'teamwork/configuration') { const id = namedSession(body); return !id || this.owns(pairingId, id); }
    if (method === 'session/create') {
      const cwd = record(record(record(body)?.args)?.request)?.cwd;
      return typeof cwd === 'string' && this.directories().includes(cwd);
    }
    return true;
  }

  /** What a member is answered: a new session becomes theirs, a list keeps only theirs. */
  async afterCall(pairingId: string, method: string, response: unknown): Promise<unknown> {
    const value = record(record(record(response)?.result)?.value);
    if (method === 'session/create' && typeof value?.sessionId === 'string') {
      const member = await this.memberOf(pairingId);
      if (member) await this.owners.claim(value.sessionId, member);
      return response;
    }
    if (method === 'session/list' && Array.isArray(value?.items)) {
      const kept = [];
      for (const item of value.items) {
        const entry = record(item);
        const projections = record(record(entry?.projections)?.values);
        if (projections?.subagent) continue;
        if (await this.owns(pairingId, typeof entry?.sessionId === 'string' ? entry.sessionId : undefined)) kept.push(item);
      }
      const result = record(record(response)?.result)!;
      return { ...record(response), result: { ...result, value: { ...value, items: kept } } };
    }
    return response;
  }

  /** Whether a stream may open: a follow must name the member's own session; `$events` is filtered item by item. */
  async admitOpen(pairingId: string, endpoint: string, payload: unknown) {
    if (!(await this.memberOf(pairingId))) return false;
    if (endpoint === 'session/follow') return this.owns(pairingId, namedSession(payload));
    return true;
  }

  /** An `$events` item as the member may see it, or undefined when it is about someone else's session. */
  async eventFor(pairingId: string, item: unknown) {
    const value = record(item);
    if (value?.type === 'ready' || value?.type === 'cancel') return item;
    const sessionId = eventSession(item);
    if (!(await this.owns(pairingId, sessionId))) return undefined;
    if (value?.type === 'waterfall' && typeof value.eventId === 'string') {
      let shown = this.shown.get(pairingId);
      if (!shown) this.shown.set(pairingId, shown = new Map());
      shown.set(value.eventId, sessionId!);
    }
    return item;
  }

  drop(pairingId: string) { this.shown.delete(pairingId); }
}

/** The directories a session may start in: where DSH was started, then its workspaces, each once and in that order. */
export function startDirectories(started: string, workspaces: { path: string }[]) {
  const canonical = (path: string) => { try { return realpathSync(path); } catch { return path; } };
  return [...new Set([canonical(started), ...workspaces.map((workspace) => workspace.path)])];
}
