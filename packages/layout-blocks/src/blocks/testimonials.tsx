import { motion } from "motion/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
  listStagger,
  useStaggerPreset,
} from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";

export interface TestimonialItem {
  /** The quote itself. Keep ≤3 sentences for scannability. */
  quote: string;
  /** Author's full name. */
  authorName: string;
  /** Role / company — "Head of Product, Acme" etc. Optional. */
  authorRole?: string;
  /** Avatar image URL. Omit and the initials fallback handles it. */
  authorAvatarUrl?: string;
}

export interface TestimonialsProps {
  /** Optional eyebrow label above the section heading. */
  eyebrow?: string;
  /** Section heading — "Loved by teams everywhere" etc. */
  heading?: string;
  /** Supporting copy under the heading. */
  description?: string;
  /** Testimonial items. Recommended: 3 or 6 for clean rows. */
  items: readonly TestimonialItem[];
  /**
   * Column count on `md:+`. Defaults to 3. Mobile always shows one column.
   */
  columns?: 1 | 2 | 3;
  /** Extra classes merged into the outer section. */
  className?: string;
}

/**
 * Grid of testimonial cards. Typography leans on the persona's heading font
 * for the quote — personas like `editorial-serif` render this as a proper
 * pullquote while `minimal-mono` keeps it tight and sans.
 */
export function Testimonials(props: TestimonialsProps) {
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
    1: "md:grid-cols-1 max-w-2xl mx-auto",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
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
            "grid list-none grid-cols-1 gap-6 p-0",
            columnClasses,
          )}
          initial="initial"
          animate="animate"
          variants={stagger.variants}
        >
          {items.map((item, index) => (
            <motion.li
              key={`${item.authorName}-${index}`}
              variants={stagger.itemVariants}
              className="h-full"
            >
              <TestimonialCard item={item} />
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

function TestimonialCard({ item }: { item: TestimonialItem }) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-6 p-6">
        <blockquote
          className="flex-1 text-base leading-relaxed text-foreground md:text-lg"
          style={{ fontFamily: "var(--font-heading, inherit)" }}
        >
          <span aria-hidden className="mr-1 text-muted-foreground">
            &ldquo;
          </span>
          {item.quote}
          <span aria-hidden className="ml-1 text-muted-foreground">
            &rdquo;
          </span>
        </blockquote>

        <figcaption className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {item.authorAvatarUrl !== undefined && (
              <AvatarImage src={item.authorAvatarUrl} alt={item.authorName} />
            )}
            <AvatarFallback>{initials(item.authorName)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col text-left text-sm">
            <span className="font-medium text-foreground">
              {item.authorName}
            </span>
            {item.authorRole !== undefined && (
              <span className="text-muted-foreground">{item.authorRole}</span>
            )}
          </div>
        </figcaption>
      </CardContent>
    </Card>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (
    parts[0]!.charAt(0).toUpperCase() +
    parts[parts.length - 1]!.charAt(0).toUpperCase()
  );
}

export const testimonialsMetadata: BlockMetadata = {
  id: "testimonials",
  name: "Testimonials",
  description:
    "Grid of testimonial cards, each with quote, author name, role, and optional avatar. Staggered reveal animation.",
  category: "social-proof",
  useCases: [
    "landing page social proof section",
    "customer quotes",
    "case study summaries",
    "user reviews showcase",
  ],
  supportedPersonas: "all",
  motionPresets: ["listStagger"],
  tags: ["social-proof", "quotes", "grid", "marketing"],
  available: true,
};

Testimonials.displayName = "Testimonials";
