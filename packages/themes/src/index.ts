import type { Persona, PersonaId } from "./types.js";
import { PERSONA_IDS } from "./types.js";
import { minimalMono } from "./personas/minimal-mono.js";
import { vibrantGradient } from "./personas/vibrant-gradient.js";
import { brutalistBold } from "./personas/brutalist-bold.js";
import { glassmorphicSoft } from "./personas/glassmorphic-soft.js";
import { editorialSerif } from "./personas/editorial-serif.js";

export type {
  ColorMap,
  ColorSlot,
  Persona,
  PersonaId,
  PersonaMotion,
  PersonaPalette,
  PersonaShape,
  PersonaTypography,
  TypographyRole,
} from "./types.js";
export { PERSONA_IDS } from "./types.js";

export {
  personaToCss,
  personaInlineStyle,
  personaFallbackInlineStyle,
  type CssOptions,
} from "./lib/css.js";
export { validatePersona, validateAllPersonas } from "./lib/validate.js";
export type { ValidationIssue, ValidationResult } from "./lib/validate.js";

export const personaRegistry: Record<PersonaId, Persona> = {
  "minimal-mono": minimalMono,
  "vibrant-gradient": vibrantGradient,
  "brutalist-bold": brutalistBold,
  "glassmorphic-soft": glassmorphicSoft,
  "editorial-serif": editorialSerif,
};

export const personaList: Persona[] = PERSONA_IDS.map((id) => personaRegistry[id]);

export function getPersona(id: PersonaId): Persona {
  return personaRegistry[id];
}

export function isPersonaId(value: string): value is PersonaId {
  return (PERSONA_IDS as readonly string[]).includes(value);
}
