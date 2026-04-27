"""Spike: minimal Claude Agent SDK call.

Goal: verify SDK works end-to-end against real API. Capture message sequence,
cost reporting, and any environment surprises before planning migration.

Run:
    ANTHROPIC_API_KEY=... .venv/bin/python python/builder/spikes/agent_sdk_hello.py
"""

import asyncio
import os
import sys
import tempfile
import time
from pathlib import Path

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    SystemMessage,
    TextBlock,
    ToolUseBlock,
    UserMessage,
)


PROMPT = (
    "Create a single file `hello.py` that prints 'Hello, Appio!' "
    "and a number from 1 to 5 on each line. Then read it back and confirm."
)


async def main() -> int:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        return 1

    workspace = Path(tempfile.mkdtemp(prefix="appio-spike-"))
    print(f"workspace: {workspace}")

    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        cwd=str(workspace),
        permission_mode="acceptEdits",
        allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
        disallowed_tools=["WebFetch", "WebSearch", "NotebookEdit"],
        setting_sources=[],
        max_turns=10,
        max_buffer_size=10 * 1024 * 1024,
    )

    started = time.monotonic()
    counters = {
        "system": 0,
        "assistant_text": 0,
        "assistant_tool_use": 0,
        "user_tool_result": 0,
        "result": 0,
        "other": 0,
    }

    async with ClaudeSDKClient(options=options) as client:
        await client.query(PROMPT)
        async for msg in client.receive_response():
            elapsed = time.monotonic() - started
            if isinstance(msg, SystemMessage):
                counters["system"] += 1
                print(f"[{elapsed:6.2f}s] SystemMessage subtype={msg.subtype}")
            elif isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        counters["assistant_text"] += 1
                        snippet = block.text.strip().replace("\n", " ")[:80]
                        print(f"[{elapsed:6.2f}s] text: {snippet}")
                    elif isinstance(block, ToolUseBlock):
                        counters["assistant_tool_use"] += 1
                        in_keys = list(block.input.keys()) if isinstance(block.input, dict) else []
                        fp = block.input.get("file_path", "?") if isinstance(block.input, dict) else "?"
                        print(f"[{elapsed:6.2f}s] tool_use {block.name} file_path={fp} keys={in_keys}")
            elif isinstance(msg, UserMessage):
                if getattr(msg, "tool_use_result", None) is not None:
                    counters["user_tool_result"] += 1
                    print(f"[{elapsed:6.2f}s] tool_result")
            elif isinstance(msg, ResultMessage):
                counters["result"] += 1
                print(f"[{elapsed:6.2f}s] ResultMessage")
                print(f"  is_error={msg.is_error} subtype={msg.subtype}")
                print(f"  num_turns={msg.num_turns} duration_ms={msg.duration_ms}")
                print(f"  total_cost_usd={msg.total_cost_usd}")
                print(f"  usage={msg.usage}")
            else:
                counters["other"] += 1
                print(f"[{elapsed:6.2f}s] OTHER {type(msg).__name__}")

    print()
    print("=== summary ===")
    for k, v in counters.items():
        print(f"  {k}: {v}")
    print(f"  total elapsed: {time.monotonic() - started:.2f}s")

    files = sorted(workspace.glob("**/*"))
    print(f"  workspace files: {[str(p.relative_to(workspace)) for p in files if p.is_file()]}")
    hello = workspace / "hello.py"
    if hello.exists():
        print(f"  hello.py contents:\n{hello.read_text()}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
