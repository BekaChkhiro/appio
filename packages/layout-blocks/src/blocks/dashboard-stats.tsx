import type { ReactNode } from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Card,
  CardContent,
  listStagger,
  useStaggerPreset,
} from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";

export type StatTrend = "up" | "down" | "flat";

export interface DashboardStatItem {
  /** Short metric label — "Revenue", "Active users", "Churn". */
  label: string;
  /**
   * Primary value. Pass pre-formatted strings ("$12,340", "1,284 users") so
   * the block doesn't own i18n/number-format concerns.
   */
  value: string | number;
  /**
   * Secondary delta string — "+12% vs last week", "-3 pts MoM". Block
   * prepends the trend icon automatically; include the number + context in
   * the string itself.
   */
  delta?: string;
  /**
   * Trend direction drives the delta's color + icon. Omit when `delta` is
   * absent. For metrics where "down is good" (e.g. churn ↓ is positive),
   * set `invertTrend: true` — the block keeps "down" as the direction but
   * colors it like a positive.
   */
  trend?: StatTrend;
  /**
   * Inverts the color semantics of `trend`. Use for metrics where lower is
   * better (churn, error rate, latency). Default `false`.
   */
  invertTrend?: boolean;
  /** Optional leading icon (typically 20-24px). */
  icon?: ReactNode;
  /** Optional href — whole card becomes a link when set. */
  href?: string;
}

export interface DashboardStatsProps {
  /** Optional section heading rendered above the grid. */
  heading?: string;
  /** Optional supporting copy under the heading. */
  description?: string;
  /** Stat items. Recommended: 2, 3, or 4 for clean rows. */
  items: readonly DashboardStatItem[];
  /**
   * Column count at `md:+`. Mobile always shows one column. Defaults to the
   * item count clamped between 2 and 4.
   */
  columns?: 2 | 3 | 4;
  /** Extra classes merged into the outer section. */
  className?: string;
}

/**
 * Dashboard KPI row. Each card shows a label + prominent value + optional
 * delta-with-trend indicator. Trend colors use universal semantics (green =
 * positive, red = negative, muted = flat) rather than persona tokens —
 * users expect traffic-light colors on dashboards regardless of brand.
 *
 * Cards stagger in on mount (listStagger) so a 4-up row doesn't pop as a
 * slab. For live-updating metrics, give each card a stable `key` via the
 * `label` field and React will reuse it across renders.
 */
export function DashboardStats(props: DashboardStatsProps) {
  const { heading, description, items, columns, className } = props;

  const stagger = useStaggerPreset(listStagger);

  const resolvedColumns = columns ?? clampColumns(items.length);
  const columnClasses = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[resolvedColumns];

  return (
    <section
      className={cn(
        "w-full bg-background py-10 text-foreground md:py-14",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        {(heading !== undefined || description !== undefined) && (
          <div className="mb-8">
            {heading !== undefined && (
              <h2
                className="text-xl font-semibold tracking-tight text-foreground md:text-2xl"
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

        <motion.ul
          className={cn(
            "grid list-none grid-cols-1 gap-4 p-0",
            columnClasses,
          )}
          initial="initial"
          animate="animate"
          variants={stagger.variants}
        >
          {items.map((item, index) => (
            <motion.li
              key={`${item.label}-${index}`}
              variants={stagger.itemVariants}
              className="h-full"
            >
              <StatCard item={item} />
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

function StatCard({ item }: { item: DashboardStatItem }) {
  const body = (
    <Card className="h-full transition-colors hover:bg-accent/40">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {item.label}
          </span>
          {item.icon !== undefined && (
            <span className="text-muted-foreground" aria-hidden>
              {item.icon}
            </span>
          )}
        </div>
        <div
          className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
          style={{ fontFamily: "var(--font-heading, inherit)" }}
        >
          {item.value}
        </div>
        {item.delta !== undefined && (
          <TrendDelta
            delta={item.delta}
            trend={item.trend ?? "flat"}
            invertTrend={item.invertTrend === true}
          />
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
  return body;
}

function TrendDelta({
  delta,
  trend,
  invertTrend,
}: {
  delta: string;
  trend: StatTrend;
  invertTrend: boolean;
}) {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const isPositive =
    (trend === "up" && !invertTrend) || (trend === "down" && invertTrend);
  const isNegative =
    (trend === "down" && !invertTrend) || (trend === "up" && invertTrend);

  const colorClass = isPositive
    ? "text-green-600 dark:text-green-400"
    : isNegative
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", colorClass)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{delta}</span>
    </div>
  );
}

function clampColumns(count: number): 2 | 3 | 4 {
  if (count >= 4) return 4;
  if (count === 3) return 3;
  return 2;
}

export const dashboardStatsMetadata: BlockMetadata = {
  id: "dashboard-stats",
  name: "Dashboard Stats",
  description:
    "Row of KPI stat cards — label + value + optional trend delta. Universal green/red trend colors regardless of persona.",
  category: "dashboard",
  useCases: [
    "admin dashboard overview",
    "analytics homepage KPIs",
    "metrics summary row",
    "app usage statistics",
  ],
  supportedPersonas: "all",
  motionPresets: ["listStagger"],
  tags: ["dashboard", "metrics", "kpi", "analytics", "stats"],
  available: true,
};

DashboardStats.displayName = "DashboardStats";
