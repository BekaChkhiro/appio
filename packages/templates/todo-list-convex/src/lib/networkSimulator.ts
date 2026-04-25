// In-WebView WebSocket patcher for the T2.3 mobile validation harness.
//
// Why this exists: real airplane-mode toggling on iOS Simulator requires
// macOS Network Link Conditioner with manual prefpane flicks. We can't
// drive that from `simctl`. Patching `WebSocket` at module-load time
// gives us a programmatic equivalent that's good enough to test the
// *Convex client's* offline behaviour — which is the load-bearing
// question for T2.3, not "does iOS handle airplane mode" (Apple already
// guarantees that).
//
// Two-pronged install: replace `window.WebSocket` so any consumer that
// reads the global picks up the patched version, AND export
// `PatchedWebSocket` so `ConvexClientProvider` can pass it explicitly via
// the `webSocketConstructor` option (Convex captures the global at
// module-load and stores it; if our patch lands after that capture, the
// global swap is moot — the explicit option is the authoritative path).

declare global {
  interface Window {
    __appioSim?: {
      isOffline: () => boolean;
      setOffline: (value: boolean) => void;
    };
  }
}

const RealWebSocket = window.WebSocket;
let isOffline = false;
const liveSockets: WebSocket[] = [];

class PatchedWebSocket extends RealWebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols);
    if (isOffline) {
      // Close synchronously — NOT via setTimeout. A deferred close gives
      // the WS handshake time to complete and Convex time to send queued
      // messages before we tear it down, which defeats the entire offline
      // simulation. Calling close() in CONNECTING state is spec-supported:
      // the socket transitions CONNECTING → CLOSING → CLOSED before any
      // application data flows. Use 1000 (Normal Closure) — code 1006 is
      // a reserved status that throws InvalidAccessError if sent by app.
      try {
        this.close(1000, "simulated-offline");
      } catch {
        // already-closed sockets throw — fine.
      }
      return;
    }
    liveSockets.push(this);
    this.addEventListener("close", () => {
      const idx = liveSockets.indexOf(this);
      if (idx >= 0) liveSockets.splice(idx, 1);
    });
  }
}

// Cover the no-explicit-constructor path. ConvexClientProvider should
// also pass the explicit option, but the global swap is harmless and
// catches anyone else who creates a WebSocket.
window.WebSocket = PatchedWebSocket as unknown as typeof WebSocket;

function appendDiag(message: string): void {
  try {
    const log = JSON.parse(localStorage.getItem("appio:t2.3:sim-diag") ?? "[]");
    if (Array.isArray(log)) {
      log.push({ at: Date.now(), message });
      localStorage.setItem(
        "appio:t2.3:sim-diag",
        JSON.stringify(log.slice(-50)),
      );
    }
  } catch {
    // ignore
  }
}

appendDiag("networkSimulator loaded");

window.__appioSim = {
  isOffline: () => isOffline,
  setOffline: (value: boolean) => {
    const before = liveSockets.length;
    isOffline = value;
    if (value) {
      for (const ws of [...liveSockets]) {
        try {
          ws.close(1000, "simulated-offline");
        } catch {
          // already closed
        }
      }
      liveSockets.length = 0;
    }
    appendDiag(`setOffline(${value}) — closed ${before} live socket(s)`);
    window.dispatchEvent(
      new CustomEvent("appio:simulator-state", { detail: { isOffline } }),
    );
  },
};

// Exported for explicit injection into the Convex client constructor.
export { PatchedWebSocket };
