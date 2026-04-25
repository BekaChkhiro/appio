"""End-to-end pipeline runner for prompt engineering tests (T3.4).

DEPRECATED (T2.2b): This module still runs the spec-based pipeline
(Claude → JSON spec → CodeGenerator → esbuild) for regression testing.
T3.4 will migrate this to the agent pipeline (AgentService tool-use loop
→ esbuild → output validation) which is now the sole production path.

Current pipeline (kept as regression):
    Claude API → Pydantic validation → CodeGenerator → esbuild

Each stage is tracked independently so the test reporter can show
exactly where failures occur. The runner does NOT upload to R2 or
update KV — it stops after validating the esbuild output.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path

import anthropic
from pydantic import ValidationError

from appio_codegen import CodeGenerator
from appio_codegen.generator import CodegenError
from appio_codegen.sanitizer import UnsafeContentError
from appio_shared.schemas import AppSpec

from .fixtures import PromptFixture

__all__ = ["PipelineResult", "StageResult", "run_prompt"]

# Paths
_REPO_ROOT = Path(__file__).resolve().parents[2]
_TEMPLATES_DIR = _REPO_ROOT / "packages" / "templates"
_PROMPTS_DIR = _REPO_ROOT / "packages" / "prompts"

# Claude config
_MODEL_ID = "claude-sonnet-4-6"
_MAX_TOKENS = 16384
_TIMEOUT_S = 300.0


@dataclass
class StageResult:
    """Result of a single pipeline stage."""

    name: str
    passed: bool
    duration_seconds: float = 0.0
    error: str | None = None


@dataclass
class PipelineResult:
    """Aggregated result of a full pipeline run."""

    fixture_id: str
    template: str
    prompt: str
    stages: list[StageResult] = field(default_factory=list)
    spec_json: dict | None = None
    total_duration_seconds: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0

    @property
    def passed(self) -> bool:
        return all(s.passed for s in self.stages)

    @property
    def failed_stage(self) -> str | None:
        for s in self.stages:
            if not s.passed:
                return s.name
        return None

    def to_dict(self) -> dict:
        return {
            "fixture_id": self.fixture_id,
            "template": self.template,
            "passed": self.passed,
            "failed_stage": self.failed_stage,
            "stages": [
                {
                    "name": s.name,
                    "passed": s.passed,
                    "duration_seconds": round(s.duration_seconds, 3),
                    "error": s.error,
                }
                for s in self.stages
            ],
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cost_usd": self.cost_usd,
            "total_duration_seconds": round(self.total_duration_seconds, 3),
        }


def _load_system_prompt() -> str:
    """Load the system prompt and inject template context."""
    prompt_path = _PROMPTS_DIR / "v1" / "system.md"
    system_prompt = prompt_path.read_text(encoding="utf-8")

    # Build template context from config files — include prop schemas so
    # Claude knows exactly which props are allowed per component.
    lines: list[str] = []
    for template_dir in sorted(_TEMPLATES_DIR.iterdir()):
        config_path = template_dir / "template.config.json"
        if not config_path.is_file():
            continue
        config = json.loads(config_path.read_text(encoding="utf-8"))
        tid = config.get("id", template_dir.name)
        display = config.get("displayName", tid)
        category = config.get("category", "general")
        components = config.get("components", [])
        prop_schemas = config.get("propSchemas", {})

        comp_str = f" — components: {', '.join(components)}" if components else ""
        lines.append(f"- **{tid}** ({display}, category: {category}){comp_str}")

        # Add prop schemas per component
        if prop_schemas:
            for comp_name in components:
                props = prop_schemas.get(comp_name, {})
                if props:
                    prop_list = ", ".join(f"`{k}` ({v})" for k, v in props.items())
                    lines.append(f"  - {comp_name} props: {prop_list}")

    template_context = "\n".join(lines) if lines else "(No templates available yet.)"
    return system_prompt.replace("{templates}", template_context)


def _call_claude(prompt: str, system_prompt: str) -> tuple[str, int, int]:
    """Call Claude API synchronously and return (text, input_tokens, output_tokens).

    Uses the same configuration as the production GenerationService:
    - Adaptive thinking for better reasoning
    - Forced JSON schema via output_config (guarantees valid JSON structure)
    """
    from appio_shared.schemas import app_spec_json_schema

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY not set — required for prompt suite tests"
        )

    client = anthropic.Anthropic(api_key=api_key, timeout=_TIMEOUT_S)
    # Note: We use json_schema output format WITHOUT thinking.
    # When thinking is combined with json_schema, Claude may consume all
    # tokens on thinking and return no text. The production service uses
    # streaming which handles this differently, but for synchronous tests
    # we rely on the schema enforcement alone (which is sufficient).
    response = client.messages.create(
        model=_MODEL_ID,
        max_tokens=_MAX_TOKENS,
        output_config={
            "format": {
                "type": "json_schema",
                "schema": app_spec_json_schema(),
            },
        },
        system=system_prompt,
        messages=[{"role": "user", "content": prompt}],
    )

    # Extract text content (skip thinking blocks)
    collected = ""
    for block in response.content:
        if block.type == "text":
            collected += block.text

    return (
        collected,
        response.usage.input_tokens,
        response.usage.output_tokens,
    )


def run_prompt(
    fixture: PromptFixture,
    build_dir: Path,
    *,
    skip_esbuild: bool = False,
) -> PipelineResult:
    """Run a single prompt through the full pipeline.

    Args:
        fixture: The test prompt fixture.
        build_dir: Temp directory for the generated project.
        skip_esbuild: If True, skip the esbuild stage (useful when Node
            is not available in the test environment).

    Returns:
        A :class:`PipelineResult` with per-stage pass/fail data.
    """
    result = PipelineResult(
        fixture_id=fixture.id,
        template=fixture.template,
        prompt=fixture.prompt,
    )
    overall_start = time.monotonic()
    system_prompt = _load_system_prompt()

    # ── Stage 1: Claude API ────────────────────────────────────────────
    t0 = time.monotonic()
    try:
        raw_text, in_tok, out_tok = _call_claude(fixture.prompt, system_prompt)
        result.input_tokens = in_tok
        result.output_tokens = out_tok
        result.cost_usd = round(
            (in_tok / 1_000_000) * 3.00 + (out_tok / 1_000_000) * 15.00, 6
        )
        result.stages.append(
            StageResult("claude_api", True, time.monotonic() - t0)
        )
    except Exception as exc:
        result.stages.append(
            StageResult("claude_api", False, time.monotonic() - t0, str(exc))
        )
        result.total_duration_seconds = time.monotonic() - overall_start
        return result

    # ── Stage 2: JSON parse ────────────────────────────────────────────
    t0 = time.monotonic()
    try:
        spec_dict = json.loads(raw_text)
        result.spec_json = spec_dict
        result.stages.append(
            StageResult("json_parse", True, time.monotonic() - t0)
        )
    except json.JSONDecodeError as exc:
        result.stages.append(
            StageResult(
                "json_parse",
                False,
                time.monotonic() - t0,
                f"{exc.msg} at pos {exc.pos} (raw length={len(raw_text)})",
            )
        )
        result.total_duration_seconds = time.monotonic() - overall_start
        return result

    # ── Stage 3: Pydantic validation ───────────────────────────────────
    t0 = time.monotonic()
    try:
        spec = AppSpec.model_validate(spec_dict)
        # Sanity: check minimum pages
        if len(spec.pages) < fixture.min_pages:
            raise ValueError(
                f"expected >= {fixture.min_pages} pages, got {len(spec.pages)}"
            )
        result.stages.append(
            StageResult("pydantic_validation", True, time.monotonic() - t0)
        )
    except (ValidationError, ValueError) as exc:
        result.stages.append(
            StageResult(
                "pydantic_validation",
                False,
                time.monotonic() - t0,
                str(exc)[:500],
            )
        )
        result.total_duration_seconds = time.monotonic() - overall_start
        return result

    # ── Stage 4: Code generation ───────────────────────────────────────
    t0 = time.monotonic()
    try:
        codegen = CodeGenerator(_TEMPLATES_DIR)
        project_dir = codegen.generate(spec, build_dir / "project")
        result.stages.append(
            StageResult("codegen", True, time.monotonic() - t0)
        )
    except (CodegenError, UnsafeContentError) as exc:
        result.stages.append(
            StageResult("codegen", False, time.monotonic() - t0, str(exc)[:500])
        )
        result.total_duration_seconds = time.monotonic() - overall_start
        return result

    # ── Stage 5: esbuild ───────────────────────────────────────────────
    if skip_esbuild:
        result.stages.append(StageResult("esbuild", True, 0.0))
    else:
        import shutil
        import subprocess

        from appio_builder.local_runner import LocalRunnerError, run_esbuild

        # Install node_modules if missing (in production these are
        # pre-installed in the Docker image, but locally we need npm).
        if not (project_dir / "node_modules").is_dir() and shutil.which("npm"):
            subprocess.run(
                ["npm", "install", "--no-audit", "--no-fund"],
                cwd=str(project_dir),
                capture_output=True,
                timeout=60,
                check=False,
            )

        config_script = _TEMPLATES_DIR / "base" / "esbuild.config.mjs"
        t0 = time.monotonic()
        try:
            build_result = run_esbuild(
                project_dir, config_script=config_script, timeout_seconds=60
            )
            result.stages.append(
                StageResult("esbuild", True, time.monotonic() - t0)
            )
        except LocalRunnerError as exc:
            result.stages.append(
                StageResult(
                    "esbuild",
                    False,
                    time.monotonic() - t0,
                    f"{exc}\n{exc.stderr[:1000]}",
                )
            )
            result.total_duration_seconds = time.monotonic() - overall_start
            return result

        # ── Stage 6: Output validation ─────────────────────────────────
        from appio_builder.validation import (
            OutputValidationError,
            validate_output,
        )

        t0 = time.monotonic()
        try:
            validated = validate_output(build_result.dist_dir)
            # Extra checks
            if validated.file_count == 0:
                raise OutputValidationError("dist/ is empty")
            result.stages.append(
                StageResult("output_validation", True, time.monotonic() - t0)
            )
        except OutputValidationError as exc:
            result.stages.append(
                StageResult(
                    "output_validation",
                    False,
                    time.monotonic() - t0,
                    str(exc),
                )
            )
            result.total_duration_seconds = time.monotonic() - overall_start
            return result

    result.total_duration_seconds = time.monotonic() - overall_start
    return result
