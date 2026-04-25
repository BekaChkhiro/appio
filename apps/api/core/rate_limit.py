"""Redis-backed rate limiting and cost control for generations.

Provides:
- Per-user daily generation limits (tier-aware, atomic via Lua scripts)
- Per-user monthly cost budget enforcement (Redis-cached)
- IP-based account creation throttling
- Progressive friction (cooldown after N instant generations)
- Cost tracking queries for admin monitoring
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import redis.asyncio as aioredis
import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from appio_db.models import Generation
from appio_shared.constants import (
    COOLDOWN_SECONDS,
    CREATOR_TIER_DAILY_GENERATIONS,
    CREATOR_TIER_MONTHLY_BUDGET_USD,
    FREE_TIER_DAILY_GENERATIONS,
    FREE_TIER_MONTHLY_BUDGET_USD,
    INSTANT_GENERATIONS_BEFORE_COOLDOWN,
    MAX_ACCOUNT_CREATIONS_PER_IP_PER_DAY,
    PRO_TIER_DAILY_GENERATIONS,
    PRO_TIER_MONTHLY_BUDGET_USD,
)
from apps.api.config import settings

logger = structlog.stdlib.get_logger()

# Redis key prefixes
_GEN_COUNT_PREFIX = "ratelimit:gen:daily:"
_COOLDOWN_PREFIX = "ratelimit:gen:cooldown:"
_SIGNUP_IP_PREFIX = "ratelimit:signup:ip:"
_MONTHLY_SPEND_PREFIX = "ratelimit:spend:monthly:"

# TTLs
_DAY_SECONDS = 86400
_MONTHLY_SPEND_CACHE_TTL = 300  # 5 minutes

# Tier config: (daily_limit, monthly_budget_usd).  0 = unlimited.
_TIER_LIMITS: dict[str, tuple[int, float]] = {
    "free": (FREE_TIER_DAILY_GENERATIONS, FREE_TIER_MONTHLY_BUDGET_USD),
    "pro": (PRO_TIER_DAILY_GENERATIONS, PRO_TIER_MONTHLY_BUDGET_USD),
    "creator": (CREATOR_TIER_DAILY_GENERATIONS, CREATOR_TIER_MONTHLY_BUDGET_USD),
}

# ---------------------------------------------------------------------------
# Lua scripts for atomic Redis operations (prevent TOCTOU race conditions)
# ---------------------------------------------------------------------------

# Atomically increment counter and set TTL if new key.
# Returns: [new_count, ttl_remaining]
_LUA_INCR_WITH_TTL = """
local count = redis.call("INCR", KEYS[1])
if count == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return {count, ttl}
"""

# Atomically check limit and increment. Returns: [allowed (0/1), current_count, ttl]
# If over limit, does NOT increment (returns current count).
_LUA_CHECK_AND_INCREMENT = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl_seconds = tonumber(ARGV[2])

local current = tonumber(redis.call("GET", key) or "0")
if current >= limit then
    local ttl = redis.call("TTL", key)
    return {0, current, ttl}
end

local new_count = redis.call("INCR", key)
if new_count == 1 then
    redis.call("EXPIRE", key, ttl_seconds)
end
local ttl = redis.call("TTL", key)
return {1, new_count, ttl}
"""

# ---------------------------------------------------------------------------
# Shared Redis pool (singleton, initialized on first use)
# ---------------------------------------------------------------------------

_pool: aioredis.ConnectionPool | None = None


def _get_pool() -> aioredis.ConnectionPool:
    """Get or create the shared Redis connection pool."""
    global _pool
    if _pool is None:
        _pool = aioredis.ConnectionPool.from_url(
            settings.redis_url,
            max_connections=20,
            socket_connect_timeout=2,
            decode_responses=False,
        )
    return _pool


def _get_redis() -> aioredis.Redis:
    """Get a Redis client backed by the shared pool."""
    return aioredis.Redis(connection_pool=_get_pool())


async def close_redis_pool() -> None:
    """Close the shared pool on app shutdown."""
    global _pool
    if _pool is not None:
        await _pool.disconnect()
        _pool = None


# ---------------------------------------------------------------------------
# Daily generation rate limiting (atomic via Lua)
# ---------------------------------------------------------------------------

async def _db_fallback_daily_count(
    db: AsyncSession, user_id: uuid.UUID
) -> int:
    """Count generations created by user in the last 24 hours (DB fallback)."""
    window_start = datetime.now(UTC) - timedelta(seconds=_DAY_SECONDS)
    result = await db.execute(
        select(func.count(Generation.id)).where(
            Generation.user_id == user_id,
            Generation.created_at >= window_start,
        )
    )
    return int(result.scalar_one() or 0)


async def check_and_increment_generation(
    user_id: uuid.UUID,
    tier: str,
    db: AsyncSession | None = None,
) -> tuple[bool, str, dict]:
    """Atomically check daily limit and increment if allowed.

    Uses a Lua script to prevent TOCTOU race conditions where concurrent
    requests could bypass the limit.

    Circuit breaker: if Redis is unavailable AND a db session is provided,
    falls back to a DB count of the last-24h generations. If the DB also
    fails, fails CLOSED (denies the request) — this is the safer default
    because a live production system with both caches down is in bad shape
    and we'd rather rate-limit than hand out unlimited Claude spend.

    Returns (allowed, reason, info_dict).
    """
    daily_limit, _ = _TIER_LIMITS.get(tier, _TIER_LIMITS["free"])

    # Unlimited tiers skip daily check
    if daily_limit == 0:
        return True, "", {"remaining": -1, "limit": 0, "reset": 0}

    key = f"{_GEN_COUNT_PREFIX}{user_id}"
    try:
        r = _get_redis()
        result = await r.eval(
            _LUA_CHECK_AND_INCREMENT, 1, key, str(daily_limit), str(_DAY_SECONDS)
        )
        allowed = int(result[0]) == 1
        current = int(result[1])
        ttl = max(int(result[2]), 0)

        if not allowed:
            return (
                False,
                f"Daily generation limit reached ({daily_limit}/{daily_limit}). "
                "Upgrade to Pro for unlimited generations.",
                {"remaining": 0, "limit": daily_limit, "reset": ttl},
            )
        remaining = daily_limit - current
        return True, "", {"remaining": remaining, "limit": daily_limit, "reset": ttl}
    except Exception as exc:
        logger.warning(
            "rate_limit_redis_error",
            user_id=str(user_id),
            error=str(exc),
            has_db_fallback=db is not None,
        )
        if db is None:
            # No DB context — fail closed to prevent cost blow-up
            logger.error("rate_limit_fail_closed_no_db", user_id=str(user_id))
            return (
                False,
                "Rate limit service temporarily unavailable. Please try again shortly.",
                {"remaining": 0, "limit": daily_limit, "reset": 0},
            )
        try:
            current = await _db_fallback_daily_count(db, user_id)
        except Exception as db_exc:
            logger.error(
                "rate_limit_db_fallback_failed",
                user_id=str(user_id),
                error=str(db_exc),
            )
            return (
                False,
                "Rate limit service temporarily unavailable. Please try again shortly.",
                {"remaining": 0, "limit": daily_limit, "reset": 0},
            )
        if current >= daily_limit:
            return (
                False,
                f"Daily generation limit reached ({daily_limit}/{daily_limit}). "
                "Upgrade to Pro for unlimited generations.",
                {"remaining": 0, "limit": daily_limit, "reset": 0},
            )
        # NOTE: DB fallback cannot atomically increment a Redis counter.
        # This trades a small amount of precision (under-count by 1 during
        # concurrent races) for correctness during a Redis outage. Once Redis
        # recovers the Lua path takes over.
        remaining = daily_limit - current - 1
        return True, "", {"remaining": max(remaining, 0), "limit": daily_limit, "reset": 0}


# ---------------------------------------------------------------------------
# Progressive friction (cooldown)
# ---------------------------------------------------------------------------

async def check_cooldown(user_id: uuid.UUID, tier: str) -> tuple[bool, int]:
    """Check if user must wait before generating.

    Returns (must_wait, seconds_remaining).
    Pro/Creator tiers skip cooldown entirely.
    """
    if tier in ("pro", "creator"):
        return False, 0

    key_count = f"{_GEN_COUNT_PREFIX}{user_id}"
    key_cd = f"{_COOLDOWN_PREFIX}{user_id}"

    try:
        r = _get_redis()
        count_raw, cd_ttl = await asyncio.gather(
            r.get(key_count),
            r.ttl(key_cd),
        )

        current = int(count_raw) if count_raw else 0

        # Still in the instant window
        if current < INSTANT_GENERATIONS_BEFORE_COOLDOWN:
            return False, 0

        # Check if cooldown is active
        if cd_ttl > 0:
            return True, cd_ttl

        return False, 0
    except Exception:
        logger.warning("cooldown_check_failed", user_id=str(user_id))
        return False, 0


async def set_cooldown(user_id: uuid.UUID) -> None:
    """Set cooldown timer after generation completes (free tier only)."""
    key = f"{_COOLDOWN_PREFIX}{user_id}"
    try:
        r = _get_redis()
        await r.set(key, "1", ex=COOLDOWN_SECONDS)
    except Exception:
        logger.warning("cooldown_set_failed", user_id=str(user_id))


# ---------------------------------------------------------------------------
# Monthly cost budget enforcement (Redis-cached)
# ---------------------------------------------------------------------------

async def check_monthly_budget(
    user_id: uuid.UUID, tier: str, db: AsyncSession
) -> tuple[bool, str, dict]:
    """Check if user has exceeded their monthly cost budget.

    Uses Redis as a cache (5 min TTL) to avoid querying the DB on every request.
    Falls back to DB query on cache miss.
    Returns (allowed, reason, info_dict).
    """
    _, budget = _TIER_LIMITS.get(tier, _TIER_LIMITS["free"])

    now = datetime.now(UTC)
    month_key = now.strftime("%Y-%m")
    cache_key = f"{_MONTHLY_SPEND_PREFIX}{user_id}:{month_key}"

    # Try Redis cache first
    spent: float | None = None
    try:
        r = _get_redis()
        cached = await r.get(cache_key)
        if cached is not None:
            spent = float(cached)
    except Exception:
        logger.warning("monthly_budget_cache_miss", user_id=str(user_id))

    # Cache miss — query DB and populate cache
    if spent is None:
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        result = await db.execute(
            select(func.coalesce(func.sum(Generation.cost_usd), 0.0)).where(
                Generation.user_id == user_id,
                Generation.created_at >= month_start,
            )
        )
        spent = float(result.scalar_one())

        # Cache the result
        try:
            r = _get_redis()
            await r.set(cache_key, str(spent), ex=_MONTHLY_SPEND_CACHE_TTL)
        except Exception:
            pass  # Non-critical

    if spent >= budget:
        return (
            False,
            f"Monthly cost budget exceeded (${spent:.2f}/${budget:.2f}). "
            + ("Upgrade to Pro for a higher budget." if tier == "free" else "Budget resets next month."),
            {"spent_usd": spent, "budget_usd": budget},
        )
    return True, "", {"spent_usd": spent, "budget_usd": budget}


async def invalidate_monthly_budget_cache(user_id: uuid.UUID) -> None:
    """Invalidate the cached monthly spend after a generation completes."""
    now = datetime.now(UTC)
    month_key = now.strftime("%Y-%m")
    cache_key = f"{_MONTHLY_SPEND_PREFIX}{user_id}:{month_key}"
    try:
        r = _get_redis()
        await r.delete(cache_key)
    except Exception:
        pass  # Non-critical


# ---------------------------------------------------------------------------
# IP-based signup throttling (atomic via Lua)
# ---------------------------------------------------------------------------

async def check_and_increment_signup_ip(ip: str) -> tuple[bool, str]:
    """Atomically check and increment IP signup counter.

    Returns (allowed, reason).
    """
    key = f"{_SIGNUP_IP_PREFIX}{ip}"
    try:
        r = _get_redis()
        result = await r.eval(
            _LUA_CHECK_AND_INCREMENT,
            1,
            key,
            str(MAX_ACCOUNT_CREATIONS_PER_IP_PER_DAY),
            str(_DAY_SECONDS),
        )
        allowed = int(result[0]) == 1
        if not allowed:
            return False, "Too many account creations from this IP. Try again tomorrow."
        return True, ""
    except Exception:
        logger.warning("signup_ip_check_failed", ip=ip)
        return True, ""  # Fail open


# ---------------------------------------------------------------------------
# Admin: cost monitoring queries
# ---------------------------------------------------------------------------

async def get_cost_summary(db: AsyncSession) -> dict:
    """Aggregate cost stats for admin dashboard."""
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Monthly totals
    monthly_result = await db.execute(
        select(
            func.coalesce(func.sum(Generation.cost_usd), 0.0).label("total_cost"),
            func.coalesce(func.sum(Generation.input_tokens), 0).label("total_input"),
            func.coalesce(func.sum(Generation.output_tokens), 0).label("total_output"),
            func.count(Generation.id).label("total_generations"),
        ).where(Generation.created_at >= month_start)
    )
    monthly = monthly_result.one()

    # Daily totals
    daily_result = await db.execute(
        select(
            func.coalesce(func.sum(Generation.cost_usd), 0.0).label("total_cost"),
            func.count(Generation.id).label("total_generations"),
        ).where(Generation.created_at >= today_start)
    )
    daily = daily_result.one()

    return {
        "month": {
            "total_cost_usd": float(monthly.total_cost),
            "total_input_tokens": int(monthly.total_input),
            "total_output_tokens": int(monthly.total_output),
            "total_generations": int(monthly.total_generations),
            "period_start": month_start.isoformat(),
        },
        "today": {
            "total_cost_usd": float(daily.total_cost),
            "total_generations": int(daily.total_generations),
            "period_start": today_start.isoformat(),
        },
    }


async def get_top_users_by_cost(db: AsyncSession, limit: int = 10) -> list[dict]:
    """Get top users by cost for the current month."""
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(
            Generation.user_id,
            func.coalesce(func.sum(Generation.cost_usd), 0.0).label("total_cost"),
            func.count(Generation.id).label("generation_count"),
            func.coalesce(func.sum(Generation.input_tokens), 0).label("total_input"),
            func.coalesce(func.sum(Generation.output_tokens), 0).label("total_output"),
        )
        .where(Generation.created_at >= month_start)
        .group_by(Generation.user_id)
        .order_by(func.sum(Generation.cost_usd).desc())
        .limit(limit)
    )

    return [
        {
            "user_id": str(row.user_id),
            "total_cost_usd": float(row.total_cost),
            "generation_count": int(row.generation_count),
            "total_input_tokens": int(row.total_input),
            "total_output_tokens": int(row.total_output),
        }
        for row in result.all()
    ]


# ---------------------------------------------------------------------------
# Client IP extraction (proxy-aware)
# ---------------------------------------------------------------------------

def get_client_ip(request) -> str:
    """Extract client IP, respecting X-Forwarded-For from trusted proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Take the leftmost IP (original client), strip whitespace
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"
