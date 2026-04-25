import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Button, cardReveal, useAnimationPreset } from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";
import type { HeroCenteredAction } from "./hero-centered";

export interface EmptyStateIllustratedProps {
  /**
   * Illustration slot. Consumer provides the visual — SVG, icon, image, or
   * custom JSX composition. Block reserves a centered 120x120 area; larger
   * illustrations will overflow gracefully.
   */
  illustration?: ReactNode;
  /** Heading — "No apps yet", "Nothing here". */
  heading: string;
  /**
   * Supporting copy — one or two sentences explaining what the empty state
   * means and what the user can do about it.
   */
  description?: string;
  /** Primary CTA — "Create your first app". */
  primaryAction?: HeroCenteredAction;
  /** Secondary CTA — "Browse templates", "Learn more". Ghost variant. */
  secondaryAction?: HeroCenteredAction;
  /**
   * Layout variant. `default` centers within available height (suits
   * full-page empty states). `compact` removes the min-height and sits
   * inline (for empty list sections inside a larger page).
   */
  size?: "default" | "compact";
  /** Extra classes merged into the outer wrapper. */
  className?: string;
}

/**
 * Empty state with illustration. Centered layout: illustration → heading →
 * description → CTA pair. Use when a data view has no items and the
 * absence itself is meaningful (distinct from "loading" — use Skeleton
 * there instead).
 *
 * For first-run / onboarding empty states include a clear primary CTA.
 * For "no search results" empty states, skip the CTA (or use secondary
 * action for "Clear filters") — the user got here via an action they can
 * reverse themselves.
 */
export function EmptyStateIllustrated(props: EmptyStateIllustratedProps) {
  const {
    illustration,
    heading,
    description,
    primaryAction,
    secondaryAction,
    size = "default",
    className,
  } = props;

  const reveal = useAnimationPreset(cardReveal);

  const sizeClasses =
    size === "default"
      ? "min-h-[60vh] py-12"
      : "py-10";

  return (
    <section
      className={cn(
        "flex w-full items-center justify-center bg-background px-6 text-foreground",
        sizeClasses,
        className,
      )}
    >
      <motion.div
        className="flex max-w-md flex-col items-center gap-4 text-center"
        initial="initial"
        animate="animate"
        variants={reveal.variants}
        transition={reveal.transition}
      >
        {illustration !== undefined && (
          <div
            className="mb-2 flex h-28 w-28 items-center justify-center text-muted-foreground md:h-32 md:w-32"
            aria-hidden
          >
            {illustration}
          </div>
        )}

        <h2
          className="text-xl font-semibold tracking-tight text-foreground md:text-2xl"
          style={{ fontFamily: "var(--font-heading, inherit)" }}
        >
          {heading}
        </h2>

        {description !== undefined && (
          <p className="max-w-sm text-sm text-muted-foreground md:text-base">
            {description}
          </p>
        )}

        {(primaryAction !== undefined || secondaryAction !== undefined) && (
          <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {primaryAction !== undefined && (
              <EmptyAction action={primaryAction} variant="default" />
            )}
            {secondaryAction !== undefined && (
              <EmptyAction action={secondaryAction} variant="ghost" />
            )}
          </div>
        )}
      </motion.div>
    </section>
  );
}

function EmptyAction({
  action,
  variant,
}: {
  action: HeroCenteredAction;
  variant: "default" | "ghost";
}) {
  if (action.href !== undefined && action.onClick === undefined) {
    return (
      <Button asChild variant={variant} className="min-w-[10rem]">
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
      className="min-w-[10rem]"
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}

export const emptyStateIllustratedMetadata: BlockMetadata = {
  id: "empty-state-illustrated",
  name: "Illustrated Empty State",
  description:
    "Empty state with illustration slot, heading, description, and optional CTA pair. Default + compact sizes.",
  category: "empty-state",
  useCases: [
    "first-run empty inbox",
    "no search results",
    "empty list state",
    "feature not yet used prompt",
  ],
  supportedPersonas: "all",
  motionPresets: ["cardReveal"],
  tags: ["empty-state", "illustration", "onboarding", "no-data"],
  available: true,
};

EmptyStateIllustrated.displayName = "EmptyStateIllustrated";
