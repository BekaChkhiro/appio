"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { cn } from "@appio/ui";

interface CategoryPillsProps {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryPills({
  categories,
  selected,
  onSelect,
}: CategoryPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const all = [null, ...categories];

  return (
    <div
      ref={scrollRef}
      role="tablist"
      aria-label="Filter by category"
      className="no-scrollbar flex gap-2 overflow-x-auto px-6 py-3"
    >
      {all.map((cat) => {
        const isActive = cat === selected;
        const label = cat ?? "All";
        return (
          <button
            key={label}
            role="tab"
            aria-selected={isActive}
            aria-label={`Filter by ${label}`}
            onClick={() => onSelect(cat)}
            className={cn(
              "relative shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="category-pill-active"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
