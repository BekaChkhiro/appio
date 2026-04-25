"use client";

import { motion } from "motion/react";
import { FileCode2, FilePlus2, FileMinus2 } from "lucide-react";

interface DiffCardProps {
  kind: "added" | "changed" | "removed";
  title: string;
  files: string[];
  animate?: boolean;
}

const KIND_CONFIG = {
  added: {
    icon: FilePlus2,
    prefix: "Added",
    border: "rgba(34,197,94,0.3)",
    bg: "rgba(34,197,94,0.08)",
    text: "#22c55e",
  },
  changed: {
    icon: FileCode2,
    prefix: "Updated",
    border: "rgba(124,92,255,0.3)",
    bg: "rgba(124,92,255,0.08)",
    text: "var(--accent-token)",
  },
  removed: {
    icon: FileMinus2,
    prefix: "Removed",
    border: "rgba(244,63,94,0.3)",
    bg: "rgba(244,63,94,0.08)",
    text: "#f43f5e",
  },
};

export function DiffCard({ kind, title, files, animate }: DiffCardProps) {
  const config = KIND_CONFIG[kind];
  const Icon = config.icon;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="rounded-lg px-3.5 py-2.5"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color: config.text }} />
        <span className="text-[13px] font-medium" style={{ color: config.text }}>
          {title}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {files.map((f) => (
          <span
            key={f}
            className="rounded px-1.5 py-0.5 text-[11px] font-mono"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "var(--text-muted)",
            }}
          >
            {f}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
