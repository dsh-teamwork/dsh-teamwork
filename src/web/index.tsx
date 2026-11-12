/**
 * The plugin's browser half: a Teamwork entry in DSH's sidebar and the screen
 * it opens in the main column. Everything it does goes through the host
 * half's `/api/teamwork/*` routes (`src/panel.ts`).
 *
 * `scripts/build-web.mjs` bundles this into `lib/web/client.js` the way DSH
 * loads a client module: CommonJS inside `__ModuleLoader__.load`, with React
 * taken from the host.
 */
import { PANEL_ID, type Host } from './host.js';
import { TeamworkPanel } from './TeamworkPanel.js';

interface Slots {
  inject(name: string, factory: () => unknown): void;
  register(owner: Record<string, unknown>, render: (props: any) => unknown): unknown;
}

export const inject = ['slots', 'sessions', 'layout', 'uiWorkspace'];

export function apply(ctx: Host & { slots: Slots }) {
  const host: Host = {
    get sessions() { return ctx.sessions; },
    get layout() { return ctx.layout; },
    get uiWorkspace() { return ctx.uiWorkspace; },
  };
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 60, label: 'Teamwork' }, (owner: { active?: boolean; size?: number }) => (
      <TeamIcon size={owner?.size || 16} active={!!owner?.active} />
    )),
  );
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, () => <TeamworkPanel host={host} />));
}

function TeamIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ color: active ? 'var(--dsw-alias-state-business-primary)' : 'inherit' }}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
