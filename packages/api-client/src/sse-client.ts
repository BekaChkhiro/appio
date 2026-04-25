import { getApiBaseUrl } from "@appio/config";
import type { GenerationEvent, SSEEventType } from "./types";

type SSECallback = (event: GenerationEvent) => void;

interface SSEOptions {
  getToken: () => Promise<string | null>;
  onEvent: SSECallback;
  onError?: (error: Error) => void;
  onDone?: () => void;
  signal?: AbortSignal;
  /**
   * Abort the stream if no bytes (data or heartbeat comment) arrive within
   * this many ms. The backend emits `: keep-alive` every 15s, so 45s is a
   * comfortable buffer. Set to 0 to disable the watchdog.
   */
  staleTimeoutMs?: number;
}

// 2 minutes — vision critique (Playwright screenshots + Claude review) can
// legitimately hold the stream for 30-60s without producing parseable SSE
// bytes. Backend emits heartbeat comments every 15s so a well-behaved
// pipeline resets the watchdog long before this triggers. We want it to
// fire only when the server is truly wedged, not during slow-but-alive work.
const DEFAULT_STALE_TIMEOUT_MS = 120_000;

/**
 * SSE client using fetch() + ReadableStream.
 * Replaces react-native-sse with a web-native implementation.
 * Supports POST with custom headers (needed for auth + idempotency keys).
 *
 * Handles two SSE event formats:
 * 1. Named events: `event: <type>\ndata: <json>\n\n`
 * 2. Data-only:    `data: <json>\n\n` where JSON has a `type` field
 *
 * Includes a stale-stream watchdog: if no bytes arrive for
 * `staleTimeoutMs`, the stream is aborted with an error so the caller can
 * reconnect or fall back to polling. Heartbeat comments (`:`) count as
 * liveness, so a backend idle period up to the heartbeat interval is fine.
 */
export async function streamGeneration(
  body: {
    prompt: string;
    template_id?: string;
    template_slug?: string;
    app_id?: string;
    idempotency_key?: string;
  },
  options: SSEOptions
): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const token = await options.getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Compose external abort signal with our own so the watchdog can abort
  // without racing the caller.
  const controller = new AbortController();
  const externalAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", externalAbort);

  const staleTimeoutMs = options.staleTimeoutMs ?? DEFAULT_STALE_TIMEOUT_MS;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let staleAbort = false;

  const resetWatchdog = () => {
    if (staleTimeoutMs <= 0) return;
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      staleAbort = true;
      controller.abort();
    }, staleTimeoutMs);
  };

  const clearWatchdog = () => {
    if (watchdog) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/generate/`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    options.signal?.removeEventListener("abort", externalAbort);
    if ((err as Error).name === "AbortError") return;
    options.onError?.(err as Error);
    return;
  }

  if (!response.ok) {
    const text = await response.text();
    options.signal?.removeEventListener("abort", externalAbort);
    throw new Error(`Generation failed: ${response.status} ${text}`);
  }

  if (!response.body) {
    options.signal?.removeEventListener("abort", externalAbort);
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  resetWatchdog();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Any bytes — including `:keep-alive` — count as liveness.
      resetWatchdog();
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      // SSE events are separated by double newlines
      const eventBlocks = buffer.split("\n\n");
      buffer = eventBlocks.pop() ?? ""; // Keep incomplete block in buffer

      for (const block of eventBlocks) {
        if (!block.trim()) continue;

        const lines = block.split("\n");
        let eventType: SSEEventType | null = null;
        let dataJson: string | null = null;

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim() as SSEEventType;
          } else if (line.startsWith("data:")) {
            dataJson = line.slice(5).trim();
          } else if (line.startsWith(":")) {
            // Comment/heartbeat — ignore
          }
        }

        if (!dataJson) continue;

        try {
          const parsed = JSON.parse(dataJson);

          // If no named event type was provided, try to extract it from
          // the JSON payload's `type` field (backend format).
          if (!eventType && parsed && typeof parsed === "object" && "type" in parsed) {
            eventType = parsed.type as SSEEventType;
          }

          if (eventType) {
            options.onEvent({ type: eventType, data: parsed } as GenerationEvent);
          }
        } catch {
          // Skip malformed data lines
        }
      }
    }
  } catch (err) {
    const name = (err as Error).name;
    if (name === "AbortError") {
      if (staleAbort) {
        options.onError?.(
          new Error(
            `Stream went silent for >${staleTimeoutMs}ms. Check your connection and retry.`
          )
        );
      }
      return;
    }
    options.onError?.(err as Error);
    return;
  } finally {
    clearWatchdog();
    options.signal?.removeEventListener("abort", externalAbort);
  }

  options.onDone?.();
}
