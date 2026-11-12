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
 * Class names carry the `twui-` prefix so they never meet a host's own.
 */
export const STYLE_ELEMENT_ID = 'dsh-teamwork-ui-styles';

export const css = String.raw`
.twui {
  --twui-font: var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
  --twui-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --twui-fg: var(--dsw-alias-label-primary, #1b2033);
  --twui-fg-muted: var(--dsw-alias-label-secondary, #5b6178);
  --twui-fg-subtle: var(--dsw-alias-label-tertiary, #8a8fa3);
  --twui-bg: var(--dsw-alias-bg-base, #fbfaf8);
  --twui-surface: var(--dsw-alias-bg-layer-1, #ffffff);
  --twui-surface-muted: var(--dsw-alias-bg-layer-2, #f4f3f0);
  --twui-hover: var(--dsw-alias-interactive-bg-hover, rgba(27, 32, 51, 0.06));
  --twui-border: var(--dsw-alias-border-l2, #e6e4df);
  --twui-border-strong: var(--dsw-alias-border-l3, #d6d4cf);
  --twui-accent: var(--dsw-alias-state-business-primary, #1e2f6d);
  --twui-primary: var(--dsw-alias-button-primary-fill, #1b2033);
  --twui-primary-fg: var(--dsw-alias-label-primary-inverted, #ffffff);
  --twui-success: var(--dsw-alias-state-success-primary, #1f8a4c);
  --twui-warning: var(--dsw-alias-state-warn-primary, #b26a00);
  --twui-danger: var(--dsw-alias-state-error-primary, #c9372c);
  --twui-focus: var(--dsw-focus-ring-color, #6a7bd1);
  --twui-radius-sm: var(--dsw-radius-sm, 6px);
  --twui-radius-md: var(--dsw-radius-md, 8px);
  --twui-radius-lg: var(--dsw-radius-lg, 12px);
  font-family: var(--twui-font);
  font-size: 13px;
  line-height: 1.55;
  color: var(--twui-fg);
}
@media (prefers-color-scheme: dark) {
  .twui {
    --twui-fg: var(--dsw-alias-label-primary, #eef0f6);
    --twui-fg-muted: var(--dsw-alias-label-secondary, #b4b9cc);
    --twui-fg-subtle: var(--dsw-alias-label-tertiary, #868ca3);
    --twui-bg: var(--dsw-alias-bg-base, #141829);
    --twui-surface: var(--dsw-alias-bg-layer-1, #1b2034);
    --twui-surface-muted: var(--dsw-alias-bg-layer-2, #232942);
    --twui-hover: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.07));
    --twui-border: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.1));
    --twui-border-strong: var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.16));
    --twui-accent: var(--dsw-alias-state-business-primary, #aab8f0);
    --twui-primary: var(--dsw-alias-button-primary-fill, #eef0f6);
    --twui-primary-fg: var(--dsw-alias-label-primary-inverted, #141829);
    --twui-success: var(--dsw-alias-state-success-primary, #4cc27f);
    --twui-warning: var(--dsw-alias-state-warn-primary, #e7a73d);
    --twui-danger: var(--dsw-alias-state-error-primary, #ff7b6e);
  }
}
.twui *, .twui *::before, .twui *::after { box-sizing: border-box; }
.twui :focus-visible { outline: 2px solid var(--twui-focus); outline-offset: 2px; }
.twui-mono { font-family: var(--twui-mono); font-size: 0.92em; }
.twui-muted { color: var(--twui-fg-muted); }
.twui-subtle { color: var(--twui-fg-subtle); font-size: 12px; }

.twui-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font: inherit; font-size: 13px; line-height: 1.2; white-space: nowrap;
  padding: 6px 12px; border-radius: var(--twui-radius-sm); cursor: pointer;
  border: 1px solid var(--twui-border-strong); background: var(--twui-surface); color: var(--twui-fg);
}
.twui-btn:hover:not(:disabled) { background: var(--twui-hover); }
.twui-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.twui-btn[data-variant="primary"] { background: var(--twui-primary); color: var(--twui-primary-fg); border-color: var(--twui-primary); }
.twui-btn[data-variant="primary"]:hover:not(:disabled) { background: var(--twui-primary); opacity: 0.88; }
.twui-btn[data-variant="ghost"] { background: transparent; border-color: transparent; color: var(--twui-fg-muted); }
.twui-btn[data-variant="ghost"]:hover:not(:disabled) { color: var(--twui-fg); }
.twui-btn[data-variant="danger"] { color: var(--twui-danger); }
.twui-btn[data-size="sm"] { padding: 3px 8px; font-size: 12px; }

.twui-badge {
  display: inline-flex; align-items: center; gap: 5px; max-width: 100%;
  font-size: 12px; line-height: 1.5; padding: 0 8px; border-radius: 999px;
  background: var(--twui-surface-muted); color: var(--twui-fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.twui-badge[data-tone="success"] { color: var(--twui-success); }
.twui-badge[data-tone="warning"] { color: var(--twui-warning); }
.twui-badge[data-tone="danger"] { color: var(--twui-danger); }
.twui-badge[data-tone="accent"] { color: var(--twui-accent); }
.twui-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
.twui-badge[data-outline] { background: transparent; border: 1px solid var(--twui-border); }

.twui-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--twui-border); overflow-x: auto; }
.twui-tab {
  font: inherit; font-size: 13px; background: none; border: 0; cursor: pointer; white-space: nowrap;
  padding: 8px 10px; margin-bottom: -1px; color: var(--twui-fg-muted); border-bottom: 2px solid transparent;
}
.twui-tab:hover { color: var(--twui-fg); }
.twui-tab[aria-selected="true"] { color: var(--twui-fg); font-weight: 600; border-bottom-color: var(--twui-accent); }
.twui-tab-count { margin-left: 4px; font-size: 11px; font-weight: 400; color: var(--twui-fg-subtle); font-variant-numeric: tabular-nums; }

.twui-item { border: 1px solid var(--twui-border); border-radius: var(--twui-radius-md); background: var(--twui-surface); }
.twui-item-main { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 16px; padding: 12px 14px; align-items: start; }
.twui-item-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; margin: 0; font-size: 14px; font-weight: 600; }
.twui-item-subtitle { font-family: var(--twui-mono); font-size: 12px; font-weight: 400; color: var(--twui-fg-subtle); }
.twui-item-desc { margin: 2px 0 0; color: var(--twui-fg-muted); }
.twui-item-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.twui-item-actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.twui-item-notice { grid-column: 1 / -1; margin: 0; font-size: 12px; }
.twui-item-body { border-top: 1px dashed var(--twui-border); padding: 10px 14px 12px; display: grid; gap: 8px; }
@container (max-width: 520px) {
  .twui-item-main { grid-template-columns: minmax(0, 1fr); }
  .twui-item-actions { justify-content: flex-start; }
}

.twui-notice { margin: 0; color: var(--twui-fg-muted); }
.twui-notice[data-tone="success"] { color: var(--twui-success); }
.twui-notice[data-tone="warning"] { color: var(--twui-warning); }
.twui-notice[data-tone="danger"] { color: var(--twui-danger); }

.twui-dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 16px; margin: 0; }
.twui-dl dt { color: var(--twui-fg-muted); }
.twui-dl dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }

.twui-confirm {
  display: grid; gap: 8px; padding: 10px 14px;
  border-top: 1px solid var(--twui-border); background: var(--twui-surface-muted);
  border-radius: 0 0 var(--twui-radius-md) var(--twui-radius-md);
}
.twui-confirm-title { margin: 0; font-weight: 600; }
.twui-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

.twui-input {
  font: inherit; min-width: 0; flex: 1; padding: 6px 10px;
  border: 1px solid var(--twui-border-strong); border-radius: var(--twui-radius-sm);
  background: var(--twui-surface); color: var(--twui-fg);
}
.twui-input::placeholder { color: var(--twui-fg-subtle); }

.twui-monogram {
  display: grid; place-items: center; flex: none; font-weight: 700;
  background: var(--twui-accent); color: var(--twui-surface); border-radius: 22%;
}

.twui-spinner {
  width: 12px; height: 12px; border-radius: 50%; flex: none;
  border: 2px solid currentColor; border-right-color: transparent;
  animation: twui-spin 0.8s linear infinite;
}
@keyframes twui-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .twui-spinner { animation-duration: 2.4s; } }

.twui-toast {
  position: sticky; bottom: 12px; justify-self: center; z-index: 1;
  max-width: min(480px, 100%); padding: 6px 14px; border-radius: 999px;
  background: var(--twui-primary); color: var(--twui-primary-fg); font-size: 13px;
  box-shadow: 0 6px 20px -8px rgba(0, 0, 0, 0.35);
}
.twui-toast[data-tone="danger"] { background: var(--twui-danger); color: #fff; }

.twui-empty { display: grid; gap: 12px; justify-items: start; max-width: 440px; margin: 0 auto; padding: 40px 20px; }
.twui-empty h2 { margin: 0; font-size: 18px; }
.twui-empty p { margin: 0; color: var(--twui-fg-muted); }

.twui-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; background: var(--twui-bg); container-type: inline-size; }
.twui-panel-header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--twui-border); }
.twui-panel-nav { padding: 6px 20px 0; }
.twui-panel-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 20px 24px; display: grid; gap: 10px; align-content: start; }
`;
