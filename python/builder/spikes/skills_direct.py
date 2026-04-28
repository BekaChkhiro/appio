"""Probe whether skills are discovered + listed by SDK init."""
from __future__ import annotations

import asyncio
import os
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


async def probe(plugins, skills, label: str):
    workspace = Path(tempfile.mkdtemp(prefix=f"appio-probe-{label}-"))
    print(f"\n=== {label} === workspace={workspace}", flush=True)
    print(f"  plugins={plugins!r} skills={skills!r}", flush=True)

    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        cwd=str(workspace),
        permission_mode="acceptEdits",
        allowed_tools=["Read", "Write", "Edit", "Bash", "Skill"],
        disallowed_tools=["WebFetch", "WebSearch"],
        setting_sources=[],
        plugins=plugins,
        skills=skills,
        max_turns=2,
    )

    init_data = None
    async with ClaudeSDKClient(options=options) as client:
        await client.query(
            "List every skill you have access to right now. "
            "Print each skill's NAME on its own line. If you have none, say 'no skills'."
        )
        async for msg in client.receive_response():
            if isinstance(msg, SystemMessage) and msg.subtype == "init":
                init_data = msg.data
            if isinstance(msg, AssistantMessage):
                for b in msg.content:
                    if isinstance(b, TextBlock):
                        print(f"  TEXT: {b.text.strip()[:400]}", flush=True)
            if isinstance(msg, ResultMessage):
                break

    if init_data:
        # Print interesting init keys
        for k in ("tools", "available_skills", "model", "session_id", "permissionMode"):
            v = init_data.get(k)
            if v is not None:
                print(f"  init.{k}: {str(v)[:300]}", flush=True)


async def main():
    skills_root = str(_REPO / "packages" / "skills")
    print(f"skills_root: {skills_root}")

    # Probe A: plugins + skills="all"
    await probe(
        plugins=[{"type": "local", "path": skills_root}],
        skills="all",
        label="plugins+all",
    )

    # Probe B: plugins + skills=specific
    await probe(
        plugins=[{"type": "local", "path": skills_root}],
        skills=["form-with-validation", "list-patterns", "navigation-patterns", "error-recovery"],
        label="plugins+explicit",
    )


if __name__ == "__main__":
    asyncio.run(main())
