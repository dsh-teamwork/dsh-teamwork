window.__ModuleLoader__.load({ id: "@dsh-teamwork/dsh-teamwork", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/web/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/web/host.ts
var workspaceAt = (dsh, path) => path ? dsh.workspaces.list.getSnapshot().items.find((workspace) => workspace.path === path) : void 0;
var PANEL_ID = "dsh-teamwork";
function currentSessionTracker(list) {
  let last;
  return () => {
    const open2 = Object.values(list.getSnapshot().byId).find((s) => (s.retainedBy?.mainView ?? 0) > 0);
    if (open2) last = open2.id;
    return last;
  };
}

// ui/src/root.tsx
var import_react = require("react");

// ui/src/styles.ts
var STYLE_ELEMENT_ID = "dsh-teamwork-ui-styles";
var css = String.raw`
.twui {
  --twui-font: var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
  --twui-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --twui-fg: var(--dsw-alias-label-primary, #0a0a0b);
  --twui-fg-muted: var(--dsw-alias-label-secondary, #5c5c66);
  --twui-fg-subtle: var(--dsw-alias-label-tertiary, #8e8e98);
  --twui-bg: var(--dsw-alias-bg-base, #ffffff);
  --twui-surface: var(--dsw-alias-bg-layer-1, #ffffff);
  --twui-surface-muted: var(--dsw-alias-bg-layer-2, #f7f7f8);
  --twui-hover: var(--dsw-alias-interactive-bg-hover, rgba(10, 10, 11, 0.05));
  --twui-border: var(--dsw-alias-border-l2, #e8e8ea);
  --twui-border-strong: var(--dsw-alias-border-l3, #d9d9de);
  --twui-accent: var(--dsw-alias-state-business-primary, #1e2f6d);
  --twui-primary: var(--dsw-alias-button-primary-fill, #0a0a0b);
  --twui-primary-fg: var(--dsw-alias-label-primary-inverted, #ffffff);
  --twui-success: var(--dsw-alias-state-success-primary, #15803d);
  --twui-warning: var(--dsw-alias-state-warn-primary, #a16207);
  --twui-danger: var(--dsw-alias-state-error-primary, #c2261d);
  --twui-brand: #1e2f6d;
  --twui-brand-fg: #ffffff;
  --twui-signal: #e8a33d;
  --twui-focus: var(--dsw-focus-ring-color, #3b4f9a);
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
    --twui-fg: var(--dsw-alias-label-primary, #f4f4f5);
    --twui-fg-muted: var(--dsw-alias-label-secondary, #a1a1aa);
    --twui-fg-subtle: var(--dsw-alias-label-tertiary, #71717a);
    --twui-bg: var(--dsw-alias-bg-base, #0b0b0c);
    --twui-surface: var(--dsw-alias-bg-layer-1, #141416);
    --twui-surface-muted: var(--dsw-alias-bg-layer-2, #1d1d20);
    --twui-hover: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.07));
    --twui-border: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.09));
    --twui-border-strong: var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.15));
    --twui-accent: var(--dsw-alias-state-business-primary, #a9b6ef);
    --twui-primary: var(--dsw-alias-button-primary-fill, #f4f4f5);
    --twui-primary-fg: var(--dsw-alias-label-primary-inverted, #0b0b0c);
    --twui-success: var(--dsw-alias-state-success-primary, #6ee7a0);
    --twui-warning: var(--dsw-alias-state-warn-primary, #f0b44c);
    --twui-danger: var(--dsw-alias-state-error-primary, #f87171);
    --twui-focus: var(--dsw-focus-ring-color, #9db0f0);
    --twui-brand: #3b4f9a;
    --twui-signal: #f0b44c;
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
.twui-badge[data-tone="brand"] { color: var(--twui-brand-fg); background: var(--twui-brand); font-weight: 600; }
/* A lone attention dot beside a label (a button, a status line). */
.twui-signal-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--twui-signal); flex: none; }
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
.twui-item[data-clickable] { position: relative; }
.twui-item[data-clickable]:hover { border-color: var(--twui-border-strong); }
.twui .twui-item-trigger { border: 0; padding: 0; background: transparent; color: inherit; font: inherit; text-align: inherit; cursor: pointer; }
.twui-item-trigger::after { content: ""; position: absolute; inset: -1px; border-radius: var(--twui-radius-lg); }
.twui-item[data-clickable] .twui-item-actions > * { position: relative; z-index: 1; }
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
.twui-panel-header, .twui-panel-nav, .twui-panel-footer { flex: none; }
.twui-panel-column { max-width: 1008px; margin: 0 auto; padding: 0 24px; }
.twui-panel-header > .twui-panel-column { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding-top: 12px; padding-bottom: 12px; }
.twui-panel-nav .twui-tabs { border-bottom: 0; }
.twui-panel-nav { border-bottom: 1px solid var(--twui-border); }
.twui-panel-body { flex: 1; min-height: 0; overflow-y: auto; }
.twui-panel-content { display: grid; gap: 12px; align-content: start; padding-top: 20px; padding-bottom: 32px; }
.twui-panel[data-centered] .twui-panel-body { display: grid; place-items: center; }
.twui-panel[data-centered] .twui-panel-content { width: 100%; }

/* Custom selects: the popup stays in the theme root and flips near the viewport edge. */
.twui-select { position: relative; min-width: 0; max-width: 100%; }
.twui-select-trigger { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 36px; padding: 7px 11px; border: 1px solid var(--twui-border); border-radius: var(--twui-radius-md); font: inherit; color: var(--twui-fg); background: var(--twui-fill); cursor: pointer; }
.twui-select-trigger > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.twui-select-trigger:hover:not(:disabled), .twui-select-trigger[aria-expanded="true"] { background: var(--twui-fill-strong); }
.twui-select-trigger:disabled { opacity: .5; cursor: not-allowed; }
.twui-select[data-split] { display: inline-flex; align-items: stretch; border: 1px solid transparent; border-radius: var(--twui-radius-md); background: transparent; }
.twui-select[data-split]:hover, .twui-select[data-split]:focus-within { border-color: var(--twui-border); background: var(--twui-fill); }
.twui-select-primary { display: flex; align-items: center; min-width: 0; min-height: 34px; padding: 7px 12px; border: 0; border-radius: calc(var(--twui-radius-md) - 1px) 0 0 calc(var(--twui-radius-md) - 1px); background: transparent; color: var(--twui-fg); font: inherit; cursor: pointer; }
.twui-select-primary > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.twui-select-primary:hover:not(:disabled) { background: var(--twui-fill-strong); }
.twui-select-primary:disabled { opacity: .5; cursor: not-allowed; }
.twui-select[data-split] > .twui-select-trigger { width: 34px; flex: none; justify-content: center; padding: 0; border: 0; border-left: 1px solid transparent; border-radius: 0 calc(var(--twui-radius-md) - 1px) calc(var(--twui-radius-md) - 1px) 0; background: transparent; }
.twui-select[data-split]:hover > .twui-select-trigger, .twui-select[data-split]:focus-within > .twui-select-trigger { border-left-color: var(--twui-border); }
.twui-select[data-split] > .twui-select-trigger:hover:not(:disabled), .twui-select[data-split] > .twui-select-trigger[aria-expanded="true"] { background: var(--twui-fill-strong); }
.twui-select-menu { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; min-width: 100%; width: max-content; max-width: min(300px, 80cqw); max-height: min(288px, 45vh); overflow-y: auto; padding: 5px; border: 1px solid var(--twui-border-strong); border-radius: var(--twui-radius-md); background: var(--twui-surface); color: var(--twui-fg); box-shadow: 0 8px 28px color-mix(in srgb, var(--twui-fg) 15%, transparent); }
.twui-select-menu[data-side="top"] { top: auto; bottom: calc(100% + 6px); }
.twui-select-option { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 9px 10px; border-radius: var(--twui-radius-sm); cursor: pointer; overflow-wrap: anywhere; }
.twui-select-option > span { display: grid; gap: 2px; }
.twui-select-option small { font-size: 12px; color: var(--twui-fg-muted); }
.twui-select-option[data-active] { background: var(--twui-hover); }
.twui-select-option[aria-selected="true"] { color: var(--twui-accent); }
.twui-select-option[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }

/* Screen composition */
.twui-brand-lockup { display: flex; align-items: center; gap: 12px; }
.twui-brand-lockup { min-width: 0; }
.twui-brand-home { display: inline-flex; flex: none; padding: 0; background: transparent; border: 0; border-radius: var(--twui-radius-sm); cursor: pointer; }
.twui-header-actions { margin-left: auto; gap: 4px; }
.twui-header-actions .twui-btn[aria-current="page"] { color: var(--twui-fg); background: var(--twui-fill); }
.twui-panel-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 2px 16px; min-height: 32px; padding: 2px 12px; border-top: 1px solid var(--twui-border); background: var(--twui-surface); color: var(--twui-fg-muted); font-size: 11px; }
.twui-footer-identity { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 12px; min-width: 0; }
.twui-footer-name { font-weight: 500; }
.twui-footer-connection { min-width: 0; max-width: 100%; }
.twui-footer-connection > svg { flex-shrink: 0; }
.twui-footer-service { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.twui-footer-service .twui-signal-dot { display: inline-block; margin-right: 6px; vertical-align: 1px; }
.twui-footer-actions { margin-left: auto; gap: 4px; }
.twui-footer-actions .twui-badge { background: transparent; font-size: 11px; height: 20px; padding: 0 4px; }
.twui-footer-actions .twui-btn { font-size: 11px; height: 24px; padding-inline: 6px; }
.twui-page-title { font-size: 22px; font-weight: 600; letter-spacing: -.025em; }
.twui-team-scope { gap: 4px; color: var(--twui-fg-muted); min-width: 0; }
.twui-team-scope :is(.twui-select, .twui-team-name) { max-width: min(280px, 60cqw); }
.twui-team-scope .twui-team-name { min-width: 0; color: var(--twui-fg); }
.twui-team-name > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.twui-resource-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; justify-content: space-between; }
.twui-resource-toolbar-actions { display: flex; align-items: center; gap: 12px; max-width: 100%; margin-inline-start: auto; }
.twui-resource-toolbar-actions > :is(.twui-input, .twui-btn) { height: 36px; }
.twui-resource-toolbar-actions .twui-input { width: 240px; min-width: 0; }
.twui-resource-toolbar-actions .twui-btn { flex: 0 0 auto; }
.twui-resource-toolbar .twui-tabs { border: 0; gap: 4px; }
.twui-resource-toolbar .twui-tab { padding: 7px 14px; margin: 0; border: 0; border-radius: var(--twui-radius-sm); }
.twui-resource-toolbar .twui-tab[aria-selected="true"] { background: var(--twui-fill); }
.twui-resource-list .twui-item { border: 0; border-bottom: 1px solid var(--twui-border); border-radius: 0; box-shadow: none; background: transparent; }
.twui-resource-list .twui-item-main { padding: 24px 2px; align-items: center; }
.twui-resource-list .twui-tile { width: 42px; height: 42px; color: var(--twui-fg-muted); align-self: start; }
.twui-resource-list .twui-item-subtitle { min-width: 0; overflow-wrap: anywhere; font: inherit; font-size: 11px; padding: 1px 6px; border-radius: 4px; background: var(--twui-fill); color: var(--twui-fg-muted); }
.twui-resource-list .twui-item-tags { margin-top: 8px; }
.twui-model-modalities { display: inline-flex; align-items: center; gap: 6px; color: var(--twui-fg-muted); margin-inline-end: 4px; }
.twui-resource-list .twui-item-title { font-size: 15px; font-weight: 500; }
/* The one entry a screen leads with (the team assistant): a strong border, and the team's navy as a bar and on its tile. */
.twui-featured .twui-item { border-color: var(--twui-border-strong); box-shadow: inset 3px 0 0 var(--twui-brand); }
.twui-featured .twui-item-main { padding: 20px 20px 20px 23px; }
.twui-featured .twui-tile { background: var(--twui-brand); color: var(--twui-brand-fg); }
.twui-tile.twui-tile-media { background: none; overflow: hidden; }
.twui-tile-media > svg { display: block; width: 100%; height: 100%; }
.twui-featured .twui-item-desc { max-width: 68ch; }
.twui-account { display: grid; gap: 24px; width: 100%; max-width: 720px; }
.twui-account-heading { justify-content: space-between; }
.twui-account-heading a { text-decoration: none; }
.twui-account h3 { font-size: 15px; font-weight: 600; }
.twui-account-identity { display: flex; align-items: center; gap: 12px; overflow-wrap: anywhere; }
.twui-account-identity > :first-child { flex-shrink: 0; }
.twui-account-language { border-top: 1px solid var(--twui-border); margin-top: 16px; padding-top: 16px; }
.twui-account-teams { display: grid; margin: 0; padding: 0; list-style: none; }
.twui-account-teams > li { display: flex; align-items: center; gap: 8px; }
.twui-account-teams > li + li { border-top: 1px solid var(--twui-border); }
.twui-account-team {
  display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 12px;
  flex: 1; min-width: 0; min-height: 44px; padding: 6px 8px; border: 0; border-radius: var(--twui-radius-sm);
  background: transparent; color: var(--twui-fg); font: inherit; text-align: start; overflow-wrap: anywhere; cursor: pointer;
}
.twui-account-team:hover { background: var(--twui-hover); }
.twui-account-team > svg { color: var(--twui-fg-muted); }
.twui-account-team-leave { flex: none; text-decoration: none; }
.twui-sign-out { border-top: 1px solid var(--twui-border); padding-top: 12px; }
.twui-panel-content { gap: 16px; padding-top: 28px; }
@container (max-width: 680px) {
  .twui-header-actions { width: 100%; justify-content: flex-end; }
  .twui-panel-column { padding-inline: 16px; }
  .twui-resource-toolbar-actions { flex: 1 1 180px; }
  .twui-resource-toolbar-actions .twui-input { flex: 1 1 180px; }
}
@container (max-width: 380px) {
  .twui-header-actions { gap: 0; }
  .twui-header-actions .twui-btn { padding-inline: 7px; font-size: 12px; }
  .twui-brand-lockup { gap: 8px; }
  .twui-team-scope .twui-btn { padding-inline: 6px; }
  .twui-team-scope .twui-select { max-width: 42cqw; }
}
@media (pointer: coarse) {
  .twui-select-trigger, .twui-select-primary, .twui-select-option, .twui-btn { min-height: 44px; height: auto; }
  .twui-select[data-split] > .twui-select-trigger { width: 44px; }
  .twui-input { min-height: 44px; font-size: 16px; }
}
`;

// ui/src/root.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function ensureStyles(doc = document) {
  const existing = doc.getElementById(STYLE_ELEMENT_ID);
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css;
    return;
  }
  const style = doc.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = css;
  doc.head.appendChild(style);
}
function UIRoot({ className, ...props }) {
  (0, import_react.useInsertionEffect)(() => ensureStyles(), []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ...props, className: join("twui", className) });
}
function join(...names) {
  return names.filter(Boolean).join(" ");
}

// ui/src/brand.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var BRAND_FLUKE = "M185.89 163.76C162.65 148.53 128.19 148.57 93.22 161.01C68.77 169.86 48.13 170.02 31.16 163.85C49.59 192.62 84.41 213.93 127.56 217.69C158.83 220.04 182.52 219.82 192.45 234.01L198.98 312.7L249.02 299.3L215.33 227.88C216.83 210.63 237.46 198.97 263.37 181.3C298.85 156.47 318.35 120.6 319.93 86.47C308.32 100.31 290.36 110.48 264.77 115.04C228.26 121.76 198.39 138.96 185.89 163.76Z";
var BRAND_SURFACE = "M-6.66 286.12L-4.69 285.14L-2.69 284.13L-0.66 283.12L1.41 282.11L3.52 281.13L5.66 280.19L7.83 279.31L10.05 278.49L12.3 277.77L14.59 277.16L16.91 276.66L19.26 276.3L21.62 276.07L24 276L26.38 276.07L28.74 276.3L31.09 276.66L33.41 277.16L35.7 277.77L37.95 278.49L40.17 279.31L42.34 280.19L44.48 281.13L46.59 282.11L48.66 283.12L50.69 284.13L52.69 285.14L54.66 286.12L56.59 287.06L58.48 287.94L60.34 288.76L62.17 289.5L63.95 290.16L65.7 290.72L67.41 291.18L69.09 291.54L70.74 291.8L72.38 291.95L74 292L75.62 291.95L77.26 291.8L78.91 291.54L80.59 291.18L82.3 290.72L84.05 290.16L85.83 289.5L87.66 288.76L89.52 287.94L91.41 287.06L93.34 286.12L95.31 285.14L97.31 284.13L99.34 283.12L101.41 282.11L103.52 281.13L105.66 280.19L107.83 279.31L110.05 278.49L112.3 277.77L114.59 277.16L116.91 276.66L119.26 276.3L121.62 276.07L124 276L126.38 276.07L128.74 276.3L131.09 276.66L133.41 277.16L135.7 277.77L137.95 278.49L140.17 279.31L142.34 280.19L144.48 281.13L146.59 282.11L148.66 283.12L150.69 284.13L152.69 285.14L154.66 286.12L156.59 287.06L158.48 287.94L160.34 288.76L162.17 289.5L163.95 290.16L165.7 290.72L167.41 291.18L169.09 291.54L170.74 291.8L172.38 291.95L174 292L175.62 291.95L177.26 291.8L178.91 291.54L180.59 291.18L182.3 290.72L184.05 290.16L185.83 289.5L187.66 288.76L189.52 287.94L191.41 287.06L193.34 286.12L195.31 285.14L197.31 284.13L199.34 283.12L201.41 282.11L203.52 281.13L205.66 280.19L207.83 279.31L210.05 278.49L212.3 277.77L214.59 277.16L216.91 276.66L219.26 276.3L221.62 276.07L224 276L226.38 276.07L228.74 276.3L231.09 276.66L233.41 277.16L235.7 277.77L237.95 278.49L240.17 279.31L242.34 280.19L244.48 281.13L246.59 282.11L248.66 283.12L250.69 284.13L252.69 285.14L254.66 286.12L256.59 287.06L258.48 287.94L260.34 288.76L262.17 289.5L263.95 290.16L265.7 290.72L267.41 291.18L269.09 291.54L270.74 291.8L272.38 291.95L274 292L275.62 291.95L277.26 291.8L278.91 291.54L280.59 291.18L282.3 290.72L284.05 290.16L285.83 289.5L287.66 288.76L289.52 287.94L291.41 287.06L293.34 286.12L295.31 285.14L297.31 284.13L299.34 283.12L301.41 282.11L303.52 281.13L305.66 280.19L307.83 279.31L310.05 278.49L312.3 277.77L314.59 277.16L316.91 276.66L319.26 276.3L321.62 276.07L324 276L326.38 276.07L328.74 276.3L331.09 276.66L333.41 277.16L335.7 277.77L337.95 278.49L340.17 279.31L342.34 280.19L344.48 281.13L346.59 282.11L348.66 283.12L350.69 284.13L352.69 285.14L354.66 286.12L356.59 287.06L358.48 287.94L360.34 288.76L362.17 289.5L363.95 290.16L365.7 290.72L367.41 291.18L369.09 291.54L370.74 291.8L372.38 291.95L374 292L375.62 291.95L377.26 291.8L378.91 291.54L380.59 291.18L382.3 290.72L384.05 290.16L385.83 289.5L387.66 288.76L389.52 287.94L391.41 287.06L393.34 286.12L395.31 285.14L397.31 284.13L399.34 283.12L401.41 282.11L406.59 292.94L404.66 293.88L402.69 294.86L400.69 295.87L398.66 296.88L396.59 297.89L394.48 298.87L392.34 299.81L390.17 300.69L387.95 301.51L385.7 302.23L383.41 302.84L381.09 303.34L378.74 303.7L376.38 303.93L374 304L371.62 303.93L369.26 303.7L366.91 303.34L364.59 302.84L362.3 302.23L360.05 301.51L357.83 300.69L355.66 299.81L353.52 298.87L351.41 297.89L349.34 296.88L347.31 295.87L345.31 294.86L343.34 293.88L341.41 292.94L339.52 292.06L337.66 291.24L335.83 290.5L334.05 289.84L332.3 289.28L330.59 288.82L328.91 288.46L327.26 288.2L325.62 288.05L324 288L322.38 288.05L320.74 288.2L319.09 288.46L317.41 288.82L315.7 289.28L313.95 289.84L312.17 290.5L310.34 291.24L308.48 292.06L306.59 292.94L304.66 293.88L302.69 294.86L300.69 295.87L298.66 296.88L296.59 297.89L294.48 298.87L292.34 299.81L290.17 300.69L287.95 301.51L285.7 302.23L283.41 302.84L281.09 303.34L278.74 303.7L276.38 303.93L274 304L271.62 303.93L269.26 303.7L266.91 303.34L264.59 302.84L262.3 302.23L260.05 301.51L257.83 300.69L255.66 299.81L253.52 298.87L251.41 297.89L249.34 296.88L247.31 295.87L245.31 294.86L243.34 293.88L241.41 292.94L239.52 292.06L237.66 291.24L235.83 290.5L234.05 289.84L232.3 289.28L230.59 288.82L228.91 288.46L227.26 288.2L225.62 288.05L224 288L222.38 288.05L220.74 288.2L219.09 288.46L217.41 288.82L215.7 289.28L213.95 289.84L212.17 290.5L210.34 291.24L208.48 292.06L206.59 292.94L204.66 293.88L202.69 294.86L200.69 295.87L198.66 296.88L196.59 297.89L194.48 298.87L192.34 299.81L190.17 300.69L187.95 301.51L185.7 302.23L183.41 302.84L181.09 303.34L178.74 303.7L176.38 303.93L174 304L171.62 303.93L169.26 303.7L166.91 303.34L164.59 302.84L162.3 302.23L160.05 301.51L157.83 300.69L155.66 299.81L153.52 298.87L151.41 297.89L149.34 296.88L147.31 295.87L145.31 294.86L143.34 293.88L141.41 292.94L139.52 292.06L137.66 291.24L135.83 290.5L134.05 289.84L132.3 289.28L130.59 288.82L128.91 288.46L127.26 288.2L125.62 288.05L124 288L122.38 288.05L120.74 288.2L119.09 288.46L117.41 288.82L115.7 289.28L113.95 289.84L112.17 290.5L110.34 291.24L108.48 292.06L106.59 292.94L104.66 293.88L102.69 294.86L100.69 295.87L98.66 296.88L96.59 297.89L94.48 298.87L92.34 299.81L90.17 300.69L87.95 301.51L85.7 302.23L83.41 302.84L81.09 303.34L78.74 303.7L76.38 303.93L74 304L71.62 303.93L69.26 303.7L66.91 303.34L64.59 302.84L62.3 302.23L60.05 301.51L57.83 300.69L55.66 299.81L53.52 298.87L51.41 297.89L49.34 296.88L47.31 295.87L45.31 294.86L43.34 293.88L41.41 292.94L39.52 292.06L37.66 291.24L35.83 290.5L34.05 289.84L32.3 289.28L30.59 288.82L28.91 288.46L27.26 288.2L25.62 288.05L24 288L22.38 288.05L20.74 288.2L19.09 288.46L17.41 288.82L15.7 289.28L13.95 289.84L12.17 290.5L10.34 291.24L8.48 292.06L6.59 292.94L4.66 293.88L2.69 294.86L0.69 295.87L-1.34 296.88Z";
var BRAND_SWELL = "M-5.18 331.11L-3.2 330.5L-1.2 329.87L0.82 329.24L2.85 328.62L4.91 328.02L6.97 327.45L9.06 326.93L11.16 326.44L13.27 326.02L15.4 325.66L17.54 325.38L19.69 325.17L21.84 325.04L24 325L26.16 325.04L28.31 325.17L30.46 325.38L32.6 325.66L34.73 326.02L36.84 326.44L38.94 326.93L41.03 327.45L43.09 328.02L45.15 328.62L47.18 329.24L49.2 329.87L51.2 330.5L53.18 331.11L55.15 331.71L57.09 332.28L59.03 332.81L60.94 333.3L62.84 333.73L64.73 334.11L66.6 334.43L68.46 334.68L70.31 334.86L72.16 334.96L74 335L75.84 334.96L77.69 334.86L79.54 334.68L81.4 334.43L83.27 334.11L85.16 333.73L87.06 333.3L88.97 332.81L90.91 332.28L92.85 331.71L94.82 331.11L96.8 330.5L98.8 329.87L100.82 329.24L102.85 328.62L104.91 328.02L106.97 327.45L109.06 326.93L111.16 326.44L113.27 326.02L115.4 325.66L117.54 325.38L119.69 325.17L121.84 325.04L124 325L126.16 325.04L128.31 325.17L130.46 325.38L132.6 325.66L134.73 326.02L136.84 326.44L138.94 326.93L141.03 327.45L143.09 328.02L145.15 328.62L147.18 329.24L149.2 329.87L151.2 330.5L153.18 331.11L155.15 331.71L157.09 332.28L159.03 332.81L160.94 333.3L162.84 333.73L164.73 334.11L166.6 334.43L168.46 334.68L170.31 334.86L172.16 334.96L174 335L175.84 334.96L177.69 334.86L179.54 334.68L181.4 334.43L183.27 334.11L185.16 333.73L187.06 333.3L188.97 332.81L190.91 332.28L192.85 331.71L194.82 331.11L196.8 330.5L198.8 329.87L200.82 329.24L202.85 328.62L204.91 328.02L206.97 327.45L209.06 326.93L211.16 326.44L213.27 326.02L215.4 325.66L217.54 325.38L219.69 325.17L221.84 325.04L224 325L226.16 325.04L228.31 325.17L230.46 325.38L232.6 325.66L234.73 326.02L236.84 326.44L238.94 326.93L241.03 327.45L243.09 328.02L245.15 328.62L247.18 329.24L249.2 329.87L251.2 330.5L253.18 331.11L255.15 331.71L257.09 332.28L259.03 332.81L260.94 333.3L262.84 333.73L264.73 334.11L266.6 334.43L268.46 334.68L270.31 334.86L272.16 334.96L274 335L275.84 334.96L277.69 334.86L279.54 334.68L281.4 334.43L283.27 334.11L285.16 333.73L287.06 333.3L288.97 332.81L290.91 332.28L292.85 331.71L294.82 331.11L296.8 330.5L298.8 329.87L300.82 329.24L302.85 328.62L304.91 328.02L306.97 327.45L309.06 326.93L311.16 326.44L313.27 326.02L315.4 325.66L317.54 325.38L319.69 325.17L321.84 325.04L324 325L326.16 325.04L328.31 325.17L330.46 325.38L332.6 325.66L334.73 326.02L336.84 326.44L338.94 326.93L341.03 327.45L343.09 328.02L345.15 328.62L347.18 329.24L349.2 329.87L351.2 330.5L353.18 331.11L355.15 331.71L357.09 332.28L359.03 332.81L360.94 333.3L362.84 333.73L364.73 334.11L366.6 334.43L368.46 334.68L370.31 334.86L372.16 334.96L374 335L375.84 334.96L377.69 334.86L379.54 334.68L381.4 334.43L383.27 334.11L385.16 333.73L387.06 333.3L388.97 332.81L390.91 332.28L392.85 331.71L394.82 331.11L396.8 330.5L398.8 329.87L400.82 329.24L402.85 328.62L405.15 336.29L403.18 336.89L401.2 337.5L399.2 338.13L397.18 338.76L395.15 339.38L393.09 339.98L391.03 340.55L388.94 341.07L386.84 341.56L384.73 341.98L382.6 342.34L380.46 342.62L378.31 342.83L376.16 342.96L374 343L371.84 342.96L369.69 342.83L367.54 342.62L365.4 342.34L363.27 341.98L361.16 341.56L359.06 341.07L356.97 340.55L354.91 339.98L352.85 339.38L350.82 338.76L348.8 338.13L346.8 337.5L344.82 336.89L342.85 336.29L340.91 335.72L338.97 335.19L337.06 334.7L335.16 334.27L333.27 333.89L331.4 333.57L329.54 333.32L327.69 333.14L325.84 333.04L324 333L322.16 333.04L320.31 333.14L318.46 333.32L316.6 333.57L314.73 333.89L312.84 334.27L310.94 334.7L309.03 335.19L307.09 335.72L305.15 336.29L303.18 336.89L301.2 337.5L299.2 338.13L297.18 338.76L295.15 339.38L293.09 339.98L291.03 340.55L288.94 341.07L286.84 341.56L284.73 341.98L282.6 342.34L280.46 342.62L278.31 342.83L276.16 342.96L274 343L271.84 342.96L269.69 342.83L267.54 342.62L265.4 342.34L263.27 341.98L261.16 341.56L259.06 341.07L256.97 340.55L254.91 339.98L252.85 339.38L250.82 338.76L248.8 338.13L246.8 337.5L244.82 336.89L242.85 336.29L240.91 335.72L238.97 335.19L237.06 334.7L235.16 334.27L233.27 333.89L231.4 333.57L229.54 333.32L227.69 333.14L225.84 333.04L224 333L222.16 333.04L220.31 333.14L218.46 333.32L216.6 333.57L214.73 333.89L212.84 334.27L210.94 334.7L209.03 335.19L207.09 335.72L205.15 336.29L203.18 336.89L201.2 337.5L199.2 338.13L197.18 338.76L195.15 339.38L193.09 339.98L191.03 340.55L188.94 341.07L186.84 341.56L184.73 341.98L182.6 342.34L180.46 342.62L178.31 342.83L176.16 342.96L174 343L171.84 342.96L169.69 342.83L167.54 342.62L165.4 342.34L163.27 341.98L161.16 341.56L159.06 341.07L156.97 340.55L154.91 339.98L152.85 339.38L150.82 338.76L148.8 338.13L146.8 337.5L144.82 336.89L142.85 336.29L140.91 335.72L138.97 335.19L137.06 334.7L135.16 334.27L133.27 333.89L131.4 333.57L129.54 333.32L127.69 333.14L125.84 333.04L124 333L122.16 333.04L120.31 333.14L118.46 333.32L116.6 333.57L114.73 333.89L112.84 334.27L110.94 334.7L109.03 335.19L107.09 335.72L105.15 336.29L103.18 336.89L101.2 337.5L99.2 338.13L97.18 338.76L95.15 339.38L93.09 339.98L91.03 340.55L88.94 341.07L86.84 341.56L84.73 341.98L82.6 342.34L80.46 342.62L78.31 342.83L76.16 342.96L74 343L71.84 342.96L69.69 342.83L67.54 342.62L65.4 342.34L63.27 341.98L61.16 341.56L59.06 341.07L56.97 340.55L54.91 339.98L52.85 339.38L50.82 338.76L48.8 338.13L46.8 337.5L44.82 336.89L42.85 336.29L40.91 335.72L38.97 335.19L37.06 334.7L35.16 334.27L33.27 333.89L31.4 333.57L29.54 333.32L27.69 333.14L25.84 333.04L24 333L22.16 333.04L20.31 333.14L18.46 333.32L16.6 333.57L14.73 333.89L12.84 334.27L10.94 334.7L9.03 335.19L7.09 335.72L5.15 336.29L3.18 336.89L1.2 337.5L-0.8 338.13L-2.82 338.76ZM-4.63 367.72L-2.64 367.29L-0.64 366.85L1.37 366.41L3.39 365.98L5.41 365.57L7.45 365.18L9.5 364.81L11.55 364.48L13.62 364.19L15.68 363.95L17.76 363.76L19.84 363.61L21.92 363.53L24 363.5L26.08 363.53L28.16 363.61L30.24 363.76L32.32 363.95L34.38 364.19L36.45 364.48L38.5 364.81L40.55 365.18L42.59 365.57L44.61 365.98L46.63 366.41L48.64 366.85L50.64 367.29L52.63 367.72L54.61 368.15L56.59 368.55L58.55 368.93L60.5 369.27L62.45 369.58L64.38 369.86L66.32 370.08L68.24 370.26L70.16 370.39L72.08 370.47L74 370.5L75.92 370.47L77.84 370.39L79.76 370.26L81.68 370.08L83.62 369.86L85.55 369.58L87.5 369.27L89.45 368.93L91.41 368.55L93.39 368.15L95.37 367.72L97.36 367.29L99.36 366.85L101.37 366.41L103.39 365.98L105.41 365.57L107.45 365.18L109.5 364.81L111.55 364.48L113.62 364.19L115.68 363.95L117.76 363.76L119.84 363.61L121.92 363.53L124 363.5L126.08 363.53L128.16 363.61L130.24 363.76L132.32 363.95L134.38 364.19L136.45 364.48L138.5 364.81L140.55 365.18L142.59 365.57L144.61 365.98L146.63 366.41L148.64 366.85L150.64 367.29L152.63 367.72L154.61 368.15L156.59 368.55L158.55 368.93L160.5 369.27L162.45 369.58L164.38 369.86L166.32 370.08L168.24 370.26L170.16 370.39L172.08 370.47L174 370.5L175.92 370.47L177.84 370.39L179.76 370.26L181.68 370.08L183.62 369.86L185.55 369.58L187.5 369.27L189.45 368.93L191.41 368.55L193.39 368.15L195.37 367.72L197.36 367.29L199.36 366.85L201.37 366.41L203.39 365.98L205.41 365.57L207.45 365.18L209.5 364.81L211.55 364.48L213.62 364.19L215.68 363.95L217.76 363.76L219.84 363.61L221.92 363.53L224 363.5L226.08 363.53L228.16 363.61L230.24 363.76L232.32 363.95L234.38 364.19L236.45 364.48L238.5 364.81L240.55 365.18L242.59 365.57L244.61 365.98L246.63 366.41L248.64 366.85L250.64 367.29L252.63 367.72L254.61 368.15L256.59 368.55L258.55 368.93L260.5 369.27L262.45 369.58L264.38 369.86L266.32 370.08L268.24 370.26L270.16 370.39L272.08 370.47L274 370.5L275.92 370.47L277.84 370.39L279.76 370.26L281.68 370.08L283.62 369.86L285.55 369.58L287.5 369.27L289.45 368.93L291.41 368.55L293.39 368.15L295.37 367.72L297.36 367.29L299.36 366.85L301.37 366.41L303.39 365.98L305.41 365.57L307.45 365.18L309.5 364.81L311.55 364.48L313.62 364.19L315.68 363.95L317.76 363.76L319.84 363.61L321.92 363.53L324 363.5L326.08 363.53L328.16 363.61L330.24 363.76L332.32 363.95L334.38 364.19L336.45 364.48L338.5 364.81L340.55 365.18L342.59 365.57L344.61 365.98L346.63 366.41L348.64 366.85L350.64 367.29L352.63 367.72L354.61 368.15L356.59 368.55L358.55 368.93L360.5 369.27L362.45 369.58L364.38 369.86L366.32 370.08L368.24 370.26L370.16 370.39L372.08 370.47L374 370.5L375.92 370.47L377.84 370.39L379.76 370.26L381.68 370.08L383.62 369.86L385.55 369.58L387.5 369.27L389.45 368.93L391.41 368.55L393.39 368.15L395.37 367.72L397.36 367.29L399.36 366.85L401.37 366.41L403.39 365.98L404.61 371.85L402.63 372.28L400.64 372.71L398.64 373.15L396.63 373.59L394.61 374.02L392.59 374.43L390.55 374.82L388.5 375.19L386.45 375.52L384.38 375.81L382.32 376.05L380.24 376.24L378.16 376.39L376.08 376.47L374 376.5L371.92 376.47L369.84 376.39L367.76 376.24L365.68 376.05L363.62 375.81L361.55 375.52L359.5 375.19L357.45 374.82L355.41 374.43L353.39 374.02L351.37 373.59L349.36 373.15L347.36 372.71L345.37 372.28L343.39 371.85L341.41 371.45L339.45 371.07L337.5 370.73L335.55 370.42L333.62 370.14L331.68 369.92L329.76 369.74L327.84 369.61L325.92 369.53L324 369.5L322.08 369.53L320.16 369.61L318.24 369.74L316.32 369.92L314.38 370.14L312.45 370.42L310.5 370.73L308.55 371.07L306.59 371.45L304.61 371.85L302.63 372.28L300.64 372.71L298.64 373.15L296.63 373.59L294.61 374.02L292.59 374.43L290.55 374.82L288.5 375.19L286.45 375.52L284.38 375.81L282.32 376.05L280.24 376.24L278.16 376.39L276.08 376.47L274 376.5L271.92 376.47L269.84 376.39L267.76 376.24L265.68 376.05L263.62 375.81L261.55 375.52L259.5 375.19L257.45 374.82L255.41 374.43L253.39 374.02L251.37 373.59L249.36 373.15L247.36 372.71L245.37 372.28L243.39 371.85L241.41 371.45L239.45 371.07L237.5 370.73L235.55 370.42L233.62 370.14L231.68 369.92L229.76 369.74L227.84 369.61L225.92 369.53L224 369.5L222.08 369.53L220.16 369.61L218.24 369.74L216.32 369.92L214.38 370.14L212.45 370.42L210.5 370.73L208.55 371.07L206.59 371.45L204.61 371.85L202.63 372.28L200.64 372.71L198.64 373.15L196.63 373.59L194.61 374.02L192.59 374.43L190.55 374.82L188.5 375.19L186.45 375.52L184.38 375.81L182.32 376.05L180.24 376.24L178.16 376.39L176.08 376.47L174 376.5L171.92 376.47L169.84 376.39L167.76 376.24L165.68 376.05L163.62 375.81L161.55 375.52L159.5 375.19L157.45 374.82L155.41 374.43L153.39 374.02L151.37 373.59L149.36 373.15L147.36 372.71L145.37 372.28L143.39 371.85L141.41 371.45L139.45 371.07L137.5 370.73L135.55 370.42L133.62 370.14L131.68 369.92L129.76 369.74L127.84 369.61L125.92 369.53L124 369.5L122.08 369.53L120.16 369.61L118.24 369.74L116.32 369.92L114.38 370.14L112.45 370.42L110.5 370.73L108.55 371.07L106.59 371.45L104.61 371.85L102.63 372.28L100.64 372.71L98.64 373.15L96.63 373.59L94.61 374.02L92.59 374.43L90.55 374.82L88.5 375.19L86.45 375.52L84.38 375.81L82.32 376.05L80.24 376.24L78.16 376.39L76.08 376.47L74 376.5L71.92 376.47L69.84 376.39L67.76 376.24L65.68 376.05L63.62 375.81L61.55 375.52L59.5 375.19L57.45 374.82L55.41 374.43L53.39 374.02L51.37 373.59L49.36 373.15L47.36 372.71L45.37 372.28L43.39 371.85L41.41 371.45L39.45 371.07L37.5 370.73L35.55 370.42L33.62 370.14L31.68 369.92L29.76 369.74L27.84 369.61L25.92 369.53L24 369.5L22.08 369.53L20.16 369.61L18.24 369.74L16.32 369.92L14.38 370.14L12.45 370.42L10.5 370.73L8.55 371.07L6.59 371.45L4.61 371.85L2.63 372.28L0.64 372.71L-1.36 373.15L-3.37 373.59Z";
var SEA = "M-4 291.5L-2 290.5L0 289.5L2 288.5L4 287.53L6 286.59L8 285.71L10 284.9L12 284.17L14 283.53L16 282.99L18 282.56L20 282.25L22 282.06L24 282L26 282.06L28 282.25L30 282.56L32 282.99L34 283.53L36 284.17L38 284.9L40 285.71L42 286.59L44 287.53L46 288.5L48 289.5L50 290.5L52 291.5L54 292.47L56 293.41L58 294.29L60 295.1L62 295.83L64 296.47L66 297.01L68 297.44L70 297.75L72 297.94L74 298L76 297.94L78 297.75L80 297.44L82 297.01L84 296.47L86 295.83L88 295.1L90 294.29L92 293.41L94 292.47L96 291.5L98 290.5L100 289.5L102 288.5L104 287.53L106 286.59L108 285.71L110 284.9L112 284.17L114 283.53L116 282.99L118 282.56L120 282.25L122 282.06L124 282L126 282.06L128 282.25L130 282.56L132 282.99L134 283.53L136 284.17L138 284.9L140 285.71L142 286.59L144 287.53L146 288.5L148 289.5L150 290.5L152 291.5L154 292.47L156 293.41L158 294.29L160 295.1L162 295.83L164 296.47L166 297.01L168 297.44L170 297.75L172 297.94L174 298L176 297.94L178 297.75L180 297.44L182 297.01L184 296.47L186 295.83L188 295.1L190 294.29L192 293.41L194 292.47L196 291.5L198 290.5L200 289.5L202 288.5L204 287.53L206 286.59L208 285.71L210 284.9L212 284.17L214 283.53L216 282.99L218 282.56L220 282.25L222 282.06L224 282L226 282.06L228 282.25L230 282.56L232 282.99L234 283.53L236 284.17L238 284.9L240 285.71L242 286.59L244 287.53L246 288.5L248 289.5L250 290.5L252 291.5L254 292.47L256 293.41L258 294.29L260 295.1L262 295.83L264 296.47L266 297.01L268 297.44L270 297.75L272 297.94L274 298L276 297.94L278 297.75L280 297.44L282 297.01L284 296.47L286 295.83L288 295.1L290 294.29L292 293.41L294 292.47L296 291.5L298 290.5L300 289.5L302 288.5L304 287.53L306 286.59L308 285.71L310 284.9L312 284.17L314 283.53L316 282.99L318 282.56L320 282.25L322 282.06L324 282L326 282.06L328 282.25L330 282.56L332 282.99L334 283.53L336 284.17L338 284.9L340 285.71L342 286.59L344 287.53L346 288.5L348 289.5L350 290.5L352 291.5L354 292.47L356 293.41L358 294.29L360 295.1L362 295.83L364 296.47L366 297.01L368 297.44L370 297.75L372 297.94L374 298L376 297.94L378 297.75L380 297.44L382 297.01L384 296.47L386 295.83L388 295.1L390 294.29L392 293.41L394 292.47L396 291.5L398 290.5L400 289.5L402 288.5L404 287.53L404 404L-4 404Z";
var BRAND_INDIGO = "#1E2F6D";
var BRAND_PAPER = "#F8F5EF";
var SEA_DEEP = "#111A42";
var SEA_SURFACE = "#7B91D4";
var SEA_SWELL = "#2B3F86";
function BrandMark({ size = 32, title }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 400 400",
      role: title ? "img" : void 0,
      "aria-label": title,
      "aria-hidden": title ? void 0 : true,
      style: { flex: "none", borderRadius: "22%", display: "block" },
      children: [
        title && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("title", { children: title }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { width: "400", height: "400", fill: BRAND_INDIGO }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: BRAND_PAPER, d: BRAND_FLUKE }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: SEA_DEEP, d: SEA }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: SEA_SURFACE, d: BRAND_SURFACE }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: SEA_SWELL, d: BRAND_SWELL })
      ]
    }
  );
}

// ui/src/icons.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var PATHS = {
  check: "M20 6 9 17l-5-5",
  alert: "M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
  info: "M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
  refresh: "M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5",
  external: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  layers: "m12 2 10 5-10 5L2 7l10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  cpu: "M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 9h6v6H9z",
  puzzle: "M19.44 12.06a2.5 2.5 0 1 0-3.5-3.5L15 9.5V5a1 1 0 0 0-1-1h-4.5l.94-.94a2.5 2.5 0 1 0-3.5 3.5L7.5 7.5H3a1 1 0 0 0-1 1V13l.94-.94a2.5 2.5 0 1 1 3.5 3.5L5.5 16.5H10a1 1 0 0 0 1-1V20l.94-.94a2.5 2.5 0 1 1 3.5 3.5l-.94.94H19a1 1 0 0 0 1-1v-4.5l.94.94a2.5 2.5 0 1 0 3.5-3.5z",
  key: "m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4",
  server: "M4 2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM4 14h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zM6 6h.01M6 18h.01",
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 18 6-6-6-6",
  arrowRight: "M5 12h14m-7-7 7 7-7 7",
  text: "M4 7V4h16v3M12 4v16m-3 0h6",
  image: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 17l5-5 4 4 4-5 5 5M10 8a2 2 0 1 0-4 0 2 2 0 0 0 4 0z",
  monitor: "M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 21h8M12 17v4",
  plus: "M12 5v14M5 12h14",
  session: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  smartphone: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01",
  sync: "M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"
};
function Icon({ name, size = 16, label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.75,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      role: label ? "img" : void 0,
      "aria-label": label,
      "aria-hidden": label ? void 0 : true,
      style: { flex: "none", display: "block" },
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: PATHS[name] })
    }
  );
}

// ui/src/controls.tsx
var import_react2 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var Button = (0, import_react2.forwardRef)(function Button2({ variant = "secondary", size = "md", icon, trailingIcon, block = false, busy = false, disabled, className, children, type = "button", ...props }, ref) {
  const iconSize = size === "sm" ? 14 : 16;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "button",
    {
      ...props,
      ref,
      type,
      className: join("twui-btn", className),
      "data-variant": variant,
      "data-size": size,
      "data-block": block || void 0,
      "data-icon-only": !children || void 0,
      disabled: disabled || busy,
      "aria-busy": busy || void 0,
      children: [
        busy ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Spinner, {}) : icon && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: icon, size: iconSize }),
        children,
        trailingIcon && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: trailingIcon, size: iconSize - 2 })
      ]
    }
  );
});
var Input = (0, import_react2.forwardRef)(
  function Input2({ className, size = "md", ...props }, ref) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { ...props, ref, "data-size": size, className: join("twui-input", className) });
  }
);
function Field({ label, hint, error, htmlFor, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "twui-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("label", { className: "twui-label", htmlFor, children: label }),
    children,
    error ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "twui-hint", "data-tone": "danger", role: "alert", children: error }) : hint && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "twui-hint", children: hint })
  ] });
}
function Badge({ tone = "neutral", dot = false, outline = false, title, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "twui-badge", "data-tone": tone, "data-outline": outline || void 0, title, children: [
    dot && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "twui-badge-dot", "aria-hidden": "true" }),
    children
  ] });
}
function Spinner({ label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "twui-spinner", role: label ? "status" : void 0, "aria-label": label, "aria-hidden": label ? void 0 : true });
}
function Skeleton({ width = "100%", height = 14 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "twui-skeleton", "aria-hidden": "true", style: { display: "block", width, height } });
}
function Tabs({ items, value, onChange, label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "twui-tabs", role: "tablist", "aria-label": label, children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "button",
    {
      type: "button",
      role: "tab",
      className: "twui-tab",
      "aria-selected": item.id === value,
      onClick: () => onChange(item.id),
      children: [
        item.label,
        item.count !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "twui-tab-count", children: item.count })
      ]
    },
    item.id
  )) });
}
function Monogram({ text, size = 32 }) {
  const letters = Array.from(text.trim()).slice(0, 2).join("").toUpperCase() || "?";
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "twui-monogram", "aria-hidden": "true", style: { width: size, height: size, fontSize: Math.round(size * 0.4) }, children: letters });
}

// ui/src/layout.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function Panel({ header, nav, footer, children, label, centered = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(UIRoot, { className: "twui-panel", role: "region", "aria-label": label, "data-centered": centered || void 0, children: [
    header && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("header", { className: "twui-panel-header", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-panel-column", children: header }) }),
    nav && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-panel-nav", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-panel-column", children: nav }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-panel-body", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-panel-column twui-panel-content", children }) }),
    footer && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("footer", { className: "twui-panel-footer", children: footer })
  ] });
}
function Card({ children, padding = 20 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-card", style: { padding }, children });
}
function Item({ icon, media, title, subtitle, description, tags, actions, notice, children, onActivate }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("article", { className: "twui-item", "data-clickable": onActivate ? true : void 0, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "twui-item-main", "data-no-icon": icon || media ? void 0 : true, children: [
      media ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "twui-tile twui-tile-media", children: media }) : icon && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "twui-tile", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: icon, size: 18 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { minWidth: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("h3", { className: "twui-item-title", children: [
          onActivate ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "twui-item-trigger", onClick: onActivate, children: title }) : title,
          subtitle && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "twui-item-subtitle", children: subtitle })
        ] }),
        description && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "twui-item-desc", children: description }),
        tags && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-item-tags", children: tags })
      ] }),
      actions && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-item-actions", children: actions }),
      notice && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-item-notice", children: notice })
    ] }),
    children
  ] });
}
function ItemBody({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-item-body", children });
}
var toneIcon = { warning: "alert", danger: "alert", success: "check" };
function Notice({ tone = "neutral", children }) {
  const icon = toneIcon[tone];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { className: "twui-notice", "data-tone": tone, children: [
    icon && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: icon, size: 14 }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children })
  ] });
}
function Banner({ tone = "neutral", title, children, action }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "twui-banner", "data-tone": tone, role: tone === "danger" ? "alert" : "status", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "twui-banner-icon", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: tone === "neutral" ? "info" : "alert", size: 16 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "twui-banner-body", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "twui-banner-title", children: title }),
      children && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "twui-banner-text", children })
    ] }),
    action
  ] });
}
function DefinitionList({ items }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dl", { className: "twui-dl", children: items.map(([term, value], i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "contents" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: term }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dd", { children: value })
  ] }, i)) });
}
function Confirm({ title, description, confirmLabel, cancelLabel, onConfirm, onCancel, busy = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "twui-confirm", role: "group", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "twui-confirm-title", children: title }),
    description && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "twui-muted", children: description }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "twui-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Button, { variant: "primary", busy, onClick: onConfirm, children: confirmLabel }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Button, { variant: "ghost", disabled: busy, onClick: onCancel, children: cancelLabel })
    ] })
  ] });
}
function EmptyState({ icon = "info", title, children, action }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "twui-empty", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "twui-empty-icon", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: icon, size: 20 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "twui-empty-title", children: title }),
    children && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children }),
    action
  ] });
}
function Toast({ tone = "neutral", children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "twui-toast", "data-tone": tone, role: tone === "danger" ? "alert" : "status", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: tone === "danger" ? "alert" : "check", size: 16 }),
    children
  ] });
}

// ui/src/select.tsx
var import_react3 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
function Select({ id, label, value, options, onChange, onActivate, disabled = false }) {
  const generated = (0, import_react3.useId)();
  const listId = `${id ?? generated}-options`;
  const root = (0, import_react3.useRef)(null);
  const trigger = (0, import_react3.useRef)(null);
  const list = (0, import_react3.useRef)(null);
  const [open2, setOpen] = (0, import_react3.useState)(false);
  const [active, setActive] = (0, import_react3.useState)(0);
  const [side, setSide] = (0, import_react3.useState)("bottom");
  const [height, setHeight] = (0, import_react3.useState)(288);
  const search = (0, import_react3.useRef)({ text: "", at: 0 });
  const selected = options.findIndex((o) => o.value === value);
  const close = (focus = false) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };
  const move = (from, direction) => {
    for (let step = 1; step <= options.length; step++) {
      const next = (from + step * direction + options.length) % options.length;
      if (!options[next].disabled) {
        setActive(next);
        return;
      }
    }
  };
  const show = (edge) => {
    if (disabled || !options.some((o) => !o.disabled)) return;
    const first = options.findIndex((o) => !o.disabled), last = options.map((o) => !o.disabled).lastIndexOf(true);
    const next = edge === "first" ? first : edge === "last" ? last : selected >= 0 && !options[selected].disabled ? selected : first;
    setActive(next);
    setOpen(true);
  };
  (0, import_react3.useEffect)(() => {
    if (!open2) return;
    const rect = root.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom, above = rect.top;
      const top = below < 250 && above > below;
      setSide(top ? "top" : "bottom");
      setHeight(Math.max(48, Math.min(288, (top ? above : below) - 12)));
    }
    list.current?.focus();
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open2]);
  (0, import_react3.useEffect)(() => {
    if (open2) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, open2]);
  (0, import_react3.useEffect)(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  (0, import_react3.useEffect)(() => {
    if (!open2 || options[active] && !options[active].disabled) return;
    const next = selected >= 0 && !options[selected].disabled ? selected : options.findIndex((o) => !o.disabled);
    if (next < 0) close(true);
    else setActive(next);
  }, [options, selected, active, open2]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "twui-select", "data-split": !!onActivate || void 0, role: onActivate ? "group" : void 0, "aria-label": onActivate ? label : void 0, ref: root, onBlur: (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) close();
  }, children: [
    onActivate && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "twui-select-primary", disabled: disabled || selected < 0 || options[selected]?.disabled, onClick: () => {
      close();
      onActivate();
    }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: options[selected]?.label ?? label }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "button",
      {
        ref: trigger,
        id,
        type: "button",
        className: "twui-select-trigger",
        "aria-label": `${label}：${options[selected]?.label ?? ""}`,
        "aria-haspopup": "listbox",
        "aria-expanded": open2,
        "aria-controls": open2 ? listId : void 0,
        disabled,
        onClick: () => open2 ? close(true) : show(),
        onKeyDown: (e) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            show(e.key === "Home" ? "first" : e.key === "End" ? "last" : void 0);
          }
        },
        children: [
          !onActivate && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: options[selected]?.label ?? label }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "chevronDown", size: 14 })
        ]
      }
    ),
    open2 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        ref: list,
        id: listId,
        role: "listbox",
        "aria-label": label,
        tabIndex: -1,
        className: "twui-select-menu",
        "data-side": side,
        style: { maxHeight: height },
        "aria-activedescendant": `${listId}-${active}`,
        onKeyDown: (e) => {
          if (e.key === "Tab") {
            close(true);
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close(true);
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            move(active, e.key === "ArrowDown" ? 1 : -1);
          } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            move(e.key === "Home" ? options.length - 1 : 0, e.key === "Home" ? 1 : -1);
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const option = options[active];
            if (option && !option.disabled) {
              onChange(option.value);
              close(true);
            }
          } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const text = (Date.now() - search.current.at < 700 ? search.current.text : "") + e.key.toLocaleLowerCase();
            search.current = { text, at: Date.now() };
            const next = options.findIndex((o) => !o.disabled && o.label.toLocaleLowerCase().startsWith(text));
            if (next >= 0) setActive(next);
          }
        },
        children: options.map((option, index) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "div",
          {
            id: `${listId}-${index}`,
            role: "option",
            "aria-selected": option.value === value,
            "aria-disabled": option.disabled || void 0,
            "data-index": index,
            "data-active": index === active || void 0,
            className: "twui-select-option",
            onPointerMove: () => {
              if (!option.disabled) setActive(index);
            },
            onMouseDown: (e) => e.preventDefault(),
            onClick: () => {
              if (!option.disabled) {
                onChange(option.value);
                close(true);
              }
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: option.label }),
                option.description && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("small", { children: option.description })
              ] }),
              option.value === value && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "check", size: 14 })
            ]
          },
          option.value
        ))
      }
    )
  ] });
}

// src/web/TeamworkPanel.tsx
var import_react5 = require("react");

// node_modules/.pnpm/qrcode-generator@2.0.4/node_modules/qrcode-generator/dist/qrcode.mjs
var qrcode = function(typeNumber, errorCorrectionLevel) {
  const PAD0 = 236;
  const PAD1 = 17;
  let _typeNumber = typeNumber;
  const _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
  let _modules = null;
  let _moduleCount = 0;
  let _dataCache = null;
  const _dataList = [];
  const _this = {};
  const makeImpl = function(test, maskPattern) {
    _moduleCount = _typeNumber * 4 + 17;
    _modules = (function(moduleCount) {
      const modules = new Array(moduleCount);
      for (let row = 0; row < moduleCount; row += 1) {
        modules[row] = new Array(moduleCount);
        for (let col = 0; col < moduleCount; col += 1) {
          modules[row][col] = null;
        }
      }
      return modules;
    })(_moduleCount);
    setupPositionProbePattern(0, 0);
    setupPositionProbePattern(_moduleCount - 7, 0);
    setupPositionProbePattern(0, _moduleCount - 7);
    setupPositionAdjustPattern();
    setupTimingPattern();
    setupTypeInfo(test, maskPattern);
    if (_typeNumber >= 7) {
      setupTypeNumber(test);
    }
    if (_dataCache == null) {
      _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
    }
    mapData(_dataCache, maskPattern);
  };
  const setupPositionProbePattern = function(row, col) {
    for (let r = -1; r <= 7; r += 1) {
      if (row + r <= -1 || _moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c += 1) {
        if (col + c <= -1 || _moduleCount <= col + c) continue;
        if (0 <= r && r <= 6 && (c == 0 || c == 6) || 0 <= c && c <= 6 && (r == 0 || r == 6) || 2 <= r && r <= 4 && 2 <= c && c <= 4) {
          _modules[row + r][col + c] = true;
        } else {
          _modules[row + r][col + c] = false;
        }
      }
    }
  };
  const getBestMaskPattern = function() {
    let minLostPoint = 0;
    let pattern = 0;
    for (let i = 0; i < 8; i += 1) {
      makeImpl(true, i);
      const lostPoint = QRUtil.getLostPoint(_this);
      if (i == 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint;
        pattern = i;
      }
    }
    return pattern;
  };
  const setupTimingPattern = function() {
    for (let r = 8; r < _moduleCount - 8; r += 1) {
      if (_modules[r][6] != null) {
        continue;
      }
      _modules[r][6] = r % 2 == 0;
    }
    for (let c = 8; c < _moduleCount - 8; c += 1) {
      if (_modules[6][c] != null) {
        continue;
      }
      _modules[6][c] = c % 2 == 0;
    }
  };
  const setupPositionAdjustPattern = function() {
    const pos = QRUtil.getPatternPosition(_typeNumber);
    for (let i = 0; i < pos.length; i += 1) {
      for (let j = 0; j < pos.length; j += 1) {
        const row = pos[i];
        const col = pos[j];
        if (_modules[row][col] != null) {
          continue;
        }
        for (let r = -2; r <= 2; r += 1) {
          for (let c = -2; c <= 2; c += 1) {
            if (r == -2 || r == 2 || c == -2 || c == 2 || r == 0 && c == 0) {
              _modules[row + r][col + c] = true;
            } else {
              _modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  };
  const setupTypeNumber = function(test) {
    const bits = QRUtil.getBCHTypeNumber(_typeNumber);
    for (let i = 0; i < 18; i += 1) {
      const mod = !test && (bits >> i & 1) == 1;
      _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
    }
    for (let i = 0; i < 18; i += 1) {
      const mod = !test && (bits >> i & 1) == 1;
      _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  };
  const setupTypeInfo = function(test, maskPattern) {
    const data = _errorCorrectionLevel << 3 | maskPattern;
    const bits = QRUtil.getBCHTypeInfo(data);
    for (let i = 0; i < 15; i += 1) {
      const mod = !test && (bits >> i & 1) == 1;
      if (i < 6) {
        _modules[i][8] = mod;
      } else if (i < 8) {
        _modules[i + 1][8] = mod;
      } else {
        _modules[_moduleCount - 15 + i][8] = mod;
      }
    }
    for (let i = 0; i < 15; i += 1) {
      const mod = !test && (bits >> i & 1) == 1;
      if (i < 8) {
        _modules[8][_moduleCount - i - 1] = mod;
      } else if (i < 9) {
        _modules[8][15 - i - 1 + 1] = mod;
      } else {
        _modules[8][15 - i - 1] = mod;
      }
    }
    _modules[_moduleCount - 8][8] = !test;
  };
  const mapData = function(data, maskPattern) {
    let inc = -1;
    let row = _moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    const maskFunc = QRUtil.getMaskFunction(maskPattern);
    for (let col = _moduleCount - 1; col > 0; col -= 2) {
      if (col == 6) col -= 1;
      while (true) {
        for (let c = 0; c < 2; c += 1) {
          if (_modules[row][col - c] == null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = (data[byteIndex] >>> bitIndex & 1) == 1;
            }
            const mask = maskFunc(row, col - c);
            if (mask) {
              dark = !dark;
            }
            _modules[row][col - c] = dark;
            bitIndex -= 1;
            if (bitIndex == -1) {
              byteIndex += 1;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || _moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  };
  const createBytes = function(buffer, rsBlocks) {
    let offset = 0;
    let maxDcCount = 0;
    let maxEcCount = 0;
    const dcdata = new Array(rsBlocks.length);
    const ecdata = new Array(rsBlocks.length);
    for (let r = 0; r < rsBlocks.length; r += 1) {
      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;
      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);
      dcdata[r] = new Array(dcCount);
      for (let i = 0; i < dcdata[r].length; i += 1) {
        dcdata[r][i] = 255 & buffer.getBuffer()[i + offset];
      }
      offset += dcCount;
      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
      const rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);
      const modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.getLength() - 1);
      for (let i = 0; i < ecdata[r].length; i += 1) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0;
      }
    }
    let totalCodeCount = 0;
    for (let i = 0; i < rsBlocks.length; i += 1) {
      totalCodeCount += rsBlocks[i].totalCount;
    }
    const data = new Array(totalCodeCount);
    let index = 0;
    for (let i = 0; i < maxDcCount; i += 1) {
      for (let r = 0; r < rsBlocks.length; r += 1) {
        if (i < dcdata[r].length) {
          data[index] = dcdata[r][i];
          index += 1;
        }
      }
    }
    for (let i = 0; i < maxEcCount; i += 1) {
      for (let r = 0; r < rsBlocks.length; r += 1) {
        if (i < ecdata[r].length) {
          data[index] = ecdata[r][i];
          index += 1;
        }
      }
    }
    return data;
  };
  const createData = function(typeNumber2, errorCorrectionLevel2, dataList) {
    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, errorCorrectionLevel2);
    const buffer = qrBitBuffer();
    for (let i = 0; i < dataList.length; i += 1) {
      const data = dataList[i];
      buffer.put(data.getMode(), 4);
      buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
      data.write(buffer);
    }
    let totalDataCount = 0;
    for (let i = 0; i < rsBlocks.length; i += 1) {
      totalDataCount += rsBlocks[i].dataCount;
    }
    if (buffer.getLengthInBits() > totalDataCount * 8) {
      throw "code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")";
    }
    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
      buffer.put(0, 4);
    }
    while (buffer.getLengthInBits() % 8 != 0) {
      buffer.putBit(false);
    }
    while (true) {
      if (buffer.getLengthInBits() >= totalDataCount * 8) {
        break;
      }
      buffer.put(PAD0, 8);
      if (buffer.getLengthInBits() >= totalDataCount * 8) {
        break;
      }
      buffer.put(PAD1, 8);
    }
    return createBytes(buffer, rsBlocks);
  };
  _this.addData = function(data, mode) {
    mode = mode || "Byte";
    let newData = null;
    switch (mode) {
      case "Numeric":
        newData = qrNumber(data);
        break;
      case "Alphanumeric":
        newData = qrAlphaNum(data);
        break;
      case "Byte":
        newData = qr8BitByte(data);
        break;
      case "Kanji":
        newData = qrKanji(data);
        break;
      default:
        throw "mode:" + mode;
    }
    _dataList.push(newData);
    _dataCache = null;
  };
  _this.isDark = function(row, col) {
    if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
      throw row + "," + col;
    }
    return _modules[row][col];
  };
  _this.getModuleCount = function() {
    return _moduleCount;
  };
  _this.make = function() {
    if (_typeNumber < 1) {
      let typeNumber2 = 1;
      for (; typeNumber2 < 40; typeNumber2++) {
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, _errorCorrectionLevel);
        const buffer = qrBitBuffer();
        for (let i = 0; i < _dataList.length; i++) {
          const data = _dataList[i];
          buffer.put(data.getMode(), 4);
          buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
          data.write(buffer);
        }
        let totalDataCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) {
          totalDataCount += rsBlocks[i].dataCount;
        }
        if (buffer.getLengthInBits() <= totalDataCount * 8) {
          break;
        }
      }
      _typeNumber = typeNumber2;
    }
    makeImpl(false, getBestMaskPattern());
  };
  _this.createTableTag = function(cellSize, margin) {
    cellSize = cellSize || 2;
    margin = typeof margin == "undefined" ? cellSize * 4 : margin;
    let qrHtml = "";
    qrHtml += '<table style="';
    qrHtml += " border-width: 0px; border-style: none;";
    qrHtml += " border-collapse: collapse;";
    qrHtml += " padding: 0px; margin: " + margin + "px;";
    qrHtml += '">';
    qrHtml += "<tbody>";
    for (let r = 0; r < _this.getModuleCount(); r += 1) {
      qrHtml += "<tr>";
      for (let c = 0; c < _this.getModuleCount(); c += 1) {
        qrHtml += '<td style="';
        qrHtml += " border-width: 0px; border-style: none;";
        qrHtml += " border-collapse: collapse;";
        qrHtml += " padding: 0px; margin: 0px;";
        qrHtml += " width: " + cellSize + "px;";
        qrHtml += " height: " + cellSize + "px;";
        qrHtml += " background-color: ";
        qrHtml += _this.isDark(r, c) ? "#000000" : "#ffffff";
        qrHtml += ";";
        qrHtml += '"/>';
      }
      qrHtml += "</tr>";
    }
    qrHtml += "</tbody>";
    qrHtml += "</table>";
    return qrHtml;
  };
  _this.createSvgTag = function(cellSize, margin, alt, title) {
    let opts = {};
    if (typeof arguments[0] == "object") {
      opts = arguments[0];
      cellSize = opts.cellSize;
      margin = opts.margin;
      alt = opts.alt;
      title = opts.title;
    }
    cellSize = cellSize || 2;
    margin = typeof margin == "undefined" ? cellSize * 4 : margin;
    alt = typeof alt === "string" ? { text: alt } : alt || {};
    alt.text = alt.text || null;
    alt.id = alt.text ? alt.id || "qrcode-description" : null;
    title = typeof title === "string" ? { text: title } : title || {};
    title.text = title.text || null;
    title.id = title.text ? title.id || "qrcode-title" : null;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    let c, mc, r, mr, qrSvg = "", rect;
    rect = "l" + cellSize + ",0 0," + cellSize + " -" + cellSize + ",0 0,-" + cellSize + "z ";
    qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
    qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : "";
    qrSvg += ' viewBox="0 0 ' + size + " " + size + '" ';
    qrSvg += ' preserveAspectRatio="xMinYMin meet"';
    qrSvg += title.text || alt.text ? ' role="img" aria-labelledby="' + escapeXml([title.id, alt.id].join(" ").trim()) + '"' : "";
    qrSvg += ">";
    qrSvg += title.text ? '<title id="' + escapeXml(title.id) + '">' + escapeXml(title.text) + "</title>" : "";
    qrSvg += alt.text ? '<description id="' + escapeXml(alt.id) + '">' + escapeXml(alt.text) + "</description>" : "";
    qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
    qrSvg += '<path d="';
    for (r = 0; r < _this.getModuleCount(); r += 1) {
      mr = r * cellSize + margin;
      for (c = 0; c < _this.getModuleCount(); c += 1) {
        if (_this.isDark(r, c)) {
          mc = c * cellSize + margin;
          qrSvg += "M" + mc + "," + mr + rect;
        }
      }
    }
    qrSvg += '" stroke="transparent" fill="black"/>';
    qrSvg += "</svg>";
    return qrSvg;
  };
  _this.createDataURL = function(cellSize, margin) {
    cellSize = cellSize || 2;
    margin = typeof margin == "undefined" ? cellSize * 4 : margin;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    const min = margin;
    const max = size - margin;
    return createDataURL(size, size, function(x, y) {
      if (min <= x && x < max && min <= y && y < max) {
        const c = Math.floor((x - min) / cellSize);
        const r = Math.floor((y - min) / cellSize);
        return _this.isDark(r, c) ? 0 : 1;
      } else {
        return 1;
      }
    });
  };
  _this.createImgTag = function(cellSize, margin, alt) {
    cellSize = cellSize || 2;
    margin = typeof margin == "undefined" ? cellSize * 4 : margin;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    let img = "";
    img += "<img";
    img += ' src="';
    img += _this.createDataURL(cellSize, margin);
    img += '"';
    img += ' width="';
    img += size;
    img += '"';
    img += ' height="';
    img += size;
    img += '"';
    if (alt) {
      img += ' alt="';
      img += escapeXml(alt);
      img += '"';
    }
    img += "/>";
    return img;
  };
  const escapeXml = function(s) {
    let escaped = "";
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charAt(i);
      switch (c) {
        case "<":
          escaped += "&lt;";
          break;
        case ">":
          escaped += "&gt;";
          break;
        case "&":
          escaped += "&amp;";
          break;
        case '"':
          escaped += "&quot;";
          break;
        default:
          escaped += c;
          break;
      }
    }
    return escaped;
  };
  const _createHalfASCII = function(margin) {
    const cellSize = 1;
    margin = typeof margin == "undefined" ? cellSize * 2 : margin;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    const min = margin;
    const max = size - margin;
    let y, x, r1, r2, p;
    const blocks = {
      "██": "█",
      "█ ": "▀",
      " █": "▄",
      "  ": " "
    };
    const blocksLastLineNoMargin = {
      "██": "▀",
      "█ ": "▀",
      " █": " ",
      "  ": " "
    };
    let ascii = "";
    for (y = 0; y < size; y += 2) {
      r1 = Math.floor((y - min) / cellSize);
      r2 = Math.floor((y + 1 - min) / cellSize);
      for (x = 0; x < size; x += 1) {
        p = "█";
        if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
          p = " ";
        }
        if (min <= x && x < max && min <= y + 1 && y + 1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
          p += " ";
        } else {
          p += "█";
        }
        ascii += margin < 1 && y + 1 >= max ? blocksLastLineNoMargin[p] : blocks[p];
      }
      ascii += "\n";
    }
    if (size % 2 && margin > 0) {
      return ascii.substring(0, ascii.length - size - 1) + Array(size + 1).join("▀");
    }
    return ascii.substring(0, ascii.length - 1);
  };
  _this.createASCII = function(cellSize, margin) {
    cellSize = cellSize || 1;
    if (cellSize < 2) {
      return _createHalfASCII(margin);
    }
    cellSize -= 1;
    margin = typeof margin == "undefined" ? cellSize * 2 : margin;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    const min = margin;
    const max = size - margin;
    let y, x, r, p;
    const white = Array(cellSize + 1).join("██");
    const black = Array(cellSize + 1).join("  ");
    let ascii = "";
    let line = "";
    for (y = 0; y < size; y += 1) {
      r = Math.floor((y - min) / cellSize);
      line = "";
      for (x = 0; x < size; x += 1) {
        p = 1;
        if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
          p = 0;
        }
        line += p ? white : black;
      }
      for (r = 0; r < cellSize; r += 1) {
        ascii += line + "\n";
      }
    }
    return ascii.substring(0, ascii.length - 1);
  };
  _this.renderTo2dContext = function(context, cellSize) {
    cellSize = cellSize || 2;
    const length = _this.getModuleCount();
    for (let row = 0; row < length; row++) {
      for (let col = 0; col < length; col++) {
        context.fillStyle = _this.isDark(row, col) ? "black" : "white";
        context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  };
  return _this;
};
qrcode.stringToBytes = function(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    bytes.push(c & 255);
  }
  return bytes;
};
qrcode.createStringToBytes = function(unicodeData, numChars) {
  const unicodeMap = (function() {
    const bin = base64DecodeInputStream(unicodeData);
    const read = function() {
      const b = bin.read();
      if (b == -1) throw "eof";
      return b;
    };
    let count = 0;
    const unicodeMap2 = {};
    while (true) {
      const b0 = bin.read();
      if (b0 == -1) break;
      const b1 = read();
      const b2 = read();
      const b3 = read();
      const k = String.fromCharCode(b0 << 8 | b1);
      const v = b2 << 8 | b3;
      unicodeMap2[k] = v;
      count += 1;
    }
    if (count != numChars) {
      throw count + " != " + numChars;
    }
    return unicodeMap2;
  })();
  const unknownChar = "?".charCodeAt(0);
  return function(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i);
      if (c < 128) {
        bytes.push(c);
      } else {
        const b = unicodeMap[s.charAt(i)];
        if (typeof b == "number") {
          if ((b & 255) == b) {
            bytes.push(b);
          } else {
            bytes.push(b >>> 8);
            bytes.push(b & 255);
          }
        } else {
          bytes.push(unknownChar);
        }
      }
    }
    return bytes;
  };
};
var QRMode = {
  MODE_NUMBER: 1 << 0,
  MODE_ALPHA_NUM: 1 << 1,
  MODE_8BIT_BYTE: 1 << 2,
  MODE_KANJI: 1 << 3
};
var QRErrorCorrectionLevel = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2
};
var QRMaskPattern = {
  PATTERN000: 0,
  PATTERN001: 1,
  PATTERN010: 2,
  PATTERN011: 3,
  PATTERN100: 4,
  PATTERN101: 5,
  PATTERN110: 6,
  PATTERN111: 7
};
var QRUtil = (function() {
  const PATTERN_POSITION_TABLE = [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
    [6, 26, 48, 70],
    [6, 26, 50, 74],
    [6, 30, 54, 78],
    [6, 30, 56, 82],
    [6, 30, 58, 86],
    [6, 34, 62, 90],
    [6, 28, 50, 72, 94],
    [6, 26, 50, 74, 98],
    [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106],
    [6, 32, 58, 84, 110],
    [6, 30, 58, 86, 114],
    [6, 34, 62, 90, 118],
    [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126],
    [6, 26, 52, 78, 104, 130],
    [6, 30, 56, 82, 108, 134],
    [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142],
    [6, 34, 62, 90, 118, 146],
    [6, 30, 54, 78, 102, 126, 150],
    [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158],
    [6, 32, 58, 84, 110, 136, 162],
    [6, 26, 54, 82, 110, 138, 166],
    [6, 30, 58, 86, 114, 142, 170]
  ];
  const G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
  const G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
  const G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
  const _this = {};
  const getBCHDigit = function(data) {
    let digit = 0;
    while (data != 0) {
      digit += 1;
      data >>>= 1;
    }
    return digit;
  };
  _this.getBCHTypeInfo = function(data) {
    let d = data << 10;
    while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
      d ^= G15 << getBCHDigit(d) - getBCHDigit(G15);
    }
    return (data << 10 | d) ^ G15_MASK;
  };
  _this.getBCHTypeNumber = function(data) {
    let d = data << 12;
    while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
      d ^= G18 << getBCHDigit(d) - getBCHDigit(G18);
    }
    return data << 12 | d;
  };
  _this.getPatternPosition = function(typeNumber) {
    return PATTERN_POSITION_TABLE[typeNumber - 1];
  };
  _this.getMaskFunction = function(maskPattern) {
    switch (maskPattern) {
      case QRMaskPattern.PATTERN000:
        return function(i, j) {
          return (i + j) % 2 == 0;
        };
      case QRMaskPattern.PATTERN001:
        return function(i, j) {
          return i % 2 == 0;
        };
      case QRMaskPattern.PATTERN010:
        return function(i, j) {
          return j % 3 == 0;
        };
      case QRMaskPattern.PATTERN011:
        return function(i, j) {
          return (i + j) % 3 == 0;
        };
      case QRMaskPattern.PATTERN100:
        return function(i, j) {
          return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
        };
      case QRMaskPattern.PATTERN101:
        return function(i, j) {
          return i * j % 2 + i * j % 3 == 0;
        };
      case QRMaskPattern.PATTERN110:
        return function(i, j) {
          return (i * j % 2 + i * j % 3) % 2 == 0;
        };
      case QRMaskPattern.PATTERN111:
        return function(i, j) {
          return (i * j % 3 + (i + j) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + maskPattern;
    }
  };
  _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
    let a = qrPolynomial([1], 0);
    for (let i = 0; i < errorCorrectLength; i += 1) {
      a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0));
    }
    return a;
  };
  _this.getLengthInBits = function(mode, type) {
    if (1 <= type && type < 10) {
      switch (mode) {
        case QRMode.MODE_NUMBER:
          return 10;
        case QRMode.MODE_ALPHA_NUM:
          return 9;
        case QRMode.MODE_8BIT_BYTE:
          return 8;
        case QRMode.MODE_KANJI:
          return 8;
        default:
          throw "mode:" + mode;
      }
    } else if (type < 27) {
      switch (mode) {
        case QRMode.MODE_NUMBER:
          return 12;
        case QRMode.MODE_ALPHA_NUM:
          return 11;
        case QRMode.MODE_8BIT_BYTE:
          return 16;
        case QRMode.MODE_KANJI:
          return 10;
        default:
          throw "mode:" + mode;
      }
    } else if (type < 41) {
      switch (mode) {
        case QRMode.MODE_NUMBER:
          return 14;
        case QRMode.MODE_ALPHA_NUM:
          return 13;
        case QRMode.MODE_8BIT_BYTE:
          return 16;
        case QRMode.MODE_KANJI:
          return 12;
        default:
          throw "mode:" + mode;
      }
    } else {
      throw "type:" + type;
    }
  };
  _this.getLostPoint = function(qrcode2) {
    const moduleCount = qrcode2.getModuleCount();
    let lostPoint = 0;
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        let sameCount = 0;
        const dark = qrcode2.isDark(row, col);
        for (let r = -1; r <= 1; r += 1) {
          if (row + r < 0 || moduleCount <= row + r) {
            continue;
          }
          for (let c = -1; c <= 1; c += 1) {
            if (col + c < 0 || moduleCount <= col + c) {
              continue;
            }
            if (r == 0 && c == 0) {
              continue;
            }
            if (dark == qrcode2.isDark(row + r, col + c)) {
              sameCount += 1;
            }
          }
        }
        if (sameCount > 5) {
          lostPoint += 3 + sameCount - 5;
        }
      }
    }
    ;
    for (let row = 0; row < moduleCount - 1; row += 1) {
      for (let col = 0; col < moduleCount - 1; col += 1) {
        let count = 0;
        if (qrcode2.isDark(row, col)) count += 1;
        if (qrcode2.isDark(row + 1, col)) count += 1;
        if (qrcode2.isDark(row, col + 1)) count += 1;
        if (qrcode2.isDark(row + 1, col + 1)) count += 1;
        if (count == 0 || count == 4) {
          lostPoint += 3;
        }
      }
    }
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount - 6; col += 1) {
        if (qrcode2.isDark(row, col) && !qrcode2.isDark(row, col + 1) && qrcode2.isDark(row, col + 2) && qrcode2.isDark(row, col + 3) && qrcode2.isDark(row, col + 4) && !qrcode2.isDark(row, col + 5) && qrcode2.isDark(row, col + 6)) {
          lostPoint += 40;
        }
      }
    }
    for (let col = 0; col < moduleCount; col += 1) {
      for (let row = 0; row < moduleCount - 6; row += 1) {
        if (qrcode2.isDark(row, col) && !qrcode2.isDark(row + 1, col) && qrcode2.isDark(row + 2, col) && qrcode2.isDark(row + 3, col) && qrcode2.isDark(row + 4, col) && !qrcode2.isDark(row + 5, col) && qrcode2.isDark(row + 6, col)) {
          lostPoint += 40;
        }
      }
    }
    let darkCount = 0;
    for (let col = 0; col < moduleCount; col += 1) {
      for (let row = 0; row < moduleCount; row += 1) {
        if (qrcode2.isDark(row, col)) {
          darkCount += 1;
        }
      }
    }
    const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
    lostPoint += ratio * 10;
    return lostPoint;
  };
  return _this;
})();
var QRMath = (function() {
  const EXP_TABLE = new Array(256);
  const LOG_TABLE = new Array(256);
  for (let i = 0; i < 8; i += 1) {
    EXP_TABLE[i] = 1 << i;
  }
  for (let i = 8; i < 256; i += 1) {
    EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
  }
  for (let i = 0; i < 255; i += 1) {
    LOG_TABLE[EXP_TABLE[i]] = i;
  }
  const _this = {};
  _this.glog = function(n) {
    if (n < 1) {
      throw "glog(" + n + ")";
    }
    return LOG_TABLE[n];
  };
  _this.gexp = function(n) {
    while (n < 0) {
      n += 255;
    }
    while (n >= 256) {
      n -= 255;
    }
    return EXP_TABLE[n];
  };
  return _this;
})();
var qrPolynomial = function(num, shift) {
  if (typeof num.length == "undefined") {
    throw num.length + "/" + shift;
  }
  const _num = (function() {
    let offset = 0;
    while (offset < num.length && num[offset] == 0) {
      offset += 1;
    }
    const _num2 = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i += 1) {
      _num2[i] = num[i + offset];
    }
    return _num2;
  })();
  const _this = {};
  _this.getAt = function(index) {
    return _num[index];
  };
  _this.getLength = function() {
    return _num.length;
  };
  _this.multiply = function(e) {
    const num2 = new Array(_this.getLength() + e.getLength() - 1);
    for (let i = 0; i < _this.getLength(); i += 1) {
      for (let j = 0; j < e.getLength(); j += 1) {
        num2[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j)));
      }
    }
    return qrPolynomial(num2, 0);
  };
  _this.mod = function(e) {
    if (_this.getLength() - e.getLength() < 0) {
      return _this;
    }
    const ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0));
    const num2 = new Array(_this.getLength());
    for (let i = 0; i < _this.getLength(); i += 1) {
      num2[i] = _this.getAt(i);
    }
    for (let i = 0; i < e.getLength(); i += 1) {
      num2[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio);
    }
    return qrPolynomial(num2, 0).mod(e);
  };
  return _this;
};
var QRRSBlock = (function() {
  const RS_BLOCK_TABLE = [
    // L
    // M
    // Q
    // H
    // 1
    [1, 26, 19],
    [1, 26, 16],
    [1, 26, 13],
    [1, 26, 9],
    // 2
    [1, 44, 34],
    [1, 44, 28],
    [1, 44, 22],
    [1, 44, 16],
    // 3
    [1, 70, 55],
    [1, 70, 44],
    [2, 35, 17],
    [2, 35, 13],
    // 4
    [1, 100, 80],
    [2, 50, 32],
    [2, 50, 24],
    [4, 25, 9],
    // 5
    [1, 134, 108],
    [2, 67, 43],
    [2, 33, 15, 2, 34, 16],
    [2, 33, 11, 2, 34, 12],
    // 6
    [2, 86, 68],
    [4, 43, 27],
    [4, 43, 19],
    [4, 43, 15],
    // 7
    [2, 98, 78],
    [4, 49, 31],
    [2, 32, 14, 4, 33, 15],
    [4, 39, 13, 1, 40, 14],
    // 8
    [2, 121, 97],
    [2, 60, 38, 2, 61, 39],
    [4, 40, 18, 2, 41, 19],
    [4, 40, 14, 2, 41, 15],
    // 9
    [2, 146, 116],
    [3, 58, 36, 2, 59, 37],
    [4, 36, 16, 4, 37, 17],
    [4, 36, 12, 4, 37, 13],
    // 10
    [2, 86, 68, 2, 87, 69],
    [4, 69, 43, 1, 70, 44],
    [6, 43, 19, 2, 44, 20],
    [6, 43, 15, 2, 44, 16],
    // 11
    [4, 101, 81],
    [1, 80, 50, 4, 81, 51],
    [4, 50, 22, 4, 51, 23],
    [3, 36, 12, 8, 37, 13],
    // 12
    [2, 116, 92, 2, 117, 93],
    [6, 58, 36, 2, 59, 37],
    [4, 46, 20, 6, 47, 21],
    [7, 42, 14, 4, 43, 15],
    // 13
    [4, 133, 107],
    [8, 59, 37, 1, 60, 38],
    [8, 44, 20, 4, 45, 21],
    [12, 33, 11, 4, 34, 12],
    // 14
    [3, 145, 115, 1, 146, 116],
    [4, 64, 40, 5, 65, 41],
    [11, 36, 16, 5, 37, 17],
    [11, 36, 12, 5, 37, 13],
    // 15
    [5, 109, 87, 1, 110, 88],
    [5, 65, 41, 5, 66, 42],
    [5, 54, 24, 7, 55, 25],
    [11, 36, 12, 7, 37, 13],
    // 16
    [5, 122, 98, 1, 123, 99],
    [7, 73, 45, 3, 74, 46],
    [15, 43, 19, 2, 44, 20],
    [3, 45, 15, 13, 46, 16],
    // 17
    [1, 135, 107, 5, 136, 108],
    [10, 74, 46, 1, 75, 47],
    [1, 50, 22, 15, 51, 23],
    [2, 42, 14, 17, 43, 15],
    // 18
    [5, 150, 120, 1, 151, 121],
    [9, 69, 43, 4, 70, 44],
    [17, 50, 22, 1, 51, 23],
    [2, 42, 14, 19, 43, 15],
    // 19
    [3, 141, 113, 4, 142, 114],
    [3, 70, 44, 11, 71, 45],
    [17, 47, 21, 4, 48, 22],
    [9, 39, 13, 16, 40, 14],
    // 20
    [3, 135, 107, 5, 136, 108],
    [3, 67, 41, 13, 68, 42],
    [15, 54, 24, 5, 55, 25],
    [15, 43, 15, 10, 44, 16],
    // 21
    [4, 144, 116, 4, 145, 117],
    [17, 68, 42],
    [17, 50, 22, 6, 51, 23],
    [19, 46, 16, 6, 47, 17],
    // 22
    [2, 139, 111, 7, 140, 112],
    [17, 74, 46],
    [7, 54, 24, 16, 55, 25],
    [34, 37, 13],
    // 23
    [4, 151, 121, 5, 152, 122],
    [4, 75, 47, 14, 76, 48],
    [11, 54, 24, 14, 55, 25],
    [16, 45, 15, 14, 46, 16],
    // 24
    [6, 147, 117, 4, 148, 118],
    [6, 73, 45, 14, 74, 46],
    [11, 54, 24, 16, 55, 25],
    [30, 46, 16, 2, 47, 17],
    // 25
    [8, 132, 106, 4, 133, 107],
    [8, 75, 47, 13, 76, 48],
    [7, 54, 24, 22, 55, 25],
    [22, 45, 15, 13, 46, 16],
    // 26
    [10, 142, 114, 2, 143, 115],
    [19, 74, 46, 4, 75, 47],
    [28, 50, 22, 6, 51, 23],
    [33, 46, 16, 4, 47, 17],
    // 27
    [8, 152, 122, 4, 153, 123],
    [22, 73, 45, 3, 74, 46],
    [8, 53, 23, 26, 54, 24],
    [12, 45, 15, 28, 46, 16],
    // 28
    [3, 147, 117, 10, 148, 118],
    [3, 73, 45, 23, 74, 46],
    [4, 54, 24, 31, 55, 25],
    [11, 45, 15, 31, 46, 16],
    // 29
    [7, 146, 116, 7, 147, 117],
    [21, 73, 45, 7, 74, 46],
    [1, 53, 23, 37, 54, 24],
    [19, 45, 15, 26, 46, 16],
    // 30
    [5, 145, 115, 10, 146, 116],
    [19, 75, 47, 10, 76, 48],
    [15, 54, 24, 25, 55, 25],
    [23, 45, 15, 25, 46, 16],
    // 31
    [13, 145, 115, 3, 146, 116],
    [2, 74, 46, 29, 75, 47],
    [42, 54, 24, 1, 55, 25],
    [23, 45, 15, 28, 46, 16],
    // 32
    [17, 145, 115],
    [10, 74, 46, 23, 75, 47],
    [10, 54, 24, 35, 55, 25],
    [19, 45, 15, 35, 46, 16],
    // 33
    [17, 145, 115, 1, 146, 116],
    [14, 74, 46, 21, 75, 47],
    [29, 54, 24, 19, 55, 25],
    [11, 45, 15, 46, 46, 16],
    // 34
    [13, 145, 115, 6, 146, 116],
    [14, 74, 46, 23, 75, 47],
    [44, 54, 24, 7, 55, 25],
    [59, 46, 16, 1, 47, 17],
    // 35
    [12, 151, 121, 7, 152, 122],
    [12, 75, 47, 26, 76, 48],
    [39, 54, 24, 14, 55, 25],
    [22, 45, 15, 41, 46, 16],
    // 36
    [6, 151, 121, 14, 152, 122],
    [6, 75, 47, 34, 76, 48],
    [46, 54, 24, 10, 55, 25],
    [2, 45, 15, 64, 46, 16],
    // 37
    [17, 152, 122, 4, 153, 123],
    [29, 74, 46, 14, 75, 47],
    [49, 54, 24, 10, 55, 25],
    [24, 45, 15, 46, 46, 16],
    // 38
    [4, 152, 122, 18, 153, 123],
    [13, 74, 46, 32, 75, 47],
    [48, 54, 24, 14, 55, 25],
    [42, 45, 15, 32, 46, 16],
    // 39
    [20, 147, 117, 4, 148, 118],
    [40, 75, 47, 7, 76, 48],
    [43, 54, 24, 22, 55, 25],
    [10, 45, 15, 67, 46, 16],
    // 40
    [19, 148, 118, 6, 149, 119],
    [18, 75, 47, 31, 76, 48],
    [34, 54, 24, 34, 55, 25],
    [20, 45, 15, 61, 46, 16]
  ];
  const qrRSBlock = function(totalCount, dataCount) {
    const _this2 = {};
    _this2.totalCount = totalCount;
    _this2.dataCount = dataCount;
    return _this2;
  };
  const _this = {};
  const getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
    switch (errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L:
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M:
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q:
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H:
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default:
        return void 0;
    }
  };
  _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
    const rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
    if (typeof rsBlock == "undefined") {
      throw "bad rs block @ typeNumber:" + typeNumber + "/errorCorrectionLevel:" + errorCorrectionLevel;
    }
    const length = rsBlock.length / 3;
    const list = [];
    for (let i = 0; i < length; i += 1) {
      const count = rsBlock[i * 3 + 0];
      const totalCount = rsBlock[i * 3 + 1];
      const dataCount = rsBlock[i * 3 + 2];
      for (let j = 0; j < count; j += 1) {
        list.push(qrRSBlock(totalCount, dataCount));
      }
    }
    return list;
  };
  return _this;
})();
var qrBitBuffer = function() {
  const _buffer = [];
  let _length = 0;
  const _this = {};
  _this.getBuffer = function() {
    return _buffer;
  };
  _this.getAt = function(index) {
    const bufIndex = Math.floor(index / 8);
    return (_buffer[bufIndex] >>> 7 - index % 8 & 1) == 1;
  };
  _this.put = function(num, length) {
    for (let i = 0; i < length; i += 1) {
      _this.putBit((num >>> length - i - 1 & 1) == 1);
    }
  };
  _this.getLengthInBits = function() {
    return _length;
  };
  _this.putBit = function(bit) {
    const bufIndex = Math.floor(_length / 8);
    if (_buffer.length <= bufIndex) {
      _buffer.push(0);
    }
    if (bit) {
      _buffer[bufIndex] |= 128 >>> _length % 8;
    }
    _length += 1;
  };
  return _this;
};
var qrNumber = function(data) {
  const _mode = QRMode.MODE_NUMBER;
  const _data = data;
  const _this = {};
  _this.getMode = function() {
    return _mode;
  };
  _this.getLength = function(buffer) {
    return _data.length;
  };
  _this.write = function(buffer) {
    const data2 = _data;
    let i = 0;
    while (i + 2 < data2.length) {
      buffer.put(strToNum(data2.substring(i, i + 3)), 10);
      i += 3;
    }
    if (i < data2.length) {
      if (data2.length - i == 1) {
        buffer.put(strToNum(data2.substring(i, i + 1)), 4);
      } else if (data2.length - i == 2) {
        buffer.put(strToNum(data2.substring(i, i + 2)), 7);
      }
    }
  };
  const strToNum = function(s) {
    let num = 0;
    for (let i = 0; i < s.length; i += 1) {
      num = num * 10 + chatToNum(s.charAt(i));
    }
    return num;
  };
  const chatToNum = function(c) {
    if ("0" <= c && c <= "9") {
      return c.charCodeAt(0) - "0".charCodeAt(0);
    }
    throw "illegal char :" + c;
  };
  return _this;
};
var qrAlphaNum = function(data) {
  const _mode = QRMode.MODE_ALPHA_NUM;
  const _data = data;
  const _this = {};
  _this.getMode = function() {
    return _mode;
  };
  _this.getLength = function(buffer) {
    return _data.length;
  };
  _this.write = function(buffer) {
    const s = _data;
    let i = 0;
    while (i + 1 < s.length) {
      buffer.put(
        getCode(s.charAt(i)) * 45 + getCode(s.charAt(i + 1)),
        11
      );
      i += 2;
    }
    if (i < s.length) {
      buffer.put(getCode(s.charAt(i)), 6);
    }
  };
  const getCode = function(c) {
    if ("0" <= c && c <= "9") {
      return c.charCodeAt(0) - "0".charCodeAt(0);
    } else if ("A" <= c && c <= "Z") {
      return c.charCodeAt(0) - "A".charCodeAt(0) + 10;
    } else {
      switch (c) {
        case " ":
          return 36;
        case "$":
          return 37;
        case "%":
          return 38;
        case "*":
          return 39;
        case "+":
          return 40;
        case "-":
          return 41;
        case ".":
          return 42;
        case "/":
          return 43;
        case ":":
          return 44;
        default:
          throw "illegal char :" + c;
      }
    }
  };
  return _this;
};
var qr8BitByte = function(data) {
  const _mode = QRMode.MODE_8BIT_BYTE;
  const _data = data;
  const _bytes = qrcode.stringToBytes(data);
  const _this = {};
  _this.getMode = function() {
    return _mode;
  };
  _this.getLength = function(buffer) {
    return _bytes.length;
  };
  _this.write = function(buffer) {
    for (let i = 0; i < _bytes.length; i += 1) {
      buffer.put(_bytes[i], 8);
    }
  };
  return _this;
};
var qrKanji = function(data) {
  const _mode = QRMode.MODE_KANJI;
  const _data = data;
  const stringToBytes2 = qrcode.stringToBytes;
  !(function(c, code) {
    const test = stringToBytes2(c);
    if (test.length != 2 || (test[0] << 8 | test[1]) != code) {
      throw "sjis not supported.";
    }
  })("友", 38726);
  const _bytes = stringToBytes2(data);
  const _this = {};
  _this.getMode = function() {
    return _mode;
  };
  _this.getLength = function(buffer) {
    return ~~(_bytes.length / 2);
  };
  _this.write = function(buffer) {
    const data2 = _bytes;
    let i = 0;
    while (i + 1 < data2.length) {
      let c = (255 & data2[i]) << 8 | 255 & data2[i + 1];
      if (33088 <= c && c <= 40956) {
        c -= 33088;
      } else if (57408 <= c && c <= 60351) {
        c -= 49472;
      } else {
        throw "illegal char at " + (i + 1) + "/" + c;
      }
      c = (c >>> 8 & 255) * 192 + (c & 255);
      buffer.put(c, 13);
      i += 2;
    }
    if (i < data2.length) {
      throw "illegal char at " + (i + 1);
    }
  };
  return _this;
};
var byteArrayOutputStream = function() {
  const _bytes = [];
  const _this = {};
  _this.writeByte = function(b) {
    _bytes.push(b & 255);
  };
  _this.writeShort = function(i) {
    _this.writeByte(i);
    _this.writeByte(i >>> 8);
  };
  _this.writeBytes = function(b, off, len) {
    off = off || 0;
    len = len || b.length;
    for (let i = 0; i < len; i += 1) {
      _this.writeByte(b[i + off]);
    }
  };
  _this.writeString = function(s) {
    for (let i = 0; i < s.length; i += 1) {
      _this.writeByte(s.charCodeAt(i));
    }
  };
  _this.toByteArray = function() {
    return _bytes;
  };
  _this.toString = function() {
    let s = "";
    s += "[";
    for (let i = 0; i < _bytes.length; i += 1) {
      if (i > 0) {
        s += ",";
      }
      s += _bytes[i];
    }
    s += "]";
    return s;
  };
  return _this;
};
var base64EncodeOutputStream = function() {
  let _buffer = 0;
  let _buflen = 0;
  let _length = 0;
  let _base64 = "";
  const _this = {};
  const writeEncoded = function(b) {
    _base64 += String.fromCharCode(encode(b & 63));
  };
  const encode = function(n) {
    if (n < 0) {
      throw "n:" + n;
    } else if (n < 26) {
      return 65 + n;
    } else if (n < 52) {
      return 97 + (n - 26);
    } else if (n < 62) {
      return 48 + (n - 52);
    } else if (n == 62) {
      return 43;
    } else if (n == 63) {
      return 47;
    } else {
      throw "n:" + n;
    }
  };
  _this.writeByte = function(n) {
    _buffer = _buffer << 8 | n & 255;
    _buflen += 8;
    _length += 1;
    while (_buflen >= 6) {
      writeEncoded(_buffer >>> _buflen - 6);
      _buflen -= 6;
    }
  };
  _this.flush = function() {
    if (_buflen > 0) {
      writeEncoded(_buffer << 6 - _buflen);
      _buffer = 0;
      _buflen = 0;
    }
    if (_length % 3 != 0) {
      const padlen = 3 - _length % 3;
      for (let i = 0; i < padlen; i += 1) {
        _base64 += "=";
      }
    }
  };
  _this.toString = function() {
    return _base64;
  };
  return _this;
};
var base64DecodeInputStream = function(str) {
  const _str = str;
  let _pos = 0;
  let _buffer = 0;
  let _buflen = 0;
  const _this = {};
  _this.read = function() {
    while (_buflen < 8) {
      if (_pos >= _str.length) {
        if (_buflen == 0) {
          return -1;
        }
        throw "unexpected end of file./" + _buflen;
      }
      const c = _str.charAt(_pos);
      _pos += 1;
      if (c == "=") {
        _buflen = 0;
        return -1;
      } else if (c.match(/^\s$/)) {
        continue;
      }
      _buffer = _buffer << 6 | decode(c.charCodeAt(0));
      _buflen += 6;
    }
    const n = _buffer >>> _buflen - 8 & 255;
    _buflen -= 8;
    return n;
  };
  const decode = function(c) {
    if (65 <= c && c <= 90) {
      return c - 65;
    } else if (97 <= c && c <= 122) {
      return c - 97 + 26;
    } else if (48 <= c && c <= 57) {
      return c - 48 + 52;
    } else if (c == 43) {
      return 62;
    } else if (c == 47) {
      return 63;
    } else {
      throw "c:" + c;
    }
  };
  return _this;
};
var gifImage = function(width, height) {
  const _width = width;
  const _height = height;
  const _data = new Array(width * height);
  const _this = {};
  _this.setPixel = function(x, y, pixel) {
    _data[y * _width + x] = pixel;
  };
  _this.write = function(out) {
    out.writeString("GIF87a");
    out.writeShort(_width);
    out.writeShort(_height);
    out.writeByte(128);
    out.writeByte(0);
    out.writeByte(0);
    out.writeByte(0);
    out.writeByte(0);
    out.writeByte(0);
    out.writeByte(255);
    out.writeByte(255);
    out.writeByte(255);
    out.writeString(",");
    out.writeShort(0);
    out.writeShort(0);
    out.writeShort(_width);
    out.writeShort(_height);
    out.writeByte(0);
    const lzwMinCodeSize = 2;
    const raster = getLZWRaster(lzwMinCodeSize);
    out.writeByte(lzwMinCodeSize);
    let offset = 0;
    while (raster.length - offset > 255) {
      out.writeByte(255);
      out.writeBytes(raster, offset, 255);
      offset += 255;
    }
    out.writeByte(raster.length - offset);
    out.writeBytes(raster, offset, raster.length - offset);
    out.writeByte(0);
    out.writeString(";");
  };
  const bitOutputStream = function(out) {
    const _out = out;
    let _bitLength = 0;
    let _bitBuffer = 0;
    const _this2 = {};
    _this2.write = function(data, length) {
      if (data >>> length != 0) {
        throw "length over";
      }
      while (_bitLength + length >= 8) {
        _out.writeByte(255 & (data << _bitLength | _bitBuffer));
        length -= 8 - _bitLength;
        data >>>= 8 - _bitLength;
        _bitBuffer = 0;
        _bitLength = 0;
      }
      _bitBuffer = data << _bitLength | _bitBuffer;
      _bitLength = _bitLength + length;
    };
    _this2.flush = function() {
      if (_bitLength > 0) {
        _out.writeByte(_bitBuffer);
      }
    };
    return _this2;
  };
  const getLZWRaster = function(lzwMinCodeSize) {
    const clearCode = 1 << lzwMinCodeSize;
    const endCode = (1 << lzwMinCodeSize) + 1;
    let bitLength = lzwMinCodeSize + 1;
    const table = lzwTable();
    for (let i = 0; i < clearCode; i += 1) {
      table.add(String.fromCharCode(i));
    }
    table.add(String.fromCharCode(clearCode));
    table.add(String.fromCharCode(endCode));
    const byteOut = byteArrayOutputStream();
    const bitOut = bitOutputStream(byteOut);
    bitOut.write(clearCode, bitLength);
    let dataIndex = 0;
    let s = String.fromCharCode(_data[dataIndex]);
    dataIndex += 1;
    while (dataIndex < _data.length) {
      const c = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;
      if (table.contains(s + c)) {
        s = s + c;
      } else {
        bitOut.write(table.indexOf(s), bitLength);
        if (table.size() < 4095) {
          if (table.size() == 1 << bitLength) {
            bitLength += 1;
          }
          table.add(s + c);
        }
        s = c;
      }
    }
    bitOut.write(table.indexOf(s), bitLength);
    bitOut.write(endCode, bitLength);
    bitOut.flush();
    return byteOut.toByteArray();
  };
  const lzwTable = function() {
    const _map = {};
    let _size = 0;
    const _this2 = {};
    _this2.add = function(key) {
      if (_this2.contains(key)) {
        throw "dup key:" + key;
      }
      _map[key] = _size;
      _size += 1;
    };
    _this2.size = function() {
      return _size;
    };
    _this2.indexOf = function(key) {
      return _map[key];
    };
    _this2.contains = function(key) {
      return typeof _map[key] != "undefined";
    };
    return _this2;
  };
  return _this;
};
var createDataURL = function(width, height, getPixel) {
  const gif = gifImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      gif.setPixel(x, y, getPixel(x, y));
    }
  }
  const b = byteArrayOutputStream();
  gif.write(b);
  const base64 = base64EncodeOutputStream();
  const bytes = b.toByteArray();
  for (let i = 0; i < bytes.length; i += 1) {
    base64.writeByte(bytes[i]);
  }
  base64.flush();
  return "data:image/gif;base64," + base64;
};
var qrcode_default = qrcode;
var stringToBytes = qrcode.stringToBytes;

// src/panel.ts
var ROUTE_PREFIX = "/api/teamwork";

// src/web/api.ts
var HostUnreachable = class extends Error {
  constructor(reason, status) {
    super(reason);
    this.reason = reason;
    this.status = status;
  }
};
var base = ROUTE_PREFIX.slice(1) + "/";
async function call(route, payload = {}) {
  let response;
  try {
    response = await fetch(base + route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin"
    });
  } catch {
    throw new HostUnreachable("offline");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 404 && !data) throw new HostUnreachable("not-loaded");
    if (data?.error) throw new Error(data.error);
    throw new HostUnreachable("status", response.status);
  }
  return data;
}
var api = {
  summary: (teamId) => call("summary", { teamId }),
  teamUsage: (teamId) => call("team-usage", { teamId }),
  profile: () => call("profile"),
  updateProfile: (input) => call("update-profile", input),
  state: (sessionId) => call("state", { sessionId }),
  login: () => call("login"),
  authorize: (code) => call("authorize", { code }),
  sync: () => call("sync"),
  logout: () => call("logout"),
  setWorkspace: (teamId, path) => call("workspace", { teamId, path }),
  setServer: (server) => call("server", { server }),
  use: (sessionId, id) => call("use", { sessionId, id }),
  install: (id, version) => call("install", { id, version }),
  setOwnerPin: (pin) => call("owner-pin", { pin }),
  setNativeWeb: (enabled) => call("native-web", { enabled }),
  disconnectNativeWeb: () => call("native-web-disconnect"),
  pairPhone: () => call("pair-phone", {}),
  decidePhone: (id, accept) => call("decide-phone", { id, accept }),
  revokePhone: (id) => call("revoke-phone", { id })
};

// src/web/avatars.ts
var PRESET_AVATAR_STYLE = {
  size: 32,
  /** The logo's corner: 22 % of the side. */
  radius: 7,
  /** Paper: the mark's fluke (docs/design.md, "Brand colours"). */
  figure: "#F8F5EF"
};
function presetAvatarColor(avatar, tone) {
  return tone === "figure" ? PRESET_AVATAR_STYLE.figure : tone === "plate" ? avatar.plate : avatar.accent;
}
var circle = (cx, cy, r) => `M${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}Z`;
var box = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
var paper = (d) => ({ d, fill: "figure" });
var accent = (d) => ({ d, fill: "accent" });
var cut = (d) => ({ d, fill: "plate" });
var PRESET_AVATARS = [
  // The team assistant every team is given: a spark, in the brand's navy and amber.
  { id: "assistant", plate: "#1E2F6D", accent: "#E8A33D", layers: [paper("M15 7C15.8 12.6 18.4 15.2 24 16C18.4 16.8 15.8 19.4 15 25C14.2 19.4 11.6 16.8 6 16C11.6 15.2 14.2 12.6 15 7Z"), accent(circle(22.5, 9.5, 2.5))] },
  // Finance: a stack of coins, the top one gold.
  { id: "finance", plate: "#1F4D3A", accent: "#D9B44A", layers: [paper(box(9.5, 20, 14, 4, 2)), paper(box(11, 15, 14, 4, 2)), accent(box(8, 10, 14, 4, 2))] },
  // Administration: a grid kept in order, one cell picked out.
  { id: "admin", plate: "#5A3A5E", accent: "#E9B8C8", layers: [paper(box(8.5, 8.5, 6.5, 6.5, 1.5)), paper(box(17, 8.5, 6.5, 6.5, 1.5)), paper(box(8.5, 17, 6.5, 6.5, 1.5)), accent(box(17, 17, 6.5, 6.5, 1.5))] },
  // Human resources: two people, overlapping.
  { id: "hr", plate: "#7A2E3B", accent: "#F2A07B", layers: [accent(circle(19.5, 16, 5.5)), paper(circle(12.5, 16, 5.5))] },
  // Marketing: a voice that widens as it travels.
  { id: "marketing", plate: "#A2441F", accent: "#FFD27A", layers: [paper("M8 13L21 8V24L8 19Z"), accent(box(22.5, 10.5, 2.5, 11, 1.25))] },
  // Sales and business: two halves that meet.
  { id: "sales", plate: "#16324F", accent: "#E07A5F", layers: [paper("M7 15.5A7 7 0 0 1 21 15.5Z"), accent("M11 16.5A7 7 0 0 0 25 16.5Z")] },
  // Engineering: a load on a foundation.
  { id: "engineer", plate: "#2F3B45", accent: "#F2B134", layers: [accent("M16 8L23.5 18.5H8.5Z"), paper(box(8.5, 19.5, 15, 4.5, 1))] },
  // Product: a thing made, and the idea at its corner.
  { id: "product", plate: "#3B2F6B", accent: "#8FD1B5", layers: [paper(box(8, 11, 13, 13, 3)), accent(circle(21.5, 10.5, 4))] },
  // Legal: a balance.
  { id: "legal", plate: "#5C1F2E", accent: "#E3C27A", layers: [paper(box(15, 9, 2, 15, 1)), paper(box(7.5, 11, 17, 2, 1)), accent("M7.5 17A3.5 3.5 0 0 0 14.5 17Z"), accent("M17.5 17A3.5 3.5 0 0 0 24.5 17Z"), paper(box(12, 22.5, 8, 2, 1))] },
  // Design: form, in two shapes.
  { id: "design", plate: "#0F5257", accent: "#F28E7B", layers: [accent(box(15, 15, 9, 9, 1.5)), paper(circle(13, 13, 5))] },
  // Customer support: someone listening.
  { id: "support", plate: "#1E5A8C", accent: "#7FD3F0", layers: [paper("M8 18A8 8 0 0 1 24 18H20.5A4.5 4.5 0 0 0 11.5 18Z"), accent(box(7.5, 17, 4.5, 7, 2.25)), accent(box(20, 17, 4.5, 7, 2.25))] },
  // Operations: a network kept running.
  {
    id: "operations",
    plate: "#4E5320",
    accent: "#E8C547",
    layers: [{ d: "M16 10.5L10 21.5H22Z", stroke: "figure", width: 1.4 }, accent(circle(16, 10.5, 3.2)), paper(circle(10, 21.5, 3.2)), paper(circle(22, 21.5, 3.2))]
  },
  // Project management: work laid out in time.
  { id: "project", plate: "#334E68", accent: "#F6B26B", layers: [paper(box(8, 9, 10, 3.6, 1.8)), accent(box(12, 14.2, 11, 3.6, 1.8)), paper(box(17, 19.4, 7, 3.6, 1.8))] },
  // Training: steps up, and where they lead.
  { id: "training", plate: "#283C63", accent: "#D9B44A", layers: [paper("M8 24V20H13V16H18V12H24V24Z"), accent(circle(21, 8.5, 2.5))] },
  // Software development: an opening and a closing.
  { id: "developer", plate: "#22313F", accent: "#5EE0A0", layers: [paper("M14 8.5L6.5 16L14 23.5L16 21.5L10.5 16L16 10.5Z"), accent("M18 8.5L25.5 16L18 23.5L16 21.5L21.5 16L16 10.5Z")] },
  // Research: a lens on something found.
  { id: "researcher", plate: "#0E4D64", accent: "#9AD1D4", layers: [paper(circle(16, 16, 8)), cut(circle(17.6, 14.4, 5.2)), accent(circle(19, 13, 2.2))] },
  // Data analysis: a rising measure.
  { id: "analyst", plate: "#1D3557", accent: "#A8DADC", layers: [paper(box(8.5, 17, 4, 7, 2)), paper(box(14, 12.5, 4, 11.5, 2)), accent(box(19.5, 8, 4, 16, 2))] },
  // Writing: a pen's nib, and a drop of ink.
  {
    id: "writer",
    plate: "#6B4226",
    accent: "#E9C46A",
    layers: [paper("M15 7L21 15.5L15 25L9 15.5Z"), cut(circle(15, 15.5, 1.6)), { d: "M15 17.5V23.5", stroke: "plate", width: 1 }, accent(circle(22.5, 9.5, 2.2))]
  }
];
function presetAvatar(chosen, seed) {
  const known = chosen ? PRESET_AVATARS.find((avatar) => avatar.id === chosen) : void 0;
  if (known) return known;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0;
  return PRESET_AVATARS[hash % PRESET_AVATARS.length];
}

// src/web/PresetAvatar.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function PresetAvatar({ avatar, name }) {
  const shown = presetAvatar(avatar, name);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { viewBox: `0 0 ${PRESET_AVATAR_STYLE.size} ${PRESET_AVATAR_STYLE.size}`, "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("rect", { width: PRESET_AVATAR_STYLE.size, height: PRESET_AVATAR_STYLE.size, rx: PRESET_AVATAR_STYLE.radius, fill: shown.plate }),
    shown.layers.map((layer, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "path",
      {
        d: layer.d,
        fill: layer.fill ? presetAvatarColor(shown, layer.fill) : "none",
        stroke: layer.stroke ? presetAvatarColor(shown, layer.stroke) : void 0,
        strokeWidth: layer.width ?? 1,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      },
      i
    ))
  ] });
}

// src/web/messages.ts
var import_react4 = require("react");

// src/locale.ts
function fill(template, values) {
  return values ? template.replace(/\{(\w+)\}/g, (whole, name) => name in values ? String(values[name]) : whole) : template;
}
function translator(catalogs2, locale) {
  return (key, values) => fill(catalogs2[locale][key], values);
}

// src/web/messages.ts
var en = {
  // Shared
  "common.retry": "Try again",
  "common.cancel": "Cancel",
  "common.admin": "Admin",
  "common.member": "Member",
  "common.officialService": "Hosted service",
  "error.offline": "Cannot reach DSH.",
  "error.notLoaded": "DSH has not loaded the Teamwork plugin’s host half yet. Restart DSH.",
  "error.status": "The request failed (HTTP {status}).",
  // Loading and sync
  "load.failed": "Could not read the team status",
  "load.stale": "The status did not refresh",
  "sync.failedTitle": "Sync failed; using the last synced configuration",
  "sync.failedBody": "Your team toolbox here may be out of date. Try again later, or check your connection.",
  "sync.done": "Team configuration synced",
  "sync.never": "Not synced yet",
  "sync.justNow": "Synced just now",
  "sync.minutes": "Synced {minutes} min ago",
  "sync.at": "Synced at {time}",
  "sync.running": "Syncing…",
  "sync.failed": "Sync failed",
  "sync.refresh": "Refresh",
  "team.gone": "The team you were browsing is no longer available.",
  // Header and navigation
  "nav.home": "Back to the team toolbox",
  "nav.teams": "My teams",
  "nav.chooseTeam": "Choose a team",
  "nav.phones": "Devices",
  "nav.account": "Account",
  // No team, team chooser, teams page
  "noTeam.title": "Your account is connected. Next, join a team",
  "noTeam.body": "Accept an invitation or create a team on the website, then come back and refresh.",
  "noTeam.open": "Join or create a team",
  "noTeam.refresh": "I have joined; refresh",
  "noTeam.refreshed": "Team list refreshed",
  "choose.title": "Which team first?",
  "choose.body": "This only sets what you browse here. You can switch at the top at any time.",
  "choose.pick": "Choose",
  "teams.title": "My teams",
  "teams.body": "Switching what you browse never changes a running session or a paired device.",
  "teams.browse": "Open toolbox",
  "teams.manage": "Manage team",
  "teams.view": "View team",
  "teams.joinOrCreate": "Join or create a team",
  "teams.settings": "Settings",
  "team.workspaceTitle": "Default workspace",
  "team.usageTitle": "My usage · last 30 days",
  "team.usageLoading": "Loading…",
  "team.usageUnavailable": "This could not be read. Try again later.",
  "team.points": "Points",
  "team.calls": "Calls",
  "team.callsNote": "Model calls",
  "team.unpriced": "{count} without points yet",
  "team.pointsNote": "Model calls and other metered use",
  "team.input": "Input tokens",
  "team.inputNote": "{cached} from cache",
  "team.output": "Output tokens",
  "team.outputNote": "{reasoning} reasoning",
  "team.daily": "Points by day",
  "team.dayDetail": "{day} · {count} calls",
  "team.peak": "Busiest day: {points} points",
  "team.noUsage": "No calls in this team in the last 30 days.",
  "team.byModel": "By model",
  "team.pointsCount": "{points} points",
  "team.callsCount": "{count} calls",
  "team.usageDetail": "Details in the web console",
  "team.budgetTitle": "My budget",
  "team.budgetReset": "Resets {time}",
  "team.nearLimit": "{who} {period} budget is {threshold}% used",
  "team.scope.team": "The team’s",
  "team.scope.member": "Your",
  "team.scope.provider": "A provider’s",
  "team.period.day": "daily",
  "team.period.month": "monthly",
  "teams.workspaceHint": "New sessions for this team open here: from its presets, your phone or the web console. Add workspace… in the menu offers any folder.",
  "teams.workspaceSaved": "{team}’s default workspace is saved.",
  // Resource tabs
  "tabs.label": "Resource type",
  "tabs.presets": "Presets",
  "tabs.models": "Models",
  "tabs.plugins": "Plugins",
  "search.label": "Search the team toolbox",
  "search.placeholder": "Search by name or purpose",
  "empty.noMatch": "Nothing matches",
  "empty.noMatchBody": "Try another word, or switch team.",
  "empty.none": "Nothing here yet",
  "empty.noneBody": "What an admin publishes on the website syncs here.",
  // Team assistant
  "assistant.label": "Team assistant",
  "assistant.body": "Ask it in a session about your team’s presets, models and plugins, your usage and budget, and what is waiting for review. Admins can also manage the team through it, with your approval for every change.",
  "assistant.examples": "Try asking",
  "assistant.example1": "What did I spend this month?",
  "assistant.example2": "Which presets does our team share?",
  "assistant.example3": "Submit my local preset for review",
  "assistant.ask": "Ask the assistant",
  // Presets
  "preset.sessionModel": "Session model",
  "preset.ready": "Ready",
  "preset.checkOnStart": "Tools checked at start",
  "preset.notReady": "Not ready",
  "preset.details": "Details",
  "preset.newSession": "Start a session",
  "preset.modelGone": "The team model this preset uses is no longer available. Ask an admin.",
  "preset.pluginsNotReady": "Plugins it needs are not ready: {plugins}.",
  "preset.toolsMissing": "Required tools are missing: {tools}. Install or enable them in DSH’s plugin manager.",
  "preset.goInstall": "Go to install",
  "preset.model": "Model",
  "preset.tools": "Tools",
  "preset.noTools": "None required",
  "preset.required": "Required",
  "preset.optional": "optional",
  "preset.plugins": "Plugins it needs",
  "preset.noPlugins": "None",
  "preset.version": "Version",
  "preset.versionValue": "v{version}. A newer version arrives with the next sync after an admin publishes it.",
  "preset.toolsNote": "Tools are checked for the current session, again when you switch sessions, and before every request.",
  "tool.available": "available",
  "tool.conditional": "checked when run",
  "tool.missing": "missing",
  "tool.unknown": "not checked yet",
  "list.separator": ", ",
  // Models
  "model.body": "Called by the team’s server, so the provider key stays there. Opens a session on it; other sessions and your local default stay as they are.",
  "model.context": "{tokens} tokens context window",
  "model.maxOutput": "{tokens} tokens max output",
  "model.ioImage": "Input: text and images. Output: text.",
  "model.ioText": "Input: text. Output: text.",
  "model.ioUnknown": "Input: text. Output: text. Image input is unspecified.",
  "model.noWorkspace": "Add a workspace in DSH first, then start a session.",
  "model.noContextWindow": "The team model “{name}” has no context window (contextWindow) configured, so it cannot be used yet. Ask a team admin to set it in the console, then sync again.",
  "model.offline": "The team model “{name}” has been taken offline by the service that hosts it, so it cannot be used. Choose another model.",
  // Plugins
  "plugin.ready": "Enabled",
  "plugin.missing": "Not installed",
  "plugin.disabled": "Installed, not enabled",
  "plugin.versionMismatch": "Different local version",
  "plugin.failed": "Failed to load",
  "plugin.pending": "Waiting to load",
  "plugin.unknown": "Cannot confirm",
  "plugin.catalogChanged": "Team changed the version",
  "plugin.local": "Local {version}",
  "plugin.install": "Install",
  "plugin.managed": "Managed in DSH’s plugin manager",
  "plugin.confirmTitle": "Install and enable {spec}?",
  "plugin.confirmBody": "This runs the plugin’s code on your computer. The team fixes the version, and a plugin of the same name you already have is never overwritten.",
  "plugin.confirm": "Install and enable",
  // Footer budget
  "budget.loading": "Loading budget…",
  "budget.unavailable": "Budget unavailable",
  "budget.exhausted": "Budget used up",
  "budget.unconfirmed": "Budget being reconciled",
  "budget.remaining": "{points} points left",
  "budget.tokenLimited": "Token limit set",
  "budget.unlimited": "No budget limit",
  "budget.hint": "Your budget in the selected team; the model or provider may still have its own limits. Switching what you browse never changes the current session.",
  // Account
  "account.title": "Account",
  "account.editOnWeb": "Edit profile on the web",
  "account.noTeams": "You haven’t joined a team yet.",
  "account.leaveTeam": "Leave team",
  "account.leaveTeamLabel": "Leave {team} on the web",
  "account.leaveTeamHint": "Open the web console and choose Leave team in the team menu.",
  "account.readFailed": "Could not read your profile",
  "account.unnamed": "Teamwork user",
  "account.noEmail": "No email",
  "account.language": "Language",
  "account.languageSaved": "Language updated",
  "account.connection": "DSH connection",
  "account.restartNote": "Restarting DSH requires authorization again.",
  "account.signOut": "Sign out",
  "account.signOutTitle": "Sign out of Teamwork?",
  "account.signOutConfirm": "Confirm sign-out",
  "account.switch": "Switch account",
  "account.switchTitle": "Switch Teamwork account?",
  "account.signOutBody": "Signing out removes the team configuration from this DSH and disconnects paired devices. In-progress team model requests may be affected. Local sessions and installed plugins are kept.",
  "account.switchConfirm": "Sign out and switch",
  "account.signedOut": "Signed out of Teamwork",
  // Sign-in
  "signIn.title": "Sign in to Teamwork",
  "signIn.reconnect": "Reconnect Teamwork",
  "signIn.lede": "Your team’s presets, models and plugins, published once and kept the same in every member’s DSH.",
  "signIn.step1": "Sign in in your browser",
  "signIn.step2Paste": "Authorize, then paste the line shown on the page below (valid for two minutes)",
  "signIn.step2Auto": "Authorize; this DSH finishes signing in by itself",
  "signIn.waiting": "Waiting for you to authorize in the browser. The team toolbox opens here when you do.",
  "signIn.openPage": "Open the authorization page",
  "signIn.useCode": "Did not finish by itself? Use the code",
  "signIn.restart": "Start again",
  "signIn.expiredTitle": "This sign-in timed out",
  "signIn.expiredBody": "Open the authorization page again; a code from the old page does not work for a new sign-in.",
  "signIn.start": "Sign in in the browser",
  "signIn.pasteAuto": "Did not finish by itself? Paste the line shown on the page",
  "signIn.paste": "The line shown on the page",
  "signIn.finish": "Finish",
  "signIn.done": "Authorized, and the team configuration is synced",
  "signIn.keysTitle": "Keys stay on the server",
  "signIn.keysBody": "The team’s server calls the team models; provider keys never reach this computer.",
  "signIn.sideTitle": "Beside your own setup",
  "signIn.sideBody": "Team configuration is added as its own entries and never overwrites your models or presets.",
  "signIn.syncTitle": "Kept up to date",
  "signIn.syncBody": "Synced every minute. Once you are removed from a team, your next request is refused.",
  // Server
  "server.label": "Server",
  "server.change": "Change",
  "server.field": "Server address",
  "server.hint": "For a self-hosted team or local development, enter your DSH Teamwork address, for example http://localhost:3800. You sign in again after changing it.",
  "server.saveSignOut": "Sign out and switch server",
  "server.save": "Save",
  "server.reset": "Back to {host}",
  "server.wasReset": "Back on the default server",
  "server.changed": "Server changed",
  // Phones
  "phones.title": "Devices",
  "phones.how1": "Install the DSH Teamwork app on your phone, or open My DSH in the Teamwork web console, signed in to the same account as this computer.",
  "phones.how2": "Make a code below, then scan it in the app or type it in My DSH.",
  "phones.how3": "Check that both screens show the same safety code, then confirm here.",
  "phones.step1": "Scan or enter the code",
  "phones.step2": "Check the safety code",
  "phones.step3": "Paired",
  "phones.stepsLabel": "Pairing steps",
  "phones.requestTitle": "{device} wants to pair",
  "phones.safetyLabel": "Safety code",
  "phones.confirmOrder": "First tap “Codes match” on the device, then confirm here.",
  "phones.waitDevice": "Waiting for the device to confirm…",
  "phones.pairedCount": "Paired devices · {count}",
  "phones.security": "Security",
  "phones.repairAction": "Pair again",
  "phones.pinChangeNote": "Saving closes every open device connection; each reconnects with the new PIN.",
  "phones.body": "Use the DSH on this computer from the phone app or My DSH in the Teamwork web console.",
  "relay.offTitle": "Device access is not on",
  "relay.offBody": "This server offers no device access, or this account is in no team yet.",
  "relay.connectingTitle": "Connecting to the relay…",
  "relay.connectingBody": "Pairing and unpairing wait until it connects.",
  "relay.refusedTitle": "The relay refused this computer",
  "relay.refusedBody": "This account may be in no team, its sign-in may have expired, or another DSH is connected as this computer. Joining a team reconnects it at the next sync; otherwise sign out and in again.",
  "phones.failed": "The device action did not finish",
  "phones.expiredTitle": "The pairing code expired.",
  "phones.newCode": "Make a new code",
  "phones.emptyTitle": "Use this computer’s DSH on your phone or in a browser",
  "phones.pinTitle": "Device PIN",
  "phones.pinHint": "Paired devices enter a four-digit PIN before they reach this computer.",
  "phones.pinOn": "On",
  "phones.pinOff": "Off",
  "phones.pin": "New PIN",
  "phones.pinConfirm": "Repeat PIN",
  "phones.pinMismatch": "The two PINs differ.",
  "phones.pinEnable": "Turn on",
  "phones.pinChange": "Change",
  "phones.pinSave": "Save PIN",
  "phones.pinCancel": "Cancel",
  "phones.pinDisable": "Turn off",
  "phones.pinDisableTitle": "Turn off the device PIN?",
  "phones.pinDisableBody": "Paired devices will reach this computer without a PIN. Pairing and encryption still apply.",
  "phones.webTitle": "Native DSH Web",
  "phones.webHint": "Open this DSH’s whole Web interface from My DSH on the web and from the phone app, for the account signed in here.",
  "phones.webOn": "On",
  "phones.webOff": "Off",
  "phones.webEnable": "Turn on",
  "phones.webDisable": "Turn off",
  "phones.webEnableTitle": "Turn on native DSH Web?",
  "phones.webEnableBody": "The Teamwork server will carry this DSH’s full Web interface, settings and plugins included, to the account signed in here. The server terminates its HTTPS. Signing out or changing server turns it off.",
  "phones.webTurnedOn": "Native DSH Web is on",
  "phones.webTurnedOff": "Native DSH Web is off",
  "phones.webBlockedPin": "Not available while a device PIN is set.",
  "phones.webBlockedWeb": "Needs DSH’s own Web server on this computer (dsh web).",
  "phones.webInUse": "In use now: {count} connections.",
  "phones.webLastUsed": "Last used {time}.",
  "phones.webDisconnect": "Disconnect all",
  "phones.webDisconnected": "Every native DSH Web session is ended",
  "phones.pinTurnedOn": "Device PIN on",
  "phones.pinChanged": "Device PIN changed",
  "phones.pinTurnedOff": "Device PIN off",
  "phones.pair": "Pair a device",
  "phones.requested": "asked {time}",
  "phones.waiting": "Waiting for you",
  "phones.handshake": "Setting up the encrypted connection…",
  "phones.reject": "Reject",
  "phones.rejected": "Rejected",
  "phones.accept": "Pair",
  "phones.accepted": "{device} is paired",
  "phones.lastUsed": "Last used {time}",
  "phones.pairedAt": "Paired {time}",
  "phones.repair": "Pair again",
  "phones.unpair": "Unpair",
  "phones.unpairTitle": "Unpair {device}?",
  "phones.unpairBody": "The device disconnects at once and needs a new code to reach this computer again.",
  "phones.unpaired": "Unpaired",
  "phones.scan": "Scan with the DSH Teamwork app",
  "phones.manual": "Or enter the code in the app, or in My DSH in the web console:",
  "phones.expires": "Expires in {time} · works once",
  "phones.hide": "Cancel",
  "phones.qr": "Pairing QR code",
  "devices.kind.ios": "iOS phone",
  "devices.kind.android": "Android phone",
  "devices.kind.web": "Web browser"
};
var zhCN = {
  "common.retry": "重试",
  "common.cancel": "取消",
  "common.admin": "管理员",
  "common.member": "成员",
  "common.officialService": "官方服务",
  "error.offline": "无法连接 DSH 服务。",
  "error.notLoaded": "DSH 还没有加载 Teamwork 插件的服务端，请重启 DSH。",
  "error.status": "请求失败（HTTP {status}）。",
  "load.failed": "无法读取团队状态",
  "load.stale": "状态没有刷新",
  "sync.failedTitle": "同步失败，正在使用上次同步的配置",
  "sync.failedBody": "这里的团队工具箱可能不是最新的。请稍后重试，或检查网络连接。",
  "sync.done": "团队配置已同步",
  "sync.never": "尚未同步",
  "sync.justNow": "刚刚同步",
  "sync.minutes": "{minutes} 分钟前同步",
  "sync.at": "{time} 同步",
  "sync.running": "正在同步…",
  "sync.failed": "同步失败",
  "sync.refresh": "刷新",
  "team.gone": "之前浏览的团队已不可用。",
  "nav.home": "返回团队工具箱",
  "nav.teams": "我的团队",
  "nav.chooseTeam": "选择团队",
  "nav.phones": "设备连接",
  "nav.account": "我的账号",
  "noTeam.title": "账号已连接，接下来加入团队",
  "noTeam.body": "在网页中接受邀请或创建团队，完成后回来刷新。",
  "noTeam.open": "加入或创建团队",
  "noTeam.refresh": "我已加入，刷新团队",
  "noTeam.refreshed": "团队列表已刷新",
  "choose.title": "先从哪个团队开始？",
  "choose.body": "这里只决定浏览哪个团队的工具箱，随时可以在页面顶部切换。",
  "choose.pick": "选择团队",
  "teams.title": "我的团队",
  "teams.body": "切换浏览范围不会改变已有会话或设备配对。",
  "teams.browse": "打开工具箱",
  "teams.manage": "管理团队",
  "teams.view": "查看团队",
  "teams.joinOrCreate": "加入或创建团队",
  "teams.settings": "设置",
  "team.workspaceTitle": "默认工作区",
  "team.usageTitle": "我的用量 · 近 30 天",
  "team.usageLoading": "正在读取…",
  "team.usageUnavailable": "暂时读取不到，请稍后再试。",
  "team.points": "积分",
  "team.calls": "调用",
  "team.callsNote": "模型调用次数",
  "team.unpriced": "{count} 次尚无积分",
  "team.pointsNote": "模型调用及其他计量用量",
  "team.input": "输入 Token",
  "team.inputNote": "其中缓存命中 {cached}",
  "team.output": "输出 Token",
  "team.outputNote": "其中推理 {reasoning}",
  "team.daily": "每日积分",
  "team.dayDetail": "{day} · {count} 次调用",
  "team.peak": "单日最高 {points} 积分",
  "team.noUsage": "近 30 天在这个团队没有调用。",
  "team.byModel": "按模型",
  "team.pointsCount": "{points} 积分",
  "team.callsCount": "{count} 次",
  "team.usageDetail": "在控制台查看明细",
  "team.budgetTitle": "我的预算",
  "team.budgetReset": "{time} 重置",
  "team.nearLimit": "{who}{period}预算已用 {threshold}%",
  "team.scope.team": "团队",
  "team.scope.member": "你的",
  "team.scope.provider": "某个服务商的",
  "team.period.day": "今日",
  "team.period.month": "本月",
  "teams.workspaceHint": "用该团队的预设、从手机或网页控制台新建的会话都会在这里打开。菜单里的“添加工作区…”可以选择任意文件夹。",
  "teams.workspaceSaved": "已保存{team}的默认工作区。",
  "tabs.label": "资源类型",
  "tabs.presets": "预设",
  "tabs.models": "模型",
  "tabs.plugins": "插件",
  "search.label": "搜索团队工具箱",
  "search.placeholder": "搜索名称或用途",
  "empty.noMatch": "没有匹配的资源",
  "empty.noMatchBody": "试试其他关键词或切换团队。",
  "empty.none": "这里还没有资源",
  "empty.noneBody": "管理员在网页发布后，资源会同步到这里。",
  "assistant.label": "团队助理",
  "assistant.body": "在会话里问它团队的预设、模型和插件，你的用量和预算，以及有哪些内容在等待审核。管理员还可以通过它管理团队，每一项改动都需要你批准。",
  "assistant.examples": "可以这样问",
  "assistant.example1": "我这个月用了多少？",
  "assistant.example2": "我们团队共享了哪些预设？",
  "assistant.example3": "把我本地的预设提交审核",
  "assistant.ask": "问问助理",
  "preset.sessionModel": "沿用会话模型",
  "preset.ready": "可以使用",
  "preset.checkOnStart": "启动时检查工具",
  "preset.notReady": "未就绪",
  "preset.details": "详情",
  "preset.newSession": "开启会话",
  "preset.modelGone": "预设引用的团队模型已不可用，请联系管理员。",
  "preset.pluginsNotReady": "依赖插件 {plugins} 尚未就绪。",
  "preset.toolsMissing": "缺少必需工具 {tools}，请在 DSH 插件管理器中安装或启用。",
  "preset.goInstall": "前往安装",
  "preset.model": "模型",
  "preset.tools": "工具",
  "preset.noTools": "无要求",
  "preset.required": "必需",
  "preset.optional": "可选",
  "preset.plugins": "依赖插件",
  "preset.noPlugins": "无",
  "preset.version": "版本",
  "preset.versionValue": "v{version}，管理员发布新版本后下次同步生效",
  "preset.toolsNote": "工具按当前会话检查；切换会话后和每次请求前都会重新检查。",
  "tool.available": "可用",
  "tool.conditional": "执行时检查",
  "tool.missing": "缺失",
  "tool.unknown": "待检查",
  "list.separator": "、",
  "model.body": "由团队服务器代为调用，provider 密钥留在服务器上。用它开启一个会话，其他会话和本地默认模型都不受影响。",
  "model.context": "上下文窗口 {tokens} tokens",
  "model.maxOutput": "最大输出 {tokens} tokens",
  "model.ioImage": "输入：文本和图像。输出：文本。",
  "model.ioText": "输入：文本。输出：文本。",
  "model.ioUnknown": "输入：文本。输出：文本。图像输入未配置。",
  "model.noWorkspace": "先在 DSH 添加一个工作区，再开启会话。",
  "model.noContextWindow": "团队模型「{name}」没有配置上下文窗口（contextWindow），暂时不能使用。请团队管理员在控制台补充后重新同步。",
  "model.offline": "团队模型「{name}」已被托管方下线，暂时不能使用。请改用其他模型。",
  "plugin.ready": "已启用",
  "plugin.missing": "未安装",
  "plugin.disabled": "已安装未启用",
  "plugin.versionMismatch": "本地版本不符",
  "plugin.failed": "加载失败",
  "plugin.pending": "等待加载",
  "plugin.unknown": "无法确认",
  "plugin.catalogChanged": "团队已更改版本",
  "plugin.local": "本地 {version}",
  "plugin.install": "安装",
  "plugin.managed": "在 DSH 插件管理器中管理",
  "plugin.confirmTitle": "安装并启用 {spec}？",
  "plugin.confirmBody": "这会在你的电脑上运行该插件的代码。版本由团队固定；已经装过的同名插件不会被覆盖。",
  "plugin.confirm": "安装并启用",
  "budget.loading": "预算加载中…",
  "budget.unavailable": "预算暂不可用",
  "budget.exhausted": "预算已用尽",
  "budget.unconfirmed": "预算待核实",
  "budget.remaining": "预算剩余 {points} 积分",
  "budget.tokenLimited": "已设 Token 上限",
  "budget.unlimited": "未设预算上限",
  "budget.hint": "所选团队中我的预算；模型或上游仍可能有其他限制。切换浏览的团队不改变当前会话。",
  "account.title": "我的账号",
  "account.editOnWeb": "在网页编辑资料",
  "account.noTeams": "你还没有加入团队。",
  "account.leaveTeam": "退出团队",
  "account.leaveTeamLabel": "在网页退出 {team}",
  "account.leaveTeamHint": "打开网页控制台，在团队菜单中选择「退出团队」。",
  "account.readFailed": "暂时无法读取个人资料",
  "account.unnamed": "Teamwork 用户",
  "account.noEmail": "未设置邮箱",
  "account.language": "语言",
  "account.languageSaved": "语言已更新",
  "account.connection": "DSH 连接",
  "account.restartNote": "重启 DSH 后需要重新授权。",
  "account.signOut": "退出登录",
  "account.signOutTitle": "退出 Teamwork 登录？",
  "account.signOutConfirm": "确认退出",
  "account.switch": "切换账号",
  "account.switchTitle": "切换 Teamwork 账号？",
  "account.signOutBody": "退出会移除这台 DSH 上的团队配置，断开已配对的设备，并可能影响正在运行的团队模型请求。本地会话和已安装的插件会保留。",
  "account.switchConfirm": "退出并切换",
  "account.signedOut": "已退出 Teamwork",
  "signIn.title": "登录 Teamwork",
  "signIn.reconnect": "重新连接 Teamwork",
  "signIn.lede": "团队的预设、模型和插件，一处发布，每位成员的 DSH 自动保持一致。",
  "signIn.step1": "在浏览器中登录",
  "signIn.step2Paste": "确认授权，把网页上显示的那一行粘贴到下方（两分钟内有效）",
  "signIn.step2Auto": "确认授权，这里会自动完成登录",
  "signIn.waiting": "等待浏览器确认授权，完成后这里会自动进入团队工具箱。",
  "signIn.openPage": "打开授权页面",
  "signIn.useCode": "没有自动完成？使用授权码",
  "signIn.restart": "重新开始登录",
  "signIn.expiredTitle": "本次登录等待已超时",
  "signIn.expiredBody": "请重新打开授权页面，旧页面的授权码不能用于新的登录请求。",
  "signIn.start": "在浏览器中登录",
  "signIn.pasteAuto": "没有自动完成？粘贴网页上显示的那一行",
  "signIn.paste": "网页上显示的那一行",
  "signIn.finish": "完成授权",
  "signIn.done": "已授权，团队配置已同步",
  "signIn.keysTitle": "密钥留在服务器",
  "signIn.keysBody": "团队模型由服务器代为调用，provider 密钥不会下发到这台电脑。",
  "signIn.sideTitle": "与本地配置并存",
  "signIn.sideBody": "团队配置作为独立条目加入，不覆盖你自己的模型和预设。",
  "signIn.syncTitle": "自动保持最新",
  "signIn.syncBody": "每分钟同步一次；被移出团队后，下一次请求即失效。",
  "server.label": "服务器",
  "server.change": "更改",
  "server.field": "服务器地址",
  "server.hint": "自建团队或本地开发时填写你的 DSH Teamwork 地址，例如 http://localhost:3800。更改后需要重新登录。",
  "server.saveSignOut": "退出并更换服务器",
  "server.save": "保存",
  "server.reset": "恢复为 {host}",
  "server.wasReset": "已恢复为默认服务器",
  "server.changed": "服务器已更改",
  "phones.title": "设备连接",
  "phones.how1": "在手机上装好 DSH Teamwork App，或打开 Teamwork 网页的「我的 DSH」，用和这台电脑相同的账号登录。",
  "phones.how2": "在下面生成配对码，用 App 扫码，或在「我的 DSH」中输入。",
  "phones.how3": "核对两边显示的安全码一致，在这里确认。",
  "phones.step1": "扫码或输入",
  "phones.step2": "核对安全码",
  "phones.step3": "完成",
  "phones.stepsLabel": "配对步骤",
  "phones.requestTitle": "{device} 请求配对",
  "phones.safetyLabel": "安全码",
  "phones.confirmOrder": "先在设备上点「安全码一致」，再在这里确认。",
  "phones.waitDevice": "等待设备确认…",
  "phones.pairedCount": "已配对设备 · {count}",
  "phones.security": "安全",
  "phones.repairAction": "重新配对",
  "phones.pinChangeNote": "保存后，已打开的设备连接会断开，需用新 PIN 重新连接。",
  "phones.body": "用手机 App 或网页「我的 DSH」操作这台电脑上的 DSH。",
  "relay.offTitle": "设备连接尚未开启",
  "relay.offBody": "这个服务器没有提供设备连接，或账号还没加入团队。",
  "relay.connectingTitle": "正在连接中转服务…",
  "relay.connectingBody": "连上后才能配对或解除配对。",
  "relay.refusedTitle": "中转服务拒绝了这台电脑",
  "relay.refusedBody": "账号可能不在任何团队里、登录已失效，或另一个 DSH 正以这台电脑的身份连接。加入团队后会在下次同步时自动重连；否则请退出后重新登录。",
  "phones.failed": "设备操作未完成",
  "phones.expiredTitle": "配对码已过期。",
  "phones.newCode": "重新生成",
  "phones.emptyTitle": "在手机或浏览器上用这台电脑的 DSH",
  "phones.pinTitle": "设备 PIN",
  "phones.pinHint": "已配对设备连接前需输入 4 位 PIN。",
  "phones.pinOn": "已开启",
  "phones.pinOff": "未开启",
  "phones.pin": "新 PIN",
  "phones.pinConfirm": "再次输入 PIN",
  "phones.pinMismatch": "两次输入的 PIN 不一致。",
  "phones.pinEnable": "开启",
  "phones.pinChange": "修改",
  "phones.pinSave": "保存 PIN",
  "phones.pinCancel": "取消",
  "phones.pinDisable": "关闭",
  "phones.pinDisableTitle": "关闭设备 PIN？",
  "phones.pinDisableBody": "已配对设备连接这台电脑时将不再需要 PIN。配对和加密仍然有效。",
  "phones.webTitle": "原生 DSH Web",
  "phones.webHint": "让这里登录的账号可以从网页版「我的 DSH」和手机 App 打开这台 DSH 的完整 Web 界面。",
  "phones.webOn": "已开启",
  "phones.webOff": "未开启",
  "phones.webEnable": "开启",
  "phones.webDisable": "关闭",
  "phones.webEnableTitle": "开启原生 DSH Web？",
  "phones.webEnableBody": "Teamwork 服务器将把这台 DSH 的完整 Web 界面（包括设置和插件）提供给这里登录的账号，HTTPS 由服务器终止。退出登录或切换服务器会自动关闭。",
  "phones.webTurnedOn": "原生 DSH Web 已开启",
  "phones.webTurnedOff": "原生 DSH Web 已关闭",
  "phones.webBlockedPin": "设置了设备 PIN 时不可用。",
  "phones.webBlockedWeb": "需要这台电脑运行 DSH 自己的 Web 服务（dsh web）。",
  "phones.webInUse": "正在使用：{count} 个连接。",
  "phones.webLastUsed": "最近使用：{time}。",
  "phones.webDisconnect": "断开所有访问",
  "phones.webDisconnected": "已断开所有原生 DSH Web 访问",
  "phones.pinTurnedOn": "设备 PIN 已开启",
  "phones.pinChanged": "设备 PIN 已修改",
  "phones.pinTurnedOff": "设备 PIN 已关闭",
  "phones.pair": "配对新设备",
  "phones.requested": "{time} 申请",
  "phones.waiting": "等待你确认",
  "phones.handshake": "正在建立加密连接…",
  "phones.reject": "拒绝",
  "phones.rejected": "已拒绝",
  "phones.accept": "确认配对",
  "phones.accepted": "{device} 已配对",
  "phones.lastUsed": "最近使用 {time}",
  "phones.pairedAt": "配对于 {time}",
  "phones.repair": "需重新配对",
  "phones.unpair": "解除配对",
  "phones.unpairTitle": "解除与 {device} 的配对？",
  "phones.unpairBody": "这台设备会立即断开，之后需要重新输入配对码才能再连到这台电脑。",
  "phones.unpaired": "已解除配对",
  "phones.scan": "用 DSH Teamwork App 扫码",
  "phones.manual": "或在 App、网页「我的 DSH」中输入：",
  "phones.expires": "{time} 后失效 · 只能用一次",
  "phones.hide": "取消",
  "phones.qr": "配对二维码",
  "devices.kind.ios": "iOS 手机",
  "devices.kind.android": "Android 手机",
  "devices.kind.web": "网页浏览器"
};
var catalogs = { en, "zh-CN": zhCN };
function words(locale) {
  return Object.assign(translator(catalogs, locale), { locale });
}
var Words = (0, import_react4.createContext)(words("en"));
function useT() {
  return (0, import_react4.useContext)(Words);
}

// src/web/TeamworkPanel.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var REFRESH_MS = 5e3;
var SUMMARY_MS = 3e4;
var views = /* @__PURE__ */ new Map();
var pluginText = {
  ready: ["plugin.ready", "success"],
  missing: ["plugin.missing", "warning"],
  disabled: ["plugin.disabled", "warning"],
  "version-mismatch": ["plugin.versionMismatch", "warning"],
  failed: ["plugin.failed", "danger"],
  pending: ["plugin.pending", "warning"],
  unknown: ["plugin.unknown", "neutral"],
  "catalog-changed": ["plugin.catalogChanged", "warning"]
};
var toolText = {
  available: ["tool.available", "success"],
  conditional: ["tool.conditional", "neutral"],
  missing: ["tool.missing", "warning"],
  unknown: ["tool.unknown", "neutral"]
};
var host = (server) => server.replace(/^https?:\/\//, "");
var missingTools = (preset) => preset.tools.filter((t) => t.required && (t.state === "missing" || t.state === "unknown"));
var pluginsNotReady = (preset) => preset.plugins.filter((p) => p.state !== "ready");
var role = (t, value) => t(value === "admin" ? "common.admin" : "common.member");
var open = (url) => window.open(url, "_blank", "noopener");
function describe(t, error) {
  if (error instanceof HostUnreachable) {
    return error.reason === "offline" ? t("error.offline") : error.reason === "not-loaded" ? t("error.notLoaded") : t("error.status", { status: error.status ?? "" });
  }
  return error.message;
}
function synced(t, iso) {
  if (!iso) return t("sync.never");
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1e3));
  if (seconds < 60) return t("sync.justNow");
  if (seconds < 3600) return t("sync.minutes", { minutes: Math.round(seconds / 60) });
  return t("sync.at", { time: new Date(iso).toLocaleTimeString(t.locale) });
}
function useSummary(team, revision) {
  const [summary, setSummary] = (0, import_react5.useState)();
  (0, import_react5.useEffect)(() => {
    setSummary(void 0);
    if (!team) return;
    let active = true;
    let timer;
    const load = async () => {
      let next = null;
      try {
        next = await api.summary(team);
      } catch {
      }
      if (active) {
        setSummary(next);
        timer = setTimeout(load, SUMMARY_MS);
      }
    };
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [team, revision]);
  return summary;
}
function TeamworkPanel({ host: dsh, renderFactorySlot }) {
  const currentSession = (0, import_react5.useRef)(dsh.currentSession ?? currentSessionTracker(dsh.sessions.list)).current;
  const sessionId = (0, import_react5.useSyncExternalStore)(dsh.sessions.list.subscribe, currentSession);
  const [snapshot, setState] = (0, import_react5.useState)();
  const [loadedSession, setLoadedSession] = (0, import_react5.useState)();
  const state = snapshot && (loadedSession === sessionId ? snapshot : { ...snapshot, session: null });
  const [loadError, setLoadError] = (0, import_react5.useState)();
  const [tab, setTab] = (0, import_react5.useState)("presets");
  const [page, setPage] = (0, import_react5.useState)("resources");
  const [settingsTeam, setSettingsTeam] = (0, import_react5.useState)();
  const [selectedTeam, setTeam] = (0, import_react5.useState)("");
  const browsed = state?.authenticated ? state.teams.find((x) => x.id === selectedTeam) ?? state.teams[0] : void 0;
  const team = browsed?.id ?? "";
  const [query, setQuery] = (0, import_react5.useState)("");
  const [profile, setProfile] = (0, import_react5.useState)();
  const [profileError, setProfileError] = (0, import_react5.useState)();
  const [profileAttempt, setProfileAttempt] = (0, import_react5.useState)(0);
  const identity = (0, import_react5.useRef)();
  const touched = (0, import_react5.useRef)(false);
  const browsing = (0, import_react5.useRef)({ team, tab, query });
  browsing.current = { team, tab, query };
  const latest = (0, import_react5.useRef)(state);
  latest.current = state;
  const request = (0, import_react5.useRef)();
  const context = (0, import_react5.useRef)(sessionId);
  context.current = sessionId;
  const [toast, setToast] = (0, import_react5.useState)();
  const toastTimer = (0, import_react5.useRef)();
  const locale = state?.locale ?? (navigator.language?.toLowerCase().startsWith("zh") ? "zh-CN" : "en");
  const t = (0, import_react5.useMemo)(() => words(locale), [locale]);
  const refresh = (0, import_react5.useCallback)(() => {
    if (request.current) return request.current;
    const session = context.current;
    request.current = (async () => {
      try {
        const next = await api.state(session);
        if (context.current === session) {
          setLoadedSession(session);
          setState(next);
          setLoadError(void 0);
        }
      } catch (error) {
        setLoadError(error);
      } finally {
        request.current = void 0;
      }
    })();
    return request.current;
  }, []);
  (0, import_react5.useEffect)(() => {
    let disposed = false;
    let timer;
    const poll = async () => {
      await request.current;
      if (disposed) return;
      await refresh();
      if (!disposed) timer = setTimeout(poll, REFRESH_MS);
    };
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [refresh, sessionId]);
  const authenticated = state?.authenticated, server = state?.server;
  (0, import_react5.useEffect)(() => {
    identity.current = void 0;
    touched.current = false;
    setProfile(void 0);
    setPage("resources");
    setTeam("");
    setQuery("");
  }, [authenticated, server]);
  (0, import_react5.useEffect)(() => {
    setProfileError(void 0);
    if (!authenticated) return;
    let cancelled = false;
    void api.profile().then((next) => {
      if (cancelled) return;
      setProfile(next);
      void refresh();
      const key = `teamwork:team:${server}:${next.id}`;
      if (identity.current === key) return;
      identity.current = key;
      if (touched.current) {
        try {
          localStorage.setItem(key, browsing.current.team);
        } catch {
        }
        return;
      }
      const view = views.get(key);
      setTab(view?.tab ?? "presets");
      setQuery(view?.query ?? "");
      let saved = null;
      try {
        saved = localStorage.getItem(key);
      } catch {
      }
      saved ?? (saved = view?.team ?? null);
      const teams = latest.current?.teams ?? [];
      setTeam(teams.find((t2) => t2.id === saved)?.id ?? teams[0]?.id ?? "");
      if (saved === null && teams.length > 1) setPage("choose");
    }).catch((error) => {
      if (!cancelled) setProfileError(error);
    });
    return () => {
      cancelled = true;
    };
  }, [authenticated, server, profileAttempt]);
  (0, import_react5.useEffect)(() => {
    if (profile && identity.current) views.set(identity.current, { team, tab, query });
  }, [profile, team, tab, query]);
  const navigate = (next) => {
    touched.current = true;
    if (next === "profile" && profile) setProfileAttempt((n) => n + 1);
    setPage(next);
  };
  const openTeamSettings = (id) => {
    setSettingsTeam(id);
    navigate("team");
  };
  const selectTeam = (id) => {
    touched.current = true;
    setTeam(id);
    setPage("resources");
    setQuery("");
    if (profile) try {
      localStorage.setItem(`teamwork:team:${server}:${profile.id}`, id);
    } catch {
    }
  };
  (0, import_react5.useEffect)(() => {
    if (authenticated && selectedTeam && selectedTeam !== team) {
      setTeam(team);
      setQuery("");
      if (profile) try {
        localStorage.setItem(`teamwork:team:${server}:${profile.id}`, team);
      } catch {
      }
      notify(t("team.gone"));
    }
  }, [authenticated, selectedTeam, team]);
  const notify = (0, import_react5.useCallback)((message, tone = "neutral") => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(void 0), tone === "danger" ? 6e3 : 3e3);
  }, []);
  (0, import_react5.useEffect)(() => () => clearTimeout(toastTimer.current), []);
  const run = (0, import_react5.useCallback)(async (action, done) => {
    try {
      const result = await action();
      const message = typeof done === "function" ? done(result) : done;
      if (message) notify(message);
      return true;
    } catch (error) {
      notify(describe(t, error), "danger");
      return false;
    } finally {
      await request.current;
      await refresh();
    }
  }, [notify, refresh, t]);
  const summary = useSummary(browsed?.id, `${state?.server}:${state?.authRevision}`);
  const toastNode = toast && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Toast, { tone: toast.tone, children: toast.message });
  const retry = /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", icon: "refresh", onClick: () => void refresh(), children: t("common.retry") });
  if (!state) {
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Words.Provider, { value: t, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Panel, { label: "Teamwork", header: loadError ? void 0 : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(HeaderSkeleton, {}), children: loadError ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Banner, { tone: "danger", title: t("load.failed"), action: retry, children: describe(t, loadError) }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ListSkeleton, {}) }) });
  }
  if (!state.authenticated) {
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Words.Provider, { value: t, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Panel, { label: "Teamwork", centered: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(SignIn, { state, run }),
      toastNode
    ] }) });
  }
  const inTeam = (item) => item.teamId === team;
  const matches = (item) => `${item.name} ${item.description ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const presets = state.presets.filter(inTeam), models = state.models.filter(inTeam), plugins = state.plugins.filter(inTeam);
  const assistants = query ? [] : presets.filter((p) => p.assistant);
  const listed = (tab === "presets" ? presets.filter((p) => !assistants.includes(p)) : tab === "models" ? models : plugins).filter(matches);
  const tabs = [{ id: "presets", label: t("tabs.presets"), count: presets.length }, { id: "models", label: t("tabs.models"), count: models.length }, { id: "plugins", label: t("tabs.plugins"), count: plugins.length }];
  const choosing = page === "choose" && state.teams.length > 1;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Words.Provider, { value: t, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    Panel,
    {
      label: "Teamwork",
      header: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Header, { state, page, team, selectTeam, navigate }),
      footer: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Footer, { state, connectionOpen: page === "connection", openConnection: () => navigate("connection"), budget: browsed ? summary === void 0 ? void 0 : summary?.budget ?? null : false, run }),
      children: [
        loadError !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Banner, { tone: "danger", title: t("load.stale"), action: retry, children: describe(t, loadError) }),
        state.sync.lastError && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Banner, { tone: "warning", title: t("sync.failedTitle"), action: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", icon: "refresh", onClick: () => run(() => api.sync(), t("sync.done")), children: t("common.retry") }), children: t("sync.failedBody") }),
        choosing ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(TeamChooser, { state, select: selectTeam }) : (page === "resources" || page === "choose") && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_jsx_runtime8.Fragment, { children: !state.teams.length ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(EmptyState, { icon: "layers", title: t("noTeam.title"), action: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { trailingIcon: "external", onClick: () => open(`${state.server}/teams`), children: t("noTeam.open") }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { icon: "refresh", onClick: () => run(() => api.sync(), t("noTeam.refreshed")), children: t("noTeam.refresh") })
        ] }), children: t("noTeam.body") }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-resource-toolbar", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Tabs, { label: t("tabs.label"), items: tabs, value: tab, onChange: setTab }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-resource-toolbar-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Input, { "aria-label": t("search.label"), placeholder: t("search.placeholder"), value: query, onChange: (e) => setQuery(e.target.value) }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { icon: "settings", onClick: () => openTeamSettings(team), children: t("teams.settings") })
            ] })
          ] }),
          tab === "presets" && assistants.map((p) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(AssistantItem, { preset: p, state, dsh }, p.id)),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-resource-list", children: [
            tab === "presets" && listed.map((p) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PresetItem, { preset: p, state, dsh, onInstall: () => setTab("plugins") }, p.id)),
            tab === "models" && listed.map((m) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ModelItem, { model: m, state, dsh, run }, m.id)),
            tab === "plugins" && listed.map((p) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PluginItem, { plugin: p, run }, p.id)),
            !listed.length && !(tab === "presets" && assistants.length) && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(EmptyState, { icon: "layers", title: query ? t("empty.noMatch") : t("empty.none"), children: query ? t("empty.noMatchBody") : t("empty.noneBody") })
          ] }, `${team}:${tab}`)
        ] }) }),
        page === "devices" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Phones, { state, run }),
        page === "teams" && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PageTitle, { title: t("teams.title"), children: t("teams.body") }),
          state.teams.map((x) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Item, { icon: "layers", title: x.name, onActivate: () => selectTeam(x.id), tags: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: x.role === "admin" ? "brand" : "neutral", children: role(t, x.role) }), actions: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { icon: "settings", onClick: () => openTeamSettings(x.id), children: t("teams.settings") }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", trailingIcon: "external", onClick: () => open(x.consoleUrl), children: t(x.role === "admin" ? "teams.manage" : "teams.view") })
          ] }) }, x.id)),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { trailingIcon: "external", onClick: () => open(`${state.server}/teams`), children: t("teams.joinOrCreate") }) })
        ] }),
        page === "team" && (() => {
          const settings = state.teams.find((x) => x.id === settingsTeam);
          return settings ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(TeamSettings, { team: settings, locale: state.locale, dsh, renderFactorySlot, run, browse: () => selectTeam(settings.id) }, settings.id) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PageTitle, { title: t("teams.title"), children: t("teams.body") }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { onClick: () => navigate("teams"), children: t("nav.teams") }) })
          ] });
        })(),
        page === "profile" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          Account,
          {
            state,
            profile,
            error: profileError,
            retry: () => setProfileAttempt((n) => n + 1),
            run,
            selectTeam,
            onLocaleChange: async (locale2) => {
              if (!profile) return;
              await run(async () => {
                const next = await api.updateProfile({ locale: locale2 });
                if (identity.current === `teamwork:team:${state.server}:${next.id}`) setProfile(next);
              }, words(locale2)("account.languageSaved"));
            }
          }
        ),
        page === "connection" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Connection, { state, run }),
        toastNode
      ]
    }
  ) });
}
function TeamWorkspace({ team, dsh, renderFactorySlot, run }) {
  const t = useT();
  const anchor = (0, import_react5.useRef)(null);
  const [open2, setOpen] = (0, import_react5.useState)(false);
  const current = (0, import_react5.useSyncExternalStore)((listener) => dsh.workspaces.list.subscribe(listener), () => workspaceAt(dsh, team.workspace));
  if (!team.workspace) return null;
  const pick = async (workspaceId) => {
    setOpen(false);
    const path = await workspacePath(dsh, workspaceId);
    if (path) await run(() => api.setWorkspace(team.id, path), t("teams.workspaceSaved", { team: team.name }));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { gap: 8 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { ref: anchor, "aria-haspopup": "menu", "aria-expanded": open2, title: team.workspace, onClick: () => setOpen((value) => !value), children: current?.title ?? team.workspace.split(/[\\/]/).filter(Boolean).pop() ?? team.workspace }),
      renderFactorySlot("workspace.picker", { open: open2, anchorRef: anchor, selectedId: current?.workspaceId, onPick: (id) => void pick(id), onClose: () => setOpen(false) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-muted", children: t("teams.workspaceHint") })
  ] });
}
function TeamSettings({ team, locale, dsh, renderFactorySlot, run, browse }) {
  const t = useT();
  const [usage, setUsage] = (0, import_react5.useState)();
  const [failure, setFailure] = (0, import_react5.useState)();
  (0, import_react5.useEffect)(() => {
    let alive = true;
    api.teamUsage(team.id).then((next) => {
      if (alive) setUsage(next);
    }, (error) => {
      if (alive) {
        setUsage(null);
        setFailure(describe(t, error));
      }
    });
    return () => {
      alive = false;
    };
  }, [team.id]);
  const unavailable = /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { gap: 4 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-muted", children: t("team.usageUnavailable") }),
    failure && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-subtle", children: failure })
  ] });
  const section = (title) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h3", { style: { fontSize: 15, fontWeight: 600 }, children: title });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", style: { justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { minWidth: 0, flex: "1 1 240px", gap: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h2", { className: "twui-page-title", children: team.name }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: team.role === "admin" ? "brand" : "neutral", children: role(t, team.role) }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", style: { gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { onClick: browse, children: t("teams.browse") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", trailingIcon: "external", onClick: () => open(team.consoleUrl), children: t(team.role === "admin" ? "teams.manage" : "teams.view") })
      ] })
    ] }),
    team.workspace && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
      section(t("team.workspaceTitle")),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(TeamWorkspace, { team, dsh, renderFactorySlot, run }) })
    ] }),
    section(t("team.usageTitle")),
    usage === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-muted", children: t("team.usageLoading") }) }) : usage === null ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { children: unavailable }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(UsageTotals, { usage }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(UsageDaily, { usage }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { gap: 12 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h4", { style: { fontSize: 14, fontWeight: 600 }, children: t("team.byModel") }),
        usage.sources.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-muted", children: t("team.noUsage") }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("ul", { style: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }, "aria-label": t("team.byModel"), children: usage.sources.slice(0, 8).map((source) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("li", { className: "twui-row", style: { justifyContent: "space-between", gap: 12 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: source.labels[locale] ?? source.name }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "twui-subtle", style: { whiteSpace: "nowrap" }, children: [
            t("team.pointsCount", { points: formatPoints(source.points, t.locale) }),
            " · ",
            t("team.callsCount", { count: source.calls })
          ] })
        ] }, `${source.kind}:${source.name}`)) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "ghost", trailingIcon: "external", onClick: () => open(`${team.consoleUrl}/my-usage`), children: t("team.usageDetail") }) })
      ] }) })
    ] }),
    section(t("team.budgetTitle")),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { children: usage === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-muted", children: t("team.usageLoading") }) : usage === null ? unavailable : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontWeight: 600 }, children: budgetLabel(t, usage.budget) }),
      usage.budget.resetAt && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-subtle", children: t("team.budgetReset", { time: shortTime(t, usage.budget.resetAt) }) }),
      usage.nearLimit.map((limit) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Notice, { tone: limit.threshold >= 100 ? "danger" : "warning", children: t("team.nearLimit", { who: t(`team.scope.${limit.scope}`), period: t(`team.period.${limit.period}`), threshold: String(limit.threshold) }) }, `${limit.scope}:${limit.period}:${limit.threshold}`))
    ] }) })
  ] });
}
function formatPoints(value, locale) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value).trim());
  if (!match) return String(value);
  const [, sign, whole, fraction = ""] = match;
  const rounded = Number(whole) + (fraction !== "" && fraction[0] >= "5" ? 1 : 0);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(sign && rounded !== 0 ? -rounded : rounded);
}
function UsageTotals({ usage }) {
  const t = useT();
  const number = new Intl.NumberFormat(t.locale);
  const { totals } = usage;
  const cells = [
    { label: t("team.calls"), value: number.format(totals.calls), note: totals.unpriced > 0 ? t("team.unpriced", { count: totals.unpriced }) : t("team.callsNote") },
    { label: t("team.points"), value: formatPoints(totals.points, t.locale), note: t("team.pointsNote") },
    { label: t("team.input"), value: number.format(totals.input), note: t("team.inputNote", { cached: number.format(totals.cacheRead) }) },
    { label: t("team.output"), value: number.format(totals.output), note: t("team.outputNote", { reasoning: number.format(totals.reasoning) }) }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dl", { className: "twui-card", style: { margin: 0, overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 1, background: "var(--twui-border)" }, children: cells.map((cell) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { gap: 2, padding: 16, background: "var(--twui-surface)" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dt", { className: "twui-muted", children: cell.label }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dd", { style: { margin: 0, fontSize: 22, fontWeight: 650, fontVariantNumeric: "tabular-nums" }, children: cell.value }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dd", { className: "twui-subtle", style: { margin: 0 }, children: cell.note })
  ] }, cell.label)) });
}
function UsageDaily({ usage }) {
  const t = useT();
  const [active, setActive] = (0, import_react5.useState)(null);
  const { days } = usage;
  const values = days.map((day) => Number(day.points));
  const max = Math.max(0, ...values);
  const date = new Intl.DateTimeFormat(t.locale, { month: "short", day: "numeric" });
  const label = (day) => date.format(/* @__PURE__ */ new Date(`${day}T00:00:00`));
  const shown = active === null ? void 0 : days[active];
  const ticks = days.length === 0 ? [] : [0, Math.floor((days.length - 1) / 2), days.length - 1];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { gap: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", style: { justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h4", { style: { fontSize: 14, fontWeight: 600 }, children: t("team.daily") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { "aria-live": "polite", style: { margin: 0, fontVariantNumeric: "tabular-nums" }, children: shown ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontWeight: 600 }, children: t("team.pointsCount", { points: formatPoints(shown.points, t.locale) }) }),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-muted", children: t("team.dayDetail", { day: label(shown.day), count: shown.calls }) })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-muted", children: t("team.peak", { points: formatPoints(max, t.locale) }) }) })
    ] }),
    max === 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-muted", style: { padding: "32px 0", textAlign: "center" }, children: t("team.noUsage") }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { display: "flex", alignItems: "flex-end", gap: 2, height: 140, borderBottom: "1px solid var(--twui-border)" }, onPointerLeave: () => setActive(null), children: days.map((day, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "button",
        {
          type: "button",
          "aria-label": `${label(day.day)}: ${t("team.pointsCount", { points: formatPoints(day.points, t.locale) })}, ${t("team.callsCount", { count: day.calls })}`,
          onPointerEnter: () => setActive(i),
          onFocus: () => setActive(i),
          onBlur: () => setActive(null),
          style: { flex: "1 1 0", minWidth: 0, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0, border: 0, background: "none", cursor: "default" },
          children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { width: "100%", maxWidth: 24, height: `${values[i] / max * 100}%`, borderRadius: "4px 4px 0 0", background: "var(--twui-accent)", opacity: active === i ? 1 : 0.75 } })
        },
        day.day
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "twui-subtle", style: { position: "relative", height: 16, marginTop: 6 }, children: ticks.map((i, n) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { position: "absolute", ...n === 0 ? { left: 0 } : n === 1 ? { left: "50%", transform: "translateX(-50%)" } : { right: 0 } }, children: label(days[i].day) }, n)) })
    ] })
  ] }) });
}
function workspacePath(dsh, workspaceId) {
  const find = () => dsh.workspaces.list.getSnapshot().items.find((workspace) => workspace.workspaceId === workspaceId)?.path;
  return find() ?? new Promise((resolve) => {
    const stop = dsh.workspaces.list.subscribe(() => {
      const path = find();
      if (path) {
        stop();
        clearTimeout(timer);
        resolve(path);
      }
    });
    const timer = setTimeout(() => {
      stop();
      resolve(void 0);
    }, 5e3);
  });
}
function PageTitle({ title, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h2", { className: "twui-page-title", children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-muted", children })
  ] });
}
function TeamChooser({ state, select }) {
  const t = useT();
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PageTitle, { title: t("choose.title"), children: t("choose.body") }),
    state.teams.map((x) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Item, { icon: "layers", title: x.name, tags: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: x.role === "admin" ? "brand" : "neutral", children: role(t, x.role) }), actions: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { onClick: () => select(x.id), children: t("choose.pick") }) }, x.id))
  ] });
}
function Account({ state, profile, error, retry, run, selectTeam, onLocaleChange }) {
  const t = useT();
  const [savingLanguage, setSavingLanguage] = (0, import_react5.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-account", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row twui-account-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h2", { className: "twui-page-title", children: t("account.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("a", { className: "twui-btn", href: `${state.server}/account`, target: "_blank", rel: "noopener noreferrer", children: [
        t("account.editOnWeb"),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "external", size: 14 })
      ] })
    ] }),
    error !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Banner, { tone: "warning", title: t("account.readFailed"), action: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { onClick: retry, children: t("common.retry") }), children: describe(t, error) }) : !profile ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ListSkeleton, {}) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Card, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-account-identity", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Monogram, { text: profile.name || profile.email || "T", size: 44 }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { children: profile.name || t("account.unnamed") }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-muted", children: profile.email || t("account.noEmail") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "twui-account-language", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: t("account.language"), htmlFor: "teamwork-locale", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Select,
        {
          id: "teamwork-locale",
          label: t("account.language"),
          value: profile.locale ?? t.locale,
          disabled: savingLanguage,
          options: [{ value: "en", label: "English" }, { value: "zh-CN", label: "简体中文" }],
          onChange: async (locale) => {
            setSavingLanguage(true);
            try {
              await onLocaleChange(locale);
            } finally {
              setSavingLanguage(false);
            }
          }
        }
      ) }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("section", { className: "twui-stack", "aria-labelledby": "teamwork-account-teams", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h3", { id: "teamwork-account-teams", children: t("nav.teams") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { children: state.teams.length ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("ul", { className: "twui-account-teams", children: state.teams.map((team) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("li", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { type: "button", className: "twui-account-team", onClick: () => selectTeam(team.id), children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: team.name }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: team.role === "admin" ? "brand" : "neutral", children: role(t, team.role) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "chevronRight", size: 14 })
        ] }),
        team.role === "member" && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "a",
          {
            className: "twui-btn twui-account-team-leave",
            "data-variant": "ghost",
            href: team.consoleUrl,
            target: "_blank",
            rel: "noopener noreferrer",
            "aria-label": t("account.leaveTeamLabel", { team: team.name }),
            title: t("account.leaveTeamHint"),
            children: [
              t("account.leaveTeam"),
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "external", size: 14 })
            ]
          }
        )
      ] }, team.id)) }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-muted", children: t("account.noTeams") }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(SignOutAction, { run })
  ] });
}
function Connection({ state, run }) {
  const t = useT();
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-account", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h2", { className: "twui-page-title", children: t("account.connection") }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ServerSetting, { state, run }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-subtle", children: t("account.restartNote") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(SignOutAction, { run, switchAccount: true })
    ] })
  ] });
}
function SignOutAction({ run, switchAccount = false }) {
  const t = useT();
  const [confirm, setConfirm] = (0, import_react5.useState)(false);
  const [busy, setBusy] = (0, import_react5.useState)(false);
  const signOut = async () => {
    setBusy(true);
    await run(() => api.logout(), t("account.signedOut"));
    setBusy(false);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack twui-sign-out", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "danger", icon: "logout", disabled: busy, "aria-expanded": confirm, onClick: () => setConfirm((open2) => !open2), children: t(switchAccount ? "account.switch" : "account.signOut") }) }),
    confirm && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      Confirm,
      {
        title: t(switchAccount ? "account.switchTitle" : "account.signOutTitle"),
        description: t("account.signOutBody"),
        confirmLabel: t(switchAccount ? "account.switchConfirm" : "account.signOutConfirm"),
        cancelLabel: t("common.cancel"),
        busy,
        onCancel: () => setConfirm(false),
        onConfirm: signOut
      }
    )
  ] });
}
function SignIn({ state, run }) {
  const t = useT();
  const [opened, setOpened] = (0, import_react5.useState)(null);
  const [code, setCode] = (0, import_react5.useState)("");
  const [busy, setBusy] = (0, import_react5.useState)(false);
  const [error, setError] = (0, import_react5.useState)();
  const [expired, setExpired] = (0, import_react5.useState)(false);
  const locked = (0, import_react5.useRef)(false);
  (0, import_react5.useEffect)(() => {
    if (!opened) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, opened.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [opened]);
  const begin = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(void 0);
    try {
      await run(async () => {
        try {
          const { url, automatic } = await api.login();
          setOpened({ automatic, url, expiresAt: Date.now() + 10 * 60 * 1e3 });
          setExpired(false);
          setCode("");
          open(url);
        } catch (failure) {
          setError(failure);
          throw failure;
        }
      });
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const authorize = async () => {
    if (locked.current) return;
    locked.current = true;
    setError(void 0);
    setBusy(true);
    try {
      await run(async () => {
        try {
          await api.authorize(code.trim());
        } catch (failure) {
          setError(failure);
          throw failure;
        }
      }, t("signIn.done"));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const pasteForm = /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("form", { style: { display: "grid", gap: 12 }, onSubmit: (e) => {
    e.preventDefault();
    if (code.trim()) void authorize();
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: opened?.automatic ? t("signIn.pasteAuto") : t("signIn.paste"), htmlFor: "teamwork-code", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      Input,
      {
        id: "teamwork-code",
        size: "lg",
        className: "twui-mono",
        value: code,
        onChange: (e) => setCode(e.target.value),
        placeholder: "/teamwork authorize eyJhbGci…",
        autoComplete: "off",
        spellCheck: false,
        autoFocus: !opened?.automatic
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { type: "submit", variant: opened?.automatic ? "secondary" : "primary", size: "lg", block: true, busy, disabled: !code.trim() || expired, children: t("signIn.finish") })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { width: "100%", maxWidth: 440, margin: "0 auto", display: "grid", gap: 24, padding: "24px 0" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "grid", justifyItems: "center", gap: 12, textAlign: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BrandMark, { size: 56, title: "DSH Teamwork" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "grid", gap: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h1", { style: { fontSize: 20, fontWeight: 650, letterSpacing: "-0.01em" }, children: state.teams.length ? t("signIn.reconnect") : t("signIn.title") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-muted", children: t("signIn.lede") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { padding: 20, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "grid", gap: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("ol", { style: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Step, { n: 1, state: opened ? "done" : "active", children: t("signIn.step1") }),
        opened?.automatic === false ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Step, { n: 2, state: "active", children: t("signIn.step2Paste") }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Step, { n: 2, state: opened ? "active" : "todo", children: t("signIn.step2Auto") })
      ] }),
      error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Notice, { tone: "danger", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { role: "alert", children: describe(t, error) }) }),
      expired ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Banner, { tone: "warning", title: t("signIn.expiredTitle"), action: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { busy, onClick: () => void begin(), children: t("signIn.restart") }), children: t("signIn.expiredBody") }) : opened ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        opened.automatic && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { role: "status", className: "twui-muted", children: t("signIn.waiting") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("a", { className: "twui-link", href: opened.url, target: "_blank", rel: "noopener noreferrer", children: t("signIn.openPage") }),
        opened.automatic ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("details", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("summary", { className: "twui-link", children: t("signIn.useCode") }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { paddingTop: 12 }, children: pasteForm })
        ] }) : pasteForm,
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", size: "sm", busy, onClick: () => void begin(), children: t("signIn.restart") })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "primary", size: "lg", block: true, trailingIcon: "external", busy, onClick: () => void begin(), children: t("signIn.start") })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("ul", { style: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Point, { icon: "shield", title: t("signIn.keysTitle"), children: t("signIn.keysBody") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Point, { icon: "layers", title: t("signIn.sideTitle"), children: t("signIn.sideBody") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Point, { icon: "sync", title: t("signIn.syncTitle"), children: t("signIn.syncBody") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ServerSetting, { state, run })
  ] });
}
function Step({ n, state, children }) {
  const done = state === "done";
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("li", { style: { display: "flex", alignItems: "center", gap: 10, color: state === "todo" ? "var(--twui-fg-subtle)" : "var(--twui-fg)" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { "aria-hidden": "true", style: {
      width: 22,
      height: 22,
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      flex: "none",
      fontSize: 12,
      fontWeight: 600,
      border: `1px solid ${state === "todo" ? "var(--twui-border-strong)" : "transparent"}`,
      background: done ? "var(--twui-success)" : state === "active" ? "var(--twui-primary)" : "transparent",
      color: done || state === "active" ? "var(--twui-primary-fg)" : "inherit"
    }, children: done ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "check", size: 13 }) : n }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children })
  ] });
}
function Point({ icon, title, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("li", { style: { display: "flex", gap: 12, alignItems: "flex-start" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-tile", style: { width: 32, height: 32 }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: icon, size: 16 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "grid", gap: 2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { style: { fontWeight: 600 }, children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-muted", children })
    ] })
  ] });
}
function ServerSetting({ state, run }) {
  const t = useT();
  const [editing, setEditing] = (0, import_react5.useState)(false);
  const [value, setValue] = (0, import_react5.useState)(state.server);
  const [error, setError] = (0, import_react5.useState)();
  const [busy, setBusy] = (0, import_react5.useState)(false);
  const isDefault = state.server === state.defaultServer;
  const save = async (server) => {
    setBusy(true);
    setError(void 0);
    try {
      await api.setServer(server);
      setEditing(false);
      await run(async () => void 0, server === null ? t("server.wasReset") : t("server.changed"));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  if (!editing) {
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-card", style: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", boxShadow: "none" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: "var(--twui-fg-subtle)" }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "server", size: 16 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { flex: 1, minWidth: 0, display: "grid" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-subtle", children: t("server.label") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "twui-row", style: { gap: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-mono", style: { overflowWrap: "anywhere" }, children: host(state.server) }),
          isDefault && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: "accent", children: t("common.officialService") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", onClick: () => {
        setValue(state.server);
        setEditing(true);
      }, children: t("server.change") })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "form",
    {
      className: "twui-card",
      style: { display: "grid", gap: 12, padding: 16, boxShadow: "none" },
      onSubmit: (e) => {
        e.preventDefault();
        void save(value);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: t("server.field"), htmlFor: "teamwork-server", error: error === void 0 ? void 0 : describe(t, error), hint: t("server.hint"), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          Input,
          {
            id: "teamwork-server",
            className: "twui-mono",
            value,
            onChange: (e) => setValue(e.target.value),
            "aria-invalid": error !== void 0 ? true : void 0,
            autoComplete: "off",
            spellCheck: false,
            autoFocus: true
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { type: "submit", variant: "primary", size: "sm", busy, disabled: !value.trim() || value.trim() === state.server, children: state.authenticated ? t("server.saveSignOut") : t("server.save") }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", size: "sm", disabled: busy, onClick: () => {
            setEditing(false);
            setError(void 0);
          }, children: t("common.cancel") }),
          !isDefault && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "twui-link", style: { marginLeft: "auto", fontSize: 12 }, disabled: busy, onClick: () => void save(null), children: t("server.reset", { host: host(state.defaultServer) }) })
        ] })
      ]
    }
  );
}
function Header({ state, page, team, selectTeam, navigate }) {
  const t = useT();
  const pending = state.phones.filter((p) => p.status === "pending").length;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-brand-lockup", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "twui-brand-home", "aria-label": t("nav.home"), onClick: () => navigate("resources"), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BrandMark, { size: 32, title: "DSH Teamwork" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row twui-team-scope", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", onClick: () => navigate("teams"), children: t("nav.teams") }),
        !!state.teams.length && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "chevronRight", size: 14 }),
          state.teams.length === 1 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", className: "twui-team-name", onClick: () => navigate("resources"), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: state.teams[0].name }) }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Select, { label: t("nav.chooseTeam"), value: team, onActivate: () => navigate("resources"), onChange: selectTeam, options: state.teams.map((x) => ({ value: x.id, label: x.name, description: role(t, x.role) })) })
        ] }),
        state.teams.find((x) => x.id === team)?.role === "admin" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: "brand", children: t("common.admin") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row twui-header-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Button, { variant: "ghost", icon: "smartphone", "aria-current": page === "devices" ? "page" : void 0, onClick: () => navigate("devices"), children: [
        t("nav.phones"),
        pending ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
          ` · ${pending}`,
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-signal-dot", "aria-hidden": "true" })
        ] }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", icon: "settings", "aria-current": page === "profile" ? "page" : void 0, onClick: () => navigate("profile"), children: t("nav.account") })
    ] })
  ] });
}
var budgetLabel = (t, budget) => budget.exhausted ? t("budget.exhausted") : budget.state === "unconfirmed" ? t("budget.unconfirmed") : budget.state === "known" && budget.remaining !== null ? t("budget.remaining", { points: formatPoints(budget.remaining, t.locale) }) : budget.tokenLimited ? t("budget.tokenLimited") : t("budget.unlimited");
function Budget({ budget }) {
  const t = useT();
  const label = budget === void 0 ? t("budget.loading") : budget === null ? t("budget.unavailable") : budgetLabel(t, budget);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "twui-footer-service", role: "status", title: t("budget.hint"), children: [
    budget?.exhausted && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-signal-dot", "aria-hidden": "true" }),
    label
  ] });
}
function Footer({ state, connectionOpen, openConnection, budget, run }) {
  const t = useT();
  const [busy, setBusy] = (0, import_react5.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-footer-identity", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-footer-name", children: "Teamwork" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Button,
        {
          variant: "ghost",
          size: "sm",
          icon: "server",
          className: "twui-footer-connection",
          "aria-label": `${t("account.connection")} · ${host(state.server)}`,
          "aria-current": connectionOpen ? "page" : void 0,
          title: state.server,
          onClick: openConnection,
          children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-footer-service", children: host(state.server) })
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row twui-footer-actions", children: [
      budget !== false && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Budget, { budget }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { role: "status", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: state.sync.lastError ? "warning" : "success", dot: true, children: state.sync.running ? t("sync.running") : state.sync.lastError ? t("sync.failed") : synced(t, state.sync.lastSuccess) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", size: "sm", icon: "refresh", busy: busy || state.sync.running, onClick: async () => {
        setBusy(true);
        await run(() => api.sync(), t("sync.done"));
        setBusy(false);
      }, children: t("sync.refresh") })
    ] })
  ] });
}
function presetState(t, preset, state) {
  const missing = missingTools(preset);
  const plugins = pluginsNotReady(preset);
  const list = (names) => names.join(t("list.separator"));
  const blocked = !preset.modelAvailable ? preset.modelOffline ? t("model.offline", { name: preset.model ?? "" }) : preset.contextWindowMissing ? t("model.noContextWindow", { name: preset.model ?? "" }) : t("preset.modelGone") : plugins.length ? t("preset.pluginsNotReady", { plugins: list(plugins.map((p) => p.name)) }) : missing.length && state.session ? t("preset.toolsMissing", { tools: list(missing.map((x) => x.name)) }) : void 0;
  return { missing, plugins, blocked };
}
function startSession(dsh, preset, state, prompt) {
  const workspace = workspaceAt(dsh, state.teams.find((team) => team.id === preset.teamId)?.workspace);
  const agentPreset = `team:${preset.teamId}:${preset.id}`;
  dsh.uiWorkspace.startSession(workspace?.workspaceId, prompt === void 0 ? { agentPreset } : { agentPreset, prompt, whenDraftExists: "replace" });
}
function AssistantItem({ preset, state, dsh }) {
  const t = useT();
  const { blocked } = presetState(t, preset, state);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "twui-featured", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    Item,
    {
      media: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PresetAvatar, { avatar: preset.avatar, name: preset.name }),
      title: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        preset.name,
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: "brand", children: t("assistant.label") })
      ] }),
      description: t("assistant.body"),
      tags: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-subtle", children: t("assistant.examples") }),
        ["assistant.example1", "assistant.example2", "assistant.example3"].map((key) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", disabled: !!blocked, onClick: () => startSession(dsh, preset, state, t(key)), children: t(key) }, key))
      ] }),
      actions: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "primary", size: "sm", icon: "plus", disabled: !!blocked, onClick: () => startSession(dsh, preset, state), children: t("assistant.ask") }),
      notice: blocked ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Notice, { tone: "warning", children: blocked }) : void 0
    }
  ) });
}
function PresetItem({ preset, state, dsh, onInstall }) {
  const t = useT();
  const [expanded, setExpanded] = (0, import_react5.useState)(false);
  const { missing, plugins, blocked } = presetState(t, preset, state);
  const model = preset.model ?? t("preset.sessionModel");
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    Item,
    {
      media: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PresetAvatar, { avatar: preset.avatar, name: preset.name }),
      title: preset.name,
      description: preset.description || void 0,
      tags: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Badge, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "cpu", size: 12 }),
          model
        ] }),
        !blocked ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: !state.session && missing.length ? "neutral" : "success", dot: true, children: !state.session && missing.length ? t("preset.checkOnStart") : t("preset.ready") }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: "warning", dot: true, children: t("preset.notReady") })
      ] }),
      actions: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", size: "sm", trailingIcon: expanded ? "chevronDown" : "chevronRight", "aria-expanded": expanded, onClick: () => setExpanded(!expanded), children: t("preset.details") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", icon: "plus", disabled: !!blocked, onClick: () => startSession(dsh, preset, state), children: t("preset.newSession") })
      ] }),
      notice: blocked ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", style: { gap: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Notice, { tone: "warning", children: blocked }),
        plugins.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "twui-link", style: { fontSize: 12 }, onClick: onInstall, children: t("preset.goInstall") })
      ] }) : void 0,
      children: expanded && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(ItemBody, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(DefinitionList, { items: [
          [t("preset.model"), model],
          [t("preset.tools"), preset.tools.length ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-row", style: { gap: 6 }, children: preset.tools.map((x) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Badge, { tone: toolText[x.state][1], title: x.required ? t("preset.required") : t("preset.optional"), children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-mono", children: x.name }),
            x.required ? "" : ` · ${t("preset.optional")}`,
            " · ",
            t(toolText[x.state][0])
          ] }, x.name)) }) : t("preset.noTools")],
          [t("preset.plugins"), preset.plugins.length ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-row", style: { gap: 6 }, children: preset.plugins.map((p) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Badge, { tone: pluginText[p.state][1], children: [
            p.name,
            " @",
            p.version,
            " · ",
            t(pluginText[p.state][0])
          ] }, p.id)) }) : t("preset.noPlugins")],
          [t("preset.version"), t("preset.versionValue", { version: preset.version })]
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-subtle", children: t("preset.toolsNote") })
      ] })
    }
  );
}
async function startModelSession(t, dsh, model, state) {
  const workspaces = dsh.workspaces.list.getSnapshot().items, current = dsh.currentSession?.();
  const workspace = workspaceAt(dsh, state.teams.find((team) => team.id === model.teamId)?.workspace) ?? workspaces.find((item) => current !== void 0 && item.sessionIds?.includes(current)) ?? workspaces[0];
  if (!workspace) throw new Error(t("model.noWorkspace"));
  const sessionId = await dsh.uiWorkspace.connectWorkspace(workspace.workspaceId);
  await api.use(sessionId, model.id);
  dsh.uiWorkspace.openSession(sessionId);
}
function ModelItem({ model, state, dsh, run }) {
  const t = useT();
  const number = new Intl.NumberFormat(t.locale);
  const millions = new Intl.NumberFormat(t.locale, { maximumSignificantDigits: 3 });
  const shortTokens = (tokens) => `${millions.format(tokens / 1e6)}M`;
  const modalities = t(model.vision === void 0 ? "model.ioUnknown" : model.vision ? "model.ioImage" : "model.ioText");
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    Item,
    {
      icon: "cpu",
      title: model.name,
      subtitle: model.model !== model.name ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-mono", children: model.model }) : void 0,
      description: t("model.body"),
      tags: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "twui-model-modalities", role: "img", "aria-label": modalities, title: modalities, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "text" }),
          model.vision && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "image" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "arrowRight", size: 14 }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "text" })
        ] }),
        model.contextWindow !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { title: t("model.context", { tokens: number.format(model.contextWindow) }), children: t("model.context", { tokens: shortTokens(model.contextWindow) }) }),
        model.maxTokens !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { title: t("model.maxOutput", { tokens: number.format(model.maxTokens) }), children: t("model.maxOutput", { tokens: shortTokens(model.maxTokens) }) }),
        (model.contextWindowMissing || model.modelOffline) && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: "warning", dot: true, children: t("preset.notReady") })
      ] }),
      actions: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", icon: "plus", disabled: model.contextWindowMissing || model.modelOffline, onClick: () => run(() => startModelSession(t, dsh, model, state)), children: t("preset.newSession") }),
      notice: model.modelOffline ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Notice, { tone: "warning", children: t("model.offline", { name: model.name }) }) : model.contextWindowMissing ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Notice, { tone: "warning", children: t("model.noContextWindow", { name: model.name }) }) : void 0
    }
  );
}
function PluginItem({ plugin, run }) {
  const t = useT();
  const [confirming, setConfirming] = (0, import_react5.useState)(false);
  const [busy, setBusy] = (0, import_react5.useState)(false);
  const [label, tone] = pluginText[plugin.state];
  const spec = `${plugin.package ?? plugin.name}@${plugin.version}`;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    Item,
    {
      icon: "puzzle",
      title: plugin.name,
      description: plugin.description || void 0,
      tags: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-subtle twui-mono", children: spec }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone, dot: true, children: t(label) }),
        plugin.localVersion && plugin.localVersion !== plugin.version && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { children: t("plugin.local", { version: plugin.localVersion }) })
      ] }),
      actions: plugin.state === "missing" ? !confirming && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", onClick: () => setConfirming(true), children: t("plugin.install") }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-subtle", children: t("plugin.managed") }),
      children: confirming && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Confirm,
        {
          title: t("plugin.confirmTitle", { spec }),
          description: t("plugin.confirmBody"),
          confirmLabel: t("plugin.confirm"),
          cancelLabel: t("common.cancel"),
          busy,
          onCancel: () => setConfirming(false),
          onConfirm: async () => {
            setBusy(true);
            await run(() => api.install(plugin.id, plugin.version), (r) => r.message.split("\n")[0]);
            setBusy(false);
            setConfirming(false);
          }
        }
      )
    }
  );
}
function HeaderSkeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", style: { gap: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Skeleton, { width: 36, height: 36 }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "grid", gap: 6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Skeleton, { width: 140, height: 14 }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Skeleton, { width: 100, height: 10 })
    ] })
  ] });
}
function ListSkeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_jsx_runtime8.Fragment, { children: [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-item", style: { padding: 16, display: "flex", gap: 14 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Skeleton, { width: 36, height: 36 }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { flex: 1, display: "grid", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Skeleton, { width: "40%" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Skeleton, { width: "75%", height: 12 }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Skeleton, { width: 120, height: 20 })
    ] })
  ] }, i)) });
}
var relayText = {
  off: ["relay.offTitle", "relay.offBody"],
  connecting: ["relay.connectingTitle", "relay.connectingBody"],
  refused: ["relay.refusedTitle", "relay.refusedBody"]
};
var deviceIcon = (device) => device.deviceKind === "web" ? "monitor" : "smartphone";
var deviceLine = (t, device, rest) => {
  const kind = device.deviceKind ? t(`devices.kind.${device.deviceKind}`) : void 0;
  return kind && kind !== device.deviceName ? `${kind} · ${rest}` : rest;
};
var shortTime = (t, iso) => new Date(iso).toLocaleString(t.locale, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
function NativeWeb({ state, busy, perform }) {
  const t = useT();
  const [confirming, setConfirming] = (0, import_react5.useState)(false);
  const { enabled, blocked, active } = state;
  const set = (on) => void perform("native-web", async () => {
    await api.setNativeWeb(on);
    setConfirming(false);
  }, t(on ? "phones.webTurnedOn" : "phones.webTurnedOff"));
  const disconnect = () => void perform("native-web-disconnect", () => api.disconnectNativeWeb(), t("phones.webDisconnected"));
  const use = active.tunnels > 0 ? t("phones.webInUse", { count: active.tunnels }) : active.lastActivity ? t("phones.webLastUsed", { time: shortTime(t, active.lastActivity) }) : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    Item,
    {
      icon: "external",
      title: t("phones.webTitle"),
      tags: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: enabled && !blocked ? "success" : "neutral", dot: true, children: t(enabled ? "phones.webOn" : "phones.webOff") }),
      description: blocked ? t(blocked === "pin" ? "phones.webBlockedPin" : "phones.webBlockedWeb") : enabled && use ? `${t("phones.webHint")} ${use}` : t("phones.webHint"),
      actions: !confirming && (enabled ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "secondary", disabled: !!busy, busy: busy === "native-web-disconnect", onClick: disconnect, children: t("phones.webDisconnect") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "ghost", disabled: !!busy, busy: busy === "native-web", onClick: () => set(false), children: t("phones.webDisable") })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "primary", disabled: !!busy || !!blocked, onClick: () => setConfirming(true), children: t("phones.webEnable") })),
      children: confirming && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ItemBody, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Confirm,
        {
          title: t("phones.webEnableTitle"),
          description: t("phones.webEnableBody"),
          confirmLabel: t("phones.webEnable"),
          cancelLabel: t("common.cancel"),
          busy: busy === "native-web",
          onConfirm: () => set(true),
          onCancel: () => setConfirming(false)
        }
      ) })
    }
  );
}
function OwnerPin({ enabled, busy, perform }) {
  const t = useT();
  const [editing, setEditing] = (0, import_react5.useState)(false);
  const [turningOff, setTurningOff] = (0, import_react5.useState)(false);
  const [pin, setPin] = (0, import_react5.useState)("");
  const [again, setAgain] = (0, import_react5.useState)("");
  const digits = (value) => value.replace(/[^0-9]/g, "").slice(0, 4);
  const mismatch = again.length === 4 && pin !== again;
  const close = () => {
    setEditing(false);
    setPin("");
    setAgain("");
  };
  const save = () => void perform("pin", async () => {
    await api.setOwnerPin(pin);
    close();
  }, t(enabled ? "phones.pinChanged" : "phones.pinTurnedOn"));
  const off = () => void perform("pin", async () => {
    await api.setOwnerPin(null);
    setTurningOff(false);
  }, t("phones.pinTurnedOff"));
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    Item,
    {
      icon: "key",
      title: t("phones.pinTitle"),
      tags: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: enabled ? "success" : "neutral", dot: true, children: t(enabled ? "phones.pinOn" : "phones.pinOff") }),
      description: t("phones.pinHint"),
      actions: !editing && !turningOff && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: enabled ? "secondary" : "primary", disabled: !!busy, onClick: () => setEditing(true), children: t(enabled ? "phones.pinChange" : "phones.pinEnable") }),
        enabled && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "ghost", disabled: !!busy, onClick: () => setTurningOff(true), children: t("phones.pinDisable") })
      ] }),
      children: [
        editing && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(ItemBody, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("form", { className: "twui-row", style: { alignItems: "flex-end", flexWrap: "wrap" }, onSubmit: (event) => {
            event.preventDefault();
            if (pin.length === 4 && pin === again) save();
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: t("phones.pin"), htmlFor: "teamwork-owner-pin", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              Input,
              {
                id: "teamwork-owner-pin",
                className: "twui-mono",
                type: "password",
                inputMode: "numeric",
                maxLength: 4,
                autoComplete: "new-password",
                autoFocus: true,
                value: pin,
                disabled: !!busy,
                onChange: (event) => setPin(digits(event.target.value))
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: t("phones.pinConfirm"), htmlFor: "teamwork-owner-pin-again", error: mismatch ? t("phones.pinMismatch") : void 0, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              Input,
              {
                id: "teamwork-owner-pin-again",
                className: "twui-mono",
                type: "password",
                inputMode: "numeric",
                maxLength: 4,
                autoComplete: "new-password",
                value: again,
                disabled: !!busy,
                onChange: (event) => setAgain(digits(event.target.value))
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { type: "submit", variant: "primary", busy: busy === "pin", disabled: !!busy || pin.length !== 4 || pin !== again, children: t("phones.pinSave") }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", disabled: !!busy, onClick: close, children: t("phones.pinCancel") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-subtle", style: { marginTop: 8 }, children: t("phones.pinChangeNote") })
        ] }),
        turningOff && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ItemBody, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          Confirm,
          {
            title: t("phones.pinDisableTitle"),
            description: t("phones.pinDisableBody"),
            confirmLabel: t("phones.pinDisable"),
            cancelLabel: t("phones.pinCancel"),
            busy: busy === "pin",
            onConfirm: off,
            onCancel: () => setTurningOff(false)
          }
        ) })
      ]
    }
  );
}
function Phones({ state, run }) {
  const t = useT();
  const [offer, setOffer] = (0, import_react5.useState)();
  const [revoking, setRevoking] = (0, import_react5.useState)();
  const [busy, setBusy] = (0, import_react5.useState)();
  const [error, setError] = (0, import_react5.useState)();
  const [expired, setExpired] = (0, import_react5.useState)(false);
  const [justPaired, setJustPaired] = (0, import_react5.useState)();
  const locked = (0, import_react5.useRef)(false);
  const connected = state.relay === "connected";
  const pending = state.phones.filter((p) => p.status === "pending");
  const paired = state.phones.filter((p) => p.status === "confirmed");
  const seen = (0, import_react5.useRef)(new Set(pending.map((p) => p.id)));
  (0, import_react5.useEffect)(() => {
    if (pending.some((p) => !seen.current.has(p.id))) {
      setOffer(void 0);
      setExpired(false);
    }
    seen.current = new Set(pending.map((p) => p.id));
  }, [state.phones]);
  (0, import_react5.useEffect)(() => {
    if (!connected) {
      setOffer(void 0);
      setExpired(false);
    }
  }, [connected]);
  (0, import_react5.useEffect)(() => {
    if (!justPaired) return;
    const timer = setTimeout(() => setJustPaired(void 0), 3e3);
    return () => clearTimeout(timer);
  }, [justPaired]);
  const perform = async (key, action, done2) => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(key);
    setError(void 0);
    try {
      return await run(async () => {
        try {
          return await action();
        } catch (failure) {
          setError(failure);
          throw failure;
        }
      }, done2);
    } finally {
      locked.current = false;
      setBusy(void 0);
    }
  };
  const pair = () => perform("pair", async () => {
    setOffer(await api.pairPhone());
    setExpired(false);
  });
  const accept = (phone) => perform(`accept:${phone.id}`, async () => {
    await api.decidePhone(phone.id, true);
    setJustPaired({ id: phone.id, name: phone.deviceName });
  }, t("phones.accepted", { device: phone.deviceName }));
  const done = justPaired && paired.some((p) => p.id === justPaired.id) ? justPaired.name : void 0;
  const pairing = !!offer || expired || pending.length > 0;
  const pairButton = /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "primary", icon: "plus", busy: busy === "pair", disabled: !!busy || !connected, onClick: () => void pair(), children: t("phones.pair") });
  const relayBanner = state.relay !== "connected" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Banner, { tone: state.relay === "connecting" ? "neutral" : "warning", title: t(relayText[state.relay][0]), children: t(relayText[state.relay][1]) });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", style: { justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { minWidth: 0, flex: "1 1 260px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h2", { className: "twui-page-title", children: t("phones.title") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "twui-muted", children: t("phones.body") })
      ] }),
      (paired.length > 0 || pending.length > 0) && !offer && !expired && pairButton
    ] }),
    relayBanner,
    error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Banner, { tone: "warning", title: t("phones.failed"), children: describe(t, error) }),
    offer && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { gap: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PairSteps, { at: 1 }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PairingCode, { offer, onCancel: () => setOffer(void 0), onExpire: () => {
        setOffer(void 0);
        setExpired(true);
      } })
    ] }) }),
    expired && !offer && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { gap: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PairSteps, { at: 1 }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", style: { justifyContent: "space-between", flexWrap: "wrap", gap: 12 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: t("phones.expiredTitle") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", style: { gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", disabled: !!busy, onClick: () => setExpired(false), children: t("phones.hide") }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "primary", busy: busy === "pair", disabled: !!busy || !connected, onClick: () => void pair(), children: t("phones.newCode") })
        ] })
      ] })
    ] }) }),
    pending.map((phone) => {
      const ready = !!phone.safetyCode && !!phone.phoneConfirmed;
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { gap: 14 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PairSteps, { at: 2 }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", style: { alignItems: "center", flexWrap: "wrap", gap: "4px 10px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-tile", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: deviceIcon(phone), size: 18 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { style: { fontWeight: 600 }, children: t("phones.requestTitle", { device: phone.deviceName }) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-subtle", children: deviceLine(t, phone, t("phones.requested", { time: shortTime(t, phone.createdAt) })) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: "warning", dot: true, children: t("phones.waiting") })
        ] }),
        phone.safetyCode ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { gap: 4 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-subtle", children: t("phones.safetyLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-mono", style: { fontSize: 26, fontWeight: 600, letterSpacing: "0.14em" }, children: phone.safetyCode }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-muted", children: t("phones.confirmOrder") })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-muted", children: t("phones.handshake") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-row", style: { justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 8 }, children: [
          phone.safetyCode && !phone.phoneConfirmed && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-subtle", style: { flex: "1 1 auto" }, children: t("phones.waitDevice") }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", busy: busy === `reject:${phone.id}`, disabled: !!busy, onClick: () => void perform(`reject:${phone.id}`, () => api.decidePhone(phone.id, false), t("phones.rejected")), children: t("phones.reject") }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "primary", busy: busy === `accept:${phone.id}`, disabled: !!busy || !ready || !connected, onClick: () => void accept(phone), children: t("phones.accept") })
        ] })
      ] }) }, phone.id);
    }),
    done && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { gap: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PairSteps, { at: 3 }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: t("phones.accepted", { device: done }) })
    ] }) }),
    paired.length === 0 && !pairing && connected && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "twui-stack", style: { gap: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h3", { style: { fontSize: 15, fontWeight: 600 }, children: t("phones.emptyTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("ol", { style: { margin: 0, paddingLeft: 20, display: "grid", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("li", { children: t("phones.how1") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("li", { children: t("phones.how2") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("li", { children: t("phones.how3") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { children: pairButton })
    ] }) }),
    paired.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h3", { style: { fontSize: 15, fontWeight: 600 }, children: t("phones.pairedCount", { count: paired.length }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "twui-stack", style: { gap: 12, opacity: connected ? 1 : 0.55 }, children: paired.map((phone) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Item,
        {
          icon: deviceIcon(phone),
          title: phone.deviceName,
          description: deviceLine(t, phone, phone.lastUsedAt ? t("phones.lastUsed", { time: shortTime(t, phone.lastUsedAt) }) : t("phones.pairedAt", { time: shortTime(t, phone.createdAt) })),
          tags: phone.verified ? void 0 : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Badge, { tone: "warning", dot: true, children: t("phones.repair") }),
          actions: connected && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
            !phone.verified && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", disabled: !!busy || pairing, onClick: () => void pair(), children: t("phones.repairAction") }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "ghost", disabled: !!busy, onClick: () => setRevoking(phone), children: t("phones.unpair") })
          ] })
        },
        phone.id
      )) })
    ] }),
    revoking && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      Confirm,
      {
        title: t("phones.unpairTitle", { device: revoking.deviceName }),
        description: t("phones.unpairBody"),
        confirmLabel: t("phones.unpair"),
        cancelLabel: t("common.cancel"),
        busy: !!busy,
        onCancel: () => setRevoking(void 0),
        onConfirm: async () => {
          if (await perform(`revoke:${revoking.id}`, () => api.revokePhone(revoking.id), t("phones.unpaired"))) setRevoking(void 0);
        }
      }
    ),
    state.ownerPinEnabled !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h3", { style: { fontSize: 15, fontWeight: 600 }, children: t("phones.security") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(OwnerPin, { enabled: state.ownerPinEnabled, busy, perform }),
      state.nativeWeb && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(NativeWeb, { state: state.nativeWeb, busy, perform })
    ] })
  ] });
}
function PairSteps({ at }) {
  const t = useT();
  const labels = [t("phones.step1"), t("phones.step2"), t("phones.step3")];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("ol", { "aria-label": t("phones.stepsLabel"), style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "8px 16px" }, children: labels.map((label, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Step, { n: i + 1, state: i + 1 < at || at === 3 ? "done" : i + 1 === at ? "active" : "todo", children: label }, label)) });
}
function PairingCode({ offer, onCancel, onExpire }) {
  const t = useT();
  const [now, setNow] = (0, import_react5.useState)(Date.now());
  (0, import_react5.useEffect)(() => {
    const timer = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Math.round((Date.parse(offer.expiresAt) - now) / 1e3));
  (0, import_react5.useEffect)(() => {
    if (left === 0) onExpire();
  }, [left, onExpire]);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(QrCode, { value: offer.link, size: 168, label: t("phones.qr") }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "grid", gap: 6, minWidth: 200, flex: "1 1 200px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h2", { style: { fontSize: 15, fontWeight: 650 }, children: t("phones.scan") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-subtle", children: t("phones.manual") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "twui-mono", style: { fontSize: 24, fontWeight: 600, letterSpacing: "0.16em" }, children: [
        offer.code.slice(0, 3),
        " ",
        offer.code.slice(3)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "twui-subtle", children: t("phones.expires", { time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "ghost", onClick: onCancel, children: t("phones.hide") }) })
    ] })
  ] });
}
function QrCode({ value, size, label }) {
  const qr = qrcode_default(0, "M");
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  let d = "";
  for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (qr.isDark(row, col)) d += `M${col + 4} ${row + 4}h1v1h-1z`;
  const extent = count + 8;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("svg", { role: "img", "aria-label": label, width: size, height: size, viewBox: `0 0 ${extent} ${extent}`, shapeRendering: "crispEdges", style: { borderRadius: 8, flex: "none" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("rect", { width: extent, height: extent, fill: "#ffffff" }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d, fill: "#000000" })
  ] });
}

// src/web/index.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var inject = ["slots", "sessions", "uiWorkspace", "workspaces"];
function apply(ctx) {
  const trackSession = currentSessionTracker(ctx.sessions.list);
  trackSession();
  ctx.effect(() => ctx.sessions.list.subscribe(() => {
    trackSession();
  }));
  const host2 = {
    currentSession: trackSession,
    get sessions() {
      return ctx.sessions;
    },
    get uiWorkspace() {
      return ctx.uiWorkspace;
    },
    get workspaces() {
      return ctx.workspaces;
    }
  };
  ctx.slots.inject(
    "sidebar.panellist",
    () => ctx.slots.register({ name: "sidebar.panellist", id: PANEL_ID, order: 60, label: "Teamwork" }, (owner) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(TeamIcon, { size: owner?.size || 16, active: !!owner?.active }))
  );
  ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: PANEL_ID }, (owner) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(TeamworkPanel, { host: host2, renderFactorySlot: owner.renderFactorySlot })));
}
function TeamIcon({ size, active }) {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("svg", { width: size, height: size, viewBox: "0 0 400 400", role: "img", "aria-label": "DSH Teamwork", style: { flex: "none", display: "block", color: active ? "var(--dsw-alias-state-business-primary)" : "inherit" }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { fill: "currentColor", d: `${BRAND_FLUKE}${BRAND_SURFACE}${BRAND_SWELL}` }) });
}
return module.exports; } });
