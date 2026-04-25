"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Flame,
  Cake,
  Dumbbell,
  BookOpen,
  Link2,
  Calendar,
  ArrowRight,
  Sparkles,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import { Button } from "@appio/ui";

const TEMPLATES = [
  { label: "Habit tracker", icon: Flame, prompt: "Build a habit tracker app with streaks, daily reminders, and a progress dashboard." },
  { label: "Recipe box", icon: Cake, prompt: "Build a recipe box app where users can save recipes, add photos, and create shopping lists." },
  { label: "Workout log", icon: Dumbbell, prompt: "Build a workout log app with exercise tracking, sets/reps, and progress charts." },
  { label: "Journal", icon: BookOpen, prompt: "Build a personal journal app with daily entries, mood tracking, and photo attachments." },
  { label: "Link-in-bio", icon: Link2, prompt: "Build a link-in-bio page with customizable links, social icons, and analytics." },
  { label: "Event RSVP", icon: Calendar, prompt: "Build an event RSVP app with guest lists, dietary preferences, and confirmation emails." },
];

const PENDING_PROMPT_PREFIX = "appio_pending_prompt_";

function stashPromptAndBuildUrl(prompt: string): string {
  const id = (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
  ).replace(/-/g, "").slice(0, 12);
  try {
    sessionStorage.setItem(PENDING_PROMPT_PREFIX + id, prompt);
  } catch {
    // sessionStorage unavailable — fall through; CreateView will handle empty prompt gracefully.
  }
  return `/build?b=${id}`;
}

export function PromptScreen() {
  const router = useRouter();
  const [val, setVal] = useState("");

  const handleStart = useCallback(() => {
    const text = val.trim();
    if (!text) return;
    router.push(stashPromptAndBuildUrl(text));
  }, [val, router]);

  const handleTemplate = useCallback((prompt: string) => {
    router.push(stashPromptAndBuildUrl(prompt));
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && val.trim()) {
      e.preventDefault();
      handleStart();
    }
  };

  return (
    <div className="scroll flex h-full flex-col items-center justify-center overflow-auto px-4 py-12" style={{ background: "var(--surface-0)" }}>
      <div className="w-full max-w-[640px]">
        {/* Hero */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: "var(--accent-soft)" }}
          >
            <Sparkles size={22} style={{ color: "var(--accent-token)" }} />
          </div>
          <div className="t-display" style={{ color: "var(--text-primary)", marginBottom: 8 }}>
            What do you want to build?
          </div>
          <div className="t-body muted" style={{ maxWidth: 480, margin: "0 auto" }}>
            Describe your app idea in plain language. Appio will build it for you —
            screens, logic, and a live preview.
          </div>
        </div>

        {/* Prompt textarea */}
        <div
          className="mb-6 rounded-xl p-4 transition-colors"
          style={{
            background: "var(--surface-1)",
            border: `1.5px solid ${val ? "var(--accent-token)" : "var(--hair)"}`,
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <Zap size={14} style={{ color: "var(--accent-token)" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
              Describe your app in one sentence
            </span>
          </div>
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            autoFocus
            placeholder="A quiet habit tracker with streaks and a morning routine mode"
            className="w-full resize-none bg-transparent text-[18px] leading-relaxed outline-none sm:text-[20px]"
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              letterSpacing: "-0.01em",
            }}
          />
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              className="gap-1.5"
              style={{ background: val.trim() ? "var(--accent-token)" : "var(--surface-2)" }}
              disabled={!val.trim()}
              onClick={handleStart}
            >
              Start building
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>

        {/* Templates */}
        <div className="mb-6">
          <div
            className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            <Zap size={12} />
            Or start from a template
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.label}
                  onClick={() => handleTemplate(t.prompt)}
                  className="flex items-center gap-2.5 rounded-lg px-3.5 py-3 text-left text-[13px] font-medium transition-colors"
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--hair)",
                    color: "var(--text-primary)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent-token)";
                    e.currentTarget.style.background = "var(--accent-soft)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--hair)";
                    e.currentTarget.style.background = "var(--surface-1)";
                  }}
                >
                  <Icon size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Browse templates link */}
        <div className="text-center">
          <Link
            href="/build/templates"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:underline"
            style={{ color: "var(--accent-token)" }}
          >
            Browse all templates
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
