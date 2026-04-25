"""Unit tests for the Convex publish migration pipeline (T3.8/T3.9).

Uses AsyncMock for DB. The OAuth-based steps are replaced by credentials-
service and CLI subprocess mocks.
"""

from __future__ import annotations

import uuid
from pathlib import Path  # noqa: TCH003
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from structlog.testing import capture_logs

# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_job(
    job_id: uuid.UUID | None = None,
    app_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
) -> MagicMock:
    job = MagicMock()
    job.id = job_id or uuid.uuid4()
    job.app_id = app_id or uuid.uuid4()
    job.user_id = user_id or uuid.uuid4()
    job.status = "pending"
    job.current_step = None
    job.error_message = None
    job.deployment_url = None
    job.completed_at = None
    return job


def _make_app(
    app_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    status: str = "ready",
    current_version: int = 0,
) -> MagicMock:
    app = MagicMock()
    app.id = app_id or uuid.uuid4()
    app.user_id = user_id or uuid.uuid4()
    app.status = status
    app.slug = "test-app"
    app.published_at = None
    app.publish_status = None
    app.current_version = current_version
    return app


def _make_generation(app_id: uuid.UUID, workspace_url: str = "r2://ws/gen-001.tar.gz") -> MagicMock:
    gen = MagicMock()
    gen.id = uuid.uuid4()
    gen.app_id = app_id
    gen.workspace_url = workspace_url
    return gen


def _make_db_with_sequence(returns: list) -> AsyncMock:
    """DB whose execute() returns values from `returns` in order."""
    db = AsyncMock()
    results = []
    for val in returns:
        r = MagicMock()
        r.scalar_one_or_none.return_value = val
        r.scalar_one.return_value = val
        results.append(r)
    db.execute = AsyncMock(side_effect=results)
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.delete = AsyncMock()
    return db


def _make_valid_convex_ts() -> str:
    return (
        'import type { ConvexMode } from "./types";\n\n'
        'export const CONVEX_URL = "https://sandbox-app.convex.cloud";\n'
        'export const CONVEX_MODE: ConvexMode = "sandbox";\n'
    )


def _build_workspace(tmp_path: Path, convex_ts_content: str | None = None) -> Path:
    """Create a minimal workspace directory tree under tmp_path."""
    workspace = tmp_path / "workspace"
    config_dir = workspace / "src" / "config"
    config_dir.mkdir(parents=True)
    dist_dir = workspace / "dist"
    dist_dir.mkdir()
    content = convex_ts_content if convex_ts_content is not None else _make_valid_convex_ts()
    (config_dir / "convex.ts").write_text(content, encoding="utf-8")
    (dist_dir / "index.js").write_text(
        'const url="https://sandbox-app.convex.cloud";', encoding="utf-8"
    )
    return workspace


_FAKE_DEPLOY_KEY = "prod:my-team|supersecret"
_FAKE_DEPLOYMENT_URL = "https://happy-animal-123.convex.cloud"


# ── _rewrite_convex_config_text unit tests ────────────────────────────────────


class TestRewriteConvexConfigText:
    def _fn(self, source: str, new_url: str = "https://prod.convex.cloud") -> tuple[str, str]:
        from apps.api.domains.convex.migration_service import _rewrite_convex_config_text
        return _rewrite_convex_config_text(source, new_url=new_url)

    def test_replaces_url_and_returns_old_url(self) -> None:
        source = _make_valid_convex_ts()
        rewritten, old_url = self._fn(source)
        assert old_url == "https://sandbox-app.convex.cloud"
        assert 'CONVEX_URL = "https://prod.convex.cloud"' in rewritten

    def test_sets_mode_to_published(self) -> None:
        source = _make_valid_convex_ts()
        rewritten, _ = self._fn(source)
        assert '"published"' in rewritten
        assert '"sandbox"' not in rewritten

    def test_raises_value_error_when_convex_url_missing(self) -> None:
        source = 'export const CONVEX_MODE: ConvexMode = "sandbox";\n'
        with pytest.raises(ValueError, match="CONVEX_URL"):
            self._fn(source)

    def test_raises_value_error_when_convex_mode_missing(self) -> None:
        source = 'export const CONVEX_URL = "https://sandbox-app.convex.cloud";\n'
        with pytest.raises(ValueError, match="CONVEX_MODE"):
            self._fn(source)

    def test_preserves_surrounding_content(self) -> None:
        source = (
            "// top comment\n"
            'import type { ConvexMode } from "./types";\n'
            'export const CONVEX_URL = "https://sandbox-app.convex.cloud";\n'
            'export const CONVEX_MODE: ConvexMode = "sandbox";\n'
            "// bottom comment\n"
        )
        rewritten, _ = self._fn(source)
        assert "// top comment" in rewritten
        assert "// bottom comment" in rewritten
        assert 'import type { ConvexMode }' in rewritten

    def test_idempotent_when_called_twice(self) -> None:
        source = _make_valid_convex_ts()
        rewritten1, _ = self._fn(source, new_url="https://prod.convex.cloud")
        rewritten2, old2 = self._fn(rewritten1, new_url="https://prod.convex.cloud")
        assert rewritten1 == rewritten2
        assert old2 == "https://prod.convex.cloud"

    def test_real_world_multiline_template(self) -> None:
        source = (
            'import type { ConvexMode } from "./types";\n\n'
            "export const CONVEX_URL =\n"
            '  "https://happy-animal-123.convex.cloud";\n'
            'export const CONVEX_MODE: ConvexMode = "sandbox";\n'
        )
        rewritten, old_url = self._fn(source, new_url="https://prod.convex.cloud")
        assert old_url == "https://happy-animal-123.convex.cloud"
        assert "https://prod.convex.cloud" in rewritten


# ── _step_rewrite_config tests ────────────────────────────────────────────────


class TestStepRewriteConfig:
    def _make_download_result(self, workspace: Path) -> MagicMock:
        result = MagicMock()
        result.workspace = workspace
        return result

    @pytest.mark.asyncio
    async def test_happy_path_rewrites_and_uploads(self, tmp_path: Path) -> None:
        app_id = uuid.uuid4()
        user_id = uuid.uuid4()
        job = _make_job(app_id=app_id, user_id=user_id)
        app = _make_app(app_id=app_id, user_id=user_id)
        generation = _make_generation(app_id)

        workspace = _build_workspace(tmp_path)
        download_result = self._make_download_result(workspace)

        db = _make_db_with_sequence([generation])

        with (
            patch(
                "apps.api.domains.convex.migration_service._download_workspace",
                return_value=download_result,
            ),
            patch(
                "apps.api.domains.convex.migration_service._upload_published_workspace",
            ) as mock_upload,
        ):
            from apps.api.domains.convex.migration_service import _step_rewrite_config

            ws_path, sandbox_url = await _step_rewrite_config(
                db, job, app, "https://prod.convex.cloud", tmp_path
            )

        assert ws_path == workspace
        assert sandbox_url == "https://sandbox-app.convex.cloud"
        mock_upload.assert_called_once()
        rewritten = (workspace / "src" / "config" / "convex.ts").read_text()
        assert "https://prod.convex.cloud" in rewritten
        assert '"published"' in rewritten

    @pytest.mark.asyncio
    async def test_raises_publish_error_when_no_generation(self, tmp_path: Path) -> None:
        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        app = _make_app(app_id=app_id)

        db = _make_db_with_sequence([None])

        from apps.api.domains.convex.migration_service import PublishError, _step_rewrite_config

        with pytest.raises(PublishError) as exc_info:
            await _step_rewrite_config(db, job, app, "https://prod.convex.cloud", tmp_path)

        assert exc_info.value.step == "rewriting_config"
        assert "No persisted workspace" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_raises_publish_error_when_convex_ts_missing(self, tmp_path: Path) -> None:
        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        app = _make_app(app_id=app_id)
        generation = _make_generation(app_id)

        workspace = tmp_path / "workspace"
        workspace.mkdir()

        download_result = self._make_download_result(workspace)
        db = _make_db_with_sequence([generation])

        with patch(
            "apps.api.domains.convex.migration_service._download_workspace",
            return_value=download_result,
        ):
            from apps.api.domains.convex.migration_service import PublishError, _step_rewrite_config

            with pytest.raises(PublishError) as exc_info:
                await _step_rewrite_config(
                    db, job, app, "https://prod.convex.cloud", tmp_path
                )

        assert exc_info.value.step == "rewriting_config"
        assert "missing" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_raises_publish_error_when_convex_ts_malformed(self, tmp_path: Path) -> None:
        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        app = _make_app(app_id=app_id)
        generation = _make_generation(app_id)

        workspace = _build_workspace(tmp_path, convex_ts_content="// empty config\n")
        download_result = self._make_download_result(workspace)
        db = _make_db_with_sequence([generation])

        with patch(
            "apps.api.domains.convex.migration_service._download_workspace",
            return_value=download_result,
        ):
            from apps.api.domains.convex.migration_service import PublishError, _step_rewrite_config

            with pytest.raises(PublishError) as exc_info:
                await _step_rewrite_config(
                    db, job, app, "https://prod.convex.cloud", tmp_path
                )

        assert exc_info.value.step == "rewriting_config"

    @pytest.mark.asyncio
    async def test_raises_publish_error_when_r2_download_fails(self, tmp_path: Path) -> None:
        from appio_builder.r2 import R2Error

        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        app = _make_app(app_id=app_id)
        generation = _make_generation(app_id)
        db = _make_db_with_sequence([generation])

        with patch(
            "apps.api.domains.convex.migration_service._download_workspace",
            side_effect=R2Error("bucket unreachable"),
        ):
            from apps.api.domains.convex.migration_service import PublishError, _step_rewrite_config

            with pytest.raises(PublishError) as exc_info:
                await _step_rewrite_config(
                    db, job, app, "https://prod.convex.cloud", tmp_path
                )

        assert exc_info.value.step == "rewriting_config"
        assert "bucket unreachable" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_proceeds_when_r2_upload_fails(self, tmp_path: Path) -> None:
        """Upload failure is best-effort — step must still succeed and log a warning."""
        from appio_builder.r2 import R2Error

        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        app = _make_app(app_id=app_id)
        generation = _make_generation(app_id)

        workspace = _build_workspace(tmp_path)
        download_result = self._make_download_result(workspace)
        db = _make_db_with_sequence([generation])

        with (
            patch(
                "apps.api.domains.convex.migration_service._download_workspace",
                return_value=download_result,
            ),
            patch(
                "apps.api.domains.convex.migration_service._upload_published_workspace",
                side_effect=R2Error("upload quota exceeded"),
            ),
        ):
            from apps.api.domains.convex.migration_service import _step_rewrite_config

            with capture_logs() as cap_logs:
                ws_path, sandbox_url = await _step_rewrite_config(
                    db, job, app, "https://prod.convex.cloud", tmp_path
                )

        assert ws_path == workspace
        assert sandbox_url == "https://sandbox-app.convex.cloud"
        assert any(e["event"] == "publish_workspace_archive_failed" for e in cap_logs)


# ── _step_rebuild tests ───────────────────────────────────────────────────────


class TestStepRebuild:
    @pytest.mark.asyncio
    async def test_happy_path_bumps_version(self, tmp_path: Path) -> None:
        from appio_builder.orchestrator import BuildResult

        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        app = _make_app(app_id=app_id, current_version=2)

        workspace = _build_workspace(tmp_path)

        fake_build_result = BuildResult(
            app_id=str(app_id),
            version=3,
            file_count=5,
            total_bytes=10_000,
            duration_seconds=1.2,
            r2_prefix=f"{app_id}/v3",
            public_url="https://cdn.example.com/app/v3/index.html",
        )

        db = _make_db_with_sequence([])
        db.execute = AsyncMock(return_value=MagicMock())

        with patch(
            "apps.api.domains.convex.migration_service.build_published_workspace",
            AsyncMock(return_value=fake_build_result),
        ):
            from apps.api.domains.convex.migration_service import _step_rebuild

            result = await _step_rebuild(
                db,
                job,
                app,
                workspace=workspace,
                sandbox_url="https://sandbox-app.convex.cloud",
                published_url="https://prod.convex.cloud",
            )

        assert result is fake_build_result
        assert app.current_version == 3

    @pytest.mark.asyncio
    async def test_raises_publish_error_on_build_error(self, tmp_path: Path) -> None:
        from appio_builder.orchestrator import BuildError

        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        app = _make_app(app_id=app_id, current_version=0)
        workspace = _build_workspace(tmp_path)

        db = AsyncMock()

        with patch(
            "apps.api.domains.convex.migration_service.build_published_workspace",
            AsyncMock(
                side_effect=BuildError("esbuild crashed", stage="bundling", recoverable=False)
            ),
        ):
            from apps.api.domains.convex.migration_service import PublishError, _step_rebuild

            with pytest.raises(PublishError) as exc_info:
                await _step_rebuild(
                    db,
                    job,
                    app,
                    workspace=workspace,
                    sandbox_url="https://sandbox-app.convex.cloud",
                    published_url="https://prod.convex.cloud",
                )

        assert exc_info.value.step == "rebuilding"

    @pytest.mark.asyncio
    async def test_build_error_stage_info_in_publish_error_message(self, tmp_path: Path) -> None:
        from appio_builder.orchestrator import BuildError

        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        app = _make_app(app_id=app_id)
        workspace = _build_workspace(tmp_path)

        db = AsyncMock()

        with patch(
            "apps.api.domains.convex.migration_service.build_published_workspace",
            AsyncMock(
                side_effect=BuildError(
                    "OOM during minification", stage="minification", recoverable=False
                )
            ),
        ):
            from apps.api.domains.convex.migration_service import PublishError, _step_rebuild

            with pytest.raises(PublishError) as exc_info:
                await _step_rebuild(
                    db,
                    job,
                    app,
                    workspace=workspace,
                    sandbox_url="https://sandbox-app.convex.cloud",
                    published_url="https://prod.convex.cloud",
                )

        assert "minification" in str(exc_info.value)


# ── _step_validate_credentials tests ─────────────────────────────────────────


class TestStepValidateCredentials:
    @pytest.mark.asyncio
    async def test_happy_path_returns_credentials(self) -> None:
        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        app = _make_app(app_id=app_id)
        db = AsyncMock()
        db.flush = AsyncMock()

        with patch(
            "apps.api.domains.convex.migration_service.load_credentials_for_publish",
            AsyncMock(return_value=(_FAKE_DEPLOY_KEY, _FAKE_DEPLOYMENT_URL)),
        ):
            from apps.api.domains.convex.migration_service import _step_validate_credentials

            deploy_key, deployment_url = await _step_validate_credentials(db, job, app)

        assert deploy_key == _FAKE_DEPLOY_KEY
        assert deployment_url == _FAKE_DEPLOYMENT_URL
        assert job.status == "validating_credentials"

    @pytest.mark.asyncio
    async def test_no_credentials_raises_publish_error(self) -> None:
        from apps.api.core.exceptions import AppError

        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        app = _make_app(app_id=app_id)
        db = AsyncMock()
        db.flush = AsyncMock()

        with patch(
            "apps.api.domains.convex.migration_service.load_credentials_for_publish",
            AsyncMock(
                side_effect=AppError(
                    "No creds", status_code=404, error_code="CREDENTIALS_NOT_FOUND"
                )
            ),
        ):
            from apps.api.domains.convex.migration_service import (
                PublishError,
                _step_validate_credentials,
            )

            with pytest.raises(PublishError) as exc_info:
                await _step_validate_credentials(db, job, app)

        assert exc_info.value.step == "validating_credentials"
        assert "deploy key not configured" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_advances_status_to_validating_credentials(self) -> None:
        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        app = _make_app(app_id=app_id)
        db = AsyncMock()
        db.flush = AsyncMock()

        with patch(
            "apps.api.domains.convex.migration_service.load_credentials_for_publish",
            AsyncMock(return_value=(_FAKE_DEPLOY_KEY, _FAKE_DEPLOYMENT_URL)),
        ):
            from apps.api.domains.convex.migration_service import _step_validate_credentials

            await _step_validate_credentials(db, job, app)

        assert job.status == "validating_credentials"
        db.flush.assert_awaited()


# ── _step_push_code tests ─────────────────────────────────────────────────────


class TestStepPushCode:
    @pytest.mark.asyncio
    async def test_happy_path_calls_convex_deploy(self, tmp_path: Path) -> None:
        from apps.api.domains.convex.cli import CliResult

        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        workspace = _build_workspace(tmp_path)
        db = AsyncMock()
        db.flush = AsyncMock()

        fake_result = CliResult(stdout="Deployed successfully", stderr="")

        with patch(
            "apps.api.domains.convex.migration_service.run_convex_deploy",
            AsyncMock(return_value=fake_result),
        ) as mock_deploy:
            from apps.api.domains.convex.migration_service import _step_push_code

            await _step_push_code(
                db, job, workspace, _FAKE_DEPLOY_KEY, _FAKE_DEPLOYMENT_URL
            )

        mock_deploy.assert_awaited_once_with(
            workspace=workspace,
            deploy_key=_FAKE_DEPLOY_KEY,
            deployment_url=_FAKE_DEPLOYMENT_URL,
        )
        assert job.status == "pushing_code"

    @pytest.mark.asyncio
    async def test_cli_error_raises_publish_error(self, tmp_path: Path) -> None:
        from apps.api.domains.convex.cli import ConvexCliError

        app_id = uuid.uuid4()
        job = _make_job(app_id=app_id)
        workspace = _build_workspace(tmp_path)
        db = AsyncMock()
        db.flush = AsyncMock()

        with patch(
            "apps.api.domains.convex.migration_service.run_convex_deploy",
            AsyncMock(
                side_effect=ConvexCliError("npx", 1, "error: invalid deploy key\n")
            ),
        ):
            from apps.api.domains.convex.migration_service import PublishError, _step_push_code

            with pytest.raises(PublishError) as exc_info:
                await _step_push_code(
                    db, job, workspace, _FAKE_DEPLOY_KEY, _FAKE_DEPLOYMENT_URL
                )

        assert exc_info.value.step == "pushing_code"
        assert "npx convex deploy failed" in str(exc_info.value)


# ── start_publish tests ───────────────────────────────────────────────────────


class TestStartPublish:
    @pytest.mark.asyncio
    async def test_creates_job_for_ready_app(self) -> None:
        user_id = uuid.uuid4()
        app_id = uuid.uuid4()
        app = _make_app(app_id=app_id, user_id=user_id, status="ready")

        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()

        from apps.api.domains.convex.migration_service import start_publish

        job = await start_publish(db, user_id=user_id, app=app)

        db.add.assert_called_once()
        db.flush.assert_awaited_once()
        assert job.status == "pending"

    @pytest.mark.asyncio
    async def test_raises_when_app_not_owned_by_user(self) -> None:
        user_id = uuid.uuid4()
        other_user = uuid.uuid4()
        app = _make_app(user_id=other_user, status="ready")

        db = AsyncMock()

        from apps.api.core.exceptions import NotFoundError
        from apps.api.domains.convex.migration_service import start_publish

        with pytest.raises(NotFoundError):
            await start_publish(db, user_id=user_id, app=app)

    @pytest.mark.asyncio
    async def test_raises_when_app_not_ready(self) -> None:
        user_id = uuid.uuid4()
        app = _make_app(user_id=user_id, status="draft")

        db = AsyncMock()

        from apps.api.core.exceptions import AppError
        from apps.api.domains.convex.migration_service import start_publish

        with pytest.raises(AppError) as exc_info:
            await start_publish(db, user_id=user_id, app=app)
        assert exc_info.value.error_code == "APP_NOT_READY"


# ── run_publish_pipeline integration tests ────────────────────────────────────


class TestRunPublishPipeline:
    def _make_full_db(
        self,
        job: MagicMock,
        app: MagicMock,
        generation: MagicMock | None = None,
    ) -> AsyncMock:
        """DB returning job, app, generation, then an open-ended result for update(App)."""
        sequence_values = [job, app, generation]
        results = []
        for val in sequence_values:
            r = MagicMock()
            r.scalar_one_or_none.return_value = val
            r.scalar_one.return_value = val
            results.append(r)

        update_result = MagicMock()
        update_result.scalar_one_or_none.return_value = None
        update_result.scalar_one.return_value = None
        results.append(update_result)

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=results)
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.delete = AsyncMock()
        return db

    @pytest.mark.asyncio
    async def test_happy_path_reaches_published(self, tmp_path: Path) -> None:
        from appio_builder.orchestrator import BuildResult
        from apps.api.domains.convex.cli import CliResult
        from apps.api.domains.convex.management import FakeConvexManagementClient

        user_id = uuid.uuid4()
        job_id = uuid.uuid4()
        app_id = uuid.uuid4()

        job = _make_job(job_id=job_id, app_id=app_id, user_id=user_id)
        app = _make_app(app_id=app_id, user_id=user_id, current_version=0)
        generation = _make_generation(app_id)

        workspace = _build_workspace(tmp_path)
        download_result = MagicMock()
        download_result.workspace = workspace

        fake_build_result = BuildResult(
            app_id=str(app_id),
            version=1,
            file_count=3,
            total_bytes=5000,
            duration_seconds=0.8,
            r2_prefix=f"{app_id}/v1",
            public_url=f"https://cdn.example.com/{app_id}/v1/index.html",
        )

        db = self._make_full_db(job, app, generation)

        with (
            patch(
                "apps.api.domains.convex.migration_service.get_management_client",
                return_value=FakeConvexManagementClient(),
            ),
            patch(
                "apps.api.domains.convex.migration_service.load_credentials_for_publish",
                AsyncMock(return_value=(_FAKE_DEPLOY_KEY, _FAKE_DEPLOYMENT_URL)),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=CliResult(stdout="ok", stderr="")),
            ),
            patch(
                "apps.api.domains.convex.migration_service._download_workspace",
                return_value=download_result,
            ),
            patch(
                "apps.api.domains.convex.migration_service._upload_published_workspace",
            ),
            patch(
                "apps.api.domains.convex.migration_service.build_published_workspace",
                AsyncMock(return_value=fake_build_result),
            ),
            patch(
                "apps.api.domains.convex.migration_service._step_copy_data",
                AsyncMock(),
            ),
        ):
            from apps.api.domains.convex.migration_service import run_publish_pipeline

            await run_publish_pipeline(db, job_id=job_id)

        assert job.status == "published"
        assert job.deployment_url == _FAKE_DEPLOYMENT_URL
        assert app.publish_status == "published"
        assert app.current_version == 1

    @pytest.mark.asyncio
    async def test_failure_in_validate_credentials_marks_job_failed(self) -> None:
        from apps.api.core.exceptions import AppError
        from apps.api.domains.convex.management import FakeConvexManagementClient

        user_id = uuid.uuid4()
        job_id = uuid.uuid4()
        app_id = uuid.uuid4()

        job = _make_job(job_id=job_id, app_id=app_id, user_id=user_id)
        app = _make_app(app_id=app_id, user_id=user_id)

        db = _make_db_with_sequence([job, app])

        with (
            patch(
                "apps.api.domains.convex.migration_service.get_management_client",
                return_value=FakeConvexManagementClient(),
            ),
            patch(
                "apps.api.domains.convex.migration_service.load_credentials_for_publish",
                AsyncMock(
                    side_effect=AppError(
                        "No creds", status_code=404, error_code="CREDENTIALS_NOT_FOUND"
                    )
                ),
            ),
        ):
            from apps.api.domains.convex.migration_service import PublishError, run_publish_pipeline

            with pytest.raises(PublishError):
                await run_publish_pipeline(db, job_id=job_id)

        assert job.status == "failed"
        assert app.publish_status == "failed"

    @pytest.mark.asyncio
    async def test_job_not_found_raises(self) -> None:
        from apps.api.domains.convex.management import FakeConvexManagementClient

        db = AsyncMock()
        r = MagicMock()
        r.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=r)

        from apps.api.core.exceptions import NotFoundError
        from apps.api.domains.convex.migration_service import run_publish_pipeline

        with patch(
            "apps.api.domains.convex.migration_service.get_management_client",
            return_value=FakeConvexManagementClient(),
        ), pytest.raises(NotFoundError):
            await run_publish_pipeline(db, job_id=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_client_param_ignored_for_compat(self, tmp_path: Path) -> None:
        """client= kwarg is accepted but unused (backwards compat)."""
        from appio_builder.orchestrator import BuildResult
        from apps.api.domains.convex.cli import CliResult
        from apps.api.domains.convex.management import FakeConvexManagementClient

        user_id = uuid.uuid4()
        job_id = uuid.uuid4()
        app_id = uuid.uuid4()

        job = _make_job(job_id=job_id, app_id=app_id, user_id=user_id)
        app = _make_app(app_id=app_id, user_id=user_id, current_version=0)
        generation = _make_generation(app_id)

        workspace = _build_workspace(tmp_path)
        download_result = MagicMock()
        download_result.workspace = workspace

        fake_build_result = BuildResult(
            app_id=str(app_id),
            version=1,
            file_count=2,
            total_bytes=2000,
            duration_seconds=0.4,
            r2_prefix=f"{app_id}/v1",
            public_url=f"https://cdn.example.com/{app_id}/v1/index.html",
        )

        db = self._make_full_db(job, app, generation)

        sentinel_client = object()  # should be silently ignored

        with (
            patch(
                "apps.api.domains.convex.migration_service.get_management_client",
                return_value=FakeConvexManagementClient(),
            ),
            patch(
                "apps.api.domains.convex.migration_service.load_credentials_for_publish",
                AsyncMock(return_value=(_FAKE_DEPLOY_KEY, _FAKE_DEPLOYMENT_URL)),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=CliResult(stdout="ok", stderr="")),
            ),
            patch(
                "apps.api.domains.convex.migration_service._download_workspace",
                return_value=download_result,
            ),
            patch(
                "apps.api.domains.convex.migration_service._upload_published_workspace",
            ),
            patch(
                "apps.api.domains.convex.migration_service.build_published_workspace",
                AsyncMock(return_value=fake_build_result),
            ),
            patch(
                "apps.api.domains.convex.migration_service._step_copy_data",
                AsyncMock(),
            ),
        ):
            from apps.api.domains.convex.migration_service import run_publish_pipeline

            # Pass sentinel_client — must not raise
            await run_publish_pipeline(db, job_id=job_id, client=sentinel_client)

        assert job.status == "published"


# ── _step_copy_data tests ─────────────────────────────────────────────────────

_FIREBASE_UID = "firebase-user-123"
_SANDBOX_DEPLOY_KEY = "prod:appio-sandbox|sandbox-secret"
_SANDBOX_URL = "https://adventurous-corgi.convex.cloud"

_SIMPLE_SCHEMA_TS = (
    "import { defineSchema, defineTable } from 'convex/server';\n"
    "import { v } from 'convex/values';\n"
    "export default defineSchema({\n"
    "  items: defineTable({ tenantId: v.string() })\n"
    "    .index('by_tenant', ['tenantId']),\n"
    "});\n"
)


def _build_workspace_with_schema(
    tmp_path: Path, schema_ts: str | None = None
) -> Path:
    """Build a workspace with both src/config/convex.ts and convex/schema.ts."""
    workspace = _build_workspace(tmp_path)
    convex_dir = workspace / "convex"
    convex_dir.mkdir(exist_ok=True)
    content = schema_ts if schema_ts is not None else _SIMPLE_SCHEMA_TS
    (convex_dir / "schema.ts").write_text(content, encoding="utf-8")
    return workspace


def _make_user_mock(firebase_uid: str = _FIREBASE_UID) -> MagicMock:
    user = MagicMock()
    user.firebase_uid = firebase_uid
    return user


def _make_cli_result_data(data: dict) -> object:
    import json as _json

    from apps.api.domains.convex.cli import CliResult

    return CliResult(stdout=_json.dumps(data), stderr="")


class TestStepCopyData:
    """Tests for the T3.9 scratch-deployment data migration step."""

    def _patch_settings(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import apps.api.config as _cfg

        monkeypatch.setattr(_cfg.settings, "appio_sandbox_deploy_key", _SANDBOX_DEPLOY_KEY)
        monkeypatch.setattr(_cfg.settings, "appio_sandbox_convex_url", _SANDBOX_URL)

    @pytest.mark.asyncio
    async def test_happy_path_provisions_copies_tears_down(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from apps.api.domains.convex.management import FakeConvexManagementClient

        self._patch_settings(monkeypatch)

        job = _make_job()
        app = _make_app()
        workspace = _build_workspace_with_schema(tmp_path)
        mgmt = FakeConvexManagementClient()
        user = _make_user_mock()
        db = _make_db_with_sequence([user])

        export_result = _make_cli_result_data({"rows": [{"tenantId": _FIREBASE_UID, "title": "hi"}], "isDone": True, "continueCursor": None})
        bulk_result = _make_cli_result_data({"inserted": 1})
        count_sandbox = _make_cli_result_data({"count": 1})
        count_scratch = _make_cli_result_data({"count": 1})

        snapshot_path = tmp_path / f"scratch-snapshot-{job.id}.zip"

        with (
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=_make_cli_result_data({})),
            ) as mock_deploy,
            patch(
                "apps.api.domains.convex.migration_service.run_convex_run",
                AsyncMock(side_effect=[export_result, bulk_result, count_sandbox, count_scratch]),
            ) as mock_run,
            patch(
                "apps.api.domains.convex.migration_service.run_convex_export",
                AsyncMock(return_value=_make_cli_result_data({})),
            ) as mock_export,
            patch(
                "apps.api.domains.convex.migration_service.run_convex_import",
                AsyncMock(return_value=_make_cli_result_data({})),
            ) as mock_import,
        ):
            from apps.api.domains.convex.migration_service import _step_copy_data

            await _step_copy_data(
                db, job, app,
                workspace=workspace,
                scratch_path=tmp_path,
                deploy_key=_FAKE_DEPLOY_KEY,
                deployment_url=_FAKE_DEPLOYMENT_URL,
                management_client=mgmt,
            )

        assert len(mgmt.live_deployments) == 0  # torn down
        assert mgmt.teardown_calls == ["scratch-1"]
        mock_deploy.assert_awaited_once()
        assert mock_run.await_count == 4  # export + bulkInsert + countTenant + countAll
        mock_export.assert_awaited_once()
        mock_import.assert_awaited_once_with(
            snapshot_path=snapshot_path,
            deploy_key=_FAKE_DEPLOY_KEY,
            deployment_url=_FAKE_DEPLOYMENT_URL,
            cwd=workspace,
            replace=True,
        )

    @pytest.mark.asyncio
    async def test_no_rows_skips_bulk_insert(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from apps.api.domains.convex.management import FakeConvexManagementClient

        self._patch_settings(monkeypatch)

        job = _make_job()
        app = _make_app()
        workspace = _build_workspace_with_schema(tmp_path)
        mgmt = FakeConvexManagementClient()
        db = _make_db_with_sequence([_make_user_mock()])

        export_empty = _make_cli_result_data({"rows": [], "isDone": True, "continueCursor": None})
        count_sandbox = _make_cli_result_data({"count": 0})
        count_scratch = _make_cli_result_data({"count": 0})

        with (
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_run",
                AsyncMock(side_effect=[export_empty, count_sandbox, count_scratch]),
            ) as mock_run,
            patch(
                "apps.api.domains.convex.migration_service.run_convex_export",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_import",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
        ):
            from apps.api.domains.convex.migration_service import _step_copy_data

            await _step_copy_data(
                db, job, app,
                workspace=workspace,
                scratch_path=tmp_path,
                deploy_key=_FAKE_DEPLOY_KEY,
                deployment_url=_FAKE_DEPLOYMENT_URL,
                management_client=mgmt,
            )

        # export + countTenant + countAll — no bulkInsert
        assert mock_run.await_count == 3
        assert mgmt.teardown_calls == ["scratch-1"]

    @pytest.mark.asyncio
    async def test_teardown_runs_even_when_export_fails(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from apps.api.domains.convex.cli import ConvexCliError
        from apps.api.domains.convex.management import FakeConvexManagementClient

        self._patch_settings(monkeypatch)

        job = _make_job()
        app = _make_app()
        workspace = _build_workspace_with_schema(tmp_path)
        mgmt = FakeConvexManagementClient()
        db = _make_db_with_sequence([_make_user_mock()])

        with (
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_run",
                AsyncMock(side_effect=ConvexCliError("npx", 1, "export failed")),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_export",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_import",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
        ):
            from apps.api.domains.convex.migration_service import PublishError, _step_copy_data

            # Now raises PublishError (FIX 2 wraps ConvexCliError from run_convex_run).
            with pytest.raises(PublishError):
                await _step_copy_data(
                    db, job, app,
                    workspace=workspace,
                    scratch_path=tmp_path,
                    deploy_key=_FAKE_DEPLOY_KEY,
                    deployment_url=_FAKE_DEPLOYMENT_URL,
                    management_client=mgmt,
                )

        assert mgmt.teardown_calls == ["scratch-1"]

    @pytest.mark.asyncio
    async def test_teardown_runs_even_when_import_fails(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from apps.api.domains.convex.cli import ConvexCliError
        from apps.api.domains.convex.management import FakeConvexManagementClient
        from apps.api.domains.convex.migration_service import PublishError

        self._patch_settings(monkeypatch)

        job = _make_job()
        app = _make_app()
        workspace = _build_workspace_with_schema(tmp_path)
        mgmt = FakeConvexManagementClient()
        db = _make_db_with_sequence([_make_user_mock()])

        export_result = _make_cli_result_data({"rows": [], "isDone": True, "continueCursor": None})
        count_sandbox = _make_cli_result_data({"count": 0})
        count_scratch = _make_cli_result_data({"count": 0})

        with (
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_run",
                AsyncMock(side_effect=[export_result, count_sandbox, count_scratch]),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_export",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_import",
                AsyncMock(side_effect=ConvexCliError("npx", 1, "import failed")),
            ),
        ):
            from apps.api.domains.convex.migration_service import _step_copy_data

            with pytest.raises(PublishError, match="copying_data"):
                await _step_copy_data(
                    db, job, app,
                    workspace=workspace,
                    scratch_path=tmp_path,
                    deploy_key=_FAKE_DEPLOY_KEY,
                    deployment_url=_FAKE_DEPLOYMENT_URL,
                    management_client=mgmt,
                )

        assert mgmt.teardown_calls == ["scratch-1"]

    @pytest.mark.asyncio
    async def test_teardown_failure_logged_not_raised(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from apps.api.domains.convex.management import FakeConvexManagementClient

        self._patch_settings(monkeypatch)

        job = _make_job()
        app = _make_app()
        workspace = _build_workspace_with_schema(tmp_path)
        mgmt = FakeConvexManagementClient(fail_on_teardown=True)
        db = _make_db_with_sequence([_make_user_mock()])

        export_empty = _make_cli_result_data({"rows": [], "isDone": True, "continueCursor": None})
        count_sandbox = _make_cli_result_data({"count": 0})
        count_scratch = _make_cli_result_data({"count": 0})

        with (
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_run",
                AsyncMock(side_effect=[export_empty, count_sandbox, count_scratch]),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_export",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_import",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
        ):
            from apps.api.domains.convex.migration_service import _step_copy_data

            # Must NOT raise even though teardown fails.
            with capture_logs() as cap_logs:
                await _step_copy_data(
                    db, job, app,
                    workspace=workspace,
                    scratch_path=tmp_path,
                    deploy_key=_FAKE_DEPLOY_KEY,
                    deployment_url=_FAKE_DEPLOYMENT_URL,
                    management_client=mgmt,
                )

        assert any(e["event"] == "scratch_teardown_failed" for e in cap_logs)

    @pytest.mark.asyncio
    async def test_row_count_mismatch_raises_publish_error(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from apps.api.domains.convex.management import FakeConvexManagementClient
        from apps.api.domains.convex.migration_service import PublishError

        self._patch_settings(monkeypatch)

        job = _make_job()
        app = _make_app()
        workspace = _build_workspace_with_schema(tmp_path)
        mgmt = FakeConvexManagementClient()
        db = _make_db_with_sequence([_make_user_mock()])

        export_result = _make_cli_result_data({"rows": [{"tenantId": _FIREBASE_UID}] * 5, "isDone": True, "continueCursor": None})
        bulk_result = _make_cli_result_data({"inserted": 5})
        count_sandbox = _make_cli_result_data({"count": 5})
        count_scratch = _make_cli_result_data({"count": 3})  # mismatch

        with (
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_run",
                AsyncMock(side_effect=[export_result, bulk_result, count_sandbox, count_scratch]),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_export",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_import",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
        ):
            from apps.api.domains.convex.migration_service import _step_copy_data

            with pytest.raises(PublishError, match="Row count mismatch"):
                await _step_copy_data(
                    db, job, app,
                    workspace=workspace,
                    scratch_path=tmp_path,
                    deploy_key=_FAKE_DEPLOY_KEY,
                    deployment_url=_FAKE_DEPLOYMENT_URL,
                    management_client=mgmt,
                )

        # Teardown still happens despite the mismatch error.
        assert mgmt.teardown_calls == ["scratch-1"]

    @pytest.mark.asyncio
    async def test_user_firebase_uid_used_as_tenant_id(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from apps.api.domains.convex.management import FakeConvexManagementClient

        self._patch_settings(monkeypatch)

        distinct_uid = "firebase-distinct-uid-xyz"
        job = _make_job()
        app = _make_app()
        workspace = _build_workspace_with_schema(tmp_path)
        mgmt = FakeConvexManagementClient()
        db = _make_db_with_sequence([_make_user_mock(firebase_uid=distinct_uid)])

        export_empty = _make_cli_result_data({"rows": [], "isDone": True, "continueCursor": None})
        count_sandbox = _make_cli_result_data({"count": 0})
        count_scratch = _make_cli_result_data({"count": 0})

        captured_args: list[str] = []

        async def _capture_run(**kwargs: object) -> object:
            captured_args.append(str(kwargs.get("args_json", "")))
            fn = str(kwargs.get("function_name", ""))
            if "exportTenantRows" in fn:
                return export_empty
            if "countTenantRows" in fn:
                return count_sandbox
            return count_scratch

        with (
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_run",
                side_effect=_capture_run,
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_export",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_import",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
        ):
            from apps.api.domains.convex.migration_service import _step_copy_data

            await _step_copy_data(
                db, job, app,
                workspace=workspace,
                scratch_path=tmp_path,
                deploy_key=_FAKE_DEPLOY_KEY,
                deployment_url=_FAKE_DEPLOYMENT_URL,
                management_client=mgmt,
            )

        assert any(distinct_uid in args for args in captured_args), (
            f"Expected firebase uid {distinct_uid!r} in run_convex_run args_json calls"
        )

    @pytest.mark.asyncio
    async def test_schema_parsing_failure_raises_publish_error(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from apps.api.domains.convex.management import FakeConvexManagementClient
        from apps.api.domains.convex.migration_service import PublishError

        self._patch_settings(monkeypatch)

        job = _make_job()
        app = _make_app()

        # Build workspace WITHOUT a valid schema.ts (malformed — no defineSchema)
        workspace = _build_workspace(tmp_path)
        convex_dir = workspace / "convex"
        convex_dir.mkdir(exist_ok=True)
        (convex_dir / "schema.ts").write_text("// invalid schema\n", encoding="utf-8")

        mgmt = FakeConvexManagementClient()
        db = _make_db_with_sequence([_make_user_mock()])

        from apps.api.domains.convex.migration_service import _step_copy_data

        with pytest.raises(PublishError) as exc_info:
            await _step_copy_data(
                db, job, app,
                workspace=workspace,
                scratch_path=tmp_path,
                deploy_key=_FAKE_DEPLOY_KEY,
                deployment_url=_FAKE_DEPLOYMENT_URL,
                management_client=mgmt,
            )

        assert exc_info.value.step == "copying_data"
        # No scratch was ever provisioned so teardown_calls should be empty.
        assert mgmt.teardown_calls == []

    @pytest.mark.asyncio
    async def test_missing_sandbox_deploy_key_raises_publish_error(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        import apps.api.config as _cfg
        from apps.api.domains.convex.management import FakeConvexManagementClient
        from apps.api.domains.convex.migration_service import PublishError

        monkeypatch.setattr(_cfg.settings, "appio_sandbox_deploy_key", "")
        monkeypatch.setattr(_cfg.settings, "appio_sandbox_convex_url", _SANDBOX_URL)

        job = _make_job()
        app = _make_app()
        workspace = _build_workspace_with_schema(tmp_path)
        mgmt = FakeConvexManagementClient()
        db = _make_db_with_sequence([_make_user_mock()])

        from apps.api.domains.convex.migration_service import _step_copy_data

        with pytest.raises(PublishError, match="sandbox deploy key not configured"):
            await _step_copy_data(
                db, job, app,
                workspace=workspace,
                scratch_path=tmp_path,
                deploy_key=_FAKE_DEPLOY_KEY,
                deployment_url=_FAKE_DEPLOYMENT_URL,
                management_client=mgmt,
            )

        # No scratch was ever provisioned.
        assert mgmt.teardown_calls == []
        assert mgmt.live_deployments == []

    @pytest.mark.asyncio
    async def test_cli_error_on_count_step_raises_publish_error_not_convex_cli_error(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """ConvexCliError from countTenantRows must be wrapped as PublishError."""
        from apps.api.domains.convex.cli import ConvexCliError
        from apps.api.domains.convex.management import FakeConvexManagementClient
        from apps.api.domains.convex.migration_service import PublishError, _step_copy_data

        self._patch_settings(monkeypatch)

        job = _make_job()
        app = _make_app()
        workspace = _build_workspace_with_schema(tmp_path)
        mgmt = FakeConvexManagementClient()
        db = _make_db_with_sequence([_make_user_mock()])

        export_empty = _make_cli_result_data({"rows": [], "isDone": True, "continueCursor": None})

        call_count = 0

        async def _run_side_effect(**kwargs: object) -> object:
            nonlocal call_count
            call_count += 1
            fn = str(kwargs.get("function_name", ""))
            if "exportTenantRows" in fn:
                return export_empty
            if "countTenantRows" in fn:
                raise ConvexCliError("npx", 1, "countTenantRows timed out")
            return export_empty

        with (
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_run",
                side_effect=_run_side_effect,
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_export",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_import",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            pytest.raises(PublishError) as exc_info,
        ):
            await _step_copy_data(
                db, job, app,
                workspace=workspace,
                scratch_path=tmp_path,
                deploy_key=_FAKE_DEPLOY_KEY,
                deployment_url=_FAKE_DEPLOYMENT_URL,
                management_client=mgmt,
            )

        assert exc_info.value.step == "copying_data"
        assert not isinstance(exc_info.value, ConvexCliError)
        # Teardown still ran.
        assert mgmt.teardown_calls == ["scratch-1"]

    @pytest.mark.asyncio
    async def test_malformed_json_from_cli_raises_publish_error(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """exportTenantRows returning non-JSON must raise PublishError with descriptive message."""
        from apps.api.domains.convex.cli import CliResult
        from apps.api.domains.convex.management import FakeConvexManagementClient
        from apps.api.domains.convex.migration_service import PublishError, _step_copy_data

        self._patch_settings(monkeypatch)

        job = _make_job()
        app = _make_app()
        workspace = _build_workspace_with_schema(tmp_path)
        mgmt = FakeConvexManagementClient()
        db = _make_db_with_sequence([_make_user_mock()])

        with (
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_run",
                AsyncMock(return_value=CliResult(stdout="not json", stderr="")),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_export",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_import",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            pytest.raises(PublishError) as exc_info,
        ):
            await _step_copy_data(
                db, job, app,
                workspace=workspace,
                scratch_path=tmp_path,
                deploy_key=_FAKE_DEPLOY_KEY,
                deployment_url=_FAKE_DEPLOYMENT_URL,
                management_client=mgmt,
            )

        assert "non-JSON" in str(exc_info.value)
        assert "items" in str(exc_info.value)  # table name from _SIMPLE_SCHEMA_TS
        # Teardown still ran.
        assert mgmt.teardown_calls == ["scratch-1"]

    @pytest.mark.asyncio
    async def test_sandbox_deploy_key_never_appears_in_job_error_message(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Deploy key must not leak into job.error_message via ConvexCliError.stderr."""
        import apps.api.config as _cfg
        from apps.api.domains.convex.cli import ConvexCliError
        from apps.api.domains.convex.management import FakeConvexManagementClient

        secret_key = "prod:secret-team|secret-value-LEAK-THIS-IF-BUG"
        monkeypatch.setattr(_cfg.settings, "appio_sandbox_deploy_key", secret_key)
        monkeypatch.setattr(_cfg.settings, "appio_sandbox_convex_url", _SANDBOX_URL)

        job_id = uuid.uuid4()
        app_id = uuid.uuid4()
        user_id = uuid.uuid4()
        job = _make_job(job_id=job_id, app_id=app_id, user_id=user_id)
        app = _make_app(app_id=app_id, user_id=user_id)
        generation = _make_generation(app_id)
        workspace = _build_workspace_with_schema(tmp_path)
        download_result = MagicMock()
        download_result.workspace = workspace

        # Simulate a CLI regression: stderr contains the deploy key verbatim.
        # The _scrub() function in cli.py should have redacted it before
        # ConvexCliError is constructed, so job.error_message must not contain it.
        def _make_scrubbed_cli_error() -> ConvexCliError:
            from apps.api.domains.convex.cli import _scrub
            raw_stderr = f"CONVEX_DEPLOY_KEY={secret_key} in env"
            scrubbed = _scrub(raw_stderr, secret_key)
            return ConvexCliError("npx", 1, scrubbed)

        user = _make_user_mock()
        db = _make_db_with_sequence([job, app, generation, user])

        with (
            patch(
                "apps.api.domains.convex.migration_service.get_management_client",
                return_value=FakeConvexManagementClient(),
            ),
            patch(
                "apps.api.domains.convex.migration_service.load_credentials_for_publish",
                AsyncMock(return_value=(_FAKE_DEPLOY_KEY, _FAKE_DEPLOYMENT_URL)),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service._download_workspace",
                return_value=download_result,
            ),
            patch(
                "apps.api.domains.convex.migration_service._upload_published_workspace",
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_run",
                AsyncMock(side_effect=_make_scrubbed_cli_error()),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_export",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_import",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
        ):
            from apps.api.domains.convex.migration_service import PublishError, run_publish_pipeline

            with pytest.raises(PublishError):
                await run_publish_pipeline(db, job_id=job_id)

        assert "secret-value-LEAK-THIS-IF-BUG" not in str(job.error_message)

    @pytest.mark.asyncio
    async def test_too_many_tables_raises_publish_error_before_provisioning(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Schema with >50 tables must raise before any scratch is provisioned."""
        from apps.api.domains.convex.management import FakeConvexManagementClient
        from apps.api.domains.convex.migration_service import PublishError, _step_copy_data

        self._patch_settings(monkeypatch)

        # Build a schema.ts with 51 defineTable(...) calls.
        table_lines = "\n".join(
            f"  table{i}: defineTable({{ tenantId: v.string() }}).index('by_tenant', ['tenantId']),"
            for i in range(51)
        )
        fat_schema = (
            "import { defineSchema, defineTable } from 'convex/server';\n"
            "import { v } from 'convex/values';\n"
            "export default defineSchema({\n"
            f"{table_lines}\n"
            "});\n"
        )

        workspace = _build_workspace_with_schema(tmp_path, schema_ts=fat_schema)
        mgmt = FakeConvexManagementClient()
        job = _make_job()
        app = _make_app()
        db = _make_db_with_sequence([_make_user_mock()])

        with pytest.raises(PublishError) as exc_info:
            await _step_copy_data(
                db, job, app,
                workspace=workspace,
                scratch_path=tmp_path,
                deploy_key=_FAKE_DEPLOY_KEY,
                deployment_url=_FAKE_DEPLOYMENT_URL,
                management_client=mgmt,
            )

        assert "bounded at 50" in str(exc_info.value)
        assert mgmt.teardown_calls == []
        assert mgmt.live_deployments == []  # provision_scratch_deployment never called

    @pytest.mark.asyncio
    async def test_tenant_id_mismatch_in_bulk_insert_fails_with_publish_error(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """bulkInsert ConvexCliError with tenantId mismatch message bubbles as PublishError; teardown runs."""
        from apps.api.domains.convex.cli import ConvexCliError
        from apps.api.domains.convex.management import FakeConvexManagementClient
        from apps.api.domains.convex.migration_service import PublishError, _step_copy_data

        self._patch_settings(monkeypatch)

        job = _make_job()
        app = _make_app()
        workspace = _build_workspace_with_schema(tmp_path)
        mgmt = FakeConvexManagementClient()
        db = _make_db_with_sequence([_make_user_mock()])

        export_result = _make_cli_result_data(
            {"rows": [{"tenantId": _FIREBASE_UID, "x": 1}], "isDone": True, "continueCursor": None}
        )

        async def _run_side_effect(**kwargs: object) -> object:
            fn = str(kwargs.get("function_name", ""))
            if "exportTenantRows" in fn:
                return export_result
            if "bulkInsert" in fn:
                raise ConvexCliError("npx", 1, "tenantId mismatch in bulkInsert: ...")
            return export_result

        with (
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_run",
                side_effect=_run_side_effect,
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_export",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_import",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            pytest.raises(PublishError) as exc_info,
        ):
            await _step_copy_data(
                db, job, app,
                workspace=workspace,
                scratch_path=tmp_path,
                deploy_key=_FAKE_DEPLOY_KEY,
                deployment_url=_FAKE_DEPLOYMENT_URL,
                management_client=mgmt,
            )

        assert exc_info.value.step == "copying_data"
        assert mgmt.teardown_calls == ["scratch-1"]

    @pytest.mark.asyncio
    async def test_cursor_pagination_multi_page_completes_all_data(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Cursor threading: second call must receive the continueCursor from first call."""
        from apps.api.domains.convex.management import FakeConvexManagementClient
        from apps.api.domains.convex.migration_service import _step_copy_data

        self._patch_settings(monkeypatch)

        job = _make_job()
        app = _make_app()
        workspace = _build_workspace_with_schema(tmp_path)
        mgmt = FakeConvexManagementClient()
        db = _make_db_with_sequence([_make_user_mock()])

        page1_rows = [{"tenantId": _FIREBASE_UID, "i": i} for i in range(500)]
        page2_rows = [{"tenantId": _FIREBASE_UID, "i": i} for i in range(500, 750)]

        page1_result = _make_cli_result_data(
            {"rows": page1_rows, "continueCursor": "abc", "isDone": False}
        )
        page2_result = _make_cli_result_data(
            {"rows": page2_rows, "continueCursor": "xyz", "isDone": True}
        )
        bulk_result = _make_cli_result_data({"inserted": 500})
        bulk_result2 = _make_cli_result_data({"inserted": 250})
        count_sandbox = _make_cli_result_data({"count": 750})
        count_scratch = _make_cli_result_data({"count": 750})

        captured_export_calls: list[dict] = []
        captured_bulk_calls: list[list] = []

        async def _run_side_effect(**kwargs: object) -> object:
            fn = str(kwargs.get("function_name", ""))
            args = kwargs.get("args_json", "{}")
            parsed = __import__("json").loads(str(args))
            if "exportTenantRows" in fn:
                captured_export_calls.append(parsed)
                return page1_result if parsed.get("cursor") is None else page2_result
            if "bulkInsert" in fn:
                captured_bulk_calls.append(parsed.get("rows", []))
                return bulk_result if len(captured_bulk_calls) == 1 else bulk_result2
            if "countTenantRows" in fn:
                return count_sandbox
            return count_scratch

        with (
            patch(
                "apps.api.domains.convex.migration_service.run_convex_deploy",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_run",
                side_effect=_run_side_effect,
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_export",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
            patch(
                "apps.api.domains.convex.migration_service.run_convex_import",
                AsyncMock(return_value=_make_cli_result_data({})),
            ),
        ):
            await _step_copy_data(
                db, job, app,
                workspace=workspace,
                scratch_path=tmp_path,
                deploy_key=_FAKE_DEPLOY_KEY,
                deployment_url=_FAKE_DEPLOYMENT_URL,
                management_client=mgmt,
            )

        # Two export calls made.
        assert len(captured_export_calls) == 2
        # First call uses null cursor.
        assert captured_export_calls[0]["cursor"] is None
        # Second call uses the continueCursor from the first response.
        assert captured_export_calls[1]["cursor"] == "abc"
        # Two bulkInsert calls with correct row batches.
        assert len(captured_bulk_calls) == 2
        assert len(captured_bulk_calls[0]) == 500
        assert len(captured_bulk_calls[1]) == 250
