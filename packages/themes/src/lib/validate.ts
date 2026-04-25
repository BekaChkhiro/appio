import type { ColorSlot, Persona, PersonaPalette } from "../types.js";
import {
  contrastRatio,
  oklchToRgb,
  parseHex,
  parseOklch,
  rgbDistance,
  type Rgb,
} from "./color.js";

/**
 * Contrast pairs that MUST clear WCAG AA for normal body text (≥4.5:1).
 *
 * `primary` is treated as a text-bearing surface because all five personas
 * use it for button labels and active-state chips where the foreground is
 * small. Ring/input/border are excluded — they're non-text decorative
 * tokens evaluated against the 3:1 UI-component threshold.
 */
const TEXT_CONTRAST_PAIRS: ReadonlyArray<readonly [ColorSlot, ColorSlot]> = [
  ["background", "foreground"],
  ["card", "cardForeground"],
  ["primary", "primaryForeground"],
  ["secondary", "secondaryForeground"],
  ["muted", "mutedForeground"],
  ["accent", "accentForeground"],
  ["destructive", "destructiveForeground"],
];

/**
 * Focus ring MUST meet WCAG 2.2 SC 1.4.11 (≥3:1 against background) so
 * keyboard-only users can see focus state. Borders and input outlines
 * are decorative dividers in the shadcn tradition — evaluated visually,
 * not strictly, since WCAG excludes "inactive" decorative elements.
 */
const UI_COMPONENT_PAIRS: ReadonlyArray<readonly [ColorSlot, ColorSlot]> = [
  ["ring", "background"],
];

const TEXT_MIN = 4.5;
const UI_MIN = 3.0;

/** Maximum allowed drift between OKLCH→sRGB render and authored RGB fallback. */
const MAX_FALLBACK_DRIFT = 12;

export interface ValidationIssue {
  personaId: string;
  scheme: "light" | "dark";
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  /** Per-persona contrast report for human review. */
  report: Array<{
    personaId: string;
    scheme: "light" | "dark";
    colorSpace: "oklch" | "rgb";
    pair: string;
    ratio: number;
    minimum: number;
    passed: boolean;
  }>;
}

export function validatePersona(persona: Persona): ValidationResult {
  const issues: ValidationIssue[] = [];
  const report: ValidationResult["report"] = [];

  for (const scheme of ["light", "dark"] as const) {
    const palette = scheme === "light" ? persona.light : persona.dark;
    checkPalette(persona.id, scheme, palette, issues, report);
  }

  return { ok: issues.every((i) => i.severity !== "error"), issues, report };
}

export function validateAllPersonas(personas: Persona[]): ValidationResult {
  const merged: ValidationResult = { ok: true, issues: [], report: [] };
  for (const p of personas) {
    const res = validatePersona(p);
    merged.issues.push(...res.issues);
    merged.report.push(...res.report);
  }
  merged.ok = merged.issues.every((i) => i.severity !== "error");
  return merged;
}

function checkPalette(
  personaId: string,
  scheme: "light" | "dark",
  palette: PersonaPalette,
  issues: ValidationIssue[],
  report: ValidationResult["report"],
): void {
  const oklchRgb: Record<string, Rgb> = {};
  const hexRgb: Record<string, Rgb> = {};

  for (const slot of Object.keys(palette.oklch) as ColorSlot[]) {
    try {
      const parsed = parseOklch(palette.oklch[slot]);
      const { rgb, inGamut } = oklchToRgb(parsed);
      oklchRgb[slot] = rgb;
      if (!inGamut) {
        // Downgrade to warning: Tailwind v4's palette is authored in P3 and
        // intentionally outside strict sRGB. The authored `rgb` fallback is
        // what iOS 15 renders, so gamut overflow in OKLCH is expected.
        issues.push({
          personaId,
          scheme,
          severity: "warning",
          code: "OUT_OF_GAMUT",
          message: `${scheme}.oklch.${slot} (${palette.oklch[slot]}) sits outside sRGB — iOS 15 uses the rgb fallback`,
        });
      }
    } catch (err) {
      issues.push({
        personaId,
        scheme,
        severity: "error",
        code: "PARSE_OKLCH",
        message: `${scheme}.oklch.${slot}: ${(err as Error).message}`,
      });
    }

    try {
      hexRgb[slot] = parseHex(palette.rgb[slot]);
    } catch (err) {
      issues.push({
        personaId,
        scheme,
        severity: "error",
        code: "PARSE_HEX",
        message: `${scheme}.rgb.${slot}: ${(err as Error).message}`,
      });
    }
  }

  // Check fallback drift: OKLCH render vs RGB fallback.
  for (const slot of Object.keys(palette.oklch) as ColorSlot[]) {
    const a = oklchRgb[slot];
    const b = hexRgb[slot];
    if (!a || !b) continue;
    const drift = rgbDistance(a, b);
    if (drift > MAX_FALLBACK_DRIFT) {
      issues.push({
        personaId,
        scheme,
        severity: "warning",
        code: "FALLBACK_DRIFT",
        message: `${scheme}.${slot}: OKLCH render ${rgbHex(a)} vs fallback ${rgbHex(b)} drift ${drift.toFixed(1)} exceeds ${MAX_FALLBACK_DRIFT}`,
      });
    }
  }

  // Contrast checks — run in both color spaces so iOS 15 fallback is covered.
  for (const [bgSlot, fgSlot] of TEXT_CONTRAST_PAIRS) {
    recordContrast(personaId, scheme, "oklch", oklchRgb, bgSlot, fgSlot, TEXT_MIN, issues, report);
    recordContrast(personaId, scheme, "rgb", hexRgb, bgSlot, fgSlot, TEXT_MIN, issues, report);
  }

  for (const [bgSlot, fgSlot] of UI_COMPONENT_PAIRS) {
    recordContrast(personaId, scheme, "oklch", oklchRgb, bgSlot, fgSlot, UI_MIN, issues, report);
    recordContrast(personaId, scheme, "rgb", hexRgb, bgSlot, fgSlot, UI_MIN, issues, report);
  }
}

function recordContrast(
  personaId: string,
  scheme: "light" | "dark",
  colorSpace: "oklch" | "rgb",
  map: Record<string, Rgb>,
  bgSlot: ColorSlot,
  fgSlot: ColorSlot,
  minimum: number,
  issues: ValidationIssue[],
  report: ValidationResult["report"],
): void {
  const bg = map[bgSlot];
  const fg = map[fgSlot];
  if (!bg || !fg) return;
  const ratio = contrastRatio(bg, fg);
  const passed = ratio + 0.005 >= minimum; // small epsilon for rounding
  report.push({
    personaId,
    scheme,
    colorSpace,
    pair: `${bgSlot} / ${fgSlot}`,
    ratio: Math.round(ratio * 100) / 100,
    minimum,
    passed,
  });
  if (!passed) {
    issues.push({
      personaId,
      scheme,
      severity: "error",
      code: "CONTRAST_FAIL",
      message: `${scheme}.${colorSpace}: ${bgSlot}/${fgSlot} = ${ratio.toFixed(2)}:1 (need ≥ ${minimum}:1)`,
    });
  }
}

function rgbHex({ r, g, b }: Rgb): string {
  const to2 = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
