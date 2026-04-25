import type { BlockEntry, BlockId, BlockRegistry } from "./types";
import { BLOCK_IDS } from "./types";

import {
  HeroCentered,
  heroCenteredMetadata,
  type HeroCenteredProps,
} from "./blocks/hero-centered";
import {
  HeroSplit,
  heroSplitMetadata,
  type HeroSplitProps,
} from "./blocks/hero-split";
import {
  FeatureGrid,
  featureGridMetadata,
  type FeatureGridProps,
} from "./blocks/feature-grid";
import {
  Testimonials,
  testimonialsMetadata,
  type TestimonialsProps,
} from "./blocks/testimonials";
import {
  FooterMulti,
  footerMultiMetadata,
  type FooterMultiProps,
} from "./blocks/footer-multi";
import {
  DashboardStats,
  dashboardStatsMetadata,
  type DashboardStatsProps,
} from "./blocks/dashboard-stats";
import {
  SettingsPanel,
  settingsPanelMetadata,
  type SettingsPanelProps,
} from "./blocks/settings-panel";
import {
  PricingTable,
  pricingTableMetadata,
  type PricingTableProps,
} from "./blocks/pricing-table";
import {
  LoginCard,
  loginCardMetadata,
  type LoginCardProps,
} from "./blocks/login-card";
import {
  OnboardingStepper,
  onboardingStepperMetadata,
  type OnboardingStepperProps,
} from "./blocks/onboarding-stepper";
import {
  MarketplaceGrid,
  marketplaceGridMetadata,
  type MarketplaceGridProps,
} from "./blocks/marketplace-grid";
import {
  ProfileCard,
  profileCardMetadata,
  type ProfileCardProps,
} from "./blocks/profile-card";
import {
  FaqAccordion,
  faqAccordionMetadata,
  type FaqAccordionProps,
} from "./blocks/faq-accordion";
import {
  EmptyStateIllustrated,
  emptyStateIllustratedMetadata,
  type EmptyStateIllustratedProps,
} from "./blocks/empty-state-illustrated";
import {
  CommandPalette,
  commandPaletteMetadata,
  type CommandPaletteProps,
} from "./blocks/command-palette";

export const blockRegistry: BlockRegistry = {
  // Batch 1 — shipped
  "hero-centered": {
    metadata: heroCenteredMetadata,
    component: HeroCentered as unknown as BlockEntry["component"],
  },
  "hero-split": {
    metadata: heroSplitMetadata,
    component: HeroSplit as unknown as BlockEntry["component"],
  },
  "feature-grid": {
    metadata: featureGridMetadata,
    component: FeatureGrid as unknown as BlockEntry["component"],
  },
  testimonials: {
    metadata: testimonialsMetadata,
    component: Testimonials as unknown as BlockEntry["component"],
  },
  "footer-multi": {
    metadata: footerMultiMetadata,
    component: FooterMulti as unknown as BlockEntry["component"],
  },

  // Batch 2 — dashboards / forms
  "dashboard-stats": {
    metadata: dashboardStatsMetadata,
    component: DashboardStats as unknown as BlockEntry["component"],
  },
  "settings-panel": {
    metadata: settingsPanelMetadata,
    component: SettingsPanel as unknown as BlockEntry["component"],
  },
  "pricing-table": {
    metadata: pricingTableMetadata,
    component: PricingTable as unknown as BlockEntry["component"],
  },
  "login-card": {
    metadata: loginCardMetadata,
    component: LoginCard as unknown as BlockEntry["component"],
  },
  "onboarding-stepper": {
    metadata: onboardingStepperMetadata,
    component: OnboardingStepper as unknown as BlockEntry["component"],
  },

  // Batch 3 — utility
  "marketplace-grid": {
    metadata: marketplaceGridMetadata,
    component: MarketplaceGrid as unknown as BlockEntry["component"],
  },
  "profile-card": {
    metadata: profileCardMetadata,
    component: ProfileCard as unknown as BlockEntry["component"],
  },
  "faq-accordion": {
    metadata: faqAccordionMetadata,
    component: FaqAccordion as unknown as BlockEntry["component"],
  },
  "empty-state-illustrated": {
    metadata: emptyStateIllustratedMetadata,
    component: EmptyStateIllustrated as unknown as BlockEntry["component"],
  },
  "command-palette": {
    metadata: commandPaletteMetadata,
    component: CommandPalette as unknown as BlockEntry["component"],
  },
};

export function getBlock(id: BlockId): BlockEntry {
  return blockRegistry[id];
}

export const availableBlockIds: readonly BlockId[] = BLOCK_IDS.filter(
  (id) => blockRegistry[id].metadata.available,
);

export const pendingBlockIds: readonly BlockId[] = BLOCK_IDS.filter(
  (id) => !blockRegistry[id].metadata.available,
);

export interface PromptListing {
  id: BlockId;
  name: string;
  category: string;
  description: string;
  useCases: readonly string[];
  motionPresets: readonly string[];
}

/**
 * Snapshot shape consumed by the agent prompt generator. Returns only
 * available blocks so the LLM never references something it can't import.
 */
export function getAgentPromptListings(): readonly PromptListing[] {
  return availableBlockIds.map((id) => {
    const { metadata } = blockRegistry[id];
    return {
      id: metadata.id,
      name: metadata.name,
      category: metadata.category,
      description: metadata.description,
      useCases: metadata.useCases,
      motionPresets: metadata.motionPresets,
    };
  });
}

export type {
  HeroCenteredProps,
  HeroSplitProps,
  FeatureGridProps,
  TestimonialsProps,
  FooterMultiProps,
  DashboardStatsProps,
  SettingsPanelProps,
  PricingTableProps,
  LoginCardProps,
  OnboardingStepperProps,
  MarketplaceGridProps,
  ProfileCardProps,
  FaqAccordionProps,
  EmptyStateIllustratedProps,
  CommandPaletteProps,
};
