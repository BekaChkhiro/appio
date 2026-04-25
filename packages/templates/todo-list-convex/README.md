# todo-list-convex

End-to-end POC for the Appio sandbox Convex architecture. Tenant-isolated
reactive todo list backed by Firebase Auth → Convex JWT → `tenantQuery` /
`tenantMutation` helpers (see [`docs/adr/001-convex-tenant-isolation.md`](../../../docs/adr/001-convex-tenant-isolation.md)).

This template closes T2.2. It proves:

1. Convex schema + tenant indexes accepted by the pre-build scanner.
2. Firebase ID tokens authenticate Convex requests so every document
   carries a real `tenantId`.
3. Queries stream in real-time — a write from tab A appears in tab B
   without polling.
4. User A cannot see User B's tasks even with the same query.

## Contents

```
packages/templates/todo-list-convex/
├── convex/
│   ├── schema.ts           # tasks table + by_tenant[/_and_completed] indexes
│   └── tasks.ts            # listTasks / getTask / createTask / toggleTask / deleteTask
├── src/
│   ├── App.tsx             # Sign-in gate → reactive todo UI
│   ├── index.tsx           # React root (wraps in ConvexClientProvider)
│   ├── config/
│   │   ├── convex.ts       # Sandbox deployment URL (replaced on publish)
│   │   └── firebase.ts     # Stub config — overwritten at generation time
│   └── styles/global.css
├── template.config.json    # storageBackend: "convex"
└── README.md               # this file
```

Infra (`package.json`, `esbuild.config.mjs`, `gate.js`, `sw.js`, `index.html`,
`manifest.json`, `convex/_helpers.ts`, `convex/auth.config.ts`,
`convex/tsconfig.json`, `src/ConvexClientProvider.tsx`) is inherited from
[`packages/templates/base/`](../base) — the golden workspace copies base
first, then overlays this template's files. The Firebase → Convex JWT
bridge (T2.4) lives in base so every Convex-backed generated app inherits
it without per-template boilerplate.

## Setup (first run)

Prereqs: Node 20+, `npx convex` CLI, Firebase project (free tier is fine).

```sh
# 1. Overlay onto the golden workspace (or a fresh scratch dir).
cp -R packages/templates/base/ /tmp/todo-convex/
cp -R packages/templates/todo-list-convex/* /tmp/todo-convex/
cd /tmp/todo-convex
npm install

# 2. Generate Convex types + push schema to sandbox.
#    Pick up CONVEX_DEPLOYMENT + CONVEX_DEPLOY_KEY from the sandbox (.env.local)
npx convex dev --once          # writes convex/_generated/{api,dataModel,server}.(d.)ts

# 3. Drop real Firebase config into src/config/firebase.ts (see snippet below).
# 4. Build.
node esbuild.config.mjs        # writes dist/
```

Real Firebase config example (replace placeholders from Firebase console →
Project settings → Your apps):

```ts
// src/config/firebase.ts
export const firebaseConfig = {
  apiKey: "AIzaSy…",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  appId: "1:…:web:…",
};
```

Firebase must have Google sign-in enabled (Auth → Sign-in method →
Google → Enable).

## Deploy to R2 (preview)

Production deploy happens through the builder pipeline; for a manual
preview upload:

```sh
# Versioned prefix per T2.2 spec.
VERSION=$(date +%Y%m%d%H%M%S)
rclone copy dist/ r2:appio-previews/todo-convex-poc/v$VERSION/ --progress
# Then flip the Cloudflare KV pointer for the preview slug to v$VERSION.
```

The full pipeline (Fly Machine → esbuild+Tailwind → R2 versioned upload →
KV atomic switch) is the orchestrator's job; documented here only for
manual smoke tests.

## Verification steps (T2.2 acceptance)

Run each of these with the deployed preview URL on `*.appiousercontent.com`
open in two browser profiles.

### 1. Scanner passes

```sh
python -c "from pathlib import Path; \
  from appio_builder.convex_scanner import scan_convex_tenancy; \
  r = scan_convex_tenancy(Path('packages/templates/todo-list-convex')); \
  print('ok' if r.ok else r.findings)"
```

Expected: `ok`. Any finding is a build-time reject.

### 2. Reactive sync (single tenant, two tabs)

- Open the deployed app in tab A and tab B signed into the **same** Google
  account.
- Create a task in tab A.
- Expected: task appears in tab B within ~500 ms with no user action. No
  refetch button, no polling delay — this is `useQuery` live.

### 3. Cross-tenant isolation (two tenants)

- Open tab A signed into `userA@…`, tab B signed into `userB@…` (two
  different Google accounts).
- In tab A, create tasks "A1", "A2".
- In tab B, create task "B1".
- Expected:
  - Tab A sees only A1 + A2.
  - Tab B sees only B1.
  - Neither tab sees the other's rows at any point.

### 4. Scanner rejects a bypass (negative test)

Temporarily remove the `.withIndex("by_tenant", …)` call from
`convex/tasks.ts:listTasks` and rerun step 1. Scanner must fail with
`missing .withIndex("by_tenant…")`.

## Verification steps (T2.4 acceptance — Firebase Auth → Convex JWT bridge)

These extend T2.2's checks to cover the full OAuth → Convex authed query
round trip. Run against a deployed preview with real Firebase + Convex
sandbox credentials.

### 1. Static contract intact

```sh
pytest python/builder/tests/test_auth_bridge.py -q
```

Expected: all tests pass. Guards the bridge shape so a careless refactor
can't silently disconnect it.

### 2. Google OAuth → authenticated Convex query

- Open the deployed preview in a fresh browser profile.
- Click "Continue with Google" → complete Google sign-in.
- Expected:
  - `identity.subject` (the Firebase uid) flows into `ctx.tenantId` via
    `tenantQuery`. In DevTools → Network, the Convex WebSocket frames
    carry the Firebase ID token; first `listTasks` returns `[]` for a
    brand-new account.
  - Creating a task persists it; refreshing the page restores it (proves
    the token is validated server-side, not just read client-side).

### 3. Apple OAuth → authenticated Convex query

- Repeat step 2 using the "Continue with Apple" path (uncomment in
  App.tsx or swap the handler for the smoke test). Firebase must have
  Apple sign-in enabled (Auth → Sign-in method → Apple → Enable).
- Expected: same as step 2. Apple's Firebase uid is a different
  namespace but the bridge is provider-agnostic — both produce a valid
  `identity.subject`.

### 4. Token refresh handled transparently

- Sign in, wait ~1 hour (Firebase ID tokens expire after 60 minutes).
- Create a task. Expected: Convex asks the adapter for
  `fetchAccessToken({ forceRefreshToken: true })`, `useAuth.getIdToken`
  hands back a fresh token, write succeeds without a re-login prompt.

### 5. Signed-out callers are rejected

- Sign out, then use DevTools → Application → Local Storage to clear
  the Firebase session.
- In the Convex dashboard's Functions view, invoke `listTasks`
  unauthenticated. Expected: `NotAuthenticatedError` — `tenantQuery`
  throws when `identity` is `null`, so there is no way to read another
  tenant's data even if their ids leak.

## Sandbox cost projection

All preview/draft apps share one Convex deployment
(`adventurous-corgi-465`). The free tier gives us:

- 1 GB storage
- 1 M function calls / month
- 1 GB bandwidth / month
- No deployment cap (we're one deployment, not 300)

**Per active draft (assumed realistic usage):**

| Metric          | Estimate / draft / month |
| --------------- | ------------------------ |
| Function calls  | ~500 (list + a few muts) |
| Document writes | ~20                      |
| Storage         | ~2 KB                    |
| Bandwidth       | ~0.5 MB                  |

**Extrapolations (assume 80/20 active/total ratio):**

| Active drafts | Function calls / mo | Storage | Plan fit                   |
| ------------- | ------------------- | ------- | -------------------------- |
| 30 (beta)     | 15 K                | 60 KB   | Free (well under)          |
| 1 000         | 500 K               | 2 MB    | Free (50 % headroom)       |
| 10 000        | 5 M                 | 20 MB   | Pro ($25 + usage)          |

Numbers are planning ceilings, not observed — PostHog
`convex_function_calls` / `convex_bandwidth_bytes` per generated app (to
be wired in T5.2) replaces this table with real data before scaling
decisions.

Cost floor if we outgrow free tier: Convex Pro is $25/mo including
5 M function calls + 10 GB. At projected 10 K active drafts we'd stay on
Pro through Sprint 5 comfortably.

## T2.3 instrumentation

This template carries extra `src/lib/` modules used by the [Capacitor
mobile validation harness](../../../apps/mobile-convex-poc/) — they are
**instrumentation only** and meant to be removed once T3.1 productionises
the offline pattern as `useCollection`.

- `src/lib/connectionMonitor.ts` — polls `ConvexReactClient.connectionState()`
  every 250 ms, records reconnect-latency timeline, persists to localStorage.
- `src/lib/mutationAudit.ts` — `useAuditedCreateTask` / `useAuditedToggleTask` /
  `useAuditedDeleteTask` wrap raw Convex mutations with `withOptimisticUpdate`
  + a Zustand audit log (`queuedAt` / `ackedAt` / `errorAt` per call).
- `src/lib/InstrumentOverlay.tsx` — debug HUD; gated on `?debug=1`.

The empirical Go/No-Go data and Sprint-3 implications live in
[`docs/adr/002-convex-mobile-validation.md`](../../../docs/adr/002-convex-mobile-validation.md).
Run protocol: [`docs/runbooks/t2.3-mobile-validation.md`](../../../docs/runbooks/t2.3-mobile-validation.md).
Distilled pattern for Sprint 3 RAG: [`docs/patterns/convex-offline-mobile.md`](../../../docs/patterns/convex-offline-mobile.md).

## Known gaps vs. full production path

Deferred to later tasks — noted so reviewers don't look for them here.

- **Offline UX** — Convex's internal mutation buffer is the queue; this
  template adds optimistic updates + an audit log around it (T2.3). The
  long-term `useCollection` abstraction lands in T3.1.
- **iOS / Android wrappers** — Capacitor shells live in
  [`apps/mobile-convex-poc/`](../../../apps/mobile-convex-poc/) (T2.3).
- **`useCollection` abstraction** — this template calls Convex hooks
  directly. T3.1 introduces the shared hook with a Firestore-compatible
  API.
- **Publish flow** — drafts live on sandbox only. OAuth → user-owned
  Convex migration lands in T3.6.
- **Agent system prompt** — RAG + prompt still reference Firestore. T3.3
  updates both, using
  [`docs/patterns/convex-offline-mobile.md`](../../../docs/patterns/convex-offline-mobile.md)
  as the source.
