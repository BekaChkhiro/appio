"""Sandboxed file-system + build tools for the Claude agent.

These functions are wired up as Claude `tool_use` handlers in
``apps.api.domains.generation.agent_service``. Each tool takes a
workspace root (a temporary directory the orchestrator manages) and a
user-supplied path, normalises the path, and refuses anything that
escapes the sandbox.

Design notes
------------
* The agent only ever sees paths *relative* to the workspace root.
* Path traversal is blocked by resolving and checking that the resolved
  path lives under ``workspace.resolve()``.
* A small file-extension whitelist limits what the agent can write —
  enough for React/TS/CSS/JSON, nothing exotic.
* ``run_build`` is just a convenience wrapper around the existing
  ``local_runner.run_esbuild`` so the agent path uses the *same* esbuild
  pipeline as the deterministic codegen.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .local_runner import LocalRunnerError, run_esbuild

__all__ = [
    "AgentToolError",
    "BuildToolResult",
    "list_files",
    "read_file",
    "run_build",
    "write_file",
]


# Agents may only write these extensions inside the workspace.
_WRITABLE_EXTENSIONS = frozenset(
    {".tsx", ".ts", ".jsx", ".js", ".css", ".json", ".html", ".svg", ".md"}
)

# Files the agent must NEVER touch (build infrastructure).
_PROTECTED_FILES = frozenset(
    {
        "esbuild.config.mjs",
        "sw.js",
        "index.html",
        "src/index.tsx",
        "src/styles/global.css",
    }
)

# Hard cap on a single file write so the agent can't fill the disk.
_MAX_WRITE_BYTES = 256 * 1024  # 256 KB per file

# Token-budget caps for tool RESULTS sent back to the model. Trimming
# these aggressively keeps the agent loop's cumulative input cost down.
_MAX_READ_RETURN_BYTES = 4 * 1024  # 4 KB per read_file response
_MAX_LIST_ENTRIES = 30  # max entries returned by list_files


class AgentToolError(Exception):
    """Raised when an agent tool call is rejected (sandbox / validation)."""


@dataclass(frozen=True, slots=True)
class BuildToolResult:
    success: bool
    stdout: str
    stderr: str
    duration_seconds: float


# ---------------------------------------------------------------------------
# path helpers
# ---------------------------------------------------------------------------


def _resolve_inside(workspace: Path, rel_path: str) -> Path:
    """Resolve ``rel_path`` against ``workspace`` and refuse escapes.

    Returns the absolute resolved path. Raises :class:`AgentToolError`
    if the path tries to leave the sandbox.
    """
    if not isinstance(rel_path, str) or not rel_path.strip():
        raise AgentToolError("path must be a non-empty string")

    # Normalise: strip leading slash so absolute-looking paths are
    # treated as workspace-relative.
    cleaned = rel_path.strip().lstrip("/")
    if cleaned in {"", "."}:
        return workspace.resolve()

    # Block obvious traversal early for a clearer error message; the
    # resolved-prefix check below is the real defence.
    if ".." in Path(cleaned).parts:
        raise AgentToolError(f"path traversal not allowed: {rel_path!r}")

    candidate = (workspace / cleaned).resolve()
    workspace_resolved = workspace.resolve()
    try:
        candidate.relative_to(workspace_resolved)
    except ValueError as exc:
        raise AgentToolError(
            f"path escapes workspace: {rel_path!r}"
        ) from exc
    return candidate


def _rel(workspace: Path, abs_path: Path) -> str:
    """Format ``abs_path`` as a workspace-relative POSIX string."""
    return abs_path.resolve().relative_to(workspace.resolve()).as_posix() or "."


# ---------------------------------------------------------------------------
# tool implementations
# ---------------------------------------------------------------------------


def list_files(workspace: Path, path: str = ".") -> str:
    """Return a newline-separated listing of ``path`` inside the workspace.

    Directories are suffixed with ``/`` so the agent can tell them apart.
    Hidden files (``.git``, ``.DS_Store``...) and ``node_modules`` /
    ``dist`` are skipped — they exist for the build, not the agent.
    """
    target = _resolve_inside(workspace, path)
    if not target.exists():
        raise AgentToolError(f"path not found: {path!r}")
    if not target.is_dir():
        raise AgentToolError(f"not a directory: {path!r}")

    skip = {"node_modules", "dist", ".git"}
    entries: list[str] = []
    for child in sorted(target.iterdir()):
        if child.name.startswith(".") or child.name in skip:
            continue
        if child.is_dir():
            entries.append(f"{child.name}/")
        else:
            entries.append(child.name)

    if not entries:
        return f"(empty directory: {_rel(workspace, target)})"

    truncated = ""
    if len(entries) > _MAX_LIST_ENTRIES:
        truncated = f"\n... [{len(entries) - _MAX_LIST_ENTRIES} more entries omitted]"
        entries = entries[:_MAX_LIST_ENTRIES]

    header = f"Contents of {_rel(workspace, target)}:"
    return header + "\n" + "\n".join(entries) + truncated


def read_file(workspace: Path, path: str) -> str:
    """Return the UTF-8 contents of ``path`` inside the workspace."""
    target = _resolve_inside(workspace, path)
    if not target.exists():
        raise AgentToolError(f"file not found: {path!r}")
    if not target.is_file():
        raise AgentToolError(f"not a regular file: {path!r}")

    try:
        size = target.stat().st_size
    except OSError as exc:
        raise AgentToolError(f"cannot stat {path!r}: {exc}") from exc

    if size > _MAX_WRITE_BYTES:
        raise AgentToolError(
            f"file too large to read ({size} bytes > {_MAX_WRITE_BYTES})"
        )

    try:
        text = target.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise AgentToolError(
            f"file is not valid UTF-8: {path!r}"
        ) from exc

    # Trim very long files so we don't pay the input-token cost of
    # re-sending a giant file across multiple agent turns.
    if len(text.encode("utf-8")) > _MAX_READ_RETURN_BYTES:
        head = text[: _MAX_READ_RETURN_BYTES // 2]
        tail = text[-(_MAX_READ_RETURN_BYTES // 2) :]
        return (
            head
            + f"\n\n... [file truncated — {size} bytes total, "
            f"showing first/last {_MAX_READ_RETURN_BYTES // 2} bytes] ...\n\n"
            + tail
        )
    return text


def write_file(workspace: Path, path: str, content: str) -> str:
    """Create or overwrite ``path`` inside the workspace.

    Enforces:
    * path stays inside the workspace
    * extension is on the writable whitelist
    * not in the protected-files set
    * size below ``_MAX_WRITE_BYTES``
    """
    if not isinstance(content, str):
        raise AgentToolError("content must be a string")

    encoded = content.encode("utf-8")
    if len(encoded) > _MAX_WRITE_BYTES:
        raise AgentToolError(
            f"content too large ({len(encoded)} bytes > {_MAX_WRITE_BYTES})"
        )

    target = _resolve_inside(workspace, path)
    rel = _rel(workspace, target)

    if rel in _PROTECTED_FILES:
        raise AgentToolError(
            f"file is protected and cannot be modified: {rel}"
        )

    suffix = target.suffix.lower()
    if suffix not in _WRITABLE_EXTENSIONS:
        allowed = ", ".join(sorted(_WRITABLE_EXTENSIONS))
        raise AgentToolError(
            f"extension {suffix!r} not allowed (allowed: {allowed})"
        )

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

    return f"wrote {len(encoded)} bytes to {rel}"


def run_build(
    workspace: Path,
    *,
    config_script: Path,
    timeout_seconds: int = 90,
) -> BuildToolResult:
    """Run esbuild in the workspace and report the result.

    Unlike the orchestrator's main runner, this function never raises on
    a non-zero exit — the agent NEEDS to see the stderr to fix its
    code, so we surface failures via ``BuildToolResult.success``.
    """
    try:
        result = run_esbuild(
            workspace,
            config_script=config_script,
            timeout_seconds=timeout_seconds,
        )
    except LocalRunnerError as exc:
        return BuildToolResult(
            success=False,
            stdout="",
            stderr=f"{exc}\n{exc.stderr}".strip(),
            duration_seconds=0.0,
        )

    return BuildToolResult(
        success=True,
        stdout=result.stdout,
        stderr=result.stderr,
        duration_seconds=result.duration_seconds,
    )
