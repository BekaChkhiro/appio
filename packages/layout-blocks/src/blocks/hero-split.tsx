import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  Button,
  cardReveal,
  listStagger,
  useAnimationPreset,
  useStaggerPreset,
} from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";
import type { HeroCenteredAction } from "./hero-centered";

export interface HeroSplitProps {
  /** Eyebrow label above the headline. */
  eyebrow?: string;
  /** Primary headline — h1. */
  headline: string;
  /** Supporting subheadline — up to three lines. */
  subheadline?: string;
  /** Primary call-to-action button. */
  primaryAction?: HeroCenteredAction;
  /** Secondary ghost-variant action. */
  secondaryAction?: HeroCenteredAction;
  /**
   * Visual slot rendered on the side (image, illustration, product
   * screenshot, video). Consumers pass JSX; the block handles sizing +
   * aspect ratio + responsive stack order.
   */
  visual: ReactNode;
  /**
   * Which side the copy lives on at `md:` and above. Defaults to `"left"`
   * (copy left, visual right) which tests better on LTR marketing sites.
   */
  copySide?: "left" | "right";
  /** Extra classes merged into the outer section. */
  className?: string;
}

/**
 * Two-column hero. Copy on one side, visual slot on the other. Stacks
 * single-column below `md` — the visual always lands below the copy on
 * mobile regardless of `copySide`, so the CTA stays above the fold on small
 * screens.
 *
 * The CTA pair uses `listStagger` to peel in after the headline reveals,
 * giving the eye a clear path: eyebrow → headline → CTAs.
 */
export function HeroSplit(props: HeroSplitProps) {
  const {
    eyebrow,
    headline,
    subheadline,
    primaryAction,
    secondaryAction,
    visual,
    copySide = "left",
    className,
  } = props;

  const reveal = useAnimationPreset(cardReveal);
  const ctaStagger = useStaggerPreset(listStagger);

  const copyOrder = copySide === "left" ? "md:order-1" : "md:order-2";
  const visualOrder = copySide === "left" ? "md:order-2" : "md:order-1";

  return (
    <section
      className={cn(
        "relative w-full bg-background py-16 text-foreground md:py-24",
        className,
      )}
    >
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 md:grid-cols-2 md:gap-16">
        <motion.div
          className={cn(
            "flex flex-col gap-5 text-left",
            copyOrder,
          )}
          initial="initial"
          animate="animate"
          variants={reveal.variants}
          transition={reveal.transition}
        >
          {eyebrow !== undefined && (
            <span className="inline-flex w-fit items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {eyebrow}
            </span>
          )}

          <h1
            className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            {headline}
          </h1>

          {subheadline !== undefined && (
            <p className="max-w-xl text-base text-muted-foreground md:text-lg">
              {subheadline}
            </p>
          )}

          {(primaryAction !== undefined || secondaryAction !== undefined) && (
            <motion.div
              className="mt-2 flex flex-col gap-3 sm:flex-row"
              initial="initial"
              animate="animate"
              variants={ctaStagger.variants}
            >
              {primaryAction !== undefined && (
                <motion.div variants={ctaStagger.itemVariants}>
                  <SplitAction action={primaryAction} variant="default" />
                </motion.div>
              )}
              {secondaryAction !== undefined && (
                <motion.div variants={ctaStagger.itemVariants}>
                  <SplitAction action={secondaryAction} variant="ghost" />
                </motion.div>
              )}
            </motion.div>
          )}
        </motion.div>

        <motion.div
          className={cn(
            "flex w-full items-center justify-center",
            visualOrder,
          )}
          initial="initial"
          animate="animate"
          variants={reveal.variants}
          transition={{
            ...reveal.transition,
            // Visual reveals ~80ms after the copy starts — subtle but makes
            // the composition feel deliberately sequenced rather than
            // jumping in as one slab.
            delay: 0.08,
          }}
        >
          <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {visual}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SplitAction({
  action,
  variant,
}: {
  action: HeroCenteredAction;
  variant: "default" | "ghost";
}) {
  if (action.href !== undefined && action.onClick === undefined) {
    return (
      <Button asChild variant={variant} size="lg" className="min-w-[10rem]">
        <a
          href={action.href}
          target={action.external === true ? "_blank" : undefined}
          rel={action.external === true ? "noreferrer" : undefined}
        >
          {action.label}
        </a>
      </Button>
    );
  }
  return (
    <Button
      variant={variant}
      size="lg"
      className="min-w-[10rem]"
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}

export const heroSplitMetadata: BlockMetadata = {
  id: "hero-split",
  name: "Hero Split",
  description:
    "Two-column hero with copy on one side and a visual slot (image, illustration, screenshot) on the other. Stacks on mobile.",
  category: "hero",
  useCases: [
    "product landing page hero",
    "feature showcase with screenshot",
    "announcement with product photo",
    "SaaS homepage with app preview",
  ],
  supportedPersonas: "all",
  motionPresets: ["cardReveal", "listStagger"],
  tags: ["two-column", "marketing", "visual", "responsive", "product-showcase"],
  available: true,
};

HeroSplit.displayName = "HeroSplit";
