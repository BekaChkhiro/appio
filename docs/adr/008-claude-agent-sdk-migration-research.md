# ADR 008 — Claude Agent SDK Migration Research

**Date:** 2026-04-27
**Status:** Research complete; migration plan pending
**Context:** Audit of existing builder concluded we use raw `anthropic` Client SDK with hand-rolled tool loop (~2,500 lines in `agent_service.py`). User decided to migrate to official Claude Agent SDK to enable Skills, Hooks, and built-in `Edit` tool.

---

## Section 1 — SDK fundamentals

### Package, install, current version

- **Python package:** `claude-agent-sdk` (renamed from `claude-code-sdk` in v0.1.0). Install: `pip install claude-agent-sdk`.
- **Latest version (Python):** `0.1.68`, released 2026-04-25.
- **Forward-looking:** Opus 4.7 (`claude-opus-4-7`) requires Agent SDK v0.2.111+. Current `claude-sonnet-4-6` ID in our codebase is wrong; use `claude-sonnet-4-5` or `claude-opus-4-7`.
- Bundled Claude Code CLI binary required; SDK manages it as subprocess. Python SDK shells out; can override `cli_path`.

### Core entrypoints

```python
from claude_agent_sdk import query, ClaudeAgentOptions, ClaudeSDKClient

# Stateless one-shot
async def query(
    *,
    prompt: str | AsyncIterable[dict[str, Any]],
    options: ClaudeAgentOptions | None = None,
    transport: Transport | None = None
) -> AsyncIterator[Message]
```

- `query()` returns async iterator of typed `Message` objects. New session per call.
- `ClaudeSDKClient` is the persistent session class; supports `client.query()`, `client.receive_response()`, `client.interrupt()`, `client.set_permission_mode()`, `client.set_model()`, `client.disconnect()`.

### `ClaudeAgentOptions` (the dataclass you'll live in)

| Field | Notes |
|---|---|
| `model: str` | e.g. `"claude-sonnet-4-5"`, `"claude-opus-4-7"` |
| `fallback_model: str` | Auto-failover on error |
| `system_prompt: str \| dict` | Plain string OR `{"type":"preset","preset":"claude_code","append":"..."}` |
| `tools: list[str] \| dict` | Controls which built-ins are *visible* |
| `allowed_tools: list[str]` | Auto-approve list (does NOT restrict) |
| `disallowed_tools: list[str]` | Always-deny (overrides everything except hooks) |
| `permission_mode` | `"default" \| "acceptEdits" \| "plan" \| "dontAsk" \| "bypassPermissions"` |
| `cwd: str \| Path` | Working directory (sandbox path) |
| `add_dirs: list[str]` | Additional directories Claude is allowed to read/write |
| `mcp_servers: dict` | MCP server registry, keyed by server name |
| `hooks: dict[HookEvent, list[HookMatcher]]` | Lifecycle hooks |
| `agents: dict[str, AgentDefinition]` | Programmatic subagents |
| `setting_sources: list["user"\|"project"\|"local"] \| None` | **CRITICAL:** explicit `[]` = no filesystem config. Skills require `["project"]` or `["user"]` |
| `max_turns: int` | Hard ceiling on agent loop |
| `max_budget_usd: float` | Cost-based circuit breaker |
| `can_use_tool: Callable` | Async permission callback |
| `include_partial_messages: bool` | Emit per-token `StreamEvent`s |
| `env: dict[str,str]` | Environment overrides for subprocess |
| `extra_args: dict[str,str\|None]` | Pass-through CLI args |
| `effort: "low"\|"medium"\|"high"\|"max"` | Reasoning effort |
| `thinking: ThinkingConfig` | `{"type":"enabled","budget_tokens": N}` |
| `enable_file_checkpointing: bool` | SDK tracks file changes |
| `resume: str` | Session ID to resume |
| `continue_conversation: bool` | Continue most recent session |
| `fork_session: bool` | Branch session |
| `plugins: list[SdkPluginConfig]` | `[{"type":"local","path":"..."}]` to load skills/agents |

### Working directory & sandboxing

- `cwd` sets agent's working directory for file tools.
- `acceptEdits` mode auto-approves Read/Write/Edit and `mkdir/touch/rm/rmdir/mv/cp/sed` *only inside* `cwd` and `add_dirs`.
- A real sandbox (chroot/container) is still your responsibility — `cwd` is path scope, not security boundary.

### Cost / token reporting (in `ResultMessage`)

```python
@dataclass
class ResultMessage:
    total_cost_usd: float | None      # cumulative client-side estimate
    usage: dict                        # input_tokens, output_tokens, cache_*
    model_usage: dict                  # per-model breakdown with costUSD
    duration_ms: int
    duration_api_ms: int
    num_turns: int
    session_id: str
    is_error: bool
    subtype: str
    result: str | None
```

Never bill end-users from `total_cost_usd`; use the Usage and Cost API for billing-grade truth.

---

## Section 2 — Tools

### Built-ins relevant to a code generator

| Tool | Recommend? | Why |
|---|---|---|
| `Read` | YES | Replaces `read_file` |
| `Write` | YES | New files |
| `Edit` | **YES — biggest win** | 60-90% output token reduction on revisions |
| `Glob` | YES | Replaces `list_files` |
| `Grep` | YES | Better than re-reading whole files |
| `Bash` | YES | Replaces `run_build` |
| `Monitor` | Useful | Tail long-running scripts |
| `WebFetch` / `WebSearch` | DISABLE | Not needed for app builder |
| `AskUserQuestion` | Optional | Confirm destructive actions |
| `NotebookEdit` | DISABLE | |
| `Skill` | YES | Required for skills |
| `Agent` | If using subagents | |

### Edit vs full-rewrite — most consequential decision

- Today's `write_file` forces full rewrites
- With `Edit`, model issues focused find/replace patches
- **40-70% reduction in output tokens during repair/critique phase**
- Output is 5x input price — this is where money leaks
- **Caveat:** `Edit` requires unique anchors; near-duplicate blocks → fail rate non-zero. Keep `Write` as fallback.

### Custom MCP tools (in-process)

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool(
    "deploy_to_convex",
    "Push schema and functions to a Convex dev deployment",
    {"workspace_path": str, "convex_url": str},
)
async def deploy_to_convex(args):
    return {"content": [{"type": "text", "text": "Deployed at <url>"}]}

appio_server = create_sdk_mcp_server(
    name="appio",
    version="1.0.0",
    tools=[deploy_to_convex],
)

options = ClaudeAgentOptions(
    mcp_servers={"appio": appio_server},
    allowed_tools=["mcp__appio__deploy_to_convex"],
)
```

**Naming convention is mandatory:** `mcp__{server_name}__{tool_name}`.

### Permission patterns

Evaluation order (memorize):

1. **Hooks** run first — can `allow`, `deny`, or `ask`
2. **Deny rules** — `disallowed_tools`. Wins everything (yes, even `bypassPermissions`)
3. **Permission mode** — `bypassPermissions` approves; `acceptEdits` approves file ops
4. **Allow rules** — `allowed_tools`
5. **`can_use_tool` callback**

For Appio:

```python
options = ClaudeAgentOptions(
    permission_mode="acceptEdits",
    allowed_tools=["Read","Write","Edit","Glob","Grep","Bash","mcp__appio__*"],
    disallowed_tools=["WebFetch","WebSearch","NotebookEdit"],
    cwd=workspace_path,
    setting_sources=[],
)
```

---

## Section 3 — Skills (highest-leverage feature)

### What a skill *is*, technically

Directory with `SKILL.md` in `.claude/skills/<skill-name>/`. YAML frontmatter + Markdown body. Optional supporting files load only when referenced.

```
.claude/skills/build-convex-crud/
├── SKILL.md             # required, < 500 lines recommended
├── reference.md         # loaded only when SKILL.md links to it
├── templates/
│   └── schema.ts.tmpl
└── scripts/
    └── scaffold.sh
```

### Frontmatter

```yaml
---
name: build-convex-crud                       # lowercase, hyphens, max 64 chars
description: |                                # ≤ 1,536 chars, front-load keywords
  Scaffolds a Convex schema + CRUD mutations + a Next.js page.
  Use when the user requests a new entity that needs persistence and basic UI.
when_to_use: |
  Trigger phrases: "build me a tracker", "add an entity", "model X"
allowed-tools: Read Write Edit Bash(npx convex *)   # CLI-only; ignored in SDK
disable-model-invocation: false               # let Claude auto-load
user-invocable: true                          # also callable as /build-convex-crud
paths: convex/**/*.ts src/app/**/*.tsx        # only auto-load for matching files
model: inherit                                # or "sonnet" / "opus"
effort: medium
---
```

### How they auto-load

- Discovery at session start scanning directories enabled via `setting_sources`. **MUST include `"project"` or `"user"` in `setting_sources` AND `"Skill"` in `allowed_tools`.** Otherwise: zero skills.
- Only YAML metadata (name + description, capped 1,536 chars) loaded into context at startup. Full body loads when Claude decides description matches request — cost optimization win.
- Description budget: 1% of context window or 8,000 chars fallback. Override with `SLASH_COMMAND_TOOL_CHAR_BUDGET`.
- After auto-compaction, most recent invocation re-attached, capped at 5,000 tokens per skill, 25,000 total.

### SDK-specific caveats

- `allowed-tools` frontmatter does NOT apply via SDK — only via CLI.
- No programmatic skill registration. To bundle with package: `plugins=[{"type":"local","path":"/opt/appio/skills-bundle"}]`.

### Recommended first 5-10 skills for Appio

1. **`build-convex-crud`** — bread-and-butter scaffolder
2. **`build-convex-auth`** — Convex Auth setup with email/OTP
3. **`build-nextjs-pwa-shell`** — `next.config.ts` PWA, manifest.json, install prompt
4. **`build-tailwind-design-system`** — opinionated tokens, primitives, dark mode
5. **`build-form-with-validation`** — react-hook-form + zod + Convex mutation
6. **`fix-build-error`** — structured triage when build fails
7. **`fix-typescript-error`** — narrower TS-only variant
8. **`screenshot-and-critique`** — existing critique flow as skill (subagent context fork)
9. **`add-convex-realtime-subscription`** — make list live-update pattern
10. **`deploy-to-vercel`** — runtime checklist + envs + build test

First 5 cover ~80% of generated-app surface; last 5 reduce iteration cost.

### Limits

- 64-char skill name max, lowercase + hyphens
- Description+`when_to_use` truncated at 1,536 chars
- Body should stay <500 lines; move detail to supporting files
- Practical ceiling: 30-50 skills before you need namespacing or `paths:` filtering
- Naming collisions: enterprise > user > project; plugin skills namespaced as `plugin-name:skill-name`

---

## Section 4 — Hooks

### Available events (Python SDK)

`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `SubagentStart`, `PreCompact`, `Notification`, `PermissionRequest`. `SessionStart`/`SessionEnd` are TS-only callback form; in Python configure as shell hooks via settings.json.

### How to abort / mutate

A `PreToolUse` hook returns:

```python
return {
    "systemMessage": "Don't write secrets to .env files.",
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",       # "allow" | "deny" | "ask"
        "permissionDecisionReason": "Secret pattern detected",
        "updatedInput": { ... }             # only valid with "allow"
    }
}
```

Precedence: **deny > defer > ask > allow**.

### Patterns useful for Appio

| Pattern | Hook | Why |
|---|---|---|
| Secret-scan pre-Write | `PreToolUse` matcher `"Write\|Edit"` — regex for `sk_live_`, etc. → deny | Critical |
| Auto-typecheck post-Write | `PostToolUse` matcher `"Write\|Edit"` — run `tsc --noEmit`, return `additionalContext` | Catches errors during generation |
| Format-on-save | `PostToolUse` `"Write\|Edit"` — run `prettier --write` async (`async_=True`) | Don't block loop |
| Build-verify pre-final | `Stop` hook — run `next build`; if fails, inject `systemMessage` and `continue=False` | Final output compiles |
| Sandbox redirect | `PreToolUse` rewrite `file_path` to prepend workspace dir | Defense in depth |
| Audit log | `PostToolUse` no matcher → write to DB | Replay/debugging |

### Async output (fire-and-forget)

```python
async def slack_notify(input_data, tool_use_id, context):
    asyncio.create_task(post_to_slack(input_data))
    return {"async_": True, "asyncTimeout": 30000}   # async_ in Python
```

### Hook timeouts

Default 60s. Configurable via `HookMatcher(timeout=N)`.

---

## Section 5 — Subagents

### `AgentDefinition` (camelCase even in Python)

```python
AgentDefinition(
    description="...",
    prompt="...",
    tools=["Read","Grep","Glob"],
    disallowedTools=[...],
    model="sonnet",
    skills=["build-convex-crud"],   # preload at start
    mcpServers=[...],
    maxTurns=10,
    background=False,
    effort="medium",
    permissionMode="default",
)
```

### Context isolation

Each subagent gets fresh window. Only **final message** returns to parent. Tool calls and intermediate reads stay inside. Parent → subagent channel is **only the prompt string**.

Subagents use skills *only if listed* in `skills=[...]`.

### When to use subagents for Appio (honest answer)

**Premature for V1.** Schema, UI, auth aren't actually independent — they share types and routes.

**Exception:** **critique loop** is perfect subagent candidate. A "screenshot-and-critique" subagent runs Playwright, takes screenshots, evaluates, returns *summary*. Hundreds of KB of base64 image data never pollute main agent's context.

Recommended subagent set for Appio v2:

```python
agents={
    "screenshot-critic": AgentDefinition(
        description="Take screenshots of running app and critique UX. Use after build succeeds.",
        prompt="Run playwright, screenshot key pages, evaluate against design checklist, return bullet list of issues.",
        tools=["Bash","Read"],
        model="sonnet",
    ),
    "build-doctor": AgentDefinition(
        description="Diagnose build failures. Use when a build fails 2+ times.",
        prompt="Read error log, search codebase for root cause, propose specific fix.",
        tools=["Read","Grep","Glob","Bash"],
        model="opus",
    ),
}
```

Skip "schema agent + UI agent + auth agent" decomposition until evidence the main agent is context-bound.

---

## Section 6 — Streaming & SSE integration

### Message types

```python
Message = (
    UserMessage            # echoes of user turn
    | AssistantMessage     # text, tool_use, thinking blocks
    | SystemMessage        # subtype="init" carries session_id; task events
    | ResultMessage        # final per query()/turn — has total_cost_usd
    | StreamEvent          # raw token stream, only if include_partial_messages=True
    | RateLimitEvent       # status changes
)
```

### Mapping to existing SSE event types

| SDK message | Your SSE event | Extract |
|---|---|---|
| `SystemMessage(subtype="init")` | `status` | `data.session_id` |
| `AssistantMessage` w/ `TextBlock` | `text` | `block.text` |
| `AssistantMessage` w/ `ToolUseBlock` | `tool_call` | `block.name`, `block.input`, `block.id` |
| `UserMessage` w/ `tool_use_result` | `tool_result` | `message.tool_use_result` |
| `AssistantMessage` w/ `ThinkingBlock` | `status` (or `thinking`) | `block.thinking` |
| `StreamEvent` | `token` | only if `include_partial_messages=True` |
| `ResultMessage` | `complete` | `result`, `total_cost_usd`, `usage` |
| `ResultMessage(is_error=True)` | `error` | `result`, `subtype` |
| `RateLimitEvent` | `status` | warn user |

Use `include_partial_messages=False` initially.

### Cancellation when client disconnects

```python
async with ClaudeSDKClient(options=options) as client:
    await client.query(prompt)
    try:
        async for msg in client.receive_response():
            if cancel_event.is_set():
                await client.interrupt()
                break
            yield to_sse(msg)
    finally:
        # IMPORTANT: drain remaining buffered messages before next query
        async for _ in client.receive_response():
            pass
```

Documented footgun: messages keep flowing after `interrupt()` until inflight tool call concludes. Drain or you'll see "leftover" messages.

---

## Section 7 — Cost & performance

### Pricing (2026-04, per million tokens)

| Model | Input | Output | 5m cache write | 1h cache write | Cache read |
|---|---|---|---|---|---|
| Opus 4.7 | $5 | $25 | $6.25 | $10 | $0.50 |
| Sonnet 4.5 / 4.6 | $3 | $15 | $3.75 | $6 | $0.30 |
| Haiku 4.5 | $1 | $5 | $1.25 | $2 | $0.10 |

Opus 4.7 has new pricing (much cheaper than 4.1's $15/$75) AND new tokenizer that may use up to 35% more tokens.

### Prompt caching: automatic

SDK manages prompt caching for you — system prompt, tool definitions, recent turns auto-cached. Cache reads are 0.1x base input. Don't add `cache_control` blocks. To extend TTL to 1 hour: set `ENABLE_PROMPT_CACHING_1H=1` in `options.env`.

**Hand-rolled cache control logic in current `agent_service.py` becomes dead code on migration.**

### Output token reduction patterns for codegen

1. **`Edit` over `Write`** — 40-70% reduction (largest single lever)
2. **`Grep` before `Read`** — don't read whole files to find functions
3. **Skills with `disable-model-invocation: true` for procedures**
4. **`maxTurns` ceiling** — keeps stuck agent from spending unbounded
5. **`max_budget_usd`** — cost circuit breaker
6. **Subagent for screenshots/critique** — keep huge tool outputs out of main context
7. **`thinking` config off by default** — extended thinking adds 5-15k output tokens
8. **`effort="low"`** for trivial tasks, `"high"` only for repair

### Realistic $/build estimates

| App size | Lines | Turns | Sonnet 4.5 | Opus 4.7 |
|---|---|---|---|---|
| Small (TODO) | 200-500 | 8-15 | $0.04-0.12 | $0.10-0.30 |
| Medium (habit tracker, auth, 3 entities) | 800-1500 | 20-40 | $0.15-0.40 | $0.40-1.20 |
| Large (Notion-ish, 6+ entities) | 3000-6000 | 50-100 | $0.80-2.00 | $2.50-6.00 |

### When Sonnet vs Opus

- **Sonnet 4.5 / 4.6 default for everything** — generates Convex + Next.js cleanly, follows skills well, 5x cheaper than Opus on output.
- **Opus 4.7 only for:** (a) build doctor when Sonnet's failed twice, (b) `effort="high"` premium tier, (c) subagents with complex multi-file refactors.
- Use `fallback_model` to pin: `model="claude-sonnet-4-5", fallback_model="claude-opus-4-7"`.

---

## Section 8 — Production hardening

### What the SDK does for you

- Automatic prompt caching with 5-min TTL
- Rate limit detection (`RateLimitEvent` emitted)
- Tool loop with retry on transient errors
- Session persistence and resume by ID
- File checkpointing (`enable_file_checkpointing=True`) for rollback
- Subprocess management of Claude Code CLI binary
- Error classification on `AssistantMessage.error` field

### What you still build

- Multi-tenant API key vaulting and rotation
- Workspace lifecycle (create/snapshot/GC)
- Persistent storage of session_ids
- SSE event mapping & cancellation wiring through Dramatiq
- Per-user budget enforcement (cumulative)
- Observability beyond hook logging
- OS-level sandboxing (chroot/container)

### Known footguns

1. `break` out of `async for` corrupts asyncio cleanup in `ClaudeSDKClient` — use a flag
2. `setting_sources=[]` historically buggy — pin ≥ 0.1.60 (we'll be on 0.1.68)
3. `allowed_tools` does NOT constrain `bypassPermissions` — use `disallowed_tools` to deny in bypass mode
4. `Edit` requires unique anchor strings — non-zero fail rate, keep `Write` as fallback
5. MCP tool name pattern is mandatory: `mcp__{server}__{tool}` — typos = silent ignore
6. System prompt no longer defaults to Claude Code's preset post-v0.1.0 — opt in via `{"type":"preset","preset":"claude_code","append":"..."}`
7. `total_cost_usd` is client-side estimate — never bill end-users from it
8. Subagents inherit `bypassPermissions`/`acceptEdits` from parent and you cannot override
9. Hooks may not fire when `max_turns` is hit — session ends before hooks dispatch
10. CLAUDE.md, slash commands, agent definitions NOT loaded from `--add-dir`/`add_dirs` — use `plugins=[{"type":"local","path":...}]`

---

## Section 9 — Migration recipe (concrete code)

### 9.1 Replace `_run_tool_loop`

```python
# agent_service.py — new core
import asyncio
from claude_agent_sdk import (
    ClaudeSDKClient, ClaudeAgentOptions, AssistantMessage, UserMessage,
    SystemMessage, ResultMessage, TextBlock, ToolUseBlock,
    create_sdk_mcp_server, tool, HookMatcher,
)
from .hooks import secret_scan_hook, post_write_typecheck
from .custom_tools import deploy_tool

APPIO_SYSTEM_PROMPT = """You are Appio, an AI app builder. Generate Next.js 15 + Convex
PWAs. Always use Convex for data, Tailwind for styling, react-hook-form + zod for forms.
Never write secrets to .env files."""

async def run_build(
    user_prompt: str,
    workspace_path: str,
    user_api_key: str,
    cancel_event: asyncio.Event,
):
    appio_mcp = create_sdk_mcp_server(
        name="appio",
        version="1.0.0",
        tools=[deploy_tool],
    )

    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        fallback_model="claude-opus-4-7",
        system_prompt={
            "type": "preset",
            "preset": "claude_code",
            "append": APPIO_SYSTEM_PROMPT,
        },
        cwd=workspace_path,
        permission_mode="acceptEdits",
        allowed_tools=[
            "Read", "Write", "Edit", "Glob", "Grep", "Bash",
            "Skill", "mcp__appio__deploy_tool",
        ],
        disallowed_tools=["WebFetch", "WebSearch", "NotebookEdit"],
        mcp_servers={"appio": appio_mcp},
        setting_sources=["project"],
        plugins=[{"type": "local", "path": "/opt/appio/skills-bundle"}],
        max_turns=80,
        max_budget_usd=2.50,
        enable_file_checkpointing=True,
        env={"ANTHROPIC_API_KEY": user_api_key},
        hooks={
            "PreToolUse": [
                HookMatcher(matcher="Write|Edit", hooks=[secret_scan_hook]),
            ],
            "PostToolUse": [
                HookMatcher(matcher="Write|Edit", hooks=[post_write_typecheck]),
            ],
        },
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.query(user_prompt)
        try:
            async for msg in client.receive_response():
                if cancel_event.is_set():
                    await client.interrupt()
                    break
                async for sse in map_to_sse(msg):
                    yield sse
        finally:
            try:
                async for _ in client.receive_response():
                    pass
            except Exception:
                pass


async def map_to_sse(msg):
    if isinstance(msg, SystemMessage) and msg.subtype == "init":
        yield {"event": "status", "data": {"session_id": msg.data.get("session_id")}}
    elif isinstance(msg, AssistantMessage):
        for block in msg.content:
            if isinstance(block, TextBlock):
                yield {"event": "text", "data": {"text": block.text}}
            elif isinstance(block, ToolUseBlock):
                yield {"event": "tool_call", "data": {
                    "id": block.id, "name": block.name, "input": block.input,
                }}
    elif isinstance(msg, UserMessage) and msg.tool_use_result is not None:
        yield {"event": "tool_result", "data": msg.tool_use_result}
    elif isinstance(msg, ResultMessage):
        yield {"event": "complete" if not msg.is_error else "error", "data": {
            "result": msg.result,
            "cost_usd": msg.total_cost_usd,
            "usage": msg.usage,
            "duration_ms": msg.duration_ms,
            "num_turns": msg.num_turns,
        }}
```

### 9.2 Pre-Write secret-scan hook

```python
# hooks.py
import re
SECRET_PATTERNS = [
    re.compile(r"sk-[a-zA-Z0-9]{20,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----"),
    re.compile(r"AIza[0-9A-Za-z_-]{35}"),
]

async def secret_scan_hook(input_data, tool_use_id, context):
    content = input_data["tool_input"].get("content", "") \
        or input_data["tool_input"].get("new_string", "")
    file_path = input_data["tool_input"].get("file_path", "")

    if any(p.search(content) for p in SECRET_PATTERNS):
        return {
            "systemMessage": "Secret pattern detected. Use environment variables instead.",
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "Looks like a real API key/secret",
            },
        }

    if file_path.endswith(".env") and not file_path.endswith(".env.example"):
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "Don't write .env directly; use .env.example",
            },
        }
    return {}


async def post_write_typecheck(input_data, tool_use_id, context):
    import asyncio
    file_path = input_data["tool_input"].get("file_path", "")
    if not file_path.endswith((".ts", ".tsx")):
        return {}

    proc = await asyncio.create_subprocess_exec(
        "npx", "tsc", "--noEmit", "--pretty", "false", file_path,
        cwd=input_data["cwd"],
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
    )
    out, _ = await proc.communicate()
    if proc.returncode != 0:
        return {
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": f"Type check failed for {file_path}:\n{out.decode()[:2000]}",
            }
        }
    return {}
```

### 9.3 Sample skill: `build-convex-crud/SKILL.md`

```markdown
---
name: build-convex-crud
description: |
  Scaffolds a Convex schema, CRUD mutations/queries, and a Next.js page with
  form + list. Use when the user asks for an app that tracks any kind of entity
  (habits, todos, expenses, workouts, journals, etc.).
when_to_use: |
  Triggers: "build me a tracker", "create a [thing] app", "track my X"
---

# Build a Convex-backed CRUD feature

When invoked, follow these steps in order. Do not skip steps.

## 1. Identify the entity
Pick a singular noun for the entity (e.g. "habit"). Pluralize for the table name.

## 2. Schema (`convex/schema.ts`)
- Use `defineTable({...})` with explicit `v.string()`, `v.number()`, `v.boolean()`, `v.id()` validators
- Always add a `userId: v.id("users")` index for multi-user scoping
- Add `.index("by_user", ["userId"])`

## 3. Functions (`convex/<plural>.ts`)
- `list` query: filtered by `userId` from `ctx.auth`
- `create`, `update`, `remove` mutations
- All mutations call `getAuthUserId(ctx)` and reject if null

## 4. UI (`src/app/<plural>/page.tsx`)
- Use `"use client"`
- `useQuery(api.<plural>.list)` for list
- `useMutation(api.<plural>.create)` for form submit
- Tailwind: stacked card layout with `space-y-4`

## 5. Verify
Run `npx convex dev --once` to validate the schema. If errors, fix and retry up to 2 times.

## Common pitfalls
- Never use `v.string()` for IDs — always `v.id("table")`
- Never call mutations from server components

## Reference
For complex entity relationships, see [reference.md](reference.md).
```

### 9.4 Cancellation flow (FastAPI → Dramatiq → SDK)

```python
# api.py (FastAPI)
@router.post("/builds")
async def start_build(req: Request, payload: dict):
    build_id = str(uuid.uuid4())
    cancel_registry.register(build_id)
    build_app_actor.send(build_id, payload["prompt"], payload["api_key"])
    return {"build_id": build_id}

@router.get("/builds/{build_id}/events")
async def stream_build(build_id: str, request: Request):
    async def event_iter():
        async for evt in event_bus.subscribe(build_id):
            if await request.is_disconnected():
                cancel_registry.cancel(build_id)
                break
            yield {"event": evt["event"], "data": json.dumps(evt["data"])}
    return EventSourceResponse(event_iter())
```

```python
# worker.py (Dramatiq)
class CancelRegistry:
    def __init__(self):
        self._events: dict[str, asyncio.Event] = {}
    def register(self, build_id):
        self._events[build_id] = asyncio.Event()
    def cancel(self, build_id):
        if e := self._events.get(build_id):
            e.set()
    def event(self, build_id):
        return self._events.setdefault(build_id, asyncio.Event())

cancel_registry = CancelRegistry()

@dramatiq.actor(time_limit=600_000)
def build_app_actor(build_id: str, prompt: str, api_key: str):
    asyncio.run(_run(build_id, prompt, api_key))

async def _run(build_id, prompt, api_key):
    workspace = f"/var/appio/workspaces/{build_id}"
    cancel_event = cancel_registry.event(build_id)
    async for sse in run_build(prompt, workspace, api_key, cancel_event):
        await event_bus.publish(build_id, sse)
    await event_bus.publish(build_id, {"event": "done", "data": {}})
```

Round-trip latency from disconnect to model stop: typically 1-3s.

---

## Section 10 — Risks & open questions

### Where 30-60% cost reduction estimate could be wrong

1. **Edit tool fail rate.** Pathological case: many near-duplicate blocks → Edit fails → model retries with Write → worse cost. Instrument `PostToolUseFailure` to track Edit failure rate; if >10%, force `Write` for that turn via hook.
2. **Skills add ~1k token always-on cost** (description budget). 30 skills → ~30k tokens to every turn's input. With caching, fine. Without, balloon. Use `paths:` frontmatter to scope, or `disable-model-invocation: true` for procedure-style skills.
3. **Automatic caching depends on prompt stability.** Per-user API key rotates env → invalidates cache → savings drop near zero. Test on day one.
4. **Opus 4.7 tokenizer ~35% more tokens.** Opus 4.1 benchmarks misleading.
5. **Hook overhead.** 4 hooks chained on Write → 50-200ms per file write. Death by 1000 cuts in 50-write build.

### Realistic migration timeline (senior dev, full time)

| Phase | Duration | Output |
|---|---|---|
| 1. Spike: minimal `query()` for single test prompt | 1 day | Hello-world end-to-end |
| 2. Map SDK message types → existing SSE events | 2-3 days | Frontend renders identically |
| 3. Cancellation through Dramatiq + interrupt buffer drain | 1 day | Disconnect-cancel works in staging |
| 4. Port custom tools to `@tool` MCP server | 2 days | Functional parity |
| 5. Hooks: secret scan, typecheck, build verify | 2 days | Existing safety checks restored |
| 6. Author first 5 skills | 3-4 days | Visible quality lift on small/medium |
| 7. Cost & quality benchmarking on 20 fixed prompts | 2 days | Go/no-go data |
| 8. Production rollout behind feature flag; 5%/25%/100% | 1 week elapsed | Full migration |

**Total: 3-4 weeks** of senior-dev focused work. Highest-risk: phase 2 (event mapping). Highest-leverage: phase 6 (skills).

### Open questions

1. **Where do skills live in production?** Each workspace's `.claude/skills/`, or bundled via `plugins`? Recommend: bundled, central updates.
2. **Persistent workspaces for resume, or always fresh?** Persistent = GC needed. Fresh = lose resume on failure.
3. **Per-user vs shared API key?** Shared = better caching. Per-user = transparent billing.
4. **Subagent strategy** — defer or commit to specific subagents first?

---

## TL;DR — top 5 things before starting

1. **Pin `claude-agent-sdk >= 0.1.68`** and use `model="claude-sonnet-4-5"` with `fallback_model="claude-opus-4-7"`. Verify model IDs against `/v1/models` before flipping.
2. **Biggest cost win is `Edit` over current full-file `Write`** — 40-70% output token reduction on iterations. Keep `Write` as fallback when Edit anchors fail.
3. **Skills require BOTH `setting_sources=["project"]`/`["user"]` AND `"Skill"` in `allowed_tools`.** Get this wrong → silent skill load failure. Author 5 skills first (CRUD, auth, PWA shell, form, design-system).
4. **Ship `acceptEdits` mode + tight `disallowed_tools` + secret-scan `PreToolUse` + typecheck `PostToolUse`.** Replaces ~80% of hand-rolled safety code. `bypassPermissions` ignores `allowed_tools` — only `disallowed_tools` and hooks stop it.
5. **Use `ClaudeSDKClient` (not bare `query()`) for cancellation, ALWAYS drain buffer after `interrupt()` before next query.** Documented footgun. Skip subagents for V1.

---

**Sources:**

- [Agent SDK Overview](https://code.claude.com/docs/en/agent-sdk/overview.md)
- [Python SDK Reference](https://code.claude.com/docs/en/agent-sdk/python)
- [Skills in the SDK](https://code.claude.com/docs/en/agent-sdk/skills)
- [Skills authoring guide](https://code.claude.com/docs/en/skills)
- [Hooks](https://code.claude.com/docs/en/agent-sdk/hooks)
- [Permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
- [Custom tools / MCP](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- [Subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- [Streaming vs single mode](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [Cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking)
- [Migration guide](https://code.claude.com/docs/en/agent-sdk/migration-guide)
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [PyPI claude-agent-sdk](https://pypi.org/project/claude-agent-sdk/)
- [GitHub releases](https://github.com/anthropics/claude-agent-sdk-python/releases)
