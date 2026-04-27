"""Bisect which specific hook (sandbox, secret) causes the hang."""
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

from claude_agent_sdk import (  # noqa: E402
    ClaudeAgentOptions,
    ClaudeSDKClient,
    HookMatcher,
    ResultMessage,
)

from apps.api.config import settings  # noqa: E402
from apps.api.domains.generation.sdk_hooks import (  # noqa: E402
    make_sandbox_hook,
    make_secret_scan_hook,
)


PROMPT = "Write 'hi' into test.txt in the current directory."


async def _run(label: str, hooks_config):
    workspace = Path(tempfile.mkdtemp(prefix="appio-hookiso-"))
    print(f"\n=== {label} === workspace={workspace}", flush=True)

    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        cwd=str(workspace),
        permission_mode="acceptEdits",
        allowed_tools=["Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "Bash", "Skill"],
        disallowed_tools=["WebFetch", "WebSearch", "NotebookEdit"],
        setting_sources=[],
        max_turns=8,
        max_budget_usd=0.30,
        system_prompt={"type": "preset", "preset": "claude_code"},
        env={"ANTHROPIC_API_KEY": settings.anthropic_api_key},
        hooks=hooks_config,
    )
    try:
        async def _do():
            async with ClaudeSDKClient(options=options) as client:
                await client.query(PROMPT)
                async for msg in client.receive_response():
                    if isinstance(msg, ResultMessage):
                        print(f"  cost={msg.total_cost_usd}", flush=True)
                        return
        await asyncio.wait_for(_do(), timeout=90)
        print("  ✅ OK", flush=True)
    except asyncio.TimeoutError:
        print("  ❌ TIMEOUT", flush=True)


async def main():
    workspace = Path(tempfile.mkdtemp(prefix="hk-"))
    sandbox = make_sandbox_hook(workspace)
    secret = make_secret_scan_hook()

    # 1. Sandbox only
    await _run(
        "sandbox-only",
        {"PreToolUse": [HookMatcher(matcher="Write|Edit|MultiEdit|Bash", hooks=[sandbox])]},
    )
    # 2. Secret only
    await _run(
        "secret-only",
        {"PreToolUse": [HookMatcher(matcher="Write|Edit|MultiEdit", hooks=[secret])]},
    )
    # 3. Both (current runner config)
    await _run(
        "both",
        {
            "PreToolUse": [
                HookMatcher(matcher="Write|Edit|MultiEdit|Bash", hooks=[sandbox]),
                HookMatcher(matcher="Write|Edit|MultiEdit", hooks=[secret]),
            ]
        },
    )


if __name__ == "__main__":
    asyncio.run(main())
