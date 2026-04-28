"""Verify skills bundle loads and a relevant skill auto-activates.

Test 1: prompt that should NOT trigger a skill — sanity check.
Test 2: prompt that strongly matches `form-with-validation`.
Test 3: prompt that strongly matches `list-patterns`.

We check via the SDK's session events: when a skill auto-loads, the
agent's first turn reflects skill-aware reasoning (file paths it'd
choose, deps it'd install, error patterns).
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from pathlib import Path

_REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_REPO))
sys.path.insert(0, str(_REPO / "python" / "db" / "src"))
sys.path.insert(0, str(_REPO / "python" / "shared" / "src"))
sys.path.insert(0, str(_REPO / "python" / "builder" / "src"))
sys.path.insert(0, str(_REPO / "python" / "codegen" / "src"))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from apps.api.domains.generation.model_router import AgentStep, TokenTracker  # noqa: E402
from apps.api.domains.generation.sdk_runner import (  # noqa: E402
    _skills_source_path,
    run_sdk_tool_loop,
)


async def _run(label: str, prompt: str, timeout: float = 120):
    workspace = Path(tempfile.mkdtemp(prefix=f"appio-skills-{label}-"))
    print(f"\n=== {label} ===", flush=True)
    print(f"workspace: {workspace}", flush=True)

    tracker = TokenTracker()
    saw_text = []
    saw_tools = []
    cost = 0.0

    async def _do():
        nonlocal cost
        async for ev_type, payload in run_sdk_tool_loop(
            workspace=workspace,
            user_prompt=prompt,
            extra_system_prompt=None,
            tracker=tracker,
            step=AgentStep.GENERATION,
            max_iterations=4,   # cap so we don't burn budget — first turn is enough
            generation_id=label,
            budget_usd=0.30,
        ):
            if ev_type == "agent_text":
                saw_text.append(payload["text"])
            elif ev_type == "tool_call":
                saw_tools.append(f"{payload['name']}({payload.get('path','')[:40]})")
            elif ev_type == "agent_turn":
                cost = payload.get("cost_usd", 0.0)
            elif ev_type == "done":
                print(f"  done reason={payload['reason']} iters={payload['iterations']}", flush=True)
                return

    try:
        await asyncio.wait_for(_do(), timeout=timeout)
    except asyncio.TimeoutError:
        print("  ❌ TIMEOUT", flush=True)
        return

    print(f"  cost: ${cost:.4f}", flush=True)
    print(f"  tool_calls: {saw_tools[:8]}", flush=True)
    if saw_text:
        first = saw_text[0].replace("\n", " ")[:200]
        print(f"  first text: {first!r}", flush=True)


async def main():
    skills_path = _skills_source_path()
    print(f"skills_path: {skills_path}")
    if not skills_path:
        print("❌ no skills bundle found")
        return 1
    skills_dir = skills_path / ".claude" / "skills"
    available = sorted(p.name for p in skills_dir.iterdir() if p.is_dir())
    print(f"skills available: {available}")

    # Test 1 — neutral prompt; should not necessarily trigger a skill
    await _run(
        "neutral",
        "Print the current working directory using `pwd` via Bash, then stop.",
        timeout=60,
    )

    # Test 2 — form-with-validation should trigger
    await _run(
        "form",
        "Plan a settings page with a form that lets the user change their "
        "display name. Validation should require non-empty name under 80 "
        "chars. Don't write any files yet — just describe the approach in "
        "1-2 paragraphs and stop.",
        timeout=120,
    )

    # Test 3 — list-patterns should trigger
    await _run(
        "list",
        "Plan a screen that shows a searchable list of habits grouped by "
        "creation day, with empty state for first-time users. Don't write "
        "any files yet — describe the approach in 1-2 paragraphs and stop.",
        timeout=120,
    )

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
