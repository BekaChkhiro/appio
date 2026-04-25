interface Segment<T extends string> {
  value: T;
  label: string;
  badge?: number;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * iOS-style segmented control for 2-4 mutually exclusive options.
 * Use instead of dropdowns or radio buttons for filters.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
      {segments.map((seg) => {
        const active = seg.value === value;
        return (
          <button
            key={seg.value}
            type="button"
            onClick={() => onChange(seg.value)}
            className={[
              "flex-1 h-9 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5",
              "transition-all duration-200",
              active
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 active:scale-[0.97]",
            ].join(" ")}
          >
            {seg.label}
            {seg.badge !== undefined && seg.badge > 0 && (
              <span
                className={[
                  "text-xs px-1.5 min-w-5 text-center rounded-full font-bold",
                  active
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200",
                ].join(" ")}
              >
                {seg.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
