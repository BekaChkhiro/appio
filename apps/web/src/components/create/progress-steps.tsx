"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  FolderOpen,
  FileCode2,
  Hammer,
  Eye,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { GenerationEvent } from "@appio/api-client";

const STEP_CONFIG = [
  { key: "setup", label: "Setting up project...", icon: FolderOpen },
  { key: "writing", label: "Writing components...", icon: FileCode2 },
  { key: "building", label: "Building app...", icon: Hammer },
  { key: "preview", label: "Preview ready", icon: Eye },
  { key: "complete", label: "Deployed!", icon: CheckCircle2 },
] as const;

/**
 * Derive the active progress step from SSE events.
 * Uses both status messages and tool_call/tool_name to determine phase.
 */
function getActiveStep(events: GenerationEvent[]): number {
  let hasWrittenFiles = false;
  let hasRunBuild = false;
  let hasPreview = false;
  let isComplete = false;

  for (const e of events) {
    if (e.type === "complete") {
      isComplete = true;
    } else if (e.type === "preview_ready") {
      hasPreview = true;
    } else if (e.type === "tool_call") {
      const tool =
        (e.data as { tool_name?: string; tool?: string }).tool_name ??
        (e.data as { tool?: string }).tool;
      if (tool === "run_build") hasRunBuild = true;
      else if (tool === "write_file") hasWrittenFiles = true;
    } else if (e.type === "status") {
      const msg = ((e.data as { message?: string }).message ?? "").toLowerCase();
      if (msg.includes("building & deploying")) hasRunBuild = true;
      if (msg.includes("preview ready")) hasPreview = true;
    }
  }

  // Determine active step based on accumulated state
  if (isComplete) return 4;
  if (hasPreview) return 3;
  if (hasRunBuild) return 2;
  if (hasWrittenFiles) return 1;
  return 0;
}

/** Derive a human-readable status label from the most recent event */
function getStatusLabel(events: GenerationEvent[]): string {
  if (events.length === 0) return "Setting up workspace...";
  const last = events[events.length - 1];

  if (last.type === "status") {
    return (last.data as { message?: string }).message ?? "Working...";
  }
  if (last.type === "plan") {
    return (last.data as { message?: string }).message ?? "Planning...";
  }
  if (last.type === "agent_turn") {
    const data = last.data as { iterations?: number; cost_usd?: number; message?: string };
    if (data.iterations) return `Iteration ${data.iterations}...`;
    return data.message ?? "Thinking...";
  }
  if (last.type === "tool_call") {
    const tool =
      (last.data as { tool_name?: string; tool?: string }).tool_name ??
      (last.data as { tool?: string }).tool;
    if (tool === "write_file") return "Writing code...";
    if (tool === "run_build") return "Building app...";
    if (tool === "read_file") return "Reading file...";
    if (tool === "list_files") return "Listing files...";
    return `Running ${tool}...`;
  }
  if (last.type === "preview_ready") return "Preview updated";
  if (last.type === "critique") {
    const score = (last.data as { score?: number }).score;
    return score ? `Reviewing (${score}/10)...` : "Reviewing...";
  }
  if (last.type === "complete") return "Done!";
  return "Working...";
}

interface ProgressStepsProps {
  events: GenerationEvent[];
  isGenerating: boolean;
}

export function ProgressSteps({ events, isGenerating }: ProgressStepsProps) {
  const activeStep = getActiveStep(events);

  if (!isGenerating && events.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="flex flex-col gap-1.5 rounded-xl bg-muted/50 p-3"
      >
        {/* Current status label */}
        <div className="mb-1 text-[11px] font-medium" style={{ color: "var(--accent-token)" }}>
          {getStatusLabel(events)}
        </div>
        {STEP_CONFIG.map((step, i) => {
          const isActive = i === activeStep && isGenerating;
          const isDone = i < activeStep || (!isGenerating && i <= activeStep);

          return (
            <div
              key={step.key}
              className="flex items-center gap-2.5 text-xs"
            >
              {isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : isDone ? (
                <step.icon className="h-3.5 w-3.5 text-primary" />
              ) : (
                <step.icon className="h-3.5 w-3.5 text-muted-foreground/40" />
              )}
              <span
                className={
                  isActive
                    ? "font-medium text-foreground"
                    : isDone
                      ? "text-muted-foreground"
                      : "text-muted-foreground/40"
                }
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
