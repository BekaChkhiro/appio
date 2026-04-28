"use client";

import { useCallback, useRef, useState } from "react";
import { streamGeneration } from "../sse-client";
import type { GenerationEvent } from "../types";

type GenerationStatus = "idle" | "generating" | "complete" | "error";

interface UseGenerationOptions {
  getToken: () => Promise<string | null>;
}

export function useGeneration({ getToken }: UseGenerationOptions) {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [events, setEvents] = useState<GenerationEvent[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (
      prompt: string,
      opts: {
        templateId?: string;
        templateSlug?: string;
        appId?: string;
        // Frontend-cached chat history. When the user edits an existing
        // app, the backend uses this to synthesize an "edit" prompt so
        // the agent has context about prior turns instead of regenerating
        // from scratch. Caller should pass the in-memory ChatStore array;
        // backend caps at 30 entries.
        messages?: Array<{ role: "user" | "assistant"; content: string }>;
      } = {}
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("generating");
      setEvents([]);
      setPreviewUrl(null);
      setPublicUrl(null);
      setError(null);
      setPreviewVersion(0);

      try {
        await streamGeneration(
          {
            prompt,
            template_id: opts.templateId,
            template_slug: opts.templateSlug,
            app_id: opts.appId,
            messages: opts.messages,
          },
          {
            getToken,
            signal: controller.signal,
            onEvent: (event) => {
              setEvents((prev) => [...prev, event]);

              if (event.type === "preview_ready") {
                setPreviewUrl(event.data.url);
                setPreviewVersion((v) => v + 1);
              } else if (event.type === "complete") {
                setPublicUrl(event.data.public_url);
                setStatus("complete");
              } else if (event.type === "error") {
                setError(event.data.message);
                setStatus("error");
              }
            },
            onError: (err) => {
              setEvents((prev) => [
                ...prev,
                { type: "error", data: { message: err.message } } as GenerationEvent,
              ]);
              setError(err.message);
              setStatus("error");
            },
            onDone: () => {
              // Only auto-transition if still generating AND a terminal
              // event (complete/error) hasn't already arrived. Without
              // this guard, a race between the server closing the stream
              // and the final `error`/`complete` event being parsed on
              // the client can flip status from error → complete silently.
              setStatus((prev) => {
                if (prev !== "generating") return prev;
                // Stream closed with no explicit terminal event —
                // surface it as an error so chat UI can show a message.
                setError(
                  "Generation ended without a final response. The stream may have been interrupted."
                );
                return "error";
              });
            },
          }
        );
      } catch (err) {
        const msg = (err as Error).message;
        // Synthesize an error event so chat UIs that look for
        // `events.findLast(type==="error")` surface the real cause
        // (HTTP 429 rate limit, auth failure, network) instead of the
        // generic "stream ended unexpectedly" fallback.
        setEvents((prev) => [
          ...prev,
          { type: "error", data: { message: msg } } as GenerationEvent,
        ]);
        setError(msg);
        setStatus("error");
      }
    },
    [getToken]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  return {
    generate,
    cancel,
    status,
    events,
    previewUrl,
    previewVersion,
    publicUrl,
    error,
    isGenerating: status === "generating",
  };
}
