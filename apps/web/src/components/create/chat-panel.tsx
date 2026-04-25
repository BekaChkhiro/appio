"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Pencil, Sparkles, ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { Button } from "@appio/ui";
import { useChatStore } from "@/stores/chat-store";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { TypingIndicator } from "./typing-indicator";
import { ProgressSteps } from "./progress-steps";
import type { GenerationEvent } from "@appio/api-client";

const QUICK_CHIPS = [
  "Add a screen",
  "Change theme",
  "Connect data",
  "Make playful",
];

interface ChatPanelProps {
  events: GenerationEvent[];
  isGenerating: boolean;
  onGenerate: (prompt: string) => void;
  onCancel: () => void;
  editingAppName?: string | null;
}

export function ChatPanel({
  events,
  isGenerating,
  onGenerate,
  onCancel,
  editingAppName = null,
}: ChatPanelProps) {
  const { messages, draft, addMessage, setDraft, setStreaming, clearMessages } =
    useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = !!searchParams.get("app");
  const [toolLogOpen, setToolLogOpen] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, events.length, isGenerating]);

  useEffect(() => {
    setStreaming(isGenerating);
  }, [isGenerating, setStreaming]);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    addMessage({ role: "user", content: text });
    setDraft("");
    onGenerate(text);
  }

  function handleQuickChip(label: string) {
    setDraft(label);
    addMessage({ role: "user", content: label });
    setDraft("");
    onGenerate(label);
  }

  function handleNewChat() {
    clearMessages();
    router.push("/build");
  }

  const hasMessages = messages.length > 0;

  // Derive diff cards from generation events (tool_call events)
  const diffEvents = events.filter(
    (e): e is Extract<typeof e, { type: "tool_call" }> =>
      e.type === "tool_call"
  );

  const getToolName = (e: (typeof diffEvents)[number]): string => {
    const d = e.data as { tool_name?: string; tool?: string };
    return d.tool_name ?? d.tool ?? "tool";
  };

  /** Dynamic status label based on the latest generation event */
  const statusLabel = (() => {
    if (!isGenerating) return "Ready";
    if (events.length === 0) return "Starting…";
    const last = events[events.length - 1];
    if (last.type === "status") {
      const msg = (last.data as { message?: string }).message ?? "";
      if (msg.toLowerCase().includes("planning")) return "Planning…";
      if (msg.toLowerCase().includes("starting agent")) return "Thinking…";
      if (msg.toLowerCase().includes("building")) return "Building…";
      if (msg.toLowerCase().includes("deploy")) return "Deploying…";
      return msg.length > 25 ? msg.slice(0, 24) + "…" : msg;
    }
    if (last.type === "plan") return "Planning…";
    if (last.type === "agent_turn") return "Thinking…";
    if (last.type === "tool_call") {
      const tool =
        (last.data as { tool_name?: string; tool?: string }).tool_name ??
        (last.data as { tool?: string }).tool;
      if (tool === "write_file") return "Writing code…";
      if (tool === "run_build") return "Building…";
      if (tool === "read_file") return "Reading…";
      if (tool === "list_files") return "Exploring…";
      return "Working…";
    }
    if (last.type === "preview_ready") return "Preview ready";
    if (last.type === "critique") return "Reviewing…";
    return "Thinking…";
  })();

  /** Label for the typing indicator (more specific) */
  const typingLabel = (() => {
    if (!isGenerating) return "";
    if (events.length === 0) return "Starting…";
    const last = events[events.length - 1];
    if (last.type === "status") {
      const msg = (last.data as { message?: string }).message ?? "";
      if (msg) return msg.length > 35 ? msg.slice(0, 34) + "…" : msg;
    }
    if (last.type === "tool_call") {
      const tool =
        (last.data as { tool_name?: string; tool?: string }).tool_name ??
        (last.data as { tool?: string }).tool;
      if (tool === "write_file") return "Writing code…";
      if (tool === "run_build") return "Compiling…";
      if (tool === "read_file") return "Reading file…";
      return `${tool}…`;
    }
    if (last.type === "agent_turn") {
      const iter = (last.data as { iterations?: number; iteration?: number }).iterations ??
                   (last.data as { iteration?: number }).iteration;
      return iter ? `Iteration ${iter}…` : "Thinking…";
    }
    return "Thinking…";
  })();

  const statusColor = isGenerating
    ? "var(--accent-token)"
    : "#22c55e";

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div
        className="flex shrink-0 items-center gap-2.5 px-5 py-3"
        style={{ borderBottom: "1px solid var(--hair)" }}
      >
        <Sparkles size={16} style={{ color: "var(--accent-token)" }} />
        <span
          className="text-[14px] font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Assistant
        </span>
        <div
          className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
          style={{
            background: isGenerating ? "var(--accent-soft)" : "rgba(34,197,94,0.12)",
            color: statusColor,
            border: `1px solid ${isGenerating ? "rgba(124,92,255,0.2)" : "rgba(34,197,94,0.2)"}`,
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: statusColor,
              animation: isGenerating ? "pulseDot 1.4s ease-in-out infinite" : undefined,
            }}
          />
          {statusLabel}
        </div>
      </div>

      {/* Edit-mode banner */}
      {isEditMode && (
        <div
          className="flex shrink-0 items-center justify-between gap-2 px-4 py-2"
          style={{
            borderBottom: "1px solid var(--hair)",
            background: "var(--accent-soft)",
          }}
        >
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <Pencil
              size={14}
              className="shrink-0"
              style={{ color: "var(--accent-token)" }}
            />
            <span className="truncate" style={{ color: "var(--text-primary)" }}>
              Editing{" "}
              <span className="font-medium">{editingAppName ?? "app"}</span>
              <span style={{ color: "var(--text-muted)" }}>
                {" "}— your next message refines this app
              </span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="h-7 shrink-0 gap-1.5 text-xs"
          >
            <Plus size={14} />
            New app
          </Button>
        </div>
      )}

      {/* Non-edit mode: new-chat control */}
      {!isEditMode && hasMessages && !isGenerating && (
        <div
          className="flex shrink-0 items-center justify-between px-4 py-2"
          style={{ borderBottom: "1px solid var(--hair)" }}
        >
          <span
            className="text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            {messages.length} message{messages.length === 1 ? "" : "s"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="h-7 gap-1.5 text-xs"
          >
            <Plus size={14} />
            New chat
          </Button>
        </div>
      )}

      {/* ── Messages area ── */}
      <div ref={scrollRef} className="scroll flex-1 overflow-y-auto px-5 pt-5">
        {hasMessages ? (
          <div className="flex flex-col gap-4 pb-4">
            {messages.map((msg, i) => (
              <ChatMessage key={msg.id} message={msg} index={i} />
            ))}

            {/* Progress summary first — user's primary status signal. */}
            {isGenerating && events.length > 0 && (
              <ProgressSteps events={events} isGenerating={isGenerating} />
            )}

            {/* Collapsed tool-call log below the summary. Interior detail that
                most users don't need to see — behind a disclosure so the chat
                scroll stays focused on messages + status. */}
            {diffEvents.length > 0 && (
              <div
                className="flex flex-col overflow-hidden rounded-xl"
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--hair)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setToolLogOpen((v) => !v)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors hover:bg-white/[0.02]"
                  style={{ color: "var(--text-muted)" }}
                  aria-expanded={toolLogOpen}
                >
                  {toolLogOpen ? (
                    <ChevronDown size={13} className="shrink-0" />
                  ) : (
                    <ChevronRight size={13} className="shrink-0" />
                  )}
                  <Wrench size={12} className="shrink-0" />
                  <span className="font-medium">
                    {diffEvents.length} tool call{diffEvents.length === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto text-[11px]">
                    {toolLogOpen ? "Hide" : "Show"}
                  </span>
                </button>
                {toolLogOpen && (
                  <ul
                    className="divide-y"
                    style={{
                      borderTop: "1px solid var(--hair)",
                      // @ts-expect-error — CSS var as divide color
                      "--tw-divide-opacity": 1,
                    }}
                  >
                    {diffEvents.map((evt, i) => {
                      const tool = getToolName(evt);
                      const rawPath =
                        (evt.data as { path?: string } | undefined)?.path ?? "";
                      const label =
                        tool === "write_file"
                          ? "wrote"
                          : tool === "read_file"
                            ? "read"
                            : tool === "list_files"
                              ? "listed"
                              : tool === "run_build"
                                ? "built"
                                : tool;
                      const fileDisplay =
                        tool === "run_build"
                          ? "esbuild"
                          : rawPath || "—";
                      const color =
                        tool === "write_file"
                          ? "#22c55e"
                          : tool === "run_build"
                            ? "#f97316"
                            : "var(--accent-token)";
                      return (
                        <li
                          key={i}
                          className="flex items-center gap-2 px-3 py-1.5 text-[11.5px]"
                          style={{ borderColor: "var(--hair)" }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: color }}
                          />
                          <span
                            className="shrink-0 font-medium"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {label}
                          </span>
                          <span
                            className="truncate font-mono text-[10.5px]"
                            style={{ color: "var(--text-muted)" }}
                            title={fileDisplay}
                          >
                            {fileDisplay}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {isGenerating && <TypingIndicator label={typingLabel} />}
          </div>
        ) : isEditMode ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: "var(--accent-soft)" }}
            >
              <Pencil size={20} style={{ color: "var(--accent-token)" }} />
            </div>
            <div
              className="max-w-[260px] text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              No messages yet. Describe a change to refine{" "}
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                {editingAppName ?? "this app"}
              </span>
              .
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: "var(--accent-soft)" }}
            >
              <Sparkles size={20} style={{ color: "var(--accent-token)" }} />
            </div>
            <div
              className="max-w-[260px] text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Describe what you want to build. Be specific — screens, style,
              data.
            </div>
          </div>
        )}
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 px-4 pb-4 pt-2" style={{ borderTop: "1px solid var(--hair)" }}>
        {/* Quick chips */}
        {hasMessages && (
          <div className="mb-2.5 flex gap-1.5 overflow-auto pb-1">
            {QUICK_CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => handleQuickChip(c)}
                className="shrink-0 rounded-full px-2.5 py-1 text-[12px] transition-colors hover:bg-white/5"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--hair)",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <ChatInput
          value={draft}
          onChange={setDraft}
          onSend={handleSend}
          onCancel={onCancel}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
}
