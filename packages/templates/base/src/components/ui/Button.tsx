import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** Element rendered before the children (typically an icon). */
  leading?: ReactNode;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-500/30",
  secondary:
    "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700",
  ghost:
    "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
  danger:
    "bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/30",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-4 text-base rounded-xl",
  lg: "h-13 px-5 text-base rounded-2xl",
};

/**
 * Touch-friendly button with iOS-style spring feedback. Use `variant` for
 * intent and `fullWidth` when it should fill the parent (e.g. inside a
 * BottomSheet form).
 */
export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  leading,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 font-semibold",
        "transition-all duration-150 active:scale-[0.97]",
        "disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {leading}
      {children}
    </button>
  );
}
