import { ReactNode } from "react";

interface AppBarProps {
  title: string;
  subtitle?: string;
  /** Element rendered to the left of the title (e.g. a back button or icon). */
  leading?: ReactNode;
  /** Element rendered to the right of the title (e.g. action icons). */
  trailing?: ReactNode;
  /** Use a smaller compact title instead of the default iOS large title. */
  compact?: boolean;
}

/**
 * Sticky top bar with iOS-style large title and translucent backdrop blur.
 * Place this as the FIRST child of <Screen>.
 */
export function AppBar({
  title,
  subtitle,
  leading,
  trailing,
  compact = false,
}: AppBarProps) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/75 dark:bg-gray-950/75 border-b border-gray-200/60 dark:border-gray-800/60">
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        {leading && <div className="-ml-2 flex items-center">{leading}</div>}
        <div className="flex-1 min-w-0">
          <h1
            className={
              compact
                ? "text-lg font-semibold text-gray-900 dark:text-white truncate"
                : "text-3xl font-bold tracking-tight text-gray-900 dark:text-white truncate"
            }
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
        {trailing && (
          <div className="-mr-2 flex items-center gap-1">{trailing}</div>
        )}
      </div>
    </header>
  );
}
