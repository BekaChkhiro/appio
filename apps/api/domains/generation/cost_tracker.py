"""Per-generation cost telemetry and rolling p90 alerting (PROJECT_PLAN.md T1.3).

Emits the agreed metric set to PostHog for dashboarding, records each cost in
a Redis-backed rolling window, and fires a Slack webhook when the window's p90
exceeds the configured threshold.

All external I/O is best-effort: telemetry failures are logged and swallowed
so a PostHog/Redis/Slack blip can never break the generation flow that has
already paid real Anthropic credits to produce these numbers.
"""

from __future__ import annotations

import statistics
from dataclasses import asdict, dataclass, field
from typing import Any

import httpx
import redis.asyncio as aioredis
import structlog

from apps.api.config import settings

logger = structlog.stdlib.get_logger()

_REDIS_KEY_COST_WINDOW = "appio:cost:window:generation"
_REDIS_KEY_ALERT_COOLDOWN = "appio:cost:alert:cooldown"

# Lazy singletons — tests and local dev without POSTHOG_API_KEY must not crash
# on import, and we don't want to eagerly open a Redis pool until the first
# generation actually emits.
_posthog_client: Any | None = None
_posthog_init_attempted = False
_redis_pool: aioredis.ConnectionPool | None = None


@dataclass(slots=True)
class CostEvent:
    """Snapshot of a single generation — shape mirrors the PROJECT_PLAN.md
    T1.3 acceptance criteria exactly so the PostHog schema matches what the
    docs promise."""

    generation_id: str
    user_id: str
    user_tier: str
    outcome: str
    iterations: int
    time_seconds: float
    cost_usd: float
    input_tokens: int
    output_tokens: int
    cache_read_input_tokens: int
    cache_write_input_tokens: int
    cache_hit_ratio: float
    # Per-model split (Sonnet vs Haiku). Keyed by model_id.
    model_breakdown: dict[str, dict[str, float | int]] = field(default_factory=dict)


def build_model_breakdown(
    per_step: list[dict[str, Any]],
) -> dict[str, dict[str, float | int]]:
    """Collapse TokenTracker.per_step_summary() into a model-keyed dict.

    PROJECT_PLAN.md requires ``model_breakdown`` (Sonnet vs Haiku token split)
    as a first-class telemetry field; the tracker already exposes per-step
    rows, this folds them into the per-model totals the dashboard needs.
    """
    by_model: dict[str, dict[str, float | int]] = {}
    for step in per_step:
        model = str(step.get("model", "unknown"))
        bucket = by_model.setdefault(
            model,
            {
                "input_tokens": 0,
                "output_tokens": 0,
                "cache_read_tokens": 0,
                "cache_write_tokens": 0,
                "cost_usd": 0.0,
            },
        )
        bucket["input_tokens"] = int(bucket["input_tokens"]) + int(
            step.get("input_tokens", 0)
        )
        bucket["output_tokens"] = int(bucket["output_tokens"]) + int(
            step.get("output_tokens", 0)
        )
        bucket["cache_read_tokens"] = int(bucket["cache_read_tokens"]) + int(
            step.get("cache_read_tokens", 0)
        )
        bucket["cache_write_tokens"] = int(bucket["cache_write_tokens"]) + int(
            step.get("cache_write_tokens", 0)
        )
        bucket["cost_usd"] = round(
            float(bucket["cost_usd"]) + float(step.get("cost_usd", 0.0)), 6
        )
    return by_model


def _get_posthog() -> Any | None:
    global _posthog_client, _posthog_init_attempted
    if _posthog_init_attempted:
        return _posthog_client
    _posthog_init_attempted = True
    if not settings.posthog_api_key:
        return None
    try:
        from posthog import Posthog  # type: ignore[import-not-found]

        _posthog_client = Posthog(
            project_api_key=settings.posthog_api_key,
            host=settings.posthog_host,
            disable_geoip=True,
        )
    except Exception:
        logger.warning("posthog_init_failed", exc_info=True)
        _posthog_client = None
    return _posthog_client


def _get_redis() -> aioredis.Redis:
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.ConnectionPool.from_url(
            settings.redis_url,
            max_connections=5,
            socket_connect_timeout=2,
            decode_responses=False,
        )
    return aioredis.Redis(connection_pool=_redis_pool)


def _emit_to_posthog(event: CostEvent) -> None:
    ph = _get_posthog()
    if ph is None:
        return
    try:
        ph.capture(
            distinct_id=event.user_id or event.generation_id,
            event="generation_completed",
            properties=asdict(event),
        )
    except Exception:
        logger.warning(
            "posthog_capture_failed",
            generation_id=event.generation_id,
            exc_info=True,
        )


async def _send_slack_alert(
    *,
    webhook_url: str,
    p90: float,
    samples: int,
    threshold: float,
    latest_event: CostEvent,
) -> None:
    text = (
        f":rotating_light: *Appio cost alert* — p90 generation cost "
        f"${p90:.3f} over rolling {samples} samples exceeds threshold "
        f"${threshold:.2f} (latest gen `{latest_event.generation_id}`, "
        f"outcome `{latest_event.outcome}`, ${latest_event.cost_usd:.3f})"
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(webhook_url, json={"text": text})
            resp.raise_for_status()
    except Exception:
        logger.warning("slack_cost_alert_failed", exc_info=True)


async def _record_and_check_p90(event: CostEvent) -> None:
    window_size = max(1, settings.cost_alert_window_size)
    threshold = settings.cost_alert_p90_threshold_usd
    # quantiles() needs >=2 points; clamp so a misconfigured env can't crash us.
    min_samples = max(2, settings.cost_alert_min_samples)
    redis_client = _get_redis()

    try:
        pipe = redis_client.pipeline()
        pipe.lpush(_REDIS_KEY_COST_WINDOW, str(event.cost_usd))
        pipe.ltrim(_REDIS_KEY_COST_WINDOW, 0, window_size - 1)
        pipe.lrange(_REDIS_KEY_COST_WINDOW, 0, window_size - 1)
        _, _, raw_values = await pipe.execute()
    except Exception:
        logger.warning(
            "cost_window_record_failed",
            generation_id=event.generation_id,
            exc_info=True,
        )
        return

    values: list[float] = []
    for raw in raw_values:
        try:
            values.append(float(raw))
        except (TypeError, ValueError):
            continue
    if len(values) < min_samples:
        return

    # method="inclusive" gives sensible quantiles on modest sample counts.
    p90 = statistics.quantiles(values, n=10, method="inclusive")[-1]
    logger.debug(
        "cost_window_p90",
        samples=len(values),
        p90_usd=round(p90, 4),
        threshold_usd=threshold,
    )
    if p90 <= threshold:
        return
    webhook = settings.slack_cost_alert_webhook_url
    if not webhook:
        return

    # Atomic SET NX EX — first generation to breach threshold claims the
    # cooldown window; every other concurrent generation sees `claimed=None`
    # and skips the alert until the TTL expires.
    try:
        claimed = await redis_client.set(
            _REDIS_KEY_ALERT_COOLDOWN,
            b"1",
            ex=max(1, settings.cost_alert_cooldown_seconds),
            nx=True,
        )
    except Exception:
        logger.warning("cost_alert_cooldown_failed", exc_info=True)
        return
    if not claimed:
        return

    await _send_slack_alert(
        webhook_url=webhook,
        p90=p90,
        samples=len(values),
        threshold=threshold,
        latest_event=event,
    )


async def record_generation_cost(event: CostEvent) -> None:
    """Public entry — emit telemetry + check rolling p90 alert.

    Best-effort; never raises. Callers must not gate the generation flow on
    the result of this coroutine (it has no meaningful return signal).
    """
    logger.info("generation_cost", **asdict(event))
    _emit_to_posthog(event)
    await _record_and_check_p90(event)
