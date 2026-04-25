import type { Transition, Variants } from "motion/react";

import type { AnimationPreset, StaggerAnimationPreset } from "./types";

const EASE_STANDARD: Transition["ease"] = [0.4, 0.0, 0.2, 1];
const EASE_OUT: Transition["ease"] = [0.0, 0.0, 0.2, 1];
// Material 3 "emphasized" easing — intentional no-acceleration start,
// long deceleration. Looks like ease-out but with a firmer anchor at t=0.
const EASE_EMPHASIZED: Transition["ease"] = [0.2, 0.0, 0.0, 1];

const INSTANT: Transition = { duration: 0.01 };
const FADE_ONLY_FAST: Transition = { duration: 0.12, ease: EASE_STANDARD };

const fadeOnlyVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const identityVariants: Variants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 1 },
};

export const pageTransition: AnimationPreset = {
  name: "pageTransition",
  description: "Cross-fade with subtle scale for route changes.",
  variants: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
  transition: { duration: 0.24, ease: EASE_STANDARD },
  reducedVariants: fadeOnlyVariants,
  reducedTransition: FADE_ONLY_FAST,
};

export const listStagger: StaggerAnimationPreset = {
  name: "listStagger",
  description:
    "Container that staggers children on reveal. Apply `variants` to the parent; " +
    "do NOT spread `transition` onto the parent element — stagger orchestration " +
    "is already carried inside the `animate` variant.",
  variants: {
    initial: {},
    animate: {
      transition: { staggerChildren: 0.04, delayChildren: 0.02 },
    },
    exit: {
      transition: { staggerChildren: 0.02, staggerDirection: -1 },
    },
  },
  transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  itemVariants: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
    exit: { opacity: 0, y: -4, transition: { duration: 0.14, ease: EASE_STANDARD } },
  },
  reducedVariants: {
    initial: {},
    animate: {},
    exit: {},
  },
  reducedTransition: INSTANT,
  reducedItemVariants: fadeOnlyVariants,
};

export const cardReveal: AnimationPreset = {
  name: "cardReveal",
  description: "Card slides up with fade — used when preview/result is ready.",
  variants: {
    initial: { opacity: 0, y: 12, scale: 0.99 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.99 },
  },
  transition: { duration: 0.28, ease: EASE_EMPHASIZED },
  reducedVariants: fadeOnlyVariants,
  reducedTransition: FADE_ONLY_FAST,
};

export const gestureSwipe: AnimationPreset = {
  name: "gestureSwipe",
  description: "Horizontal swipe (e.g. swipe-to-delete) with rubber-band exit.",
  variants: {
    initial: { x: 0, opacity: 1 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -120, opacity: 0 },
  },
  transition: { type: "spring", stiffness: 420, damping: 34, mass: 0.6 },
  reducedVariants: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  reducedTransition: FADE_ONLY_FAST,
};

export const modalSpring: AnimationPreset = {
  name: "modalSpring",
  description: "Modal / dialog open with gentle spring, slight lift.",
  variants: {
    initial: { opacity: 0, y: 16, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 8, scale: 0.98 },
  },
  transition: { type: "spring", stiffness: 380, damping: 30, mass: 0.8 },
  reducedVariants: fadeOnlyVariants,
  reducedTransition: FADE_ONLY_FAST,
};

export const fabExpand: AnimationPreset = {
  name: "fabExpand",
  description: "FAB scales out from a point, for pressed-state expansion.",
  variants: {
    initial: { opacity: 0, scale: 0.6 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.7 },
  },
  transition: { type: "spring", stiffness: 500, damping: 32, mass: 0.7 },
  reducedVariants: fadeOnlyVariants,
  reducedTransition: FADE_ONLY_FAST,
};

export const toastSlide: AnimationPreset = {
  name: "toastSlide",
  description: "Toast slides in from the right with a small lift.",
  variants: {
    initial: { opacity: 0, x: 48, y: -4 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: 48, y: -4 },
  },
  transition: { duration: 0.22, ease: EASE_EMPHASIZED },
  reducedVariants: fadeOnlyVariants,
  reducedTransition: FADE_ONLY_FAST,
};

export const pullToRefresh: AnimationPreset = {
  name: "pullToRefresh",
  description: "Spring-physics snapback for pull-to-refresh indicators.",
  variants: {
    initial: { y: -40, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -40, opacity: 0 },
  },
  transition: { type: "spring", stiffness: 320, damping: 26, mass: 1 },
  reducedVariants: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  reducedTransition: FADE_ONLY_FAST,
};

export const tabSlide: AnimationPreset = {
  name: "tabSlide",
  description: "Tween for a sliding tab indicator; pair with Motion layoutId.",
  variants: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  transition: { type: "spring", stiffness: 500, damping: 34 },
  reducedVariants: identityVariants,
  reducedTransition: INSTANT,
};

export const skeletonShimmer: AnimationPreset = {
  name: "skeletonShimmer",
  description:
    "Shimmer placeholder. PREFER the CSS class `.animate-skeleton-shimmer` " +
    "(import `@appio/ui/animations/skeleton-shimmer.css`) — it's cheaper and " +
    "handles prefers-reduced-motion via @media. This Motion variant only " +
    "animates `backgroundPositionX`; callers MUST also set a linear-gradient " +
    "`backgroundImage` and a large `backgroundSize` (e.g. 200% 100%) for the " +
    "shimmer to be visible.",
  variants: {
    initial: { backgroundPositionX: "100%" },
    animate: { backgroundPositionX: "-100%" },
    exit: { backgroundPositionX: "100%" },
  },
  transition: {
    duration: 1.4,
    ease: "linear",
    repeat: Infinity,
  },
  reducedVariants: identityVariants,
  reducedTransition: INSTANT,
};

export const animationPresets = {
  pageTransition,
  listStagger,
  cardReveal,
  gestureSwipe,
  modalSpring,
  fabExpand,
  toastSlide,
  pullToRefresh,
  tabSlide,
  skeletonShimmer,
} as const;

export type AnimationPresetsMap = typeof animationPresets;
