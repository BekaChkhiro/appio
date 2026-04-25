"""Schemas for the builds domain.

T2.2b: BuildRequest and BuildSSEEvent removed — the agent pipeline handles
building internally. Only the polling fallback response remains.
"""

from pydantic import BaseModel


class BuildStatusResponse(BaseModel):
    """Polling fallback response."""

    generation_id: str
    build_status: str  # "generating" | "pending" | "building" | "success" | "failed"
    preview_url: str | None = None
    public_url: str | None = None
    error_message: str | None = None
