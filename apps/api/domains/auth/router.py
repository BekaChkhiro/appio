from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from appio_db import User
from apps.api.core.exceptions import RateLimitError
from apps.api.core.rate_limit import check_and_increment_signup_ip, get_client_ip
from apps.api.core.security import FirebaseUser, get_firebase_user
from apps.api.dependencies import get_db
from apps.api.domains.auth.schemas import UserResponse
from apps.api.domains.auth.service import sync_user

router = APIRouter()


@router.post("/login", response_model=UserResponse)
async def login(
    request: Request,
    firebase_user: FirebaseUser = Depends(get_firebase_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Verify Firebase JWT, sync user to database, return user profile.

    Called by the mobile app on first launch after Firebase sign-in.
    Creates the user row on first request, returns existing on subsequent.
    New accounts are subject to IP rate limiting (max 3 per IP per day).
    """
    # Check if this is a new user (first-time login creates an account)
    existing = await db.execute(
        select(User.id).where(User.firebase_uid == firebase_user.uid)
    )
    is_new_user = existing.scalar_one_or_none() is None

    if is_new_user:
        ip = get_client_ip(request)
        allowed, reason = await check_and_increment_signup_ip(ip)
        if not allowed:
            raise RateLimitError(detail=reason)

    user = await sync_user(db, firebase_user)

    return UserResponse(
        user_id=str(user.id),
        email=user.email,
        name=user.name,
        avatar=user.avatar,
        tier=user.tier,
        email_verified=firebase_user.email_verified,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    firebase_user: FirebaseUser = Depends(get_firebase_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Return current user profile. Same sync logic as login."""
    user = await sync_user(db, firebase_user)
    return UserResponse(
        user_id=str(user.id),
        email=user.email,
        name=user.name,
        avatar=user.avatar,
        tier=user.tier,
        email_verified=firebase_user.email_verified,
    )
