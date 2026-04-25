# ADR 005 — `useCollection` hook contract for Convex-backed templates

Status: Accepted — 2026-04-21
Task: T3.1 (narrow scope — offline write queue deferred to T3.1b)

## Context

T3.1 (PROJECT_PLAN.md) asks for a rewrite of the agent-facing
`useCollection` hook so that Convex replaces Firestore as the default
backend. The original hook, which still ships in
`packages/templates/base/src/components/ui/useFirestore.tsx`, exposes:

```ts
useCollection<T>(config: FirebaseConfig, collectionPath: string, options?: QueryOptions)
```

It accepts a dynamic `collectionPath` string (`users/{uid}/tasks`) and a
generic filter/sort/limit options bag. Convex is architecturally
incompatible with that shape: Convex queries are pre-compiled typed
functions (`api.tasks.listTasks`), not dynamic table lookups, and their
args are statically typed per function.

Three rewrite approaches were considered:

- **A.** Ship a single generic Convex function (`api.generic.listCollection(path, filters)`) that dispatches by string name. Preserves the path-string API but loses type safety, forces every template to register tables through the gateway, and puts all filtering inside a single query function.
- **B.** Change the hook signature to accept typed Convex function references (`list: api.tasks.listTasks`). Breaks "agent code unchanged" but preserves type inference end-to-end and matches how Convex is designed to be used.
- **C.** Codegen that maps path strings to typed refs by convention at build time. Most magic, most brittle.

## Decision

We take **Approach B**. The agent-facing contract becomes:

```ts
const { data, loading, add, update, remove } = useCollection({
  list: api.tasks.listTasks,
  listArgs: {},
  mutations: {
    add: api.tasks.createTask,
    update: api.tasks.toggleTask,
    remove: api.tasks.deleteTask,
  },
});
```

The hook lives in the shared `@appio/ui` package (new subpath export
`@appio/ui/hooks`) and re-exports from `packages/ui/src/hooks/`. Convex
is declared as an optional `peerDependency` so templates without Convex
(e.g. non-backend or legacy Firestore skeletons) are unaffected.

The plan's "same external API — agent code unchanged" clause is amended
in T3.3 when `agent_system.md` is rewritten for Convex. The amendment is
net-positive: the new API preserves full type inference where the old
string-path version couldn't.

### Sandbox vs. published routing

Routing between the Appio shared sandbox and a user's own Convex
deployment is already resolved at the `ConvexReactClient` layer — the
client URL is fixed at build time from `config/convex.ts`. The hook
therefore does **not** need to do any runtime detection.

A separate, cheap `useConvexMode()` hook surfaces the current mode
(`"sandbox" | "published"`) to UI code that needs it (e.g. the "Preview"
badge in the todo-list-convex header). The value is supplied by the base
template's `ConvexClientProvider`, which wraps its children in
`<ConvexModeProvider mode={CONVEX_MODE}>`. On publish, T3.6's migration
step rewrites `config/convex.ts` to flip `CONVEX_MODE` to `"published"`.

### Mutation slots

Every slot (`add` / `update` / `remove`) is optional. Slots the consumer
leaves unconfigured surface `undefined` in the return value. Under the
hood, the hook unconditionally calls `useMutation` for each slot every
render (Rules of Hooks forbids conditional hook calls); slots without a
configured ref fall back to the `list` query ref as a placeholder. The
placeholder closure is never invoked because the public API returns
`undefined` for that slot. This pattern is documented inline in
`useCollection.ts`.

### Optimistic updates

The hook deliberately does not attach an optimistic-update envelope.
Templates that want optimistic UI should call
`useMutation(ref).withOptimisticUpdate(...)` directly; the
todo-list-convex template's `lib/mutationAudit.ts` is the reference
implementation and stays unchanged under T3.1.

### Tenant isolation

`useCollection` is transparent to tenant isolation — it consumes whatever
typed Convex function the caller hands it. Isolation is enforced one
layer down, in `tenantQuery` / `tenantMutation` helpers (see ADR 001)
and in the pre-build scanner that rejects un-tenanted queries. The hook
adds no new tenant-isolation surface.

## Out of scope for T3.1

Deferred to **T3.1b** (follow-up task to be filed):

- **Zustand-persist offline write queue with reconciliation.** The current
  implementation delegates offline mutation buffering to Convex's own
  client, which queues and replays writes on reconnect. This matches the
  T2.3 validation finding that Convex's built-in replay is sufficient
  for the draft/preview experience. A richer write queue with local-
  first reconciliation is a larger design problem (conflict rules,
  per-template schema hooks, IndexedDB persistence) and doesn't belong
  in the same task as the hook contract.
- **Legacy `users/{uid}/tasks` path compatibility shim.** T3.5 migrates
  the remaining four Firestore templates to Convex and archives the
  originals under `_legacy/`. A shim that maps Firestore-style paths to
  Convex queries would be thrown away one sprint later — cheaper to
  rewrite the template call sites during T3.5 than to build and support
  the shim.
- **Runtime unit tests.** `packages/ui` has no test runner configured
  (`tsc --noEmit` is the only gate today). T3.1 ships type-level
  contract checks that ride on the existing type-check gate; a full
  vitest + Convex fixture setup is a separate workstream.

## Consequences

- Agents generate cleaner, type-safe Convex code because the hook surface
  matches how Convex wants to be called.
- `agent_system.md` (T3.3) needs an updated backend-stack example and
  an updated "HARD RULE" section to steer the model at the new API
  shape. The few-shot examples in the prompt will need a one-pass
  refresh.
- Templates that want per-op optimistic UI keep calling Convex hooks
  directly; the shared wrapper does not try to be a universal CRUD
  abstraction.
- Adding `convex` as an optional peer dep on `@appio/ui` keeps the
  package usable by Firestore-era templates during the Sprint 3
  migration window.
