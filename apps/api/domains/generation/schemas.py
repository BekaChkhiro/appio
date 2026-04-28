"""Schemas for the generation domain."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    """Single chat message the frontend has cached for an in-progress app.

    Sent up on iteration so the agent can synthesize an "edit existing app"
    prompt that references prior turns. We don't replay tool-call/tool-
    result pairs here — only user/assistant text turns.
    """

    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=10_000)


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
    # Frontend-cached chat history. Used only when ``app_id`` is set —
    # gives the agent context about prior user requests so iterative edits
    # can land precisely instead of regenerating from scratch. Capped at
    # 30 turns to keep request bodies tiny; backend uses only the last 3.
    messages: list[ChatTurn] | None = Field(default=None, max_length=30)


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
