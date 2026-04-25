"""Mid-stream linter for agent-generated code.

Fires an async Haiku 4.5 lint check after every ``write_file`` call
during the agent tool-use loop. The linter runs in parallel with the
main agent turn — its warnings are collected and injected into the
*next* user message so the agent can self-correct without a full
AutoFix cycle.

Checks:
  - Tailwind v3 syntax (should be v4)
  - Missing imports from the UI component library
  - Hardcoded colors instead of Tailwind classes
  - Missing dark mode variants
  - Naked HTML elements instead of library components (e.g. <button>
    instead of <Button>)
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import anthropic
import structlog

from apps.api.config import settings
from apps.api.domains.generation.model_router import (
    AgentStep,
    StepTokens,
    pick_model,
)

logger = structlog.stdlib.get_logger()

# Only lint files the agent is likely to write application code into.
_LINTABLE_EXTENSIONS = {".tsx", ".ts", ".jsx", ".js"}

# Library components the agent should use instead of raw HTML.
_UI_COMPONENTS = {
    "Screen", "AppBar", "Button", "IconButton", "Card", "ListItem",
    "FAB", "BottomSheet", "Input", "TextArea", "SegmentedControl",
    "EmptyState", "TabBar", "ThemeProvider",
}

_LINT_SYSTEM_PROMPT = """\
You are a code linter for React + TypeScript + Tailwind CSS v4 PWAs.
You receive a single source file and must report violations ONLY from the
checklist below.  Be precise and terse — no explanations, no praise.

Return a JSON array of violation objects. If the file is clean, return [].

Each violation:
{"line": <approx line number or null>, "rule": "<rule_id>", "message": "<one-line fix>"}

## Rules

tw3: Tailwind v3 syntax used in v4 project.
  Violations: bg-opacity-*, text-opacity-*, @apply outside @layer,
  ring-opacity-*, divide-opacity-*, placeholder-opacity-*.
  Fix: use modifier syntax (e.g. bg-indigo-500/80).

import: Missing or wrong import from UI component library.
  The library exports from "./components/ui": Screen, AppBar, Button,
  IconButton, Card, ListItem, FAB, BottomSheet, Input, TextArea,
  SegmentedControl, EmptyState, TabBar, ThemeProvider, useTheme,
  and icons (PlusIcon, CheckIcon, etc.) from the same barrel.
  If a component is used in JSX but not imported, flag it.

hardcoded: Hardcoded color values in className strings.
  Violations: inline hex (#xxx, #xxxxxx), rgb(), rgba(), hsl() inside
  className. Fix: use Tailwind color utilities.

darkmode: Missing dark: variant on visible elements.
  If a component sets bg-*, text-*, or border-* without a corresponding
  dark: variant, flag it.  Exceptions: transparent, inherit, current.

rawhtml: Naked HTML element where a library component exists.
  Violations: <button (use <Button>), <input (use <Input>),
  <textarea (use <TextArea>).
  Exception: elements inside the library component files themselves.

Only report CLEAR violations — do not flag ambiguous cases.\
"""

# Cap lint cost: short content, low max_tokens.
_LINT_MAX_TOKENS = 1024


@dataclass
class LintWarning:
    """A single lint violation found in a file."""

    file: str
    line: int | None
    rule: str
    message: str

    def format(self) -> str:
        loc = f":{self.line}" if self.line else ""
        return f"[{self.rule}] {self.file}{loc} — {self.message}"


@dataclass
class LintResult:
    """Aggregated lint result for one or more files."""

    warnings: list[LintWarning] = field(default_factory=list)
    cost_usd: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def has_warnings(self) -> bool:
        return len(self.warnings) > 0

    def to_agent_context(self) -> str:
        """Format warnings for injection into the next agent turn."""
        if not self.warnings:
            return ""
        lines = ["⚠️ Linter warnings (fix in your next write_file):"]
        for w in self.warnings:
            lines.append(f"  • {w.format()}")
        return "\n".join(lines)


class MidStreamLinter:
    """Async linter that fires Haiku 4.5 checks in the background.

    Usage inside the agent loop::

        linter = MidStreamLinter()

        # After each write_file tool execution:
        linter.submit(file_path, file_content)

        # Before building the next user message for Claude:
        result = await linter.collect()
        if result.has_warnings:
            inject result.to_agent_context() into the tool_results
    """

    def __init__(self, step_tokens: StepTokens | None = None) -> None:
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            timeout=30.0,
        )
        self._model = pick_model(AgentStep.LINTING)
        self._pending: list[asyncio.Task[LintResult]] = []
        self._step_tokens = step_tokens

    def submit(self, file_path: str, content: str) -> None:
        """Queue an async lint check for a written file.

        Only lints application code (.tsx/.ts/.jsx/.js). Skips config
        files, CSS, JSON, etc.
        """
        ext = Path(file_path).suffix.lower()
        if ext not in _LINTABLE_EXTENSIONS:
            return
        # Skip very short files (likely just re-exports or stubs).
        if len(content) < 50:
            return
        task = asyncio.create_task(
            self._lint_file(file_path, content),
            name=f"lint:{file_path}",
        )
        self._pending.append(task)

    async def collect(self) -> LintResult:
        """Await all pending lint tasks and return aggregated result.

        Safe to call even if no tasks were submitted (returns empty).
        Errors in individual lint calls are logged and skipped.
        """
        if not self._pending:
            return LintResult()

        results = await asyncio.gather(*self._pending, return_exceptions=True)
        self._pending.clear()

        merged = LintResult()
        for r in results:
            if isinstance(r, LintResult):
                merged.warnings.extend(r.warnings)
                merged.cost_usd += r.cost_usd
                merged.input_tokens += r.input_tokens
                merged.output_tokens += r.output_tokens
            elif isinstance(r, BaseException):
                logger.warning("lint_task_failed", error=str(r))

        # Record tokens in the shared tracker if available.
        if self._step_tokens and (merged.input_tokens or merged.output_tokens):
            self._step_tokens.add(
                input_tokens=merged.input_tokens,
                output_tokens=merged.output_tokens,
            )

        return merged

    async def _lint_file(self, file_path: str, content: str) -> LintResult:
        """Send a single file to Haiku 4.5 for lint checking."""
        # Truncate very large files to keep lint fast and cheap.
        if len(content) > 12_000:
            content = content[:12_000] + "\n// ... (truncated for linting)"

        user_message = f"File: `{file_path}`\n\n```tsx\n{content}\n```"

        try:
            response = await self._client.messages.create(
                model=self._model.model_id,
                max_tokens=_LINT_MAX_TOKENS,
                system=_LINT_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )
        except Exception as exc:
            logger.warning("lint_api_call_failed", file=file_path, error=str(exc))
            return LintResult()

        cost = self._model.compute_cost(
            response.usage.input_tokens,
            response.usage.output_tokens,
        )

        warnings = _parse_lint_response(file_path, response.content)

        return LintResult(
            warnings=warnings,
            cost_usd=cost,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )


def _parse_lint_response(
    file_path: str,
    content_blocks: list[Any],
) -> list[LintWarning]:
    """Extract LintWarning list from Claude's response."""
    import json as _json

    text = ""
    for block in content_blocks:
        if hasattr(block, "text"):
            text += block.text

    text = text.strip()

    # Claude may wrap the JSON in markdown fences.
    if text.startswith("```"):
        # Strip ```json ... ``` wrapper
        lines = text.split("\n")
        lines = [ln for ln in lines if not ln.startswith("```")]
        text = "\n".join(lines).strip()

    if not text or text == "[]":
        return []

    # Haiku sometimes appends explanatory text after the JSON array.
    # Try to extract just the JSON array portion.
    try:
        items = _json.loads(text)
    except _json.JSONDecodeError:
        # Find the first '[' and its matching ']'
        start = text.find("[")
        if start != -1:
            bracket_depth = 0
            for i, ch in enumerate(text[start:], start):
                if ch == "[":
                    bracket_depth += 1
                elif ch == "]":
                    bracket_depth -= 1
                    if bracket_depth == 0:
                        try:
                            items = _json.loads(text[start : i + 1])
                            break
                        except _json.JSONDecodeError:
                            pass
            else:
                return []
        else:
            return []

    if not isinstance(items, list):
        return []

    warnings: list[LintWarning] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        rule = item.get("rule", "unknown")
        message = item.get("message", "")
        line = item.get("line")
        line = int(line) if isinstance(line, (int, float)) else None
        if message:
            warnings.append(
                LintWarning(file=file_path, line=line, rule=rule, message=message)
            )

    return warnings
