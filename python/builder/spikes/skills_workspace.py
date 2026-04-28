"""Test if copying skills into the workspace's .claude/skills/ + setting_sources=['project'] works."""
from __future__ import annotations

import asyncio
import os
import shutil
import sys
import tempfile
from pathlib import Path

_REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_REPO))

from claude_agent_sdk import (  # noqa: E402
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    SystemMessage,
    TextBlock,
)


async def main():
    workspace = Path(tempfile.mkdtemp(prefix="appio-ws-skills-"))
    src = _REPO / "packages" / "skills" / ".claude" / "skills"
    dst = workspace / ".claude" / "skills"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst)
    print(f"workspace: {workspace}", flush=True)
    print(f"skills copied: {sorted(p.name for p in dst.iterdir())}", flush=True)

    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        cwd=str(workspace),
        permission_mode="acceptEdits",
        allowed_tools=["Read", "Write", "Edit", "Bash", "Skill"],
        disallowed_tools=["WebFetch", "WebSearch"],
        setting_sources=["project"],   # so it scans cwd/.claude/
        skills="all",
        max_turns=2,
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.query(
            "List every NAME of every skill you currently have access to in this session. "
            "One per line. If you see 'form-with-validation' say so explicitly. "
            "Then stop."
        )
        async for msg in client.receive_response():
            if isinstance(msg, AssistantMessage):
                for b in msg.content:
                    if isinstance(b, TextBlock):
                        print(f"TEXT: {b.text.strip()[:600]}", flush=True)
            if isinstance(msg, ResultMessage):
                print(f"cost=${msg.total_cost_usd}", flush=True)
                break


if __name__ == "__main__":
    asyncio.run(main())
