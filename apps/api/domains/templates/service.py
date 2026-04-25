"""Template query service."""

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from appio_db import AppTemplate, Template


async def list_active_templates(db: AsyncSession) -> list[Template]:
    result = await db.execute(
        select(Template).where(Template.is_active.is_(True)).order_by(Template.display_name)
    )
    return list(result.scalars().all())


async def get_template_by_id(db: AsyncSession, template_id: str) -> Template | None:
    result = await db.execute(select(Template).where(Template.id == template_id))
    return result.scalar_one_or_none()


# --- App Templates (Marketplace) ---


async def list_app_templates(
    db: AsyncSession,
    *,
    category: str | None = None,
    featured_only: bool = False,
) -> list[AppTemplate]:
    """List marketplace starters, optionally filtered by category or featured flag."""
    stmt = select(AppTemplate)
    if category:
        stmt = stmt.where(AppTemplate.category == category)
    if featured_only:
        stmt = stmt.where(AppTemplate.is_featured.is_(True))
    stmt = stmt.order_by(AppTemplate.sort_order)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_app_template_by_slug(db: AsyncSession, slug: str) -> AppTemplate | None:
    result = await db.execute(select(AppTemplate).where(AppTemplate.slug == slug))
    return result.scalar_one_or_none()


async def increment_use_count(db: AsyncSession, slug: str) -> None:
    """Bump use_count when a user starts a generation from this template.

    TODO(T2.34): Wire this into the generation pipeline — call when
    user selects a marketplace template to start a new generation.
    """
    await db.execute(
        update(AppTemplate)
        .where(AppTemplate.slug == slug)
        .values(use_count=AppTemplate.use_count + 1)
    )


async def list_app_template_categories(db: AsyncSession) -> list[str]:
    """Return distinct categories across all app templates."""
    from sqlalchemy import distinct

    result = await db.execute(
        select(distinct(AppTemplate.category)).order_by(AppTemplate.category)
    )
    return list(result.scalars().all())
