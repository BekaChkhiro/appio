"""Schemas for the generation domain."""

import uuid

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=2000)
    app_id: uuid.UUID | None = None
    # Marketplace template the user started from — used for use_count analytics.
    # Separate from the build-skeleton `templates.id`; references `app_templates.slug`.
    template_slug: str | None = Field(
        None, min_length=1, max_length=100
    )
    idempotency_key: str | None = Field(
        None,
        max_length=128,
        description="Client-provided key to resume a dropped stream.",
    )


class TokenUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0


class SSEEvent(BaseModel):
    """Shape of each SSE data payload.

    Agent-only pipeline (T2.2b): ``spec`` is removed — the agent writes code
    directly and deploys to a subdomain. ``public_url`` carries the deployed
    PWA URL on ``complete`` events.
    """

    type: str
    message: str | None = None
    public_url: str | None = None
    generation_id: str | None = None
    tokens: TokenUsage | None = None
    # Agent-specific fields
    iterations: int | None = None
    cost_usd: float | None = None
    tool_name: str | None = None
    url: str | None = None
