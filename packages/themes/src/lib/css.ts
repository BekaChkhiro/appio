import type { ColorMap, ColorSlot, Persona, PersonaPalette } from "../types.js";

/** Map persona `ColorSlot` → CSS custom property name (shadcn/ui convention). */
const SLOT_TO_CSS_VAR: Record<ColorSlot, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  border: "--border",
  input: "--input",
  ring: "--ring",
  destructive: "--destructive",
  destructiveForeground: "--destructive-foreground",
};

function colorDeclarations<T extends string>(colors: ColorMap<T>, indent: string): string {
  return (Object.keys(SLOT_TO_CSS_VAR) as ColorSlot[])
    .map((slot) => `${indent}${SLOT_TO_CSS_VAR[slot]}: ${colors[slot]};`)
    .join("\n");
}

function shapeDeclarations(persona: Persona, indent: string): string {
  const { radius, shadow, border } = persona.shape;
  return [
    `${indent}--radius-none: ${radius.none}rem;`,
    `${indent}--radius-sm: ${radius.sm}rem;`,
    `${indent}--radius-md: ${radius.md}rem;`,
    `${indent}--radius-lg: ${radius.lg}rem;`,
    `${indent}--radius-xl: ${radius.xl}rem;`,
    `${indent}--radius-full: ${radius.full}px;`,
    `${indent}--shadow-none: ${shadow.none};`,
    `${indent}--shadow-sm: ${shadow.sm};`,
    `${indent}--shadow-md: ${shadow.md};`,
    `${indent}--shadow-lg: ${shadow.lg};`,
    `${indent}--shadow-xl: ${shadow.xl};`,
    `${indent}--border-thin: ${border.thin}px;`,
    `${indent}--border-medium: ${border.medium}px;`,
    `${indent}--border-thick: ${border.thick}px;`,
  ].join("\n");
}

function typographyDeclarations(persona: Persona, indent: string): string {
  const { heading, body, mono, scale } = persona.typography;
  return [
    `${indent}--font-heading: ${heading.family};`,
    `${indent}--font-body: ${body.family};`,
    `${indent}--font-mono: ${mono.family};`,
    `${indent}--font-heading-weight: ${heading.weight};`,
    `${indent}--font-heading-line-height: ${heading.lineHeight};`,
    `${indent}--font-heading-letter-spacing: ${heading.letterSpacing};`,
    `${indent}--font-body-weight: ${body.weight};`,
    `${indent}--font-body-line-height: ${body.lineHeight};`,
    `${indent}--font-body-letter-spacing: ${body.letterSpacing};`,
    `${indent}--text-display: ${scale.display}rem;`,
    `${indent}--text-h1: ${scale.h1}rem;`,
    `${indent}--text-h2: ${scale.h2}rem;`,
    `${indent}--text-h3: ${scale.h3}rem;`,
    `${indent}--text-body: ${scale.body}rem;`,
    `${indent}--text-small: ${scale.small}rem;`,
  ].join("\n");
}

function motionDeclarations(persona: Persona, indent: string): string {
  const { duration, ease } = persona.motion;
  return [
    `${indent}--duration-instant: ${duration.instant}ms;`,
    `${indent}--duration-fast: ${duration.fast}ms;`,
    `${indent}--duration-medium: ${duration.medium}ms;`,
    `${indent}--duration-slow: ${duration.slow}ms;`,
    `${indent}--duration-slower: ${duration.slower}ms;`,
    `${indent}--ease-standard: ${ease.standard};`,
    `${indent}--ease-out: ${ease.out};`,
    `${indent}--ease-in: ${ease.in};`,
    `${indent}--ease-emphasized: ${ease.emphasized};`,
    `${indent}--ease-spring: ${ease.spring};`,
  ].join("\n");
}

export interface CssOptions {
  /**
   * Scope selector for the generated variables. Defaults to `:root` for the
   * light scheme and `.dark` for the dark scheme.
   */
  lightSelector?: string;
  /** Selector applied to the dark palette. */
  darkSelector?: string;
  /**
   * Also emit an automatic `@media (prefers-color-scheme: dark)` block that
   * applies the dark palette to the light selector when the OS prefers dark.
   * Recommended when the app doesn't manage theme toggling itself.
   */
  includePrefersColorScheme?: boolean;
}

/**
 * Emits a stylesheet for a single persona:
 *
 *   :root {            <-- light palette + shape + typography + motion
 *     --background: oklch(…);
 *     …
 *     @supports not (color: oklch(0 0 0)) {   <-- iOS 15 fallback
 *       --background: #…;
 *       …
 *     }
 *   }
 *   .dark {            <-- dark palette (colors only)
 *     --background: oklch(…);
 *     …
 *   }
 *   @media (prefers-color-scheme: dark) { :root { … } }  <-- optional
 *
 * `@supports not (color: oklch(…))` is the canonical feature-query for WebKit
 * without OKLCH support. iOS 15's WebKit returns false → the nested block
 * applies the sRGB hex fallback.
 */
export function personaToCss(persona: Persona, options: CssOptions = {}): string {
  const lightSelector = options.lightSelector ?? ":root";
  const darkSelector = options.darkSelector ?? ".dark";
  const indent = "  ";
  const deepIndent = "    ";

  const lightBlock = [
    `${lightSelector} {`,
    colorDeclarations(persona.light.oklch, indent),
    shapeDeclarations(persona, indent),
    typographyDeclarations(persona, indent),
    motionDeclarations(persona, indent),
    `${indent}@supports not (color: oklch(0 0 0)) {`,
    colorDeclarations(persona.light.rgb, deepIndent),
    `${indent}}`,
    `}`,
  ].join("\n");

  const darkBlock = [
    `${darkSelector} {`,
    colorDeclarations(persona.dark.oklch, indent),
    `${indent}@supports not (color: oklch(0 0 0)) {`,
    colorDeclarations(persona.dark.rgb, deepIndent),
    `${indent}}`,
    `}`,
  ].join("\n");

  const sections = [lightBlock, darkBlock];

  if (options.includePrefersColorScheme) {
    const prefersBlock = [
      `@media (prefers-color-scheme: dark) {`,
      `${indent}${lightSelector} {`,
      colorDeclarations(persona.dark.oklch, deepIndent),
      `${indent}${indent}@supports not (color: oklch(0 0 0)) {`,
      colorDeclarations(persona.dark.rgb, `${deepIndent}${indent}`),
      `${indent}${indent}}`,
      `${indent}}`,
      `}`,
    ].join("\n");
    sections.push(prefersBlock);
  }

  return sections.join("\n\n") + "\n";
}

/**
 * Returns a flat record of CSS variable names → value for a given persona
 * scheme. Useful for React inline styles when you want one-off persona previews
 * without injecting a stylesheet (e.g. the template picker thumbnails).
 *
 * Only emits OKLCH values — pair with `personaFallbackStyle()` if you need the
 * iOS 15 hex fallback inline.
 */
export function personaInlineStyle(
  persona: Persona,
  scheme: "light" | "dark",
): Record<string, string> {
  const palette: PersonaPalette = scheme === "light" ? persona.light : persona.dark;
  const out: Record<string, string> = {};
  for (const slot of Object.keys(SLOT_TO_CSS_VAR) as ColorSlot[]) {
    out[SLOT_TO_CSS_VAR[slot]] = palette.oklch[slot];
  }
  const { radius, shadow, border } = persona.shape;
  out["--radius-none"] = `${radius.none}rem`;
  out["--radius-sm"] = `${radius.sm}rem`;
  out["--radius-md"] = `${radius.md}rem`;
  out["--radius-lg"] = `${radius.lg}rem`;
  out["--radius-xl"] = `${radius.xl}rem`;
  out["--radius-full"] = `${radius.full}px`;
  out["--shadow-none"] = shadow.none;
  out["--shadow-sm"] = shadow.sm;
  out["--shadow-md"] = shadow.md;
  out["--shadow-lg"] = shadow.lg;
  out["--shadow-xl"] = shadow.xl;
  out["--border-thin"] = `${border.thin}px`;
  out["--border-medium"] = `${border.medium}px`;
  out["--border-thick"] = `${border.thick}px`;
  out["--font-heading"] = persona.typography.heading.family;
  out["--font-body"] = persona.typography.body.family;
  out["--font-mono"] = persona.typography.mono.family;
  return out;
}

/**
 * sRGB hex-only counterpart of `personaInlineStyle`. When both are merged, the
 * hex values win in OKLCH-unaware browsers (they ignore the earlier oklch
 * declaration at parse time), but modern browsers that understand OKLCH apply
 * whichever comes later. Prefer `personaToCss()` with the `@supports` block
 * for deterministic fallback; use this helper only when you cannot emit a
 * stylesheet.
 */
export function personaFallbackInlineStyle(
  persona: Persona,
  scheme: "light" | "dark",
): Record<string, string> {
  const palette: PersonaPalette = scheme === "light" ? persona.light : persona.dark;
  const out: Record<string, string> = {};
  for (const slot of Object.keys(SLOT_TO_CSS_VAR) as ColorSlot[]) {
    out[SLOT_TO_CSS_VAR[slot]] = palette.rgb[slot];
  }
  return out;
}
