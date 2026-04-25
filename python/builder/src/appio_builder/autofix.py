"""AutoFix: re-prompt Claude to correct a broken AppSpec.

T2.7 — When esbuild (or codegen/scanner) produces a recoverable error, this
module sends the original spec + the error message back to Claude and asks
for a corrected spec.  The orchestrator calls :func:`attempt_autofix` in a
loop (max :data:`MAX_AUTOFIX_RETRIES` attempts).

Design decisions:

- **Synchronous** — the builder worker runs in a Dramatiq threadpool, so we
  use the sync ``anthropic.Anthropic`` client to keep it simple.
- **Separate model call** — the fix prompt is much shorter than the original
  generation prompt, so it costs a fraction.  We track the extra tokens /
  cost on the :class:`AutoFixAttempt` dataclass so callers can log it.
- **Minimal prompt** — we give Claude the full spec (so it has context) plus
  the error message, and ask it to return a corrected spec. We reuse the
  same JSON Schema constraint so the output is always structurally valid.
- **No streaming** — fix requests are much faster than generation and don't
  need real-time UI updates.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import anthropic
from pydantic import ValidationError

from appio_shared.constants import MAX_AUTOFIX_RETRIES
from appio_shared.schemas import AppSpec

__all__ = [
    "AutoFixAttempt",
    "AutoFixError",
    "AutoFixResult",
    "attempt_autofix",
]

log = logging.getLogger(__name__)

_MODEL_ID = "claude-sonnet-4-6"
_MAX_TOKENS = 8192
_TIMEOUT_S = 90.0

# Keep stderr excerpts short to save tokens
_MAX_ERROR_CHARS = 2000

_FIX_SYSTEM_PROMPT = """\
You are an expert React/TypeScript developer fixing a broken app specification.

You will receive:
1. The original AppSpec JSON that failed to build.
2. The error message from the build step (esbuild, code validation, or security scan).

Your task: return a CORRECTED AppSpec JSON that fixes the error while preserving
the user's intent as closely as possible.

Rules:
- Fix ONLY what is needed to resolve the error. Do not redesign the app.
- If the error is an esbuild syntax/type error, fix the JSX in the relevant
  component's render body.
- If the error is a forbidden-pattern violation, remove or rewrite the
  offending code without using any forbidden constructs.
- All JSX must be valid TypeScript JSX (not plain HTML).
- Never use: eval, dangerouslySetInnerHTML, innerHTML, document.write,
  window.location, importScripts, XMLHttpRequest, WebSocket, SharedArrayBuffer,
  or any Node.js modules (fs, net, child_process, crypto, path).
- All colors must be valid 6-digit hex (#RRGGBB).
- All routes must start with / and use lowercase kebab-case.
- Component JSX bodies must be ≤ 4000 characters.
- Return ONLY the corrected JSON. No explanation, no markdown fences.
"""


class AutoFixError(RuntimeError):
    """Raised when AutoFix exhausts all retries or hits a non-recoverable error."""

    def __init__(self, message: str, *, attempts: list[AutoFixAttempt]):
        super().__init__(message)
        self.attempts = attempts


@dataclass(frozen=True, slots=True)
class AutoFixAttempt:
    """Record of a single AutoFix attempt for logging / analytics."""

    retry_number: int
    input_tokens: int
    output_tokens: int
    cost_usd: float
    error_sent: str
    success: bool
    failure_reason: str | None = None


@dataclass(frozen=True, slots=True)
class AutoFixResult:
    """Returned when AutoFix produces a valid corrected spec."""

    spec: AppSpec
    attempts: list[AutoFixAttempt]
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float


# Claude API pricing (Sonnet 4.6)
_INPUT_COST_PER_M = 3.00
_OUTPUT_COST_PER_M = 15.00


def _compute_cost(input_tokens: int, output_tokens: int) -> float:
    return round(
        (input_tokens / 1_000_000) * _INPUT_COST_PER_M
        + (output_tokens / 1_000_000) * _OUTPUT_COST_PER_M,
        6,
    )


def attempt_autofix(
    *,
    spec: AppSpec,
    error_message: str,
    api_key: str,
    max_retries: int = MAX_AUTOFIX_RETRIES,
) -> AutoFixResult:
    """Try to fix a broken spec by re-prompting Claude.

    Parameters
    ----------
    spec:
        The original (broken) AppSpec.
    error_message:
        The build error (esbuild stderr, scanner findings, codegen error).
    api_key:
        Anthropic API key.
    max_retries:
        Maximum fix attempts (default from constants).

    Returns
    -------
    AutoFixResult
        Contains the corrected spec and token usage.

    Raises
    ------
    AutoFixError
        If all retries are exhausted without producing a valid spec.
    """
    client = anthropic.Anthropic(
        api_key=api_key,
        timeout=_TIMEOUT_S,
    )

    attempts: list[AutoFixAttempt] = []
    current_spec = spec
    current_error = error_message[:_MAX_ERROR_CHARS]

    for retry in range(1, max_retries + 1):
        log.info(
            "autofix_attempt",
            extra={
                "retry": retry,
                "max_retries": max_retries,
                "error_preview": current_error[:200],
                "template": current_spec.template,
            },
        )

        user_message = (
            f"## Original AppSpec (broken)\n\n"
            f"```json\n{current_spec.model_dump_json(indent=2, by_alias=True)}\n```\n\n"
            f"## Build Error\n\n"
            f"```\n{current_error}\n```\n\n"
            f"Return the corrected AppSpec JSON."
        )

        try:
            response = client.messages.create(
                model=_MODEL_ID,
                max_tokens=_MAX_TOKENS,
                system=_FIX_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )
        except anthropic.APIError as exc:
            log.warning("autofix_api_error", extra={"retry": retry, "error": str(exc)})
            attempts.append(AutoFixAttempt(
                retry_number=retry,
                input_tokens=0,
                output_tokens=0,
                cost_usd=0.0,
                error_sent=current_error[:500],
                success=False,
                failure_reason=f"API error: {exc}",
            ))
            continue

        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        cost = _compute_cost(input_tokens, output_tokens)

        # Extract text from response
        text = ""
        for block in response.content:
            if block.type == "text":
                text += block.text

        if not text.strip():
            log.warning("autofix_empty_response", extra={"retry": retry})
            attempts.append(AutoFixAttempt(
                retry_number=retry,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost,
                error_sent=current_error[:500],
                success=False,
                failure_reason="Empty response from Claude",
            ))
            continue

        # Parse JSON
        try:
            raw = json.loads(text)
        except json.JSONDecodeError as exc:
            log.warning(
                "autofix_json_parse_failed",
                extra={"retry": retry, "error": str(exc), "text_len": len(text)},
            )
            attempts.append(AutoFixAttempt(
                retry_number=retry,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost,
                error_sent=current_error[:500],
                success=False,
                failure_reason=f"JSON parse error: {exc}",
            ))
            # For the next retry, the error is the JSON parse failure
            current_error = f"Your previous fix attempt returned invalid JSON: {exc}"
            continue

        # Validate with Pydantic
        try:
            fixed_spec = AppSpec.model_validate(raw)
        except ValidationError as exc:
            log.warning(
                "autofix_validation_failed",
                extra={"retry": retry, "errors": exc.error_count()},
            )
            attempts.append(AutoFixAttempt(
                retry_number=retry,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost,
                error_sent=current_error[:500],
                success=False,
                failure_reason=f"Pydantic validation: {exc.error_count()} errors",
            ))
            # For the next retry, send the validation errors
            current_error = f"Your fix failed Pydantic validation:\n{exc}"
            current_spec = spec  # Reset to original spec
            continue

        log.info(
            "autofix_success",
            extra={
                "retry": retry,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": cost,
            },
        )
        attempts.append(AutoFixAttempt(
            retry_number=retry,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            error_sent=current_error[:500],
            success=True,
        ))

        total_in = sum(a.input_tokens for a in attempts)
        total_out = sum(a.output_tokens for a in attempts)
        return AutoFixResult(
            spec=fixed_spec,
            attempts=attempts,
            total_input_tokens=total_in,
            total_output_tokens=total_out,
            total_cost_usd=_compute_cost(total_in, total_out),
        )

    # All retries exhausted
    raise AutoFixError(
        f"AutoFix failed after {max_retries} attempts",
        attempts=attempts,
    )
