"""Bisect which sdk_runner config option causes the hang.

We start from the known-working baseline and add one option at a time.
Each subtest has its own short timeout — if a subtest hangs, that option
is the culprit.
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from pathlib import Path

from claude_agent_sdk import (
    ClaudeAgentOptions,
    ClaudeSDKClient,
    HookMatcher,
    ResultMessage,
)


PROMPT = "Write 'hi' to a file called test.txt in the workspace, nothing else."


async def _run_with_options(label: str, options: ClaudeAgentOptions, timeout: float = 90):
    print(f"\n=== {label} ===", flush=True)
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
        await asyncio.wait_for(_do(), timeout=timeout)
    except asyncio.TimeoutError:
        print(f"  ❌ TIMEOUT after {timeout}s (saw_init={saw_init})", flush=True)
        return False
    except Exception as exc:
        print(f"  ❌ EXCEPTION {type(exc).__name__}: {exc}", flush=True)
        return False
    if saw_result:
        print(f"  ✅ OK", flush=True)
        return True
    print(f"  ❌ no result", flush=True)
    return False


async def main() -> int:
    workspace = Path(tempfile.mkdtemp(prefix="appio-diff-"))
    print(f"workspace: {workspace}", flush=True)

    base_kwargs = dict(
        model="claude-sonnet-4-5",
        cwd=str(workspace),
        permission_mode="acceptEdits",
        allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
        disallowed_tools=["WebFetch", "WebSearch", "NotebookEdit"],
        setting_sources=[],
        max_turns=5,
    )

    # 1. Baseline
    await _run_with_options("baseline", ClaudeAgentOptions(**base_kwargs))

    # 2. Add MultiEdit + Skill to allowed_tools
    await _run_with_options(
        "+ MultiEdit + Skill",
        ClaudeAgentOptions(
            **{**base_kwargs, "allowed_tools": base_kwargs["allowed_tools"] + ["MultiEdit", "Skill"]},
        ),
    )

    # 3. Add max_budget_usd
    await _run_with_options(
        "+ max_budget_usd",
        ClaudeAgentOptions(**{**base_kwargs, "max_budget_usd": 0.50}),
    )

    # 4. Add system_prompt preset+append
    await _run_with_options(
        "+ system_prompt preset",
        ClaudeAgentOptions(
            **{
                **base_kwargs,
                "system_prompt": {
                    "type": "preset",
                    "preset": "claude_code",
                    "append": "You are testing. Stack: Next.js + Convex.",
                },
            },
        ),
    )

    # 5. Add env (explicit ANTHROPIC_API_KEY pass-through)
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    await _run_with_options(
        "+ env ANTHROPIC_API_KEY",
        ClaudeAgentOptions(
            **{**base_kwargs, "env": {"ANTHROPIC_API_KEY": api_key}},
        ),
    )

    # 6. Add hooks (no-op)
    async def noop_hook(input_data, tool_use_id, context):
        return {}

    await _run_with_options(
        "+ no-op hooks",
        ClaudeAgentOptions(
            **{
                **base_kwargs,
                "hooks": {
                    "PreToolUse": [HookMatcher(matcher="Write|Edit", hooks=[noop_hook])],
                },
            },
        ),
    )

    # 7. All combined (matches sdk_runner)
    await _run_with_options(
        "ALL combined (sdk_runner shape)",
        ClaudeAgentOptions(
            **{
                **base_kwargs,
                "allowed_tools": base_kwargs["allowed_tools"] + ["MultiEdit", "Skill"],
                "max_budget_usd": 0.50,
                "system_prompt": {
                    "type": "preset",
                    "preset": "claude_code",
                    "append": "You are testing.",
                },
                "env": {"ANTHROPIC_API_KEY": api_key},
                "hooks": {
                    "PreToolUse": [HookMatcher(matcher="Write|Edit", hooks=[noop_hook])],
                },
            },
        ),
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
