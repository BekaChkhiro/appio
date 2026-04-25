"""Convex Publish domain router (T3.8 — deploy-key flow)."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select

from appio_db.models import App, AppPublishJob
from apps.api.core.exceptions import NotFoundError
from apps.api.dependencies import get_current_user, get_db

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from appio_db import User

from .credentials_service import (
    delete_credentials,
    get_credentials_status,
    store_credentials,
)
from .migration_service import start_publish
from .schemas import (
    CredentialsStatusResponse,
    PasteCredentialsRequest,
    PublishRequest,
    PublishStatusResponse,
)

router = APIRouter()
logger = structlog.stdlib.get_logger()


# ── Credential management ─────────────────────────────────────────────────────


@router.post("/credentials/{app_id}", status_code=204)
async def paste_credentials(
    app_id: UUID,
    req: PasteCredentialsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Store (or replace) the Convex deploy key and deployment URL for an app."""
    await store_credentials(
        db,
        app_id=app_id,
        user_id=user.id,
        deploy_key=req.deploy_key,
        deployment_url=str(req.deployment_url),
    )


@router.get("/credentials/{app_id}", response_model=CredentialsStatusResponse)
async def get_credentials(
    app_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CredentialsStatusResponse:
    """Return credential presence info (never the key itself)."""
    return await get_credentials_status(db, app_id=app_id, user_id=user.id)


@router.delete("/credentials/{app_id}", status_code=204)
async def revoke_credentials(
    app_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove the stored deploy key for an app. Idempotent."""
    await delete_credentials(db, app_id=app_id, user_id=user.id)


# ── Publish ───────────────────────────────────────────────────────────────────


@router.post("/publish/{app_id}", response_model=PublishStatusResponse, status_code=202)
async def publish_app(
    app_id: UUID,
    _req: PublishRequest = PublishRequest(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PublishStatusResponse:
    """Kick off the publish migration for an app. Returns a job handle immediately."""
    app_result = await db.execute(
        select(App).where(App.id == app_id, App.user_id == user.id)
    )
    app = app_result.scalar_one_or_none()
    if app is None:
        raise NotFoundError(detail="App not found")

    job = await start_publish(db, user_id=user.id, app=app)

    from .tasks import run_publish_job
    run_publish_job.send(str(job.id))

    logger.info(
        "publish_enqueued",
        job_id=str(job.id),
        app_id=str(app_id),
        user_id=str(user.id),
    )
    return PublishStatusResponse(
        migration_id=job.id,
        status=job.status,
        current_step=job.current_step,
        message=None,
        deployment_url=job.deployment_url,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


@router.get("/publish/{app_id}/status", response_model=PublishStatusResponse)
async def publish_status(
    app_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PublishStatusResponse:
    """Poll the status of the most recent publish job for an app."""
    result = await db.execute(
        select(AppPublishJob)
        .where(AppPublishJob.app_id == app_id, AppPublishJob.user_id == user.id)
        .order_by(AppPublishJob.created_at.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise NotFoundError(detail="No publish job found for this app")

    return PublishStatusResponse(
        migration_id=job.id,
        status=job.status,
        current_step=job.current_step,
        message=job.error_message,
        deployment_url=job.deployment_url,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )
