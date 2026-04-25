import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  listStagger,
  useStaggerPreset,
} from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";

export interface MarketplaceItem {
  /** Stable ID — used as React key + passed to `onItemClick`. */
  id: string;
  /** Item title — product name, template name, app name. */
  title: string;
  /** One-line description rendered below the title. */
  subtitle?: string;
  /**
   * Price string — "$29", "Free", "From $99/month". Pre-formatted; block
   * doesn't own i18n.
   */
  price?: string;
  /** Image URL. Omit to show a muted placeholder tile. */
  imageUrl?: string;
  /** Accessible alt text for the image. Defaults to title. */
  imageAlt?: string;
  /** Optional badge — "New", "Popular", "Limited". */
  badge?: string;
  /**
   * Rating on a 0-5 scale. Renders as filled stars next to a rating count.
   * Pair with `ratingCount` for "4.8 (2,134 reviews)" context.
   */
  rating?: number;
  /** Review count rendered next to the rating. */
  ratingCount?: number;
  /** Href — whole card becomes a link when set. */
  href?: string;
}

export interface MarketplaceFilter {
  /** Stable ID — doubles as React key. */
  id: string;
  /** Visible label. */
  label: string;
  /** Called when filter is clicked. Consumer tracks active state. */
  onClick: () => void;
  /** Applies active styling (primary background). */
  active?: boolean;
}

export interface MarketplaceGridProps {
  /** Optional section heading. */
  heading?: string;
  /** Optional supporting copy under the heading. */
  description?: string;
  /**
   * Filter chips rendered as a scrollable row above the grid. Skip entirely
   * by omitting; most simple catalogs don't need client-side filtering UI.
   */
  filters?: readonly MarketplaceFilter[];
  /** Grid items. */
  items: readonly MarketplaceItem[];
  /**
   * Column count at `lg:+`. Mobile shows 1, `sm:` shows 2, `lg:` uses this.
   * Defaults to 3.
   */
  columns?: 2 | 3 | 4;
  /**
   * Called when an item is clicked AND has no `href`. If the item has an
   * `href`, the card becomes an anchor and this handler is not called.
   */
  onItemClick?: (item: MarketplaceItem) => void;
  /**
   * Rendered when `items` is empty. Typically an empty-state block. Block
   * renders a bare "No items" message if omitted.
   */
  emptyState?: ReactNode;
  /** Extra classes merged into the outer section. */
  className?: string;
}

/**
 * Product / listing grid for catalog surfaces. Each item shows a 4:3 image
 * tile + title + price + optional badge and rating. Cards lift on hover
 * (subtle scale + shadow shift) as a cheap affordance without needing
 * full motion wrapping per card.
 *
 * Filter chips live in a horizontally-scrollable row above the grid so they
 * don't steal vertical space — category chip UIs on marketplaces are
 * browse-friendly when they scroll sideways rather than wrapping.
 */
export function MarketplaceGrid(props: MarketplaceGridProps) {
  const {
    heading,
    description,
    filters,
    items,
    columns = 3,
    onItemClick,
    emptyState,
    className,
  } = props;

  const stagger = useStaggerPreset(listStagger);

  const hasFilters = filters !== undefined && filters.length > 0;

  const columnClasses = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  }[columns];

  return (
    <section
      className={cn(
        "w-full bg-background py-12 text-foreground md:py-16",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        {(heading !== undefined || description !== undefined) && (
          <div className="mb-8">
            {heading !== undefined && (
              <h2
                className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                {heading}
              </h2>
            )}
            {description !== undefined && (
              <p className="mt-2 text-sm text-muted-foreground md:text-base">
                {description}
              </p>
            )}
          </div>
        )}

        {hasFilters && (
          <div
            className="mb-6 flex gap-2 overflow-x-auto pb-2"
            role="group"
            aria-label="Filters"
          >
            {filters.map((filter) => (
              <FilterChip key={filter.id} filter={filter} />
            ))}
          </div>
        )}

        {items.length === 0 ? (
          emptyState ?? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No items to show.
            </p>
          )
        ) : (
          <motion.ul
            className={cn(
              "grid list-none grid-cols-1 gap-5 p-0",
              columnClasses,
            )}
            initial="initial"
            animate="animate"
            variants={stagger.variants}
          >
            {items.map((item) => (
              <motion.li
                key={item.id}
                variants={stagger.itemVariants}
                className="h-full"
              >
                <MarketplaceCard item={item} onItemClick={onItemClick} />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </section>
  );
}

function FilterChip({ filter }: { filter: MarketplaceFilter }) {
  return (
    <button
      type="button"
      onClick={filter.onClick}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-4 py-1.5 text-sm font-medium outline-none ring-ring transition-colors focus-visible:ring-2",
        filter.active === true
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
      aria-pressed={filter.active === true}
    >
      {filter.label}
    </button>
  );
}

function MarketplaceCard({
  item,
  onItemClick,
}: {
  item: MarketplaceItem;
  onItemClick?: (item: MarketplaceItem) => void;
}) {
  const body = (
    <Card className="group h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {item.imageUrl !== undefined ? (
          <img
            src={item.imageUrl}
            alt={item.imageAlt ?? item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div
            className="h-full w-full bg-gradient-to-br from-muted to-accent"
            aria-hidden
          />
        )}
        {item.badge !== undefined && (
          <div className="absolute left-3 top-3">
            <Badge>{item.badge}</Badge>
          </div>
        )}
      </div>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3
            className="text-sm font-semibold leading-tight text-foreground"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            {item.title}
          </h3>
          {item.price !== undefined && (
            <span className="shrink-0 text-sm font-semibold text-foreground">
              {item.price}
            </span>
          )}
        </div>
        {item.subtitle !== undefined && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {item.subtitle}
          </p>
        )}
        {item.rating !== undefined && (
          <RatingLine rating={item.rating} count={item.ratingCount} />
        )}
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
  if (onItemClick !== undefined) {
    return (
      <button
        type="button"
        onClick={() => onItemClick(item)}
        className="block h-full w-full rounded-lg text-left outline-none ring-ring focus-visible:ring-2"
      >
        {body}
      </button>
    );
  }
  return body;
}

function RatingLine({ rating, count }: { rating: number; count?: number }) {
  const rounded = Math.round(rating * 2) / 2;
  const fullStars = Math.floor(rounded);
  const hasHalf = rounded % 1 !== 0;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < fullStars;
          const half = i === fullStars && hasHalf;
          return (
            <Star
              key={i}
              className={cn(
                "h-3 w-3",
                filled || half
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground",
              )}
            />
          );
        })}
      </div>
      <span>
        {rating.toFixed(1)}
        {count !== undefined && ` (${count.toLocaleString()})`}
      </span>
    </div>
  );
}

export const marketplaceGridMetadata: BlockMetadata = {
  id: "marketplace-grid",
  name: "Marketplace Grid",
  description:
    "Product/listing grid with image, title, price, badge, and rating. Optional filter chips row above. Cards lift on hover.",
  category: "marketplace",
  useCases: [
    "e-commerce catalog",
    "template gallery",
    "app store grid",
    "marketplace listings",
  ],
  supportedPersonas: "all",
  motionPresets: ["listStagger"],
  tags: ["grid", "catalog", "ecommerce", "marketplace", "products"],
  available: true,
};

MarketplaceGrid.displayName = "MarketplaceGrid";
