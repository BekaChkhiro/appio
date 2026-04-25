"use client";

import { motion } from "motion/react";

interface TypingIndicatorProps {
  label?: string;
}

export function TypingIndicator({ label = "Thinking…" }: TypingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 py-1"
    >
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: 6,
              height: 6,
              background: "var(--accent-token)",
            }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1, 0.8] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
    </motion.div>
  );
}
