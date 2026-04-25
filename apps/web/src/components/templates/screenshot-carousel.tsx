"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@appio/ui";

interface ScreenshotCarouselProps {
  screenshots: string[];
  alt: string;
}

export function ScreenshotCarousel({
  screenshots,
  alt,
}: ScreenshotCarouselProps) {
  const [current, setCurrent] = useState(0);

  const prev = useCallback(() => {
    setCurrent((i) => (i === 0 ? screenshots.length - 1 : i - 1));
  }, [screenshots.length]);

  const next = useCallback(() => {
    setCurrent((i) => (i === screenshots.length - 1 ? 0 : i + 1));
  }, [screenshots.length]);

  if (screenshots.length === 0) return null;

  return (
    <div className="group/carousel relative mt-3 overflow-hidden rounded-lg bg-muted/50">
      {/* Image */}
      <div className="relative aspect-[9/16] w-full max-h-[180px] sm:max-h-[220px]">
        <Image
          src={screenshots[current]}
          alt={`${alt} — screenshot ${current + 1}`}
          fill
          className="object-contain"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          loading="lazy"
        />
      </div>

      {/* Navigation arrows (show on hover when multiple) */}
      {screenshots.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              prev();
            }}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover/carousel:opacity-100"
            aria-label="Previous screenshot"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              next();
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover/carousel:opacity-100"
            aria-label="Next screenshot"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {screenshots.length > 1 && (
        <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
          {screenshots.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrent(i);
              }}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === current
                  ? "w-3 bg-primary"
                  : "w-1.5 bg-foreground/30"
              )}
              aria-label={`Go to screenshot ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
