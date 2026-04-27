"""Call run_sdk_tool_loop directly to find where it hangs."""
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
from apps.api.domains.generation.sdk_runner import run_sdk_tool_loop  # noqa: E402


async def main():
    workspace = Path(tempfile.mkdtemp(prefix="appio-direct-"))
    print(f"workspace: {workspace}", flush=True)
    print("about to enter generator", flush=True)

    tracker = TokenTracker()
    n = 0
    try:
        async def _do():
            nonlocal n
            async for ev in run_sdk_tool_loop(
                workspace=workspace,
                user_prompt="Write 'hi' to test.txt",
                extra_system_prompt=None,
                tracker=tracker,
                step=AgentStep.GENERATION,
                max_iterations=5,
                generation_id="direct",
                budget_usd=0.30,
            ):
                n += 1
                print(f"  event #{n}: {ev[0]} {str(ev[1])[:80]}", flush=True)

        await asyncio.wait_for(_do(), timeout=90)
        print(f"✅ DONE total events: {n}", flush=True)
    except asyncio.TimeoutError:
        print(f"❌ TIMEOUT events: {n}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
