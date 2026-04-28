---
name: list-patterns
description: |
  Render a list of items with the right primitives: search, filter, group,
  paginate, empty state, loading shimmer. Use whenever the screen shows a
  collection from Convex/Firestore — feed, library, history, leaderboard,
  inbox, search results, user list, transactions. Solves: derived state vs
  re-querying, when to paginate vs load-all, group-by patterns, search
  debouncing, and the empty-state copy that's almost always missing in
  generated apps.
when_to_use: |
  Triggers: "list of", "feed", "show all", "history", "search", "filter
  by", "group by", "categorize", "sort by date", "infinite scroll",
  "leaderboard", "inbox", "library".
---

# Render a list well

The base template gives you `<ListItem>`, `<EmptyState>`, and
`useCollection` (Convex) / `useFirestore`. What's missing is **how to
compose them** into something that doesn't suck on a slow connection or
empty database. Generated lists usually:

- skip the empty state entirely (looks broken on first launch)
- re-query on every keystroke during search (burns bandwidth, makes UI
  laggy)
- compute filters/groups inside the JSX (re-runs every render)
- paginate "manually" with hard-coded `slice(0, 20)` (breaks at 21 items)

Use this skill any time the screen renders a `.map(item => ...)` over
remote data.

## Loading + empty + populated (the three states)

Every list has three states. Code all three explicitly — don't rely on
falsy checks:

```tsx
import { useCollection } from "@appio/ui";
import { Skeleton, EmptyState, ListItem } from "@appio/ui";

function HabitsList() {
  const { data: habits, status } = useCollection("habits");

  if (status === "loading") return <Skeleton.List rows={5} />;
  if (!habits || habits.length === 0) {
    return (
      <EmptyState
        title="No habits yet"
        body="Tap + to track your first one."
        icon="sparkles"
      />
    );
  }
  return habits.map((h) => <ListItem key={h._id} title={h.name} />);
}
```

**Rule:** if the empty state copy is weaker than 6 words, the user will
think the app is broken. Always say what action unblocks them.

## Search (with debounce)

For client-side search over a small list (<200 items), filter in memory
with `useMemo`. Don't trigger a Convex query per keystroke.

```tsx
import { useState, useMemo, useDeferredValue } from "react";

function SearchableHabits() {
  const { data: habits } = useCollection("habits");
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q);   // free debounce, sort of

  const filtered = useMemo(() => {
    if (!habits) return [];
    if (!deferred.trim()) return habits;
    const needle = deferred.trim().toLowerCase();
    return habits.filter((h) => h.name.toLowerCase().includes(needle));
  }, [habits, deferred]);

  return (
    <>
      <Input placeholder="Search habits" value={q} onChange={(e) => setQ(e.target.value)} />
      {filtered.map((h) => <ListItem key={h._id} title={h.name} />)}
    </>
  );
}
```

For server-side search over big lists, write a Convex query that takes
`searchTerm: v.optional(v.string())` and indexes the field with
`.searchIndex("by_name", { searchField: "name" })`. Then debounce the
input with `lodash.debounce` (300ms) before passing to the query.

## Group-by

Compute groupings in `useMemo`, never inline:

```tsx
const grouped = useMemo(() => {
  const groups = new Map<string, Habit[]>();
  for (const h of habits ?? []) {
    const day = formatDay(h.createdAt);   // "Today", "Yesterday", "Sep 12"
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(h);
  }
  return Array.from(groups.entries());
}, [habits]);

return grouped.map(([day, items]) => (
  <Section key={day} title={day}>
    {items.map((h) => <ListItem key={h._id} title={h.name} />)}
  </Section>
));
```

## Pagination (Convex)

Convex queries return all rows by default — fine for <500 items. Beyond
that use `usePaginatedQuery`:

```tsx
import { usePaginatedQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const { results, status, loadMore } = usePaginatedQuery(
  api.habits.list,
  { /* filters */ },
  { initialNumItems: 20 }
);

// at the bottom of the list:
{status === "CanLoadMore" && (
  <Button onPress={() => loadMore(20)}>Load more</Button>
)}
```

The Convex `list` query needs to accept `paginationOpts` and call
`.paginate(paginationOpts)` instead of `.collect()`. Don't reach for
infinite-scroll triggers (IntersectionObserver) until you've shipped the
load-more button — the button is one line, the observer is a 30-line
hook.

## Sort

Sort in the query, not the component, when possible. Convex `.order("desc")`
on an indexed field is free. Sorting in JS is fine for <500 items but
re-runs on every render unless wrapped in `useMemo`.

## Common pitfalls

- **Don't render `data?.map(...)`** with no fallback — when `data` is
  `undefined` (loading), nothing renders and there's no spinner. Always
  have an explicit `if (loading) return <Skeleton/>` branch.
- **Don't use array index as `key`** for lists that can re-order
  (search filtering, sort changes). Use `_id`.
- **Don't fetch nested data in the list item component** — every row
  fires its own query, you get a fan-out. Either denormalize on the
  server side or join in a single query.
- **Don't show "0 results" the same way as "loading"** — they need
  visually distinct UI, otherwise users wait for results that aren't
  coming.
- **Don't put a list inside another scrollable container** (a `<div>`
  with `overflow-y: scroll`) — touch scroll on iOS gets confused.
  Use one outer `<Screen>` with `scrollable` prop and let the list
  flow inside it.

## When NOT to use this skill

- Single-item screens (detail view, profile) — those aren't lists.
- Charts / analytics — use Recharts directly; the data isn't a "list"
  in the UI sense.
- Static menus (settings, nav drawer) — those are hand-coded JSX, not
  data-driven.
