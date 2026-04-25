"""Convex publish migration pipeline — state machine advancing AppPublishJob (T3.8/T3.9).

Each step updates job.status before doing work so that concurrent poll
requests reflect progress in near-real-time.

T3.8: OAuth-based provisioning replaced with deploy-key credentials.
      _step_provision + _step_push_schema + _step_push_functions replaced
      with _step_validate_credentials + _step_push_code (runs npx convex deploy).
T3.9: _step_copy_data implemented with scratch-deployment pattern per ADR 007.
"""

from __future__ import annotations

import asyncio
import json
import re
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

import structlog
from sqlalchemy import select, update

from appio_builder.config import load_config
from appio_builder.orchestrator import BuildError, BuildResult
from appio_builder.r2 import R2Client, R2Error, WorkspaceDownloadResult
from appio_db.models import App, AppPublishJob, Generation, User
from apps.api.core.exceptions import AppError, NotFoundError
from apps.api.domains.builds.tasks import build_published_workspace

from .cli import (
    ConvexCliError,
    run_convex_deploy,
    run_convex_export,
    run_convex_import,
    run_convex_run,
)
from .credentials_service import load_credentials_for_publish
from .management import ConvexManagementClient, ScratchDeployment, get_management_client
from .schema_parser import extract_table_names

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.stdlib.get_logger()

# Path of the Convex config inside a generated workspace, relative to the
# workspace root. Matches ``packages/templates/base/src/config/convex.ts``.
_CONVEX_CONFIG_REL = Path("src/config/convex.ts")


class PublishError(AppError):
    def __init__(self, detail: str, step: str) -> None:
        super().__init__(
            detail=f"[{step}] {detail}",
            status_code=500,
            error_code="PUBLISH_FAILED",
        )
        self.step = step


async def start_publish(
    db: AsyncSession,
    user_id: UUID,
    app: App,
) -> AppPublishJob:
    """Create a pending job and return it; the caller enqueues run_publish_pipeline."""
    if app.user_id != user_id:
        raise NotFoundError(detail="App not found")

    if app.status not in ("ready", "published"):
        raise AppError(
            detail=f"App must be in 'ready' state to publish (current: {app.status})",
            status_code=400,
            error_code="APP_NOT_READY",
        )

    job = AppPublishJob(
        app_id=app.id,
        user_id=user_id,
        status="pending",
        started_at=datetime.now(UTC),
    )
    db.add(job)
    await db.flush()

    logger.info(
        "publish_job_created",
        job_id=str(job.id),
        app_id=str(app.id),
        user_id=str(user_id),
    )
    return job


async def run_publish_pipeline(
    db: AsyncSession,
    job_id: UUID,
    client: object = None,  # kept for backwards compat — unused in T3.8
) -> None:
    """Advance the job through all publish steps.

    Pipeline: pending → validating_credentials → rewriting_config →
              pushing_code → copying_data → rebuilding → published

    On any exception: marks job failed, mirrors status to App, then re-raises
    so the Dramatiq actor can record the failure.
    """
    result = await db.execute(select(AppPublishJob).where(AppPublishJob.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise NotFoundError(detail=f"Publish job {job_id} not found")

    app_result = await db.execute(select(App).where(App.id == job.app_id))
    app = app_result.scalar_one_or_none()
    if app is None:
        raise NotFoundError(detail=f"App {job.app_id} not found")

    try:
        try:
            management_client: ConvexManagementClient = get_management_client()
        except RuntimeError as exc:
            raise PublishError(
                f"Convex Management API not configured: {exc}",
                step="pending",
            ) from exc

        deploy_key, deployment_url = await _step_validate_credentials(db, job, app)

        with tempfile.TemporaryDirectory(prefix="appio-publish-") as scratch:
            scratch_path = Path(scratch)

            # rewrite_config runs first — downloads workspace to disk, which
            # npx convex deploy needs in order to push schema + functions.
            workspace, sandbox_url = await _step_rewrite_config(
                db, job, app, deployment_url, scratch_path,
            )

            await _step_push_code(db, job, workspace, deploy_key, deployment_url)
            await _step_copy_data(
                db,
                job,
                app,
                workspace=workspace,
                scratch_path=scratch_path,
                deploy_key=deploy_key,
                deployment_url=deployment_url,
                management_client=management_client,
            )

            await _step_rebuild(
                db,
                job,
                app,
                workspace=workspace,
                sandbox_url=sandbox_url,
                published_url=deployment_url,
            )

        await _step_mark_published(db, job, app, deployment_url)

    except Exception as exc:
        job.status = "failed"
        job.error_message = str(exc)
        job.completed_at = datetime.now(UTC)
        app.publish_status = "failed"
        await db.flush()
        logger.error(
            "publish_pipeline_failed",
            job_id=str(job_id),
            app_id=str(app.id),
            error=str(exc),
        )
        raise


async def _advance(db: AsyncSession, job: AppPublishJob, status: str, step: str) -> None:
    job.status = status
    job.current_step = step
    await db.flush()


async def _step_validate_credentials(
    db: AsyncSession,
    job: AppPublishJob,
    app: App,
) -> tuple[str, str]:
    """Load encrypted deploy key + URL. Raises PublishError if not configured."""
    await _advance(db, job, "validating_credentials", "Validating Convex credentials")
    try:
        deploy_key, deployment_url = await load_credentials_for_publish(
            db, app_id=app.id,
        )
    except AppError as exc:  # 404 = no credentials row
        raise PublishError(
            "Convex deploy key not configured for this app. "
            "Paste your key in the Publish dialog before retrying.",
            step="validating_credentials",
        ) from exc
    return deploy_key, deployment_url


async def _step_push_code(
    db: AsyncSession,
    job: AppPublishJob,
    workspace: Path,
    deploy_key: str,
    deployment_url: str,
) -> None:
    """Run `npx convex deploy` from the rewritten workspace."""
    await _advance(db, job, "pushing_code", "Pushing Convex schema + functions")
    logger.info("publish_step_push_code", job_id=str(job.id))
    try:
        await run_convex_deploy(
            workspace=workspace,
            deploy_key=deploy_key,
            deployment_url=deployment_url,
        )
    except ConvexCliError as exc:
        raise PublishError(
            f"npx convex deploy failed: {exc.stderr[:200]}",
            step="pushing_code",
        ) from exc


_MAX_TABLES_PER_MIGRATION = 50


async def _step_copy_data(
    db: AsyncSession,
    job: AppPublishJob,
    app: App,
    *,
    workspace: Path,
    scratch_path: Path,
    deploy_key: str,
    deployment_url: str,
    management_client: ConvexManagementClient,
) -> None:
    """Migrate tenant data from sandbox → scratch → user deployment (ADR 007 §Data migration)."""
    await _advance(db, job, "copying_data", "Copying sandbox data")

    # 1. Resolve firebase_uid (tenantId) from job.user_id.
    user_result = await db.execute(select(User).where(User.id == job.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise PublishError(
            f"User {job.user_id} not found — cannot resolve tenantId for data migration.",
            step="copying_data",
        )
    firebase_uid: str = user.firebase_uid

    # 2. Parse schema.ts to discover table names.
    schema_ts_path = workspace / "convex" / "schema.ts"
    try:
        schema_content = schema_ts_path.read_text(encoding="utf-8")
        table_names = extract_table_names(schema_content)
    except (OSError, ValueError) as exc:
        raise PublishError(
            f"Could not parse convex/schema.ts to discover table names: {exc}",
            step="copying_data",
        ) from exc

    # FIX 7: bound table count before provisioning anything.
    if len(table_names) > _MAX_TABLES_PER_MIGRATION:
        raise PublishError(
            f"convex/schema.ts declares {len(table_names)} tables; "
            f"migration bounded at {_MAX_TABLES_PER_MIGRATION}. Reduce schema complexity or split the app.",
            step="copying_data",
        )

    # 3. Read sandbox credentials from settings.
    from apps.api.config import settings as _settings

    sandbox_deploy_key = _settings.appio_sandbox_deploy_key
    sandbox_url = _settings.appio_sandbox_convex_url
    if not sandbox_deploy_key:
        raise PublishError(
            "sandbox deploy key not configured — set APPIO_SANDBOX_DEPLOY_KEY.",
            step="copying_data",
        )

    _page_size = 500
    scratch: ScratchDeployment | None = None
    try:
        # 4a. Provision scratch deployment.
        scratch = await management_client.provision_scratch_deployment(
            label=f"appio-scratch-{job.id}",
        )
        logger.info(
            "scratch_deployment_provisioned",
            job_id=str(job.id),
            scratch_id=scratch.deployment_id,
            scratch_url=scratch.deployment_url,
        )

        # 4b. Deploy user's schema + functions (including _appio_internal.ts) to scratch.
        try:
            await run_convex_deploy(
                workspace=workspace,
                deploy_key=scratch.deploy_key,
                deployment_url=scratch.deployment_url,
            )
        except ConvexCliError as exc:
            raise PublishError(
                f"npx convex deploy to scratch failed: {exc.stderr[:200]}",
                step="copying_data",
            ) from exc

        # 4c. Export from sandbox → insert into scratch, table by table (cursor-based).
        for table_name in table_names:
            cursor: str | None = None
            while True:
                try:
                    export_result = await run_convex_run(
                        function_name="_appio_internal:exportTenantRows",
                        args_json=json.dumps(
                            {
                                "tenantId": firebase_uid,
                                "tableName": table_name,
                                "cursor": cursor,
                                "numItems": _page_size,
                            }
                        ),
                        deploy_key=sandbox_deploy_key,
                        deployment_url=sandbox_url,
                        cwd=workspace,
                    )
                except ConvexCliError as exc:
                    raise PublishError(
                        f"exportTenantRows on sandbox failed for {table_name}: {exc.stderr[:200]}",
                        step="copying_data",
                    ) from exc
                try:
                    data = json.loads(export_result.stdout)
                except json.JSONDecodeError as exc:
                    raise PublishError(
                        f"exportTenantRows returned non-JSON for table {table_name}: {str(exc)[:100]}",
                        step="copying_data",
                    ) from exc
                rows = data["rows"]
                if rows:
                    try:
                        await run_convex_run(
                            function_name="_appio_internal:bulkInsert",
                            args_json=json.dumps(
                                {
                                    "tableName": table_name,
                                    "expectedTenantId": firebase_uid,
                                    "rows": rows,
                                }
                            ),
                            deploy_key=scratch.deploy_key,
                            deployment_url=scratch.deployment_url,
                            cwd=workspace,
                        )
                    except ConvexCliError as exc:
                        raise PublishError(
                            f"bulkInsert into scratch failed on {table_name}: {exc.stderr[:200]}",
                            step="copying_data",
                        ) from exc
                if data["isDone"]:
                    break
                cursor = data["continueCursor"]

        # 4d. Row-count verification.
        for table_name in table_names:
            try:
                sandbox_count_result = await run_convex_run(
                    function_name="_appio_internal:countTenantRows",
                    args_json=json.dumps(
                        {"tenantId": firebase_uid, "tableName": table_name}
                    ),
                    deploy_key=sandbox_deploy_key,
                    deployment_url=sandbox_url,
                    cwd=workspace,
                )
            except ConvexCliError as exc:
                raise PublishError(
                    f"countTenantRows on sandbox failed for {table_name}: {exc.stderr[:200]}",
                    step="copying_data",
                ) from exc
            try:
                scratch_count_result = await run_convex_run(
                    function_name="_appio_internal:countAllRows",
                    args_json=json.dumps({"tableName": table_name}),
                    deploy_key=scratch.deploy_key,
                    deployment_url=scratch.deployment_url,
                    cwd=workspace,
                )
            except ConvexCliError as exc:
                raise PublishError(
                    f"countAllRows on scratch failed for {table_name}: {exc.stderr[:200]}",
                    step="copying_data",
                ) from exc
            try:
                sandbox_count = json.loads(sandbox_count_result.stdout)["count"]
                scratch_count = json.loads(scratch_count_result.stdout)["count"]
            except (json.JSONDecodeError, KeyError) as exc:
                raise PublishError(
                    f"Could not read row counts for {table_name}: {exc}",
                    step="copying_data",
                ) from exc
            if sandbox_count != scratch_count:
                raise PublishError(
                    f"Row count mismatch on {table_name}: "
                    f"sandbox={sandbox_count}, scratch={scratch_count}",
                    step="copying_data",
                )

        # 4e. Export snapshot from scratch.
        # FIX 8: use scratch_path explicitly so snapshot stays inside the temp dir
        # regardless of workspace depth. FIX 3: pass cwd=workspace (valid project dir).
        snapshot_path = scratch_path / f"scratch-snapshot-{job.id}.zip"
        try:
            await run_convex_export(
                deploy_key=scratch.deploy_key,
                deployment_url=scratch.deployment_url,
                snapshot_path=snapshot_path,
                cwd=workspace,
            )
        except ConvexCliError as exc:
            raise PublishError(
                f"npx convex export from scratch failed: {exc.stderr[:200]}",
                step="copying_data",
            ) from exc

        # 4f. Import snapshot into user's deployment.
        try:
            await run_convex_import(
                snapshot_path=snapshot_path,
                deploy_key=deploy_key,
                deployment_url=deployment_url,
                cwd=workspace,
                replace=True,
            )
        except ConvexCliError as exc:
            raise PublishError(
                f"npx convex import into user deployment failed: {exc.stderr[:200]}",
                step="copying_data",
            ) from exc

    finally:
        if scratch is not None:
            try:
                await management_client.teardown_deployment(
                    deployment_id=scratch.deployment_id,
                )
            except Exception as teardown_exc:
                # CRITICAL: do NOT re-raise — the primary pipeline error (if any)
                # is more important. Log the orphan scratch_id so the cleanup
                # job (followup) can collect it.
                logger.error(
                    "scratch_teardown_failed",
                    scratch_id=scratch.deployment_id,
                    error=str(teardown_exc),
                )


async def _step_rewrite_config(
    db: AsyncSession,
    job: AppPublishJob,
    app: App,
    deployment_url: str,
    scratch: Path,
) -> tuple[Path, str]:
    """Download the app's workspace from R2 and rewrite its Convex config.

    Returns ``(workspace_path, sandbox_convex_url)``. The caller passes both
    to :func:`_step_rebuild`, which patches the compiled ``dist/`` and
    redeploys. The sandbox URL we read back from the source file is what
    gets swapped out in the compiled bundle — we don't hardcode it because
    different apps can point at different sandbox deployments.
    """
    await _advance(db, job, "rewriting_config", "Rewriting Convex config")

    latest_gen_result = await db.execute(
        select(Generation)
        .where(Generation.app_id == app.id)
        .where(Generation.workspace_url.isnot(None))
        .order_by(Generation.created_at.desc())
        .limit(1)
    )
    generation = latest_gen_result.scalar_one_or_none()
    if generation is None:
        raise PublishError(
            f"No persisted workspace found for app {app.id}; "
            "cannot rewrite Convex config without source access.",
            step="rewriting_config",
        )

    try:
        download_result = await asyncio.to_thread(
            _download_workspace, generation_id=str(generation.id), scratch=scratch,
        )
    except R2Error as exc:
        raise PublishError(
            f"Could not download workspace {generation.workspace_url}: {exc}",
            step="rewriting_config",
        ) from exc

    workspace = download_result.workspace
    convex_ts = workspace / _CONVEX_CONFIG_REL
    if not convex_ts.is_file():
        raise PublishError(
            f"Workspace is missing {_CONVEX_CONFIG_REL} — cannot rewrite Convex config.",
            step="rewriting_config",
        )

    original = convex_ts.read_text(encoding="utf-8")
    try:
        rewritten, sandbox_url = _rewrite_convex_config_text(
            original, new_url=deployment_url,
        )
    except ValueError as exc:
        raise PublishError(
            f"{_CONVEX_CONFIG_REL} does not match the expected Convex config shape: {exc}",
            step="rewriting_config",
        ) from exc

    convex_ts.write_text(rewritten, encoding="utf-8")

    app_version = (app.current_version or 0) + 1
    try:
        await asyncio.to_thread(
            _upload_published_workspace,
            workspace=workspace,
            app_id=str(app.id),
            version=app_version,
        )
    except R2Error as exc:
        logger.warning(
            "publish_workspace_archive_failed",
            job_id=str(job.id),
            app_id=str(app.id),
            version=app_version,
            error=str(exc),
        )

    logger.info(
        "publish_step_rewrite_config",
        job_id=str(job.id),
        app_id=str(app.id),
        generation_id=str(generation.id),
        sandbox_url=sandbox_url,
        published_url=deployment_url,
        next_version=app_version,
    )

    return workspace, sandbox_url


async def _step_rebuild(
    db: AsyncSession,
    job: AppPublishJob,
    app: App,
    *,
    workspace: Path,
    sandbox_url: str,
    published_url: str,
) -> BuildResult:
    """Re-emit dist/ with the published Convex URL and push to R2 + KV."""
    await _advance(db, job, "rebuilding", "Rebuilding app with new Convex URL")

    next_version = (app.current_version or 0) + 1

    try:
        build_result = await build_published_workspace(
            app_id=str(app.id),
            version=next_version,
            workspace=workspace,
            sandbox_convex_url=sandbox_url,
            published_convex_url=published_url,
        )
    except BuildError as exc:
        raise PublishError(
            f"Rebuild failed at stage '{exc.stage}': {exc}",
            step="rebuilding",
        ) from exc

    await db.execute(
        update(App)
        .where(App.id == app.id)
        .values(current_version=next_version)
    )
    app.current_version = next_version

    logger.info(
        "publish_step_rebuild",
        job_id=str(job.id),
        app_id=str(app.id),
        version=next_version,
        r2_prefix=build_result.r2_prefix,
        public_url=build_result.public_url,
    )
    return build_result


async def _step_mark_published(
    db: AsyncSession,
    job: AppPublishJob,
    app: App,
    deployment_url: str,
) -> None:
    await _advance(db, job, "published", "Published")
    now = datetime.now(UTC)
    job.status = "published"
    job.deployment_url = deployment_url
    job.completed_at = now

    if app.published_at is None:
        app.published_at = now
    app.publish_status = "published"

    await db.flush()
    logger.info(
        "publish_complete",
        job_id=str(job.id),
        app_id=str(app.id),
        deployment_url=deployment_url,
    )


# ── helpers ──────────────────────────────────────────────────────────────────


def _make_r2_client() -> R2Client:
    cfg = load_config()
    return R2Client(
        account_id=cfg.r2_account_id,
        access_key=cfg.r2_access_key,
        secret_key=cfg.r2_secret_key,
        bucket=cfg.r2_bucket,
        endpoint_url=cfg.r2_endpoint,
    )


def _download_workspace(
    *, generation_id: str, scratch: Path,
) -> WorkspaceDownloadResult:
    """Thin wrapper so tests can monkeypatch one symbol instead of boto3."""
    return _make_r2_client().download_workspace(generation_id, dest_dir=scratch)


def _upload_published_workspace(*, workspace: Path, app_id: str, version: int) -> None:
    _make_r2_client().upload_published_workspace(
        workspace, app_id=app_id, version=version,
    )


# Matches ``export const CONVEX_URL = "...";`` — captures the URL so we can
# both replace it and return the old value to the caller. The quote style
# is normalised to double quotes on rewrite.
_CONVEX_URL_RE = re.compile(
    r"""export\s+const\s+CONVEX_URL\s*=\s*["']([^"']+)["']\s*;""",
)
# Matches ``export const CONVEX_MODE: ConvexMode = "sandbox";`` (or whatever
# the current mode is). We keep the type annotation to preserve formatting.
_CONVEX_MODE_RE = re.compile(
    r"""(export\s+const\s+CONVEX_MODE\s*(?::\s*\w+\s*)?=\s*)["'][^"']+["']\s*;""",
)


def _rewrite_convex_config_text(source: str, *, new_url: str) -> tuple[str, str]:
    """Rewrite CONVEX_URL and CONVEX_MODE in a convex.ts source string.

    Returns ``(rewritten_source, old_url)``. Raises :class:`ValueError`
    if either constant is missing — a workspace without them is malformed
    and shouldn't be published at all.
    """
    url_match = _CONVEX_URL_RE.search(source)
    if url_match is None:
        raise ValueError("missing `export const CONVEX_URL = ...;`")
    old_url = url_match.group(1)

    mode_match = _CONVEX_MODE_RE.search(source)
    if mode_match is None:
        raise ValueError("missing `export const CONVEX_MODE = ...;`")

    new_url_literal = json.dumps(new_url)
    rewritten = _CONVEX_URL_RE.sub(
        f"export const CONVEX_URL = {new_url_literal};", source,
    )
    rewritten = _CONVEX_MODE_RE.sub(
        lambda m: f'{m.group(1)}"published";', rewritten,
    )
    return rewritten, old_url
