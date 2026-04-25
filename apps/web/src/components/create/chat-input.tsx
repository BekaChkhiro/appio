"use client";

import { useCallback, useRef, useEffect } from "react";
import { Send, Square, Paperclip, Mic } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onCancel,
  isGenerating,
  disabled,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !isGenerating) {
        e.preventDefault();
        if (value.trim()) onSend();
      }
    },
    [value, onSend, isGenerating]
  );

  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--hair)",
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe a change…"
        enterKeyHint="send"
        disabled={disabled}
        rows={1}
        className="w-full resize-none overflow-hidden bg-transparent text-[14px] leading-5 outline-none"
        style={{
          color: "var(--text-primary)",
          fontFamily: "var(--font-sans)",
        }}
      />
      <div className="mt-1 flex items-center gap-1">
        <button
          className="rounded p-1.5 transition-colors hover:bg-white/5"
          style={{ color: "var(--text-muted)" }}
          title="Attach file"
        >
          <Paperclip size={16} />
        </button>
        <button
          className="rounded p-1.5 transition-colors hover:bg-white/5"
          style={{ color: "var(--text-muted)" }}
          title="Voice input"
        >
          <Mic size={16} />
        </button>
        <div className="ml-auto">
          {isGenerating ? (
            <button
              onClick={onCancel}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              style={{ background: "rgba(244,63,94,0.15)" }}
            >
              <Square size={14} style={{ color: "#f43f5e" }} />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!value.trim() || disabled}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40"
              style={{
                background: value.trim()
                  ? "var(--accent-token)"
                  : "var(--surface-2)",
              }}
            >
              <Send
                size={14}
                style={{ color: value.trim() ? "#fff" : "var(--text-muted)" }}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
