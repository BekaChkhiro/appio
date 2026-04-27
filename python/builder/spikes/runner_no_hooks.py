"""Test sdk_runner with hooks disabled — isolate hook-related hangs."""
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

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, ResultMessage  # noqa: E402

from apps.api.config import settings  # noqa: E402


PROMPT = "Write 'hi' into a file test.txt in the current directory."


async def main() -> int:
    workspace = Path(tempfile.mkdtemp(prefix="appio-no-hooks-"))
    print(f"workspace: {workspace}", flush=True)

    # Mirror sdk_runner._build_options EXCEPT no hooks.
    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        cwd=str(workspace),
        permission_mode="acceptEdits",
        allowed_tools=["Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "Bash", "Skill"],
        disallowed_tools=["WebFetch", "WebSearch", "NotebookEdit"],
        setting_sources=[],
        max_turns=10,
        max_budget_usd=0.50,
        system_prompt={"type": "preset", "preset": "claude_code"},
        env={"ANTHROPIC_API_KEY": settings.anthropic_api_key},
        # NO hooks
    )

    saw_init = False
    saw_result = False
    try:
        async def _do():
            nonlocal saw_init, saw_result
            async with ClaudeSDKClient(options=options) as client:
                await client.query(PROMPT)
                async for msg in client.receive_response():
                    cls = type(msg).__name__
                    print(f"  msg: {cls}", flush=True)
                    if cls == "SystemMessage":
                        saw_init = True
                    if isinstance(msg, ResultMessage):
                        saw_result = True
                        print(f"  cost={msg.total_cost_usd}", flush=True)
                        return
        await asyncio.wait_for(_do(), timeout=120)
    except asyncio.TimeoutError:
        print(f"❌ TIMEOUT (saw_init={saw_init})", flush=True)
        return 1
    print(f"✅ OK saw_init={saw_init} saw_result={saw_result}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
