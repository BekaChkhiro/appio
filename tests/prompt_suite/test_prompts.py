"""Prompt engineering regression tests (T3.4).

Each test runs a prompt through the full pipeline:
    Claude API → JSON parse → Pydantic validation → CodeGenerator → esbuild → output validation

Tests are parametrized over :data:`PROMPT_FIXTURES`. Results are
collected by the ``ResultsCollector`` plugin and written to
``tests/prompt-suite/results/``.

Run the full suite::

    ANTHROPIC_API_KEY=sk-... pytest tests/prompt-suite/ -v --tb=short

Run a single fixture::

    pytest tests/prompt-suite/ --prompt-id=todo-simple -v

Skip esbuild (faster, tests Claude + codegen only)::

    pytest tests/prompt-suite/ --skip-esbuild -v

Skip browser validation (no Playwright needed)::

    pytest tests/prompt-suite/ --skip-browser -v
"""

from __future__ import annotations

from pathlib import Path

import pytest

from .conftest import record_result
from .fixtures import PROMPT_FIXTURES, PromptFixture
from .pipeline import PipelineResult, StageResult, run_prompt
from .validators import validate_manifest, validate_with_browser


@pytest.mark.prompt_suite
@pytest.mark.parametrize(
    "fixture",
    PROMPT_FIXTURES,
    ids=[f.id for f in PROMPT_FIXTURES],
)
def test_prompt_pipeline(
    fixture: PromptFixture,
    tmp_path: Path,
    skip_esbuild: bool,
    skip_browser: bool,
) -> None:
    """Run a prompt through the full generation pipeline and validate each stage."""

    # ── Run the pipeline ───────────────────────────────────────────────
    result: PipelineResult = run_prompt(
        fixture, tmp_path, skip_esbuild=skip_esbuild
    )

    # ── Browser + manifest validation (only if esbuild passed) ─────────
    dist_dir = tmp_path / "project" / "dist"
    if not skip_esbuild and result.passed and dist_dir.is_dir():
        # Manifest validation
        manifest_ok, manifest_err = validate_manifest(dist_dir)
        result.stages.append(
            StageResult(  # StageResult
                name="manifest_validation",
                passed=manifest_ok,
                duration_seconds=0.0,
                error=manifest_err,
            )
        )

        # Browser validation (Playwright)
        if not skip_browser:
            browser_result = validate_with_browser(dist_dir)
            if browser_result.error:
                # Playwright not available — record but don't fail
                result.stages.append(
                    StageResult(
                        name="browser_html_loads",
                        passed=True,
                        duration_seconds=0.0,
                        error=f"skipped: {browser_result.error}",
                    )
                )
            else:
                result.stages.append(
                    StageResult(
                        name="browser_html_loads",
                        passed=browser_result.html_loads,
                        duration_seconds=0.0,
                        error=None if browser_result.html_loads else "HTML failed to load",
                    )
                )
                result.stages.append(
                    StageResult(
                        name="browser_no_js_errors",
                        passed=browser_result.no_js_errors,
                        duration_seconds=0.0,
                        error=(
                            "; ".join(browser_result.js_errors[:3])
                            if not browser_result.no_js_errors
                            else None
                        ),
                    )
                )
                result.stages.append(
                    StageResult(
                        name="browser_not_blank",
                        passed=browser_result.not_blank,
                        duration_seconds=0.0,
                        error=(
                            f"visible text length: {browser_result.visible_text_length}"
                            if not browser_result.not_blank
                            else None
                        ),
                    )
                )
                result.stages.append(
                    StageResult(
                        name="browser_mobile_responsive",
                        passed=browser_result.mobile_responsive,
                        duration_seconds=0.0,
                        error=None if browser_result.mobile_responsive else "horizontal overflow detected",
                    )
                )

    # ── Record result for the dashboard ────────────────────────────────
    record_result(result.to_dict())

    # ── Assert pipeline passed ─────────────────────────────────────────
    if not result.passed:
        failed = result.failed_stage
        stage_data = next(
            (s for s in result.stages if not s.passed), None
        )
        error_detail = stage_data.error[:300] if stage_data and stage_data.error else "unknown"
        pytest.fail(
            f"[{fixture.id}] Pipeline failed at stage '{failed}': {error_detail}"
        )
