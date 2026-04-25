"""Local esbuild runner.

Used in two scenarios:

1. **Tests / CI** — runs the full pipeline against a generated project on
   the host with no Fly.io credentials.
2. **Inside the builder Docker image** — the entrypoint at
   ``/build/base/esbuild.config.mjs`` runs in the same way; calling it from
   Python via subprocess keeps the orchestration code path identical
   between dev and prod.

The function is intentionally synchronous: Dramatiq actors run in
threadpools, esbuild itself is CPU-bound, and there's no IO concurrency
benefit to wrapping it in asyncio.
"""

from __future__ import annotations

import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

__all__ = ["LocalRunResult", "LocalRunnerError", "run_esbuild"]


class LocalRunnerError(RuntimeError):
    """Raised when the esbuild subprocess fails or times out."""

    def __init__(self, message: str, *, stderr: str = "", returncode: int = -1):
        super().__init__(message)
        self.stderr = stderr
        self.returncode = returncode


@dataclass(frozen=True, slots=True)
class LocalRunResult:
    dist_dir: Path
    stdout: str
    stderr: str
    duration_seconds: float


def run_esbuild(
    project_dir: Path,
    *,
    config_script: Path,
    timeout_seconds: int = 60,
    node_binary: str = "node",
) -> LocalRunResult:
    """Run ``node {config_script}`` with ``project_dir`` as the working dir.

    The script is the one shipped at
    ``packages/templates/base/esbuild.config.mjs`` — it expects the project
    files (``src/index.tsx``, generated component files, ``package.json``)
    to live in the cwd, and writes its output to ``./dist/``.

    Raises :class:`LocalRunnerError` if the build fails for any reason
    (non-zero exit, timeout, missing node binary). The caller is expected
    to log the stderr — it's where the AutoFix loop gets its prompt.
    """
    project_dir = Path(project_dir).resolve()
    config_script = Path(config_script).resolve()

    if not project_dir.is_dir():
        raise LocalRunnerError(f"project directory not found: {project_dir}")
    if not config_script.is_file():
        raise LocalRunnerError(f"esbuild config script not found: {config_script}")
    if shutil.which(node_binary) is None:
        raise LocalRunnerError(
            f"node binary {node_binary!r} not on PATH — install Node 20+ "
            "or set APPIO_NODE_BIN"
        )

    # Wipe any leftover dist/ from a previous run so the precache manifest
    # in sw.js doesn't include stale files.
    dist_dir = project_dir / "dist"
    if dist_dir.exists():
        shutil.rmtree(dist_dir)

    start = time.monotonic()
    try:
        completed = subprocess.run(  # noqa: S603 — controlled args, no shell
            [node_binary, str(config_script)],
            cwd=str(project_dir),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise LocalRunnerError(
            f"esbuild timed out after {timeout_seconds}s",
            stderr=(exc.stderr or "") if isinstance(exc.stderr, str) else "",
        ) from exc
    except FileNotFoundError as exc:
        raise LocalRunnerError(f"failed to launch node: {exc}") from exc

    duration = time.monotonic() - start

    if completed.returncode != 0:
        raise LocalRunnerError(
            f"esbuild failed with exit code {completed.returncode}",
            stderr=completed.stderr,
            returncode=completed.returncode,
        )

    if not dist_dir.is_dir():
        raise LocalRunnerError(
            "esbuild reported success but dist/ directory was not created",
            stderr=completed.stderr,
        )

    return LocalRunResult(
        dist_dir=dist_dir,
        stdout=completed.stdout,
        stderr=completed.stderr,
        duration_seconds=duration,
    )
