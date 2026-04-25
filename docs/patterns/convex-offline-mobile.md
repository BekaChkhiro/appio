# Pattern — Convex on Capacitor Mobile (Offline + Reconnect)

> **Audience:** the Sprint 3 agent prompt (T3.3), the RAG knowledge base (T3.4), and humans writing Convex-backed templates that ship to iOS / Android via Capacitor.
>
> **Source of truth for empirical numbers:** [`docs/adr/002-convex-mobile-validation.md`](../adr/002-convex-mobile-validation.md). This pattern doc states *what to do*; the ADR states *why we believe it works*.

## When this applies

A generated app that:

- Wraps a Convex-backed React PWA with Capacitor (iOS + Android shells).
- Cares about UX during transient disconnect: airplane mode, WiFi ↔ cellular handoff, background suspend.
- Wants writes to feel instant (optimistic) and never silently drop after reconnect.

This pattern is the *default* for any template with `storageBackend: "convex"` once Sprint 3 lands.

## Three things to do, one to skip

### 1. Use `withOptimisticUpdate` on every Convex mutation that mutates a query result the UI reads

Convex's optimistic-update mechanism patches the client-side query cache **synchronously**, so the UI re-renders before the network round-trip starts. The patch persists across disconnects — meaning a user tapping "complete" while in airplane mode sees the row instantly tick, and the real mutation queues for replay on reconnect.

```ts
const toggleTask = useMutation(api.tasks.toggleTask).withOptimisticUpdate(
  (store, { id }) => {
    const list = store.getQuery(api.tasks.listTasks, {});
    if (list === undefined) return;
    store.setQuery(
      api.tasks.listTasks,
      {},
      list.map((t) => (t._id === id ? { ...t, completed: !t.completed } : t)),
    );
  },
);
```

Apply this pattern to **every mutation that affects a `useQuery` result currently rendered**. Skip it for fire-and-forget writes (e.g. analytics events) where the UI doesn't read the result.

### 2. Trust Convex's internal mutation queue — don't build a parallel Zustand queue

The Convex React client buffers mutations during disconnect and replays them on reconnect, in order. T2.3's empirical data is the basis for this trust (see ADR 002 § Headline numbers). **Do not** add a Zustand queue that mirrors mutations and re-fires them on reconnect — you'd either duplicate writes or fight the framework's own buffer.

What you *can* layer on top, if a generated app needs an audit trail (e.g. financial app, healthcare):

```ts
// Pattern: thin audit log around the existing mutation, NOT a replacement queue.
const create = useMutation(api.tasks.createTask).withOptimisticUpdate(/* … */);
const audited = useCallback(async (title: string) => {
  const localId = crypto.randomUUID();
  audit.append({ localId, kind: "create", queuedAt: Date.now() });
  const id = await create({ title });
  audit.markAcked(localId, id);
}, [create]);
```

This is for **observability, not durability** — Convex still owns the queue.

### 3. Hook Capacitor's `App.appStateChange` to nudge Convex on resume

iOS aggressively suspends WebViews when an app backgrounds. When the user returns, the JS context may have been torn down; even if it survived, the WebSocket likely dropped during the suspend. Wire the resume event so we don't sit on a stale connection waiting for the next user action to expose it:

```ts
import { App } from "@capacitor/app";
import { useConvex } from "convex/react";

useEffect(() => {
  const sub = App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) return;
    // Touching the client triggers an internal connection-state check
    // and a reconnect attempt if the WS is closed. Cheap, idempotent.
    void convex.connectionState();
  });
  return () => { void sub.remove(); };
}, [convex]);
```

This is a one-liner-style pattern but the difference between "tap on the icon → 5 s of stale UI" and "tap on the icon → fresh data in 500 ms".

### Skip: a separate IndexedDB cache layer

Convex's client cache is already in-memory, persists across query invocations within a session, and survives disconnects. Adding IndexedDB on top (RxDB, Dexie, etc.) buys you survival across full WebView reaping — which is rare, costly to keep in sync with the live cache, and out of scope until a real customer demands it.

If a generated app's prompt explicitly asks for "works fully offline" (e.g. field-service apps), defer to a future template variant with RxDB; do not retrofit the default Convex flow.

## Anti-patterns (rejected at PR review)

- **A custom `useOnlineStatus` hook driving conditional rendering.** Use Convex's `connectionState()` — it knows whether the WS is open and whether mutations are in flight, both of which `navigator.onLine` does not.
- **Manual mutation retry loops.** The internal queue handles retry. Wrapping mutations in your own retry produces duplicate writes if the original eventually succeeds.
- **`navigator.onLine` as a gate for showing optimistic updates.** Optimistic patches should always render, regardless of network state — the user's intent is the same.
- **Disabling `useQuery` while offline.** `useQuery` returns the last cached result during disconnect; disabling it makes the UI flicker on every transition.

## Acceptance checklist for Convex-on-mobile templates

A generated template is ready for mobile if:

- [ ] Every UI-affecting mutation uses `.withOptimisticUpdate`.
- [ ] No custom mutation retry loop. No parallel write queue.
- [ ] `App.appStateChange` listener wired (Capacitor) or visibilitychange (PWA-only).
- [ ] No `navigator.onLine` checks gating UI behaviour.
- [ ] Tested against at least: cold launch, airplane-mode-while-idle, queued-mutations-during-disconnect, background-resume.

## Cross-references

- ADR 002 — empirical Go/No-Go data backing this pattern
- Runbook `t2.3-mobile-validation.md` — how to re-verify when bumping Convex / Capacitor versions
- ADR 001 — tenant isolation rules (orthogonal but always applies)
