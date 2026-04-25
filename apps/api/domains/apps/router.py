from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from appio_db import User
from apps.api.core.exceptions import NotFoundError
from apps.api.dependencies import get_current_user, get_db

from .schemas import (
    AppListResponse,
    AppResponse,
    DeleteResponse,
    InstallResponse,
    MessagesResponse,
    PublicAppResponse,
    UpdateMessagesRequest,
)
from .service import (
    get_app_by_id,
    get_app_by_slug,
    get_app_messages,
    list_user_apps,
    record_install,
    soft_delete_app,
    update_app_messages,
)

router = APIRouter()


@router.get("/", response_model=AppListResponse)
async def list_apps(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List apps for the current user, paginated, newest-first."""
    apps, total = await list_user_apps(db, user, page=page, per_page=per_page)
    has_more = page * per_page < total
    return AppListResponse(
        items=apps,
        total=total,
        page=page,
        per_page=per_page,
        has_more=has_more,
    )


@router.get("/public/{slug}", response_model=PublicAppResponse)
async def get_public_app(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Get public app metadata by slug. No authentication required."""
    app = await get_app_by_slug(db, slug)
    if not app:
        raise NotFoundError(detail="App not found")
    return app


@router.get("/{app_id}", response_model=AppResponse)
async def get_app(
    app_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific app by ID. Must be owned by the current user."""
    app = await get_app_by_id(db, app_id)
    # Combine existence + ownership so 404 vs 403 can't be distinguished by probing
    if not app or app.user_id != user.id:
        raise NotFoundError(detail="App not found")
    return app


@router.delete("/{app_id}", response_model=DeleteResponse)
async def delete_app(
    app_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete the app (status='deleted'). Preserves analytics."""
    app = await get_app_by_id(db, app_id)
    if not app or app.user_id != user.id:
        raise NotFoundError(detail="App not found")
    if app.status == "deleted":
        raise NotFoundError(detail="App not found")

    deleted = await soft_delete_app(db, app_id)
    assert deleted is not None
    return DeleteResponse(app_id=deleted.id, status=deleted.status)


@router.post("/{app_id}/install", response_model=InstallResponse)
async def install_app(
    app_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a PWA installation event. Must be the app owner."""
    app = await get_app_by_id(db, app_id)
    if not app or app.user_id != user.id:
        raise NotFoundError(detail="App not found")
    if app.status == "deleted":
        raise NotFoundError(detail="App not found")

    app = await record_install(db, app_id)
    return InstallResponse(
        app_id=app.id,
        install_count=app.install_count,
        status=app.status,
    )


@router.get("/{app_id}/messages", response_model=MessagesResponse)
async def get_messages(
    app_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get persisted chat messages for an app."""
    app = await get_app_by_id(db, app_id)
    if not app or app.user_id != user.id:
        raise NotFoundError(detail="App not found")

    messages = await get_app_messages(db, app_id)
    return MessagesResponse(app_id=app_id, messages=messages)


@router.put("/{app_id}/messages", response_model=MessagesResponse)
async def put_messages(
    app_id: UUID,
    body: UpdateMessagesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace all chat messages for an app."""
    app = await get_app_by_id(db, app_id)
    if not app or app.user_id != user.id:
        raise NotFoundError(detail="App not found")

    await update_app_messages(db, app_id, [m.model_dump() for m in body.messages])
    return MessagesResponse(app_id=app_id, messages=[m.model_dump() for m in body.messages])
