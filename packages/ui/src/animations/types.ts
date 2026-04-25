import type { Transition, Variants } from "motion/react";

export type AnimationPresetName =
  | "pageTransition"
  | "listStagger"
  | "cardReveal"
  | "gestureSwipe"
  | "modalSpring"
  | "fabExpand"
  | "toastSlide"
  | "pullToRefresh"
  | "tabSlide"
  | "skeletonShimmer";

export interface AnimationPreset {
  readonly name: AnimationPresetName;
  readonly description: string;
  readonly variants: Variants;
  readonly transition: Transition;
  readonly reducedVariants: Variants;
  readonly reducedTransition: Transition;
}

export interface StaggerAnimationPreset extends AnimationPreset {
  readonly name: "listStagger";
  readonly itemVariants: Variants;
  readonly reducedItemVariants: Variants;
}
