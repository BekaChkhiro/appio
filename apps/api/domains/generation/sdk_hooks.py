"""Safety hooks for the Claude Agent SDK runner.

The spike (ADR 008b) showed that ``permission_mode="acceptEdits"`` does NOT
restrict file ops to ``cwd``. The model can call ``Write file_path=/tmp/x``
and it succeeds silently. These hooks close that gap and add a few
defense-in-depth checks the legacy loop also enforced.

Hooks return either:
- ``{}`` to allow with no changes
- ``{"hookSpecificOutput": {"permissionDecision": "deny", ...}}`` to block
- ``{"hookSpecificOutput": {"additionalContext": "..."}}`` to inject feedback
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import structlog

logger = structlog.stdlib.get_logger()


# Mutating tools that need strict cwd-scoping. Read is intentionally
# excluded — the SDK fires Read on internal config files (CLAUDE.md
# search, plugin probes) during init; rejecting those breaks startup.
# We rely on disallowed_tools + OS-level isolation to bound reads.
_FILE_TOOLS = {"Write", "Edit", "MultiEdit", "NotebookEdit"}

# Bash subcommand names we never want the model invoking. Not exhaustive —
# real isolation belongs at the OS layer; this list catches obvious mistakes.
_DANGEROUS_BASH_RE = re.compile(
    r"\b(rm\s+-rf\s+/|sudo|chmod\s+777|curl\s+[^|]+\|\s*sh|wget\s+[^|]+\|\s*sh|"
    r"dd\s+if=|mkfs|fdisk|iptables|nc\s+-l|/etc/passwd|\.ssh/id_)",
    re.IGNORECASE,
)

# Files the model should never write (auth secrets, lockfiles, etc.).
_FORBIDDEN_PATHS = {
    ".env",
    ".env.local",
    ".env.production",
    ".npmrc",
    ".aws/credentials",
    ".ssh/id_rsa",
    ".ssh/id_ed25519",
}

# Lockfiles — modifying these makes builds non-reproducible. The agent
# should run npm/pnpm install instead.
_LOCKFILE_NAMES = {"package-lock.json", "pnpm-lock.yaml", "yarn.lock"}

# Real-key patterns. Test fixtures use placeholder strings (e.g.,
# "sk_test_..."), so we only match prefixes that strongly indicate a live
# secret. False positives here would block legitimate code generation.
_SECRET_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"sk_live_[A-Za-z0-9]{20,}"),  # Stripe live
    re.compile(r"sk-ant-api03-[A-Za-z0-9_\-]{40,}"),  # Anthropic
    re.compile(r"AKIA[0-9A-Z]{16}"),  # AWS access key
    re.compile(r"AIza[0-9A-Za-z_\-]{35}"),  # Google API
    re.compile(r"-----BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY-----"),
    re.compile(r"ghp_[A-Za-z0-9]{36}"),  # GitHub PAT
    re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}"),  # Slack
]


def _deny(reason: str, *, system_message: str | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        },
    }
    if system_message:
        out["systemMessage"] = system_message
    return out


def _is_inside(path_str: str, root: Path) -> bool:
    try:
        candidate = Path(path_str)
        if not candidate.is_absolute():
            candidate = root / candidate
        candidate = candidate.resolve()
        # Path.is_relative_to was added in 3.9; resolve both sides for safety.
        root_resolved = root.resolve()
        return str(candidate).startswith(str(root_resolved) + "/") or candidate == root_resolved
    except (OSError, ValueError):
        return False


def make_sandbox_hook(workspace: Path):
    """Return a PreToolUse hook that restricts file ops to ``workspace``.

    The SDK passes ``input_data`` with shape:
        {"hook_event_name": "PreToolUse", "tool_name": "Write",
         "tool_input": {"file_path": "...", "content": "..."}, "cwd": "..."}
    """
    workspace_resolved = workspace.resolve()

    async def sandbox_hook(input_data, tool_use_id, context):
        tool = input_data.get("tool_name", "")
        ti = input_data.get("tool_input", {}) or {}

        if tool in _FILE_TOOLS:
            fp = ti.get("file_path") or ti.get("path") or ti.get("notebook_path")
            if isinstance(fp, str) and fp:
                if not _is_inside(fp, workspace_resolved):
                    logger.warning(
                        "sdk_hook_path_outside_workspace",
                        tool=tool,
                        path=fp,
                        workspace=str(workspace_resolved),
                    )
                    return _deny(
                        f"Path outside workspace: {fp}",
                        system_message=(
                            f"Use paths relative to the current workspace "
                            f"({workspace_resolved}). Never write to /tmp or "
                            f"absolute system paths."
                        ),
                    )

        if tool == "Bash":
            command = ti.get("command", "") or ""
            if isinstance(command, str) and _DANGEROUS_BASH_RE.search(command):
                logger.warning("sdk_hook_dangerous_bash", command=command[:200])
                return _deny(
                    "Command matches dangerous pattern",
                    system_message=(
                        "That command was blocked because it could damage the "
                        "host system. Use scoped, idempotent commands inside "
                        "the workspace."
                    ),
                )

        return {}

    return sandbox_hook


def make_secret_scan_hook():
    """Return a PreToolUse hook that blocks writes containing real-looking secrets.

    Test fixtures often contain placeholder strings; we only match patterns
    that strongly indicate a live key (see ``_SECRET_PATTERNS``).
    """

    async def secret_scan_hook(input_data, tool_use_id, context):
        tool = input_data.get("tool_name", "")
        if tool not in {"Write", "Edit", "MultiEdit"}:
            return {}

        ti = input_data.get("tool_input", {}) or {}
        # Concatenate every string field — Edit splits content across
        # ``old_string`` and ``new_string``; MultiEdit nests ``edits``.
        chunks: list[str] = []
        for key in ("content", "old_string", "new_string", "text"):
            val = ti.get(key)
            if isinstance(val, str):
                chunks.append(val)
        edits = ti.get("edits")
        if isinstance(edits, list):
            for edit in edits:
                if isinstance(edit, dict):
                    for key in ("old_string", "new_string"):
                        val = edit.get(key)
                        if isinstance(val, str):
                            chunks.append(val)

        haystack = "\n".join(chunks)
        for pattern in _SECRET_PATTERNS:
            if pattern.search(haystack):
                logger.warning(
                    "sdk_hook_secret_detected",
                    tool=tool,
                    pattern=pattern.pattern[:50],
                )
                return _deny(
                    "Real-looking API key or secret in file content",
                    system_message=(
                        "Don't hardcode secrets. Use environment variables "
                        "and reference them via process.env.* or a config "
                        "module that reads from .env at runtime."
                    ),
                )

        # Block direct writes to known-forbidden files.
        fp = ti.get("file_path") or ti.get("path") or ""
        if isinstance(fp, str):
            name = Path(fp).name
            if name in _LOCKFILE_NAMES:
                return _deny(
                    f"Modifying {name} is not allowed; run npm install instead.",
                )
            # Match exact relative paths or basename for forbidden files.
            for forbidden in _FORBIDDEN_PATHS:
                if fp.endswith("/" + forbidden) or fp == forbidden or name == forbidden:
                    return _deny(f"Writing to {forbidden} is not allowed.")

        return {}

    return secret_scan_hook
