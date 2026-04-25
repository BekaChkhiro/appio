import { ReactNode } from "react";

interface FABProps {
  onClick: () => void;
  children: ReactNode;
  /** Accessible label (e.g. "Add task"). */
  label?: string;
  /** Vertical offset from the bottom — increase if there is a tab bar. */
  bottom?: "default" | "tabBar";
}

/**
 * Floating action button. Sits on top of the content in the bottom-right
 * corner inside a Screen. Use `bottom="tabBar"` when there is a TabBar so
 * the FAB clears it.
 */
export function FAB({ onClick, children, label, bottom = "default" }: FABProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        "absolute right-5 z-20 w-14 h-14 rounded-full",
        "bg-indigo-500 hover:bg-indigo-600 text-white",
        "shadow-xl shadow-indigo-500/40",
        "flex items-center justify-center",
        "transition-all duration-150 active:scale-90",
        bottom === "tabBar" ? "bottom-24" : "bottom-6",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
