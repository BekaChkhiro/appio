"""Agent-based pipeline runner for the composite end-to-end test (T2.15).

Runs the full agent generation pipeline locally — planning, RAG retrieval,
Claude tool-use loop, mid-stream linting, vision critique, fix pass, and
esbuild build — without requiring a database, R2 upload, or KV deployment.

This replaces the deprecated spec-based ``pipeline.py`` for all new tests
that need to validate the production agent path.

Pipeline:

    1. Set up workspace from golden cache / base template
    2. Planning step (Sonnet 4.6 → structured plan)
    3. RAG retrieval (Voyage AI → pgvector, best-effort)
    4. Agent tool-use loop (Sonnet 4.6 with tools)
    5. Mid-stream linting (Haiku 4.5, parallel)
    6. Vision critique (screenshots → Sonnet 4.6 review)
    7. Fix pass (Haiku 4.5, conditional on critique score < 8)
    8. Output validation (esbuild build already happened inside the loop)
"""

from __future__ import annotations

import asyncio
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import structlog

from apps.api.domains.generation.agent_service import (
    AgentService,
    _AGENT_GLOBAL_CSS,
    _AGENT_INDEX_HTML,
    _BASE_TEMPLATE,
    _GOLDEN_WORKSPACE,
    _MAX_FIX_PASS_ITERATIONS,
    _MAX_TOOL_ITERATIONS,
    _TOOLS,
    _load_agent_system_prompt,
    _with_cache_breakpoint,
)
from apps.api.domains.generation.critique import (
    CritiqueError,
    CritiqueResult,
    request_critique,
)
from apps.api.domains.generation.linter import MidStreamLinter
from apps.api.domains.generation.model_router import (
    AgentStep,
    TokenTracker,
    pick_model,
)
from apps.api.domains.generation.planning import (
    PlanningError,
    PlanResult,
    generate_plan,
)
from apps.api.domains.generation.screenshot import (
    ScreenshotError,
    capture_app_screenshots,
)

from .fixtures import PromptFixture

logger = structlog.stdlib.get_logger()

__all__ = ["AgentPipelineResult", "AgentStageResult", "run_agent_prompt"]


def _has_buildable_source(workspace: Path) -> bool:
    """Check if the workspace has source files that can be built.

    Looks for .tsx files in src/ (the agent may name the entry point
    App.tsx, app.tsx, index.tsx, or something else entirely).
    """
    src_dir = workspace / "src"
    if not src_dir.is_dir():
        return False
    return any(src_dir.rglob("*.tsx"))


@dataclass
class AgentStageResult:
    """Result of a single agent pipeline stage."""

    name: str
    passed: bool
    duration_seconds: float = 0.0
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentPipelineResult:
    """Aggregated result of a full agent pipeline run."""

    fixture_id: str
    template: str
    prompt: str
    stages: list[AgentStageResult] = field(default_factory=list)
    total_duration_seconds: float = 0.0
    cost_usd: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    iterations: int = 0
    plan: PlanResult | None = None
    critique: CritiqueResult | None = None
    per_step_summary: list[dict[str, Any]] = field(default_factory=list)

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
                    "metadata": s.metadata,
                }
                for s in self.stages
            ],
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cost_usd": round(self.cost_usd, 6),
            "iterations": self.iterations,
            "total_duration_seconds": round(self.total_duration_seconds, 3),
            "per_step_summary": self.per_step_summary,
            "critique_score": (
                self.critique.overall_score if self.critique else None
            ),
        }


def _setup_workspace_standalone(workspace: Path) -> None:
    """Set up a workspace without requiring an AgentService instance.

    Copies from the golden cache if available, otherwise falls back to
    the base template + npm install.
    """
    AgentService._setup_workspace(workspace)


async def run_agent_prompt(
    fixture: PromptFixture,
    build_dir: Path,
    *,
    skip_vision: bool = False,
    skip_rag: bool = False,
) -> AgentPipelineResult:
    """Run a single prompt through the full agent pipeline.

    This exercises all composite pipeline components (T2.9-T2.14):
    - Multi-model router (T2.9)
    - Planning service (T2.10)
    - Mid-stream linter (T2.11)
    - RAG retrieval (T2.12/T2.13)
    - Pre-warmed workspace (T2.14)

    Does NOT require a database or cloud services. Runs entirely locally
    except for Claude API calls and optional Voyage AI (RAG).

    Args:
        fixture: The test prompt fixture.
        build_dir: Temp directory for the workspace.
        skip_vision: Skip the screenshot + critique pass.
        skip_rag: Skip RAG retrieval (avoids Voyage AI dependency).

    Returns:
        An AgentPipelineResult with per-stage metrics.
    """
    import anthropic

    from apps.api.config import settings

    result = AgentPipelineResult(
        fixture_id=fixture.id,
        template=fixture.template,
        prompt=fixture.prompt,
    )
    overall_start = time.monotonic()
    tracker = TokenTracker()

    workspace = build_dir / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)

    # ── Stage 1: Workspace setup ──────────────────────────────────────
    t0 = time.monotonic()
    try:
        await asyncio.to_thread(_setup_workspace_standalone, workspace)
        elapsed = time.monotonic() - t0
        result.stages.append(
            AgentStageResult("workspace_setup", True, elapsed)
        )
    except Exception as exc:
        elapsed = time.monotonic() - t0
        result.stages.append(
            AgentStageResult("workspace_setup", False, elapsed, str(exc)[:500])
        )
        result.total_duration_seconds = time.monotonic() - overall_start
        return result

    # ── Stage 2: Planning (Sonnet 4.6, structured output) ─────────────
    t0 = time.monotonic()
    agent_prompt = fixture.prompt
    try:
        plan_step = tracker.begin_step(AgentStep.PLANNING)
        plan_result = await generate_plan(fixture.prompt, plan_step)
        agent_prompt = plan_result.to_agent_message(fixture.prompt)
        result.plan = plan_result
        elapsed = time.monotonic() - t0
        result.stages.append(
            AgentStageResult(
                "planning",
                True,
                elapsed,
                metadata={
                    "app_name": plan_result.app_name,
                    "screens": len(plan_result.screens),
                    "files": len(plan_result.files_to_create),
                    "cost_usd": plan_result.cost_usd,
                },
            )
        )
    except PlanningError as exc:
        elapsed = time.monotonic() - t0
        # Planning is best-effort — don't fail the run.
        result.stages.append(
            AgentStageResult(
                "planning",
                True,  # still pass — planning is optional
                elapsed,
                error=f"skipped: {exc}",
            )
        )

    # ── Stage 3: RAG retrieval ────────────────────────────────────────
    rag_snippets_text = ""
    if not skip_rag:
        t0 = time.monotonic()
        try:
            from apps.api.domains.generation.rag import (
                format_snippets_for_prompt,
                retrieve_snippets,
            )

            # RAG needs a DB session factory — initialize if needed.
            import os

            from appio_db import get_session_factory, init_db

            try:
                session_factory = get_session_factory()
            except RuntimeError:
                # DB not initialized yet — init from DATABASE_URL
                db_url = os.environ.get("DATABASE_URL", "")
                if not db_url:
                    raise RuntimeError("DATABASE_URL not set — required for RAG")
                init_db(db_url, is_neon=True)
                session_factory = get_session_factory()
            snippets = await retrieve_snippets(
                user_prompt=fixture.prompt,
                session_factory=session_factory,
                top_k=5,
            )
            rag_snippets_text = format_snippets_for_prompt(snippets)
            elapsed = time.monotonic() - t0
            result.stages.append(
                AgentStageResult(
                    "rag_retrieval",
                    True,
                    elapsed,
                    metadata={
                        "snippet_count": len(snippets),
                        "top_score": round(snippets[0].score, 3) if snippets else 0,
                    },
                )
            )
        except Exception as exc:
            elapsed = time.monotonic() - t0
            # RAG is best-effort — don't fail the run.
            result.stages.append(
                AgentStageResult(
                    "rag_retrieval",
                    True,
                    elapsed,
                    error=f"skipped: {exc}",
                )
            )
    else:
        result.stages.append(
            AgentStageResult("rag_retrieval", True, 0.0, error="skipped: --skip-rag")
        )

    # ── Stage 4: Agent tool-use loop (with mid-stream linting) ────────
    t0 = time.monotonic()
    client = anthropic.AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        timeout=600.0,
    )

    system_blocks: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": _load_agent_system_prompt(),
            "cache_control": {"type": "ephemeral"},
        }
    ]
    if rag_snippets_text:
        system_blocks.append({
            "type": "text",
            "text": rag_snippets_text,
            "cache_control": {"type": "ephemeral"},
        })

    messages: list[dict[str, Any]] = [
        {"role": "user", "content": agent_prompt},
    ]

    # Mid-stream linter (Haiku 4.5, parallel)
    lint_step = tracker.begin_step(AgentStep.LINTING)
    linter = MidStreamLinter(step_tokens=lint_step)

    # Create a temporary AgentService-like executor for the tool loop.
    # We instantiate AgentService with a dummy session_factory since we
    # don't use DB operations in the test path.
    _dummy_session_factory = None
    agent_svc = AgentService.__new__(AgentService)
    agent_svc._client = client
    agent_svc._session_factory = _dummy_session_factory  # type: ignore[assignment]

    total_iterations = 0
    final_text = ""
    loop_error = None
    tool_calls: list[str] = []  # Track which tools the agent called
    build_errors: list[str] = []  # Track build failures

    try:
        async for event_type, payload in agent_svc._run_tool_loop(
            workspace=workspace,
            system_blocks=system_blocks,
            messages=messages,
            tracker=tracker,
            step=AgentStep.GENERATION,
            max_iterations=_MAX_TOOL_ITERATIONS,
            generation_id="test",
            linter=linter,
        ):
            if event_type == "done":
                reason = payload["reason"]
                total_iterations = payload["iterations"]
                final_text = payload.get("final_text", "")
                if reason in {"api_error", "budget"}:
                    loop_error = payload.get("error", reason)
                break
            elif event_type == "tool_call":
                tool_calls.append(payload.get("name", "unknown"))
    except Exception as exc:
        loop_error = str(exc)

    # Check if agent ever called run_build and whether it produced dist/
    run_build_count = tool_calls.count("run_build")
    write_file_count = tool_calls.count("write_file")

    elapsed = time.monotonic() - t0
    if loop_error:
        result.stages.append(
            AgentStageResult("agent_loop", False, elapsed, loop_error)
        )
        result.total_duration_seconds = time.monotonic() - overall_start
        result.cost_usd = tracker.total_cost_usd
        result.input_tokens = tracker.total_input_tokens
        result.output_tokens = tracker.total_output_tokens
        result.iterations = total_iterations
        result.per_step_summary = tracker.per_step_summary()
        return result

    result.stages.append(
        AgentStageResult(
            "agent_loop",
            True,
            elapsed,
            metadata={
                "iterations": total_iterations,
                "run_build_count": run_build_count,
                "write_file_count": write_file_count,
                "tool_calls": tool_calls,
            },
        )
    )

    # ── Stage 5: Fallback build (if agent didn't call run_build) ────────
    # Moved BEFORE vision critique so screenshots can be taken from dist/.
    # The agent frequently writes all files but never calls run_build.
    dist_index = workspace / "dist" / "index.html"
    has_source = _has_buildable_source(workspace)
    fallback_build_error: str | None = None

    if not dist_index.is_file() and has_source:
        t0 = time.monotonic()
        logger.info(
            "agent_skipped_run_build_running_fallback",
            run_build_count=run_build_count,
        )
        try:
            fb_result = subprocess.run(
                ["node", str(workspace / "esbuild.config.mjs")],
                cwd=str(workspace),
                capture_output=True,
                text=True,
                timeout=60,
            )
            elapsed = time.monotonic() - t0
            if fb_result.returncode == 0:
                result.stages.append(
                    AgentStageResult(
                        "fallback_build",
                        True,
                        elapsed,
                        metadata={"reason": "agent did not call run_build"},
                    )
                )
            else:
                fallback_build_error = fb_result.stderr[:500]
                result.stages.append(
                    AgentStageResult(
                        "fallback_build",
                        False,
                        elapsed,
                        error=f"fallback esbuild failed: {fallback_build_error[:300]}",
                    )
                )
        except Exception as exc:
            elapsed = time.monotonic() - t0
            fallback_build_error = str(exc)
            result.stages.append(
                AgentStageResult("fallback_build", False, elapsed, error=str(exc))
            )

    # ── Stage 5b: Build-error fix pass ────────────────────────────────
    # If fallback build failed, give the agent the error and let it fix
    # the code before we attempt vision critique.
    if fallback_build_error and has_source:
        t0 = time.monotonic()
        build_fix_message = (
            "The build failed with this error:\n\n"
            f"```\n{fallback_build_error}\n```\n\n"
            "Fix the broken file(s) and call run_build() once. "
            "Make ONLY the fix needed — do not refactor anything else."
        )
        messages.append({"role": "user", "content": build_fix_message})
        fix_error = None
        fix_iterations = 0
        try:
            async for event_type, payload in agent_svc._run_tool_loop(
                workspace=workspace,
                system_blocks=system_blocks,
                messages=messages,
                tracker=tracker,
                step=AgentStep.FIX_PASS,
                max_iterations=_MAX_FIX_PASS_ITERATIONS,
                generation_id="test",
                iteration_offset=total_iterations,
            ):
                if event_type == "done":
                    fix_iterations = payload["iterations"]
                    total_iterations += fix_iterations
                    if payload["reason"] in {"api_error", "budget"}:
                        fix_error = payload.get("error", payload["reason"])
                    break
        except Exception as exc:
            fix_error = str(exc)

        elapsed = time.monotonic() - t0
        result.stages.append(
            AgentStageResult(
                "build_fix_pass",
                fix_error is None,
                elapsed,
                error=fix_error,
                metadata={"iterations": fix_iterations},
            )
        )

        # Rebuild after build-error fix
        if fix_error is None:
            try:
                rebuild = subprocess.run(
                    ["node", str(workspace / "esbuild.config.mjs")],
                    cwd=str(workspace),
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
                if rebuild.returncode == 0:
                    fallback_build_error = None  # cleared — build succeeded
                    dist_index = workspace / "dist" / "index.html"
            except Exception:
                pass

    # ── Stage 6: Vision critique (optional) ───────────────────────────
    # Now runs after fallback build, so dist/ is available even when
    # the agent forgot to call run_build.
    critique_result: CritiqueResult | None = None

    if not skip_vision and dist_index.is_file():
        t0 = time.monotonic()
        try:
            screenshots = await asyncio.to_thread(
                capture_app_screenshots, workspace
            )
            critique_result = await request_critique(screenshots)
            result.critique = critique_result
            elapsed = time.monotonic() - t0
            result.stages.append(
                AgentStageResult(
                    "vision_critique",
                    True,
                    elapsed,
                    metadata={
                        "score": critique_result.overall_score,
                        "issue_count": len(critique_result.issues),
                        "cost_usd": critique_result.cost_usd,
                    },
                )
            )
        except (ScreenshotError, CritiqueError, Exception) as exc:
            elapsed = time.monotonic() - t0
            result.stages.append(
                AgentStageResult(
                    "vision_critique",
                    True,  # best-effort
                    elapsed,
                    error=f"skipped: {exc}",
                )
            )
    elif skip_vision:
        result.stages.append(
            AgentStageResult("vision_critique", True, 0.0, error="skipped: --skip-vision")
        )
    elif not dist_index.is_file():
        result.stages.append(
            AgentStageResult(
                "vision_critique", True, 0.0,
                error="skipped: no dist/index.html to screenshot",
            )
        )

    # ── Stage 7: Fix pass (conditional on critique score) ─────────────
    if (
        critique_result is not None
        and critique_result.needs_fix_pass
    ):
        t0 = time.monotonic()
        fix_message = critique_result.to_agent_message()
        if fix_message:
            messages.append({"role": "user", "content": fix_message})
            fix_iterations = 0
            fix_error = None
            try:
                async for event_type, payload in agent_svc._run_tool_loop(
                    workspace=workspace,
                    system_blocks=system_blocks,
                    messages=messages,
                    tracker=tracker,
                    step=AgentStep.FIX_PASS,
                    max_iterations=_MAX_FIX_PASS_ITERATIONS,
                    generation_id="test",
                    iteration_offset=total_iterations,
                ):
                    if event_type == "done":
                        fix_iterations = payload["iterations"]
                        total_iterations += fix_iterations
                        if payload["reason"] in {"api_error", "budget"}:
                            fix_error = payload.get("error", payload["reason"])
                        break
            except Exception as exc:
                fix_error = str(exc)

            elapsed = time.monotonic() - t0
            result.stages.append(
                AgentStageResult(
                    "fix_pass",
                    fix_error is None,
                    elapsed,
                    error=fix_error,
                    metadata={"iterations": fix_iterations},
                )
            )

            # Always rebuild after fix pass — dist/ may exist from
            # the earlier fallback build but it's now stale because the
            # fix pass wrote new source files.
            if fix_error is None and _has_buildable_source(workspace):
                try:
                    rebuild = subprocess.run(
                        ["node", str(workspace / "esbuild.config.mjs")],
                        cwd=str(workspace),
                        capture_output=True,
                        text=True,
                        timeout=60,
                    )
                    if rebuild.returncode == 0:
                        result.stages.append(
                            AgentStageResult(
                                "post_fix_rebuild", True, 0.0,
                                metadata={"reason": "rebuild after fix pass"},
                            )
                        )
                except Exception:
                    pass  # best-effort

            # Re-critique after fix pass only if initial score was very low.
            # For scores >= 4, the fix pass is minor polish — re-critique
            # costs ~$0.04 and rarely changes the score significantly.
            initial_score = critique_result.overall_score if critique_result else 0
            if (
                fix_error is None
                and not skip_vision
                and initial_score < 4
                and (workspace / "dist" / "index.html").is_file()
            ):
                try:
                    re_screenshots = await asyncio.to_thread(
                        capture_app_screenshots, workspace
                    )
                    re_critique = await request_critique(re_screenshots)
                    result.critique = re_critique  # overwrite with post-fix score
                    result.stages.append(
                        AgentStageResult(
                            "post_fix_critique",
                            True,
                            0.0,
                            metadata={
                                "score": re_critique.overall_score,
                                "issue_count": len(re_critique.issues),
                                "improvement": re_critique.overall_score - (critique_result.overall_score if critique_result else 0),
                            },
                        )
                    )
                except Exception:
                    pass  # best-effort — keep original critique score

    # ── Stage 8: Build output validation ──────────────────────────────
    t0 = time.monotonic()
    if dist_index.is_file():
        dist_dir = workspace / "dist"
        file_count = sum(1 for _ in dist_dir.rglob("*") if _.is_file())
        total_bytes = sum(f.stat().st_size for f in dist_dir.rglob("*") if f.is_file())
        elapsed = time.monotonic() - t0
        result.stages.append(
            AgentStageResult(
                "build_output",
                True,
                elapsed,
                metadata={
                    "file_count": file_count,
                    "total_bytes": total_bytes,
                },
            )
        )
    else:
        # No dist/ even after fallback — diagnose why
        build_error = "dist/index.html not found after agent loop + fallback build"
        if has_source:
            # Source exists but build still failed — try once more to get the error
            try:
                esbuild_result = subprocess.run(
                    ["node", str(workspace / "esbuild.config.mjs")],
                    cwd=str(workspace),
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if esbuild_result.returncode != 0:
                    stderr = esbuild_result.stderr.strip()
                    build_error = f"esbuild failed: {stderr[:300]}"
                elif esbuild_result.returncode == 0 and dist_index.is_file():
                    # Retry actually succeeded — shouldn't happen but handle it
                    dist_dir = workspace / "dist"
                    file_count = sum(1 for _ in dist_dir.rglob("*") if _.is_file())
                    total_bytes = sum(f.stat().st_size for f in dist_dir.rglob("*") if f.is_file())
                    elapsed = time.monotonic() - t0
                    result.stages.append(
                        AgentStageResult(
                            "build_output", True, elapsed,
                            metadata={"file_count": file_count, "total_bytes": total_bytes},
                        )
                    )
                    # Skip the failure path below
                    build_error = None
            except Exception as exc:
                build_error = f"esbuild check error: {exc}"
        else:
            build_error = "no source files found (no .tsx in src/)"

        if build_error is not None:
            src_files = sorted(
                str(p.relative_to(workspace))
                for p in workspace.rglob("*.tsx")
                if "node_modules" not in str(p)
            )
            elapsed = time.monotonic() - t0
            result.stages.append(
                AgentStageResult(
                    "build_output",
                    False,
                    elapsed,
                    error=build_error,
                    metadata={
                        "src_files": src_files,
                        "has_source": has_source,
                        "run_build_count": run_build_count,
                    },
                )
            )

    # ── Finalize metrics ──────────────────────────────────────────────
    result.total_duration_seconds = time.monotonic() - overall_start
    result.cost_usd = tracker.total_cost_usd
    if critique_result:
        result.cost_usd = round(result.cost_usd + critique_result.cost_usd, 6)
    result.input_tokens = tracker.total_input_tokens
    result.output_tokens = tracker.total_output_tokens
    result.iterations = total_iterations
    result.per_step_summary = tracker.per_step_summary()

    return result
