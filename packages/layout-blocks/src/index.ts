// Block components
export {
  HeroCentered,
  heroCenteredMetadata,
  type HeroCenteredAction,
  type HeroCenteredProps,
} from "./blocks/hero-centered";

export {
  HeroSplit,
  heroSplitMetadata,
  type HeroSplitProps,
} from "./blocks/hero-split";

export {
  FeatureGrid,
  featureGridMetadata,
  type FeatureGridItem,
  type FeatureGridProps,
} from "./blocks/feature-grid";

export {
  Testimonials,
  testimonialsMetadata,
  type TestimonialItem,
  type TestimonialsProps,
} from "./blocks/testimonials";

export {
  FooterMulti,
  footerMultiMetadata,
  type FooterLink,
  type FooterLinkColumn,
  type FooterMultiProps,
  type FooterSocialLink,
} from "./blocks/footer-multi";

export {
  DashboardStats,
  dashboardStatsMetadata,
  type DashboardStatItem,
  type DashboardStatsProps,
  type StatTrend,
} from "./blocks/dashboard-stats";

export {
  SettingsPanel,
  settingsPanelMetadata,
  type SettingsPanelProps,
  type SettingsPanelSection,
} from "./blocks/settings-panel";

export {
  PricingTable,
  pricingTableMetadata,
  type PricingFeature,
  type PricingTableProps,
  type PricingTier,
} from "./blocks/pricing-table";

export {
  LoginCard,
  loginCardMetadata,
  type LoginCardProps,
  type OAuthProvider,
} from "./blocks/login-card";

export {
  OnboardingStepper,
  onboardingStepperMetadata,
  type OnboardingStep,
  type OnboardingStepperProps,
} from "./blocks/onboarding-stepper";

export {
  MarketplaceGrid,
  marketplaceGridMetadata,
  type MarketplaceFilter,
  type MarketplaceGridProps,
  type MarketplaceItem,
} from "./blocks/marketplace-grid";

export {
  ProfileCard,
  profileCardMetadata,
  type ProfileCardProps,
  type ProfileStat,
} from "./blocks/profile-card";

export {
  FaqAccordion,
  faqAccordionMetadata,
  type FaqAccordionProps,
  type FaqItem,
} from "./blocks/faq-accordion";

export {
  EmptyStateIllustrated,
  emptyStateIllustratedMetadata,
  type EmptyStateIllustratedProps,
} from "./blocks/empty-state-illustrated";

export {
  CommandPalette,
  commandPaletteMetadata,
  type CommandGroup,
  type CommandItem,
  type CommandPaletteProps,
} from "./blocks/command-palette";

// Registry + taxonomy
export {
  availableBlockIds,
  blockRegistry,
  getAgentPromptListings,
  getBlock,
  pendingBlockIds,
  type PromptListing,
} from "./registry";

export {
  BLOCK_CATEGORIES,
  BLOCK_IDS,
  type BlockCategory,
  type BlockEntry,
  type BlockId,
  type BlockMetadata,
  type BlockRegistry,
} from "./types";

// Utilities
export { cn } from "./lib/utils";
