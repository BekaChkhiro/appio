"""Async wrapper for `npx convex` subprocess calls (T3.8/T3.9)."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from pathlib import Path

logger = structlog.stdlib.get_logger()


class ConvexCliError(RuntimeError):
    def __init__(self, cmd: str, returncode: int, stderr: str) -> None:
        super().__init__(f"{cmd} failed (exit {returncode}): {stderr[:500]}")
        self.cmd = cmd
        self.returncode = returncode
        self.stderr = stderr


@dataclass(frozen=True)
class CliResult:
    stdout: str
    stderr: str


async def run_convex_deploy(
    *,
    workspace: Path,
    deploy_key: str,
    deployment_url: str,
    timeout_seconds: int = 300,
) -> CliResult:
    """`npx convex deploy` — pushes schema + functions to the target deployment.

    deploy_key is set in env ONLY for this subprocess, never on the parent.
    """
    return await _run(
        cmd=["npx", "convex", "deploy", "--yes"],
        cwd=workspace,
        deploy_key=deploy_key,
        deployment_url=deployment_url,
        timeout_seconds=timeout_seconds,
    )


async def run_convex_import(
    *,
    snapshot_path: Path,
    deploy_key: str,
    deployment_url: str,
    cwd: Path,
    replace: bool = True,
    timeout_seconds: int = 300,
) -> CliResult:
    """`npx convex import --replace` — loads JSONL/zip into target deployment.

    cwd must be a valid Convex project directory (contains package.json).
    """
    cmd = ["npx", "convex", "import"]
    if replace:
        cmd.append("--replace")
    cmd.append(str(snapshot_path))
    return await _run(
        cmd=cmd,
        cwd=cwd,
        deploy_key=deploy_key,
        deployment_url=deployment_url,
        timeout_seconds=timeout_seconds,
    )


async def run_convex_export(
    *,
    deploy_key: str,
    deployment_url: str,
    snapshot_path: Path,
    cwd: Path,
    timeout_seconds: int = 300,
) -> CliResult:
    """`npx convex export --path {snapshot_path}` — produces a zip snapshot.

    cwd must be a valid Convex project directory (contains package.json).
    """
    cmd = ["npx", "convex", "export", "--path", str(snapshot_path)]
    return await _run(
        cmd=cmd,
        cwd=cwd,
        deploy_key=deploy_key,
        deployment_url=deployment_url,
        timeout_seconds=timeout_seconds,
    )


async def run_convex_run(
    *,
    function_name: str,
    args_json: str,
    deploy_key: str,
    deployment_url: str,
    cwd: Path,
    timeout_seconds: int = 120,
) -> CliResult:
    """`npx convex run {function_name} '{args_json}'` — invokes a function and returns stdout."""
    cmd = ["npx", "convex", "run", function_name, args_json]
    return await _run(
        cmd=cmd,
        cwd=cwd,
        deploy_key=deploy_key,
        deployment_url=deployment_url,
        timeout_seconds=timeout_seconds,
    )


async def _run(
    *,
    cmd: list[str],
    cwd: Path,
    deploy_key: str,
    deployment_url: str,
    timeout_seconds: int,
) -> CliResult:
    # Build env from scratch — inherit PATH/HOME/etc but inject only the
    # secrets we need. Deploy key lives only in this subprocess's env.
    env = {
        **os.environ,
        "CONVEX_DEPLOY_KEY": deploy_key,
        "CONVEX_URL": deployment_url,
    }
    # Redact the deploy key before logging
    logger.info(
        "convex_cli_start",
        cmd=" ".join(cmd[:3]),
        cwd=str(cwd),
        deployment_url=deployment_url,
    )
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(cwd),
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_b, stderr_b = await asyncio.wait_for(
            proc.communicate(),
            timeout=timeout_seconds,
        )
    except TimeoutError as exc:
        raise ConvexCliError(cmd[0], -1, f"timed out after {timeout_seconds}s") from exc
    except (OSError, FileNotFoundError) as exc:
        raise ConvexCliError(cmd[0], -1, str(exc)) from exc

    stdout = _scrub(stdout_b.decode("utf-8", errors="replace"), deploy_key)
    stderr = _scrub(stderr_b.decode("utf-8", errors="replace"), deploy_key)

    if proc.returncode != 0:
        raise ConvexCliError(cmd[0], proc.returncode or -1, stderr)

    logger.info("convex_cli_done", cmd=cmd[0], stdout_bytes=len(stdout_b))
    return CliResult(stdout=stdout, stderr=stderr)


def _scrub(text: str, secret: str) -> str:
    """Remove ``secret`` (and its prefix-before-pipe variant) from CLI output.

    Defence-in-depth: the Convex CLI doesn't print the deploy key today, but a
    future CLI version or a wrapped node error could dump process env. Keeping
    the raw string out of stderr means a leaked ``ConvexCliError.__str__`` or
    ``job.error_message`` never exfiltrates the key even if Convex regresses.
    """
    if not secret:
        return text
    replaced = text.replace(secret, "[REDACTED_DEPLOY_KEY]")
    # The team-slug prefix (``prod:teamslug|``) is not itself a secret, but
    # scrubbing the full secret string is safer than regex-matching: if the
    # CLI ever prints a partial key (e.g. first 8 chars for diagnostics),
    # we don't want those chars to land in durable storage either.
    if "|" in secret:
        prefix = secret.split("|", 1)[0]
        if len(prefix) > 8:  # avoid false positives on common tokens
            replaced = replaced.replace(prefix, "[REDACTED_DEPLOY_KEY_PREFIX]")
    return replaced
