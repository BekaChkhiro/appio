"""Tests for the AutoFix module (T2.7).

These tests use mocked Claude API responses — no real API calls needed.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from appio_builder.autofix import (
    AutoFixError,
    AutoFixResult,
    attempt_autofix,
)
from appio_shared.schemas import AppSpec


def _make_spec(**overrides) -> AppSpec:
    """Build a minimal valid AppSpec for testing."""
    base = {
        "template": "todo-list",
        "name": "Test App",
        "theme": {
            "primary": "#3B82F6",
            "primaryLight": "#93C5FD",
            "background": "#FFFFFF",
            "surface": "#F3F4F6",
            "textPrimary": "#111827",
            "textSecondary": "#6B7280",
        },
        "pages": [
            {
                "route": "/",
                "title": "Home",
                "layout": "stack",
                "components": [
                    {
                        "type": "text",
                        "props": {"content": "Hello"},
                    }
                ],
            }
        ],
        "dataModel": [],
    }
    base.update(overrides)
    return AppSpec.model_validate(base)


def _mock_claude_response(spec_dict: dict, input_tokens: int = 100, output_tokens: int = 200):
    """Build a mock Anthropic messages.create() response."""
    mock = MagicMock()
    mock.usage.input_tokens = input_tokens
    mock.usage.output_tokens = output_tokens
    mock.content = [MagicMock(type="text", text=json.dumps(spec_dict))]
    return mock


class TestAttemptAutofix:
    def test_successful_fix(self) -> None:
        """AutoFix returns a corrected spec on first retry."""
        original = _make_spec()
        fixed_dict = original.model_dump(by_alias=True)
        # Simulate a trivial "fix": change the name
        fixed_dict["name"] = "Fixed App"

        with patch("appio_builder.autofix.anthropic.Anthropic") as MockClient:
            instance = MockClient.return_value
            instance.messages.create.return_value = _mock_claude_response(fixed_dict)

            result = attempt_autofix(
                spec=original,
                error_message="esbuild failed: SyntaxError",
                api_key="test-key",
                max_retries=1,
            )

        assert isinstance(result, AutoFixResult)
        assert result.spec.name == "Fixed App"
        assert len(result.attempts) == 1
        assert result.attempts[0].success is True
        assert result.total_input_tokens == 100
        assert result.total_output_tokens == 200

    def test_exhausts_retries(self) -> None:
        """AutoFix raises AutoFixError after max retries."""
        original = _make_spec()

        with patch("appio_builder.autofix.anthropic.Anthropic") as MockClient:
            instance = MockClient.return_value
            # Return invalid JSON each time
            bad_response = MagicMock()
            bad_response.usage.input_tokens = 50
            bad_response.usage.output_tokens = 50
            bad_response.content = [MagicMock(type="text", text="not valid json")]
            instance.messages.create.return_value = bad_response

            with pytest.raises(AutoFixError) as exc_info:
                attempt_autofix(
                    spec=original,
                    error_message="esbuild failed",
                    api_key="test-key",
                    max_retries=2,
                )

        assert len(exc_info.value.attempts) == 2
        assert all(not a.success for a in exc_info.value.attempts)

    def test_validation_error_retries(self) -> None:
        """AutoFix retries when Claude returns structurally invalid spec."""
        original = _make_spec()
        # First response: invalid (missing required fields)
        bad_dict = {"template": "todo-list"}
        # Second response: valid
        good_dict = original.model_dump(by_alias=True)
        good_dict["name"] = "Fixed"

        with patch("appio_builder.autofix.anthropic.Anthropic") as MockClient:
            instance = MockClient.return_value
            instance.messages.create.side_effect = [
                _mock_claude_response(bad_dict),
                _mock_claude_response(good_dict),
            ]

            result = attempt_autofix(
                spec=original,
                error_message="build error",
                api_key="test-key",
                max_retries=2,
            )

        assert result.spec.name == "Fixed"
        assert len(result.attempts) == 2
        assert result.attempts[0].success is False
        assert result.attempts[1].success is True

    def test_api_error_handled(self) -> None:
        """API errors are caught and recorded as failed attempts."""
        import anthropic

        original = _make_spec()

        with patch("appio_builder.autofix.anthropic.Anthropic") as MockClient:
            instance = MockClient.return_value
            instance.messages.create.side_effect = anthropic.APIError(
                message="rate limited",
                request=MagicMock(),
                body=None,
            )

            with pytest.raises(AutoFixError) as exc_info:
                attempt_autofix(
                    spec=original,
                    error_message="build error",
                    api_key="test-key",
                    max_retries=1,
                )

        assert len(exc_info.value.attempts) == 1
        assert "API error" in (exc_info.value.attempts[0].failure_reason or "")
