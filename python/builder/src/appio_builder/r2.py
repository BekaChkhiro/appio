"""Cloudflare R2 client.

R2 is S3-compatible, so we use ``boto3`` with the R2 endpoint URL. We could
write a sigv4 signer ourselves to drop the dependency, but boto3 is
already a transitive dep of half the data ecosystem and the surface area
we use is tiny.

The client is sync. The orchestrator wraps it in
``asyncio.to_thread`` because Dramatiq actors run on threads anyway and
boto3 holds the GIL during signing — async wrappers buy us nothing.
"""

from __future__ import annotations

import io
import tarfile
from collections.abc import Iterable  # noqa: TC003
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .validation import BuildArtifact

__all__ = [
    "MockupUploadResult",
    "R2Client",
    "R2Error",
    "UploadResult",
    "WorkspaceDownloadResult",
    "WorkspaceUploadResult",
]


class R2Error(RuntimeError):
    """Raised on any R2 upload failure."""


@dataclass(frozen=True, slots=True)
class UploadResult:
    bucket: str
    prefix: str
    file_count: int
    total_bytes: int


@dataclass(frozen=True, slots=True)
class MockupUploadResult:
    bucket: str
    prefix: str
    urls: list[str]
    file_count: int
    total_bytes: int


@dataclass(frozen=True, slots=True)
class WorkspaceUploadResult:
    bucket: str
    key: str
    size_bytes: int


@dataclass(frozen=True, slots=True)
class WorkspaceDownloadResult:
    bucket: str
    key: str
    workspace: Path
    size_bytes: int


class R2Client:
    """Wrapper around the boto3 S3 client configured for Cloudflare R2."""

    def __init__(
        self,
        *,
        account_id: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        endpoint_url: str = "",
    ):
        if not (access_key and secret_key and bucket and account_id):
            raise R2Error(
                "R2 requires CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY, "
                "CLOUDFLARE_R2_SECRET_KEY, and CLOUDFLARE_R2_BUCKET"
            )

        try:
            import boto3
            from botocore.config import Config as BotoConfig
        except ImportError as exc:  # pragma: no cover - import-time guard
            raise R2Error(
                "boto3 is not installed; add it to python/builder dependencies"
            ) from exc

        self._bucket = bucket
        endpoint = endpoint_url or f"https://{account_id}.r2.cloudflarestorage.com"
        # R2 ignores the region but boto3 requires one — "auto" is the
        # documented placeholder per Cloudflare's official boto3 example.
        # We DO NOT set ``addressing_style`` — Cloudflare's docs use only
        # the four params below and the default (path-style with this
        # endpoint URL) is what R2 expects. Forcing virtual hosting would
        # build URLs like ``{bucket}.{account}.r2.cloudflarestorage.com``
        # which only work with bucket-level custom domains.
        # Source: https://developers.cloudflare.com/r2/examples/aws/boto3/
        self._s3 = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
            config=BotoConfig(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )

    @property
    def bucket(self) -> str:
        return self._bucket

    # ------------------------------------------------------------------ upload

    def upload_artifacts(
        self,
        artifacts: Iterable[BuildArtifact],
        *,
        app_id: str,
        version: int,
    ) -> UploadResult:
        """Upload all artifacts under ``{app_id}/v{version}/{rel_path}``.

        Cache headers are set per artifact:

        - ``index.html`` and ``sw.js`` → ``no-cache, must-revalidate``
          (must be revalidated so a new build is picked up immediately)
        - everything else (hashed by esbuild) → ``immutable, max-age=31536000``
        """
        if version < 1:
            raise R2Error(f"version must be >= 1, got {version}")
        if not app_id:
            raise R2Error("app_id is required")

        prefix = f"{app_id}/v{version}/"
        count = 0
        total = 0

        for artifact in artifacts:
            key = f"{prefix}{artifact.rel_path}"
            extra: dict[str, Any] = {
                "ContentType": artifact.content_type,
                "CacheControl": _cache_control_for(artifact.rel_path),
            }
            try:
                with artifact.abs_path.open("rb") as fh:
                    self._s3.put_object(
                        Bucket=self._bucket,
                        Key=key,
                        Body=fh.read(),
                        **extra,
                    )
            except Exception as exc:  # noqa: BLE001 — boto's exception hierarchy is wide
                raise R2Error(
                    f"failed to upload {key} to bucket {self._bucket}: {exc}"
                ) from exc

            count += 1
            total += artifact.size

        return UploadResult(
            bucket=self._bucket,
            prefix=prefix,
            file_count=count,
            total_bytes=total,
        )

    # --------------------------------------------------------- preview upload

    def upload_preview_dist(
        self,
        dist_dir: Path,
        *,
        generation_id: str,
        turn: int,
    ) -> UploadResult:
        """Upload ``dist/`` to ``_preview/{generation_id}/{turn}/``.

        Every file gets ``no-cache, must-revalidate`` so the iframe in the
        Lovable-style split-panel always shows the latest build iteration.
        """
        import mimetypes

        if not generation_id:
            raise R2Error("generation_id is required")
        if turn < 1:
            raise R2Error(f"turn must be >= 1, got {turn}")
        if not dist_dir.is_dir():
            raise R2Error(f"dist_dir does not exist: {dist_dir}")

        prefix = f"_preview/{generation_id}/{turn}"
        count = 0
        total = 0

        for file_path in dist_dir.rglob("*"):
            if not file_path.is_file():
                continue
            rel = file_path.relative_to(dist_dir)
            key = f"{prefix}/{rel}"
            content_type = (
                mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
            )
            size = file_path.stat().st_size
            try:
                with file_path.open("rb") as fh:
                    self._s3.put_object(
                        Bucket=self._bucket,
                        Key=key,
                        Body=fh.read(),
                        ContentType=content_type,
                        CacheControl="no-cache, must-revalidate",
                    )
            except Exception as exc:  # noqa: BLE001
                raise R2Error(
                    f"failed to upload preview {key} to bucket {self._bucket}: {exc}"
                ) from exc

            count += 1
            total += size

        return UploadResult(
            bucket=self._bucket,
            prefix=prefix,
            file_count=count,
            total_bytes=total,
        )

    # --------------------------------------------------------- workspace upload

    def upload_workspace(
        self,
        workspace: Path,
        *,
        generation_id: str,
    ) -> WorkspaceUploadResult:
        """Archive the agent workspace as tar.gz and upload to R2.

        The archive is stored at ``workspaces/{generation_id}.tar.gz``.
        ``node_modules/`` is excluded to keep the archive small (source +
        dist is typically 1-10 MB compressed vs 500 MB+ with node_modules).
        """
        return self._upload_workspace_archive(
            workspace,
            key=f"workspaces/{generation_id}.tar.gz",
        )

    def upload_published_workspace(
        self,
        workspace: Path,
        *,
        app_id: str,
        version: int,
    ) -> WorkspaceUploadResult:
        """Archive a published-variant workspace and upload to R2 (T3.7).

        Stored at ``workspaces/published/{app_id}/v{version}.tar.gz`` so that
        the sandbox-era `workspaces/{generation_id}.tar.gz` archive is preserved
        untouched — the published snapshot lives alongside it, giving us a
        full audit trail of the migration + rebuild.
        """
        if version < 1:
            raise R2Error(f"version must be >= 1, got {version}")
        if not app_id:
            raise R2Error("app_id is required")
        return self._upload_workspace_archive(
            workspace,
            key=f"workspaces/published/{app_id}/v{version}.tar.gz",
        )

    def _upload_workspace_archive(
        self, workspace: Path, *, key: str,
    ) -> WorkspaceUploadResult:
        buf = _tar_workspace(workspace)
        size = buf.tell()
        buf.seek(0)

        try:
            self._s3.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=buf.read(),
                ContentType="application/gzip",
                CacheControl="private, max-age=0",
            )
        except Exception as exc:  # noqa: BLE001
            raise R2Error(
                f"failed to upload workspace {key} to bucket {self._bucket}: {exc}"
            ) from exc

        return WorkspaceUploadResult(
            bucket=self._bucket,
            key=key,
            size_bytes=size,
        )

    # ------------------------------------------------------------ download

    def download_workspace(
        self,
        generation_id: str,
        *,
        dest_dir: Path,
    ) -> WorkspaceDownloadResult:
        """Fetch + extract the workspace tarball previously uploaded for a generation (T3.7).

        The caller owns ``dest_dir`` (typically a ``tempfile.TemporaryDirectory``)
        and is responsible for cleanup. The workspace is extracted to
        ``dest_dir / "workspace"`` (matching the ``arcname`` used in
        :func:`_tar_workspace`).

        Safety: extraction uses ``filter='data'`` (Python 3.12+) so symlinks,
        device files, and path-traversal entries are rejected. An untrusted
        archive cannot escape ``dest_dir``.
        """
        if not generation_id:
            raise R2Error("generation_id is required")
        if not dest_dir.is_dir():
            raise R2Error(f"dest_dir does not exist: {dest_dir}")

        # Guard: refuse to extract untrusted tarballs on any interpreter
        # where the ``data`` filter isn't available (Python < 3.12). Without
        # it, ``extractall`` silently falls back to the legacy permissive
        # behaviour which accepts symlinks and path-traversal entries.
        if not hasattr(tarfile, "data_filter"):
            raise R2Error(
                "Python 3.12+ is required for safe workspace extraction "
                "(tarfile.data_filter is unavailable on this interpreter)"
            )

        key = f"workspaces/{generation_id}.tar.gz"
        try:
            response = self._s3.get_object(Bucket=self._bucket, Key=key)
            body = response["Body"].read()
        except Exception as exc:  # noqa: BLE001 — boto's error hierarchy is wide
            raise R2Error(
                f"failed to download workspace {key} from bucket {self._bucket}: {exc}"
            ) from exc

        size = len(body)
        try:
            with tarfile.open(fileobj=io.BytesIO(body), mode="r:gz") as tar:
                # filter='data' rejects symlinks, device files, and path-traversal.
                tar.extractall(path=dest_dir, filter="data")  # noqa: S202
        except (tarfile.TarError, OSError) as exc:
            raise R2Error(
                f"failed to extract workspace {key}: {exc}"
            ) from exc

        workspace = dest_dir / "workspace"
        if not workspace.is_dir():
            raise R2Error(
                f"workspace archive {key} did not contain a 'workspace' directory"
            )

        return WorkspaceDownloadResult(
            bucket=self._bucket,
            key=key,
            workspace=workspace,
            size_bytes=size,
        )


    # --------------------------------------------------------- mockup upload

    def upload_mockups(
        self,
        mockups: list[tuple[str, bytes]],
        *,
        app_id: str,
        public_base_url: str = "",
    ) -> MockupUploadResult:
        """Upload mockup PNGs to ``_mockups/{app_id}/``.

        Each item in *mockups* is a ``(label, png_bytes)`` tuple. The label
        is slugified to form the filename (e.g. ``mockup-light-data.png``).

        Returns URLs that can be stored in ``app_templates.preview_screenshots``
        or served directly from R2 via the Cloudflare Worker.

        Args:
            mockups: list of (label, png_bytes) tuples.
            app_id: app slug or template slug used as the directory key.
            public_base_url: base URL for constructing public URLs.
                             Defaults to ``https://cdn.appio.app``.
        """
        if not app_id:
            raise R2Error("app_id is required for mockup upload")
        if not mockups:
            raise R2Error("no mockups to upload")

        base = public_base_url or "https://cdn.appio.app"
        prefix = f"_mockups/{app_id}"
        urls: list[str] = []
        count = 0
        total = 0

        for label, png_bytes in mockups:
            filename = f"{label}.png"
            key = f"{prefix}/{filename}"
            size = len(png_bytes)

            try:
                self._s3.put_object(
                    Bucket=self._bucket,
                    Key=key,
                    Body=png_bytes,
                    ContentType="image/png",
                    CacheControl="public, max-age=86400, s-maxage=604800",
                )
            except Exception as exc:  # noqa: BLE001
                raise R2Error(
                    f"failed to upload mockup {key} to bucket {self._bucket}: {exc}"
                ) from exc

            urls.append(f"{base}/{key}")
            count += 1
            total += size

        return MockupUploadResult(
            bucket=self._bucket,
            prefix=prefix,
            urls=urls,
            file_count=count,
            total_bytes=total,
        )


def _tar_workspace(workspace: Path) -> io.BytesIO:
    """Create an in-memory tar.gz of *workspace*, excluding node_modules."""
    buf = io.BytesIO()
    # Directories to exclude — node_modules is huge and can be reinstalled.
    _EXCLUDE_DIRS = {"node_modules", ".cache", ".parcel-cache"}

    def _filter(info: tarfile.TarInfo) -> tarfile.TarInfo | None:
        parts = Path(info.name).parts
        if any(p in _EXCLUDE_DIRS for p in parts):
            return None
        return info

    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(str(workspace), arcname="workspace", filter=_filter)

    return buf


def _cache_control_for(rel_path: str) -> str:
    name = rel_path.rsplit("/", 1)[-1]
    if name in {"index.html", "sw.js", "manifest.json", "gate.js"}:
        return "no-cache, must-revalidate"
    return "public, max-age=31536000, immutable"
