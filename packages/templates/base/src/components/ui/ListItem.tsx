import { ReactNode } from "react";

interface ListItemProps {
  /** Element rendered on the left (typically an icon or avatar). */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Element rendered on the right (e.g. a switch, badge, or text). */
  trailing?: ReactNode;
  onClick?: () => void;
  /** Show a navigation chevron on the right (drill-in pattern). */
  showChevron?: boolean;
}

/**
 * iOS-style list row with optional leading icon, title/subtitle stack,
 * trailing widget, and chevron. Designed to live inside a Card.
 */
export function ListItem({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  showChevron,
}: ListItemProps) {
  const content = (
    <>
      {leading && <div className="flex-shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 dark:text-white truncate">
          {title}
        </div>
        {subtitle && (
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
      {showChevron && (
        <svg
          className="w-5 h-5 text-gray-400 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 active:scale-[0.99] active:bg-gray-50 dark:active:bg-gray-800/50"
      >
        {content}
      </button>
    );
  }
  return <div className="flex items-center gap-3 px-4 py-3">{content}</div>;
}
