/**
 * The slice of DSH's browser services the panel uses, typed loosely on purpose:
 * they come from other packages' client bundles at runtime (`dsh.client.inject`
 * in package.json), and this repository does not build against their sources.
 */
export interface SessionSummary {
  id: string;
  retainedBy?: Record<string, number | undefined>;
}

export interface Observable<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

export interface Host {
  /** `ctx.sessions` (`@deepseek-ai/dsh-api-session-controller`). */
  sessions: { list: Observable<{ byId: Record<string, SessionSummary> }> };
  /** `ctx.layout` (`@deepseek-ai/dsh-client-ui-layout`). */
  layout: { selectPanel(id: string | null): void };
  /** `ctx.uiWorkspace` (`@deepseek-ai/dsh-client-ui-workspace`). */
  uiWorkspace: { startSession(workspaceId?: string, options?: { agentPreset?: string }): void };
}

export const PANEL_ID = 'dsh-teamwork';

/**
 * The session the conversation view holds: the one the member is working in.
 * When this panel replaces the conversation the view may let go of it, so the
 * last one seen stays current until another is opened.
 */
export function currentSessionTracker(list: Host['sessions']['list']) {
  let last: string | undefined;
  return (): string | undefined => {
    const open = Object.values(list.getSnapshot().byId).find((s) => (s.retainedBy?.mainView ?? 0) > 0);
    if (open) last = open.id;
    return last;
  };
}
