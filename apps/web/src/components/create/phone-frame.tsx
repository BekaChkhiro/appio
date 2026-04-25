"use client";

import type { ReactNode } from "react";
import { cn } from "@appio/ui";

/**
 * Realistic iPhone 15 Pro chrome. Dimensions match CSS pixel space
 * (393 × 852) so the embedded app renders exactly as it would on a real
 * phone. All decorative elements (Dynamic Island, buttons, home
 * indicator) scale with the `scale` prop so the frame stays coherent at
 * any editor size.
 *
 * Visual references:
 *   — Titanium frame: warm neutral gradient, subtle highlight on top edge
 *   — Side buttons: mute switch + volume up/down on left, power on right
 *   — Dynamic Island: 120×34 pill floating 11px below the top bezel
 *   — Home indicator: 134×5 rounded bar 8px above the bottom bezel
 */

// Real iPhone 15 Pro CSS-pixel dimensions.
export const PHONE_WIDTH = 393;
export const PHONE_HEIGHT = 852;

interface PhoneFrameProps {
  children: ReactNode;
  scale: number;
  /**
   * When true, shows the home-indicator bar over the content. Default
   * true — turn off if the embedded app draws its own home indicator.
   */
  showHomeIndicator?: boolean;
}

export function PhoneFrame({
  children,
  scale,
  showHomeIndicator = true,
}: PhoneFrameProps) {
  // Screen inset — real iPhone has ~8-10px bezel on all sides.
  const BEZEL = 10;

  // Outer frame dimensions include the bezel.
  const outerW = (PHONE_WIDTH + BEZEL * 2) * scale;
  const outerH = (PHONE_HEIGHT + BEZEL * 2) * scale;

  // Side-button offsets + sizes (CSS pixels, un-scaled).
  // Y offsets measured from the top edge of the phone.
  const muteSwitchY = 100;
  const volumeUpY = 155;
  const volumeDownY = 215;
  const powerY = 175;

  return (
    <div
      className={cn(
        "relative transition-[width,height] duration-200",
        // Titanium frame — warm neutral gradient with subtle highlight
        "bg-gradient-to-b from-neutral-700 via-neutral-900 to-neutral-800",
        "dark:from-neutral-600 dark:via-neutral-800 dark:to-neutral-900",
        // Large outer rounding mimics the unified-frame look of iPhone 15 Pro
        "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)_inset]",
      )}
      style={{
        width: outerW,
        height: outerH,
        borderRadius: 60 * scale,
        padding: BEZEL * scale,
      }}
    >
      {/* Top highlight — faint reflection line across the top bezel */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[15%] right-[15%] top-0 h-[1px] rounded-full bg-white/10"
        style={{ top: 2 * scale }}
      />

      {/* Mute switch (left) */}
      <div
        aria-hidden
        className="absolute -left-[3px] rounded-l-sm bg-neutral-900 dark:bg-neutral-950"
        style={{
          top: muteSwitchY * scale,
          width: 3 * scale,
          height: 28 * scale,
        }}
      />

      {/* Volume up (left) */}
      <div
        aria-hidden
        className="absolute -left-[3px] rounded-l-sm bg-neutral-900 dark:bg-neutral-950"
        style={{
          top: volumeUpY * scale,
          width: 3 * scale,
          height: 45 * scale,
        }}
      />

      {/* Volume down (left) */}
      <div
        aria-hidden
        className="absolute -left-[3px] rounded-l-sm bg-neutral-900 dark:bg-neutral-950"
        style={{
          top: volumeDownY * scale,
          width: 3 * scale,
          height: 45 * scale,
        }}
      />

      {/* Power button (right) */}
      <div
        aria-hidden
        className="absolute -right-[3px] rounded-r-sm bg-neutral-900 dark:bg-neutral-950"
        style={{
          top: powerY * scale,
          width: 3 * scale,
          height: 70 * scale,
        }}
      />

      {/* Screen — inner bezel holds the iframe */}
      <div
        className="relative h-full w-full overflow-hidden bg-black"
        style={{
          borderRadius: 50 * scale,
          // Soft inner shadow for screen depth
          boxShadow: `inset 0 0 ${4 * scale}px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Content layer */}
        <div className="absolute inset-0 overflow-hidden">
          {children}
        </div>

        {/* Dynamic Island — floats above content */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 bg-black"
          style={{
            top: 11 * scale,
            width: 120 * scale,
            height: 34 * scale,
            borderRadius: 20 * scale,
            boxShadow: `0 0 0 ${0.5 * scale}px rgba(255,255,255,0.03)`,
          }}
        >
          {/* Tiny camera lens dot inside the island */}
          <div
            className="absolute right-[18%] top-1/2 -translate-y-1/2 rounded-full bg-neutral-800"
            style={{
              width: 8 * scale,
              height: 8 * scale,
            }}
          >
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-600"
              style={{ width: 3 * scale, height: 3 * scale }}
            />
          </div>
        </div>

        {/* Home indicator — only when requested */}
        {showHomeIndicator && (
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-1/2 bg-white/30"
            style={{
              bottom: 8 * scale,
              width: 134 * scale,
              height: 5 * scale,
              borderRadius: 4 * scale,
            }}
          />
        )}
      </div>
    </div>
  );
}
