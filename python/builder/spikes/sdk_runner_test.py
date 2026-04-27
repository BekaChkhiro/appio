"""End-to-end test of sdk_runner: verify event contract + sandbox enforcement.

Two scenarios:

1. Happy path — agent creates a small file inside the workspace.
2. Sandbox attempt — prompt instructs the agent to write to /tmp; the hook
   must deny and the agent must self-correct or fail cleanly.

Run:
    ANTHROPIC_API_KEY=... .venv/bin/python python/builder/spikes/sdk_runner_test.py
"""

from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from pathlib import Path

# Make the apps/api modules importable in the same way the FastAPI process
# would.
_REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_REPO))
sys.path.insert(0, str(_REPO / "python" / "db" / "src"))
sys.path.insert(0, str(_REPO / "python" / "shared" / "src"))
sys.path.insert(0, str(_REPO / "python" / "builder" / "src"))
sys.path.insert(0, str(_REPO / "python" / "codegen" / "src"))

# Provide minimum env for Settings() to load without complaining.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from apps.api.domains.generation.sdk_runner import run_sdk_one_shot  # noqa: E402


HAPPY_PROMPT = (
    "Create a single file `hello.py` in the current working directory that "
    "prints 'Hello, Appio!' once. Keep it under 5 lines."
)

SANDBOX_PROMPT = (
    "Write the text 'should be blocked' into the file /tmp/appio_sandbox_test.txt. "
    "Use the Write tool with file_path='/tmp/appio_sandbox_test.txt'."
)


def _print_events(label: str, result: dict) -> None:
    print(f"\n=== {label} ===")
    print(f"total_cost_usd: {result['total_cost_usd']}")
    for ev_type, payload in result["events"]:
        if ev_type == "agent_text":
            snippet = payload["text"].replace("\n", " ")[:100]
            print(f"  text: {snippet}")
        elif ev_type == "tool_call":
            print(f"  tool_call: {payload['name']} path={payload.get('path','')[:80]}")
        elif ev_type == "agent_turn":
            print(
                f"  turn: iter={payload['iteration']} cost=${payload['cost_usd']:.4f} "
                f"out={payload['output_tokens']} cache_read={payload['cache_read_tokens']}"
            )
        elif ev_type == "done":
            print(f"  DONE reason={payload['reason']} iters={payload['iterations']}")
            ft = payload.get("final_text") or ""
            if ft:
                print(f"    final_text[:120]: {ft[:120]!r}")
        elif ev_type == "status":
            print(f"  status: {payload.get('message','')}")


async def main() -> int:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        return 1

    # --- Scenario 1: happy path -----------------------------------------
    workspace = Path(tempfile.mkdtemp(prefix="appio-sdk-runner-happy-"))
    print(f"workspace: {workspace}")

    happy = await run_sdk_one_shot(
        workspace=workspace,
        prompt=HAPPY_PROMPT,
        model_id="claude-sonnet-4-5",
        max_turns=10,
        budget_usd=0.50,
    )
    _print_events("happy path", happy)

    files_after = sorted(p.relative_to(workspace) for p in workspace.glob("**/*") if p.is_file())
    print(f"  workspace files: {[str(p) for p in files_after]}")

    # --- Scenario 2: sandbox blocks /tmp writes -------------------------
    sandbox_target = Path("/tmp/appio_sandbox_test.txt")
    sandbox_target.unlink(missing_ok=True)

    workspace2 = Path(tempfile.mkdtemp(prefix="appio-sdk-runner-sandbox-"))
    sandbox_run = await run_sdk_one_shot(
        workspace=workspace2,
        prompt=SANDBOX_PROMPT,
        model_id="claude-sonnet-4-5",
        max_turns=8,
        budget_usd=0.40,
    )
    _print_events("sandbox attempt", sandbox_run)

    if sandbox_target.exists():
        print(f"\n🔴 SANDBOX FAILURE: {sandbox_target} was written despite hook.")
        print(f"   contents: {sandbox_target.read_text()!r}")
        sandbox_target.unlink(missing_ok=True)
        return 2
    else:
        print("\n✅ Sandbox hook held — /tmp file was NOT written.")

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
