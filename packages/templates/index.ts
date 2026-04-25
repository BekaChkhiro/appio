/**
 * Template Registry — maps template IDs to their metadata and config.
 * Used by the API (via generation service) and the code generator.
 * Git-versioned for A/B testing and rollback.
 */

import { PERSONA_IDS, type PersonaId } from "@appio/themes";
import todoConfig from "./todo-list/template.config.json";
import todoConvexConfig from "./todo-list-convex/template.config.json";
import expenseConfig from "./expense-tracker/template.config.json";
import notesConfig from "./notes-app/template.config.json";
import quizConfig from "./quiz-app/template.config.json";
import habitConfig from "./habit-tracker/template.config.json";

export interface TemplateConfig {
  id: string;
  version: string;
  name: string;
  displayName: string;
  category: string;
  description: string;
  components: string[];
  layouts: string[];
  dataModel: Record<string, Record<string, string>>;
  defaultTheme: {
    primary: string;
    primaryLight: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
  };
  /**
   * Theme Persona this template opts into. Drives color tokens, typography,
   * radius/shadow and animation timings in the generated PWA (see
   * `@appio/themes`). The generator emits persona CSS variables into the
   * template's `globals.css` at build time, so the template itself never
   * hard-codes hex values outside the persona.
   */
  persona: PersonaId;
  propSchemas?: Record<string, Record<string, string>>;
  constraints: {
    maxPages: number;
    maxComponentsPerPage: number;
    storageBackend: string;
  };
}

export const templateRegistry: Record<string, TemplateConfig> = {
  "todo-list": todoConfig as TemplateConfig,
  "todo-list-convex": todoConvexConfig as TemplateConfig,
  "expense-tracker": expenseConfig as TemplateConfig,
  "notes-app": notesConfig as TemplateConfig,
  "quiz-app": quizConfig as TemplateConfig,
  "habit-tracker": habitConfig as TemplateConfig,
};

export const templateIds = Object.keys(templateRegistry);
export const templateList = Object.values(templateRegistry);

export function getTemplate(id: string): TemplateConfig | undefined {
  return templateRegistry[id];
}

/**
 * Runs at module load — fails the build if any template references a persona
 * that isn't in the registry. Without this, a typo in `template.config.json`
 * would silently fall back to an undefined persona at runtime.
 */
function assertAllPersonasValid(): void {
  const validIds = new Set<string>(PERSONA_IDS);
  for (const tpl of templateList) {
    if (!tpl.persona || !validIds.has(tpl.persona)) {
      throw new Error(
        `Template "${tpl.id}" has invalid persona "${String(tpl.persona)}". ` +
          `Expected one of: ${PERSONA_IDS.join(", ")}`,
      );
    }
  }
}

assertAllPersonasValid();
