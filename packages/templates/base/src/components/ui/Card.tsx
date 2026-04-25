import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** When provided, the card becomes a button with active-press feedback. */
  onClick?: () => void;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

/**
 * Rounded card surface with a soft shadow + subtle ring border. Use for
 * grouped content. Pass `onClick` to make the whole card tappable.
 */
export function Card({
  children,
  className = "",
  onClick,
  padding = "md",
}: CardProps) {
  const base = [
    "block w-full text-left",
    "bg-white dark:bg-gray-900",
    "rounded-2xl",
    "shadow-sm shadow-gray-900/5 dark:shadow-black/40",
    "ring-1 ring-gray-200/70 dark:ring-gray-800/70",
    paddingClasses[padding],
    className,
  ];

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          ...base,
          "transition-all duration-150 active:scale-[0.99] hover:shadow-md",
        ].join(" ")}
      >
        {children}
      </button>
    );
  }
  return <div className={base.join(" ")}>{children}</div>;
}
