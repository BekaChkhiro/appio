"""Unit tests for the themes domain (T4.1).

All Anthropic API calls are mocked — no real network requests.
DB writes are verified via AsyncMock (no real DB connection required).
"""

from __future__ import annotations

import copy
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ── Minimal persona JSON that satisfies PersonaSchema ────────────────────────
# All-grey palette: zero chroma = perfectly in-gamut, zero OKLCH→RGB drift.
# Black (#000000) / white (#ffffff) pairs give 21:1 contrast — well above AA.
# ring is white against black background = 21:1 > 3:1 UI minimum.

_COLOR_MAP_OKLCH = {
    "background": "oklch(0.0 0.0 0)",
    "foreground": "oklch(1.0 0.0 0)",
    "card": "oklch(0.0 0.0 0)",
    "cardForeground": "oklch(1.0 0.0 0)",
    "primary": "oklch(0.0 0.0 0)",
    "primaryForeground": "oklch(1.0 0.0 0)",
    "secondary": "oklch(0.0 0.0 0)",
    "secondaryForeground": "oklch(1.0 0.0 0)",
    "muted": "oklch(0.0 0.0 0)",
    "mutedForeground": "oklch(1.0 0.0 0)",
    "accent": "oklch(0.0 0.0 0)",
    "accentForeground": "oklch(1.0 0.0 0)",
    "border": "oklch(0.0 0.0 0)",
    "input": "oklch(0.0 0.0 0)",
    "ring": "oklch(1.0 0.0 0)",
    "destructive": "oklch(0.0 0.0 0)",
    "destructiveForeground": "oklch(1.0 0.0 0)",
}

_COLOR_MAP_RGB = {
    "background": "#000000",
    "foreground": "#ffffff",
    "card": "#000000",
    "cardForeground": "#ffffff",
    "primary": "#000000",
    "primaryForeground": "#ffffff",
    "secondary": "#000000",
    "secondaryForeground": "#ffffff",
    "muted": "#000000",
    "mutedForeground": "#ffffff",
    "accent": "#000000",
    "accentForeground": "#ffffff",
    "border": "#000000",
    "input": "#000000",
    "ring": "#ffffff",
    "destructive": "#000000",
    "destructiveForeground": "#ffffff",
}

_PERSONA_JSON = {
    "id": "minimal-mono",
    "name": "Minimal Mono",
    "description": "A high-contrast monochromatic theme",
    "inspiration": "Print typography",
    "light": {"oklch": _COLOR_MAP_OKLCH, "rgb": _COLOR_MAP_RGB},
    "dark":  {"oklch": _COLOR_MAP_OKLCH, "rgb": _COLOR_MAP_RGB},
    "typography": {
        "heading": {"family": "Inter", "weight": 700, "lineHeight": 1.2, "letterSpacing": "-0.02em"},
        "body":    {"family": "Inter", "weight": 400, "lineHeight": 1.5, "letterSpacing": "0em"},
        "mono":    {"family": "JetBrains Mono"},
        "scale":   {"display": 3.0, "h1": 2.25, "h2": 1.875, "h3": 1.5, "body": 1.0, "small": 0.875},
    },
    "shape": {
        "radius": {"none": 0, "sm": 0.125, "md": 0.375, "lg": 0.5, "xl": 0.75, "full": 9999},
        "shadow": {
            "none": "none",
            "sm": "0 1px 2px rgba(0,0,0,0.05)",
            "md": "0 4px 6px rgba(0,0,0,0.1)",
            "lg": "0 10px 15px rgba(0,0,0,0.15)",
            "xl": "0 20px 25px rgba(0,0,0,0.2)",
        },
        "border": {"thin": 1, "medium": 2, "thick": 4},
    },
    "motion": {
        "duration": {"instant": 50, "fast": 100, "medium": 200, "slow": 400, "slower": 700},
        "ease": {
            "standard": "cubic-bezier(0.2, 0, 0, 1)",
            "out": "cubic-bezier(0, 0, 0.2, 1)",
            "in": "cubic-bezier(0.4, 0, 1, 1)",
            "emphasized": "cubic-bezier(0.2, 0, 0, 1)",
            "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        },
    },
}


def _make_mock_response(persona_json: dict) -> MagicMock:
    """Build a minimal object that looks like anthropic.types.Message."""
    block = MagicMock()
    block.text = json.dumps(persona_json)
    response = MagicMock()
    response.content = [block]
    usage = MagicMock()
    usage.input_tokens = 500
    usage.output_tokens = 800
    usage.cache_read_input_tokens = 450
    usage.cache_creation_input_tokens = 50
    response.usage = usage
    return response


# ── Schema tests ─────────────────────────────────────────────────────────────

class TestGenerateThemeRequest:
    def test_prompt_only(self) -> None:
        from apps.api.domains.themes.schemas import GenerateThemeRequest

        req = GenerateThemeRequest(prompt="sunset over Tokyo")
        assert req.prompt == "sunset over Tokyo"
        assert req.image_url is None

    def test_image_url_only(self) -> None:
        from apps.api.domains.themes.schemas import GenerateThemeRequest

        req = GenerateThemeRequest(image_url="https://example.com/img.jpg")
        assert req.image_url == "https://example.com/img.jpg"

    def test_rejects_no_source(self) -> None:
        from apps.api.domains.themes.schemas import GenerateThemeRequest

        with pytest.raises(Exception):
            GenerateThemeRequest()

    def test_rejects_two_sources(self) -> None:
        from apps.api.domains.themes.schemas import GenerateThemeRequest

        with pytest.raises(Exception):
            GenerateThemeRequest(prompt="hello", image_url="https://example.com/img.jpg")

    def test_name_is_optional(self) -> None:
        from apps.api.domains.themes.schemas import GenerateThemeRequest

        req = GenerateThemeRequest(prompt="glacial ice", name="My Theme")
        assert req.name == "My Theme"


class TestPersonaSchema:
    def test_roundtrip(self) -> None:
        from apps.api.domains.themes.schemas import PersonaSchema

        persona = PersonaSchema.model_validate(_PERSONA_JSON)
        assert persona.id == "minimal-mono"
        assert persona.light.oklch.background == "oklch(0.0 0.0 0)"
        assert persona.light.rgb.foreground == "#ffffff"
        assert persona.motion.ease.in_ == "cubic-bezier(0.4, 0, 1, 1)"


# ── WCAG validator tests ──────────────────────────────────────────────────────

class TestWcagValidator:
    def test_high_contrast_passes(self) -> None:
        from apps.api.domains.themes.schemas import PersonaSchema
        from apps.api.domains.themes.wcag import run_wcag_checks

        persona = PersonaSchema.model_validate(_PERSONA_JSON)
        report = run_wcag_checks(persona)
        # Pure black/white pairs must always pass WCAG AA at 21:1
        assert report.passes
        assert len(report.errors) == 0

    def test_low_contrast_fails(self) -> None:
        from apps.api.domains.themes.schemas import PersonaSchema
        from apps.api.domains.themes.wcag import run_wcag_checks

        bad = copy.deepcopy(_PERSONA_JSON)
        # Near-identical grey for foreground (background is black) — contrast ~1.04:1
        bad["light"]["oklch"]["foreground"] = "oklch(0.05 0.0 0)"
        bad["light"]["rgb"]["foreground"] = "#0d0d0d"
        bad["dark"]["oklch"]["foreground"] = "oklch(0.05 0.0 0)"
        bad["dark"]["rgb"]["foreground"] = "#0d0d0d"
        # ring also near-black → ring/background contrast fails
        bad["light"]["oklch"]["ring"] = "oklch(0.05 0.0 0)"
        bad["light"]["rgb"]["ring"] = "#0d0d0d"
        bad["dark"]["oklch"]["ring"] = "oklch(0.05 0.0 0)"
        bad["dark"]["rgb"]["ring"] = "#0d0d0d"

        persona = PersonaSchema.model_validate(bad)
        report = run_wcag_checks(persona)
        assert not report.passes
        assert any("background/foreground" in e for e in report.errors)


# ── Service unit tests — happy path (text prompt, mocked API) ─────────────────

class TestGenerateThemeService:
    @pytest.mark.asyncio
    async def test_text_prompt_happy_path(self) -> None:
        from apps.api.domains.themes.schemas import GenerateThemeRequest
        from apps.api.domains.themes.service import generate_theme

        mock_response = _make_mock_response(_PERSONA_JSON)

        with patch("apps.api.domains.themes.service.anthropic.AsyncAnthropic") as MockClient:
            instance = AsyncMock()
            MockClient.return_value = instance
            instance.messages.create = AsyncMock(return_value=mock_response)

            req = GenerateThemeRequest(prompt="warm bakery")
            persona, cost_usd, wcag = await generate_theme(req)

        assert persona.id == "minimal-mono"
        assert cost_usd >= 0.0
        assert isinstance(wcag.passes, bool)
        assert isinstance(wcag.errors, list)
        assert isinstance(wcag.warnings, list)

    @pytest.mark.asyncio
    async def test_retry_on_bad_json(self) -> None:
        """Service retries once on parse failure, succeeds on second call."""
        from apps.api.domains.themes.schemas import GenerateThemeRequest
        from apps.api.domains.themes.service import generate_theme

        good_response = _make_mock_response(_PERSONA_JSON)
        bad_block = MagicMock()
        bad_block.text = "not valid json {"
        bad_response = MagicMock()
        bad_response.content = [bad_block]
        bad_usage = MagicMock()
        bad_usage.input_tokens = 100
        bad_usage.output_tokens = 10
        bad_usage.cache_read_input_tokens = 0
        bad_usage.cache_creation_input_tokens = 100
        bad_response.usage = bad_usage

        with patch("apps.api.domains.themes.service.anthropic.AsyncAnthropic") as MockClient:
            instance = AsyncMock()
            MockClient.return_value = instance
            instance.messages.create = AsyncMock(
                side_effect=[bad_response, good_response]
            )

            req = GenerateThemeRequest(prompt="brutalist newsprint")
            persona, cost_usd, wcag = await generate_theme(req)

        assert persona.id == "minimal-mono"

    @pytest.mark.asyncio
    async def test_raises_422_after_two_failures(self) -> None:
        from fastapi import HTTPException

        from apps.api.domains.themes.schemas import GenerateThemeRequest
        from apps.api.domains.themes.service import generate_theme

        bad_block = MagicMock()
        bad_block.text = "still bad json {"
        bad_response = MagicMock()
        bad_response.content = [bad_block]
        bad_usage = MagicMock()
        bad_usage.input_tokens = 100
        bad_usage.output_tokens = 10
        bad_usage.cache_read_input_tokens = 0
        bad_usage.cache_creation_input_tokens = 100
        bad_response.usage = bad_usage

        with patch("apps.api.domains.themes.service.anthropic.AsyncAnthropic") as MockClient:
            instance = AsyncMock()
            MockClient.return_value = instance
            instance.messages.create = AsyncMock(return_value=bad_response)

            with pytest.raises(HTTPException) as exc_info:
                req = GenerateThemeRequest(prompt="cyberpunk midnight")
                await generate_theme(req)

        assert exc_info.value.status_code == 422

    @pytest.mark.xfail(
        reason="Vision path requires multimodal mock setup; skipped pending image test harness"
    )
    @pytest.mark.asyncio
    async def test_image_url_path(self) -> None:
        from apps.api.domains.themes.schemas import GenerateThemeRequest
        from apps.api.domains.themes.service import generate_theme

        req = GenerateThemeRequest(image_url="https://images.unsplash.com/photo-fake")
        persona, cost_usd, wcag = await generate_theme(req)
        assert persona is not None


# ── DB persistence test ───────────────────────────────────────────────────────

class TestPersistTheme:
    @pytest.mark.asyncio
    async def test_db_row_created(self) -> None:
        """persist_theme adds a row and returns it with a UUID pk."""
        from apps.api.domains.themes.schemas import GenerateThemeRequest, PersonaSchema
        from apps.api.domains.themes.service import persist_theme

        persona = PersonaSchema.model_validate(_PERSONA_JSON)
        req = GenerateThemeRequest(prompt="glacial ice palette", name="Glacial Ice")

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()

        row = await persist_theme(
            mock_db,
            user_id=uuid.uuid4(),
            req=req,
            persona=persona,
            cost_usd=0.001,
        )

        mock_db.add.assert_called_once()
        mock_db.flush.assert_awaited_once()
        assert row.name == "Glacial Ice"
        assert row.source_kind == "text"
        assert row.source_prompt == "glacial ice palette"
        assert isinstance(row.persona_json, dict)
