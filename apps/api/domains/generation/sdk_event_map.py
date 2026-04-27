"""Translate ``claude_agent_sdk`` Message types into our internal SSE event tuples.

The legacy tool loop yields ``(event_type, payload)`` tuples that
``router.event_stream`` formats into ``data: {...}\\n\\n`` SSE frames. The SDK
emits a different shape (typed dataclasses with content blocks). This module
is the only place that knows the mapping, so swapping the runner doesn't ripple
into the router or frontend.
"""

from __future__ import annotations

from typing import Any, Iterator

from claude_agent_sdk import (
    AssistantMessage,
    ResultMessage,
    SystemMessage,
    TextBlock,
    ThinkingBlock,
    ToolUseBlock,
    UserMessage,
)


def map_message(
    msg: Any,
    *,
    iteration_offset: int,
    cumulative_iterations: int,
    cumulative_cost_usd: float,
) -> Iterator[tuple[str, dict[str, Any]]]:
    """Yield zero or more ``(event_type, payload)`` tuples for an SDK message.

    Args:
        msg: An SDK ``Message`` instance.
        iteration_offset: Iteration number to add to per-loop counts so the
            frontend's running counter stays monotonic across multi-step
            pipelines (initial → fix pass).
        cumulative_iterations: Total iterations already counted across all
            steps in this generation.
        cumulative_cost_usd: Total cost spent so far in this generation.

    The caller is responsible for advancing ``cumulative_*`` between calls.
    """
    if isinstance(msg, SystemMessage):
        if msg.subtype == "init":
            yield (
                "status",
                {"message": "Initializing builder", "session_id": _safe_session_id(msg)},
            )
        return

    if isinstance(msg, AssistantMessage):
        for block in msg.content:
            if isinstance(block, TextBlock):
                text = block.text.strip()
                if text:
                    # Cap to match legacy 500-char snippet behavior — stops a
                    # rambling final summary from spamming the SSE stream.
                    yield ("agent_text", {"text": text[:500]})
            elif isinstance(block, ToolUseBlock):
                path = ""
                if isinstance(block.input, dict):
                    path = (
                        block.input.get("file_path")
                        or block.input.get("path")
                        or block.input.get("pattern")
                        or block.input.get("command", "")
                    )
                    if not isinstance(path, str):
                        path = str(path)
                yield ("tool_call", {"name": block.name, "path": path[:200]})
            elif isinstance(block, ThinkingBlock):
                # Don't surface raw thinking to users — emit a status hint
                # so the spinner has something to say without leaking
                # internal reasoning.
                yield ("status", {"message": "Reasoning"})
        return

    if isinstance(msg, UserMessage):
        # The SDK echoes tool results as UserMessage(tool_use_result=...).
        # We don't need to forward these — the frontend already showed the
        # `tool_call` event, and the SDK's next AssistantMessage will be
        # the model's reaction. Surfacing the raw result tends to flood
        # the chat with noisy diff text the user can't act on.
        return

    if isinstance(msg, ResultMessage):
        usage = msg.usage or {}
        # SDK reports cumulative cost since session start in total_cost_usd;
        # we add it on top of the cumulative_cost_usd the caller has been
        # tracking across SDK calls (e.g., generation + fix pass).
        cost_now = float(msg.total_cost_usd or 0.0)
        yield (
            "agent_turn",
            {
                "iteration": iteration_offset + (msg.num_turns or 0),
                "cost_usd": round(cumulative_cost_usd + cost_now, 6),
                "input_tokens": int(usage.get("input_tokens", 0)),
                "output_tokens": int(usage.get("output_tokens", 0)),
                "cache_read_tokens": int(usage.get("cache_read_input_tokens", 0)),
                "cache_write_tokens": int(usage.get("cache_creation_input_tokens", 0)),
                "duration_ms": int(msg.duration_ms or 0),
            },
        )

        if msg.is_error:
            yield (
                "done",
                {
                    "reason": _classify_error(msg.subtype),
                    "error": msg.result or msg.subtype or "unknown",
                    "iterations": (msg.num_turns or 0) + iteration_offset,
                    "final_text": "",
                },
            )
        else:
            yield (
                "done",
                {
                    "reason": "end_turn",
                    "iterations": (msg.num_turns or 0) + iteration_offset,
                    "final_text": (msg.result or "")[:2000],
                },
            )
        return

    # Unknown message type — log via status so it's visible without
    # crashing the run. Keep the type name short so SSE payload doesn't
    # blow up if something exotic appears.
    yield ("status", {"message": f"Unhandled SDK message: {type(msg).__name__}"})


def _safe_session_id(msg: SystemMessage) -> str | None:
    data = getattr(msg, "data", None)
    if isinstance(data, dict):
        sid = data.get("session_id")
        if isinstance(sid, str):
            return sid
    return None


_ERROR_REASON_MAP = {
    "error_max_turns": "max_iterations",
    "error_during_execution": "api_error",
    "error_max_budget": "budget",
}


def _classify_error(subtype: str | None) -> str:
    if not subtype:
        return "api_error"
    return _ERROR_REASON_MAP.get(subtype, "api_error")
