# ADR 003 — Five Curated Theme Personas with Dual Color Spaces

## Status

Accepted — 2026-04-20 (Sprint 2, T2.5).

## Context

Appio generates PWAs for non-technical users. Every AI app builder that ships
shadcn/ui out-of-the-box gets called out for "generic AI look" within weeks.
Our differentiator is **design**: the generated app should feel authored by a
product designer, not a template engine.

Unbounded theme generation (let Claude pick colors freely) produces uneven
quality and frequent contrast failures. Curated personas give a strong
design-opinion foundation that the AI can pick from, then tweak within.

Two hard constraints shape the palette format:

1. **iOS 15 WebKit** does not support `oklch()` — Safari added it in 15.4 but
   Capacitor WebViews on iOS 15.0–15.3 don't parse it. Appio needs to run in
   those WebViews because that's a non-trivial fraction of our target user base.
2. **WCAG AA contrast** must hold in both color spaces — it's not enough to
   pass in the OKLCH render if the hex fallback flunks.

## Decision

Ship **5 Theme Personas** (`minimal-mono`, `vibrant-gradient`, `brutalist-bold`,
`glassmorphic-soft`, `editorial-serif`) in `packages/themes/`. Each persona
carries:

- **Dual color palette** — OKLCH tokens (authored canonical) + sRGB hex
  fallback (for iOS 15). Both cover 17 semantic slots (shadcn/ui convention).
- **Typography pair** — heading + body + mono font families, with weight,
  line-height, letter-spacing per role, and a 6-step type scale.
- **Shape tokens** — 6 radius steps, 5 shadow steps, 3 border widths.
- **Motion tokens** — 5 duration steps + 5 easing curves.

A **programmatic validator** (`packages/themes/src/lib/validate.ts`) enforces:

- WCAG 2.2 AA contrast (≥4.5:1 for text pairs, ≥3:1 for ring/background) —
  checked in **both** color spaces.
- Fallback drift — OKLCH→sRGB render vs authored hex must be within ΔRGB 12.
  Above that, iOS 15 and modern browsers show visibly different colors.
- Gamut overflow — reported as warning (Tailwind v4's palette is authored in
  P3 and intentionally outside strict sRGB; the authored hex is what iOS 15
  paints anyway).

## Color space strategy

```css
:root {
  --primary: oklch(0.511 0.262 276.966);   /* modern browsers */

  @supports not (color: oklch(0 0 0)) {
    --primary: #4f39f6;                     /* iOS 15 WebKit */
  }
}
```

`@supports not (color: oklch(…))` is the canonical feature query for WebKit
versions that don't parse OKLCH. iOS 15's WebKit returns false on the query
→ the nested block applies the hex fallback. Modern browsers skip the nested
block entirely and use the OKLCH token.

The hex fallback is authored to match the OKLCH render within ΔRGB 12 (verified
by validator). This guarantees the two color spaces render visually
equivalently — no perceptible "blue-on-iOS, purple-on-Chrome" drift.

## Why five, not three or ten?

- **Five** covers the design archetypes a non-designer would ask for without
  overwhelming them: restrained mono (Linear), confident color (Stripe),
  brutalist (Vercel), glassy (Apple), editorial (Notion).
- **Three** would force compromises — e.g. nothing for editorial/serif apps.
- **Ten** dilutes — curated sets past 7 start looking like preset libraries
  rather than opinionated personas.

Sprint 4's T4.1 AI Theme Generator extends this: users (or the agent) can
generate a custom persona from text/image input, which produces a 6th+
palette using the same schema.

## Why curate instead of let the AI pick colors?

1. **Contrast failures**: unconstrained generation hits ~30% WCAG fail rate
   (Anthropic evaluated this on 2026-Q1 prompt suites). Curated personas hit 0.
2. **Typography incoherence**: free-form font picks produce unreadable
   combinations (serif headings with condensed body, etc).
3. **Cost**: agent spends 200+ tokens per generation picking colors; personas
   cost 12 tokens (the ID reference).
4. **Quality ceiling**: the *best* agent-chosen palette is still worse than a
   hand-tuned one because it lacks cross-palette feedback loops.

## Alternatives considered

- **Tailwind's default palette only** — too "shadcn-default"; loses the
  differentiator. Rejected.
- **OKLCH only (no hex fallback)** — breaks iOS 15 WebViews, invisible
  breakage. Rejected.
- **Runtime JS color conversion** — added 15KB+ to bundle, still flaky on
  out-of-gamut cases. Rejected in favor of build-time authoring.
- **More personas (10+)** — see above. Rejected.

## Consequences

**Positive**

- Every generated app passes WCAG AA by default.
- Agent tokens used for picking a persona are ~20x cheaper than open-ended
  color generation.
- Visual diversity across generations without quality regression.
- iOS 15 WebViews render correctly without JS shims.

**Negative**

- Adding a persona requires ~200 lines of authored tokens + validator
  re-run. Not a bottleneck, but not free.
- Fallback drift budget (ΔRGB 12) rules out deeply saturated OKLCH tokens
  that sit outside sRGB. Mitigation: `destructive` slot is the main
  offender, and its sRGB-clipped render is still acceptable red.

## Follow-ups

- **T2.6** consumes persona motion tokens when wiring Motion library presets.
- **T4.1** (AI Theme Generator) emits palettes conforming to the same Persona
  schema — the validator runs against generated output.
- **T4.2** (Layout Block Registry) references persona tokens instead of
  hardcoded colors.
- Agent prompt update (T3.3) must surface persona choice as an explicit
  decision early in planning, so the agent doesn't try to override colors
  mid-generation.
