import { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Visual variant — `solid` adds a soft background, `ghost` is transparent. */
  variant?: "solid" | "ghost";
}

/**
 * 44×44 icon-only button — meets minimum touch target size for mobile.
 * Use in AppBar trailing/leading slots and anywhere a single icon press
 * action is needed.
 */
export function IconButton({
  children,
  variant = "ghost",
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={[
        "w-11 h-11 rounded-full flex items-center justify-center",
        "transition-all duration-150 active:scale-90",
        variant === "ghost"
          ? "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
