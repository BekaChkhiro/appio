import React from "react";
import { createRoot } from "react-dom/client";

// Auto-enable the T2.3 instrumentation overlay when the app is running
// inside Capacitor — Safari devtools are awkward on iOS Simulator and
// the user can't easily set localStorage from outside the WebView.
try {
  if (typeof (window as unknown as { Capacitor?: unknown }).Capacitor !== "undefined") {
    localStorage.setItem("appio:t2.3:debug", "1");
  }
} catch {
  // localStorage may be disabled — overlay just stays off.
}

// Visible top-of-screen marker so a blank white render is detectable
// vs. a JS module-load crash. If this banner doesn't appear, JS never
// reached this file — check Safari devtools for the import error.
const banner = document.createElement("div");
banner.textContent = "T2.3 boot ok";
banner.style.cssText =
  "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
  "padding:4px 8px;background:#16a34a;color:#fff;" +
  "font:11px/1.2 ui-monospace,monospace;text-align:center;";
document.body.appendChild(banner);

// Trap any uncaught error so we can surface it instead of a blank page.
window.addEventListener("error", (e) => {
  banner.style.background = "#dc2626";
  banner.textContent = `error: ${e.message || "(no message)"}`;
});
window.addEventListener("unhandledrejection", (e) => {
  banner.style.background = "#dc2626";
  banner.textContent = `rejection: ${String(e.reason)}`;
});

(async () => {
  try {
    // The network simulator MUST load before ConvexClientProvider so its
    // WebSocket constructor patch is in place when Convex opens its
    // first socket. Order matters here.
    await import("./lib/networkSimulator");
    const { default: App } = await import("./App");
    const { ConvexClientProvider } = await import("./ConvexClientProvider");
    await import("./styles/global.css");
    createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <ConvexClientProvider>
          <App />
        </ConvexClientProvider>
      </React.StrictMode>,
    );
    banner.style.background = "#0f172a";
    banner.textContent = "T2.3 react mounted";
  } catch (err) {
    banner.style.background = "#dc2626";
    banner.textContent = `boot failed: ${
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    }`;
  }
})();

