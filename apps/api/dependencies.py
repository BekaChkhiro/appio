"""Shared FastAPI dependencies: get_db, get_current_user, rate limiting, etc."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from dataclasses import dataclass

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from appio_db import User, get_session_factory
from apps.api.core.exceptions import ForbiddenError, RateLimitError
from apps.api.core.rate_limit import (
    check_and_increment_generation,
    check_cooldown,
    check_monthly_budget,
)
from apps.api.core.security import FirebaseUser, get_firebase_user
from apps.api.domains.auth.service import sync_user


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session per request. Auto-commits on success, rolls back on error."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_current_user(
    firebase_user: FirebaseUser = Depends(get_firebase_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency: resolve the authenticated user's database record.

    Combines Firebase JWT verification with user-sync (create on first request).
    Use this as a dependency in any endpoint that requires authentication.
    """
    return await sync_user(db, firebase_user)


async def require_verified_email(
    firebase_user: FirebaseUser = Depends(get_firebase_user),
) -> FirebaseUser:
    """FastAPI dependency: require that the user's email is verified.

    Use this as an additional dependency on endpoints that need verification
    (e.g. generation). Combine with get_current_user for DB user + verification.
    """
    if not firebase_user.email_verified:
        raise ForbiddenError(detail="Email verification required. Please verify your email before generating apps.")
    return firebase_user


@dataclass
class RateLimitResult:
    """Carries the authenticated user + rate limit metadata for response headers."""

    user: User
    remaining: int  # -1 = unlimited
    limit: int  # 0 = unlimited
    reset: int  # seconds until counter resets


async def enforce_generation_limits(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RateLimitResult:
    """FastAPI dependency: enforce all generation rate limits before allowing generation.

    Checks (in order):
    1. Progressive cooldown (free tier only) — checked first so cooldown
       doesn't get "consumed" by a failed daily limit check
    2. Daily generation count (tier-aware) — atomic check-and-increment via Lua
    3. Monthly cost budget (Redis-cached, DB fallback)

    Raises RateLimitError if any check fails.
    Returns RateLimitResult with rate limit metadata for response headers.
    """
    user_id = current_user.id
    tier = current_user.tier or "free"

    # 1. Progressive cooldown (check before incrementing daily counter)
    must_wait, seconds = await check_cooldown(user_id, tier)
    if must_wait:
        raise RateLimitError(
            detail=f"Please wait {seconds} seconds before generating again. Upgrade to Pro to skip cooldowns."
        )

    # 2. Daily generation limit (atomic check + increment in one Lua call).
    # Pass db so rate_limit can fall back to a DB count if Redis is down.
    allowed, reason, info = await check_and_increment_generation(user_id, tier, db)
    if not allowed:
        raise RateLimitError(detail=reason)

    # 3. Monthly cost budget
    allowed, reason, _ = await check_monthly_budget(user_id, tier, db)
    if not allowed:
        raise RateLimitError(detail=reason)

    return RateLimitResult(
        user=current_user,
        remaining=info.get("remaining", -1),
        limit=info.get("limit", 0),
        reset=info.get("reset", 0),
    )
