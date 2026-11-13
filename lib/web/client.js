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
var PANEL_ID = "dsh-teamwork";
function currentSessionTracker(list) {
  let last;
  return () => {
    const open = Object.values(list.getSnapshot().byId).find((s) => (s.retainedBy?.mainView ?? 0) > 0);
    if (open) last = open.id;
    return last;
  };
}

// src/web/TeamworkPanel.tsx
var import_react3 = require("react");

// ui/src/root.tsx
var import_react = require("react");

// ui/src/styles.ts
var STYLE_ELEMENT_ID = "dsh-teamwork-ui-styles";
var css = String.raw`
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

// ui/src/root.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function ensureStyles(doc = document) {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;
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
var MARK = "M206.84 178.37L203.20 176.51L197.50 174.07L191.54 172.04L185.35 170.41L178.93 169.17L172.31 168.32L165.50 167.86L158.53 167.77L151.41 168.06L144.16 168.72L136.80 169.75L129.35 171.13L121.82 172.87L114.23 174.96L109.15 176.54L98.77 180.09L95.30 181.17L90.18 182.60L86.83 183.42L81.88 184.48L77.03 185.31L72.29 185.93L67.65 186.34L61.63 186.57L57.23 186.50L51.52 186.10L47.35 185.57L41.96 184.58L36.75 183.26L31.71 181.62L34.49 185.76L37.47 189.81L40.64 193.76L44.00 197.60L47.54 201.33L51.26 204.95L55.15 208.44L59.21 211.81L63.44 215.04L67.84 218.14L72.39 221.10L77.09 223.91L81.95 226.57L86.95 229.08L94.72 232.53L102.79 235.59L111.15 238.26L119.80 240.51L125.70 241.78L134.78 243.30L140.96 244.06L144.09 244.36L173.55 246.46L180.99 247.20L187.94 248.12L194.39 249.29L200.32 250.79L203.07 251.68L205.68 252.68L209.32 254.39L212.63 256.39L215.59 258.72L218.18 261.38L219.71 263.37L223.20 305.34L228.75 306.83L233.12 307.74L237.50 308.33L241.25 308.55L245.00 308.50L249.38 308.10L253.75 307.35L258.75 306.16L268.56 303.21L246.40 256.22L246.73 253.74L247.28 251.31L248.06 248.95L249.61 245.50L250.90 243.25L252.39 241.04L254.06 238.85L255.91 236.70L257.94 234.56L260.13 232.43L264.98 228.19L270.41 223.93L277.92 218.50L302.38 201.94L304.94 200.12L309.92 196.37L317.01 190.52L321.49 186.47L327.85 180.20L333.75 173.71L339.20 167.02L344.20 160.15L347.28 155.48L350.15 150.75L352.81 145.96L355.27 141.12L357.52 136.24L359.57 131.33L361.40 126.38L363.02 121.41L364.43 116.42L365.63 111.42L366.61 106.41L367.38 101.41L367.94 96.41L368.27 91.43L364.74 95.37L360.88 99.12L356.71 102.68L353.38 105.22L348.64 108.41L344.87 110.67L339.54 113.49L335.33 115.45L330.91 117.29L326.31 118.98L321.50 120.54L318.18 121.50L313.04 122.82L309.49 123.63L298.73 125.74L293.54 126.91L285.93 128.90L278.54 131.16L271.39 133.69L264.50 136.48L257.89 139.53L253.65 141.71L249.55 144.00L245.59 146.40L239.93 150.20L236.35 152.87L232.93 155.65L228.12 160.01L225.13 163.04L222.32 166.18L218.46 171.06L215.04 176.17L212.07 181.49ZM0.00 299.31L6.29 300.81L19.95 304.97L27.09 306.81L30.85 307.55L34.71 308.11L38.64 308.45L42.44 308.56L45.78 308.48L49.55 308.17L52.80 307.74L56.57 307.06L60.13 306.25L63.75 305.29L76.43 301.42L80.87 300.19L85.96 299.11L90.20 298.63L92.48 298.57L95.22 298.67L97.56 298.92L100.48 299.40L106.29 300.81L119.95 304.97L126.98 306.78L130.85 307.55L134.55 308.09L137.85 308.40L141.64 308.56L145.61 308.49L149.55 308.17L153.42 307.64L157.20 306.93L160.85 306.07L164.44 305.10L179.80 300.47L183.48 299.58L186.92 298.96L190.65 298.61L194.30 298.61L198.04 298.98L202.57 299.84L194.87 271.11L192.61 271.07L189.26 271.14L185.49 271.44L182.24 271.86L178.58 272.51L174.89 273.34L171.27 274.29L157.98 278.34L153.04 279.67L149.99 280.33L147.56 280.72L144.76 280.99L142.48 281.06L140.20 281.00L137.40 280.73L134.98 280.35L131.93 279.70L127.00 278.38L113.68 274.32L109.51 273.23L105.83 272.42L102.03 271.77L98.93 271.39L95.61 271.14L92.44 271.07L88.64 271.18L84.71 271.52L80.85 272.08L77.09 272.82L69.95 274.66L55.73 278.98L49.99 280.33L47.09 280.78L44.76 280.99L42.48 281.06L39.73 280.97L35.96 280.52L31.93 279.70L27.57 278.54L16.42 275.11L10.94 273.58L5.08 272.28L0.00 271.51ZM284.83 299.31L289.73 298.66L292.48 298.57L295.69 298.71L299.01 299.13L302.00 299.72L305.73 300.65L319.95 304.97L327.09 306.81L330.85 307.55L334.71 308.11L338.64 308.45L342.44 308.56L345.78 308.48L349.71 308.16L353.42 307.64L357.31 306.90L364.44 305.10L379.25 300.61L382.97 299.69L385.96 299.11L389.73 298.66L392.93 298.57L396.15 298.75L400.00 299.31L400.00 271.51L395.61 271.14L390.85 271.08L386.27 271.36L381.47 271.98L377.09 272.82L372.66 273.91L367.92 275.26L357.41 278.50L352.52 279.80L347.56 280.72L345.22 280.96L342.93 281.06L340.65 281.02L338.34 280.84L335.96 280.52L332.97 279.94L327.57 278.54L316.46 275.13L311.57 273.75L306.45 272.55L301.11 271.64L297.98 271.30L294.99 271.12L289.43 271.13L283.78 271.64L277.70 272.69Z";
var BRAND_INDIGO = "#1E2F6D";
var BRAND_PAPER = "#F8F5EF";
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
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: BRAND_PAPER, d: MARK })
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

// ui/src/layout.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function Panel({ header, nav, children, label, centered = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(UIRoot, { className: "twui-panel", role: "region", "aria-label": label, "data-centered": centered || void 0, children: [
    header && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("header", { className: "twui-panel-header", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-panel-column", children: header }) }),
    nav && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-panel-nav", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-panel-column", children: nav }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-panel-body", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-panel-column twui-panel-content", children }) })
  ] });
}
function Card({ children, padding = 20 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "twui-card", style: { padding }, children });
}
function Item({ icon, title, subtitle, description, tags, actions, notice, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("article", { className: "twui-item", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "twui-item-main", "data-no-icon": icon ? void 0 : true, children: [
      icon && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "twui-tile", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: icon, size: 18 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { minWidth: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("h3", { className: "twui-item-title", children: [
          title,
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
    throw new Error("无法连接 DSH 服务");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 404 && !data) throw new Error("DSH 还没有加载 Teamwork 插件的服务端，请重启 DSH");
    throw new Error(data?.error || `请求失败（HTTP ${response.status}）`);
  }
  return data;
}
var api = {
  state: (sessionId) => call("state", { sessionId }),
  login: () => call("login"),
  authorize: (code) => call("authorize", { code }),
  sync: () => call("sync"),
  logout: () => call("logout"),
  setServer: (server) => call("server", { server }),
  use: (sessionId, id) => call("use", { sessionId, id }),
  install: (id, version) => call("install", { id, version }),
  pairPhone: () => call("pair-phone", {}),
  decidePhone: (id, accept) => call("decide-phone", { id, accept }),
  revokePhone: (id) => call("revoke-phone", { id })
};

// src/web/TeamworkPanel.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var REFRESH_MS = 5e3;
var pluginText = {
  ready: ["已启用", "success"],
  missing: ["未安装", "warning"],
  disabled: ["已安装未启用", "warning"],
  "version-mismatch": ["本地版本不符", "warning"],
  failed: ["加载失败", "danger"],
  pending: ["等待加载", "warning"],
  unknown: ["无法确认", "neutral"],
  "catalog-changed": ["团队已更改版本", "warning"]
};
var toolText = {
  available: ["可用", "success"],
  conditional: ["执行时检查", "neutral"],
  missing: ["缺失", "warning"],
  unknown: ["待检查", "neutral"]
};
var host = (server) => server.replace(/^https?:\/\//, "");
var missingTools = (preset) => preset.tools.filter((t) => t.required && (t.state === "missing" || t.state === "unknown"));
var pluginsNotReady = (preset) => preset.plugins.filter((p) => p.state !== "ready");
function synced(iso) {
  if (!iso) return "尚未同步";
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1e3));
  if (seconds < 60) return "刚刚同步";
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟前同步`;
  return `${new Date(iso).toLocaleTimeString()} 同步`;
}
function TeamworkPanel({ host: dsh }) {
  const currentSession = (0, import_react3.useRef)(currentSessionTracker(dsh.sessions.list)).current;
  const sessionId = (0, import_react3.useSyncExternalStore)(dsh.sessions.list.subscribe, currentSession);
  const [state, setState] = (0, import_react3.useState)();
  const [loadError, setLoadError] = (0, import_react3.useState)();
  const [tab, setTab] = (0, import_react3.useState)("presets");
  const [toast, setToast] = (0, import_react3.useState)();
  const toastTimer = (0, import_react3.useRef)();
  const refresh = (0, import_react3.useCallback)(async () => {
    try {
      setState(await api.state(sessionId));
      setLoadError(void 0);
    } catch (error) {
      setLoadError(error.message);
    }
  }, [sessionId]);
  (0, import_react3.useEffect)(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);
  const notify = (0, import_react3.useCallback)((message, tone = "neutral") => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(void 0), tone === "danger" ? 6e3 : 3e3);
  }, []);
  (0, import_react3.useEffect)(() => () => clearTimeout(toastTimer.current), []);
  const run = (0, import_react3.useCallback)(async (action, done) => {
    try {
      const result = await action();
      const message = typeof done === "function" ? done(result) : done;
      if (message) notify(message);
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    } finally {
      await refresh();
    }
  }, [notify, refresh]);
  const toastNode = toast && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Toast, { tone: toast.tone, children: toast.message });
  if (!state) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Panel, { label: "Teamwork", header: loadError ? void 0 : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(HeaderSkeleton, {}), children: loadError ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Banner, { tone: "danger", title: "无法读取团队状态", action: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", icon: "refresh", onClick: () => void refresh(), children: "重试" }), children: loadError }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ListSkeleton, {}) });
  }
  if (!state.authenticated) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(Panel, { label: "Teamwork", centered: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SignIn, { state, run }),
      toastNode
    ] });
  }
  const tabs = [
    { id: "presets", label: "预设", count: state.presets.length },
    { id: "models", label: "团队模型", count: state.models.length },
    { id: "plugins", label: "团队插件", count: state.plugins.length },
    { id: "phones", label: "手机", count: state.phones.length }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(Panel, { label: "Teamwork", header: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Header, { state, run }), nav: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Tabs, { label: "团队配置", items: tabs, value: tab, onChange: setTab }), children: [
    loadError && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Banner, { tone: "danger", title: "状态没有刷新", action: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", icon: "refresh", onClick: () => void refresh(), children: "重试" }), children: loadError }),
    state.sync.lastError && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Banner, { tone: "warning", title: "同步失败，正在使用上次同步的配置", action: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", icon: "refresh", onClick: () => run(() => api.sync(), "团队配置已同步"), children: "重试" }), children: state.sync.lastError }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SessionStrip, { state }),
    tab === "presets" && (state.presets.length ? state.presets.map((p) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PresetItem, { preset: p, state, dsh, run, onInstall: () => setTab("plugins") }, p.id)) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EmptyState, { icon: "layers", title: "团队还没有发布预设", children: "管理员在网页控制台发布预设后，下次同步就会出现在这里。" }) })),
    tab === "models" && (state.models.length ? state.models.map((m) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ModelItem, { model: m, state, run }, m.id)) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EmptyState, { icon: "cpu", title: "团队还没有发布模型", children: "团队模型由服务器代为调用，provider 密钥不会下发到这台电脑。" }) })),
    tab === "plugins" && (state.plugins.length ? state.plugins.map((p) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PluginItem, { plugin: p, run }, p.id)) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EmptyState, { icon: "puzzle", title: "团队没有固定插件版本", children: "固定的插件版本会出现在这里，由你确认后安装。" }) })),
    tab === "phones" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Phones, { state, run }),
    toastNode
  ] });
}
function SignIn({ state, run }) {
  const [opened, setOpened] = (0, import_react3.useState)(null);
  const [code, setCode] = (0, import_react3.useState)("");
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const open = () => run(async () => {
    const { url, automatic } = await api.login();
    window.open(url, "_blank", "noopener");
    setOpened({ automatic });
  });
  const authorize = async () => {
    setBusy(true);
    await run(() => api.authorize(code.trim()), "已授权，团队配置已同步");
    setBusy(false);
  };
  const pasteForm = /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("form", { style: { display: "grid", gap: 12 }, onSubmit: (e) => {
    e.preventDefault();
    if (code.trim()) void authorize();
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Field, { label: opened?.automatic ? "没有自动完成？粘贴网页上显示的那一行" : "网页上显示的那一行", htmlFor: "teamwork-code", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { type: "submit", variant: opened?.automatic ? "secondary" : "primary", size: "lg", block: true, busy, disabled: !code.trim(), children: "完成授权" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: "twui-subtle", style: { textAlign: "center" }, children: [
      "没看到登录页？",
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "twui-link", onClick: open, children: "重新打开" })
    ] })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { width: "100%", maxWidth: 440, margin: "0 auto", display: "grid", gap: 24, padding: "24px 0" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "grid", justifyItems: "center", gap: 12, textAlign: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(BrandMark, { size: 56, title: "DSH Teamwork" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "grid", gap: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h1", { style: { fontSize: 20, fontWeight: 650, letterSpacing: "-0.01em" }, children: state.team ? `重新登录 ${state.team.name}` : "登录 DSH Teamwork" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "twui-muted", children: "团队的模型、预设和插件版本，一处发布，每位成员的 DSH 自动保持一致。" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Card, { padding: 20, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "grid", gap: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("ol", { style: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Step, { n: 1, state: opened ? "done" : "active", children: "在浏览器中登录" }),
        opened?.automatic === false ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Step, { n: 2, state: "active", children: "确认授权，把网页上显示的那一行粘贴到下方（两分钟内有效）" }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Step, { n: 2, state: opened ? "active" : "todo", children: "确认授权，这里会自动完成登录" })
      ] }),
      opened ? pasteForm : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { variant: "primary", size: "lg", block: true, trailingIcon: "external", onClick: open, children: "在浏览器中登录" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("ul", { style: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Point, { icon: "shield", title: "密钥留在服务器", children: "团队模型由服务器代为调用，provider 密钥不会下发到这台电脑。" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Point, { icon: "layers", title: "与本地配置并存", children: "团队配置作为独立条目加入，不覆盖你自己的模型和预设。" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Point, { icon: "sync", title: "自动保持最新", children: "每分钟同步一次；被移出团队后，下一次请求即失效。" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ServerSetting, { state, run })
  ] });
}
function Step({ n, state, children }) {
  const done = state === "done";
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("li", { style: { display: "flex", alignItems: "center", gap: 10, color: state === "todo" ? "var(--twui-fg-subtle)" : "var(--twui-fg)" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { "aria-hidden": "true", style: {
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
    }, children: done ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "check", size: 13 }) : n }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children })
  ] });
}
function Point({ icon, title, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("li", { style: { display: "flex", gap: 12, alignItems: "flex-start" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "twui-tile", style: { width: 32, height: 32 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: icon, size: 16 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "grid", gap: 2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { style: { fontWeight: 600 }, children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "twui-muted", children })
    ] })
  ] });
}
function ServerSetting({ state, run }) {
  const [editing, setEditing] = (0, import_react3.useState)(false);
  const [value, setValue] = (0, import_react3.useState)(state.server);
  const [error, setError] = (0, import_react3.useState)();
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const isDefault = state.server === state.defaultServer;
  const save = async (server) => {
    setBusy(true);
    setError(void 0);
    try {
      await api.setServer(server);
      setEditing(false);
      await run(async () => void 0, server === null ? "已恢复为默认服务器" : "服务器已更改");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!editing) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "twui-card", style: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", boxShadow: "none" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: "var(--twui-fg-subtle)" }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "server", size: 16 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { flex: 1, minWidth: 0, display: "grid" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "twui-subtle", children: "服务器" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "twui-row", style: { gap: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "twui-mono", style: { overflowWrap: "anywhere" }, children: host(state.server) }),
          isDefault && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: "accent", children: "官方服务" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", onClick: () => {
        setValue(state.server);
        setEditing(true);
      }, children: "更改" })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "form",
    {
      className: "twui-card",
      style: { display: "grid", gap: 12, padding: 16, boxShadow: "none" },
      onSubmit: (e) => {
        e.preventDefault();
        void save(value);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          Field,
          {
            label: "服务器地址",
            htmlFor: "teamwork-server",
            error,
            hint: "自建团队或本地开发时填写你的 DSH Teamwork 地址，例如 http://localhost:3800。更改后需要重新登录。",
            children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              Input,
              {
                id: "teamwork-server",
                className: "twui-mono",
                value,
                onChange: (e) => setValue(e.target.value),
                "aria-invalid": error ? true : void 0,
                autoComplete: "off",
                spellCheck: false,
                autoFocus: true
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "twui-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { type: "submit", variant: "primary", size: "sm", busy, disabled: !value.trim(), children: "保存" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { variant: "ghost", size: "sm", disabled: busy, onClick: () => {
            setEditing(false);
            setError(void 0);
          }, children: "取消" }),
          !isDefault && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { type: "button", className: "twui-link", style: { marginLeft: "auto", fontSize: 12 }, disabled: busy, onClick: () => void save(null), children: [
            "恢复为 ",
            host(state.defaultServer)
          ] })
        ] })
      ]
    }
  );
}
function Header({ state, run }) {
  const { team, sync } = state;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 260px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(BrandMark, { size: 36, title: "DSH Teamwork" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { minWidth: 0, display: "grid", gap: 2 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "twui-row", style: { gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h1", { style: { fontSize: 15, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: team?.name ?? "尚未同步团队" }),
          team && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { outline: true, children: team.role === "admin" ? "管理员" : "成员" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "twui-subtle twui-row", style: { gap: 4 }, title: "退出后可以更改服务器", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "server", size: 12 }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "twui-mono", children: host(state.server) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "twui-row", style: { marginLeft: "auto" }, children: [
      state.relay === "connected" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: "success", dot: true, title: "手机可以通过 DSH Teamwork App 连到这台电脑", children: "手机可连接" }),
      state.relay === "refused" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: "warning", dot: true, title: "中转服务拒绝了这台电脑的连接：重新登录后会再试", children: "手机连接被拒绝" }),
      sync.running ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { children: "正在同步…" }) : sync.lastError ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: "warning", dot: true, children: "同步失败" }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: "success", dot: true, children: synced(sync.lastSuccess) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        Button,
        {
          size: "sm",
          icon: "refresh",
          "aria-label": "立即同步",
          title: "立即同步",
          busy: sync.running,
          onClick: () => run(() => api.sync(), "团队配置已同步，本地配置保持不变")
        }
      ),
      team?.role === "admin" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", trailingIcon: "external", onClick: () => window.open(state.consoleUrl, "_blank", "noopener"), children: "管理团队" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", variant: "ghost", icon: "logout", onClick: () => run(() => api.logout(), "已退出，团队配置已从这台 DSH 移除"), children: "退出" })
    ] })
  ] });
}
function SessionStrip({ state }) {
  const s = state.session;
  if (!s) return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Banner, { title: "还没有打开会话", children: "打开一个会话后，可以把团队的预设或模型用到这个会话里。" });
  const teamModel = (id) => state.models.find((m) => m.id === id)?.name ?? state.presets.find((p) => p.id === id)?.model ?? id;
  const model = s.model ? s.model.team ? teamModel(s.model.model) : `${s.model.provider}/${s.model.model}` : "未选择";
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "twui-card", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 20px", padding: "12px 16px", boxShadow: "none", background: "var(--twui-fill)" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "twui-row", style: { gap: 6, fontWeight: 600 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "session", size: 15 }),
      "当前会话"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Meta, { label: "模型", value: model }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Meta, { label: "预设", value: s.preset ? `${s.preset.name} · v${s.preset.version}` : "无团队预设" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { marginLeft: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: s.started ? "neutral" : "accent", dot: true, children: s.started ? "已开始对话" : "尚未开始对话" }) })
  ] });
}
function Meta({ label, value }) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "twui-row", style: { gap: 6, minWidth: 0 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "twui-subtle", children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { fontWeight: 500, overflowWrap: "anywhere" }, children: value })
  ] });
}
function PresetItem({ preset, state, dsh, run, onInstall }) {
  const [open, setOpen] = (0, import_react3.useState)(false);
  const missing = missingTools(preset);
  const plugins = pluginsNotReady(preset);
  const active = state.session?.preset?.id === preset.id;
  const blocked = !preset.modelAvailable ? "预设引用的团队模型已不可用，请联系管理员。" : plugins.length ? `依赖插件 ${plugins.map((p) => p.name).join("、")} 尚未就绪。` : missing.length && state.session ? `缺少必需工具 ${missing.map((t) => t.name).join("、")}，请在 DSH 插件管理器中安装或启用。` : void 0;
  const useBlocked = blocked ?? (!state.session ? "" : state.session.started && !active ? "当前会话已开始对话，预设只能用在新会话里。" : void 0);
  const ready = !blocked;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    Item,
    {
      icon: "layers",
      title: preset.name,
      subtitle: `${preset.id} · v${preset.version}`,
      description: preset.description || void 0,
      tags: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(Badge, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "cpu", size: 12 }),
          preset.model
        ] }),
        active ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: "accent", dot: true, children: "本会话正在使用" }) : ready ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: "success", dot: true, children: "可以使用" }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: "warning", dot: true, children: "未就绪" })
      ] }),
      actions: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { variant: "ghost", size: "sm", trailingIcon: open ? "chevronDown" : "chevronRight", "aria-expanded": open, onClick: () => setOpen(!open), children: "详情" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", icon: "plus", disabled: !ready || !state.team, onClick: () => {
          dsh.uiWorkspace.startSession(void 0, { agentPreset: `team:${state.team.id}:${preset.id}` });
          dsh.layout.selectPanel(null);
        }, children: "新建会话" }),
        !active && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { variant: "primary", size: "sm", disabled: useBlocked !== void 0, onClick: () => run(() => api.use(state.session.id, preset.id), (r) => r.message), children: "用于当前会话" })
      ] }),
      notice: useBlocked && !active ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "twui-row", style: { gap: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Notice, { tone: blocked ? "warning" : "neutral", children: useBlocked }),
        plugins.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "twui-link", style: { fontSize: 12 }, onClick: onInstall, children: "前往安装" })
      ] }) : void 0,
      children: open && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(ItemBody, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(DefinitionList, { items: [
          ["模型", preset.model],
          ["工具", preset.tools.length ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "twui-row", style: { gap: 6 }, children: preset.tools.map((t) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(Badge, { tone: toolText[t.state][1], title: t.required ? "必需" : "可选", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "twui-mono", children: t.name }),
            t.required ? "" : " · 可选",
            " · ",
            toolText[t.state][0]
          ] }, t.name)) }) : "无要求"],
          ["依赖插件", preset.plugins.length ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "twui-row", style: { gap: 6 }, children: preset.plugins.map((p) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(Badge, { tone: pluginText[p.state][1], children: [
            p.name,
            " @",
            p.version,
            " · ",
            pluginText[p.state][0]
          ] }, p.id)) }) : "无"],
          ["版本", `v${preset.version}，管理员发布新版本后下次同步生效`]
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "twui-subtle", children: "工具按当前会话检查；切换会话后和每次请求前都会重新检查。" })
      ] })
    }
  );
}
function ModelItem({ model, state, run }) {
  const s = state.session;
  const active = !!s?.model?.team && s.model.model === model.id;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    Item,
    {
      icon: "cpu",
      title: model.name,
      subtitle: `${model.id} · v${model.version}`,
      description: "由团队服务器代为调用，provider 密钥留在服务器上。只改当前会话，不改本地默认模型。",
      tags: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "twui-mono", children: model.upstream }) }),
      actions: active ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: "accent", dot: true, children: "本会话正在使用" }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { variant: "primary", size: "sm", disabled: !s, onClick: () => run(() => api.use(s.id, model.id), (r) => r.message), children: "用于当前会话" })
    }
  );
}
function PluginItem({ plugin, run }) {
  const [confirming, setConfirming] = (0, import_react3.useState)(false);
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [label, tone] = pluginText[plugin.state];
  const spec = `${plugin.package ?? plugin.name}@${plugin.version}`;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    Item,
    {
      icon: "puzzle",
      title: plugin.name,
      subtitle: spec,
      description: plugin.description || void 0,
      tags: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone, dot: true, children: label }),
        plugin.localVersion && plugin.localVersion !== plugin.version && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(Badge, { children: [
          "本地 ",
          plugin.localVersion
        ] })
      ] }),
      actions: plugin.state === "missing" ? !confirming && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { variant: "primary", size: "sm", onClick: () => setConfirming(true), children: "安装" }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "twui-subtle", children: "在 DSH 插件管理器中管理" }),
      children: confirming && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        Confirm,
        {
          title: `安装并启用 ${spec}？`,
          description: "这会在你的电脑上运行该插件的代码。版本由团队固定；已经装过的同名插件不会被覆盖。",
          confirmLabel: "安装并启用",
          cancelLabel: "取消",
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
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "twui-row", style: { gap: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Skeleton, { width: 36, height: 36 }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "grid", gap: 6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Skeleton, { width: 140, height: 14 }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Skeleton, { width: 100, height: 10 })
    ] })
  ] });
}
function ListSkeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_jsx_runtime6.Fragment, { children: [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "twui-item", style: { padding: 16, display: "flex", gap: 14 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Skeleton, { width: 36, height: 36 }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { flex: 1, display: "grid", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Skeleton, { width: "40%" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Skeleton, { width: "75%", height: 12 }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Skeleton, { width: 120, height: 20 })
    ] })
  ] }, i)) });
}
var relayText = {
  off: ["服务器没有开启手机接入", "只有提供中转服务的服务器（如官方服务 www.dshteamwork.com）才能让手机连到这台电脑。"],
  connecting: ["正在连接中转服务…", "连上之后就可以在这里配对手机。"],
  refused: ["中转服务拒绝了这台电脑", "登录可能已失效，或另一个 DSH 正以这台电脑的身份连接。退出后重新登录即可重试。"]
};
var shortTime = (iso) => new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
function Phones({ state, run }) {
  const [offer, setOffer] = (0, import_react3.useState)();
  const [revoking, setRevoking] = (0, import_react3.useState)();
  const pending = state.phones.filter((p) => p.status === "pending");
  const paired = state.phones.filter((p) => p.status === "confirmed");
  const seen = (0, import_react3.useRef)(pending.length);
  (0, import_react3.useEffect)(() => {
    if (pending.length > seen.current) setOffer(void 0);
    seen.current = pending.length;
  }, [pending.length]);
  if (state.relay !== "connected") {
    const [title, body] = relayText[state.relay];
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EmptyState, { icon: "smartphone", title, children: body }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Card, { children: offer ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PairingCode, { offer, onDone: () => setOffer(void 0) }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      EmptyState,
      {
        icon: "smartphone",
        title: "在手机上操作这台电脑的 DSH",
        action: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { icon: "plus", onClick: () => run(async () => setOffer(await api.pairPhone())), children: "配对新手机" }),
        children: "用 DSH Teamwork App 扫描这里显示的二维码，再在这台电脑上确认，手机就能查看会话、发送消息和处理审批。"
      }
    ) }),
    pending.map((phone) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      Item,
      {
        icon: "smartphone",
        title: phone.deviceName,
        subtitle: `${shortTime(phone.createdAt)} 申请配对`,
        tags: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: "warning", dot: true, children: "等待你确认" }),
        description: "确认后，这台手机可以查看这台电脑上的会话、发送消息、回答 Agent 的提问和处理审批。不是你本人的手机请拒绝。",
        actions: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", variant: "ghost", onClick: () => run(() => api.decidePhone(phone.id, false), "已拒绝"), children: "拒绝" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", onClick: () => run(() => api.decidePhone(phone.id, true), `${phone.deviceName} 已配对`), children: "确认配对" })
        ] })
      },
      phone.id
    )),
    paired.map((phone) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      Item,
      {
        icon: "smartphone",
        title: phone.deviceName,
        subtitle: phone.lastUsedAt ? `最近使用 ${shortTime(phone.lastUsedAt)}` : `配对于 ${shortTime(phone.createdAt)}`,
        tags: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: "success", dot: true, children: "已配对" }),
        actions: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", variant: "ghost", onClick: () => setRevoking(phone), children: "解除配对" })
      },
      phone.id
    )),
    revoking && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      Confirm,
      {
        title: `解除与 ${revoking.deviceName} 的配对？`,
        description: "这台手机会立即断开，之后需要重新扫码配对才能再连到这台电脑。",
        confirmLabel: "解除配对",
        cancelLabel: "取消",
        onCancel: () => setRevoking(void 0),
        onConfirm: () => {
          const phone = revoking;
          setRevoking(void 0);
          void run(() => api.revokePhone(phone.id), "已解除配对");
        }
      }
    )
  ] });
}
function PairingCode({ offer, onDone }) {
  const [now, setNow] = (0, import_react3.useState)(Date.now());
  (0, import_react3.useEffect)(() => {
    const timer = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Math.round((Date.parse(offer.expiresAt) - now) / 1e3));
  (0, import_react3.useEffect)(() => {
    if (left === 0) onDone();
  }, [left, onDone]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(QrCode, { value: offer.link, size: 168 }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "grid", gap: 8, minWidth: 200, flex: "1 1 200px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { style: { fontSize: 15, fontWeight: 650 }, children: "用 DSH Teamwork App 扫码" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "twui-subtle", children: "也可以在 App 里手动输入配对码：" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "twui-mono", style: { fontSize: 20, letterSpacing: "0.12em" }, children: [
        offer.code.slice(0, 4),
        " ",
        offer.code.slice(4)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "twui-subtle", children: [
        Math.floor(left / 60),
        ":",
        String(left % 60).padStart(2, "0"),
        " 后失效，只能使用一次。扫码后请回到这里确认。"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", variant: "ghost", onClick: onDone, children: "取消" }) })
    ] })
  ] });
}
function QrCode({ value, size }) {
  const qr = qrcode_default(0, "M");
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  let d = "";
  for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (qr.isDark(row, col)) d += `M${col + 4} ${row + 4}h1v1h-1z`;
  const extent = count + 8;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { role: "img", "aria-label": "配对二维码", width: size, height: size, viewBox: `0 0 ${extent} ${extent}`, shapeRendering: "crispEdges", style: { borderRadius: 8, flex: "none" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("rect", { width: extent, height: extent, fill: "#ffffff" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d, fill: "#000000" })
  ] });
}

// src/web/index.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var inject = ["slots", "sessions", "layout", "uiWorkspace"];
function apply(ctx) {
  const host2 = {
    get sessions() {
      return ctx.sessions;
    },
    get layout() {
      return ctx.layout;
    },
    get uiWorkspace() {
      return ctx.uiWorkspace;
    }
  };
  ctx.slots.inject(
    "sidebar.panellist",
    () => ctx.slots.register({ name: "sidebar.panellist", id: PANEL_ID, order: 60, label: "Teamwork" }, (owner) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TeamIcon, { size: owner?.size || 16, active: !!owner?.active }))
  );
  ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: PANEL_ID }, () => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TeamworkPanel, { host: host2 })));
}
function TeamIcon({ size, active }) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      style: { color: active ? "var(--dsw-alias-state-business-primary)" : "inherit" },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("circle", { cx: "9", cy: "7", r: "4" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" })
      ]
    }
  );
}
return module.exports; } });
