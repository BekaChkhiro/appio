/**
 * Color math for persona validation.
 *
 * OKLCH → sRGB conversion follows Björn Ottosson's OKLAB reference:
 * https://bottosson.github.io/posts/oklab/
 *
 * Gamut clipping is *not* applied — persona palettes must be authored
 * inside sRGB gamut, and the validator rejects out-of-gamut values so
 * they don't silently collapse on iOS 15 WebViews.
 */

export interface Rgb {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
}

export interface Oklch {
  l: number; // 0..1
  c: number; // 0..~0.4
  h: number; // 0..360
}

export function parseHex(hex: string): Rgb {
  const h = hex.replace(/^#/, "");
  if (h.length !== 6) throw new Error(`Expected #RRGGBB, got "${hex}"`);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) throw new Error(`Invalid hex "${hex}"`);
  return { r, g, b };
}

/**
 * Parses an `oklch(L C H)` string.
 * Supports L as either 0..1 decimal or 0%..100% percentage.
 */
export function parseOklch(input: string): Oklch {
  const match = input.trim().match(/^oklch\(\s*([^\s)]+)\s+([^\s)]+)\s+([^\s)]+)\s*\)$/i);
  if (!match) throw new Error(`Expected "oklch(L C H)", got "${input}"`);
  const [, lRaw, cRaw, hRaw] = match as [string, string, string, string];
  const l = lRaw.endsWith("%") ? parseFloat(lRaw) / 100 : parseFloat(lRaw);
  const c = parseFloat(cRaw);
  const h = parseFloat(hRaw);
  if ([l, c, h].some(Number.isNaN)) throw new Error(`Invalid oklch "${input}"`);
  return { l, c, h };
}

/** OKLCH polar → OKLAB rectangular. */
function oklchToOklab({ l, c, h }: Oklch): { l: number; a: number; b: number } {
  const rad = (h * Math.PI) / 180;
  return { l, a: c * Math.cos(rad), b: c * Math.sin(rad) };
}

/** OKLAB → linear sRGB via Ottosson's M2⁻¹ then M1⁻¹. */
function oklabToLinearRgb({
  l,
  a,
  b,
}: {
  l: number;
  a: number;
  b: number;
}): { r: number; g: number; b: number } {
  const lp = l + 0.3963377774 * a + 0.2158037573 * b;
  const mp = l - 0.1055613458 * a - 0.0638541728 * b;
  const sp = l - 0.0894841775 * a - 1.291485548 * b;

  const ll = lp ** 3;
  const mm = mp ** 3;
  const ss = sp ** 3;

  return {
    r: 4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss,
    g: -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss,
    b: -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss,
  };
}

/** sRGB companding (linear → gamma-encoded 0..1). */
function linearToSrgbChannel(x: number): number {
  if (x <= 0.0031308) return 12.92 * x;
  return 1.055 * x ** (1 / 2.4) - 0.055;
}

/** sRGB companding (gamma-encoded 0..1 → linear). */
function srgbToLinearChannel(x: number): number {
  if (x <= 0.04045) return x / 12.92;
  return ((x + 0.055) / 1.055) ** 2.4;
}

export interface OklchToRgbResult {
  rgb: Rgb;
  inGamut: boolean;
}

/**
 * Converts OKLCH → sRGB. Reports whether the result is in-gamut so the
 * validator can reject personas that'd clip badly on display.
 */
export function oklchToRgb(oklch: Oklch): OklchToRgbResult {
  const lab = oklchToOklab(oklch);
  const linear = oklabToLinearRgb(lab);

  const tolerance = 0.001;
  const inGamut =
    linear.r >= -tolerance &&
    linear.r <= 1 + tolerance &&
    linear.g >= -tolerance &&
    linear.g <= 1 + tolerance &&
    linear.b >= -tolerance &&
    linear.b <= 1 + tolerance;

  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  const r = Math.round(linearToSrgbChannel(clamp(linear.r)) * 255);
  const g = Math.round(linearToSrgbChannel(clamp(linear.g)) * 255);
  const b = Math.round(linearToSrgbChannel(clamp(linear.b)) * 255);

  return { rgb: { r, g, b }, inGamut };
}

/** WCAG 2.2 relative luminance (sRGB → luminance). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const rl = srgbToLinearChannel(r / 255);
  const gl = srgbToLinearChannel(g / 255);
  const bl = srgbToLinearChannel(b / 255);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** WCAG 2.2 contrast ratio between two sRGB colors (1..21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

export function hexFromRgb({ r, g, b }: Rgb): string {
  const to2 = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** Approximate hue distance between two OKLCH colors (ΔE ballpark). */
export function rgbDistance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
