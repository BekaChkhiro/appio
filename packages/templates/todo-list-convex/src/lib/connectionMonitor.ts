// Convex connection-state monitor for the T2.3 mobile validation harness.
//
// Polls `ConvexReactClient.connectionState()` at 250 ms, records every
// disconnect → reconnect cycle with millisecond timestamps, and persists
// the log to localStorage so the data survives Capacitor WebView reloads
// (iOS aggressively recycles WebViews when an app backgrounds).
//
// Why polling instead of an event subscription: convex@^1.18 does not
// expose a public connection-state subscription. The internal client
// emits state changes synchronously, but the typed surface only gives us
// a snapshot via `connectionState()`. 250 ms is a safe upper bound on
// the latency we'll record without sampling so often that we burn the
// device CPU during a long-running test.
//
// Lifetime: a single monitor instance per page. `start()` is idempotent
// and safe to call from React effects.

import { create } from "zustand";
import type { ConvexReactClient } from "convex/react";

export type ConnectionTransition = {
  /** Wall-clock ms (Date.now()) when the transition was observed. */
  at: number;
  /** Connection state observed *after* the transition. */
  to: "connected" | "disconnected";
  /**
   * Latency from the matching opposite-edge transition. For a
   * `to: "connected"` row this is the reconnect latency in ms; for a
   * `to: "disconnected"` row this is how long the previous online
   * window lasted. `null` for the very first sample after start().
   */
  deltaMs: number | null;
};

export type ConnectionSnapshot = {
  isWebSocketConnected: boolean;
  hasInflightRequests: boolean;
  /** Date.now() of the oldest in-flight request, or null. */
  oldestInflightAt: number | null;
};

type ConnectionStore = {
  current: ConnectionSnapshot;
  transitions: ConnectionTransition[];
  /** Reconnect latencies in ms, oldest first. Convenience for charts. */
  reconnectLatenciesMs: number[];
  /** Wall-clock when monitoring started (anchor for relative timing). */
  startedAt: number | null;
};

const STORAGE_KEY = "appio:t2.3:connection-log";
const POLL_INTERVAL_MS = 250;

export const useConnectionStore = create<ConnectionStore>(() => ({
  current: {
    isWebSocketConnected: false,
    hasInflightRequests: false,
    oldestInflightAt: null,
  },
  transitions: [],
  reconnectLatenciesMs: [],
  startedAt: null,
}));

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastConnected: boolean | null = null;
let lastEdgeAt: number | null = null;

function persist(): void {
  try {
    const { transitions, reconnectLatenciesMs, startedAt } =
      useConnectionStore.getState();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ transitions, reconnectLatenciesMs, startedAt }),
    );
  } catch {
    // localStorage may be disabled in private mode — instrumentation
    // is best-effort, never block the app.
  }
}

function hydrate(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return;
    const parsed = JSON.parse(raw) as {
      transitions?: ConnectionTransition[];
      reconnectLatenciesMs?: number[];
      startedAt?: number | null;
    };
    useConnectionStore.setState((s) => ({
      ...s,
      transitions: parsed.transitions ?? [],
      reconnectLatenciesMs: parsed.reconnectLatenciesMs ?? [],
      startedAt: parsed.startedAt ?? null,
    }));
  } catch {
    // Ignore corrupt log — fresh test run is fine.
  }
}

export function startConnectionMonitor(client: ConvexReactClient): () => void {
  if (pollTimer !== null) {
    // Already running — return a no-op stop so React effect cleanup
    // stays harmless when StrictMode double-invokes.
    return () => {
      // intentional no-op
    };
  }

  hydrate();

  if (useConnectionStore.getState().startedAt === null) {
    useConnectionStore.setState({ startedAt: Date.now() });
  }

  const tick = () => {
    // `connectionState` exists on ConvexReactClient since 1.13. Cast
    // because the type isn't exposed on every version we'd build
    // against, and we only consume documented fields below.
    const raw = (
      client as unknown as {
        connectionState: () => {
          isWebSocketConnected: boolean;
          hasInflightRequests: boolean;
          timeOfOldestInflightRequest: Date | null;
        };
      }
    ).connectionState();

    const snapshot: ConnectionSnapshot = {
      isWebSocketConnected: raw.isWebSocketConnected,
      hasInflightRequests: raw.hasInflightRequests,
      oldestInflightAt:
        raw.timeOfOldestInflightRequest === null
          ? null
          : raw.timeOfOldestInflightRequest.getTime(),
    };

    const now = Date.now();
    const isConnected = snapshot.isWebSocketConnected;

    if (lastConnected === null) {
      // First sample — establish the baseline edge without recording
      // a transition (we don't know how long the prior state lasted).
      lastConnected = isConnected;
      lastEdgeAt = now;
    } else if (isConnected !== lastConnected) {
      const deltaMs = lastEdgeAt === null ? null : now - lastEdgeAt;
      const transition: ConnectionTransition = {
        at: now,
        to: isConnected ? "connected" : "disconnected",
        deltaMs,
      };

      useConnectionStore.setState((s) => {
        const transitions = [...s.transitions, transition];
        const reconnectLatenciesMs =
          isConnected && deltaMs !== null
            ? [...s.reconnectLatenciesMs, deltaMs]
            : s.reconnectLatenciesMs;
        return { ...s, transitions, reconnectLatenciesMs };
      });

      persist();

      lastConnected = isConnected;
      lastEdgeAt = now;
    }

    useConnectionStore.setState((s) => ({ ...s, current: snapshot }));
  };

  // Sample once immediately so the overlay isn't blank.
  tick();
  pollTimer = setInterval(tick, POLL_INTERVAL_MS);

  return () => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    lastConnected = null;
    lastEdgeAt = null;
  };
}

export function clearConnectionLog(): void {
  useConnectionStore.setState({
    transitions: [],
    reconnectLatenciesMs: [],
    startedAt: Date.now(),
  });
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function exportConnectionLog(): string {
  const s = useConnectionStore.getState();
  return JSON.stringify(
    {
      startedAt: s.startedAt,
      generatedAt: Date.now(),
      transitions: s.transitions,
      reconnectLatenciesMs: s.reconnectLatenciesMs,
      summary: summarise(s.reconnectLatenciesMs),
    },
    null,
    2,
  );
}

function summarise(latencies: number[]): {
  count: number;
  minMs: number | null;
  medianMs: number | null;
  p90Ms: number | null;
  maxMs: number | null;
} {
  if (latencies.length === 0) {
    return { count: 0, minMs: null, medianMs: null, p90Ms: null, maxMs: null };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const pick = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? null;
  return {
    count: sorted.length,
    minMs: sorted[0] ?? null,
    medianMs: pick(0.5),
    p90Ms: pick(0.9),
    maxMs: sorted[sorted.length - 1] ?? null,
  };
}
