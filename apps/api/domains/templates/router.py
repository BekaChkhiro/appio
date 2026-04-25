from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.exceptions import NotFoundError
from apps.api.dependencies import get_db
from apps.api.domains.templates.schemas import (
    AppTemplateDetailResponse,
    AppTemplateResponse,
    TemplateDetailResponse,
    TemplateResponse,
)
from apps.api.domains.templates.service import (
    get_app_template_by_slug,
    get_template_by_id,
    list_active_templates,
    list_app_template_categories,
    list_app_templates,
)

router = APIRouter()


# --- Build templates (existing) ---


@router.get("/", response_model=list[TemplateResponse])
async def list_templates(db: AsyncSession = Depends(get_db)) -> Any:
    """List all active templates."""
    return await list_active_templates(db)


# --- App templates / Marketplace starters ---
# NOTE: These must be registered BEFORE the /{template_id} catch-all
# to prevent "marketplace" from being interpreted as a template_id.


@router.get("/marketplace/categories", response_model=list[str])
async def get_categories(db: AsyncSession = Depends(get_db)) -> Any:
    """List available marketplace categories."""
    return await list_app_template_categories(db)


@router.get("/marketplace/", response_model=list[AppTemplateResponse])
async def list_marketplace_templates(
    category: str | None = Query(None, description="Filter by category"),
    featured: bool = Query(False, description="Only show featured templates"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """List marketplace app template starters."""
    return await list_app_templates(db, category=category, featured_only=featured)


@router.get("/marketplace/{slug}", response_model=AppTemplateDetailResponse)
async def get_marketplace_template(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get a specific marketplace template by slug (includes canonical prompt)."""
    tpl = await get_app_template_by_slug(db, slug)
    if not tpl:
        raise NotFoundError(f"App template '{slug}' not found")
    return tpl


# --- Build template detail (catch-all — must be last) ---


@router.get("/{template_id}", response_model=TemplateDetailResponse)
async def get_template(template_id: str, db: AsyncSession = Depends(get_db)) -> Any:
    """Get a specific template by ID."""
    template = await get_template_by_id(db, template_id)
    if not template:
        raise NotFoundError(f"Template '{template_id}' not found")
    return template
