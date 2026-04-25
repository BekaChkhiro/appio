// Debug overlay for the T2.3 mobile validation harness.
//
// Renders a small fixed-position card in the bottom-right corner with:
//   • Connection state (green/red dot, latest reconnect latency)
//   • Audit-log totals (queued / acked / pending / failed)
//   • Buttons to copy each log to the clipboard and reset
//
// Visibility:
//   - URL param `?debug=1` (sticky — also sets localStorage flag)
//   - localStorage `appio:t2.3:debug` = "1"
//   - URL param `?debug=0` clears it
//
// Sticky so a tester can flip it on once at the start of a session and
// keep it across the inevitable WebView reloads on iOS background cycles.

import { useEffect, useState, type CSSProperties, type ReactElement } from "react";
import { useConvex } from "convex/react";

import {
  startConnectionMonitor,
  useConnectionStore,
  exportConnectionLog,
  clearConnectionLog,
} from "./connectionMonitor";
import {
  useAuditStore,
  exportAuditLog,
  clearAuditLog,
} from "./mutationAudit";

const DEBUG_KEY = "appio:t2.3:debug";

function readDebugFlag(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("debug");
    if (fromQuery === "1") {
      localStorage.setItem(DEBUG_KEY, "1");
      return true;
    }
    if (fromQuery === "0") {
      localStorage.removeItem(DEBUG_KEY);
      return false;
    }
    return localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function InstrumentOverlay(): ReactElement | null {
  const client = useConvex();
  const [enabled] = useState(readDebugFlag);
  const connection = useConnectionStore();
  const audit = useAuditStore();

  useEffect(() => {
    if (!enabled) return;
    const stop = startConnectionMonitor(client);
    return stop;
  }, [enabled, client]);

  if (!enabled) return null;

  const lastLatency =
    connection.reconnectLatenciesMs[connection.reconnectLatenciesMs.length - 1] ??
    null;
  const totals = audit.entries.reduce(
    (acc, e) => {
      if (e.errorAt !== null) acc.failed += 1;
      else if (e.ackedAt !== null) acc.acked += 1;
      else acc.pending += 1;
      return acc;
    },
    { acked: 0, pending: 0, failed: 0 },
  );

  const copyConnection = async () => {
    await copyToClipboard(exportConnectionLog());
  };
  const copyAudit = async () => {
    await copyToClipboard(exportAuditLog());
  };
  const reset = () => {
    if (confirm("Reset T2.3 logs? This wipes connection + audit history.")) {
      clearConnectionLog();
      clearAuditLog();
    }
  };

  const dotColor = connection.current.isWebSocketConnected
    ? "#16a34a"
    : "#dc2626";

  return (
    <div
      role="status"
      aria-label="T2.3 instrumentation overlay"
      style={{
        position: "fixed",
        right: 12,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        zIndex: 2147483646,
        padding: "10px 12px",
        background: "rgba(15, 23, 42, 0.92)",
        color: "#f8fafc",
        font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
        borderRadius: 10,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        maxWidth: 240,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: dotColor,
            display: "inline-block",
          }}
        />
        <strong style={{ fontWeight: 600 }}>
          {connection.current.isWebSocketConnected ? "ws: open" : "ws: closed"}
        </strong>
        {connection.current.hasInflightRequests && (
          <span style={{ marginLeft: "auto", color: "#fde68a" }}>inflight</span>
        )}
      </div>

      <div style={{ opacity: 0.85 }}>
        last reconnect:{" "}
        <strong>{lastLatency === null ? "—" : `${lastLatency} ms`}</strong>
      </div>
      <div style={{ opacity: 0.85 }}>
        reconnects logged: <strong>{connection.reconnectLatenciesMs.length}</strong>
      </div>

      <div style={{ marginTop: 6, opacity: 0.85 }}>
        mutations:{" "}
        <span style={{ color: "#86efac" }}>{totals.acked}✓</span>{" "}
        <span style={{ color: "#fde68a" }}>{totals.pending}…</span>{" "}
        <span style={{ color: "#fca5a5" }}>{totals.failed}✗</span>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          type="button"
          onClick={copyConnection}
          style={overlayBtn}
          aria-label="Copy connection log to clipboard"
        >
          copy conn
        </button>
        <button
          type="button"
          onClick={copyAudit}
          style={overlayBtn}
          aria-label="Copy mutation audit log to clipboard"
        >
          copy audit
        </button>
        <button
          type="button"
          onClick={reset}
          style={{ ...overlayBtn, background: "#7f1d1d" }}
          aria-label="Reset T2.3 logs"
        >
          reset
        </button>
      </div>
    </div>
  );
}

const overlayBtn: CSSProperties = {
  padding: "4px 8px",
  background: "#1e293b",
  color: "#f8fafc",
  border: "1px solid #475569",
  borderRadius: 6,
  font: "inherit",
  cursor: "pointer",
};

async function copyToClipboard(text: string): Promise<void> {
  // navigator.clipboard requires HTTPS or localhost; on Capacitor's
  // file:// scheme it can fail silently. Fall back to a textarea-and-
  // execCommand-copy hack so the runbook only ever needs one button.
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fall through
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
}
