import { ReactNode } from "react";

interface Tab<T extends string> {
  value: T;
  label: string;
  icon: ReactNode;
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Bottom tab bar for top-level navigation. 3-5 tabs only. Place INSIDE
 * <Screen> as a sibling of the main content. Add `pb-24` to the scrollable
 * content so the last item isn't hidden.
 */
export function TabBar<T extends string>({ tabs, value, onChange }: TabBarProps<T>) {
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-20 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border-t border-gray-200/60 dark:border-gray-800/60">
      <div className="flex pb-6 pt-2">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className="flex-1 flex flex-col items-center gap-1 py-1 transition-all duration-150 active:scale-95"
            >
              <div
                className={
                  active
                    ? "text-indigo-500"
                    : "text-gray-400 dark:text-gray-500"
                }
              >
                {tab.icon}
              </div>
              <span
                className={[
                  "text-xs font-medium",
                  active
                    ? "text-indigo-500"
                    : "text-gray-400 dark:text-gray-500",
                ].join(" ")}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
