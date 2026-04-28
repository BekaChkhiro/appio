---
name: error-recovery
description: |
  Show users a useful error UI when something fails — network outage,
  Convex query crash, mutation rejection, render-time JS error. Use when
  the app does anything async (queries, mutations, file uploads, payments,
  auth) — i.e., always. Solves: error boundaries for render crashes, retry
  UX for network errors, inline form errors, offline detection. Generated
  apps default to silent failures or ugly white screens; this skill puts
  recovery affordances everywhere they're needed.
when_to_use: |
  Triggers: "error handling", "what if it fails", "offline", "retry",
  "network error", "production-ready", "polish", "edge cases", or any
  feature that hits the network.
---

# Error recovery in three layers

Generated apps fail in three different ways. Each needs its own fix:

1. **Render crashes** (a component throws) — fixed with an Error Boundary.
2. **Async failures** (a mutation rejects, a query errors) — fixed with
   per-action `try/catch` + inline error UI.
3. **Network outages** (offline, slow, intermittent) — fixed with retry
   UI + offline indicator.

Don't conflate them. A single "global error toast" is not a strategy.

## Layer 1 — Error Boundary (render crashes)

React errors that escape a component tree blank the entire app. Wrap
your app once at the top, with a useful fallback:

```tsx
// src/components/ErrorBoundary.tsx
"use client";
import { Component, type ReactNode } from "react";
import { Screen, EmptyState, Button } from "@appio/ui";

interface State { error: Error | null; }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Send to Sentry / your logger here. Don't swallow silently.
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <Screen>
          <EmptyState
            title="Something broke"
            body="The screen crashed. Reloading usually fixes it."
            icon="alert"
          />
          <Button onPress={this.reset}>Try again</Button>
          <Button variant="ghost" onPress={() => location.reload()}>
            Reload app
          </Button>
        </Screen>
      );
    }
    return this.props.children;
  }
}
```

Wrap once in `App.tsx`:

```tsx
<ErrorBoundary>
  <ConvexClientProvider>
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  </ConvexClientProvider>
</ErrorBoundary>
```

Don't sprinkle multiple boundaries unless you have a real reason (e.g.,
isolating a 3rd-party widget). One top-level boundary catches 95% of
crashes.

## Layer 2 — Async failures (mutations + queries)

Convex mutations throw `ConvexError` on rejection. Catch at the call site
and surface inline, never via `alert()`:

```tsx
const create = useMutation(api.habits.create);
const [submitError, setSubmitError] = useState<string | null>(null);

async function onSubmit(values: HabitInput) {
  setSubmitError(null);
  try {
    await create(values);
  } catch (err) {
    setSubmitError(
      err instanceof ConvexError
        ? err.data ?? err.message  // ConvexError exposes server-side context
        : "Couldn't save. Check your connection and try again."
    );
  }
}

// in JSX:
{submitError && (
  <p role="alert" className="text-sm text-red-600">{submitError}</p>
)}
```

For Convex queries, errors surface via the `error` field on the hook's
return. Render an inline retry:

```tsx
const { data, status, error } = useCollection("habits");
if (status === "error") {
  return (
    <EmptyState
      title="Couldn't load"
      body={error?.message ?? "We'll try again automatically."}
      icon="cloud-off"
      action={<Button onPress={() => location.reload()}>Reload</Button>}
    />
  );
}
```

`useCollection` already retries on transient errors. Only render the
error UI when it's been failing for >3s — until then the underlying
retry should recover invisibly.

## Layer 3 — Offline + slow network

Show a persistent banner when offline so the user knows why writes are
queuing. The Convex client queues mutations automatically while offline
and replays on reconnect, but the user shouldn't have to guess:

```tsx
// src/hooks/useOnline.ts
import { useEffect, useState } from "react";

export function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}
```

```tsx
function App() {
  const online = useOnline();
  return (
    <>
      {!online && (
        <div className="bg-amber-100 text-amber-900 text-sm py-1 px-3 text-center">
          Offline — your changes will sync when you reconnect.
        </div>
      )}
      <AppShell />
    </>
  );
}
```

For slow-but-online states, Convex's `optimisticUpdate` keeps the UI
responsive. Use it for any list-affecting mutation:

```tsx
const addHabit = useMutation(api.habits.create).withOptimisticUpdate(
  (localStore, args) => {
    const existing = localStore.getQuery(api.habits.list, {}) ?? [];
    localStore.setQuery(api.habits.list, {}, [
      ...existing,
      { _id: crypto.randomUUID() as any, ...args, createdAt: Date.now() },
    ]);
  }
);
```

## Common pitfalls

- **Don't put `try { await ... } catch (e) { console.log(e) }`** — silent
  swallows are how production bugs hide for weeks. Always render an error
  UI or rethrow.
- **Don't show raw error messages from `Error.toString()`** — that
  surfaces stack traces and DB internals to users. Wrap with
  user-friendly copy or use `ConvexError.data` for server-vetted text.
- **Don't toast every error** — toasts auto-dismiss, so users miss them.
  Inline errors stay visible until the user acts. Toast only for
  background events ("Synced", "Backup complete") that the user doesn't
  need to fix.
- **Don't retry silently more than 3 times** — past that, the user
  should see the error and choose to retry. Hidden retry loops drain
  battery and bandwidth.

## When NOT to use this skill

- Truly synchronous code that can't fail at runtime (formatters, pure
  utility fns) — adding error UI is overkill.
- Internal admin tools / debug screens used only by developers — those
  can throw raw errors.
