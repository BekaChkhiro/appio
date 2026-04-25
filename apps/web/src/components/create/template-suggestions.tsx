"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ListChecks,
  DollarSign,
  Target,
  Timer,
  BookOpen,
  Sparkles,
  LayoutGrid,
} from "lucide-react";

const SUGGESTIONS = [
  { label: "Expense Tracker", icon: DollarSign, prompt: "Build an expense tracker app with categories, charts, and monthly budgets" },
  { label: "Habit Tracker", icon: Target, prompt: "Build a habit tracker with daily streaks, progress charts, and reminders" },
  { label: "Todo List", icon: ListChecks, prompt: "Build a todo list app with drag-and-drop, priorities, and due dates" },
  { label: "Meditation Timer", icon: Timer, prompt: "Build a meditation timer app with ambient sounds, session history, and breathing exercises" },
  { label: "Recipe Book", icon: BookOpen, prompt: "Build a recipe book app where I can save, search, and organize my favorite recipes" },
  { label: "Surprise Me", icon: Sparkles, prompt: "Build me a creative and useful mobile app — surprise me with something unique" },
];

interface TemplateSuggestionsProps {
  onSelect: (prompt: string) => void;
}

export function TemplateSuggestions({ onSelect }: TemplateSuggestionsProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">What would you like to build?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe your app idea or pick a template
        </p>
      </div>
      <div className="grid w-full max-w-sm grid-cols-2 gap-2">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelect(s.prompt)}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-[13px] transition-colors hover:border-primary/40 hover:bg-accent active:scale-[0.98]"
          >
            <s.icon className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-medium">{s.label}</span>
          </motion.button>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <Link
          href="/build/templates"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <LayoutGrid className="h-4 w-4" />
          Browse all templates
        </Link>
      </motion.div>
    </div>
  );
}
