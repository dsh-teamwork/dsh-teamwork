/**
 * The plugin's browser half: a Teamwork entry in DSH's sidebar and the screen
 * it opens in the main column. Everything it does goes through the host
 * half's `/api/teamwork/*` routes (`src/panel.ts`).
 *
 * `scripts/build-web.mjs` bundles this into `lib/web/client.js` the way DSH
 * loads a client module: CommonJS inside `__ModuleLoader__.load`, with React
 * taken from the host.
 */
import { PANEL_ID, currentSessionTracker, type Host, type RenderFactorySlot } from './host.js';
import { BRAND_FLUKE, BRAND_SURFACE, BRAND_SWELL } from '@dsh-teamwork/ui';
import { TeamworkPanel } from './TeamworkPanel.js';

interface Slots {
  inject(name: string, factory: () => unknown): void;
  register(owner: Record<string, unknown>, render: (props: any) => unknown): unknown;
}

export const inject = ['slots', 'sessions', 'layout', 'uiWorkspace', 'workspaces'];

export function apply(ctx: Host & { slots: Slots; effect(callback: () => (() => void)): void }) {
  const trackSession = currentSessionTracker(ctx.sessions.list);
  trackSession();
  ctx.effect(() => ctx.sessions.list.subscribe(() => { trackSession(); }));
  const host: Host = {
    currentSession: trackSession,
    get sessions() { return ctx.sessions; },
    get layout() { return ctx.layout; },
    get uiWorkspace() { return ctx.uiWorkspace; },
    get workspaces() { return ctx.workspaces; },
  };
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 60, label: 'Teamwork' }, (owner: { active?: boolean; size?: number }) => (
      <TeamIcon size={owner?.size || 16} active={!!owner?.active} />
    )),
  );
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, (owner: { renderFactorySlot: RenderFactorySlot }) => (
    <TeamworkPanel host={host} renderFactorySlot={owner.renderFactorySlot} />
  )));
}

/** The sidebar's one-colour glyph: the mark's fluke, surface and swell without the plate or the deep sea. */
function TeamIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" role="img" aria-label="DSH Teamwork" style={{ flex: 'none', display: 'block', color: active ? 'var(--dsw-alias-state-business-primary)' : 'inherit' }}>
      <path fill="currentColor" d={`${BRAND_FLUKE}${BRAND_SURFACE}${BRAND_SWELL}`} />
    </svg>
  );
}
