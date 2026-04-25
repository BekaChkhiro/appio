"""End-to-end build orchestration.

The :class:`Orchestrator` is the single entry point for deploying agent-built
workspaces. The pipeline (T2.2b — agent-only architecture):

    1. Output validation      (validation.validate_output)
    2. R2 upload              (r2.R2Client.upload_artifacts)
    3. KV pointer update      (kv.KVClient.put_version_pointer)

The agent tool-use loop (AgentService) builds the project directly and
produces a ``dist/`` directory. The orchestrator picks up from there.

The old spec-based codegen path (CodeGenerator → esbuild → AutoFix) has been
removed. The ``python/codegen/`` package is deprecated.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from pathlib import Path

from .config import BuildConfig  # noqa: TC001
from .kv import KVClient, KVError
from .r2 import R2Client, R2Error, WorkspaceUploadResult
from .validation import OutputValidationError, ValidatedOutput, validate_output

__all__ = ["BuildError", "BuildResult", "Orchestrator"]

log = logging.getLogger(__name__)


class BuildError(RuntimeError):
    """Top-level wrapper for any failure inside :meth:`Orchestrator.build`.

    Carries:

    - ``stage`` — the pipeline stage that failed (used by AutoFix to decide
      whether to re-prompt Claude)
    - ``recoverable`` — True if AutoFix can plausibly fix this by editing
      the spec; False for infra failures (Fly down, R2 outage, etc.)
    - ``cause`` — the original exception
    """

    def __init__(
        self,
        message: str,
        *,
        stage: str,
        recoverable: bool,
        cause: BaseException | None = None,
    ):
        super().__init__(message)
        self.stage = stage
        self.recoverable = recoverable
        self.cause = cause


@dataclass(frozen=True, slots=True)
class BuildResult:
    app_id: str
    version: int
    file_count: int
    total_bytes: int
    duration_seconds: float
    r2_prefix: str
    public_url: str
    workspace_url: str | None = None
    workspace_size_bytes: int = 0


class Orchestrator:
    """High-level "validate & deploy" coordinator for agent-built workspaces.

    The agent loop (AgentService) builds the project directly and produces a
    ``dist/`` directory. The orchestrator validates the output, uploads to R2,
    and updates the KV pointer.
    """

    def __init__(self, config: BuildConfig):
        self._config = config

    # ------------------------------------------------------------------ public

    async def build_from_workspace(
        self,
        workspace: Path,
        *,
        app_id: str,
        version: int,
        public_host: str = "appiousercontent.com",
        generation_id: str | None = None,
    ) -> BuildResult:
        """Build & deploy a project that ALREADY EXISTS on disk.

        This is the entry point for the agent-mode generator: instead of
        running ``CodeGenerator.generate(spec, ...)`` to materialise a
        React project from a JSON spec, the caller (the agent loop) has
        already populated ``workspace`` with files. We pick up at the
        scan/build stage and reuse the existing validate → R2 → KV path
        unchanged so the deployed PWA looks identical to a normal one.
        """
        if version < 1:
            raise BuildError(
                f"version must be >= 1, got {version}",
                stage="precheck",
                recoverable=False,
            )
        if not workspace.is_dir():
            raise BuildError(
                f"workspace not found: {workspace}",
                stage="precheck",
                recoverable=False,
            )

        start = time.monotonic()

        # The agent must have already run a successful build via the
        # run_build tool, so dist/ should exist. Re-running esbuild here
        # would re-introduce the agent's own build path issues; we just
        # trust the agent's last successful build instead.
        dist_dir = workspace / "dist"
        if not dist_dir.is_dir():
            raise BuildError(
                "agent did not produce a dist/ directory — did you run run_build?",
                stage="build",
                recoverable=False,
            )

        # 5. Output validation
        try:
            validated = await asyncio.to_thread(validate_output, dist_dir)
        except OutputValidationError as exc:
            raise BuildError(
                str(exc), stage="validate", recoverable=False, cause=exc
            ) from exc

        # 6. R2 upload
        try:
            upload = await asyncio.to_thread(
                self._upload_to_r2, validated, app_id, version
            )
        except R2Error as exc:
            raise BuildError(
                str(exc), stage="upload", recoverable=False, cause=exc
            ) from exc

        # 6b. Workspace archive (T2.18) — best-effort, non-blocking
        ws_result: WorkspaceUploadResult | None = None
        if generation_id:
            try:
                ws_result = await asyncio.to_thread(
                    self._upload_workspace, workspace, generation_id
                )
            except R2Error:
                log.warning(
                    "workspace_archive_upload_failed",
                    extra={"generation_id": generation_id},
                    exc_info=True,
                )
                # Non-fatal — the build can still proceed.

        # 7. KV pointer
        try:
            await self._update_kv_pointer(app_id, version)
        except KVError as exc:
            raise BuildError(
                str(exc), stage="publish", recoverable=False, cause=exc
            ) from exc

        duration = time.monotonic() - start
        log.info(
            "agent build complete",
            extra={
                "app_id": app_id,
                "version": version,
                "files": validated.file_count,
                "bytes": validated.total_bytes,
                "duration_s": round(duration, 3),
                "workspace_archived": ws_result is not None,
            },
        )

        workspace_url: str | None = None
        workspace_size = 0
        if ws_result:
            workspace_url = f"workspaces/{generation_id}.tar.gz"
            workspace_size = ws_result.size_bytes

        return BuildResult(
            app_id=app_id,
            version=version,
            file_count=validated.file_count,
            total_bytes=validated.total_bytes,
            duration_seconds=duration,
            r2_prefix=upload.prefix,
            public_url=f"https://{app_id}.{public_host}",
            workspace_url=workspace_url,
            workspace_size_bytes=workspace_size,
        )

    # ------------------------------------------------------------------ steps

    def _upload_to_r2(
        self,
        validated: ValidatedOutput,
        app_id: str,
        version: int,
    ) -> object:
        cfg = self._config
        client = R2Client(
            account_id=cfg.r2_account_id,
            access_key=cfg.r2_access_key,
            secret_key=cfg.r2_secret_key,
            bucket=cfg.r2_bucket,
            endpoint_url=cfg.r2_endpoint,
        )
        return client.upload_artifacts(
            validated.artifacts, app_id=app_id, version=version
        )

    def _upload_workspace(
        self,
        workspace: Path,
        generation_id: str,
    ) -> WorkspaceUploadResult:
        cfg = self._config
        client = R2Client(
            account_id=cfg.r2_account_id,
            access_key=cfg.r2_access_key,
            secret_key=cfg.r2_secret_key,
            bucket=cfg.r2_bucket,
            endpoint_url=cfg.r2_endpoint,
        )
        return client.upload_workspace(workspace, generation_id=generation_id)

    async def _update_kv_pointer(self, app_id: str, version: int) -> None:
        cfg = self._config
        async with KVClient(
            api_token=cfg.cloudflare_api_token,
            account_id=cfg.cloudflare_account_id,
            namespace_id=cfg.kv_namespace_id,
        ) as kv:
            await kv.put_version_pointer(app_id, version)
