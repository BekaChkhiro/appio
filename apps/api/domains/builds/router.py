"""Build endpoints — polling fallback for dropped SSE connections.

T2.2b: The POST /api/v1/builds/ spec-based build trigger has been removed.
The agent pipeline (POST /api/v1/generate/) now handles building internally.
Only the GET polling fallback endpoint remains for recovering from dropped
SSE connections mid-generation.
"""

from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException

from appio_db import get_session_factory
from apps.api.core.security import FirebaseUser
from apps.api.core.security import get_firebase_user as get_current_user

from .schemas import BuildStatusResponse
from .service import get_build_status

logger = structlog.stdlib.get_logger()

router = APIRouter()


@router.get("/{generation_id}/status")
async def poll_build_status(
    generation_id: uuid.UUID,
    user: FirebaseUser = Depends(get_current_user),
) -> BuildStatusResponse:
    """Get build status — polling fallback for when SSE drops mid-build.

    The mobile client polls this endpoint every 500ms if the SSE connection
    is lost.  Returns the current state from the ``generations`` table.
    """
    session_factory = get_session_factory()
    async with session_factory() as db:
        status = await get_build_status(db, generation_id)

    if status is None:
        raise HTTPException(status_code=404, detail="Generation not found")

    return BuildStatusResponse(**status)
