import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  pageTransition,
  useAnimationPreset,
} from "@appio/ui";
import { cn } from "../lib/utils";
import type { BlockMetadata } from "../types";

export interface OnboardingStep {
  /** Stable ID — used as React key + ARIA ids. */
  id: string;
  /** Short step label rendered in the progress indicator. */
  label: string;
  /**
   * Step content — typically a form, illustration + copy, or choice UI.
   * Consumer provides the entire body; block handles framing + transitions.
   */
  content: ReactNode;
  /**
   * When `true`, the Next button is disabled until the consumer flips it to
   * `false`. Use for validation: "must fill the form before continuing."
   */
  nextDisabled?: boolean;
  /**
   * Custom next-button label for this step. Defaults to "Continue" on all
   * steps except the last, which defaults to "Finish".
   */
  nextLabel?: string;
}

export interface OnboardingStepperProps {
  /** Step definitions. Order is the navigation order. Min 2 steps. */
  steps: readonly OnboardingStep[];
  /**
   * Zero-based index of the active step. Consumer owns the state so the
   * block can be composed with external flows (router-driven, wizard-in-
   * modal, etc.).
   */
  currentStepIndex: number;
  /** Called when user advances — NOT called on the last step. */
  onNext: () => void;
  /** Called when user steps back. Not rendered on the first step. */
  onBack?: () => void;
  /**
   * Called on the last step's primary button. If omitted, the block calls
   * `onNext` instead (consumer can detect last-step via index).
   */
  onComplete?: () => void;
  /**
   * Optional skip handler — renders a "Skip" ghost button alongside Back.
   * Omit to hide the skip option entirely.
   */
  onSkip?: () => void;
  /** Extra classes merged into the outer section. */
  className?: string;
}

/**
 * Multi-step onboarding flow. Progress indicator at top (step dots +
 * labels), content body via slot, nav buttons at bottom. Step transitions
 * use `pageTransition` with `AnimatePresence mode="wait"` so the outgoing
 * step animates out before the incoming step animates in — the eye tracks
 * a clean replace, not a cross-dissolve.
 *
 * Consumer owns `currentStepIndex` state so the flow can be integrated
 * with routers, external wizards, or modal hosts.
 */
export function OnboardingStepper(props: OnboardingStepperProps) {
  const {
    steps,
    currentStepIndex,
    onNext,
    onBack,
    onComplete,
    onSkip,
    className,
  } = props;

  const transition = useAnimationPreset(pageTransition);

  if (steps.length === 0) return null;

  const clampedIndex = Math.min(
    Math.max(currentStepIndex, 0),
    steps.length - 1,
  );
  const currentStep = steps[clampedIndex]!;
  const isFirst = clampedIndex === 0;
  const isLast = clampedIndex === steps.length - 1;

  const nextLabel =
    currentStep.nextLabel ?? (isLast ? "Finish" : "Continue");

  const handlePrimary = () => {
    if (isLast && onComplete !== undefined) {
      onComplete();
    } else {
      onNext();
    }
  };

  return (
    <section
      className={cn(
        "flex min-h-[70vh] w-full items-center justify-center bg-background p-6 text-foreground",
        className,
      )}
    >
      <div className="w-full max-w-2xl">
        <StepperProgress
          steps={steps}
          currentIndex={clampedIndex}
        />

        <Card className="mt-8">
          <CardContent className="p-6 md:p-8">
            <div className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Step {clampedIndex + 1} of {steps.length}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentStep.id}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={transition.variants}
                transition={transition.transition}
                aria-labelledby={`onboarding-step-${currentStep.id}-title`}
              >
                <h2
                  id={`onboarding-step-${currentStep.id}-title`}
                  className="mb-6 text-xl font-semibold tracking-tight text-foreground md:text-2xl"
                  style={{ fontFamily: "var(--font-heading, inherit)" }}
                >
                  {currentStep.label}
                </h2>
                {currentStep.content}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        <footer className="mt-6 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {!isFirst && onBack !== undefined && (
              <Button variant="ghost" onClick={onBack}>
                Back
              </Button>
            )}
            {onSkip !== undefined && !isLast && (
              <Button variant="ghost" onClick={onSkip}>
                Skip
              </Button>
            )}
          </div>

          <Button
            onClick={handlePrimary}
            disabled={currentStep.nextDisabled === true}
            size="lg"
            className="min-w-[8rem]"
          >
            {nextLabel}
          </Button>
        </footer>
      </div>
    </section>
  );
}

function StepperProgress({
  steps,
  currentIndex,
}: {
  steps: readonly OnboardingStep[];
  currentIndex: number;
}) {
  return (
    <ol
      className="flex w-full items-center gap-2"
      aria-label="Onboarding progress"
    >
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isActive = index === currentIndex;
        const isFuture = index > currentIndex;

        return (
          <li
            key={step.id}
            className="flex flex-1 items-center gap-2"
            aria-current={isActive ? "step" : undefined}
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                isComplete && "border-primary bg-primary text-primary-foreground",
                isActive && "border-primary bg-background text-primary",
                isFuture && "border-border bg-background text-muted-foreground",
              )}
            >
              {isComplete ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={cn(
                "hidden truncate text-xs font-medium sm:inline",
                isActive && "text-foreground",
                isComplete && "text-foreground",
                isFuture && "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <span
                className={cn(
                  "h-px flex-1 bg-border",
                  isComplete && "bg-primary",
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export const onboardingStepperMetadata: BlockMetadata = {
  id: "onboarding-stepper",
  name: "Onboarding Stepper",
  description:
    "Multi-step flow with progress indicator, per-step content slot, and Back/Next/Skip navigation. Controlled component — consumer owns step state.",
  category: "auth",
  useCases: [
    "user onboarding flow",
    "setup wizard",
    "first-run experience",
    "multi-page form",
  ],
  supportedPersonas: "all",
  motionPresets: ["pageTransition"],
  tags: ["onboarding", "wizard", "stepper", "multi-step"],
  available: true,
};

OnboardingStepper.displayName = "OnboardingStepper";
