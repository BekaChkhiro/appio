import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Button, cardReveal, useAnimationPreset } from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";

export interface HeroCenteredAction {
  /** Visible label. */
  label: string;
  /** `onClick` handler. Omit when `href` is provided — one or the other. */
  onClick?: () => void;
  /** Navigates to this URL when clicked. Opens in the same tab by default. */
  href?: string;
  /** Open `href` in a new tab. Ignored when `onClick` is provided. */
  external?: boolean;
}

export interface HeroCenteredProps {
  /**
   * Small eyebrow label above the headline — typically a product status
   * ("New release"), a segment ("For product teams"), or nothing.
   */
  eyebrow?: string;
  /** Primary headline. Renders as an h1. */
  headline: string;
  /** Supporting subheadline — one sentence, max two lines. */
  subheadline?: string;
  /** Primary call-to-action. */
  primaryAction?: HeroCenteredAction;
  /** Secondary action rendered as `variant="ghost"`. */
  secondaryAction?: HeroCenteredAction;
  /**
   * Optional slot beneath the CTAs — use for social-proof logos, review
   * badges, or a "no credit card required" microcopy line.
   */
  footerSlot?: ReactNode;
  /** Extra classes merged into the outer section. */
  className?: string;
  /**
   * Size controls the vertical padding + headline scale. `default` suits most
   * marketing pages; `compact` fits secondary landing sections; `full` fills
   * the viewport with `min-h-[80vh]` for above-the-fold hero takeovers.
   */
  size?: "compact" | "default" | "full";
}

/**
 * Full-width centered hero. Ships the canonical marketing-page above-the-fold
 * composition: eyebrow → headline → subheadline → CTA pair → optional social
 * proof row. Consumes shadcn color tokens (`bg-background`, `text-foreground`,
 * `text-muted-foreground`) so the persona in scope drives the palette.
 *
 * Animates in with `cardReveal`. Honors `prefers-reduced-motion` via the
 * preset's reduced variants — no extra wiring needed.
 */
export function HeroCentered(props: HeroCenteredProps) {
  const {
    eyebrow,
    headline,
    subheadline,
    primaryAction,
    secondaryAction,
    footerSlot,
    className,
    size = "default",
  } = props;

  const reveal = useAnimationPreset(cardReveal);

  const sizeClasses = {
    compact: "py-12 md:py-16",
    default: "py-20 md:py-28",
    full: "min-h-[80vh] py-24 md:py-32",
  }[size];

  const headlineClasses = {
    compact: "text-3xl md:text-4xl",
    default: "text-4xl md:text-5xl lg:text-6xl",
    full: "text-5xl md:text-6xl lg:text-7xl",
  }[size];

  return (
    <section
      className={cn(
        "relative w-full bg-background text-foreground",
        sizeClasses,
        size === "full" && "flex items-center justify-center",
        className,
      )}
    >
      <motion.div
        className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 text-center"
        initial="initial"
        animate="animate"
        variants={reveal.variants}
        transition={reveal.transition}
      >
        {eyebrow !== undefined && (
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {eyebrow}
          </span>
        )}

        <h1
          className={cn(
            "font-semibold tracking-tight text-foreground",
            headlineClasses,
          )}
          style={{ fontFamily: "var(--font-heading, inherit)" }}
        >
          {headline}
        </h1>

        {subheadline !== undefined && (
          <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
            {subheadline}
          </p>
        )}

        {(primaryAction !== undefined || secondaryAction !== undefined) && (
          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {primaryAction !== undefined && (
              <HeroActionButton action={primaryAction} variant="default" />
            )}
            {secondaryAction !== undefined && (
              <HeroActionButton action={secondaryAction} variant="ghost" />
            )}
          </div>
        )}

        {footerSlot !== undefined && (
          <div className="mt-6 w-full text-muted-foreground">{footerSlot}</div>
        )}
      </motion.div>
    </section>
  );
}

function HeroActionButton({
  action,
  variant,
}: {
  action: HeroCenteredAction;
  variant: "default" | "ghost";
}) {
  if (action.href !== undefined && action.onClick === undefined) {
    return (
      <Button
        asChild
        variant={variant}
        size="lg"
        className="min-w-[10rem]"
      >
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

export const heroCenteredMetadata: BlockMetadata = {
  id: "hero-centered",
  name: "Hero Centered",
  description:
    "Full-width centered hero with eyebrow, headline, subheadline, and paired CTAs. Use for marketing landing pages and top-of-section heroes.",
  category: "hero",
  useCases: [
    "landing page hero",
    "marketing homepage top section",
    "launch announcement",
    "feature release page",
  ],
  supportedPersonas: "all",
  motionPresets: ["cardReveal"],
  tags: ["centered", "marketing", "above-the-fold", "cta"],
  available: true,
};

HeroCentered.displayName = "HeroCentered";
