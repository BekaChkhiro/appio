"use client";

import { Check, Loader2, XCircle, Circle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { PublishStatus } from "@appio/api-client";

interface MigrationProgressProps {
  status: PublishStatus;
  currentStep: string | null;
  message: string | null;
}

const STEPS = [
  { label: "Provision your Convex deployment", status: "provisioning" },
  { label: "Push schema to your account", status: "pushing_schema" },
  { label: "Push generated functions", status: "pushing_functions" },
  { label: "Migrate app data from sandbox", status: "copying_data" },
  { label: "Rewrite app config", status: "rewriting_config" },
  { label: "Rebuild and deploy", status: "rebuilding" },
  { label: "Go live", status: "published" },
] as const;

function getActiveIndex(status: PublishStatus): number {
  switch (status) {
    case "pending":
    case "provisioning":
      return 0;
    case "pushing_schema":
      return 1;
    case "pushing_functions":
      return 2;
    case "copying_data":
      return 3;
    case "rewriting_config":
      return 4;
    case "rebuilding":
      return 5;
    case "published":
      return 6;
    case "failed":
      return -1;
  }
}

interface StepIconProps {
  index: number;
  activeIndex: number;
  isFailed: boolean;
}

function StepIcon({ index, activeIndex, isFailed }: StepIconProps) {
  if (isFailed && index === activeIndex) {
    return <XCircle className="h-5 w-5 text-destructive" />;
  }
  if (index < activeIndex || (activeIndex === 6 && index === 6)) {
    return <Check className="h-5 w-5 text-green-500" />;
  }
  if (index === activeIndex) {
    return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  }
  return <Circle className="h-5 w-5 text-muted-foreground/40" />;
}

export function MigrationProgress({
  status,
  currentStep,
  message,
}: MigrationProgressProps) {
  const prefersReduced = useReducedMotion();
  const isFailed = status === "failed";
  const activeIndex = isFailed
    ? (currentStep ? STEPS.findIndex((s) => s.status === currentStep) : 0)
    : getActiveIndex(status);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <ol className="space-y-3" aria-label="Publish progress">
        {STEPS.map((step, i) => {
          const isDone = !isFailed && i < getActiveIndex(status);
          const isActive = i === activeIndex;

          return (
            <motion.li
              key={step.status}
              initial={prefersReduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.06 }}
              className="flex items-center gap-3"
              aria-current={isActive ? "step" : undefined}
            >
              <StepIcon
                index={i}
                activeIndex={activeIndex}
                isFailed={isFailed}
              />
              <span
                className={
                  isActive
                    ? "text-sm font-medium text-foreground"
                    : isDone
                    ? "text-sm text-muted-foreground line-through"
                    : "text-sm text-muted-foreground"
                }
              >
                {step.label}
              </span>
            </motion.li>
          );
        })}
      </ol>

      {message && (
        <p
          role="status"
          className="text-center text-sm text-muted-foreground"
        >
          {message}
        </p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Migration can take 20-60 seconds. Safe to leave this page — you&apos;ll
        get an email when it&apos;s ready.
      </p>
    </div>
  );
}
