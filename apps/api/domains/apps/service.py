"""App CRUD operations and install tracking."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from appio_db import App, User


_DELETED_STATUS = "deleted"


async def list_user_apps(
    db: AsyncSession,
    user: User,
    *,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[App], int]:
    """Return a page of apps belonging to the given user and the total count.

    Excludes soft-deleted apps (status='deleted').
    """
    page = max(1, page)
    per_page = max(1, min(100, per_page))
    offset = (page - 1) * per_page

    base_filter = (App.user_id == user.id) & (App.status != _DELETED_STATUS)

    total_result = await db.execute(
        select(func.count()).select_from(App).where(base_filter)
    )
    total = int(total_result.scalar_one() or 0)

    result = await db.execute(
        select(App)
        .where(base_filter)
        .order_by(App.updated_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    return list(result.scalars().all()), total


async def get_app_by_id(db: AsyncSession, app_id: UUID) -> App | None:
    """Return a single app by primary key. Includes soft-deleted for ownership checks."""
    result = await db.execute(select(App).where(App.id == app_id))
    return result.scalar_one_or_none()


async def get_app_by_slug(db: AsyncSession, slug: str) -> App | None:
    """Return a single app by slug for public share pages. Excludes soft-deleted."""
    result = await db.execute(
        select(App).where(
            App.slug == slug,
            App.url.is_not(None),
            App.status != _DELETED_STATUS,
        )
    )
    return result.scalar_one_or_none()


async def record_install(db: AsyncSession, app_id: UUID) -> App | None:
    """Increment install count and mark app as installed. Returns updated app."""
    result = await db.execute(select(App).where(App.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        return None

    app.install_count += 1
    if app.status == "ready":
        app.status = "installed"
    await db.flush()
    return app


async def soft_delete_app(db: AsyncSession, app_id: UUID) -> App | None:
    """Mark an app as deleted without removing the row (preserves analytics)."""
    result = await db.execute(select(App).where(App.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        return None
    app.status = _DELETED_STATUS
    await db.flush()
    return app


async def get_app_messages(db: AsyncSession, app_id: UUID) -> list[dict]:
    """Return persisted chat messages for an app."""
    result = await db.execute(select(App.messages).where(App.id == app_id))
    messages = result.scalar_one_or_none()
    return messages or []


async def update_app_messages(
    db: AsyncSession, app_id: UUID, messages: list[dict]
) -> App | None:
    """Replace all chat messages for an app."""
    result = await db.execute(select(App).where(App.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        return None
    app.messages = messages
    await db.flush()
    return app
