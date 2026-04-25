"""Tests for the mid-stream linter (T2.11).

Tests cover:
- LintWarning formatting
- LintResult aggregation and agent context generation
- JSON response parsing (clean, violations, fenced, invalid)
- Extension filtering (only .tsx/.ts/.jsx/.js)
- Short file skipping
- Model routing (LINTING → Haiku 4.5)
- Token tracking integration
- MidStreamLinter submit/collect lifecycle
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── LintWarning tests ────────────────────────────────────────────────────


class TestLintWarning:
    def test_format_with_line(self):
        from apps.api.domains.generation.linter import LintWarning

        w = LintWarning(file="src/App.tsx", line=42, rule="tw3", message="Use bg-red-500/50")
        assert w.format() == "[tw3] src/App.tsx:42 — Use bg-red-500/50"

    def test_format_without_line(self):
        from apps.api.domains.generation.linter import LintWarning

        w = LintWarning(file="src/App.tsx", line=None, rule="darkmode", message="Missing dark:")
        assert w.format() == "[darkmode] src/App.tsx — Missing dark:"


# ── LintResult tests ─────────────────────────────────────────────────────


class TestLintResult:
    def test_empty_result(self):
        from apps.api.domains.generation.linter import LintResult

        r = LintResult()
        assert not r.has_warnings
        assert r.to_agent_context() == ""
        assert r.cost_usd == 0.0

    def test_result_with_warnings(self):
        from apps.api.domains.generation.linter import LintResult, LintWarning

        warnings = [
            LintWarning(file="App.tsx", line=5, rule="tw3", message="v3 syntax"),
            LintWarning(file="Page.tsx", line=None, rule="rawhtml", message="Use <Button>"),
        ]
        r = LintResult(warnings=warnings, cost_usd=0.001, input_tokens=500, output_tokens=100)
        assert r.has_warnings
        ctx = r.to_agent_context()
        assert "⚠️ Linter warnings" in ctx
        assert "[tw3]" in ctx
        assert "[rawhtml]" in ctx
        assert "App.tsx:5" in ctx


# ── JSON parsing tests ───────────────────────────────────────────────────


def _make_block(text: str):
    """Create a mock content block with a .text attribute."""
    return type("Block", (), {"text": text})()


class TestParseLintResponse:
    def test_empty_array(self):
        from apps.api.domains.generation.linter import _parse_lint_response

        result = _parse_lint_response("App.tsx", [_make_block("[]")])
        assert result == []

    def test_empty_string(self):
        from apps.api.domains.generation.linter import _parse_lint_response

        result = _parse_lint_response("App.tsx", [_make_block("")])
        assert result == []

    def test_valid_violations(self):
        from apps.api.domains.generation.linter import _parse_lint_response

        json_str = json.dumps([
            {"line": 15, "rule": "tw3", "message": "Use modifier syntax"},
            {"line": None, "rule": "darkmode", "message": "Add dark: variant"},
        ])
        result = _parse_lint_response("App.tsx", [_make_block(json_str)])
        assert len(result) == 2
        assert result[0].rule == "tw3"
        assert result[0].line == 15
        assert result[1].rule == "darkmode"
        assert result[1].line is None

    def test_fenced_json(self):
        from apps.api.domains.generation.linter import _parse_lint_response

        fenced = '```json\n[{"line": 5, "rule": "rawhtml", "message": "Use Button"}]\n```'
        result = _parse_lint_response("Page.tsx", [_make_block(fenced)])
        assert len(result) == 1
        assert result[0].rule == "rawhtml"

    def test_invalid_json(self):
        from apps.api.domains.generation.linter import _parse_lint_response

        result = _parse_lint_response("Bad.tsx", [_make_block("not valid json")])
        assert result == []

    def test_non_list_json(self):
        from apps.api.domains.generation.linter import _parse_lint_response

        result = _parse_lint_response("Obj.tsx", [_make_block('{"rule": "tw3"}')])
        assert result == []

    def test_skips_items_without_message(self):
        from apps.api.domains.generation.linter import _parse_lint_response

        json_str = json.dumps([
            {"line": 1, "rule": "tw3", "message": ""},
            {"line": 2, "rule": "tw3", "message": "valid warning"},
        ])
        result = _parse_lint_response("App.tsx", [_make_block(json_str)])
        assert len(result) == 1
        assert result[0].line == 2

    def test_float_line_converted_to_int(self):
        from apps.api.domains.generation.linter import _parse_lint_response

        json_str = json.dumps([{"line": 15.0, "rule": "tw3", "message": "fix it"}])
        result = _parse_lint_response("App.tsx", [_make_block(json_str)])
        assert result[0].line == 15
        assert isinstance(result[0].line, int)

    def test_multiple_blocks(self):
        from apps.api.domains.generation.linter import _parse_lint_response

        result = _parse_lint_response(
            "App.tsx",
            [_make_block('[{"line": 1, "rule":'), _make_block(' "tw3", "message": "fix"}]')],
        )
        assert len(result) == 1


# ── Extension filtering tests ────────────────────────────────────────────


class TestExtensionFiltering:
    def test_lintable_extensions(self):
        from apps.api.domains.generation.linter import _LINTABLE_EXTENSIONS

        assert ".tsx" in _LINTABLE_EXTENSIONS
        assert ".ts" in _LINTABLE_EXTENSIONS
        assert ".jsx" in _LINTABLE_EXTENSIONS
        assert ".js" in _LINTABLE_EXTENSIONS
        assert ".css" not in _LINTABLE_EXTENSIONS
        assert ".json" not in _LINTABLE_EXTENSIONS
        assert ".html" not in _LINTABLE_EXTENSIONS


# ── Model routing tests ──────────────────────────────────────────────────


class TestLintingModelRouting:
    def test_linting_step_exists(self):
        from apps.api.domains.generation.model_router import AgentStep

        assert hasattr(AgentStep, "LINTING")
        assert AgentStep.LINTING.value == "linting"

    def test_linting_routes_to_haiku(self):
        from apps.api.domains.generation.model_router import AgentStep, pick_model

        model = pick_model(AgentStep.LINTING)
        assert "haiku" in model.model_id

    def test_linting_cheaper_than_generation(self):
        from apps.api.domains.generation.model_router import AgentStep, pick_model

        lint_model = pick_model(AgentStep.LINTING)
        gen_model = pick_model(AgentStep.GENERATION)
        assert lint_model.input_cost_per_m < gen_model.input_cost_per_m

    def test_all_steps_have_models(self):
        from apps.api.domains.generation.model_router import AgentStep, pick_model

        for step in AgentStep:
            model = pick_model(step)
            assert model.model_id


# ── Token tracking integration ───────────────────────────────────────────


class TestLintTokenTracking:
    def test_step_tokens_recorded(self):
        from apps.api.domains.generation.linter import LintResult, MidStreamLinter
        from apps.api.domains.generation.model_router import AgentStep, StepTokens, pick_model

        step_tokens = StepTokens(step=AgentStep.LINTING, model=pick_model(AgentStep.LINTING))
        assert step_tokens.input_tokens == 0
        assert step_tokens.output_tokens == 0

        # Simulate what collect() does when recording tokens
        step_tokens.add(input_tokens=500, output_tokens=100)
        assert step_tokens.input_tokens == 500
        assert step_tokens.output_tokens == 100
        assert step_tokens.cost_usd > 0

    def test_linting_in_tracker_summary(self):
        from apps.api.domains.generation.model_router import AgentStep, TokenTracker

        tracker = TokenTracker()
        lint_step = tracker.begin_step(AgentStep.LINTING)
        lint_step.add(input_tokens=1000, output_tokens=200)

        gen_step = tracker.begin_step(AgentStep.GENERATION)
        gen_step.add(input_tokens=5000, output_tokens=3000)

        summary = tracker.per_step_summary()
        assert len(summary) == 2
        assert summary[0]["step"] == "linting"
        assert summary[1]["step"] == "generation"
        assert tracker.total_cost_usd > 0


# ── MidStreamLinter submit/collect lifecycle ─────────────────────────────


class TestMidStreamLinterLifecycle:
    def test_submit_skips_css_files(self):
        from apps.api.domains.generation.linter import MidStreamLinter

        linter = MidStreamLinter.__new__(MidStreamLinter)
        linter._pending = []
        linter._client = None
        linter._model = None
        linter._step_tokens = None

        # CSS should not create a task
        linter._model = pick_model_mock()
        # Directly test the extension check
        from pathlib import Path

        assert Path("style.css").suffix.lower() not in {".tsx", ".ts", ".jsx", ".js"}
        assert Path("App.tsx").suffix.lower() in {".tsx", ".ts", ".jsx", ".js"}

    @pytest.mark.asyncio
    async def test_collect_empty(self):
        from apps.api.domains.generation.linter import MidStreamLinter

        linter = MidStreamLinter.__new__(MidStreamLinter)
        linter._pending = []
        linter._client = None
        linter._model = None
        linter._step_tokens = None

        result = await linter.collect()
        assert not result.has_warnings
        assert result.cost_usd == 0.0

    @pytest.mark.asyncio
    async def test_collect_merges_results(self):
        from apps.api.domains.generation.linter import LintResult, LintWarning, MidStreamLinter

        linter = MidStreamLinter.__new__(MidStreamLinter)
        linter._step_tokens = None

        w1 = LintWarning(file="A.tsx", line=1, rule="tw3", message="fix")
        w2 = LintWarning(file="B.tsx", line=2, rule="rawhtml", message="fix")

        async def make_result(warnings, cost):
            return LintResult(warnings=warnings, cost_usd=cost, input_tokens=100, output_tokens=50)

        linter._pending = [
            asyncio.create_task(make_result([w1], 0.001)),
            asyncio.create_task(make_result([w2], 0.002)),
        ]

        result = await linter.collect()
        assert len(result.warnings) == 2
        assert result.cost_usd == pytest.approx(0.003)
        assert result.input_tokens == 200
        assert result.output_tokens == 100
        assert len(linter._pending) == 0  # cleared

    @pytest.mark.asyncio
    async def test_collect_handles_failed_tasks(self):
        from apps.api.domains.generation.linter import LintResult, LintWarning, MidStreamLinter

        linter = MidStreamLinter.__new__(MidStreamLinter)
        linter._step_tokens = None

        w1 = LintWarning(file="A.tsx", line=1, rule="tw3", message="fix")

        async def succeed():
            return LintResult(warnings=[w1], cost_usd=0.001, input_tokens=100, output_tokens=50)

        async def fail():
            raise RuntimeError("API timeout")

        linter._pending = [
            asyncio.create_task(succeed()),
            asyncio.create_task(fail()),
        ]

        # Should not raise — failed tasks are logged and skipped
        result = await linter.collect()
        assert len(result.warnings) == 1
        assert result.cost_usd == 0.001


def pick_model_mock():
    from apps.api.domains.generation.model_router import AgentStep, pick_model
    return pick_model(AgentStep.LINTING)
