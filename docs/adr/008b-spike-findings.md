# ADR 008b — Agent SDK Spike Findings

**Date:** 2026-04-27
**Status:** Spike complete; findings inform migration plan
**Related:** ADR 008 (research dossier)

Ran `python/builder/spikes/agent_sdk_hello.py` against real Anthropic API on macOS arm64 with `claude-agent-sdk==0.1.68`. Two consecutive runs to measure caching effect.

## Test setup

- Prompt: `"Create a single file 'hello.py' that prints 'Hello, Appio!' and a number 1-5 on each line. Then read it back."`
- Workspace: fresh temp dir
- Options: `model="claude-sonnet-4-5"`, `permission_mode="acceptEdits"`, allowed tools `[Read, Write, Edit, Glob, Grep, Bash]`, `setting_sources=[]`
- API key: existing local `ANTHROPIC_API_KEY`

## What works ✅

| Item | Notes |
|---|---|
| SDK installs cleanly | 0.1.68 wheel (60MB macOS arm64) installed in venv with 7 tiny transitive deps. Linux x86_64 wheel exists at 73MB — Docker install needs **no separate npm install**. |
| Bundled CLI binary | SDK ships a 204MB platform-specific binary at `claude_agent_sdk/_bundled/claude`. Auto-discovered via `_find_bundled_cli()`. |
| Message types | `SystemMessage(subtype="init")`, `AssistantMessage` w/ `TextBlock`+`ToolUseBlock`, `UserMessage` w/ `tool_use_result`, `ResultMessage` — all match docs. |
| Cost reporting | `ResultMessage.total_cost_usd` accurate to 4 decimals; `usage` dict includes `cache_creation_input_tokens`, `cache_read_input_tokens` separately. |
| Auto prompt caching | Run 1: $0.061. Run 2 (warm cache): $0.038 — **38% cost drop on identical task**. Cache read 22k → 57k tokens between runs. |
| Tool execution | Write/Read/Bash all execute in subprocess; correct results returned in `tool_use_result`. |
| `acceptEdits` mode | Auto-approves all Write/Edit/Read/Bash without UI prompts (good for headless server use). |

## What surprised us ⚠️

### 1. `acceptEdits` does NOT enforce cwd sandbox 🔴

**Observed:** prompt said "create hello.py" (relative). Claude's first Write call targeted `/tmp/hello.py` — **outside our `cwd`** — and it succeeded silently. File appeared on disk at `/tmp/hello.py`.

**Implication:** The docs imply `acceptEdits` restricts file ops to `cwd` + `add_dirs`. In practice it auto-approves **any** Write/Edit, regardless of path. The path scope mentioned in docs applies only to *which paths trigger the prompt*, not which paths execute.

**Mitigation (REQUIRED for production):**
- Add a `PreToolUse` hook matching `"Write|Edit"` that rejects any `file_path` not under `cwd`/`add_dirs`. Without this, model can write anywhere the worker process can write.
- Combine with OS-level isolation (container, ulimit, FS namespace) for defense-in-depth.

This was exactly the kind of finding the spike was designed to surface.

### 2. Subprocess startup latency ~5-6s 🟡

First `SystemMessage(subtype="init")` arrives 5.8-6.3s after `client.query()`. This is the bundled CLI binary booting + auth handshake.

**Implication:** Every fresh `ClaudeSDKClient` session pays ~6s before useful work. For our SSE-streaming UX, this is dead time after user clicks "Generate".

**Mitigation options:**
- Pool warm `ClaudeSDKClient` instances per worker (Dramatiq actor holds 1-N clients).
- Show "Initializing builder..." status during the boot window.
- Use `client.query()` repeatedly on same client (already designed for this) so 6s is paid once per worker, not once per request.

### 3. Self-correction adds turns 🟡

Claude wrote to `/tmp/hello.py` first, then ran `pwd`/`ls` to figure out where it actually was, then re-wrote to the correct path. Cost: 1 extra turn (~$0.005) per correction.

**Mitigation:**
- System prompt MUST explicitly state: "Always use relative paths from your current working directory. Never write to /tmp or absolute system paths."
- Or: hook that auto-rewrites absolute paths to be relative-to-cwd before passing to Write.

### 4. `tool_use_result` payload shape 🟢

`UserMessage.tool_use_result` is the SDK's representation of the tool result, NOT raw text. Looks like it's a dict with `output`, `is_error`, etc. We'll need to inspect each tool's result shape to map cleanly to our existing SSE `tool_result` event.

## Cost data point

| Run | Cost | Cache write (5m) | Cache read | Output tokens | Turns | Wall time |
|---|---|---|---|---|---|---|
| 1 (cold) | $0.0610 | 11,717 | 22,688 | 647 | 3 | 19.6s |
| 2 (warm) | $0.0376 | 1,134 | 57,733 | 1,032 | 4 | 20.7s |

Notes:
- Run 2 had 4 turns (path-correction loop) but still cheaper due to cache hits.
- 0.7-1.0¢ on average for "create + read 1 small file" — proportional to current builder costs.
- Expect ~50-70% cost drop in real builds where the agent writes 5-20 files (cache amortizes across many turns).

## Updated migration risks

- 🔴 **Sandbox via hooks is non-negotiable.** Plan must include a path-prefix hook in Phase 1, not Phase 5.
- 🟡 **Client pooling becomes a Phase 2 concern**, not optional. 6s/build × thousands of builds matters.
- 🟢 **Caching delivers as documented** — ~40% cost reduction observed even on a tiny prompt. Real builds should see more.

## TL;DR

SDK works. Costs are predictable. **`acceptEdits` is NOT a sandbox** — must add a PreToolUse hook in Phase 1. ~6s subprocess boot is the only meaningful per-session overhead; mitigate via client pooling. Linux Docker install is `pip install` only — no extra binary needed.
