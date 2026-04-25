import { ReactNode, useState } from "react";

export type Frequency = "monthly" | "annual";

export interface Plan {
  /** Unique plan identifier (e.g. "free", "pro", "creator"). */
  id: string;
  /** Display name (e.g. "Pro"). */
  name: string;
  /** Monthly price in user's currency. Set to 0 for free tier. */
  price: number;
  /** Annual price (total per year). If omitted, calculated as price × 12. */
  annualPrice?: number;
  /** Currency symbol (default: "$"). */
  currency?: string;
  /** Short description shown below the plan name. */
  description?: string;
  /** List of feature strings. Prefix with "✗ " for excluded features. */
  features: string[];
  /** Highlight this plan as the recommended option. */
  featured?: boolean;
  /** Label shown on the featured badge (default: "Most Popular"). */
  badge?: string;
}

interface PaywallScreenProps {
  /** App name shown in the header. */
  appName?: string;
  /** Tagline shown below the header. */
  tagline?: string;
  /** Logo element (icon, image, or emoji) shown at the top. */
  logo?: ReactNode;
  /** List of plans to display. */
  plans: Plan[];
  /** Current user's active plan ID (highlights the active plan). */
  currentPlanId?: string;
  /** Called when the user taps Subscribe on a plan. */
  onSubscribe?: (planId: string, frequency: Frequency) => void | Promise<void>;
  /** Called when the user taps Restore Purchases. */
  onRestore?: () => void | Promise<void>;
  /** Show a loading spinner on the subscribe button. */
  loading?: boolean;
  /** External error message to display. */
  error?: string;
  /** Hide the frequency toggle (e.g. if only monthly is available). */
  hideFrequencyToggle?: boolean;
  /** Additional content rendered below the plans. */
  footer?: ReactNode;
}

/**
 * Full-screen paywall / pricing component with iOS-style mobile-native
 * design. Supports monthly/annual toggle, multiple plan tiers, feature
 * comparison, and restore purchases.
 *
 * Usage:
 * ```tsx
 * <PaywallScreen
 *   appName="My App"
 *   tagline="Unlock all features"
 *   logo={<span className="text-4xl">⭐</span>}
 *   plans={[
 *     { id: "free", name: "Free", price: 0, features: ["5 items", "Basic themes"] },
 *     { id: "pro", name: "Pro", price: 9.99, featured: true, features: ["Unlimited items", "All themes", "Cloud sync", "Priority support"] },
 *   ]}
 *   currentPlanId="free"
 *   onSubscribe={(planId, frequency) => { ... }}
 *   onRestore={() => { ... }}
 * />
 * ```
 */
export function PaywallScreen({
  appName = "Upgrade",
  tagline,
  logo,
  plans,
  currentPlanId,
  onSubscribe,
  onRestore,
  loading = false,
  error,
  hideFrequencyToggle = false,
  footer,
}: PaywallScreenProps) {
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const showToggle = !hideFrequencyToggle && plans.some((p) => p.price > 0);

  const getPrice = (plan: Plan): number => {
    if (plan.price === 0) return 0;
    if (frequency === "annual") {
      return plan.annualPrice
        ? Math.round((plan.annualPrice / 12) * 100) / 100
        : plan.price;
    }
    return plan.price;
  };

  const getAnnualTotal = (plan: Plan): number => {
    return plan.annualPrice ?? plan.price * 12;
  };

  const getSavingsPercent = (plan: Plan): number => {
    if (!plan.annualPrice || plan.price === 0) return 0;
    const monthlyTotal = plan.price * 12;
    return Math.round(((monthlyTotal - plan.annualPrice) / monthlyTotal) * 100);
  };

  const handleSubscribe = async (planId: string) => {
    setSelectedPlanId(planId);
    await onSubscribe?.(planId, frequency);
    setSelectedPlanId(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950 px-6 pt-16 pb-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-8">
        {logo && (
          <div className="w-20 h-20 rounded-3xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-5">
            {logo}
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {appName}
        </h1>
        {tagline && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-xs leading-relaxed">
            {tagline}
          </p>
        )}
      </div>

      {/* Frequency Toggle */}
      {showToggle && (
        <div className="mb-6">
          <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <button
              type="button"
              onClick={() => setFrequency("monthly")}
              className={[
                "flex-1 h-9 rounded-lg text-sm font-semibold flex items-center justify-center",
                "transition-all duration-200",
                frequency === "monthly"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 active:scale-[0.97]",
              ].join(" ")}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setFrequency("annual")}
              className={[
                "flex-1 h-9 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5",
                "transition-all duration-200",
                frequency === "annual"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 active:scale-[0.97]",
              ].join(" ")}
            >
              Annual
              {plans.some((p) => getSavingsPercent(p) > 0) && (
                <span className="text-xs px-1.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 font-bold">
                  Save
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10">
          <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
        </div>
      )}

      {/* Plan Cards */}
      <div className="flex flex-col gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isFeatured = plan.featured && !isCurrent;
          const isFree = plan.price === 0;
          const price = getPrice(plan);
          const currency = plan.currency ?? "$";
          const savings = getSavingsPercent(plan);
          const isSubscribing = loading && selectedPlanId === plan.id;

          return (
            <div
              key={plan.id}
              className={[
                "relative rounded-2xl p-4",
                "bg-white dark:bg-gray-900",
                "shadow-sm shadow-gray-900/5 dark:shadow-black/40",
                isFeatured
                  ? "ring-2 ring-indigo-500"
                  : isCurrent
                  ? "ring-2 ring-green-500"
                  : "ring-1 ring-gray-200/70 dark:ring-gray-800/70",
              ].join(" ")}
            >
              {/* Featured / Current Badge */}
              {(isFeatured || isCurrent) && (
                <div
                  className={[
                    "absolute -top-3 left-1/2 -translate-x-1/2",
                    "px-3 py-0.5 rounded-full text-xs font-bold",
                    isCurrent
                      ? "bg-green-500 text-white"
                      : "bg-indigo-500 text-white",
                  ].join(" ")}
                >
                  {isCurrent ? "Current Plan" : plan.badge ?? "Most Popular"}
                </div>
              )}

              {/* Plan Header */}
              <div className="flex items-baseline justify-between mt-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {plan.name}
                </h3>
                <div className="text-right">
                  {isFree ? (
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">Free</span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {currency}{price.toFixed(2)}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Annual billing note */}
              {!isFree && frequency === "annual" && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-right mt-0.5">
                  {currency}{getAnnualTotal(plan).toFixed(2)}/year
                  {savings > 0 && (
                    <span className="ml-1.5 text-green-600 dark:text-green-400 font-semibold">
                      Save {savings}%
                    </span>
                  )}
                </p>
              )}

              {/* Description */}
              {plan.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {plan.description}
                </p>
              )}

              {/* Features */}
              <ul className="mt-3 space-y-2">
                {plan.features.map((feature, i) => {
                  const isExcluded = feature.startsWith("✗ ");
                  const text = isExcluded ? feature.slice(2) : feature;
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      {isExcluded ? (
                        <XCircleIcon className="w-5 h-5 mt-0.5 text-gray-300 dark:text-gray-600 shrink-0" />
                      ) : (
                        <CheckCircleIcon className="w-5 h-5 mt-0.5 text-green-500 dark:text-green-400 shrink-0" />
                      )}
                      <span
                        className={[
                          "text-sm leading-snug",
                          isExcluded
                            ? "text-gray-400 dark:text-gray-500 line-through"
                            : "text-gray-700 dark:text-gray-300",
                        ].join(" ")}
                      >
                        {text}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {/* Subscribe Button */}
              <button
                type="button"
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading || isCurrent}
                className={[
                  "w-full h-12 mt-4 rounded-xl text-base font-semibold",
                  "inline-flex items-center justify-center gap-2",
                  "transition-all duration-150 active:scale-[0.97]",
                  "disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed",
                  isCurrent
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    : isFeatured
                    ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                    : isFree
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
                    : "bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-500/30",
                ].join(" ")}
              >
                {isSubscribing ? (
                  <Spinner />
                ) : isCurrent ? (
                  "Current Plan"
                ) : isFree ? (
                  "Get Started"
                ) : (
                  "Subscribe"
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Restore Purchases */}
      {onRestore && (
        <button
          type="button"
          onClick={onRestore}
          disabled={loading}
          className={[
            "mt-6 mx-auto text-sm font-medium",
            "text-indigo-500 hover:underline",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          Restore Purchases
        </button>
      )}

      {/* Footer */}
      {footer && <div className="mt-auto pt-8">{footer}</div>}
    </div>
  );
}

/* ─── Inline SVG assets ─────────────────────────────────────────────── */

function CheckCircleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XCircleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
