import type { CapacitorConfig } from "@capacitor/cli";

// T2.3 validation harness. Wraps the built `todo-list-convex` template
// (Convex sandbox + Firebase auth + tenant isolation) in Capacitor iOS
// + Android shells so we can measure offline behaviour, reconnect
// latency, and WebSocket survival across mobile network handoffs.
//
// `webDir` is populated by `scripts/build-and-sync.sh` — it copies the
// freshly-built template into `www/` so Capacitor has a self-contained
// payload without traversing the monorepo at sync time.
const config: CapacitorConfig = {
  appId: "app.appio.convexpoc",
  appName: "Appio Convex POC",
  webDir: "www",
  server: {
    // For local dev iteration, set to the live esbuild --watch URL
    // (e.g. "http://192.168.1.42:8000") and re-run `npx cap sync`.
    // Leave undefined for the airplane-mode test runs — those need the
    // bundle served from the device's filesystem so only the Convex
    // WebSocket goes over the network.
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
