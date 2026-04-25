"""Generation endpoint — agent-only pipeline (prompt → Claude agent → PWA).

T2.2b: The agent pipeline is now the sole generation engine. The old JSON-spec
codegen path has been removed. ``POST /`` runs the agent tool-use loop with
full Firebase auth, rate limiting, and idempotency support.
"""

from __future__ import annotations

import asyncio
import json

import structlog
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from appio_db import get_session_factory
from apps.api.core.rate_limit import invalidate_monthly_budget_cache, set_cooldown
from apps.api.core.security import FirebaseUser
from apps.api.dependencies import RateLimitResult, enforce_generation_limits, require_verified_email
from apps.api.domains.generation.agent_service import AgentService
from apps.api.domains.generation.schemas import GenerateRequest
from apps.api.domains.templates.service import increment_use_count

logger = structlog.stdlib.get_logger()

router = APIRouter()

# SSE heartbeat interval in seconds (prevents Fly.io ~60s idle timeout)
_HEARTBEAT_S = 15


@router.post("/")
async def generate_app(
    body: GenerateRequest,
    rl: RateLimitResult = Depends(enforce_generation_limits),
    _verified: FirebaseUser = Depends(require_verified_email),
) -> StreamingResponse:
    """Generate an app from a user prompt via the Claude agent pipeline.

    The agent is given a fresh React workspace and four tools
    (list_files, read_file, write_file, run_build) to build the app.
    When the agent finishes, the workspace is deployed via the standard
    validate → R2 → KV pipeline to {slug}.appiousercontent.com.

    Rate limits are enforced by the enforce_generation_limits dependency:
    - Daily generation count (free: 3/day, Pro/Creator: unlimited)
    - Monthly cost budget ($1 free, $50 Pro, $100 Creator)
    - Progressive cooldown (30s after first 2 generations, free tier only)

    Events:
        data: {"type": "status", "message": "..."}             — progress updates
        data: {"type": "agent_turn", "iterations": N, ...}     — agent loop progress
        data: {"type": "tool_call", "tool_name": "..."}        — tool invocation
        data: {"type": "agent_text", "message": "..."}         — agent commentary
        data: {"type": "preview_ready", "url": "..."}          — live preview available
        data: {"type": "complete", "public_url": "...", ...}   — final deployed URL
        data: {"type": "error", "message": "..."}              — failure
        : keep-alive                                            — heartbeat (every 15s)

    NOTE: We do NOT use Depends(get_db) here because FastAPI closes dependency-
    injected sessions when the endpoint function returns — before the streaming
    body starts executing. The AgentService takes a session FACTORY and opens
    short-lived sessions internally because the agent loop runs for minutes
    and Neon's pooler closes idle connections.
    """
    user = rl.user
    user_id = user.id
    user_tier = user.tier or "free"

    # Analytics: increment marketplace template use_count. Fire-and-forget —
    # a DB blip here must not block generation. Uses a fresh session (we
    # intentionally don't share the rate-limit session since it closes as
    # soon as this endpoint returns).
    if body.template_slug:
        async def _track_template_use(slug: str) -> None:
            try:
                factory = get_session_factory()
                async with factory() as session:
                    await increment_use_count(session, slug)
                    await session.commit()
            except Exception:
                logger.exception("template_use_count_bump_failed", slug=slug)

        asyncio.create_task(_track_template_use(body.template_slug))

    async def event_stream():
        """Produce SSE events with interleaved heartbeat keep-alive."""
        session_factory = get_session_factory()
        service = AgentService(session_factory)

        gen = service.generate(
            user_id=user_id,
            prompt=body.prompt,
            app_id=body.app_id,
            user_tier=user_tier,
        )

        queue: asyncio.Queue[str | None] = asyncio.Queue()

        async def _producer():
            try:
                async for event in gen:
                    await queue.put(event)
            except Exception as exc:
                logger.exception("agent_stream_error")
                error_msg = json.dumps({
                    "type": "error",
                    "message": f"Internal error: {type(exc).__name__}",
                })
                await queue.put(f"data: {error_msg}\n\n")
            finally:
                await queue.put(None)  # sentinel

        producer_task = asyncio.create_task(_producer())

        try:
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=_HEARTBEAT_S)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue

                if item is None:
                    break
                yield item
        finally:
            producer_task.cancel()
            try:
                await producer_task
            except asyncio.CancelledError:
                pass

        # Invalidate monthly budget cache so next request sees fresh cost
        await invalidate_monthly_budget_cache(user_id)

        # Set progressive cooldown after successful generation (free tier)
        if user_tier == "free":
            await set_cooldown(user_id)

    # Build response headers including rate limit info
    headers: dict[str, str] = {
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    }
    if rl.limit > 0:
        headers["X-RateLimit-Limit"] = str(rl.limit)
        headers["X-RateLimit-Remaining"] = str(max(rl.remaining, 0))
        headers["X-RateLimit-Reset"] = str(rl.reset)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers=headers,
    )
