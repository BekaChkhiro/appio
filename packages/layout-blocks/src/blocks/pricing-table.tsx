import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Check, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  listStagger,
  useStaggerPreset,
} from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";
import type { HeroCenteredAction } from "./hero-centered";

export interface PricingFeature {
  /** Feature label. */
  label: string;
  /**
   * `true` = check mark, `false` = X (not included), `"pending"` = check
   * with muted styling for "coming soon" items. Omit to default to true.
   */
  included?: boolean | "pending";
  /** Optional supporting text under the label. */
  hint?: string;
}

export interface PricingTier {
  /** Stable ID for keying + anchor links. */
  id: string;
  /** Tier name — "Free", "Pro", "Team", "Enterprise". */
  name: string;
  /**
   * Price string — "$0", "$12", "Contact us". Keep pre-formatted; the block
   * doesn't own i18n/currency concerns.
   */
  price: string;
  /**
   * Billing period suffix — "/month", "/user/month", "per seat". Omitted
   * for tiers with contact-sales pricing.
   */
  period?: string;
  /** One-line tier tagline — "For solo builders", "For growing teams". */
  description?: string;
  /** Feature list. Order matters — most-important first. */
  features: readonly PricingFeature[];
  /** CTA button — label + onClick/href. */
  cta: HeroCenteredAction;
  /**
   * Highlights this tier with a primary-colored ring + badge. Use for the
   * "recommended" tier. Max one tier should be highlighted per table.
   */
  highlighted?: boolean;
  /** Optional highlight badge text — defaults to "Most popular". */
  highlightLabel?: string;
}

export interface PricingTableProps {
  /** Optional eyebrow label above the heading. */
  eyebrow?: string;
  /** Section heading — "Simple pricing", "Plans for every stage". */
  heading?: string;
  /** Supporting copy under the heading. */
  description?: string;
  /** Tiers. Recommended: 2, 3, or 4. 3 is the classic SaaS shape. */
  tiers: readonly PricingTier[];
  /** Extra classes merged into the outer section. */
  className?: string;
}

/**
 * Multi-tier pricing table. Each tier gets a Card with name + price +
 * description + feature list + CTA. Highlighted tiers receive a primary
 * ring + badge; visually pulls the eye without breaking the grid rhythm.
 *
 * Cards stagger in for the "count my options" effect rather than showing
 * all tiers simultaneously. For conversion-optimized pages pair this with
 * a hero above and social proof below.
 */
export function PricingTable(props: PricingTableProps) {
  const { eyebrow, heading, description, tiers, className } = props;

  const stagger = useStaggerPreset(listStagger);

  const columnClasses = {
    2: "md:grid-cols-2 max-w-4xl",
    3: "md:grid-cols-3 max-w-6xl",
    4: "md:grid-cols-2 lg:grid-cols-4 max-w-6xl",
  }[clampTierCount(tiers.length)];

  return (
    <section
      className={cn(
        "w-full bg-background py-16 text-foreground md:py-24",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        {(eyebrow !== undefined ||
          heading !== undefined ||
          description !== undefined) && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            {eyebrow !== undefined && (
              <span className="mb-3 inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {eyebrow}
              </span>
            )}
            {heading !== undefined && (
              <h2
                className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                {heading}
              </h2>
            )}
            {description !== undefined && (
              <p className="mt-4 text-base text-muted-foreground md:text-lg">
                {description}
              </p>
            )}
          </div>
        )}

        <motion.ul
          className={cn(
            "mx-auto grid list-none grid-cols-1 gap-6 p-0",
            columnClasses,
          )}
          initial="initial"
          animate="animate"
          variants={stagger.variants}
        >
          {tiers.map((tier) => (
            <motion.li
              key={tier.id}
              variants={stagger.itemVariants}
              className="h-full"
            >
              <PricingCard tier={tier} />
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

function PricingCard({ tier }: { tier: PricingTier }) {
  const highlighted = tier.highlighted === true;

  return (
    <Card
      className={cn(
        "relative h-full overflow-hidden",
        highlighted && "ring-2 ring-primary",
      )}
    >
      {highlighted && (
        <div className="absolute right-4 top-4">
          <Badge>{tier.highlightLabel ?? "Most popular"}</Badge>
        </div>
      )}
      <CardContent className="flex h-full flex-col gap-6 p-6">
        <header className="space-y-2">
          <h3
            className="text-lg font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            {tier.name}
          </h3>
          {tier.description !== undefined && (
            <p className="text-sm text-muted-foreground">{tier.description}</p>
          )}
        </header>

        <div className="flex items-baseline gap-1">
          <span
            className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            {tier.price}
          </span>
          {tier.period !== undefined && (
            <span className="text-sm text-muted-foreground">{tier.period}</span>
          )}
        </div>

        <ul className="flex flex-1 list-none flex-col gap-3 p-0">
          {tier.features.map((feature, index) => (
            <FeatureRow key={`${feature.label}-${index}`} feature={feature} />
          ))}
        </ul>

        <PricingCta cta={tier.cta} highlighted={highlighted} />
      </CardContent>
    </Card>
  );
}

function FeatureRow({ feature }: { feature: PricingFeature }) {
  const included = feature.included ?? true;

  let icon: ReactNode;
  let labelClass = "text-foreground";
  if (included === false) {
    icon = <X className="h-4 w-4 text-muted-foreground" aria-hidden />;
    labelClass = "text-muted-foreground line-through";
  } else if (included === "pending") {
    icon = <Check className="h-4 w-4 text-muted-foreground" aria-hidden />;
    labelClass = "text-muted-foreground";
  } else {
    icon = <Check className="h-4 w-4 text-primary" aria-hidden />;
  }

  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1">
        <span className={labelClass}>{feature.label}</span>
        {feature.hint !== undefined && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {feature.hint}
          </span>
        )}
      </div>
    </li>
  );
}

function PricingCta({
  cta,
  highlighted,
}: {
  cta: HeroCenteredAction;
  highlighted: boolean;
}) {
  const variant = highlighted ? "default" : "outline";

  if (cta.href !== undefined && cta.onClick === undefined) {
    return (
      <Button asChild variant={variant} size="lg" className="w-full">
        <a
          href={cta.href}
          target={cta.external === true ? "_blank" : undefined}
          rel={cta.external === true ? "noreferrer" : undefined}
        >
          {cta.label}
        </a>
      </Button>
    );
  }
  return (
    <Button
      variant={variant}
      size="lg"
      className="w-full"
      onClick={cta.onClick}
    >
      {cta.label}
    </Button>
  );
}

function clampTierCount(count: number): 2 | 3 | 4 {
  if (count >= 4) return 4;
  if (count === 3) return 3;
  return 2;
}

export const pricingTableMetadata: BlockMetadata = {
  id: "pricing-table",
  name: "Pricing Table",
  description:
    "Multi-tier pricing cards with name, price, feature list (included/excluded/pending), and per-tier CTA. Highlighted tier gets primary ring.",
  category: "pricing",
  useCases: [
    "SaaS pricing page",
    "subscription tier comparison",
    "upgrade prompt page",
    "plan selection",
  ],
  supportedPersonas: "all",
  motionPresets: ["listStagger"],
  tags: ["pricing", "tiers", "conversion", "subscription", "plans"],
  available: true,
};

PricingTable.displayName = "PricingTable";
