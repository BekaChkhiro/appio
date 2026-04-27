"""Test if async generator yield-deadlock is the runner's hang cause.

If this hangs, the problem is yield-during-async-for. Fix = drain all
messages first, then yield events.
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

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, ResultMessage  # noqa: E402

from apps.api.config import settings  # noqa: E402


PROMPT = "Write 'hi' into test.txt in the current directory."


async def gen_with_yield():
    """Reproduces sdk_runner shape — yield inside async-for over receive_response."""
    workspace = Path(tempfile.mkdtemp(prefix="appio-deadlock-"))
    print(f"workspace: {workspace}", flush=True)

    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        cwd=str(workspace),
        permission_mode="acceptEdits",
        allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
        disallowed_tools=["WebFetch", "WebSearch", "NotebookEdit"],
        setting_sources=[],
        max_turns=5,
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.query(PROMPT)
        async for msg in client.receive_response():
            cls = type(msg).__name__
            print(f"  msg: {cls}", flush=True)
            yield ("msg", cls)
            if isinstance(msg, ResultMessage):
                print(f"  cost={msg.total_cost_usd}", flush=True)


async def main():
    saw = []
    try:
        async def _do():
            async for ev in gen_with_yield():
                saw.append(ev)
        await asyncio.wait_for(_do(), timeout=90)
        print(f"✅ OK total events: {len(saw)}", flush=True)
    except asyncio.TimeoutError:
        print(f"❌ TIMEOUT after 90s, got {len(saw)} events", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
