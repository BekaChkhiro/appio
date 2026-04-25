import type { ComponentType } from "react";
import type { AnimationPresetName } from "@appio/ui";
import type { PersonaId } from "@appio/themes";

/**
 * Categories map 1:1 to the sections of a typical landing / dashboard / app
 * screen. Agent prompt groups available blocks by category so the LLM can
 * retrieve "what block do I need for X" in O(1) without scanning the full
 * registry.
 */
export const BLOCK_CATEGORIES = [
  "hero",
  "feature",
  "social-proof",
  "pricing",
  "footer",
  "dashboard",
  "settings",
  "auth",
  "marketplace",
  "profile",
  "content",
  "empty-state",
  "navigation",
] as const;

export type BlockCategory = (typeof BLOCK_CATEGORIES)[number];

/**
 * Stable IDs for the full 15-block set. IDs are frozen for the agent prompt +
 * RAG snippets — renaming would break historical generations. Batch 1 ships
 * the first 5; batches 2 and 3 fill in the rest without type changes required.
 */
export const BLOCK_IDS = [
  // Batch 1 — landing / marketing
  "hero-centered",
  "hero-split",
  "feature-grid",
  "testimonials",
  "footer-multi",
  // Batch 2 — dashboard / forms (pending)
  "dashboard-stats",
  "settings-panel",
  "pricing-table",
  "login-card",
  "onboarding-stepper",
  // Batch 3 — utility (pending)
  "marketplace-grid",
  "profile-card",
  "faq-accordion",
  "empty-state-illustrated",
  "command-palette",
] as const;

export type BlockId = (typeof BLOCK_IDS)[number];

export interface BlockMetadata {
  id: BlockId;
  /** Human-readable name for picker UIs. */
  name: string;
  /** One-sentence description used by the agent prompt for routing. */
  description: string;
  category: BlockCategory;
  /** Typical use cases — each is a short phrase an agent would match against. */
  useCases: readonly string[];
  /**
   * Personas this block has been validated against. For Batch 1 every block
   * renders cleanly across all 5 personas; future blocks may opt out of
   * personas where the visual language conflicts (e.g. a glassmorphic-only
   * block could list only `["glassmorphic-soft"]`).
   */
  supportedPersonas: readonly PersonaId[] | "all";
  /**
   * Motion presets the block activates at mount. Used by the agent prompt to
   * surface "this block animates — no extra wrapper needed" and by consumers
   * that want to disable motion on a per-block basis.
   */
  motionPresets: readonly AnimationPresetName[];
  /**
   * Free-form tags the agent can search on (e.g. "gradient", "dark-first",
   * "responsive", "2-column"). Kept loose on purpose — we'll prune after
   * Batch 3 adoption data lands.
   */
  tags: readonly string[];
  /** Implementation status — set to `true` when the component ships. */
  available: boolean;
}

export interface BlockEntry<Props = unknown> {
  metadata: BlockMetadata;
  /**
   * The block component. `undefined` until the block is implemented; registry
   * callers must check `metadata.available` before dereferencing.
   */
  component: ComponentType<Props> | undefined;
}

export type BlockRegistry = Readonly<Record<BlockId, BlockEntry>>;
