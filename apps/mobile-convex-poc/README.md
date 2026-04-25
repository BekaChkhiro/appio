# mobile-convex-poc

T2.3 validation harness — wraps the [`todo-list-convex`](../../packages/templates/todo-list-convex/) template in Capacitor iOS + Android shells so we can collect the empirical data that drives the Convex-on-mobile Go/No-Go decision.

**Not a shipped product.** This app exists to answer four questions:

1. Does the Convex client survive iOS/Android backgrounding + airplane-mode toggles without losing queued mutations?
2. What is the WebSocket reconnect latency on each platform and on a WiFi ↔ cellular handoff?
3. Is offline UX **at parity or better** than the legacy Firestore-based `todo-list` template?
4. What mobile-specific patterns must we fold into `agent_system.md` for Sprint 3?

Outputs flow into [`docs/adr/002-convex-mobile-validation.md`](../../docs/adr/002-convex-mobile-validation.md) (the report) and [`docs/patterns/convex-offline-mobile.md`](../../docs/patterns/convex-offline-mobile.md) (the pattern doc).

## Prerequisites

- macOS (for iOS — Xcode 15+, CocoaPods, an iOS 17 Simulator runtime)
- Android Studio Hedgehog or newer + JDK 17
- Node 20+
- Real Firebase project (Google sign-in enabled) — credentials in `packages/templates/todo-list-convex/src/config/firebase.ts`
- Real Convex sandbox deployment URL — in `packages/templates/todo-list-convex/src/config/convex.ts`

If either config still has `REPLACE_ME` placeholders, `scripts/build-and-sync.sh` aborts before the build.

## Quick start

```sh
cd apps/mobile-convex-poc
npm install
npm run setup           # builds template, runs `cap add ios` + `cap add android`, syncs
npm run open:ios        # opens Xcode workspace — pick a simulator + Run
# OR
npm run open:android    # opens Android Studio
```

After every code change to the template, re-stage:

```sh
npm run build           # rebuilds template + npx cap sync
```

## Why isolated from `apps/mobile/`?

`apps/mobile/` is an Expo / React-Native scaffold from an earlier plan iteration (pre-Capacitor pivot). Leaving it untouched means:

- Any work-in-progress on the Expo scaffold isn't disturbed.
- The Capacitor experiment is cleanly isolated — easy to delete after Sprint 5 if Capacitor wins (then re-derive the production path) or if it loses (delete this directory + revisit).

Retiring the Expo scaffold is a separate decision tracked outside T2.3.

## What this harness does NOT do

- It does not push to App Store / Play Store. T2.3's scope is local-device validation only.
- It does not include the Layout Block Registry or Theme Personas — those land in Sprint 4 and would muddy the validation signal.
- It does not implement the production `useCollection` / Zustand-persist pattern — that's T3.1. The instrumentation here lives inside the template's `src/lib/` so it can be deleted cleanly when T3.1 productionises the abstraction.

## Where to look

- Test scenarios + commands: [`docs/runbooks/t2.3-mobile-validation.md`](../../docs/runbooks/t2.3-mobile-validation.md)
- Empty report waiting for empirical numbers: [`docs/adr/002-convex-mobile-validation.md`](../../docs/adr/002-convex-mobile-validation.md)
- Distilled pattern for Sprint 3 RAG: [`docs/patterns/convex-offline-mobile.md`](../../docs/patterns/convex-offline-mobile.md)
- Instrumentation source: [`packages/templates/todo-list-convex/src/lib/`](../../packages/templates/todo-list-convex/src/lib/)
