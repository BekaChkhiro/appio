# ADR 004 — Motion Library + 10 Named Animation Presets

## Status

Accepted — 2026-04-20 (Sprint 2, T2.6).

## Context

Generated apps need a consistent animation language so they feel authored, not
mechanical. Per-app ad-hoc transitions produce the same "generic AI" tell that
Theme Personas (ADR 003) were designed to escape. We want the AI agent to
reach for named presets — never to write bespoke timing/easing inline — for the
same reason the agent picks personas rather than inventing palettes.

Two structural constraints:

1. **Bundle budget.** Generated PWAs ship over Cloudflare R2; every KB lands on
   a first-paint path. `framer-motion@11` weighs ~2.1 MB unpacked; its
   successor `motion@12` (same author, same React API) weighs ~708 KB — a ~67%
   reduction on disk and similarly smaller tree-shaken output.
2. **Reduced-motion compliance.** `prefers-reduced-motion: reduce` is a WCAG
   2.2 expectation and a macOS/iOS Accessibility default. Presets that always
   animate break this. Each preset must ship a reduced variant the runtime
   picks automatically.

## Decision

Ship **10 named animation presets** in `packages/ui/src/animations/`, powered
by `motion@^12.0.0` (not `framer-motion`):

| Preset              | Use case                                      |
|---------------------|-----------------------------------------------|
| `pageTransition`    | Route changes — cross-fade + subtle scale     |
| `listStagger`       | Container that staggers children on reveal    |
| `cardReveal`        | Card surfaces appearing (e.g. `preview_ready`) |
| `gestureSwipe`      | Horizontal swipe-to-delete                    |
| `modalSpring`       | Modal / dialog open                           |
| `fabExpand`         | Floating action button press/expand           |
| `toastSlide`        | Toast slide-in from right                     |
| `pullToRefresh`     | Pull-to-refresh spring snapback               |
| `tabSlide`          | Sliding active tab indicator (pair `layoutId`) |
| `skeletonShimmer`   | Skeleton placeholder shimmer (prefer CSS class) |

Each preset object exposes:

- `variants` — Motion `Variants` with `initial` / `animate` / `exit`.
- `transition` — timing + easing (tween or spring).
- `reducedVariants` + `reducedTransition` — the degraded path, typically
  opacity-only with a ~120ms fade.

Two hooks resolve presets at call-sites:

- `useAnimationPreset(preset)` — picks full vs reduced based on
  `useReducedMotion()`, returns `{ variants, transition }`.
- `useStaggerPreset(listStagger)` — adds `itemVariants` for children.

`skeletonShimmer` also ships a standalone CSS class
(`.animate-skeleton-shimmer`) in `skeleton-shimmer.css` with an embedded
`@media (prefers-reduced-motion: reduce)` rule. The Motion variant is provided
as a fallback for non-CSS contexts, but the CSS path is always preferred for
skeleton placeholders — it's cheaper (no React re-renders, no framer state).

## Consequences

**Positive:**

- Generated apps that use `motion` instead of `framer-motion` save ~1.4 MB of
  disk footprint in the scaffold (and a proportional amount after tree-shake).
- Every animated surface in the codebase speaks the same vocabulary; the AI
  agent can pick a preset name rather than authoring timing curves.
- Reduced-motion compliance is no longer an opt-in: every preset ships a
  reduced variant and the hooks apply it without per-call-site code.
- `@appio/ui` now exports `./animations` as a subpath, so both the main PWA
  and generated apps (via workspace resolution through the base template) can
  consume the same library.

**Negative / limits:**

- `motion@12` follows `framer-motion`'s API surface but is a distinct package;
  IDE autocomplete and any copied-from-web snippets that import from
  `"framer-motion"` need to be rewritten as `"motion/react"`. Agent prompts
  (`agent_system.md`) must be updated before Sprint 3 so the AI doesn't emit
  `framer-motion` imports.
- Presets are opinionated (timing/easing chosen). Personas ship their own
  motion tokens (`PersonaMotion` in `@appio/themes`), but this iteration does
  not yet thread persona motion tokens through presets — the presets use
  globally chosen curves. That interlock is a follow-up once the agent starts
  routing through Layout Blocks (T4.2).
- `skeletonShimmer` is listed as a preset for parity with the sprint plan, but
  the canonical implementation is CSS, not Motion.

## Implementation notes (2026-04-20)

- `packages/ui/src/animations/` contains `types.ts`, `presets.ts`,
  `use-animation-preset.ts`, `skeleton-shimmer.css`, and an `index.ts`
  barrel. All 10 presets are typed against `motion/react`'s `Variants` and
  `Transition`.
- `packages/ui/package.json` adds `motion` as a `peerDependency` (consumers
  pick their own version within `^12`) and exposes two new subpath exports:
  `./animations` and `./animations/skeleton-shimmer.css`.
- `packages/templates/base/package.json` adds `motion: ^12.0.0` to
  `dependencies` so every scaffolded app has it pre-installed. Measured
  install size: 708 KB vs framer-motion@11's ~2.1 MB.
- POC wiring in `packages/templates/todo-list-convex/src/App.tsx`:
  - `SignInScreen` surface uses `cardReveal`.
  - `TodoScreen` main uses `pageTransition`.
  - The task list uses `listStagger` (container) + `AnimatePresence` so
    deletes animate out via the stagger item's `exit` variant.
- `apps/web` already imports from `motion/react` (verified 2026-04-20 —
  no outstanding `framer-motion` imports), so no migration was required in
  the main PWA for this sprint.
