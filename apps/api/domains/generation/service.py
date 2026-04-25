"""Claude API integration + prompt pipeline.

Responsibilities:
- Async Claude client (anthropic SDK)
- System prompt loading + template context injection
- SSE streaming with heartbeat keep-alive
- Token counting and cost tracking
- Idempotency key support (Redis-backed)
- Generation record persistence (Neon)
"""

from __future__ import annotations

import functools
import json
import uuid
from pathlib import Path
from typing import Any

import anthropic
import redis.asyncio as aioredis
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from appio_db.models import Generation, Template
from apps.api.config import settings

logger = structlog.stdlib.get_logger()

# Claude API pricing (Sonnet 4.6) — dollars per million tokens
# Source: https://docs.anthropic.com/en/docs/about-claude/models
_INPUT_COST_PER_M = 3.00
_OUTPUT_COST_PER_M = 15.00

# Paths
_PROMPTS_DIR = Path(__file__).resolve().parents[4] / "packages" / "prompts"

# Request timeout for Claude (large apps can take 60-120s)
_CLAUDE_TIMEOUT_S = 120.0

# Model to use for generation
_MODEL_ID = "claude-sonnet-4-6"


@functools.lru_cache(maxsize=1)
def _load_system_prompt() -> str:
    """Load the versioned system prompt from packages/prompts/v1/system.md.

    Cached after first read — restart the process to pick up changes.
    """
    prompt_path = _PROMPTS_DIR / "v1" / "system.md"
    return prompt_path.read_text(encoding="utf-8")


def _build_template_context(templates: list[Template]) -> str:
    """Format available templates for injection into the system prompt.

    Includes per-component prop schemas so Claude knows exactly which
    props are allowed and won't invent unsupported ones.
    """
    if not templates:
        return "(No templates available yet.)"

    lines: list[str] = []
    for t in templates:
        config_summary = ""
        if t.config_json:
            components = t.config_json.get("components", [])
            prop_schemas = t.config_json.get("propSchemas", {})
            if components:
                config_summary = f" — components: {', '.join(components)}"
        lines.append(f"- **{t.id}** ({t.display_name}, category: {t.category}){config_summary}")

        # Add prop schemas per component
        if t.config_json and prop_schemas:
            for comp_name in components:
                props = prop_schemas.get(comp_name, {})
                if props:
                    prop_list = ", ".join(f"`{k}` ({v})" for k, v in props.items())
                    lines.append(f"  - {comp_name} props: {prop_list}")

    return "\n".join(lines)


def _compute_cost(input_tokens: int, output_tokens: int) -> float:
    """Compute USD cost from token counts."""
    return round(
        (input_tokens / 1_000_000) * _INPUT_COST_PER_M
        + (output_tokens / 1_000_000) * _OUTPUT_COST_PER_M,
        6,
    )


async def _redis_get(key: str) -> bytes | None:
    """Get a value from Redis with proper connection cleanup."""
    async with aioredis.from_url(settings.redis_url, socket_connect_timeout=2) as r:
        return await r.get(key)


async def _redis_set(key: str, value: str, ex: int) -> None:
    """Set a value in Redis with proper connection cleanup."""
    async with aioredis.from_url(settings.redis_url, socket_connect_timeout=2) as r:
        await r.set(key, value, ex=ex)


class GenerationService:
    """Orchestrates Claude API calls for app generation.

    IMPORTANT: The caller must ensure the AsyncSession outlives the async generator
    returned by `generate()`. Do NOT use FastAPI's `Depends(get_db)` with streaming
    endpoints — create and manage the session inside the streaming body instead.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            timeout=_CLAUDE_TIMEOUT_S,
        )

    async def _get_active_templates(self) -> list[Template]:
        result = await self._db.execute(
            select(Template).where(Template.is_active.is_(True))
        )
        return list(result.scalars().all())

    async def _get_cached_result(self, idempotency_key: str) -> dict | None:
        """Check Redis for a completed generation under this idempotency key."""
        try:
            raw = await _redis_get(f"gen:idem:{idempotency_key}")
            if raw:
                return json.loads(raw)
        except Exception:
            logger.warning("redis_idempotency_lookup_failed", key=idempotency_key)
        return None

    async def _cache_result(self, idempotency_key: str, result: dict) -> None:
        """Store completed generation in Redis (TTL 1 hour)."""
        try:
            await _redis_set(
                f"gen:idem:{idempotency_key}",
                json.dumps(result),
                ex=3600,
            )
        except Exception:
            logger.warning("redis_idempotency_cache_failed", key=idempotency_key)

    async def _create_generation_record(
        self,
        user_id: uuid.UUID,
        prompt: str,
        app_id: uuid.UUID | None,
    ) -> Generation:
        """Insert a pending generation row."""
        gen = Generation(
            user_id=user_id,
            app_id=app_id,
            prompt=prompt,
            build_status="generating",
        )
        self._db.add(gen)
        await self._db.flush()
        return gen

    async def _update_generation_record(
        self,
        gen: Generation,
        *,
        hybrid_spec: dict | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cost_usd: float = 0.0,
        build_status: str = "pending",
    ) -> None:
        gen.hybrid_spec = hybrid_spec
        gen.input_tokens = input_tokens
        gen.output_tokens = output_tokens
        gen.cost_usd = cost_usd
        gen.build_status = build_status
        await self._db.flush()

    async def generate(
        self,
        *,
        user_id: uuid.UUID,
        prompt: str,
        app_id: uuid.UUID | None = None,
        idempotency_key: str | None = None,
    ):
        """Async generator yielding SSE-formatted strings.

        Streams progress events, then the final hybrid spec.
        The router wraps this with heartbeat keep-alive (`: keep-alive`` every 15s).
        """
        # --- Idempotency check ---
        if idempotency_key:
            cached = await self._get_cached_result(idempotency_key)
            if cached:
                logger.info("idempotency_cache_hit", key=idempotency_key)
                yield _sse("cache_hit", "Resuming from cached result.")
                yield _sse(
                    "complete",
                    "Generation complete (cached).",
                    spec=cached.get("spec"),
                    generation_id=cached.get("generation_id"),
                )
                return

        # --- Load templates + build system prompt ---
        yield _sse("status", "Loading templates...")
        templates = await self._get_active_templates()
        template_context = _build_template_context(templates)
        system_prompt = _load_system_prompt().replace("{templates}", template_context)

        # --- Create generation record ---
        gen = await self._create_generation_record(user_id, prompt, app_id)
        generation_id = str(gen.id)
        yield _sse("status", "Starting generation...", generation_id=generation_id)

        # --- Call Claude API with streaming ---
        input_tokens = 0
        output_tokens = 0
        collected_text = ""

        try:
            async with self._client.messages.stream(
                model=_MODEL_ID,
                max_tokens=8192,
                thinking={"type": "adaptive"},
                system=system_prompt,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_delta":
                        # Only collect text deltas, not thinking deltas
                        if hasattr(event.delta, "text"):
                            collected_text += event.delta.text

                final_message = await stream.get_final_message()

            input_tokens = final_message.usage.input_tokens
            output_tokens = final_message.usage.output_tokens
            cost = _compute_cost(input_tokens, output_tokens)

            logger.info(
                "claude_generation_complete",
                generation_id=generation_id,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost,
            )

        except anthropic.APITimeoutError:
            await self._update_generation_record(gen, build_status="failed")
            yield _sse("error", "Generation timed out. Try a simpler prompt.")
            return
        except anthropic.APIError as exc:
            await self._update_generation_record(gen, build_status="failed")
            logger.error("claude_api_error", error=str(exc), generation_id=generation_id)
            yield _sse("error", "Generation failed. Please try again.")
            return

        # --- Parse the JSON spec ---
        yield _sse("status", "Validating app spec...")

        if not collected_text.strip():
            await self._update_generation_record(
                gen, build_status="failed",
                input_tokens=input_tokens, output_tokens=output_tokens,
                cost_usd=_compute_cost(input_tokens, output_tokens),
            )
            logger.warning("claude_empty_response", generation_id=generation_id)
            yield _sse("error", "AI returned an empty response. Please try a different prompt.")
            return

        try:
            spec = json.loads(collected_text)
        except json.JSONDecodeError:
            await self._update_generation_record(
                gen, build_status="failed",
                input_tokens=input_tokens, output_tokens=output_tokens,
                cost_usd=_compute_cost(input_tokens, output_tokens),
            )
            logger.warning(
                "spec_json_parse_failed",
                generation_id=generation_id,
                raw_length=len(collected_text),
            )
            yield _sse("error", "Failed to parse AI response. Please try again.")
            return

        cost = _compute_cost(input_tokens, output_tokens)

        # --- Persist generation result ---
        await self._update_generation_record(
            gen,
            hybrid_spec=spec,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            build_status="pending",
        )

        # --- Cache for idempotency ---
        if idempotency_key:
            await self._cache_result(
                idempotency_key,
                {"spec": spec, "generation_id": generation_id},
            )

        yield _sse(
            "complete",
            "Generation complete!",
            spec=spec,
            generation_id=generation_id,
            tokens={"input_tokens": input_tokens, "output_tokens": output_tokens, "cost_usd": cost},
        )


def _sse(
    event_type: str,
    message: str | None = None,
    *,
    spec: dict | None = None,
    generation_id: str | None = None,
    tokens: dict | None = None,
) -> str:
    """Format a single SSE data line."""
    payload: dict[str, Any] = {"type": event_type}
    if message is not None:
        payload["message"] = message
    if spec is not None:
        payload["spec"] = spec
    if generation_id is not None:
        payload["generation_id"] = generation_id
    if tokens is not None:
        payload["tokens"] = tokens
    return f"data: {json.dumps(payload)}\n\n"
