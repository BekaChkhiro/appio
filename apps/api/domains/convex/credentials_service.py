"""Convex deploy-key credential management per app (T3.8 Phase 2).

Users paste a CONVEX_DEPLOY_KEY + deployment URL from the Convex dashboard.
We validate, encrypt, and upsert one row per app into app_convex_credentials.

See docs/adr/007-deploy-key-publish.md for the full rationale.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import TYPE_CHECKING

import structlog
from sqlalchemy import select

from appio_db.models import App, AppConvexCredentials
from apps.api.core.exceptions import AppError, NotFoundError

from .crypto import decrypt, encrypt
from .schemas import CredentialsStatusResponse

if TYPE_CHECKING:
    import uuid

    from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.stdlib.get_logger()

# Two valid formats:
#   1. prod:<team-slug>|<secret>      — newer team-scoped prod key
#   2. <deployment-name>|<secret>     — older deployment-scoped admin key
#      (returned by /api/create_project provisioning)
# Both are accepted by `npx convex deploy`. team-slug / deployment-name
# are lower-case alphanumeric + hyphens.
_DEPLOY_KEY_RE = re.compile(r"^(?:prod:)?([a-z0-9-]+)\|.+$")

# https://<deployment>.convex.cloud  OR  https://<deployment>.convex.site
# Current Convex production URLs include an optional region segment:
# https://<name>.<region>.convex.cloud (e.g. eu-west-1). Validated against
# real Management API responses 2026-04-21.
_DEPLOYMENT_URL_RE = re.compile(
    r"^https://[a-z0-9-]+(\.[a-z0-9-]+)?\.convex\.(cloud|site)/?$"
)


def _validate_deploy_key(key: str) -> str:
    """Return team_slug if valid; raise AppError(400) otherwise."""
    m = _DEPLOY_KEY_RE.fullmatch(key)
    if m is None:
        raise AppError(
            detail=(
                "Deploy key must be in the format prod:<team-slug>|<secret> "
                "or <deployment-name>|<secret>. "
                "Copy it from Convex dashboard → Settings → Deploy Keys."
            ),
            status_code=400,
            error_code="INVALID_CREDENTIALS",
        )
    return m.group(1)


def _validate_deployment_url(url: str) -> None:
    """Raise AppError(400) if URL doesn't match the Convex deployment URL pattern."""
    if _DEPLOYMENT_URL_RE.fullmatch(url) is None:
        raise AppError(
            detail=(
                "Deployment URL must be in the format "
                "https://<name>.convex.cloud or https://<name>.convex.site."
            ),
            status_code=400,
            error_code="INVALID_CREDENTIALS",
        )


async def _load_app_for_user(
    db: AsyncSession, *, app_id: uuid.UUID, user_id: uuid.UUID
) -> App:
    result = await db.execute(
        select(App).where(App.id == app_id, App.user_id == user_id)
    )
    app = result.scalar_one_or_none()
    if app is None:
        raise NotFoundError(detail="App not found")
    return app


async def store_credentials(
    db: AsyncSession,
    *,
    app_id: uuid.UUID,
    user_id: uuid.UUID,
    deploy_key: str,
    deployment_url: str,
) -> AppConvexCredentials:
    """Validate, parse team_slug, encrypt, upsert.

    Raises NotFoundError if the app is not owned by user_id.
    Raises AppError(400) with error_code INVALID_CREDENTIALS on bad key/URL.
    """
    await _load_app_for_user(db, app_id=app_id, user_id=user_id)

    team_slug = _validate_deploy_key(deploy_key)
    _validate_deployment_url(deployment_url)

    encrypted_key = encrypt(deploy_key)

    existing_result = await db.execute(
        select(AppConvexCredentials).where(AppConvexCredentials.app_id == app_id)
    )
    row = existing_result.scalar_one_or_none()

    if row is None:
        row = AppConvexCredentials(
            app_id=app_id,
            created_by_user_id=user_id,
            deploy_key_encrypted=encrypted_key,
            deployment_url=deployment_url,
            team_slug=team_slug,
        )
        db.add(row)
    else:
        row.deploy_key_encrypted = encrypted_key
        row.deployment_url = deployment_url
        row.team_slug = team_slug
        row.created_by_user_id = user_id

    await db.flush()

    logger.info(
        "convex_credentials_stored",
        app_id=str(app_id),
        user_id=str(user_id),
        team_slug=team_slug,
    )
    return row


async def get_credentials_status(
    db: AsyncSession,
    *,
    app_id: uuid.UUID,
    user_id: uuid.UUID,
) -> CredentialsStatusResponse:
    """Return credential presence info without exposing the key.

    Raises NotFoundError if the app is not owned by user_id.
    """
    await _load_app_for_user(db, app_id=app_id, user_id=user_id)

    result = await db.execute(
        select(AppConvexCredentials).where(AppConvexCredentials.app_id == app_id)
    )
    row = result.scalar_one_or_none()

    if row is None:
        return CredentialsStatusResponse(has_credentials=False)

    return CredentialsStatusResponse(
        has_credentials=True,
        deployment_url=row.deployment_url,
        team_slug=row.team_slug,
        last_used_at=row.last_used_at,
    )


async def delete_credentials(
    db: AsyncSession,
    *,
    app_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """Idempotently remove credentials. Succeeds even if no row exists.

    Raises NotFoundError if the app is not owned by user_id.
    """
    await _load_app_for_user(db, app_id=app_id, user_id=user_id)

    result = await db.execute(
        select(AppConvexCredentials).where(AppConvexCredentials.app_id == app_id)
    )
    row = result.scalar_one_or_none()
    if row is not None:
        await db.delete(row)
        await db.flush()

    logger.info(
        "convex_credentials_deleted",
        app_id=str(app_id),
        user_id=str(user_id),
        had_row=row is not None,
    )


async def load_credentials_for_publish(
    db: AsyncSession,
    *,
    app_id: uuid.UUID,
) -> tuple[str, str]:
    """Return (plaintext_deploy_key, deployment_url). Bumps last_used_at.

    Raises AppError(404) if no credentials are set for this app.
    Called only by the publish pipeline — no user_id check needed here
    (the job was already validated to belong to the user when enqueued).
    """
    result = await db.execute(
        select(AppConvexCredentials).where(AppConvexCredentials.app_id == app_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise AppError(
            detail=(
                f"No Convex credentials found for app {app_id}. "
                "Paste your deploy key in the Publish dialog."
            ),
            status_code=404,
            error_code="CREDENTIALS_NOT_FOUND",
        )

    plaintext_key = decrypt(row.deploy_key_encrypted)
    deployment_url = row.deployment_url

    row.last_used_at = datetime.now(UTC)
    await db.flush()

    logger.info(
        "convex_credentials_loaded_for_publish",
        app_id=str(app_id),
        team_slug=row.team_slug,
    )
    return plaintext_key, deployment_url
