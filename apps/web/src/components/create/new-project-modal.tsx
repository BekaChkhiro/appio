"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { X, Flame, Cake, Dumbbell, BookOpen, Link2, Calendar, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@appio/ui";
import { useChatStore } from "@/stores/chat-store";

const TEMPLATES = [
  { label: "Habit tracker", icon: Flame, prompt: "Build a habit tracker app with streaks, daily reminders, and a progress dashboard." },
  { label: "Recipe box", icon: Cake, prompt: "Build a recipe box app where users can save recipes, add photos, and create shopping lists." },
  { label: "Workout log", icon: Dumbbell, prompt: "Build a workout log app with exercise tracking, sets/reps, and progress charts." },
  { label: "Journal", icon: BookOpen, prompt: "Build a personal journal app with daily entries, mood tracking, and photo attachments." },
  { label: "Link-in-bio", icon: Link2, prompt: "Build a link-in-bio page with customizable links, social icons, and analytics." },
  { label: "Event RSVP", icon: Calendar, prompt: "Build an event RSVP app with guest lists, dietary preferences, and confirmation emails." },
];

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onStart: (prompt: string) => void;
}

export function NewProjectModal({ open, onClose, onStart }: NewProjectModalProps) {
  const [val, setVal] = useState("");

  const handleStart = () => {
    if (!val.trim()) return;
    onStart(val.trim());
    setVal("");
  };

  const handleTemplate = (prompt: string) => {
    onStart(prompt);
    setVal("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && val.trim()) {
      e.preventDefault();
      handleStart();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-12"
          style={{ background: "rgba(11,11,15,0.7)", backdropFilter: "blur(8px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[680px] rounded-xl p-6 sm:p-8"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--strong)",
              boxShadow: "var(--shadow-modal, 0 24px 48px -12px rgba(0,0,0,0.6))",
            }}
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} style={{ color: "var(--accent-token)" }} />
                <span className="t-h3" style={{ color: "var(--text-primary)" }}>
                  New app
                </span>
              </div>
              <button
                onClick={onClose}
                className="rounded p-1.5 transition-colors hover:bg-white/5"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Prompt textarea */}
            <div className="t-caption mb-2.5" style={{ color: "var(--text-muted)" }}>
              Describe your app in one sentence
            </div>
            <div
              className="rounded-lg p-4 transition-colors"
              style={{
                background: "var(--surface-0)",
                border: `1.5px solid ${val ? "var(--accent-token)" : "var(--hair)"}`,
              }}
            >
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
            </div>

            {/* Templates */}
            <div className="mt-7">
              <div
                className="mb-3 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
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
                        background: "var(--surface-0)",
                        border: "1px solid var(--hair)",
                        color: "var(--text-primary)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--accent-token)";
                        e.currentTarget.style.background = "var(--accent-soft)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--hair)";
                        e.currentTarget.style.background = "var(--surface-0)";
                      }}
                    >
                      <Icon size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                style={{ background: "var(--accent-token)" }}
                disabled={!val.trim()}
                onClick={handleStart}
              >
                Start building
                <ArrowRight size={14} />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
