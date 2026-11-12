/**
 * The library's one stylesheet, injected once per document by `UIRoot`.
 *
 * Every colour, radius and font is a `--twui-*` variable set on `.twui`. Each
 * defaults to the DeepSeek Harness design token of the same role
 * (`--dsw-alias-*`), so inside DSH the components follow its theme, light and
 * dark, with nothing to configure. Outside DSH the fallbacks apply, and a host
 * app maps the variables to its own tokens instead:
 *
 *   .twui { --twui-accent: var(--brand); --twui-border: var(--border); }
 *
 * Spacing is a 4 px unit. Class names carry the `twui-` prefix so they never
 * meet a host's own.
 */
export const STYLE_ELEMENT_ID = 'dsh-teamwork-ui-styles';

export const css = String.raw`
.twui {
  --twui-font: var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
  --twui-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --twui-fg: var(--dsw-alias-label-primary, #1b2033);
  --twui-fg-muted: var(--dsw-alias-label-secondary, #565c73);
  --twui-fg-subtle: var(--dsw-alias-label-tertiary, #868ba0);
  --twui-bg: var(--dsw-alias-bg-base, #fbfaf8);
  --twui-surface: var(--dsw-alias-bg-layer-1, #ffffff);
  --twui-surface-muted: var(--dsw-alias-bg-layer-2, #f4f3f0);
  --twui-hover: var(--dsw-alias-interactive-bg-hover, rgba(27, 32, 51, 0.06));
  --twui-border: var(--dsw-alias-border-l2, #e7e5e0);
  --twui-border-strong: var(--dsw-alias-border-l3, #d5d3cd);
  --twui-accent: var(--dsw-alias-state-business-primary, #1e2f6d);
  --twui-primary: var(--dsw-alias-button-primary-fill, #1b2033);
  --twui-primary-fg: var(--dsw-alias-label-primary-inverted, #ffffff);
  --twui-success: var(--dsw-alias-state-success-primary, #1f8a4c);
  --twui-warning: var(--dsw-alias-state-warn-primary, #a8650a);
  --twui-danger: var(--dsw-alias-state-error-primary, #c9372c);
  --twui-focus: var(--dsw-focus-ring-color, #6a7bd1);
  --twui-radius-sm: var(--dsw-radius-sm, 6px);
  --twui-radius-md: var(--dsw-radius-md, 8px);
  --twui-radius-lg: var(--dsw-radius-lg, 12px);
  --twui-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06);
  /* A quiet fill drawn from the text colour, so it shows on any surface in either theme. */
  --twui-fill: color-mix(in srgb, var(--twui-fg) 6%, transparent);
  --twui-fill-strong: color-mix(in srgb, var(--twui-fg) 10%, transparent);
  font-family: var(--twui-font);
  font-size: 13px;
  line-height: 1.55;
  color: var(--twui-fg);
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  .twui {
    --twui-fg: var(--dsw-alias-label-primary, #eceef5);
    --twui-fg-muted: var(--dsw-alias-label-secondary, #b0b5c8);
    --twui-fg-subtle: var(--dsw-alias-label-tertiary, #82889f);
    --twui-bg: var(--dsw-alias-bg-base, #131726);
    --twui-surface: var(--dsw-alias-bg-layer-1, #1a1f33);
    --twui-surface-muted: var(--dsw-alias-bg-layer-2, #222842);
    --twui-hover: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.07));
    --twui-border: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.09));
    --twui-border-strong: var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.15));
    --twui-accent: var(--dsw-alias-state-business-primary, #a9b6ef);
    --twui-primary: var(--dsw-alias-button-primary-fill, #eceef5);
    --twui-primary-fg: var(--dsw-alias-label-primary-inverted, #131726);
    --twui-success: var(--dsw-alias-state-success-primary, #4cc27f);
    --twui-warning: var(--dsw-alias-state-warn-primary, #e6a640);
    --twui-danger: var(--dsw-alias-state-error-primary, #ff7b6e);
    --twui-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
}
.twui *, .twui *::before, .twui *::after { box-sizing: border-box; }
.twui :focus-visible { outline: 2px solid var(--twui-focus); outline-offset: 2px; border-radius: var(--twui-radius-sm); }
.twui h1, .twui h2, .twui h3, .twui p { margin: 0; }
.twui-mono { font-family: var(--twui-mono); font-size: 0.92em; }
.twui-muted { color: var(--twui-fg-muted); }
.twui-subtle { color: var(--twui-fg-subtle); font-size: 12px; }
.twui-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.twui-stack { display: grid; gap: 12px; }

/* Buttons */
.twui-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; padding: 0 12px; border-radius: var(--twui-radius-sm);
  font: inherit; font-size: 13px; font-weight: 500; line-height: 1; white-space: nowrap; cursor: pointer;
  border: 1px solid var(--twui-border-strong); background: var(--twui-surface); color: var(--twui-fg);
  transition: background-color .12s ease, border-color .12s ease, opacity .12s ease;
}
.twui-btn:hover:not(:disabled) { background: var(--twui-hover); }
.twui-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.twui-btn[data-variant="primary"] { background: var(--twui-primary); color: var(--twui-primary-fg); border-color: transparent; }
.twui-btn[data-variant="primary"]:hover:not(:disabled) { background: var(--twui-primary); opacity: 0.88; }
.twui-btn[data-variant="ghost"] { background: transparent; border-color: transparent; color: var(--twui-fg-muted); }
.twui-btn[data-variant="ghost"]:hover:not(:disabled) { color: var(--twui-fg); background: var(--twui-hover); }
.twui-btn[data-variant="danger"] { color: var(--twui-danger); }
.twui-btn[data-size="sm"] { height: 28px; padding: 0 10px; font-size: 12px; }
.twui-btn[data-size="lg"] { height: 40px; padding: 0 16px; font-size: 14px; }
.twui-btn[data-block] { width: 100%; }
.twui-btn[data-icon-only] { width: 32px; padding: 0; }
.twui-btn[data-icon-only][data-size="sm"] { width: 28px; }
.twui-link { font: inherit; padding: 0; border: 0; background: none; color: var(--twui-accent); cursor: pointer; text-decoration: none; }
.twui-link:hover { text-decoration: underline; text-underline-offset: 2px; }

/* Badges */
.twui-badge {
  display: inline-flex; align-items: center; gap: 6px; max-width: 100%; height: 22px;
  font-size: 12px; font-weight: 500; padding: 0 8px; border-radius: 999px;
  background: var(--twui-fill); color: var(--twui-fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.twui-badge[data-tone="success"] { color: var(--twui-success); background: color-mix(in srgb, var(--twui-success) 10%, transparent); }
.twui-badge[data-tone="warning"] { color: var(--twui-warning); background: color-mix(in srgb, var(--twui-warning) 12%, transparent); }
.twui-badge[data-tone="danger"] { color: var(--twui-danger); background: color-mix(in srgb, var(--twui-danger) 10%, transparent); }
.twui-badge[data-tone="accent"] { color: var(--twui-accent); background: color-mix(in srgb, var(--twui-accent) 10%, transparent); }
.twui-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
.twui-badge[data-outline] { background: transparent; border: 1px solid var(--twui-border-strong); }

/* Tabs */
.twui-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--twui-border); overflow-x: auto; }
.twui-tab {
  display: inline-flex; align-items: center; gap: 6px;
  font: inherit; font-size: 13px; font-weight: 500; background: none; border: 0; cursor: pointer; white-space: nowrap;
  padding: 10px 4px; margin: 0 8px -1px 0; color: var(--twui-fg-muted); border-bottom: 2px solid transparent;
}
.twui-tab:hover { color: var(--twui-fg); }
.twui-tab[aria-selected="true"] { color: var(--twui-fg); border-bottom-color: var(--twui-fg); }
.twui-tab-count {
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; display: inline-grid; place-items: center;
  font-size: 11px; font-variant-numeric: tabular-nums; background: var(--twui-fill); color: var(--twui-fg-muted);
}

/* List items */
.twui-item { border: 1px solid var(--twui-border); border-radius: var(--twui-radius-lg); background: var(--twui-surface); box-shadow: var(--twui-shadow); }
.twui-item-main { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 4px 14px; padding: 16px; align-items: start; }
.twui-item-main[data-no-icon] { grid-template-columns: minmax(0, 1fr) auto; }
.twui-tile {
  width: 36px; height: 36px; border-radius: var(--twui-radius-md); display: grid; place-items: center; flex: none;
  background: var(--twui-fill); color: var(--twui-fg-muted);
}
.twui-item-title { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 14px; font-weight: 600; line-height: 22px; }
.twui-item-subtitle { font-family: var(--twui-mono); font-size: 11.5px; font-weight: 400; color: var(--twui-fg-subtle); }
.twui-item-desc { margin-top: 2px; color: var(--twui-fg-muted); }
.twui-item-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.twui-item-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.twui-item-notice { grid-column: 2 / -1; margin-top: 8px; }
.twui-item-main[data-no-icon] .twui-item-notice { grid-column: 1 / -1; }
.twui-item-body { border-top: 1px solid var(--twui-border); padding: 14px 16px 16px; display: grid; gap: 10px; }
@container (max-width: 560px) {
  .twui-item-main { grid-template-columns: auto minmax(0, 1fr); }
  .twui-item-actions { grid-column: 1 / -1; justify-content: flex-start; margin-top: 8px; }
}

/* Inline notices and banners */
.twui-notice { color: var(--twui-fg-muted); display: flex; align-items: flex-start; gap: 6px; }
.twui-notice[data-tone="success"] { color: var(--twui-success); }
.twui-notice[data-tone="warning"] { color: var(--twui-warning); }
.twui-notice[data-tone="danger"] { color: var(--twui-danger); }
.twui-notice > svg { margin-top: 2px; }
.twui-banner {
  display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: var(--twui-radius-md);
  border: 1px solid var(--twui-border); background: var(--twui-fill);
}
.twui-banner[data-tone="warning"] { border-color: color-mix(in srgb, var(--twui-warning) 35%, transparent); background: color-mix(in srgb, var(--twui-warning) 7%, var(--twui-surface)); }
.twui-banner[data-tone="danger"] { border-color: color-mix(in srgb, var(--twui-danger) 35%, transparent); background: color-mix(in srgb, var(--twui-danger) 7%, var(--twui-surface)); }
.twui-banner-icon { margin-top: 1px; color: var(--twui-fg-muted); }
.twui-banner[data-tone="warning"] .twui-banner-icon { color: var(--twui-warning); }
.twui-banner[data-tone="danger"] .twui-banner-icon { color: var(--twui-danger); }
.twui-banner-body { flex: 1; min-width: 0; display: grid; gap: 2px; }
.twui-banner-title { font-weight: 600; }
.twui-banner-text { color: var(--twui-fg-muted); }

/* Details */
.twui-dl { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 8px 16px; margin: 0; }
.twui-dl dt { color: var(--twui-fg-subtle); font-size: 12px; line-height: 22px; }
.twui-dl dd { margin: 0; min-width: 0; overflow-wrap: anywhere; line-height: 22px; }

/* Inline confirmation */
.twui-confirm {
  display: grid; gap: 10px; padding: 14px 16px;
  border-top: 1px solid var(--twui-border); background: var(--twui-fill);
  border-radius: 0 0 var(--twui-radius-lg) var(--twui-radius-lg);
}
.twui-confirm-title { font-weight: 600; }

/* Form fields */
.twui-field { display: grid; gap: 6px; }
.twui-label { font-size: 12px; font-weight: 500; color: var(--twui-fg-muted); }
.twui-input {
  font: inherit; min-width: 0; flex: 1; height: 36px; padding: 0 12px;
  border: 1px solid var(--twui-border-strong); border-radius: var(--twui-radius-sm);
  background: var(--twui-surface); color: var(--twui-fg);
  transition: border-color .12s ease, box-shadow .12s ease;
}
.twui-input:focus { outline: none; border-color: var(--twui-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--twui-focus) 22%, transparent); }
.twui-input::placeholder { color: var(--twui-fg-subtle); }
.twui-input[aria-invalid="true"] { border-color: var(--twui-danger); }
.twui-input[data-size="lg"] { height: 44px; font-size: 16px; }
.twui-hint { font-size: 12px; color: var(--twui-fg-subtle); }
.twui-hint[data-tone="danger"] { color: var(--twui-danger); }

/* Monogram, spinner, skeleton */
.twui-monogram {
  display: grid; place-items: center; flex: none; font-weight: 700;
  background: var(--twui-fill-strong); color: var(--twui-fg-muted); border-radius: 22%;
}
.twui-spinner {
  width: 12px; height: 12px; border-radius: 50%; flex: none;
  border: 2px solid currentColor; border-right-color: transparent;
  animation: twui-spin 0.8s linear infinite;
}
@keyframes twui-spin { to { transform: rotate(360deg); } }
.twui-skeleton { border-radius: var(--twui-radius-sm); background: var(--twui-fill-strong); animation: twui-pulse 1.4s ease-in-out infinite; }
@keyframes twui-pulse { 50% { opacity: 0.55; } }
@media (prefers-reduced-motion: reduce) {
  .twui-spinner { animation-duration: 2.4s; }
  .twui-skeleton { animation: none; }
  .twui-btn, .twui-input { transition: none; }
}

/* Toast */
.twui-toast {
  position: sticky; bottom: 16px; justify-self: center; z-index: 1;
  display: inline-flex; align-items: center; gap: 8px;
  max-width: min(520px, 100%); padding: 10px 16px; border-radius: var(--twui-radius-md);
  background: var(--twui-primary); color: var(--twui-primary-fg); font-size: 13px;
  box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.35);
}
.twui-toast[data-tone="danger"] { background: var(--twui-danger); color: #fff; }

/* Empty / first screens */
.twui-empty { display: grid; gap: 8px; justify-items: center; text-align: center; padding: 40px 24px; color: var(--twui-fg-muted); }
.twui-empty-icon { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--twui-fill); color: var(--twui-fg-subtle); margin-bottom: 4px; }
.twui-empty-title { font-size: 14px; font-weight: 600; color: var(--twui-fg); }

/* Card */
.twui-card { border: 1px solid var(--twui-border); border-radius: var(--twui-radius-lg); background: var(--twui-surface); box-shadow: var(--twui-shadow); }

/* Panel: header, nav and content share one centred column */
.twui-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; background: var(--twui-bg); container-type: inline-size; }
.twui-panel-header, .twui-panel-nav { background: var(--twui-surface); }
.twui-panel-header { border-bottom: 1px solid var(--twui-border); }
.twui-panel-column { max-width: 1008px; margin: 0 auto; padding: 0 24px; }
.twui-panel-header > .twui-panel-column { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding-top: 16px; padding-bottom: 16px; }
.twui-panel-nav .twui-tabs { border-bottom: 0; }
.twui-panel-nav { border-bottom: 1px solid var(--twui-border); }
.twui-panel-body { flex: 1; min-height: 0; overflow-y: auto; }
.twui-panel-content { display: grid; gap: 12px; align-content: start; padding-top: 20px; padding-bottom: 32px; }
.twui-panel[data-centered] .twui-panel-body { display: grid; place-items: center; }
.twui-panel[data-centered] .twui-panel-content { width: 100%; }
`;
