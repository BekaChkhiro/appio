"""Build tasks — public entrypoints for build orchestration (T3.7).

The agent generation pipeline (AgentService) drives its own build via
``Orchestrator.build_from_workspace`` directly inside the SSE stream. The
Convex publish pipeline (migration_service.py) needs a second, smaller
entrypoint: take a persisted workspace + rewritten source + new version
number, re-emit ``dist/`` with the published Convex URL, and push it to R2.

This module owns that public entrypoint. It's kept deliberately thin:

- **No** new Dramatiq actor — the publish pipeline already runs inside one
  (:mod:`apps.api.domains.convex.tasks`), so spinning up a sub-job here
  would turn a single-step call into a job-within-a-job with nowhere to
  poll. The single acceptance criterion in T3.7 is "build errors are
  propagated back to the publish job with a structured failure reason",
  which a direct call satisfies cleanly.
- **No** esbuild re-run — the workspace tarball includes the last
  successful ``dist/`` alongside ``src/``. For published apps the Convex
  URL is the only thing that changes, and it's a plain HTTPS string literal
  that esbuild emits verbatim (URL strings can't safely be compressed by
  minifiers). We rewrite it in-place in the already-built ``dist/*.js``
  files and let :class:`Orchestrator` run its normal validate → R2 upload
  → KV pointer update.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

import structlog

from appio_builder.config import load_config
from appio_builder.orchestrator import BuildError, BuildResult, Orchestrator

if TYPE_CHECKING:
    from pathlib import Path

__all__ = ["build_published_workspace"]

logger = structlog.stdlib.get_logger()


async def build_published_workspace(
    *,
    app_id: str,
    version: int,
    workspace: Path,
    sandbox_convex_url: str,
    published_convex_url: str,
    generation_id: str | None = None,
) -> BuildResult:
    """Rebuild + redeploy a workspace whose ``src/config/convex.ts`` was rewritten.

    Assumes the caller has already updated the TypeScript source on disk.
    Here we (1) patch the compiled ``dist/*.js`` output so the baked-in
    Convex URL matches, then (2) hand off to :class:`Orchestrator` for the
    standard validate → R2 → KV path.

    Raises :class:`BuildError` on any failure so callers can wrap it into
    their own domain error (publish pipeline wraps into
    :class:`PublishError`).
    """
    if not sandbox_convex_url or not published_convex_url:
        raise BuildError(
            "sandbox_convex_url and published_convex_url are both required",
            stage="precheck",
            recoverable=False,
        )

    dist_dir = workspace / "dist"
    if not dist_dir.is_dir():
        raise BuildError(
            f"workspace has no dist/ directory at {dist_dir} — cannot rebuild",
            stage="precheck",
            recoverable=False,
        )

    # Step 1: rewrite the compiled URL. This is safe because the URL is a
    # plain HTTPS string literal that esbuild emits verbatim — minifiers
    # don't compress URL-shaped strings (they're opaque to tree-shaking).
    rewrites = _rewrite_dist_convex_url(
        dist_dir,
        old_url=sandbox_convex_url,
        new_url=published_convex_url,
    )
    logger.info(
        "publish_dist_rewrite",
        app_id=app_id,
        version=version,
        files_changed=rewrites.files_changed,
        replacements=rewrites.replacements,
    )

    if rewrites.replacements == 0 and sandbox_convex_url != published_convex_url:
        # The old URL wasn't in dist/*.js anywhere, which means the compiled
        # bundle points at a URL we didn't know about. Shipping it would
        # silently keep the wrong Convex deployment live. The idempotent
        # case (URLs equal) is handled earlier and returns zero replacements
        # correctly — we only fail here when the rewrite was *supposed* to
        # do something and didn't.
        raise BuildError(
            f"no occurrences of sandbox Convex URL '{sandbox_convex_url}' "
            "found in dist/*.js — refusing to publish a bundle that would "
            "keep serving the old URL. Has the workspace been rebuilt since "
            "the URL was last changed?",
            stage="rewrite",
            recoverable=False,
        )

    # Step 2: hand off to the normal build pipeline. It validates dist/,
    # uploads to R2 under {app_id}/v{version}/, then flips the KV pointer.
    orchestrator = Orchestrator(load_config())
    return await orchestrator.build_from_workspace(
        workspace,
        app_id=app_id,
        version=version,
        generation_id=generation_id,
    )


# ── internals ────────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class _DistRewriteResult:
    files_changed: int
    replacements: int


def _rewrite_dist_convex_url(
    dist_dir: Path,
    *,
    old_url: str,
    new_url: str,
) -> _DistRewriteResult:
    """Replace ``old_url`` with ``new_url`` in every ``dist/**/*.js`` file.

    The match is a literal string substitution — no regex — so we never
    accidentally rewrite a URL that happens to share a prefix with the
    sandbox URL. If the two URLs are identical, this is a no-op.
    """
    if old_url == new_url:
        return _DistRewriteResult(files_changed=0, replacements=0)

    files_changed = 0
    total_replacements = 0
    for js_file in dist_dir.rglob("*.js"):
        if not js_file.is_file():
            continue
        original = js_file.read_text(encoding="utf-8")
        if old_url not in original:
            continue
        count = original.count(old_url)
        rewritten = original.replace(old_url, new_url)
        js_file.write_text(rewritten, encoding="utf-8")
        files_changed += 1
        total_replacements += count

    return _DistRewriteResult(
        files_changed=files_changed, replacements=total_replacements,
    )
