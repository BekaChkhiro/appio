"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@appio/ui";

interface ResizableDividerProps {
  onResize: (delta: number) => void;
}

/**
 * Pointer-driven splitter. Drag state lives on `window` so the cursor
 * doesn't have to stay over the 6px divider the whole time — without this,
 * fast drags drop because the pointer leaves the element's hit box.
 */
export function ResizableDivider({ onResize }: ResizableDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const lastX = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    lastX.current = e.clientX;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (e: PointerEvent) => {
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      if (delta !== 0) onResize(delta);
    };

    const onUp = () => setIsDragging(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, onResize]);

  return (
    <div
      onPointerDown={handlePointerDown}
      role="separator"
      aria-orientation="vertical"
      className={cn(
        "group relative hidden w-1.5 cursor-col-resize items-center justify-center md:flex",
        "hover:bg-primary/10",
        "transition-colors",
        isDragging && "bg-primary/20"
      )}
    >
      <GripVertical
        className={cn(
          "h-4 w-4 transition-colors",
          isDragging
            ? "text-primary"
            : "text-muted-foreground/30 group-hover:text-muted-foreground"
        )}
      />
    </div>
  );
}
