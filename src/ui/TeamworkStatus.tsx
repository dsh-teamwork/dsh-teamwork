import React from "react";

export interface TeamworkStatusProps {
  isAuthenticated: boolean;
  teamName?: string;
  pendingSyncCount: number;
}

export function TeamworkStatus({ isAuthenticated, teamName, pendingSyncCount }: TeamworkStatusProps) {
  return (
    <div style={{ padding: "0.5rem 1rem", fontFamily: "system-ui", fontSize: "0.875rem" }}>
      <span>dshteam</span>
      {isAuthenticated ? (
        <span style={{ marginLeft: "0.5rem", color: "#22c55e" }}>
          {teamName ?? "Connected"} {pendingSyncCount > 0 && `(${pendingSyncCount} pending)`}
        </span>
      ) : (
        <span style={{ marginLeft: "0.5rem", color: "#ef4444" }}>Not connected</span>
      )}
    </div>
  );
}
