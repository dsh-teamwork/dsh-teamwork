import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function TeamworkStatus({ isAuthenticated, teamName, pendingSyncCount }) {
    return (_jsxs("div", { style: { padding: "0.5rem 1rem", fontFamily: "system-ui", fontSize: "0.875rem" }, children: [_jsx("span", { children: "dshteam" }), isAuthenticated ? (_jsxs("span", { style: { marginLeft: "0.5rem", color: "#22c55e" }, children: [teamName ?? "Connected", " ", pendingSyncCount > 0 && `(${pendingSyncCount} pending)`] })) : (_jsx("span", { style: { marginLeft: "0.5rem", color: "#ef4444" }, children: "Not connected" }))] }));
}
//# sourceMappingURL=TeamworkStatus.js.map