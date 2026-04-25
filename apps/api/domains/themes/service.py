"""Theme generation service — Haiku 4.5 vision call → Persona JSON (T4.1).

Uses prompt caching on the system prompt (5-minute ephemeral) to keep
repeated calls cheap; the schema spec in the system prompt is large and
stable across requests.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

import anthropic
import structlog
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from appio_db.models import UserTheme
from apps.api.config import settings
from apps.api.domains.generation.model_router import HAIKU_4_5

from .schemas import (
    GenerateThemeRequest,
    PersonaSchema,
    SavedThemeResponse,
    ThemeListResponse,
    WcagReport,
)
from .wcag import run_wcag_checks

logger = structlog.stdlib.get_logger()

_SYSTEM_PROMPT = """\
You are a design-system expert. Your ONLY output is a single valid JSON object \
matching the Persona schema below. Do NOT wrap it in markdown code fences or \
add any other text.

SCHEMA (TypeScript reference — emit the exact same key names):
{
  "id": string,          // one of: minimal-mono | vibrant-gradient | brutalist-bold | glassmorphic-soft | editorial-serif
  "name": string,
  "description": string,
  "inspiration": string,
  "light": { "oklch": ColorMap, "rgb": ColorMap },
  "dark":  { "oklch": ColorMap, "rgb": ColorMap },
  // ColorMap has 17 slots — ALL required:
  // background foreground card cardForeground primary primaryForeground
  // secondary secondaryForeground muted mutedForeground accent accentForeground
  // border input ring destructive destructiveForeground
  // oklch values: "oklch(L C H)" strings (L 0..1, C 0..0.4, H 0..360)
  // rgb values: "#RRGGBB" hex strings — must be the sRGB render of the oklch token
  "typography": {
    "heading": { "family": string, "weight": number, "lineHeight": number, "letterSpacing": string },
    "body":    { "family": string, "weight": number, "lineHeight": number, "letterSpacing": string },
    "mono":    { "family": string },
    "scale":   { "display": number, "h1": number, "h2": number, "h3": number, "body": number, "small": number }
  },
  "shape": {
    "radius": { "none": 0, "sm": number, "md": number, "lg": number, "xl": number, "full": 9999 },
    "shadow": { "none": "none", "sm": string, "md": string, "lg": string, "xl": string },
    "border": { "thin": 1, "medium": 2, "thick": 4 }
  },
  "motion": {
    "duration": { "instant": number, "fast": number, "medium": number, "slow": number, "slower": number },
    "ease": { "standard": string, "out": string, "in": string, "emphasized": string, "spring": string }
  }
}

WCAG AA REQUIREMENTS (4.5:1 for text, 3:1 for ring/background):
- Every foreground/background pair in TEXT_PAIRS must hit 4.5:1 in both oklch and rgb.
- ring/background must hit 3:1.
- Keep oklch and rgb close (max Euclidean RGB distance 12) to avoid iOS 15 fallback drift.
"""

# Cache the system prompt for 5 minutes (ephemeral default). The schema spec
# is hundreds of tokens and identical on every theme call — caching it pays
# for itself after the first request in a given cache window.
_SYSTEM_BLOCKS: list[dict[str, Any]] = [
    {
        "type": "text",
        "text": _SYSTEM_PROMPT,
        "cache_control": {"type": "ephemeral"},
    }
]

_MAX_TOKENS = 4096
_TIMEOUT_S = 60.0


def _build_user_content(req: GenerateThemeRequest) -> list[dict[str, Any]]:
    if req.prompt is not None:
        return [{"type": "text", "text": f"Generate a theme persona for: {req.prompt}"}]

    blocks: list[dict[str, Any]] = []

    if req.image_url is not None:
        blocks.append({
            "type": "image",
            "source": {"type": "url", "url": req.image_url},
        })
        blocks.append({
            "type": "text",
            "text": "Generate a theme persona inspired by the colours and mood of this image.",
        })
    elif req.image_base64 is not None:
        # Assume JPEG; the base64 string must be raw (no data-URI prefix).
        blocks.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": req.image_base64,
            },
        })
        blocks.append({
            "type": "text",
            "text": "Generate a theme persona inspired by the colours and mood of this image.",
        })

    return blocks


async def generate_theme(
    req: GenerateThemeRequest,
) -> tuple[PersonaSchema, float, WcagReport]:
    """Call Haiku 4.5, parse JSON into PersonaSchema, run WCAG checks.

    Retries once on JSON parse failure with the validation error message
    included in the follow-up turn (avoids burning a full system-prompt
    cache write on a recoverable parse failure).
    """
    client = anthropic.AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        timeout=_TIMEOUT_S,
    )

    messages: list[dict[str, Any]] = [
        {"role": "user", "content": _build_user_content(req)}
    ]

    total_input = 0
    total_output = 0
    total_cache_read = 0
    total_cache_write = 0

    def _record_usage(usage: Any) -> None:
        nonlocal total_input, total_output, total_cache_read, total_cache_write
        total_input += getattr(usage, "input_tokens", 0) or 0
        total_output += getattr(usage, "output_tokens", 0) or 0
        total_cache_read += getattr(usage, "cache_read_input_tokens", 0) or 0
        total_cache_write += getattr(usage, "cache_creation_input_tokens", 0) or 0

    raw_json: str | None = None
    parse_error: str | None = None

    for attempt in range(2):
        if attempt == 1:
            # Retry: inject the previous raw response + the parse failure so
            # Claude can correct itself without re-reading the whole system prompt.
            messages = messages + [
                {"role": "assistant", "content": raw_json or ""},
                {
                    "role": "user",
                    "content": (
                        f"Your previous response was not valid JSON.\n"
                        f"Error: {parse_error}\n"
                        "Return only the corrected JSON object."
                    ),
                },
            ]

        response = await client.messages.create(
            model=HAIKU_4_5.model_id,
            max_tokens=_MAX_TOKENS,
            system=_SYSTEM_BLOCKS,
            messages=messages,
        )
        _record_usage(response.usage)

        raw_json = ""
        for block in response.content:
            if hasattr(block, "text"):
                raw_json += block.text

        raw_json = raw_json.strip()

        try:
            persona = PersonaSchema.model_validate_json(raw_json)
            cost = HAIKU_4_5.compute_cost(
                total_input,
                total_output,
                total_cache_read,
                total_cache_write,
            )
            logger.info(
                "theme_generated",
                attempt=attempt + 1,
                cost_usd=cost,
                cache_read=total_cache_read,
            )
            wcag = run_wcag_checks(persona)
            return persona, cost, wcag
        except (ValidationError, ValueError, json.JSONDecodeError) as exc:
            parse_error = str(exc)
            logger.warning(
                "theme_parse_failed",
                attempt=attempt + 1,
                error=parse_error[:300],
            )

    raise HTTPException(
        status_code=422,
        detail=f"Claude returned invalid theme JSON after 2 attempts: {parse_error}",
    )


# ── DB helpers ────────────────────────────────────────────────────────────────

async def persist_theme(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    req: GenerateThemeRequest,
    persona: PersonaSchema,
    cost_usd: float,
) -> UserTheme:
    """Insert a UserTheme row and flush within the caller's transaction."""
    name = req.name or persona.name
    source_kind = "text" if req.prompt is not None else "image"
    row = UserTheme(
        user_id=user_id,
        name=name,
        source_kind=source_kind,
        source_prompt=req.prompt,
        source_image_url=req.image_url,
        persona_json=persona.model_dump(by_alias=False),
        cost_usd=cost_usd,
    )
    db.add(row)
    await db.flush()
    return row


def _row_to_response(row: UserTheme) -> SavedThemeResponse:
    persona = PersonaSchema.model_validate(row.persona_json)
    return SavedThemeResponse(
        theme_id=row.id,
        name=row.name,
        source_kind=row.source_kind,
        source_prompt=row.source_prompt,
        source_image_url=row.source_image_url,
        persona=persona,
        cost_usd=row.cost_usd,
        created_at=row.created_at.isoformat(),
    )


async def list_themes(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
) -> ThemeListResponse:
    total_result = await db.execute(
        select(func.count()).select_from(UserTheme).where(UserTheme.user_id == user_id)
    )
    total = int(total_result.scalar_one() or 0)

    result = await db.execute(
        select(UserTheme)
        .where(UserTheme.user_id == user_id)
        .order_by(UserTheme.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = list(result.scalars().all())
    return ThemeListResponse(
        items=[_row_to_response(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


async def get_theme(
    db: AsyncSession,
    *,
    theme_id: uuid.UUID,
    user_id: uuid.UUID,
) -> UserTheme | None:
    result = await db.execute(
        select(UserTheme).where(
            UserTheme.id == theme_id,
            UserTheme.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def delete_theme(
    db: AsyncSession,
    *,
    theme_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    row = await get_theme(db, theme_id=theme_id, user_id=user_id)
    if row is None:
        return False
    await db.delete(row)
    await db.flush()
    return True
