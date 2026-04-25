# ADR 001 — Convex Sandbox Tenant Isolation

- **Status**: Accepted
- **Date**: 2026-04-20
- **Sprint**: 2 (T2.1)
- **Supersedes**: nothing
- **Superseded by**: nothing

## Context

Generated apps need a backend during the *draft / preview* phase of the
builder. Per the project plan we run a single shared Convex deployment
("appio-sandbox-prod") that hosts every preview app for every user, and only
move data to a user-owned Convex deployment when the app is published
(Sprint 3, T3.6).

A shared deployment means **every document for every preview app lives in the
same database**. Without isolation, a user's query on table `tasks` would see
*all* tasks, including those of other users — a hard cross-tenant data leak.

The agent generates Convex schemas + functions on every build. Any single
forgotten `where` filter is a leak. We need a pattern that:

1. **Forces** tenant filtering at the query layer (not "documented best
   practice" — actually rejected at build time).
2. Is **mechanically checkable** by the pre-build scanner so the agent
   can't ship code that bypasses it.
3. Is **ergonomic enough** that the agent reaches for it by default.

## Decision

### 1. Every multi-tenant table carries `tenantId`

Tables that hold per-user data declare a `tenantId: v.string()` field equal
to the Firebase UID of the document's owner.

```ts
// packages/templates/base/convex/schema.ts
export default defineSchema({
  tasks: defineTable({
    tenantId: v.string(),       // Firebase uid
    title: v.string(),
    completed: v.boolean(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_and_completed", ["tenantId", "completed"]),
});
```

The convention: **every multi-tenant index name starts with `by_tenant`**.
The scanner uses that prefix to recognise an index as tenancy-aware.

Tables that hold globally shared data (e.g., reference lookups) do not need
`tenantId` and must be explicitly listed in the future as exempt — by default
the scanner assumes any `ctx.db.query("table")` call needs tenant filtering.

### 2. Every query filters by `tenantId` via `withIndex("by_tenant…")`

```ts
// good — tenant-filtered via index
const tasks = await ctx.db
  .query("tasks")
  .withIndex("by_tenant", q => q.eq("tenantId", identity.subject))
  .collect();

// good — composite index also acceptable
const open = await ctx.db
  .query("tasks")
  .withIndex("by_tenant_and_completed", q =>
    q.eq("tenantId", identity.subject).eq("completed", false))
  .collect();

// REJECTED by scanner — no withIndex("by_tenant…")
const all = await ctx.db.query("tasks").collect();

// REJECTED — .filter() doesn't use the index, can scan other tenants
const all = await ctx.db
  .query("tasks")
  .filter(q => q.eq(q.field("tenantId"), identity.subject))
  .collect();
```

`.filter()` is rejected because Convex evaluates filters *after* the index
scan. Without an index restriction, the engine still touches other tenants'
documents — even if it returns the right subset, latency and read-cost scale
with total table size, and a single typo (`q.field("userId")` instead of
`tenantId`) reintroduces the leak. Indexes are mandatory.

### 3. Helpers wrap the boilerplate

Direct use of `ctx.db.query(...)` is ergonomic for one-off code but easy to
get wrong. We ship two helper layers:

- `tenantQuery` / `tenantMutation` / `tenantInternalQuery` — wrappers around
  `query`/`mutation`/`internalQuery` that resolve `identity.subject` once and
  expose it on `ctx.tenantId`. Inside the handler the developer (or agent)
  still writes `ctx.db.query("tasks").withIndex("by_tenant", ...)` — but
  there is no path that forgets to fetch the identity.
- The scanner accepts both styles: anything chained off `ctx.db.query("X")`
  must include `.withIndex("by_tenant…")` regardless of whether the
  surrounding handler uses the helper.

### 4. `ctx.db.get(documentId)` is allowed without tenant guard

Direct lookups by `Id<"table">` are accepted by the scanner because the
document ID is opaque and unguessable: there is no way for a user to
construct an ID for another tenant's row. The handler is still expected to
verify ownership when sensitive (e.g., before mutating), but a static check
cannot tell whether a given `id` came from a tenant-filtered query versus
URL input. We rely on agent prompt rules for that case.

### 5. Auth bridge: Firebase JWT → Convex identity

Convex's `auth.config.ts` validates Firebase ID tokens (T2.4 wires this end
to end). Inside a query/mutation handler:

```ts
const identity = await ctx.auth.getUserIdentity();
if (identity === null) throw new Error("not authenticated");
const tenantId = identity.subject;   // === Firebase uid
```

The helpers in §3 do this once at the top of every handler.

## Consequences

### Positive

- Single rule (`every query goes through by_tenant…`) is easy to teach the
  agent and easy to enforce mechanically.
- Indexes are mandatory, so multi-tenant queries are O(matching rows), not
  O(table size). Sandbox stays cheap as it grows.
- Scanner failure messages point exactly at the offending file + line, so
  the agent's auto-fix loop can patch in one iteration.

### Negative / Trade-offs

- Tables without `tenantId` (e.g., global reference data) currently
  trigger false positives in the scanner. We accept this for Sprint 2 — the
  workaround is "don't query global tables from generated apps". A
  `// scanner-allow: shared-table` opt-out is tracked for Sprint 3 if the
  use case appears.
- `.filter()` ergonomics are restricted. Composite indexes solve every
  legitimate case; the cost is up-front index design.
- The scanner is heuristic, not a parser. It's deliberately strict: false
  positives are easier to triage than missed leaks.

## Sandbox Provisioning Steps (one-time, manual)

The shared deployment cannot be provisioned headlessly — Convex requires
interactive login. Status as of 2026-04-20: **provisioned**.

**Active sandbox deployment**

| | |
|-|-|
| Convex project | `appio-sandbox` (team: beka-chkhirodze) |
| Dev deployment slug | `adventurous-corgi-465` |
| Region | Europe (Ireland), `eu-west-1` |
| Client URL | `https://adventurous-corgi-465.eu-west-1.convex.cloud` |
| HTTP actions URL | `https://adventurous-corgi-465.eu-west-1.convex.site` |
| Dashboard | <https://dashboard.convex.dev/d/adventurous-corgi-465> |

The current deployment is a **dev** deployment (provisioned via `npx convex
dev`). For Sprint 2 POC work this is sufficient; promotion to a prod
deployment (`npx convex deploy --prod`) happens before Sprint 5 beta launch
(T5.1).

**Replay steps (for re-provisioning, e.g., new dev workstation)**

```bash
# 1. Install Convex CLI (already in template package.json after T2.1)
cd packages/templates/base
npm install

# 2. Authenticate the Convex CLI against the Appio team account
npx convex login

# 3. Initialize the dev deployment for the appio-sandbox project.
#    When prompted, select:
#       Team:     beka-chkhirodze
#       Project:  appio-sandbox
#       Region:   Europe (Ireland)
#    The deployment slug is auto-generated (e.g., adventurous-corgi-465).
npx convex dev --once

# 4. The convex/auth.config.ts file references FIREBASE_PROJECT_ID which
#    must be set on the deployment BEFORE the first push. Set it via:
#       https://dashboard.convex.dev/d/<slug>/settings/environment-variables
#    Value: appio-prod  (matches the existing Firebase project)

# 5. Re-run step 3 — schema + functions deploy automatically. You should
#    see the by_tenant indexes added in the output.

# 6. Copy values from packages/templates/base/.env.local into the project
#    root .env (and .env.example for documentation):
#       APPIO_SANDBOX_CONVEX_URL=<CONVEX_URL>
#       APPIO_SANDBOX_CONVEX_SITE_URL=<CONVEX_SITE_URL>
#       APPIO_SANDBOX_CONVEX_DEPLOYMENT=<CONVEX_DEPLOYMENT>
```

After step 6, FastAPI reads `APPIO_SANDBOX_CONVEX_URL` to point generated
preview apps at the sandbox. Runtime preview apps authenticate via Firebase
JWT (see §5 above) — no deploy key is exposed to the browser.

## Scanner Implementation

`appio_builder.convex_scanner.scan_convex_tenancy()` walks every `.ts` file
under any `convex/` directory in the project and rejects files where:

1. A `ctx.db.query("X")` chain does not contain `.withIndex("by_tenant`
   within the same statement.
2. A `.filter(` call appears in the chain (signal that the developer
   reached for the wrong tool — composite index needed instead).

The scanner is invoked by `scan_project()` automatically when a `convex/`
directory exists; opting out is not possible by design.

## References

- Project plan: T2.1 (Sprint 2)
- Convex docs: <https://docs.convex.dev/database/indexes>
- Convex auth bridge (Sprint 2): T2.4
- OAuth migration to user Convex (Sprint 3): T3.6
