---
name: navigation-patterns
description: |
  Pick the right navigation primitive (tabs, stack, modal, drawer) and wire
  screen state correctly. Use when the app has 2+ screens, a back button,
  or any modal sheet — i.e., almost every app beyond a single-screen demo.
  Solves: which screens are tabs vs pushed routes, when modals are right,
  back-stack management, deep-linking, and modal layering. Generated apps
  default to tab-only navigation even when a stack is needed; this skill
  fixes that bias.
when_to_use: |
  Triggers: "multi-screen app", "navigation", "back button", "open modal",
  "details page", "settings sub-screens", "wizard flow", "drawer", "tabs",
  "stack navigation", "deep link", "route".
---

# Pick the right navigation primitive

The base template ships `<TabBar>` and `<BottomSheet>` from `@appio/ui` but
not a router. For mobile-style apps you do navigation by **conditional
rendering of screens** keyed off Zustand or `useState`. Don't reach for
`react-router` or Next.js routing inside the generated PWA — the app is a
single-page shell.

## The decision tree

Use this matrix to pick. Ranked by how often it's right:

| User says | Use |
|---|---|
| "main screens of the app" (Home, Search, Profile) | **TabBar** |
| "tap a list item to see details" | **Stack push** (replace screen state) |
| "edit", "create", "filter", "share" | **Modal/BottomSheet** |
| "settings has sub-pages" | **Stack push from a settings tab** |
| "swipe in from left to navigate" | **Drawer** (rare; usually wrong) |

When in doubt: **tabs for top-level, stack for hierarchy, modal for
focused tasks**.

## Pattern 1 — Tabs (top-level only, 2-5 items)

Tabs should be persistent across the whole app. Don't change which tab
icons are visible based on state — that breaks user expectation.

```tsx
// src/App.tsx (or src/app/page.tsx for Next)
import { TabBar, Screen } from "@appio/ui";
import { useState } from "react";
import { HomeTab } from "./tabs/HomeTab";
import { SearchTab } from "./tabs/SearchTab";
import { ProfileTab } from "./tabs/ProfileTab";

type TabKey = "home" | "search" | "profile";

export default function App() {
  const [tab, setTab] = useState<TabKey>("home");
  return (
    <Screen>
      {tab === "home" && <HomeTab />}
      {tab === "search" && <SearchTab />}
      {tab === "profile" && <ProfileTab />}
      <TabBar
        active={tab}
        onChange={setTab}
        items={[
          { key: "home", label: "Home", icon: "home" },
          { key: "search", label: "Search", icon: "search" },
          { key: "profile", label: "You", icon: "user" },
        ]}
      />
    </Screen>
  );
}
```

**Don't** put tab state in URL search params unless you want browser-back
to switch tabs (usually wrong on mobile — back should pop a stack, not
flip a tab).

## Pattern 2 — Stack push (details / sub-screens)

Inside a tab, you need a stack so "tap → details → back" works. Use a
local Zustand store per tab, not global:

```ts
// src/stores/homeStack.ts
import { create } from "zustand";
type StackItem =
  | { kind: "list" }
  | { kind: "detail"; habitId: string };

export const useHomeStack = create<{
  stack: StackItem[];
  push: (item: StackItem) => void;
  pop: () => void;
}>((set) => ({
  stack: [{ kind: "list" }],
  push: (item) => set((s) => ({ stack: [...s.stack, item] })),
  pop: () =>
    set((s) => ({
      stack: s.stack.length > 1 ? s.stack.slice(0, -1) : s.stack,
    })),
}));
```

Then render the top of stack, with a back button on non-root entries:

```tsx
function HomeTab() {
  const stack = useHomeStack((s) => s.stack);
  const top = stack[stack.length - 1];
  const pop = useHomeStack((s) => s.pop);

  return (
    <>
      {stack.length > 1 && <AppBar leading={<BackButton onPress={pop} />} />}
      {top.kind === "list" && <HabitList />}
      {top.kind === "detail" && <HabitDetail habitId={top.habitId} />}
    </>
  );
}
```

Hardware/swipe back on iOS+Android Capacitor — wire `Capacitor.App.addListener("backButton", () => pop())` in a top-level effect once.

## Pattern 3 — Modal / BottomSheet

Use for **focused tasks** that come and go without interrupting the
underlying flow: forms, confirmations, share sheets, filters.

```tsx
const [creating, setCreating] = useState(false);
return (
  <>
    <Button onPress={() => setCreating(true)}>+ New habit</Button>
    <BottomSheet open={creating} onClose={() => setCreating(false)}>
      <HabitForm onDone={() => setCreating(false)} />
    </BottomSheet>
  </>
);
```

Modal layering rules:
- Max 2 modals stacked. If you need 3, you've designed the flow wrong;
  push a stack screen instead.
- Don't auto-dismiss the parent modal when the child opens — users get
  lost. Both stay until the user chooses.
- Tap-outside should close the modal **only if no async work is mid-flight** — disable backdrop dismissal while submitting.

## Pattern 4 — Drawer (rarely right)

Drawer makes sense for: long flat lists of "rooms"/"workspaces"/"projects"
where there's no natural tab grouping. If you have <5 destinations, use
tabs. If you have >20, use a search-first list screen, not a drawer.

## Deep linking (Capacitor / web)

For web PWA: parse `window.location.pathname` once on boot and push the
matching stack state. Don't try to keep URL in sync with every navigation —
mobile users don't expect URLs to change as they tap.

For Capacitor: register a custom URL scheme in `capacitor.config.json` and
listen for `appUrlOpen` events. Same idea: parse → push.

## Common pitfalls

- **Don't put navigation state in component-local `useState` of `<App>`**
  if multiple components need to push/pop. Lift to Zustand.
- **Don't render every screen and toggle CSS `display: none`** — mounting
  unused screens runs their queries and burns Convex bandwidth.
- **Don't mix Next.js `<Link>` with state-based navigation** in the same
  app. Pick one. For our generated apps, state-based wins (PWA shell).
- **Don't show two AppBars at once** when nesting modals over stacks —
  hide the underlying AppBar via `inert` or visibility while the modal
  is open.

## When NOT to use this skill

- Single-screen apps (one timer, one calculator) — just render the
  screen; no navigation.
- Marketing/landing pages — use anchor links and `<Link>`, not stack
  state.
