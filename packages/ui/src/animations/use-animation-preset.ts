import { useReducedMotion } from "motion/react";
import type { Transition, Variants } from "motion/react";

import type { AnimationPreset, StaggerAnimationPreset } from "./types";

export interface ResolvedPreset {
  variants: Variants;
  transition: Transition;
}

export interface ResolvedStaggerPreset extends ResolvedPreset {
  itemVariants: Variants;
}

export function useAnimationPreset(preset: AnimationPreset): ResolvedPreset {
  // useReducedMotion returns `boolean | null`; null means "not yet known"
  // (pre-hydration), so treat it as "don't reduce" rather than "do reduce".
  const shouldReduce = useReducedMotion() === true;
  return {
    variants: shouldReduce ? preset.reducedVariants : preset.variants,
    transition: shouldReduce ? preset.reducedTransition : preset.transition,
  };
}

export function useStaggerPreset(
  preset: StaggerAnimationPreset,
): ResolvedStaggerPreset {
  const shouldReduce = useReducedMotion() === true;
  return {
    variants: shouldReduce ? preset.reducedVariants : preset.variants,
    transition: shouldReduce ? preset.reducedTransition : preset.transition,
    itemVariants: shouldReduce
      ? preset.reducedItemVariants
      : preset.itemVariants,
  };
}
