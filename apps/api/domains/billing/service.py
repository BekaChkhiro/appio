"""Stripe billing integration: tier resolution, user upsert, webhook idempotency.

Tier precedence: price_creator > price_pro > free. Unknown price IDs fall back
to 'free' so a mis-configured product can't accidentally grant Creator access.
"""

from __future__ import annotations

import redis.asyncio as aioredis
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from appio_db import User
from apps.api.config import settings
from apps.api.core.rate_limit import _get_redis

logger = structlog.stdlib.get_logger()

# Redis key prefix + TTL for webhook idempotency. 7 days is longer than
# Stripe's retry window (~3 days).
_WEBHOOK_SEEN_PREFIX = "billing:stripe:event:"
_WEBHOOK_SEEN_TTL_SECONDS = 7 * 24 * 60 * 60

TIER_FREE = "free"
TIER_PRO = "pro"
TIER_CREATOR = "creator"


def resolve_tier_from_price(price_id: str | None) -> str:
    """Map a Stripe Price ID to an internal tier string."""
    if not price_id:
        return TIER_FREE
    if settings.stripe_price_creator and price_id == settings.stripe_price_creator:
        return TIER_CREATOR
    if settings.stripe_price_pro and price_id == settings.stripe_price_pro:
        return TIER_PRO
    # Unknown price → treat as free, log for ops visibility.
    logger.warning("stripe_unknown_price_id", price_id=price_id)
    return TIER_FREE


async def mark_event_processed(event_id: str) -> bool:
    """Atomically claim a Stripe event for processing.

    Returns True if this call is the first to see the event (caller should
    process it), False if the event was already processed (caller should skip).
    Falls back to allowing processing if Redis is unavailable — Stripe
    retries are rare and duplicate-processing is handled by making each
    event handler idempotent (set tier to X, not "increment").
    """
    try:
        r: aioredis.Redis = _get_redis()
        key = f"{_WEBHOOK_SEEN_PREFIX}{event_id}"
        # SET NX + EX — atomic "set if not exists with TTL"
        result = await r.set(key, "1", nx=True, ex=_WEBHOOK_SEEN_TTL_SECONDS)
        return bool(result)
    except Exception as exc:
        logger.warning(
            "stripe_idempotency_redis_error",
            event_id=event_id,
            error=str(exc),
        )
        return True  # Proceed — handlers themselves are idempotent.


async def get_user_by_stripe_customer(
    db: AsyncSession, customer_id: str
) -> User | None:
    """Find the Appio user linked to a Stripe customer."""
    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Find an Appio user by email (used on first checkout before linking)."""
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def set_user_tier(
    db: AsyncSession,
    user: User,
    *,
    tier: str,
    stripe_customer_id: str | None = None,
) -> User:
    """Update tier (and optionally link stripe_customer_id) idempotently."""
    changed = False
    if user.tier != tier:
        user.tier = tier
        changed = True
    if stripe_customer_id and user.stripe_customer_id != stripe_customer_id:
        user.stripe_customer_id = stripe_customer_id
        changed = True
    if changed:
        await db.flush()
        logger.info(
            "billing_tier_updated",
            user_id=str(user.id),
            tier=tier,
            stripe_customer_id=stripe_customer_id,
        )
    return user
