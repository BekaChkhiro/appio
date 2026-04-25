"""Admin endpoints for cost monitoring and rate limit management."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from appio_db import User
from appio_db.models import Generation
from apps.api.core.exceptions import AppError, ForbiddenError
from apps.api.core.rate_limit import get_cost_summary, get_top_users_by_cost
from apps.api.dependencies import get_current_user, get_db

router = APIRouter()


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require admin tier for access."""
    if current_user.tier != "admin":
        raise ForbiddenError(detail="Admin access required")
    return current_user


@router.get("/costs")
async def cost_dashboard(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Cost monitoring dashboard: monthly/daily totals and top users."""
    summary = await get_cost_summary(db)
    top_users = await get_top_users_by_cost(db)
    return {"summary": summary, "top_users": top_users}


@router.get("/costs/users/{user_id}")
async def user_cost_detail(
    user_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get cost details for a specific user."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise AppError(
            detail="Invalid user_id format. Must be a valid UUID.",
            status_code=400,
            error_code="INVALID_USER_ID",
        ) from None

    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(
            func.coalesce(func.sum(Generation.cost_usd), 0.0).label("total_cost"),
            func.coalesce(func.sum(Generation.input_tokens), 0).label("total_input"),
            func.coalesce(func.sum(Generation.output_tokens), 0).label("total_output"),
            func.count(Generation.id).label("generation_count"),
        ).where(
            Generation.user_id == uid,
            Generation.created_at >= month_start,
        )
    )
    row = result.one()

    return {
        "user_id": user_id,
        "month": {
            "total_cost_usd": float(row.total_cost),
            "total_input_tokens": int(row.total_input),
            "total_output_tokens": int(row.total_output),
            "generation_count": int(row.generation_count),
            "period_start": month_start.isoformat(),
        },
    }
