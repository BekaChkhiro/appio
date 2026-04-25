import { useCallback, useEffect, useRef, useState } from "react";
import {
  GenerationEvent,
  newIdempotencyKey,
  streamGeneration,
} from "../lib/sse";

export type ChatRole = "user" | "assistant" | "status" | "error";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  /** Deployed PWA URL returned by the agent pipeline on completion. */
  publicUrl?: string;
  /** Live preview URL emitted mid-generation by the agent. */
  previewUrl?: string;
  generationId?: string;
};

type SendState = "idle" | "streaming" | "error";

type LastSend = {
  prompt: string;
  idempotencyKey: string;
};

let messageCounter = 0;
const nextMessageId = () => `m_${Date.now()}_${++messageCounter}`;

/**
 * Manages chat-driven generation:
 *  - rolling list of user/assistant/status/error messages
 *  - opens an SSE stream against POST /generate/ on send
 *  - reuses the same idempotency key on retry so a dropped stream can resume
 *    without burning another generation
 *  - exposes loading + error state for the UI
 */
export function useGeneration() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<SendState>("idle");

  // Cleanup ref so unmount / a new send aborts the previous stream.
  const cleanupRef = useRef<(() => void) | null>(null);
  // Track the last send so retry() can resume with the same idempotency key.
  const lastSendRef = useRef<LastSend | null>(null);
  // ID of the streaming-status message currently being mutated, if any.
  const statusIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  const appendMessage = useCallback((msg: Omit<ChatMessage, "id">) => {
    const id = nextMessageId();
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  }, []);

  const updateMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
    },
    []
  );

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const runStream = useCallback(
    async (prompt: string, idempotencyKey: string) => {
      // Tear down any in-flight stream first.
      cleanupRef.current?.();
      cleanupRef.current = null;

      setState("streaming");

      // Drop any prior status/error bubbles before this new attempt.
      setMessages((prev) =>
        prev.filter((m) => m.role !== "status" && m.role !== "error")
      );
      statusIdRef.current = null;

      const onEvent = (event: GenerationEvent) => {
        // Progress-style events: update a single status bubble in place.
        if (
          event.type === "status" ||
          event.type === "agent_turn" ||
          event.type === "tool_call" ||
          event.type === "agent_text"
        ) {
          const text =
            event.type === "agent_turn"
              ? `Building... (iteration ${event.iterations})`
              : event.type === "tool_call"
                ? `Running ${event.tool_name}...`
                : event.message;

          if (statusIdRef.current) {
            updateMessage(statusIdRef.current, { text });
          } else {
            statusIdRef.current = appendMessage({
              role: "status",
              text,
            });
          }
          return;
        }

        // Live preview available mid-generation.
        if (event.type === "preview_ready") {
          if (statusIdRef.current) {
            updateMessage(statusIdRef.current, {
              text: "Preview ready!",
              previewUrl: event.url,
            });
          }
          return;
        }

        if (event.type === "complete") {
          if (statusIdRef.current) {
            removeMessage(statusIdRef.current);
            statusIdRef.current = null;
          }
          appendMessage({
            role: "assistant",
            text: "Your app is ready!",
            publicUrl: event.public_url,
            generationId: event.generation_id,
          });
          setState("idle");
          lastSendRef.current = null;
          return;
        }

        if (event.type === "error") {
          if (statusIdRef.current) {
            removeMessage(statusIdRef.current);
            statusIdRef.current = null;
          }
          appendMessage({
            role: "error",
            text: event.message || "Generation failed.",
          });
          setState("error");
          return;
        }
      };

      const onError = (_err: unknown) => {
        if (statusIdRef.current) {
          removeMessage(statusIdRef.current);
          statusIdRef.current = null;
        }
        appendMessage({
          role: "error",
          text: "Connection lost. Tap retry to resume.",
        });
        setState("error");
      };

      try {
        const cleanup = await streamGeneration({
          prompt,
          idempotencyKey,
          onEvent,
          onError,
        });
        cleanupRef.current = cleanup;
      } catch (err) {
        appendMessage({
          role: "error",
          text:
            err instanceof Error
              ? err.message
              : "Could not start generation.",
        });
        setState("error");
      }
    },
    [appendMessage, updateMessage, removeMessage]
  );

  const send = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || state === "streaming") return;

      appendMessage({ role: "user", text: trimmed });

      const key = newIdempotencyKey();
      lastSendRef.current = { prompt: trimmed, idempotencyKey: key };
      void runStream(trimmed, key);
    },
    [appendMessage, runStream, state]
  );

  const retry = useCallback(() => {
    const last = lastSendRef.current;
    if (!last || state === "streaming") return;
    void runStream(last.prompt, last.idempotencyKey);
  }, [runStream, state]);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    statusIdRef.current = null;
    lastSendRef.current = null;
    setMessages([]);
    setState("idle");
  }, []);

  return {
    messages,
    state,
    isStreaming: state === "streaming",
    canRetry: state === "error" && lastSendRef.current !== null,
    send,
    retry,
    reset,
  };
}
