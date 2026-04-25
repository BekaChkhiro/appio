import { useCallback, useEffect, useRef, useState } from "react";
import {
  BuildEvent,
  BuildStatusResponse,
  pollBuildStatus,
  streamBuild,
} from "../lib/sse";

export type BuildPhase =
  | "idle"
  | "previewing"
  | "preview_ready"
  | "building"
  | "complete"
  | "error";

export type BuildState = {
  phase: BuildPhase;
  /** Status message from the server (e.g. "Building preview...") */
  statusMessage: string | null;
  /** Current pipeline stage: codegen | scan | build | upload | publish */
  stage: string | null;
  /** Preview URL (available after preview_ready) */
  previewUrl: string | null;
  /** Production URL (available after build_complete) */
  publicUrl: string | null;
  /** Number of AutoFix attempts (0 = first-try success) */
  autofixAttempts: number;
  /** Error message if build failed */
  errorMessage: string | null;
};

const INITIAL_STATE: BuildState = {
  phase: "idle",
  statusMessage: null,
  stage: null,
  previewUrl: null,
  publicUrl: null,
  autofixAttempts: 0,
  errorMessage: null,
};

/**
 * Manages the build lifecycle for a single generation:
 *   trigger → SSE stream → preview_ready → build_complete
 *
 * If the SSE connection drops mid-build, automatically falls back to
 * polling GET /api/v1/builds/{generationId}/status every 500ms.
 *
 * Each PreviewCard should call this hook independently so builds don't
 * collide across multiple assistant messages.
 */
export function useBuild() {
  const [state, setState] = useState<BuildState>(INITIAL_STATE);
  const cleanupRef = useRef<(() => void) | null>(null);
  const generationIdRef = useRef<string | null>(null);
  // Track whether we've already fallen back to polling so the SSE
  // .then() doesn't overwrite cleanupRef.
  const pollingActiveRef = useRef(false);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  const startPollingFallback = useCallback(() => {
    const genId = generationIdRef.current;
    if (!genId) return;

    pollingActiveRef.current = true;

    const stopPoll = pollBuildStatus(genId, {
      onUpdate: (data: BuildStatusResponse) => {
        // Use functional updaters to avoid stale closures.
        if (data.preview_url) {
          setState((prev) => {
            if (prev.previewUrl) return prev; // already received
            return {
              ...prev,
              phase: "preview_ready",
              previewUrl: data.preview_url!,
              statusMessage: "Preview is ready!",
            };
          });
        }
        if (data.build_status === "success" && data.public_url) {
          setState((prev) => ({
            ...prev,
            phase: "complete",
            publicUrl: data.public_url!,
            autofixAttempts: data.autofix_attempts ?? 0,
            statusMessage: "Your app is ready!",
          }));
        }
        if (data.build_status === "failed") {
          setState((prev) => ({
            ...prev,
            phase: "error",
            errorMessage:
              data.error_message ?? "Build failed. Please try again.",
          }));
        }
      },
      onError: () => {
        // Polling errors are transient — keep retrying.
      },
    });

    cleanupRef.current = stopPoll;
  }, []); // No dependencies — uses refs + functional updaters only.

  const trigger = useCallback(
    (params: {
      generationId: string;
      appId: string;
      version: number;
      spec: Record<string, unknown>;
      templateId: string;
    }) => {
      // Tear down any in-flight stream.
      cleanupRef.current?.();
      cleanupRef.current = null;
      pollingActiveRef.current = false;

      generationIdRef.current = params.generationId;

      setState({
        ...INITIAL_STATE,
        phase: "previewing",
        statusMessage: "Preparing preview...",
      });

      const onEvent = (event: BuildEvent) => {
        if (event.type === "status") {
          setState((prev) => ({
            ...prev,
            statusMessage: event.message,
            stage: event.stage ?? prev.stage,
            // Advance from preview_ready → building when status events
            // arrive after the preview. Also handle the case where the
            // backend skips preview_ready entirely.
            phase:
              prev.phase === "preview_ready" || prev.phase === "previewing"
                ? "building"
                : prev.phase,
          }));
          return;
        }

        if (event.type === "preview_ready") {
          setState((prev) => ({
            ...prev,
            phase: "preview_ready",
            previewUrl: event.preview_url,
            statusMessage: event.message ?? "Preview is ready!",
          }));
          return;
        }

        if (event.type === "build_complete") {
          setState((prev) => ({
            ...prev,
            phase: "complete",
            publicUrl: event.public_url,
            autofixAttempts: event.autofix_attempts ?? 0,
            statusMessage: event.message ?? "Your app is ready!",
          }));
          return;
        }

        if (event.type === "error") {
          setState((prev) => ({
            ...prev,
            phase: "error",
            errorMessage: event.message,
            stage: event.stage ?? prev.stage,
          }));
        }
      };

      const onError = () => {
        // SSE dropped — fall back to polling.
        startPollingFallback();
      };

      streamBuild({
        ...params,
        onEvent,
        onError,
      })
        .then((cleanup) => {
          // Only store the SSE cleanup if we haven't already fallen back
          // to polling (which overwrites cleanupRef).
          if (!pollingActiveRef.current) {
            cleanupRef.current = cleanup;
          }
        })
        .catch(() => {
          // Failed to open SSE — fall back to polling.
          startPollingFallback();
        });
    },
    [startPollingFallback]
  );

  const reset = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    generationIdRef.current = null;
    pollingActiveRef.current = false;
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    isBuilding:
      state.phase === "previewing" ||
      state.phase === "preview_ready" ||
      state.phase === "building",
    isComplete: state.phase === "complete",
    isError: state.phase === "error",
    trigger,
    reset,
  };
}
