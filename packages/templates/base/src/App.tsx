import React from "react";

// __APPIO_PLACEHOLDER_APP_TSX_DO_NOT_SHIP__ — unique marker so the deploy
// pipeline refuses to ship an un-replaced placeholder. The agent overwriting
// this file must NOT copy this comment or the marker string above into
// production code; it's a tripwire, not boilerplate.

/**
 * Placeholder App component — the agent MUST overwrite this file.
 * If this placeholder renders, it means the agent failed to create App.tsx.
 */
export default function App() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#6b7280",
        padding: "24px",
        textAlign: "center",
      }}
    >
      App is loading…
    </div>
  );
}
