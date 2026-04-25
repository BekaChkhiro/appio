"""Tests for the generation domain (T1.6).

Tests cover:
- Schema validation
- System prompt loading
- Template context building
- Cost computation
- SSE event formatting
- Import chain integrity
"""

import json
import uuid

import pytest


# ── Schema tests ──────────────────────────────────────────────────────────


class TestGenerateRequest:
    def test_valid_request(self):
        from apps.api.domains.generation.schemas import GenerateRequest

        req = GenerateRequest(prompt="Build me a todo app")
        assert req.prompt == "Build me a todo app"
        assert req.app_id is None
        assert req.idempotency_key is None

    def test_prompt_min_length(self):
        from apps.api.domains.generation.schemas import GenerateRequest

        with pytest.raises(Exception):  # ValidationError
            GenerateRequest(prompt="ab")

    def test_prompt_max_length(self):
        from apps.api.domains.generation.schemas import GenerateRequest

        with pytest.raises(Exception):
            GenerateRequest(prompt="x" * 2001)

    def test_app_id_accepts_uuid(self):
        from apps.api.domains.generation.schemas import GenerateRequest

        uid = uuid.uuid4()
        req = GenerateRequest(prompt="Build me an app", app_id=uid)
        assert req.app_id == uid

    def test_app_id_accepts_uuid_string(self):
        from apps.api.domains.generation.schemas import GenerateRequest

        uid = uuid.uuid4()
        req = GenerateRequest(prompt="Build me an app", app_id=str(uid))
        assert req.app_id == uid

    def test_app_id_rejects_invalid_string(self):
        from apps.api.domains.generation.schemas import GenerateRequest

        with pytest.raises(Exception):
            GenerateRequest(prompt="Build me an app", app_id="not-a-uuid")

    def test_idempotency_key_max_length(self):
        from apps.api.domains.generation.schemas import GenerateRequest

        with pytest.raises(Exception):
            GenerateRequest(prompt="Build me an app", idempotency_key="k" * 129)


class TestSSEEvent:
    def test_minimal_event(self):
        from apps.api.domains.generation.schemas import SSEEvent

        event = SSEEvent(type="status")
        assert event.type == "status"
        assert event.message is None
        assert event.spec is None

    def test_full_event(self):
        from apps.api.domains.generation.schemas import SSEEvent, TokenUsage

        event = SSEEvent(
            type="complete",
            message="Done!",
            spec={"template": "todo"},
            generation_id="abc-123",
            tokens=TokenUsage(input_tokens=100, output_tokens=50, cost_usd=0.001),
        )
        assert event.tokens.input_tokens == 100


# ── Service unit tests ────────────────────────────────────────────────────


class TestLoadSystemPrompt:
    def test_loads_prompt_file(self):
        from apps.api.domains.generation.service import _load_system_prompt

        prompt = _load_system_prompt()
        assert isinstance(prompt, str)
        assert len(prompt) > 50
        assert "{templates}" in prompt

    def test_caching(self):
        from apps.api.domains.generation.service import _load_system_prompt

        p1 = _load_system_prompt()
        p2 = _load_system_prompt()
        assert p1 is p2  # same object = cached


class TestBuildTemplateContext:
    def test_no_templates(self):
        from apps.api.domains.generation.service import _build_template_context

        result = _build_template_context([])
        assert "No templates available" in result

    def test_with_mock_templates(self):
        from apps.api.domains.generation.service import _build_template_context
        from unittest.mock import MagicMock

        t1 = MagicMock()
        t1.id = "todo"
        t1.display_name = "To-Do List"
        t1.category = "productivity"
        t1.config_json = {"components": ["TaskList", "AddForm"]}

        t2 = MagicMock()
        t2.id = "notes"
        t2.display_name = "Notes App"
        t2.category = "productivity"
        t2.config_json = None

        result = _build_template_context([t1, t2])
        assert "todo" in result
        assert "To-Do List" in result
        assert "TaskList, AddForm" in result
        assert "notes" in result


class TestComputeCost:
    def test_zero_tokens(self):
        from apps.api.domains.generation.service import _compute_cost

        assert _compute_cost(0, 0) == 0.0

    def test_known_cost(self):
        from apps.api.domains.generation.service import _compute_cost

        # 1M input @ $3, 1M output @ $15 = $18
        cost = _compute_cost(1_000_000, 1_000_000)
        assert cost == 18.0

    def test_small_request(self):
        from apps.api.domains.generation.service import _compute_cost

        # 1000 input @ $3/M = $0.003, 500 output @ $15/M = $0.0075
        cost = _compute_cost(1000, 500)
        assert abs(cost - 0.0105) < 0.0001


class TestSSEFormatter:
    def test_status_event(self):
        from apps.api.domains.generation.service import _sse

        result = _sse("status", "Loading...")
        assert result.startswith("data: ")
        assert result.endswith("\n\n")
        payload = json.loads(result[6:])  # strip "data: "
        assert payload["type"] == "status"
        assert payload["message"] == "Loading..."
        assert "spec" not in payload

    def test_complete_event_with_spec(self):
        from apps.api.domains.generation.service import _sse

        spec = {"template": "todo", "name": "My Tasks"}
        result = _sse("complete", "Done!", spec=spec, generation_id="g-123")
        payload = json.loads(result[6:])
        assert payload["type"] == "complete"
        assert payload["spec"]["template"] == "todo"
        assert payload["generation_id"] == "g-123"

    def test_error_event(self):
        from apps.api.domains.generation.service import _sse

        result = _sse("error", "Something went wrong")
        payload = json.loads(result[6:])
        assert payload["type"] == "error"
        assert "went wrong" in payload["message"]

    def test_tokens_included(self):
        from apps.api.domains.generation.service import _sse

        tokens = {"input_tokens": 100, "output_tokens": 50, "cost_usd": 0.001}
        result = _sse("complete", "Done!", tokens=tokens)
        payload = json.loads(result[6:])
        assert payload["tokens"]["input_tokens"] == 100


# ── Import chain tests ────────────────────────────────────────────────────


class TestImports:
    def test_service_imports(self):
        from apps.api.domains.generation.service import GenerationService, _sse
        assert GenerationService is not None
        assert callable(_sse)

    def test_router_imports(self):
        from apps.api.domains.generation.router import router
        assert router is not None

    def test_schemas_imports(self):
        from apps.api.domains.generation.schemas import (
            GenerateRequest,
            SSEEvent,
            TokenUsage,
        )
        assert GenerateRequest is not None
        assert SSEEvent is not None
        assert TokenUsage is not None


# ── Model ID / config tests ──────────────────────────────────────────────


class TestServiceConfig:
    def test_model_id_valid(self):
        from apps.api.domains.generation.service import _MODEL_ID

        assert _MODEL_ID == "claude-sonnet-4-6"
        assert "20250514" not in _MODEL_ID  # no invalid snapshot suffix

    def test_timeout_is_float(self):
        from apps.api.domains.generation.service import _CLAUDE_TIMEOUT_S

        assert isinstance(_CLAUDE_TIMEOUT_S, float)
        assert _CLAUDE_TIMEOUT_S == 120.0

    def test_prompts_dir_exists(self):
        from apps.api.domains.generation.service import _PROMPTS_DIR

        assert _PROMPTS_DIR.exists()
        assert (_PROMPTS_DIR / "v1" / "system.md").exists()
