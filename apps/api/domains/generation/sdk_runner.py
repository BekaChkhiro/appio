"""Claude Agent SDK runner.

Phase 1 of the SDK migration (ADR 009). Replaces the inner tool loop in
``agent_service._run_tool_loop`` with ``ClaudeSDKClient`` orchestration. The
public surface is a single async generator, ``run_sdk_tool_loop``, that yields
the same ``(event_type, payload)`` tuples the caller already forwards as SSE.

Sandbox hooks are mandatory because the spike showed ``acceptEdits`` does not
restrict ``Write``/``Edit`` to ``cwd``. See ADR 008b.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, AsyncIterator

import structlog
from claude_agent_sdk import (
    ClaudeAgentOptions,
    ClaudeSDKClient,
    HookMatcher,
    ResultMessage,
)

from apps.api.config import settings
from apps.api.domains.generation.model_router import (
    SONNET_4_5,
    AgentStep,
    ModelConfig,
    StepTokens,
    TokenTracker,
)
from apps.api.domains.generation.sdk_event_map import map_message
from apps.api.domains.generation.sdk_hooks import (
    make_sandbox_hook,
    make_secret_scan_hook,
)

logger = structlog.stdlib.get_logger()


# Tools the SDK exposes to Claude. We allow the codegen-relevant built-ins
# only — WebFetch / WebSearch / NotebookEdit are intentionally excluded.
_ALLOWED_TOOLS: list[str] = [
    "Read",
    "Write",
    "Edit",
    "MultiEdit",
    "Glob",
    "Grep",
    "Bash",
    "Skill",  # required for skills, even though Phase 4 hasn't authored any yet
]

_DISALLOWED_TOOLS: list[str] = [
    "WebFetch",
    "WebSearch",
    "NotebookEdit",
]


def _build_options(
    *,
    workspace: Path,
    model: ModelConfig,
    max_turns: int,
    max_budget_usd: float,
    extra_system_prompt: str | None,
) -> ClaudeAgentOptions:
    """Assemble ``ClaudeAgentOptions`` for a single generation run."""
    sandbox_hook = make_sandbox_hook(workspace)
    secret_hook = make_secret_scan_hook()

    # Inherit Claude Code's coding-tuned baseline and append our stack rules.
    # The legacy v1 system prompt remains the source of truth for stack-specific
    # guidance; passing it as ``append`` keeps Claude Code's tool-use heuristics.
    system_prompt: dict[str, Any] = {
        "type": "preset",
        "preset": "claude_code",
    }
    if extra_system_prompt:
        system_prompt["append"] = extra_system_prompt

    return ClaudeAgentOptions(
        model=model.model_id,
        cwd=str(workspace),
        permission_mode="acceptEdits",
        allowed_tools=_ALLOWED_TOOLS,
        disallowed_tools=_DISALLOWED_TOOLS,
        # ``setting_sources=[]`` for Phase 1 — Phase 4 will switch to
        # ``["project"]`` once we ship a skills bundle.
        setting_sources=[],
        max_turns=max_turns,
        max_budget_usd=max_budget_usd,
        system_prompt=system_prompt,
        env={"ANTHROPIC_API_KEY": settings.anthropic_api_key},
        hooks={
            "PreToolUse": [
                # Sandbox: deny Write/Edit/MultiEdit outside cwd; deny dangerous
                # Bash patterns. Read intentionally not scoped — SDK probes
                # internal config files during init.
                HookMatcher(matcher="Write|Edit|MultiEdit|Bash", hooks=[sandbox_hook]),
                HookMatcher(matcher="Write|Edit|MultiEdit", hooks=[secret_hook]),
            ],
        },
    )


def _record_usage(step_tokens: StepTokens, msg: ResultMessage) -> None:
    """Fold the SDK's per-turn usage into our existing ``StepTokens``."""
    usage = msg.usage or {}
    step_tokens.add(
        input_tokens=int(usage.get("input_tokens", 0)),
        output_tokens=int(usage.get("output_tokens", 0)),
        cache_read_tokens=int(usage.get("cache_read_input_tokens", 0)),
        cache_write_tokens=int(usage.get("cache_creation_input_tokens", 0)),
    )


async def run_sdk_tool_loop(
    *,
    workspace: Path,
    user_prompt: str,
    extra_system_prompt: str | None,
    tracker: TokenTracker,
    step: AgentStep,
    max_iterations: int,
    generation_id: str,
    iteration_offset: int = 0,
    budget_usd: float,
    cancel_event: asyncio.Event | None = None,
) -> AsyncIterator[tuple[str, dict[str, Any]]]:
    """Run one SDK tool loop, yielding events compatible with the legacy contract.

    Args:
        workspace: Sandboxed working directory the agent is allowed to touch.
        user_prompt: First user-turn content. Multi-turn history is not
            supported in Phase 1; that lives in the still-legacy fix pass
            until a follow-up phase adds session resume.
        extra_system_prompt: Stack-specific guidance appended to Claude
            Code's preset.
        tracker: Cost accumulator. The runner calls ``tracker.begin_step``
            internally — callers must not pre-call it for this step.
        step: Pipeline step label for cost reporting.
        max_iterations: Cap on tool-use turns (mapped to SDK ``max_turns``).
        generation_id: Used in structured log fields only.
        iteration_offset: Pre-existing iteration count to add to per-turn
            event payloads so the frontend's running counter stays
            monotonic across multi-step pipelines.
        budget_usd: Per-loop budget. Mapped to SDK ``max_budget_usd``;
            slightly redundant with ``tracker.total_cost_usd`` checks but
            ensures the SDK terminates even if our caller forgets.
        cancel_event: When set, the runner calls ``client.interrupt()`` and
            drains the buffer. Disconnecting SSE clients should set it.

    The final yield is always ``("done", {"reason", "iterations", "final_text", ...})``
    matching the legacy contract.
    """
    # Force SONNET_4_5 for SDK runs — the bundled Claude Code CLI doesn't
    # recognize the "claude-sonnet-4-6" alias used by the legacy raw-API
    # path, even though both alias to the same underlying weights.
    step_tokens = tracker.begin_step(step, model_override=SONNET_4_5)
    options = _build_options(
        workspace=workspace,
        model=step_tokens.model,
        max_turns=max_iterations,
        max_budget_usd=budget_usd,
        extra_system_prompt=extra_system_prompt,
    )

    logger.info(
        "sdk_tool_loop_start",
        generation_id=generation_id,
        step=step.value,
        model=step_tokens.model.model_id,
        workspace=str(workspace),
        max_iterations=max_iterations,
    )

    # Track the most recent ResultMessage so the final "done" event can
    # carry the actual reason/cost. The SDK emits ResultMessage at the end
    # of each turn group; for a single ``query()`` it's the terminal frame.
    last_result_done: tuple[str, dict[str, Any]] | None = None
    final_text_acc: list[str] = []
    cumulative_cost = 0.0
    interrupted = False

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(user_prompt)
            try:
                async for msg in client.receive_response():
                    # Honor cancellation BEFORE forwarding the message —
                    # if the user disconnected, even a "tool_call" event
                    # is wasted work for the SSE pipeline.
                    if cancel_event is not None and cancel_event.is_set():
                        if not interrupted:
                            logger.info(
                                "sdk_tool_loop_interrupting",
                                generation_id=generation_id,
                            )
                            await client.interrupt()
                            interrupted = True
                        break

                    is_result = isinstance(msg, ResultMessage)
                    if is_result:
                        _record_usage(step_tokens, msg)
                        cumulative_cost += float(msg.total_cost_usd or 0.0)
                        if not msg.is_error and msg.result:
                            final_text_acc.append(msg.result)

                    for event_type, payload in map_message(
                        msg,
                        iteration_offset=iteration_offset,
                        cumulative_iterations=0,
                        cumulative_cost_usd=cumulative_cost,
                    ):
                        if event_type == "done":
                            # Capture but DON'T yield yet — drain the SDK
                            # buffer first so any trailing rate-limit
                            # frames are consumed before we close out.
                            last_result_done = (event_type, payload)
                        else:
                            yield event_type, payload

                    # ResultMessage is terminal for a single client.query()
                    # call. The CLI's stream stays open after it (the SDK
                    # is multi-query-capable on one client) so the iterator
                    # blocks indefinitely if we don't break here. The
                    # async-with on ClaudeSDKClient handles socket cleanup
                    # — no drain needed unless we hit interrupt().
                    if is_result:
                        break
            finally:
                # Drain only after an explicit interrupt(). Re-entering
                # receive_response() in the normal-finish case re-blocks
                # because receive_response() doesn't end on ResultMessage —
                # it stays open for the next query() the SDK design
                # supports. async-with __aexit__ handles transport close.
                if interrupted:
                    try:
                        async for _ in client.receive_response():
                            pass
                    except Exception:
                        pass
    except asyncio.CancelledError:
        # Asyncio cancellation (e.g. Dramatiq actor timeout) — surface as a
        # graceful done so the caller's outer logic still records cost.
        logger.info("sdk_tool_loop_cancelled", generation_id=generation_id)
        yield (
            "done",
            {
                "reason": "cancelled",
                "iterations": iteration_offset,
                "final_text": "",
            },
        )
        raise
    except Exception as exc:
        # SDK init/transport failures bubble up as ClaudeSDKError or
        # similar. Convert to ``done`` with reason="api_error" so the
        # caller's existing recovery branch fires (e.g., fall back to a
        # previously-built dist/ if one exists).
        logger.exception(
            "sdk_tool_loop_failed",
            generation_id=generation_id,
            step=step.value,
        )
        yield (
            "done",
            {
                "reason": "api_error",
                "error": f"{type(exc).__name__}: {exc}",
                "iterations": iteration_offset,
                "final_text": "",
            },
        )
        return

    if interrupted:
        yield (
            "done",
            {
                "reason": "cancelled",
                "iterations": iteration_offset,
                "final_text": "",
            },
        )
        return

    if last_result_done is not None:
        # Stamp the captured ``done`` with the final tracker cost so the
        # caller can compare against ``budget_usd`` with confidence.
        ev, payload = last_result_done
        payload.setdefault("final_text", "\n".join(final_text_acc)[:2000])
        yield ev, payload
    else:
        # No ResultMessage seen — likely the iterator ended on a
        # transport error before the final frame. Treat as api_error so
        # the caller's recovery branch can decide what to do.
        yield (
            "done",
            {
                "reason": "api_error",
                "error": "SDK iterator ended without ResultMessage",
                "iterations": iteration_offset,
                "final_text": "",
            },
        )


# ── Convenience for ad-hoc scripts / tests ──────────────────────────────


async def run_sdk_one_shot(
    *,
    workspace: Path,
    prompt: str,
    extra_system_prompt: str | None = None,
    model_id: str = "claude-sonnet-4-5",
    max_turns: int = 30,
    budget_usd: float = 1.00,
) -> dict[str, Any]:
    """Single-shot helper for spikes/tests. Not used by AgentService.

    Yields are flattened into a list and returned alongside cost summary.
    """
    from apps.api.domains.generation.model_router import _MODEL_LOOKUP

    tracker = TokenTracker()
    # Spoof the routing so the spike can choose a cheaper/different model
    # without touching the global config.
    model = _MODEL_LOOKUP.get(model_id) or _MODEL_LOOKUP["claude-sonnet-4-5"]

    events: list[tuple[str, dict[str, Any]]] = []
    async for ev in run_sdk_tool_loop(
        workspace=workspace,
        user_prompt=prompt,
        extra_system_prompt=extra_system_prompt,
        tracker=tracker,
        step=AgentStep.GENERATION,
        max_iterations=max_turns,
        generation_id="oneshot",
        budget_usd=budget_usd,
    ):
        events.append(ev)

    return {
        "events": events,
        "tracker": tracker.per_step_summary(),
        "total_cost_usd": tracker.total_cost_usd,
    }


__all__ = ["run_sdk_tool_loop", "run_sdk_one_shot"]
