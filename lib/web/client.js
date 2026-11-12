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

// ui/src/controls.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var Button = (0, import_react2.forwardRef)(function Button2({ variant = "secondary", size = "md", busy = false, disabled, className, children, type = "button", ...props }, ref) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "button",
    {
      ...props,
      ref,
      type,
      className: join("twui-btn", className),
      "data-variant": variant,
      "data-size": size,
      disabled: disabled || busy,
      "aria-busy": busy || void 0,
      children: [
        busy && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Spinner, {}),
        children
      ]
    }
  );
});
var Input = (0, import_react2.forwardRef)(function Input2({ className, ...props }, ref) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { ...props, ref, className: join("twui-input", className) });
});
function Badge({ tone = "neutral", dot = false, outline = false, title, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "twui-badge", "data-tone": tone, "data-outline": outline || void 0, title, children: [
    dot && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "twui-badge-dot", "aria-hidden": "true" }),
    children
  ] });
}
function Spinner({ label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "twui-spinner", role: label ? "status" : void 0, "aria-label": label, "aria-hidden": label ? void 0 : true });
}
function Tabs({ items, value, onChange, label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "twui-tabs", role: "tablist", "aria-label": label, children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "button",
    {
      type: "button",
      role: "tab",
      className: "twui-tab",
      "aria-selected": item.id === value,
      onClick: () => onChange(item.id),
      children: [
        item.label,
        item.count !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "twui-tab-count", children: item.count })
      ]
    },
    item.id
  )) });
}
function Monogram({ text, size = 32 }) {
  const letters = Array.from(text.trim()).slice(0, 2).join("").toUpperCase() || "?";
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "twui-monogram", "aria-hidden": "true", style: { width: size, height: size, fontSize: Math.round(size * 0.4) }, children: letters });
}

// ui/src/layout.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function Panel({ header, nav, children, label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(UIRoot, { className: "twui-panel", role: "region", "aria-label": label, children: [
    header && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("header", { className: "twui-panel-header", children: header }),
    nav && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "twui-panel-nav", children: nav }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "twui-panel-body", children })
  ] });
}
function Item({ title, subtitle, description, tags, actions, notice, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("article", { className: "twui-item", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "twui-item-main", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { minWidth: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("h3", { className: "twui-item-title", children: [
          title,
          subtitle && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "twui-item-subtitle", children: subtitle })
        ] }),
        description && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "twui-item-desc", children: description }),
        tags && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "twui-item-tags", children: tags })
      ] }),
      actions && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "twui-item-actions", children: actions }),
      notice && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "twui-item-notice", children: notice })
    ] }),
    children
  ] });
}
function ItemBody({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "twui-item-body", children });
}
function Notice({ tone = "neutral", children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "twui-notice", "data-tone": tone, children });
}
function DefinitionList({ items }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dl", { className: "twui-dl", children: items.map(([term, value], i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "contents" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { children: term }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dd", { children: value })
  ] }, i)) });
}
function Confirm({ title, description, confirmLabel, cancelLabel, onConfirm, onCancel, busy = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "twui-confirm", role: "group", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "twui-confirm-title", children: title }),
    description && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "twui-notice", children: description }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "twui-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { variant: "primary", busy, onClick: onConfirm, children: confirmLabel }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { variant: "ghost", disabled: busy, onClick: onCancel, children: cancelLabel })
    ] })
  ] });
}
function EmptyState({ mark, title, children, actions }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "twui-empty", children: [
    mark,
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { children: title }),
    children,
    actions
  ] });
}
function Toast({ tone = "neutral", children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "twui-toast", "data-tone": tone, role: tone === "danger" ? "alert" : "status", children });
}

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
  use: (sessionId, id) => call("use", { sessionId, id }),
  install: (id, version) => call("install", { id, version })
};

// src/web/TeamworkPanel.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var REFRESH_MS = 5e3;
var pluginText = {
  ready: ["正常", "success"],
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
  unknown: ["无法检查", "neutral"]
};
var missingTools = (preset) => preset.tools.filter((t) => t.required && (t.state === "missing" || t.state === "unknown"));
var pluginsNotReady = (preset) => preset.plugins.filter((p) => p.state !== "ready");
function when(iso) {
  if (!iso) return "本次启动尚未同步";
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1e3));
  if (seconds < 60) return "刚刚同步";
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟前同步`;
  return `${new Date(iso).toLocaleString()} 同步`;
}
function TeamworkPanel({ host }) {
  const currentSession = (0, import_react3.useRef)(currentSessionTracker(host.sessions.list)).current;
  const sessionId = (0, import_react3.useSyncExternalStore)(host.sessions.list.subscribe, currentSession);
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
  const run = (0, import_react3.useCallback)(
    async (action, done) => {
      try {
        const result = await action();
        const message = typeof done === "function" ? done(result) : done;
        if (message) notify(message);
      } catch (error) {
        notify(error.message, "danger");
      } finally {
        await refresh();
      }
    },
    [notify, refresh]
  );
  const toastNode = toast && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Toast, { tone: toast.tone, children: toast.message });
  if (!state) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Panel, { label: "Teamwork", children: loadError ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Notice, { tone: "danger", children: loadError }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Notice, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Spinner, {}),
      " 正在读取团队状态…"
    ] }) });
  }
  if (!state.authenticated) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Panel, { label: "Teamwork", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SignIn, { state, run }),
      toastNode
    ] });
  }
  const tabs = [
    { id: "presets", label: "预设", count: state.presets.length },
    { id: "models", label: "团队模型", count: state.models.length },
    { id: "plugins", label: "团队插件", count: state.plugins.length }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Panel, { label: "Teamwork", header: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Header, { state, run }), nav: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tabs, { label: "团队配置", items: tabs, value: tab, onChange: setTab }), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SessionLine, { state }),
    loadError && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Notice, { tone: "danger", children: loadError }),
    tab === "presets" && (state.presets.length ? state.presets.map((p) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PresetItem, { preset: p, state, host, run, onInstall: () => setTab("plugins") }, p.id)) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Notice, { children: "团队还没有发布预设。" })),
    tab === "models" && (state.models.length ? state.models.map((m) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ModelItem, { model: m, state, run }, m.id)) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Notice, { children: "团队还没有发布模型。" })),
    tab === "plugins" && (state.plugins.length ? state.plugins.map((p) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PluginItem, { plugin: p, run }, p.id)) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Notice, { children: "团队没有固定插件版本。" })),
    toastNode
  ] });
}
function SignIn({ state, run }) {
  const [opened, setOpened] = (0, import_react3.useState)(false);
  const [code, setCode] = (0, import_react3.useState)("");
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const open = () => run(async () => {
    const { url } = await api.login();
    window.open(url, "_blank", "noopener");
    setOpened(true);
  });
  const authorize = async () => {
    setBusy(true);
    await run(() => api.authorize(code), "已授权，团队配置已同步");
    setBusy(false);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    EmptyState,
    {
      mark: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Monogram, { text: "TW", size: 44 }),
      title: state.team ? `重新登录 ${state.team.name}` : "登录你的团队",
      actions: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
        !opened ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "primary", onClick: open, children: "在浏览器中登录" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "form",
          {
            style: { display: "grid", gap: 8, width: "100%" },
            onSubmit: (e) => {
              e.preventDefault();
              if (code.trim()) void authorize();
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Notice, { children: "浏览器里确认后，网页会显示一个两分钟内有效的授权码，粘贴到这里。" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "twui-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Input, { id: "teamwork-code", value: code, onChange: (e) => setCode(e.target.value), placeholder: "授权码", autoComplete: "off", autoFocus: true }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "submit", variant: "primary", busy, disabled: !code.trim(), children: "授权" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "ghost", onClick: open, style: { justifySelf: "start" }, children: "重新打开登录页" })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "twui-subtle", children: [
          "服务器：",
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "twui-mono", children: state.server })
        ] })
      ] }),
      children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: "登录后，团队发布的预设、模型和插件版本会同步到这台 DSH，与你本地的配置并存，不会覆盖。团队模型经服务器调用，provider 密钥不会下发到本机。" })
    }
  );
}
function Header({ state, run }) {
  const team = state.team;
  const { sync } = state;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "twui-row", style: { minWidth: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Monogram, { text: team?.name ?? "TW" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { minWidth: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: team?.name ?? "尚未同步团队" }),
        " ",
        team && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { outline: true, children: team.role === "admin" ? "管理员" : "成员" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "twui-row", style: { marginLeft: "auto" }, children: [
      sync.running ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Badge, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Spinner, {}),
        " 正在同步"
      ] }) : sync.lastError ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { tone: "danger", dot: true, title: sync.lastError, children: "同步失败，保留上次的配置" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { tone: "success", dot: true, children: when(sync.lastSuccess) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { size: "sm", busy: sync.running, onClick: () => run(() => api.sync(), "团队配置已同步，本地配置保持不变"), children: "立即同步" }),
      team?.role === "admin" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { size: "sm", onClick: () => window.open(state.consoleUrl, "_blank", "noopener"), children: "在网页中管理团队 ↗" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { size: "sm", variant: "ghost", onClick: () => run(() => api.logout(), "已退出，团队配置已从这台 DSH 移除"), children: "退出" })
    ] })
  ] });
}
function SessionLine({ state }) {
  const s = state.session;
  if (!s) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Notice, { children: "打开一个会话后，可以把团队的预设或模型用到这个会话里。" });
  const teamModel = (id) => state.models.find((m) => m.id === id)?.name ?? state.presets.find((p) => p.id === id)?.model ?? id;
  const model = s.model ? s.model.team ? teamModel(s.model.model) : `${s.model.provider}/${s.model.model}` : "未选择";
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Notice, { children: [
    "当前会话：模型 ",
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: model }),
    s.preset && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
      " · 预设 ",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("strong", { children: [
        s.preset.name,
        " v",
        s.preset.version
      ] })
    ] }),
    " · ",
    s.started ? "已开始对话" : "尚未开始对话"
  ] });
}
function PresetItem({ preset, state, host, run, onInstall }) {
  const [open, setOpen] = (0, import_react3.useState)(false);
  const missing = missingTools(preset);
  const plugins = pluginsNotReady(preset);
  const active = state.session?.preset?.id === preset.id;
  const blocked = !preset.modelAvailable ? "预设引用的团队模型已不可用，请联系管理员。" : plugins.length ? `依赖插件 ${plugins.map((p) => p.name).join("、")} 未就绪，先在"团队插件"里安装。` : missing.length && state.session ? `缺少必需工具 ${missing.map((t) => t.name).join("、")}，请在 DSH 插件管理器中安装或启用。` : void 0;
  const useBlocked = blocked ?? (!state.session ? "" : state.session.started && !active ? "当前会话已开始对话，预设只能用在新会话里。" : void 0);
  const ready = !blocked;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    Item,
    {
      title: preset.name,
      subtitle: `${preset.id} · v${preset.version}`,
      description: preset.description || void 0,
      tags: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { children: preset.model }),
        active ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { tone: "accent", dot: true, children: "本会话正在使用" }) : ready ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { tone: "success", dot: true, children: "可以使用" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { tone: "warning", dot: true, children: "未就绪" })
      ] }),
      actions: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "ghost", "aria-expanded": open, onClick: () => setOpen(!open), children: open ? "收起" : "详情" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { disabled: !ready || !state.team, onClick: () => {
          host.uiWorkspace.startSession(void 0, { agentPreset: `team:${state.team.id}:${preset.id}` });
          host.layout.selectPanel(null);
        }, children: "用它新建会话" }),
        !active && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "primary", disabled: useBlocked !== void 0, onClick: () => run(() => api.use(state.session.id, preset.id), (r) => r.message), children: "在当前会话使用" })
      ] }),
      notice: useBlocked && !active ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Notice, { tone: blocked ? "warning" : "neutral", children: [
        useBlocked,
        plugins.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { size: "sm", variant: "ghost", onClick: onInstall, children: "去安装" })
        ] })
      ] }) : void 0,
      children: open && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ItemBody, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(DefinitionList, { items: [
          ["模型", /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "twui-mono", children: preset.model })],
          ["工具", preset.tools.length ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "twui-row", children: preset.tools.map((t) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Badge, { tone: toolText[t.state][1], title: t.required ? "必需" : "可选", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "twui-mono", children: t.name }),
            " ",
            t.required ? "" : "（可选）",
            toolText[t.state][0]
          ] }, t.name)) }) : "无要求"],
          ["依赖插件", preset.plugins.length ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "twui-row", children: preset.plugins.map((p) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Badge, { tone: pluginText[p.state][1], children: [
            p.name,
            " @",
            p.version,
            " · ",
            pluginText[p.state][0]
          ] }, p.id)) }) : "无"],
          ["版本", `v${preset.version}；管理员发布新版本后，下次同步生效`]
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "twui-subtle", children: "工具按当前会话检查；切换会话后和每次请求前都会重新检查。" })
      ] })
    }
  );
}
function ModelItem({ model, state, run }) {
  const s = state.session;
  const active = !!s?.model?.team && s.model.model === model.id;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    Item,
    {
      title: model.name,
      subtitle: model.id,
      description: `上游：${model.upstream}。经团队服务器调用，provider 密钥留在服务器上。`,
      actions: active ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { tone: "accent", dot: true, children: "本会话正在使用" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "primary", disabled: !s, onClick: () => run(() => api.use(s.id, model.id), (r) => r.message), children: "在当前会话使用" })
    }
  );
}
function PluginItem({ plugin, run }) {
  const [confirming, setConfirming] = (0, import_react3.useState)(false);
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [label, tone] = pluginText[plugin.state];
  const spec = `${plugin.package ?? plugin.name}@${plugin.version}`;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    Item,
    {
      title: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "twui-mono", children: plugin.package ?? plugin.name }),
      subtitle: `@${plugin.version}`,
      description: plugin.description || void 0,
      tags: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { tone, dot: true, children: label }),
        plugin.localVersion && plugin.localVersion !== plugin.version && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Badge, { children: [
          "本地 ",
          plugin.localVersion
        ] })
      ] }),
      actions: plugin.state === "missing" && !confirming ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "primary", onClick: () => setConfirming(true), children: "安装" }) : plugin.state === "missing" ? void 0 : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "twui-subtle", children: "在 DSH 插件管理器中管理" }),
      children: confirming && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        Confirm,
        {
          title: `安装并启用 ${spec}？`,
          description: "这会在你的电脑上执行该插件的代码。版本由团队固定；已经装过的同名插件不会被覆盖。",
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

// src/web/index.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var inject = ["slots", "sessions", "layout", "uiWorkspace"];
function apply(ctx) {
  const host = {
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
    () => ctx.slots.register({ name: "sidebar.panellist", id: PANEL_ID, order: 60, label: "Teamwork" }, (owner) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TeamIcon, { size: owner?.size || 16, active: !!owner?.active }))
  );
  ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: PANEL_ID }, () => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TeamworkPanel, { host })));
}
function TeamIcon({ size, active }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
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
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { cx: "9", cy: "7", r: "4" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" })
      ]
    }
  );
}
return module.exports; } });
