import { ReactNode } from "react";

interface EmptyStateProps {
  /** Optional icon shown in a soft circle above the title. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional CTA button or link. */
  action?: ReactNode;
}

/**
 * Centered empty state for screens with no content. Always include
 * an icon, a friendly title, and a helpful description.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-16">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
