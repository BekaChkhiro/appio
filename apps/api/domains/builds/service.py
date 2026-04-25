"""Build status service.

T2.2b: The spec-based ``stream_build`` flow has been removed — the agent
pipeline (AgentService) now handles building via tool-use and deploys via
``Orchestrator.build_from_workspace()`` directly.

Remaining responsibilities:
- ``get_build_status()`` — polling fallback for dropped SSE connections
- ``record_build_outcome()`` — persist build success/failure on generation rows
"""

from __future__ import annotations

import uuid
from typing import Any

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from appio_builder.orchestrator import BuildError
from appio_db.models import Generation, Template

logger = structlog.stdlib.get_logger()


async def get_build_status(
    db: AsyncSession, generation_id: uuid.UUID,
) -> dict[str, Any] | None:
    """Fetch current build status for the polling fallback endpoint."""
    result = await db.execute(
        select(Generation).where(Generation.id == generation_id)
    )
    gen = result.scalar_one_or_none()
    if gen is None:
        return None

    error_message = None
    if gen.error_context and isinstance(gen.error_context, dict):
        error_message = gen.error_context.get("message")

    return {
        "generation_id": str(gen.id),
        "build_status": gen.build_status,
        "preview_url": gen.preview_url,
        "public_url": gen.public_url,
        "error_message": error_message,
        "autofix_attempts": gen.autofix_attempts or 0,
    }


async def record_build_outcome(
    *,
    db: AsyncSession,
    generation_id: uuid.UUID,
    template_id: str,
    success: bool,
    autofix_attempts: int = 0,
    autofix_cost_usd: float = 0.0,
    error: BuildError | None = None,
) -> None:
    """Persist build outcome on the generation row and template counters."""
    gen_values: dict[str, Any] = {
        "build_status": "success" if success else "failed",
        "autofix_attempts": autofix_attempts,
    }
    if error is not None:
        gen_values["last_error_stage"] = error.stage
        gen_values["error_context"] = {
            "stage": error.stage,
            "recoverable": error.recoverable,
            "message": str(error)[:4000],
            "autofix_attempts": autofix_attempts,
            "autofix_cost_usd": autofix_cost_usd,
        }

    await db.execute(
        update(Generation)
        .where(Generation.id == generation_id)
        .values(**gen_values)
    )

    tmpl_values: dict[str, Any] = {
        "total_builds": Template.total_builds + 1,
    }
    if success:
        tmpl_values["successful_builds"] = Template.successful_builds + 1
    else:
        tmpl_values["failed_builds"] = Template.failed_builds + 1

    if autofix_attempts > 0:
        tmpl_values["autofix_triggered"] = Template.autofix_triggered + 1
        if success:
            tmpl_values["autofix_resolved"] = Template.autofix_resolved + 1

    await db.execute(
        update(Template)
        .where(Template.id == template_id)
        .values(**tmpl_values)
    )

    await db.flush()

    logger.info(
        "build_outcome_recorded",
        generation_id=str(generation_id),
        template_id=template_id,
        success=success,
        autofix_attempts=autofix_attempts,
    )


def _user_facing_error(exc: BuildError) -> str:
    """Return a safe, non-leaky error message for the client."""
    if exc.stage == "build":
        return "Build failed. Try a simpler prompt or a different template."
    if exc.stage in ("codegen", "scan"):
        return "Generated code contained issues. Try rephrasing your prompt."
    return "Build failed due to an internal error. Please try again."
