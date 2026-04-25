"use client";

import { Smartphone, Tablet, Monitor } from "lucide-react";
import { cn } from "@appio/ui";

type Viewport = "mobile" | "tablet" | "desktop";

const VIEWPORTS: { key: Viewport; icon: typeof Smartphone; label: string }[] = [
  { key: "mobile", icon: Smartphone, label: "Mobile" },
  { key: "tablet", icon: Tablet, label: "Tablet" },
  { key: "desktop", icon: Monitor, label: "Desktop" },
];

interface ViewportSelectorProps {
  value: Viewport;
  onChange: (viewport: Viewport) => void;
}

export function ViewportSelector({ value, onChange }: ViewportSelectorProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {VIEWPORTS.map((vp) => (
        <button
          key={vp.key}
          onClick={() => onChange(vp.key)}
          title={vp.label}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === vp.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <vp.icon className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{vp.label}</span>
        </button>
      ))}
    </div>
  );
}
