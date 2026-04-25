import EventSource from "react-native-sse";
import auth from "@react-native-firebase/auth";
import * as Crypto from "expo-crypto";
import { API_BASE_URL } from "./config";

const MAX_POLL_RETRIES = 120; // 120 × 500ms = 60 seconds max
const POLL_INTERVAL_MS = 500;

/**
 * Backend SSE event shapes from POST /api/v1/generate/.
 * See apps/api/domains/generation/agent_service.py for the source of truth.
 *
 * Agent pipeline events (T2.2b):
 *   { type: "status",        message: string, generation_id?: string }
 *   { type: "agent_turn",    iterations: number, cost_usd: number }
 *   { type: "tool_call",     tool_name: string, message?: string }
 *   { type: "agent_text",    message: string }
 *   { type: "preview_ready", url: string }
 *   { type: "complete",      public_url: string, generation_id: string, tokens?: {...} }
 *   { type: "error",         message: string }
 */
export type GenerationStatusEvent = {
  type: "status";
  message: string;
  generation_id?: string;
};

export type GenerationAgentTurnEvent = {
  type: "agent_turn";
  iterations: number;
  cost_usd: number;
};

export type GenerationToolCallEvent = {
  type: "tool_call";
  tool_name: string;
  message?: string;
};

export type GenerationAgentTextEvent = {
  type: "agent_text";
  message: string;
};

export type GenerationPreviewReadyEvent = {
  type: "preview_ready";
  url: string;
};

export type GenerationCompleteEvent = {
  type: "complete";
  message?: string;
  public_url: string;
  generation_id: string;
  tokens?: {
    input_tokens?: number;
    output_tokens?: number;
    cost_usd?: number;
  };
};

export type GenerationErrorEvent = {
  type: "error";
  message: string;
};

export type GenerationEvent =
  | GenerationStatusEvent
  | GenerationAgentTurnEvent
  | GenerationToolCallEvent
  | GenerationAgentTextEvent
  | GenerationPreviewReadyEvent
  | GenerationCompleteEvent
  | GenerationErrorEvent;

export type StreamGenerationParams = {
  prompt: string;
  appId?: string;
  /**
   * Stable client-side key so a dropped connection can be resumed without
   * burning another generation. Use `newIdempotencyKey()` once per send.
   */
  idempotencyKey: string;
  onEvent: (event: GenerationEvent) => void;
  onError?: (error: unknown) => void;
  onComplete?: () => void;
};

/**
 * Open an SSE stream against POST /api/v1/generate/.
 *
 * The backend streams events line-by-line until it emits `complete` or
 * `error`. The returned function aborts the connection.
 */
export async function streamGeneration(
  params: StreamGenerationParams
): Promise<() => void> {
  const { prompt, appId, idempotencyKey, onEvent, onError, onComplete } =
    params;

  const currentUser = auth().currentUser;
  const token = currentUser ? await currentUser.getIdToken() : "";

  const url = `${API_BASE_URL}/generate/`;

  const es = new EventSource(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      prompt,
      app_id: appId,
      idempotency_key: idempotencyKey,
    }),
    // The backend already sends `: keep-alive` heartbeats every 15s, so we
    // don't need react-native-sse's own polling. Disable it.
    pollingInterval: 0,
  });

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    es.removeAllEventListeners();
    es.close();
    onComplete?.();
  };

  es.addEventListener("message", (event) => {
    if (!event.data) return;
    let parsed: GenerationEvent;
    try {
      parsed = JSON.parse(event.data as string) as GenerationEvent;
    } catch {
      // Comments / heartbeats arrive without parseable data — ignore.
      return;
    }

    onEvent(parsed);

    if (parsed.type === "complete" || parsed.type === "error") {
      finish();
    }
  });

  es.addEventListener("error", (error) => {
    onError?.(error);
    finish();
  });

  return () => {
    finished = true;
    es.removeAllEventListeners();
    es.close();
  };
}

/** Generate a new idempotency key for a single user send. */
export function newIdempotencyKey(): string {
  return Crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Build SSE types (POST /api/v1/builds/)
// ---------------------------------------------------------------------------

export type BuildStatusEvent = {
  type: "status";
  message: string;
  stage?: string;
  generation_id?: string;
};

export type BuildPreviewReadyEvent = {
  type: "preview_ready";
  message?: string;
  preview_url: string;
  generation_id?: string;
};

export type BuildCompleteEvent = {
  type: "build_complete";
  message?: string;
  public_url: string;
  generation_id?: string;
  autofix_attempts?: number;
};

export type BuildErrorEvent = {
  type: "error";
  message: string;
  stage?: string;
  generation_id?: string;
};

export type BuildEvent =
  | BuildStatusEvent
  | BuildPreviewReadyEvent
  | BuildCompleteEvent
  | BuildErrorEvent;

export type StreamBuildParams = {
  generationId: string;
  appId: string;
  version: number;
  spec: Record<string, unknown>;
  templateId: string;
  onEvent: (event: BuildEvent) => void;
  onError?: (error: unknown) => void;
  onComplete?: () => void;
};

/**
 * Open an SSE stream against POST /api/v1/builds/ to trigger preview +
 * production build.
 *
 * Events flow:  status → preview_ready → status → build_complete | error
 *
 * Returns a cleanup function that aborts the connection.
 */
export async function streamBuild(
  params: StreamBuildParams
): Promise<() => void> {
  const {
    generationId,
    appId,
    version,
    spec,
    templateId,
    onEvent,
    onError,
    onComplete,
  } = params;

  const currentUser = auth().currentUser;
  const token = currentUser ? await currentUser.getIdToken() : "";

  const url = `${API_BASE_URL}/builds/`;

  const es = new EventSource(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      generation_id: generationId,
      app_id: appId,
      version,
      spec,
      template_id: templateId,
    }),
    pollingInterval: 0,
  });

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    es.removeAllEventListeners();
    es.close();
    onComplete?.();
  };

  es.addEventListener("message", (event) => {
    if (!event.data) return;
    let parsed: BuildEvent;
    try {
      parsed = JSON.parse(event.data as string) as BuildEvent;
    } catch {
      return;
    }

    onEvent(parsed);

    if (parsed.type === "build_complete" || parsed.type === "error") {
      finish();
    }
  });

  es.addEventListener("error", (error) => {
    onError?.(error);
    finish();
  });

  return () => {
    finished = true;
    es.removeAllEventListeners();
    es.close();
  };
}

// ---------------------------------------------------------------------------
// Build polling fallback
// ---------------------------------------------------------------------------

export type BuildStatusResponse = {
  generation_id: string;
  build_status: string;
  preview_url?: string;
  public_url?: string;
  error_message?: string;
  autofix_attempts?: number;
};

type PollOptions = {
  onUpdate: (status: BuildStatusResponse) => void;
  onError?: (error: unknown) => void;
  onComplete?: () => void;
};

/**
 * Poll GET /api/v1/builds/{generationId}/status as a fallback when the
 * build SSE connection drops.  Polls every 500ms, max 60 seconds.
 */
export function pollBuildStatus(
  generationId: string,
  options: PollOptions
): () => void {
  let active = true;
  let attempts = 0;

  async function poll() {
    while (active && attempts < MAX_POLL_RETRIES) {
      attempts++;
      try {
        const currentUser = auth().currentUser;
        const token = currentUser ? await currentUser.getIdToken() : "";

        const response = await fetch(
          `${API_BASE_URL}/builds/${generationId}/status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!response.ok) {
          throw new Error(`Poll failed: ${response.status}`);
        }

        const data = (await response.json()) as BuildStatusResponse;
        options.onUpdate(data);

        if (data.build_status === "success" || data.build_status === "failed") {
          options.onComplete?.();
          return;
        }
      } catch (error) {
        options.onError?.(error);
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (active && attempts >= MAX_POLL_RETRIES) {
      options.onError?.(new Error("Polling timed out after 60 seconds"));
      options.onComplete?.();
    }
  }

  poll();
  return () => {
    active = false;
  };
}
