"""Dramatiq task — run the Convex publish pipeline in a background worker (T3.6/T3.8).

The existing builds/tasks.py is a stub (single docstring). This file follows
the same pattern of bridging sync Dramatiq → async work via asyncio.run.

TODO(T3.6): replace asyncio.run with a proper async-aware broker bridge once
the builds domain establishes one. asyncio.run works for single-actor
processes but creates a new event loop per invocation (no connection reuse).
"""

from __future__ import annotations

import asyncio

import dramatiq
import structlog

logger = structlog.stdlib.get_logger()


@dramatiq.actor(max_retries=2)
def run_publish_job(job_id: str) -> None:
    """Execute the full publish pipeline for a given job ID.

    Receives job_id as a string because Dramatiq serialises arguments to JSON.
    """
    from appio_db import get_session_factory
    from apps.api.domains.convex.migration_service import run_publish_pipeline

    async def _run() -> None:
        from uuid import UUID

        factory = get_session_factory()
        async with factory() as db, db.begin():
            await run_publish_pipeline(db, UUID(job_id))

    logger.info("publish_task_start", job_id=job_id)
    asyncio.run(_run())
    logger.info("publish_task_done", job_id=job_id)
