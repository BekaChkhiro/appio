import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  listStagger,
  useStaggerPreset,
} from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";

export interface FeatureGridItem {
  /**
   * Optional leading icon. Pass any renderable — typically a `lucide-react`
   * icon at default size. The block wraps it in a 40x40 rounded tile so the
   * visual weight stays consistent across items.
   */
  icon?: ReactNode;
  /** Feature name — renders as a CardTitle. */
  title: string;
  /** One-to-two sentence description. */
  description: string;
  /** Optional href — when present the whole card becomes a link. */
  href?: string;
}

export interface FeatureGridProps {
  /** Optional section eyebrow rendered above the heading. */
  eyebrow?: string;
  /** Section heading (h2). Optional — omit for minimal "just the grid" usage. */
  heading?: string;
  /** Supporting copy under the heading. */
  description?: string;
  /** Feature items. Recommended: 3, 4, or 6 for clean rows. */
  items: readonly FeatureGridItem[];
  /**
   * Column count at `md:` and above. Mobile always shows one column, `sm:`
   * promotes to two, `md:` uses this value. Defaults to 3.
   */
  columns?: 2 | 3 | 4;
  /** Extra classes merged into the outer section. */
  className?: string;
}

/**
 * Responsive grid of feature cards. Each card staggers in via `listStagger`
 * so the grid reveals top-left → bottom-right (or top-down on narrow
 * viewports) rather than popping in as a slab.
 *
 * Card visuals use shadcn's `Card` primitives so the persona's card palette
 * (`bg-card`, `text-card-foreground`) applies without any extra wiring.
 */
export function FeatureGrid(props: FeatureGridProps) {
  const {
    eyebrow,
    heading,
    description,
    items,
    columns = 3,
    className,
  } = props;

  const stagger = useStaggerPreset(listStagger);

  const columnClasses = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  }[columns];

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
            "grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2",
            columnClasses,
          )}
          initial="initial"
          animate="animate"
          variants={stagger.variants}
        >
          {items.map((item, index) => (
            <motion.li
              key={`${item.title}-${index}`}
              variants={stagger.itemVariants}
              className="h-full"
            >
              <FeatureCard item={item} />
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

function FeatureCard({ item }: { item: FeatureGridItem }) {
  const body = (
    <Card className="h-full transition-colors hover:bg-accent/40">
      <CardHeader>
        {item.icon !== undefined && (
          <div
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden
          >
            {item.icon}
          </div>
        )}
        <CardTitle
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-heading, inherit)" }}
        >
          {item.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm text-muted-foreground">
          {item.description}
        </CardDescription>
      </CardContent>
    </Card>
  );

  if (item.href !== undefined) {
    return (
      <a
        href={item.href}
        className="block h-full rounded-lg outline-none ring-ring focus-visible:ring-2"
      >
        {body}
      </a>
    );
  }
  return body;
}

export const featureGridMetadata: BlockMetadata = {
  id: "feature-grid",
  name: "Feature Grid",
  description:
    "Responsive grid of feature cards with icon, title, and description. Supports 2/3/4 columns on desktop, always one column on mobile.",
  category: "feature",
  useCases: [
    "landing page feature section",
    "product capability showcase",
    "what's included list",
    "benefits overview",
  ],
  supportedPersonas: "all",
  motionPresets: ["listStagger"],
  tags: ["grid", "marketing", "icon-cards", "responsive", "benefits"],
  available: true,
};

FeatureGrid.displayName = "FeatureGrid";
