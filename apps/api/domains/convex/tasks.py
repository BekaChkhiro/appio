"""Dramatiq task — run the Convex publish pipeline in a background worker (T3.6/T3.8).

Each invocation creates a fresh asyncio event loop via asyncio.run().
asyncpg connections are bound to the loop they were created on, so we
also create a fresh engine inside _run() and dispose it at the end —
sharing the worker's startup engine across loops triggers
"Future attached to a different loop" errors.
"""

from __future__ import annotations

import asyncio

import dramatiq
import structlog

from apps.api.config import settings

logger = structlog.stdlib.get_logger()


@dramatiq.actor(max_retries=2)
def run_publish_job(job_id: str) -> None:
    """Execute the full publish pipeline for a given job ID.

    Receives job_id as a string because Dramatiq serialises arguments to JSON.
    """
    from appio_db.session import create_engine, create_session_factory
    from apps.api.domains.convex.migration_service import run_publish_pipeline

    async def _run() -> None:
        from uuid import UUID

        is_neon = "neon" in settings.database_url
        engine = create_engine(settings.database_url, is_neon=is_neon)
        try:
            factory = create_session_factory(engine)
            # No outer db.begin() — the pipeline commits per-step so the UI
            # can poll progress, and the failure path can persist its own
            # status update without being rolled back by an enclosing tx.
            async with factory() as db:
                await run_publish_pipeline(db, UUID(job_id))
        finally:
            await engine.dispose()

    logger.info("publish_task_start", job_id=job_id)
    asyncio.run(_run())
    logger.info("publish_task_done", job_id=job_id)
