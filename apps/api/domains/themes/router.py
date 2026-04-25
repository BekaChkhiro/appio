"""Themes domain router — POST /generate, GET /, GET /{id}, DELETE /{id} (T4.1)."""

import uuid

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from appio_db import User
from apps.api.core.exceptions import NotFoundError
from apps.api.dependencies import get_current_user, get_db

from .schemas import (
    GenerateThemeRequest,
    GenerateThemeResponse,
    SavedThemeResponse,
    ThemeListResponse,
)
from .service import (
    _row_to_response,
    delete_theme,
    generate_theme,
    get_theme,
    list_themes,
    persist_theme,
)

router = APIRouter()
logger = structlog.stdlib.get_logger()


@router.post("/generate", response_model=GenerateThemeResponse, status_code=201)
async def generate(
    req: GenerateThemeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GenerateThemeResponse:
    """Generate a theme persona from text or image and persist it."""
    logger.info(
        "theme_generate_start",
        user_id=str(user.id),
        source_kind="text" if req.prompt else "image",
    )

    persona, cost_usd, wcag = await generate_theme(req)
    row = await persist_theme(db, user_id=user.id, req=req, persona=persona, cost_usd=cost_usd)

    logger.info(
        "theme_generate_done",
        user_id=str(user.id),
        theme_id=str(row.id),
        cost_usd=cost_usd,
        wcag_passes=wcag.passes,
    )
    return GenerateThemeResponse(
        theme_id=row.id,
        persona=persona,
        cost_usd=cost_usd,
        wcag=wcag,
    )


@router.get("/", response_model=ThemeListResponse)
async def list_user_themes(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ThemeListResponse:
    """List the authenticated user's saved themes, newest-first."""
    return await list_themes(db, user_id=user.id, limit=limit, offset=offset)


@router.get("/{theme_id}", response_model=SavedThemeResponse)
async def get_one_theme(
    theme_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SavedThemeResponse:
    """Fetch a single saved theme. 404 if not owned by the current user."""
    row = await get_theme(db, theme_id=theme_id, user_id=user.id)
    if row is None:
        raise NotFoundError(detail="Theme not found")
    return _row_to_response(row)


@router.delete("/{theme_id}", status_code=204)
async def remove_theme(
    theme_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a saved theme. 404 if not owned by the current user."""
    deleted = await delete_theme(db, theme_id=theme_id, user_id=user.id)
    if not deleted:
        raise NotFoundError(detail="Theme not found")
