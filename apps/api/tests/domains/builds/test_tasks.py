"""Unit tests for apps/api/domains/builds/tasks.py (T3.7).

Covers the pure helper _rewrite_dist_convex_url and the async public
entrypoint build_published_workspace.  No real R2, KV, or esbuild involved.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ── helpers ───────────────────────────────────────────────────────────────────


def _make_dist(tmp_path: Path, files: dict[str, str]) -> Path:
    """Write a dist/ directory with the given filename→content mapping."""
    dist = tmp_path / "dist"
    dist.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        p = dist / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    return dist


def _make_workspace(tmp_path: Path, dist_files: dict[str, str]) -> Path:
    """Create a workspace directory with dist/ subdirectory."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    dist = workspace / "dist"
    dist.mkdir()
    for name, content in dist_files.items():
        p = dist / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    return workspace


SANDBOX_URL = "https://sandbox-app.convex.cloud"
PROD_URL = "https://prod-app.convex.cloud"


# ── _rewrite_dist_convex_url unit tests ───────────────────────────────────────


class TestRewriteDistConvexUrl:
    def _fn(self, dist_dir, old_url=SANDBOX_URL, new_url=PROD_URL):
        from apps.api.domains.builds.tasks import _rewrite_dist_convex_url
        return _rewrite_dist_convex_url(dist_dir, old_url=old_url, new_url=new_url)

    def test_replaces_url_across_multiple_js_files(self, tmp_path: Path) -> None:
        dist = _make_dist(tmp_path, {
            "index.js": f'const a="{SANDBOX_URL}";',
            "vendor.js": f'var b="{SANDBOX_URL}";',
        })
        result = self._fn(dist)
        assert result.files_changed == 2
        assert result.replacements == 2
        assert PROD_URL in (dist / "index.js").read_text()
        assert PROD_URL in (dist / "vendor.js").read_text()
        assert SANDBOX_URL not in (dist / "index.js").read_text()

    def test_skips_files_where_old_url_not_present(self, tmp_path: Path) -> None:
        dist = _make_dist(tmp_path, {
            "index.js": f'const a="{SANDBOX_URL}";',
            "other.js": 'const x="https://unrelated.example.com";',
        })
        result = self._fn(dist)
        assert result.files_changed == 1
        assert result.replacements == 1
        # other.js must be unchanged
        assert "unrelated.example.com" in (dist / "other.js").read_text()

    def test_no_op_when_urls_are_identical(self, tmp_path: Path) -> None:
        dist = _make_dist(tmp_path, {
            "index.js": f'const a="{SANDBOX_URL}";',
        })
        result = self._fn(dist, old_url=SANDBOX_URL, new_url=SANDBOX_URL)
        assert result.files_changed == 0
        assert result.replacements == 0
        # File is untouched
        assert SANDBOX_URL in (dist / "index.js").read_text()

    def test_counts_multiple_occurrences_in_one_file(self, tmp_path: Path) -> None:
        dist = _make_dist(tmp_path, {
            "bundle.js": f'"{SANDBOX_URL}","{SANDBOX_URL}","{SANDBOX_URL}"',
        })
        result = self._fn(dist)
        assert result.files_changed == 1
        assert result.replacements == 3

    def test_only_matches_js_files_not_html_or_css(self, tmp_path: Path) -> None:
        dist = _make_dist(tmp_path, {
            "index.js": f'const a="{SANDBOX_URL}";',
            "index.html": f'<meta content="{SANDBOX_URL}">',
            "style.css": f'.x{{background:url("{SANDBOX_URL}")}}',
        })
        result = self._fn(dist)
        assert result.files_changed == 1  # only index.js
        # html and css untouched
        assert SANDBOX_URL in (dist / "index.html").read_text()
        assert SANDBOX_URL in (dist / "style.css").read_text()

    def test_handles_nested_js_in_subdirectory(self, tmp_path: Path) -> None:
        dist = _make_dist(tmp_path, {
            "chunks/chunk-abc.js": f'const c="{SANDBOX_URL}";',
        })
        result = self._fn(dist)
        assert result.files_changed == 1
        assert PROD_URL in (dist / "chunks" / "chunk-abc.js").read_text()

    def test_returns_zero_when_dist_empty(self, tmp_path: Path) -> None:
        dist = _make_dist(tmp_path, {})
        result = self._fn(dist)
        assert result.files_changed == 0
        assert result.replacements == 0


# ── build_published_workspace integration tests ───────────────────────────────


class TestBuildPublishedWorkspace:
    """Mock the Orchestrator at class level; use real filesystem via tmp_path."""

    def _fake_build_result(self, app_id: str, version: int):
        from appio_builder.orchestrator import BuildResult
        return BuildResult(
            app_id=app_id,
            version=version,
            file_count=4,
            total_bytes=8000,
            duration_seconds=0.9,
            r2_prefix=f"{app_id}/v{version}",
            public_url=f"https://cdn.example.com/{app_id}/v{version}/index.html",
        )

    @pytest.mark.asyncio
    async def test_happy_path_rewrites_dist_then_calls_orchestrator(
        self, tmp_path: Path
    ) -> None:
        app_id = str(uuid.uuid4())
        version = 3
        workspace = _make_workspace(tmp_path, {
            "index.js": f'const url="{SANDBOX_URL}";',
        })

        fake_result = self._fake_build_result(app_id, version)

        with (
            patch("apps.api.domains.builds.tasks.load_config", return_value=MagicMock()),
            patch(
                "apps.api.domains.builds.tasks.Orchestrator",
            ) as mock_orchestrator_cls,
        ):
            mock_orch = mock_orchestrator_cls.return_value
            mock_orch.build_from_workspace = AsyncMock(return_value=fake_result)

            from apps.api.domains.builds.tasks import build_published_workspace

            result = await build_published_workspace(
                app_id=app_id,
                version=version,
                workspace=workspace,
                sandbox_convex_url=SANDBOX_URL,
                published_convex_url=PROD_URL,
            )

        assert result is fake_result
        mock_orch.build_from_workspace.assert_awaited_once()
        # dist/index.js was rewritten before Orchestrator was called
        assert PROD_URL in (workspace / "dist" / "index.js").read_text()
        assert SANDBOX_URL not in (workspace / "dist" / "index.js").read_text()

    @pytest.mark.asyncio
    async def test_raises_build_error_when_no_dist_directory(
        self, tmp_path: Path
    ) -> None:
        from appio_builder.orchestrator import BuildError

        app_id = str(uuid.uuid4())
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        # no dist/ subdirectory

        with patch("apps.api.domains.builds.tasks.load_config", return_value=MagicMock()):
            from apps.api.domains.builds.tasks import build_published_workspace

            with pytest.raises(BuildError) as exc_info:
                await build_published_workspace(
                    app_id=app_id,
                    version=1,
                    workspace=workspace,
                    sandbox_convex_url=SANDBOX_URL,
                    published_convex_url=PROD_URL,
                )

        assert exc_info.value.stage == "precheck"
        assert "dist" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_raises_build_error_when_sandbox_url_empty(
        self, tmp_path: Path
    ) -> None:
        from appio_builder.orchestrator import BuildError

        app_id = str(uuid.uuid4())
        workspace = _make_workspace(tmp_path, {"index.js": "x"})

        with patch("apps.api.domains.builds.tasks.load_config", return_value=MagicMock()):
            from apps.api.domains.builds.tasks import build_published_workspace

            with pytest.raises(BuildError) as exc_info:
                await build_published_workspace(
                    app_id=app_id,
                    version=1,
                    workspace=workspace,
                    sandbox_convex_url="",
                    published_convex_url=PROD_URL,
                )

        assert exc_info.value.stage == "precheck"

    @pytest.mark.asyncio
    async def test_raises_build_error_when_published_url_empty(
        self, tmp_path: Path
    ) -> None:
        from appio_builder.orchestrator import BuildError

        app_id = str(uuid.uuid4())
        workspace = _make_workspace(tmp_path, {"index.js": "x"})

        with patch("apps.api.domains.builds.tasks.load_config", return_value=MagicMock()):
            from apps.api.domains.builds.tasks import build_published_workspace

            with pytest.raises(BuildError) as exc_info:
                await build_published_workspace(
                    app_id=app_id,
                    version=1,
                    workspace=workspace,
                    sandbox_convex_url=SANDBOX_URL,
                    published_convex_url="",
                )

        assert exc_info.value.stage == "precheck"

    @pytest.mark.asyncio
    async def test_idempotent_same_urls_no_rewrite_build_still_runs(
        self, tmp_path: Path
    ) -> None:
        """When old == new, _rewrite_dist_convex_url is a no-op but build still runs."""
        app_id = str(uuid.uuid4())
        version = 2
        workspace = _make_workspace(tmp_path, {
            "index.js": f'const url="{PROD_URL}";',
        })

        fake_result = self._fake_build_result(app_id, version)

        with (
            patch("apps.api.domains.builds.tasks.load_config", return_value=MagicMock()),
            patch(
                "apps.api.domains.builds.tasks.Orchestrator",
            ) as mock_orchestrator_cls,
        ):
            mock_orch = mock_orchestrator_cls.return_value
            mock_orch.build_from_workspace = AsyncMock(return_value=fake_result)

            from apps.api.domains.builds.tasks import build_published_workspace

            result = await build_published_workspace(
                app_id=app_id,
                version=version,
                workspace=workspace,
                sandbox_convex_url=PROD_URL,  # same as published
                published_convex_url=PROD_URL,
            )

        assert result is fake_result
        mock_orch.build_from_workspace.assert_awaited_once()
        # File must be unchanged
        assert PROD_URL in (workspace / "dist" / "index.js").read_text()

    @pytest.mark.asyncio
    async def test_no_matches_in_dist_raises_build_error(
        self, tmp_path: Path,
    ) -> None:
        """When the sandbox URL isn't in dist/ and URLs differ, the build MUST fail.

        Proceeding would silently ship a bundle that keeps talking to the old
        Convex deployment — a correctness bug disguised as a successful publish.
        """
        from appio_builder.orchestrator import BuildError

        app_id = str(uuid.uuid4())
        version = 1
        workspace = _make_workspace(tmp_path, {
            "index.js": 'const url="https://completely-different.convex.cloud";',
        })

        with (
            patch("apps.api.domains.builds.tasks.load_config", return_value=MagicMock()),
            patch(
                "apps.api.domains.builds.tasks.Orchestrator",
            ) as mock_orchestrator_cls,
        ):
            mock_orch = mock_orchestrator_cls.return_value
            mock_orch.build_from_workspace = AsyncMock()

            from apps.api.domains.builds.tasks import build_published_workspace

            with pytest.raises(BuildError, match="no occurrences of sandbox Convex URL"):
                await build_published_workspace(
                    app_id=app_id,
                    version=version,
                    workspace=workspace,
                    sandbox_convex_url=SANDBOX_URL,
                    published_convex_url=PROD_URL,
                )

        # Orchestrator must NOT be called when the rewrite preflight fails.
        mock_orch.build_from_workspace.assert_not_called()
