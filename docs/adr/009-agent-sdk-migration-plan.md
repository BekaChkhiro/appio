# ADR 009 — Claude Agent SDK Migration Plan

**Date:** 2026-04-27
**Status:** Approved; ready to execute
**Related:** ADR 008 (research), ADR 008b (spike findings)

## Goals

1. Replace ~2,500 lines of hand-rolled tool loop in `apps/api/domains/generation/agent_service.py` with `claude-agent-sdk` orchestration
2. Enable Skills (`.claude/skills/`) for stack-specific patterns (Convex CRUD, auth, PWA shell)
3. Enable Hooks for safety (secret-scan, sandbox enforcement, post-write typecheck)
4. Adopt built-in `Edit` tool to reduce iteration cost 40-70%
5. Migrate without disrupting users — feature flag rollout, gradual cutover

## Non-goals (V1)

- Subagents (defer until evidence main agent is context-bound)
- Per-token streaming (`include_partial_messages=False`)
- Multi-agent decomposition (schema/UI/auth split)
- Replacing the screenshot-and-critique flow (Phase 2+)

---

## Phases

### Phase 0 — Foundation (1 day) ✅ DONE

- [x] Audit existing builder (ADR 008 §1-2)
- [x] Research SDK capabilities (ADR 008)
- [x] Spike: install SDK, run hello-world end-to-end, capture findings (ADR 008b)
- [x] Add `claude-agent-sdk>=0.1.68` to `apps/api/pyproject.toml`

### Phase 1 — Core agent loop replacement (2-3 days)

**Outcome:** `run_build()` works end-to-end via SDK against a single test prompt. Custom tool loop deleted.

Files:

| File | Change |
|---|---|
| `apps/api/domains/generation/agent_service.py` | Replace `_run_tool_loop` (~600 lines) with `ClaudeSDKClient` + `client.query()` + `async for` loop. Keep public `AgentService` interface intact. |
| `apps/api/domains/generation/sdk_runner.py` | NEW. Thin wrapper around `ClaudeSDKClient` with our SSE event mapping. |
| `apps/api/domains/generation/sdk_event_map.py` | NEW. `Message` → SSE event translator. Drop-in matches existing event types: `status`, `text`, `tool_call`, `tool_result`, `complete`, `error`. |
| `apps/api/domains/generation/model_router.py` | Fix model ID: `claude-sonnet-4-6` → `claude-sonnet-4-5`. Drop hand-rolled cache control logic (SDK manages). |
| `apps/api/domains/generation/agent_tools.py` | DELETE (~300 lines). Built-in Read/Write/Edit/Bash replace these. |

System prompt:
```python
system_prompt={
    "type": "preset",
    "preset": "claude_code",   # inherits Claude Code's coding-tuned prompt
    "append": APPIO_STACK_RULES,  # our existing prompt content, slimmed
}
```

`ClaudeAgentOptions` core:
```python
options = ClaudeAgentOptions(
    model="claude-sonnet-4-5",
    fallback_model="claude-opus-4-7",
    cwd=workspace_path,
    permission_mode="acceptEdits",
    allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Skill"],
    disallowed_tools=["WebFetch", "WebSearch", "NotebookEdit"],
    setting_sources=["project"],   # for skills (Phase 4)
    max_turns=80,
    max_budget_usd=2.50,
    enable_file_checkpointing=True,
    env={"ANTHROPIC_API_KEY": settings.anthropic_api_key},
)
```

**Cancellation wiring:** use `ClaudeSDKClient` (not `query()`). On SSE client disconnect → set `asyncio.Event` → loop checks → `await client.interrupt()` + drain buffer.

**Acceptance criteria:**
- Existing test "build me a simple counter app" returns a working `dist/` folder
- All existing SSE event types fire in correct order
- `git diff` net deletion ≥ 1500 lines

### Phase 2 — Sandbox + safety hooks (1-2 days)

**Outcome:** spike-discovered `acceptEdits` sandbox gap closed. Production-grade safety equal to or better than current.

Files:

| File | Change |
|---|---|
| `apps/api/domains/generation/sdk_hooks.py` | NEW. Hooks: `sandbox_path_hook` (PreToolUse Write/Edit/Bash), `secret_scan_hook` (PreToolUse Write/Edit), `post_write_typecheck_hook` (PostToolUse Write/Edit), `forbidden_files_hook` (e.g., `.env`, `package-lock.json`). |
| `apps/api/domains/generation/agent_service.py` | Wire hooks into `ClaudeAgentOptions(hooks={...})`. |

**Sandbox hook (CRITICAL — spike showed `acceptEdits` doesn't enforce cwd):**
```python
async def sandbox_path_hook(input_data, tool_use_id, context):
    fp = input_data["tool_input"].get("file_path")
    if fp and not Path(fp).resolve().is_relative_to(Path(input_data["cwd"]).resolve()):
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": f"Path {fp} is outside workspace",
            }
        }
    return {}
```

**Acceptance criteria:**
- Manual test: prompt agent to "write to /tmp/foo.py" → hook denies
- Secret pattern in code → hook denies
- TypeScript error after Write → injected as `additionalContext` for next turn

### Phase 3 — Custom MCP tools (2 days)

**Outcome:** Appio-specific tools exposed as MCP server. Examples: `run_build` (existing wrapper), `screenshot_app` (Playwright), `provision_convex_dev`.

Files:

| File | Change |
|---|---|
| `apps/api/domains/generation/sdk_mcp.py` | NEW. `create_sdk_mcp_server(name="appio", tools=[...])`. |
| Existing `screenshot.py`, `build.py` etc. | Wrap in `@tool` decorators. |

```python
@tool("run_build", "Build the Next.js app and return logs", {"workspace_path": str})
async def run_build_tool(args):
    result = await build_workspace(args["workspace_path"])
    return {"content": [{"type": "text", "text": result.summary}]}
```

**Acceptance criteria:**
- Agent can call `mcp__appio__run_build` and get same result as before
- All existing custom tools have MCP equivalents OR are confirmed redundant (Read/Write/Bash cover them)

### Phase 4 — Skills (3-4 days)

**Outcome:** First 5 skills authored, auto-load working. Visible quality lift on small/medium builds.

Files:

| File | Change |
|---|---|
| `packages/skills/.claude/skills/build-convex-crud/SKILL.md` | NEW |
| `packages/skills/.claude/skills/build-convex-auth/SKILL.md` | NEW |
| `packages/skills/.claude/skills/build-nextjs-pwa-shell/SKILL.md` | NEW |
| `packages/skills/.claude/skills/build-form-with-validation/SKILL.md` | NEW |
| `packages/skills/.claude/skills/build-tailwind-design-system/SKILL.md` | NEW |
| `apps/api/domains/generation/agent_service.py` | Add `plugins=[{"type":"local","path":"/opt/appio/skills"}]` (prod) or repo path (dev) |
| `docker/Dockerfile.api` | `COPY packages/skills /opt/appio/skills` |

**Skill authoring rules** (from ADR 008):
- ≤ 500 lines body
- Description front-loads keywords
- `paths:` frontmatter to scope when possible
- Reference supporting files for detail (loaded only when linked)

**Acceptance criteria:**
- Manual test: prompt "build me a habit tracker" triggers `build-convex-crud` skill
- 20 fixed prompts benchmarked: average build quality (manual rubric) higher than baseline

### Phase 5 — Production rollout (1-2 weeks elapsed)

**Outcome:** All traffic on Agent SDK; old code deleted.

Files:

| File | Change |
|---|---|
| `apps/api/config.py` | Add `use_agent_sdk: bool` setting (env-driven). |
| `apps/api/domains/generation/router.py` | Branch: legacy path vs SDK path based on flag. |
| `apps/api/domains/generation/agent_service.py` | Eventually delete legacy path. |

Rollout:
1. Deploy with `USE_AGENT_SDK=true` for internal users only (`@appio.app`/admin emails)
2. 5% of new users → 25% → 100% (1 week of monitoring at each step)
3. Watch: cost/build, build success rate, p50/p95 latency, error types
4. After 100% stable for 1 week: delete legacy code

**Rollback strategy:** flip flag back to `false`; legacy code stays in git for 2 sprints minimum.

---

## File-by-file diff summary

```
ADD:
  apps/api/domains/generation/sdk_runner.py        (~150 lines)
  apps/api/domains/generation/sdk_event_map.py     (~80 lines)
  apps/api/domains/generation/sdk_hooks.py         (~120 lines)
  apps/api/domains/generation/sdk_mcp.py           (~100 lines)
  packages/skills/.claude/skills/*/SKILL.md        (5 files, ~200 lines each)

MODIFY:
  apps/api/domains/generation/agent_service.py     (~2,500 → ~400 lines)
  apps/api/domains/generation/model_router.py      (-100 lines, fix model ID)
  apps/api/pyproject.toml                          (+1 dep)
  docker/Dockerfile.api                            (+1 COPY)
  apps/api/config.py                               (+1 setting)

DELETE:
  apps/api/domains/generation/agent_tools.py       (~300 lines)
  apps/api/domains/generation/cache_control.py     (if separate; SDK manages)
  Hand-rolled retry/repair helpers in agent_service.py

NET: -1,800 lines, +1 dep
```

---

## Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `acceptEdits` cwd gap → write outside workspace | 🔴 | Sandbox hook in Phase 2 (mandatory before any production traffic) |
| Edit tool fail rate on duplicate code blocks | 🟡 | Track via `PostToolUseFailure`; fall through to Write when anchor ambiguous |
| 6s per-session boot latency adds to user-perceived wait | 🟡 | Phase 5: client pooling per Dramatiq worker |
| Skill description budget exceeded → silent truncation | 🟡 | Lint check in CI; cap at 30 skills + use `paths:` |
| Caching invalidation per per-user API key | 🟡 | V1 keep shared API key for cache stability; per-user billing via Usage API |
| Migration breaks SSE event contract → frontend regressions | 🔴 | Phase 1 acceptance: snapshot-test event sequence; visual diff with frontend |
| `claude-sonnet-4-6` ID was wrong all along | 🔴 | Fixed in Phase 1; verify against `/v1/models` before flip |

---

## Cost projection

Current observed: ~$0.48 per build (single Claude API call, 5-10 turns).

Projected post-migration (Sonnet 4.5, full caching):

| Phase | Cost/build (median) | Notes |
|---|---|---|
| Phase 1 only (no skills, no Edit) | $0.30-0.40 | SDK caching saves ~30%. |
| Phase 1+2 (with hooks) | $0.30-0.40 | Hooks are nearly free. |
| Phase 1+2+3 (custom tools) | $0.30-0.45 | MCP tool overhead ~5%. |
| **Phase 1-4 (with skills, Edit, full pipeline)** | **$0.15-0.30** | Edit reduces iteration cost; skills avoid re-deriving patterns. |

Expected aggregate savings at scale: **40-50% per build**, mostly on iterations (edits/repairs).

---

## Timeline

| Phase | Duration | Calendar |
|---|---|---|
| Phase 0 (done) | 0.5 day | done |
| Phase 1 — agent loop | 2-3 days | week 1 |
| Phase 2 — hooks | 1-2 days | week 1 |
| Phase 3 — MCP tools | 2 days | week 2 |
| Phase 4 — skills | 3-4 days | week 2 |
| Phase 5 — rollout | 1-2 weeks elapsed (mostly observation) | weeks 3-4 |

**Total: ~3 weeks** from start of Phase 1 to 100% production.

---

## Open questions for the user

1. **Per-user vs shared Anthropic API key for builds?**
   - Shared = better caching (we'll save more)
   - Per-user = transparent billing per user
   - Recommend: shared for V1, swap to per-user after stable

2. **Where do skills live?**
   - Repo-bundled (`packages/skills/`) and `COPY` into Docker
   - Or per-workspace `.claude/skills/` (loaded fresh each build)
   - Recommend: repo-bundled (centralized updates, cache hits across builds)

3. **Persistent session resume?**
   - SDK supports `resume="<session_id>"` — could let users edit-then-pause-then-resume
   - V1: skip; V2 if it becomes a top user request

---

## Decision

Proceed with Phase 1 immediately. Phase 2 must complete BEFORE any production traffic flips. Phases 3-5 sequential.
