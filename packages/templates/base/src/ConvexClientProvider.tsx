// Firebase Auth → Convex bridge.
//
// Uses `ConvexProvider` (bare React context provider) together with
// `useAuth`'s built-in `convexClient` wiring. When `useAuth` receives the
// `ConvexReactClient` instance it calls `client.setAuth(tokenFetcher)` on
// every `onAuthStateChanged` user event and `client.clearAuth()` on sign-out
// — so Convex holds the token fetcher, not a snapshot token, and can
// auto-refresh before expiry. The backend validates the JWT against
// `convex/auth.config.ts` (Firebase issuer + project id) and exposes
// `identity.subject` which `tenantQuery` / `tenantMutation` turn into
// `ctx.tenantId`. See `docs/adr/001-convex-tenant-isolation.md`.
//
// Generated apps that use Convex should wrap their root with this provider:
//
// ```tsx
// import { ConvexClientProvider } from "./ConvexClientProvider";
// createRoot(el).render(
//   <ConvexClientProvider>
//     <App />
//   </ConvexClientProvider>,
// );
// ```
//
// Non-Convex apps can ignore this file entirely — nothing in the shared UI
// imports it.
//
// Reference: https://docs.convex.dev/auth/advanced/custom-jwt

import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ConvexModeProvider } from "@appio/ui/hooks";

import { CONVEX_URL, CONVEX_MODE } from "./config/convex";
import { firebaseConfig } from "./config/firebase";
import { useAuth, type AuthUser } from "./components/ui/useAuth";

// T2.3 mobile validation harness — when the network simulator was
// imported earlier in the bootstrap, it exposes a patched WebSocket
// constructor on `window`. Pass it to Convex explicitly so we don't
// rely on global capture timing. Production templates without the
// harness should NOT define `window.__appioSim` and the option falls
// back to undefined (Convex uses the global default).
const patchedWS = (window as unknown as {
  WebSocket: typeof WebSocket;
  __appioSim?: unknown;
}).__appioSim
  ? (window as unknown as { WebSocket: typeof WebSocket }).WebSocket
  : undefined;

const convex = new ConvexReactClient(CONVEX_URL, {
  ...(patchedWS ? { webSocketConstructor: patchedWS } : {}),
});

// Bridge component: renders inside ConvexProvider so hooks work, then calls
// useAuth with the convex client so auth state changes wire setAuth/clearAuth.
function ConvexAuthBridge({ children }: { children: React.ReactNode }) {
  useAuth(firebaseConfig, convex);
  return <>{children}</>;
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProvider client={convex}>
      <ConvexModeProvider mode={CONVEX_MODE}>
        <ConvexAuthBridge>{children}</ConvexAuthBridge>
      </ConvexModeProvider>
    </ConvexProvider>
  );
}

export type { AuthUser };
