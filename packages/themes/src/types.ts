export const PERSONA_IDS = [
  "minimal-mono",
  "vibrant-gradient",
  "brutalist-bold",
  "glassmorphic-soft",
  "editorial-serif",
] as const;

export type PersonaId = (typeof PERSONA_IDS)[number];

export type ColorSlot =
  | "background"
  | "foreground"
  | "card"
  | "cardForeground"
  | "primary"
  | "primaryForeground"
  | "secondary"
  | "secondaryForeground"
  | "muted"
  | "mutedForeground"
  | "accent"
  | "accentForeground"
  | "border"
  | "input"
  | "ring"
  | "destructive"
  | "destructiveForeground";

export type ColorMap<T extends string> = Record<ColorSlot, T>;

export interface PersonaPalette {
  /** OKLCH tokens, string form "oklch(L C H)" — L 0..1, C 0..0.4, H 0..360. */
  oklch: ColorMap<string>;
  /** sRGB fallback in #RRGGBB form — required for iOS 15 WebViews that lack OKLCH. */
  rgb: ColorMap<string>;
}

export interface TypographyRole {
  family: string;
  weight: number;
  lineHeight: number;
  letterSpacing: string;
}

export interface PersonaTypography {
  heading: TypographyRole;
  body: TypographyRole;
  mono: { family: string };
  /** Type scale in rem, relative to 16px root. */
  scale: {
    display: number;
    h1: number;
    h2: number;
    h3: number;
    body: number;
    small: number;
  };
}

export interface PersonaShape {
  /** Radius tokens in rem. */
  radius: {
    none: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  /** Shadow tokens as full CSS box-shadow strings. "none" disables. */
  shadow: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  /** Border width tokens in px. */
  border: {
    thin: number;
    medium: number;
    thick: number;
  };
}

export interface PersonaMotion {
  /** Duration tokens in ms. */
  duration: {
    instant: number;
    fast: number;
    medium: number;
    slow: number;
    slower: number;
  };
  /** CSS easing functions. */
  ease: {
    standard: string;
    out: string;
    in: string;
    emphasized: string;
    spring: string;
  };
}

export interface Persona {
  id: PersonaId;
  name: string;
  description: string;
  inspiration: string;
  light: PersonaPalette;
  dark: PersonaPalette;
  typography: PersonaTypography;
  shape: PersonaShape;
  motion: PersonaMotion;
}
