"""Claude agent generation service.

This is the agent-mode counterpart to ``service.GenerationService``.
Instead of asking Claude for a JSON spec that a deterministic codegen
turns into a React project, we give Claude direct file-system tools
(read/write/list/build) and let it build the project itself, the same
way Claude Code works.

Pipeline:

    1. Set up a workspace from packages/templates/base
       (copy + npm install so esbuild can run)
    2. Run a Claude tool-use loop:
        - Claude calls list_files / read_file / write_file / run_build
        - Each call is executed against the workspace and the result is
          returned to Claude
        - Loop ends when Claude stops requesting tools or hits a budget cap
    3. Hand the workspace off to ``Orchestrator.build_from_workspace``
       which runs the existing validate → R2 → KV pipeline
    4. Persist the generation record and stream SSE events along the way

The same Generation DB row is used so the existing builds router /
status page Just Works for agent generations too — only ``hybrid_spec``
is left null since there is no JSON spec.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import anthropic
import sentry_sdk
import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from appio_builder.agent_tools import (
    AgentToolError,
    list_files,
    read_file,
    run_build,
    write_file,
)
from appio_builder.config import BuildConfig
from appio_builder.orchestrator import BuildError, Orchestrator
from appio_builder.r2 import R2Client
from appio_builder.workspace_cleanup import workspace_ttl_for_tier
from appio_db.models import App, Generation
from apps.api.config import settings
from apps.api.domains.generation.cost_tracker import (
    CostEvent,
    build_model_breakdown,
    record_generation_cost,
)
from apps.api.domains.generation.critique import (
    CritiqueError,
    CritiqueResult,
    request_critique,
)
from apps.api.domains.generation.linter import MidStreamLinter
from apps.api.domains.generation.model_router import (
    SONNET_4_6,
    AgentStep,
    TokenTracker,
    pick_model,
)
from apps.api.domains.generation.planning import (
    PlanningError,
    generate_plan,
)
from apps.api.domains.generation.rag import (
    format_snippets_for_prompt,
    retrieve_snippets,
)
from apps.api.domains.generation.mockup import (
    MockupError,
    compose_mockups,
)
from apps.api.domains.generation.screenshot import (
    ScreenshotError,
    ScreenshotResult,
    capture_app_screenshots,
)

logger = structlog.stdlib.get_logger()

# Hard limits to keep one runaway agent from costing $100. PROJECT_PLAN.md
# T1.3 sets the target at 15 iterations — budget cap is still the real
# governor (a cheap loop can use more turns, an expensive one trips the
# $0.50 cap well before 15). Override via APPIO_MAX_GENERATION_ITERATIONS
# env var for A/B testing.
_MAX_TOOL_ITERATIONS = settings.max_generation_iterations

# ---------------------------------------------------------------------------
# "Built with Appio" badge — injected server-side into dist/index.html for
# free-tier apps.  Pure HTML + inline CSS, no JS required.  The badge is
# appended right before </body> so it sits on top of the React root.
#
# CSP compatible: uses only inline styles (style-src 'unsafe-inline' allowed)
# and a plain <a> tag pointing to appio.app with UTM tracking params.
# ---------------------------------------------------------------------------

_APPIO_BADGE_TEMPLATE = """\
<!-- Built with Appio badge (free tier) -->
<style>
.appio-badge{{position:fixed!important;\
bottom:calc(env(safe-area-inset-bottom,0px) + 84px)!important;\
left:12px!important;right:auto!important;\
z-index:2147483647!important;display:flex!important;visibility:visible!important;\
opacity:.78!important;background:rgba(30,30,30,.88)!important;\
backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);\
border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:4px 9px;\
font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\
font-size:10.5px;line-height:1;color:rgba(255,255,255,.82);\
text-decoration:none;align-items:center;gap:4px;\
transition:opacity .2s;box-shadow:0 2px 6px rgba(0,0,0,.25);\
pointer-events:auto!important;clip:auto!important;overflow:visible!important}}\
.appio-badge:hover{{opacity:1!important;color:#fff}}\
.appio-badge svg{{width:11px;height:11px;flex-shrink:0}}
</style>
<a class="appio-badge" href="https://appio.app?utm_source=badge&amp;utm_medium=pwa&amp;utm_campaign=built_with&amp;utm_content={slug}" target="_blank" rel="noopener" aria-label="Built with Appio — create your own app">
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M8 15l4-8 4 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="9.5" y1="13" x2="14.5" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
Built with Appio
</a>
"""


def _inject_appio_badge(dist_dir: Path, *, slug: str = "") -> bool:
    """Inject the 'Built with Appio' badge into dist/index.html.

    Inserts the badge HTML right before the closing ``</body>`` tag
    (case-insensitive match).  Returns True if the badge was
    successfully injected, False otherwise.

    This is a server-side injection — the badge is not part of the
    agent's generated code, so users cannot remove it by editing their
    app source.  Critical display properties use ``!important`` to
    resist agent-generated CSS overrides.
    """
    index_html = dist_dir / "index.html"
    if not index_html.is_file():
        return False

    html = index_html.read_text(encoding="utf-8")

    # Case-insensitive search for </body>
    match = re.search(r"</body>", html, re.IGNORECASE)
    if match is None:
        return False

    badge_html = _APPIO_BADGE_TEMPLATE.format(slug=slug)
    html = html[: match.start()] + badge_html + html[match.start() :]
    index_html.write_text(html, encoding="utf-8")
    return True


# Stricter cap for the post-vision fix pass — we want targeted edits, not
# another full development cycle.
_MAX_FIX_PASS_ITERATIONS = 5

# Haiku-backed fix passes can loop on hard problems; after this many
# consecutive failed run_build calls, escalate to Sonnet for the rest of
# the fix pass (PROJECT_PLAN.md T1.2 quality guardrail).
_FIX_PASS_HAIKU_FAILURE_THRESHOLD = 2

# Cost budget allocation — total comes from settings (PROJECT_PLAN.md T1.3
# targets $0.50/gen, down from the $1.50 baseline after T1.1 caching +
# T1.2 Haiku autofix). Splitting it across phases prevents the generation
# loop from exhausting the budget and leaving nothing for the vision pass /
# fix pass (producing an overrun). Reserves are worst-case estimates and do
# NOT roll over, keeping the generation-loop cap predictable regardless of
# whether critique runs.
_MAX_COST_USD = settings.max_generation_cost_usd
_CRITIQUE_RESERVE_USD = settings.critique_reserve_usd  # 1 vision critique call (Sonnet)
_FIX_PASS_RESERVE_USD = settings.fix_pass_reserve_usd  # Haiku-backed fix pass

# The agent's initial (pre-critique) loop must leave enough budget for
# both critique and a possible fix pass.
_GENERATION_LOOP_BUDGET_USD = round(
    _MAX_COST_USD - _CRITIQUE_RESERVE_USD - _FIX_PASS_RESERVE_USD, 2
)

_AGENT_TIMEOUT_S = 600.0  # 10 minutes wall-clock

_MAX_TOKENS_PER_TURN = 8192

_PROMPTS_DIR = Path(__file__).resolve().parents[4] / "packages" / "prompts"
_TEMPLATES_DIR = Path(__file__).resolve().parents[4] / "packages" / "templates"
_BASE_TEMPLATE = _TEMPLATES_DIR / "base"

# Pre-warmed golden workspace with node_modules already installed.
# Built once via ``warm_golden_workspace()`` (startup / CLI), then
# copied wholesale into per-generation workspaces — drops setup from
# ~15 s (npm install) to ~0.5 s (directory copy).
# Path is configurable via GOLDEN_WORKSPACE_PATH env var (for local dev).
_GOLDEN_WORKSPACE = Path(settings.golden_workspace_path)

# Tailwind v4 CSS-first configuration with class-based dark mode strategy.
# Toggling the `dark` class on <html> activates `dark:` variants throughout
# the UI component library. The agent must NOT modify this file.
#
# IMPORTANT: We patch Tailwind v4's broken `space-y-*` and `space-x-*`
# rules. Tailwind v4 compiles these utilities with a CSS Nesting selector
# `.space-y-N { :where(> :not(:last-child)) { margin-block-end: ... } }`
# which is invalid in current Chromium and silently produces no margins.
# We re-declare the same utilities using the v3 sibling-combinator syntax
# (`> :not(:last-child)`) which works in every modern browser.
_AGENT_GLOBAL_CSS = """\
@import "tailwindcss";

/* Class-based dark mode: <html class="dark"> activates `dark:` variants. */
@variant dark (&:where(.dark, .dark *));

/* --- space-y / space-x patch (Tailwind v4 nested-syntax workaround) --- */
.space-y-1 > :not(:last-child) { margin-bottom: 0.25rem; }
.space-y-1\\.5 > :not(:last-child) { margin-bottom: 0.375rem; }
.space-y-2 > :not(:last-child) { margin-bottom: 0.5rem; }
.space-y-2\\.5 > :not(:last-child) { margin-bottom: 0.625rem; }
.space-y-3 > :not(:last-child) { margin-bottom: 0.75rem; }
.space-y-4 > :not(:last-child) { margin-bottom: 1rem; }
.space-y-5 > :not(:last-child) { margin-bottom: 1.25rem; }
.space-y-6 > :not(:last-child) { margin-bottom: 1.5rem; }
.space-y-8 > :not(:last-child) { margin-bottom: 2rem; }
.space-y-10 > :not(:last-child) { margin-bottom: 2.5rem; }
.space-y-12 > :not(:last-child) { margin-bottom: 3rem; }

.space-x-1 > :not(:last-child) { margin-right: 0.25rem; }
.space-x-1\\.5 > :not(:last-child) { margin-right: 0.375rem; }
.space-x-2 > :not(:last-child) { margin-right: 0.5rem; }
.space-x-3 > :not(:last-child) { margin-right: 0.75rem; }
.space-x-4 > :not(:last-child) { margin-right: 1rem; }
.space-x-5 > :not(:last-child) { margin-right: 1.25rem; }
.space-x-6 > :not(:last-child) { margin-right: 1.5rem; }
"""


# Minimal CSP-safe index.html for the agent path. esbuild's post-build
# step still replaces {{ENTRY_JS}} and the {{ENTRY_CSS}} HTML comment
# with the actual hashed bundle paths.
#
# CRITICAL: Do NOT add a `* { padding: 0 }` reset here. Tailwind v4 wraps
# its utility classes in CSS cascade layers, which makes layer-less inline
# rules win over utility classes regardless of specificity. A naïve `*`
# reset effectively disables ALL padding/margin utilities and breaks every
# component built on the library.  Tailwind v4's built-in preflight
# already handles box-sizing and base resets — we don't need anything else.
_AGENT_INDEX_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#6366f1" />
  <!-- The agent MUST overwrite this title with the real app name via a
       runtime document.title assignment (see system prompt rule 3c). -->
  <title>App</title>
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" href="/icon-192.png" type="image/png" />
  <link rel="apple-touch-icon" href="/icon-192.png" />
  <!-- {{ENTRY_CSS}} -->
  <style>
    /* Layer-less rules safe to keep — body bg + html dark variant + viewport. */
    html, body { background: #f3f4f6; }
    html.dark, html.dark body { background: #000; }
    body { -webkit-font-smoothing: antialiased; }
    /* Lock the document to the viewport so only the app's middle region
       scrolls — headers and bottom navs stay pinned. Apps that need the
       whole page scrollable can opt out by setting overflow:auto on their
       own container inside #root; #root itself stays clipped. */
    html, body {
      height: 100%;
      margin: 0;
      overflow: hidden;
      overscroll-behavior: none;
    }
    #root {
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    /* Real devices (PWA-installed on iOS) supply the inset via env(). */
    html:not([data-preview]) #root {
      padding-top: env(safe-area-inset-top, 0);
      padding-bottom: env(safe-area-inset-bottom, 0);
    }
    /* Preview iframe embeds the app inside a faux phone frame with a
       Dynamic Island notch at the top and a home indicator at the bottom.
       env() returns 0 in a regular browser, so we hardcode safe-area-like
       insets when the parent sets data-preview, keeping app content clear
       of the frame chrome. */
    html[data-preview] #root {
      padding-top: 44px;
      padding-bottom: 34px;
    }

    /* ========= Install Gate (scoped to .appio-gate-* so Tailwind layers untouched) ========= */
    .appio-gate {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 20px; overflow-y: auto;
      background: linear-gradient(160deg, #6366f1 0%, #8b5cf6 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .appio-gate-card {
      background: #fff; border-radius: 24px; padding: 28px 22px;
      max-width: 380px; width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
      text-align: center;
    }
    .appio-gate-icon {
      position: relative;
      width: 84px; height: 84px; border-radius: 20px;
      margin: 0 auto 14px;
      overflow: hidden;
      background: #6366f1;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      color: #fff; font-size: 36px; font-weight: 700;
    }
    .appio-gate-icon-fallback {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .appio-gate-icon img {
      position: relative; z-index: 1;
      width: 100%; height: 100%; display: block; object-fit: cover;
    }
    .appio-gate-title { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 6px; line-height: 1.25; }
    .appio-gate-subtitle { font-size: 14px; color: #6b7280; margin-bottom: 22px; line-height: 1.5; }
    .appio-gate-btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; background: #6366f1; color: #fff;
      border: none; border-radius: 12px; padding: 14px 20px;
      font-size: 16px; font-weight: 600; cursor: pointer;
    }
    .appio-gate-btn:active { opacity: 0.88; transform: scale(0.98); }
    .appio-gate-btn[disabled] { opacity: 0.55; cursor: default; }
    .appio-gate-steps { text-align: left; }
    .appio-gate-step { display: flex; gap: 12px; align-items: flex-start; padding: 11px 0; border-top: 1px solid #f3f4f6; }
    .appio-gate-step:first-child { border-top: none; padding-top: 4px; }
    .appio-gate-step-num {
      flex-shrink: 0;
      width: 26px; height: 26px; border-radius: 50%;
      background: #6366f1; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
    }
    .appio-gate-step-text { font-size: 14px; color: #374151; line-height: 1.5; padding-top: 3px; }
    .appio-gate-step-text strong { color: #111827; font-weight: 600; }
    .appio-gate-share-icon {
      display: inline-flex; vertical-align: middle; margin: 0 1px;
      width: 16px; height: 18px;
    }
    .appio-gate-hint { margin-top: 14px; font-size: 12px; color: #9ca3af; line-height: 1.5; }
    .appio-gate-hint strong { color: #6b7280; font-weight: 600; }
    .appio-gate-footer {
      margin-top: 22px; font-size: 12px; color: rgba(255, 255, 255, 0.9); text-align: center;
    }
    .appio-gate-footer a { color: #fff; text-decoration: none; font-weight: 600; border-bottom: 1px solid rgba(255, 255, 255, 0.5); }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="appio-gate-container"></div>
  <script src="/gate.js" data-entry="{{ENTRY_JS}}"></script>
</body>
</html>
"""


def _load_agent_system_prompt() -> str:
    return (_PROMPTS_DIR / "v1" / "agent_system.md").read_text(encoding="utf-8")


# Signature string from the base template's placeholder App.tsx. If the
# deployed bundle still contains this, the agent never wrote src/App.tsx
# and we'd otherwise ship a useless "App is loading…" screen to the user.
# Kept in sync with packages/templates/base/src/App.tsx.
_APP_TSX_PLACEHOLDER_MARKER = "__APPIO_PLACEHOLDER_APP_TSX_DO_NOT_SHIP__"


def _app_tsx_is_placeholder(workspace: Path) -> bool:
    """Return True if src/App.tsx still contains the base-template stub.

    The base template ships a valid-but-useless App.tsx so the workspace
    builds from iteration zero. If the agent forgets to overwrite it, the
    build still succeeds and we'd deploy the stub — which is exactly what
    happened in the fitness-tracker regression. Check for the signature
    marker string on every build so the agent gets immediate feedback.
    """
    app_tsx = workspace / "src" / "App.tsx"
    if not app_tsx.is_file():
        # Missing App.tsx would fail the build elsewhere; don't mask it.
        return False
    try:
        return _APP_TSX_PLACEHOLDER_MARKER in app_tsx.read_text(encoding="utf-8")
    except Exception:
        return False


def _firebase_config_ts() -> str:
    """Generate ``src/config/firebase.ts`` with the shared Firebase Web SDK config.

    This file is always injected into the workspace so the agent can import
    it when the app needs auth.  esbuild tree-shakes the firebase import if
    ``useAuth`` is never called, so the bundle stays lean for non-auth apps.
    """
    return f"""\
import type {{ FirebaseConfig }} from "../components/ui";

export const firebaseConfig: FirebaseConfig = {{
  apiKey: "{settings.firebase_web_api_key}",
  authDomain: "{settings.firebase_web_auth_domain}",
  projectId: "{settings.firebase_project_id}",
  storageBucket: "{settings.firebase_web_storage_bucket}",
  messagingSenderId: "{settings.firebase_web_messaging_sender_id}",
  appId: "{settings.firebase_web_app_id}",
}};
"""



# ── Prompt-cache strategy (PROJECT_PLAN.md T1.1) ────────────────────────
#
# Anthropic lets us place up to 4 cache_control markers on a single
# messages.create() call. Each marker caches the prefix ending at that
# block. We use 3 of the 4 slots and set their TTLs based on how stable
# each region is:
#
#   1. System prompt block         — 1h TTL (stable across sessions)
#   2. Tools array (last tool)     — 1h TTL (stable across sessions)
#   3. Messages tail (last user)   — 5m TTL (per-session conversation)
#
# Anything after the last marker is NOT cached — in particular, the RAG
# snippets block carries NO cache_control because its content varies per
# prompt and caching it would burn writes with no chance of reuse.
#
# The 1h TTL requires the ``extended-cache-ttl-2025-04-11`` beta header
# and costs 2× base input per cache write (vs 1.25× for 5m). It pays off
# for the system prompt + tools because those blocks see many reads per
# cache write within a 1h window.
#
# Telemetry: after every API call we record cache_read / cache_creation
# tokens into StepTokens. Generation-end logs an ``agent_cache_stats``
# event with the aggregate hit ratio; a Sentry context is also attached
# so any post-generation error surfaces cache health alongside the trace.
# Acceptance criterion (T1.1): ≥40% average cache_read ratio over 100
# sample generations — measured via the ``agent_cache_stats`` event.

_EXTENDED_CACHE_TTL_ENABLED = os.environ.get(
    "APPIO_CACHE_EXTENDED_TTL", "true"
).lower() in ("true", "1", "yes")

_EXTENDED_TTL_BETA_HEADER = "extended-cache-ttl-2025-04-11"


def _stable_cache_control() -> dict[str, Any]:
    """Cache-control marker for blocks that are stable across sessions.

    Used on the system prompt and the tools array — both versioned with
    the code, so a 1h TTL survives natural user gaps without getting
    invalidated. Falls back to 5m (ephemeral default) when the extended
    TTL flag is disabled, which removes the need for the beta header.
    """
    if _EXTENDED_CACHE_TTL_ENABLED:
        return {"type": "ephemeral", "ttl": "1h"}
    return {"type": "ephemeral"}


def _session_cache_control() -> dict[str, Any]:
    """Cache-control marker for per-session conversation state.

    5-minute TTL — conversation tails rotate quickly during an active
    agent loop, so a longer TTL would just pay higher write costs for
    prefixes that will never be hit again.
    """
    return {"type": "ephemeral"}


def _repair_tool_use_pairs(
    messages: list[dict[str, Any]],
    *,
    generation_id: str | None = None,
) -> list[dict[str, Any]]:
    """Ensure every ``tool_use`` block has a matching ``tool_result``.

    Anthropic rejects a conversation where an assistant message contains a
    ``tool_use`` block that isn't answered by a ``tool_result`` block with the
    same ``tool_use_id`` in the very next user message. A bug or mid-flight
    cancellation anywhere in the agent loop can leave a dangling tool_use,
    which then poisons every subsequent turn with a 400. Rather than fail the
    whole generation, we patch missing pairs with a synthetic error result so
    the agent can continue.

    Returns a new list; the input is not mutated. Any repair emits a warning
    log so the underlying bug stays visible.
    """
    if not messages:
        return messages

    repaired: list[dict[str, Any]] = []
    i = 0
    while i < len(messages):
        msg = messages[i]
        repaired.append(msg)

        if msg.get("role") != "assistant":
            i += 1
            continue

        # Collect tool_use ids in this assistant message.
        content = msg.get("content")
        tool_use_ids: list[str] = []
        if isinstance(content, list):
            for block in content:
                block_type = getattr(block, "type", None) if not isinstance(block, dict) else block.get("type")
                if block_type == "tool_use":
                    block_id = getattr(block, "id", None) if not isinstance(block, dict) else block.get("id")
                    if block_id:
                        tool_use_ids.append(block_id)

        if not tool_use_ids:
            i += 1
            continue

        # Inspect the next user message (if any) for matching tool_result ids.
        next_msg = messages[i + 1] if i + 1 < len(messages) else None
        have_ids: set[str] = set()
        if next_msg and next_msg.get("role") == "user":
            next_content = next_msg.get("content")
            if isinstance(next_content, list):
                for block in next_content:
                    block_type = block.get("type") if isinstance(block, dict) else getattr(block, "type", None)
                    if block_type == "tool_result":
                        tuid = (
                            block.get("tool_use_id")
                            if isinstance(block, dict)
                            else getattr(block, "tool_use_id", None)
                        )
                        if tuid:
                            have_ids.add(tuid)

        missing = [tuid for tuid in tool_use_ids if tuid not in have_ids]
        if not missing:
            i += 1
            continue

        logger.warning(
            "agent_messages_missing_tool_result_repaired",
            generation_id=generation_id,
            missing_ids=missing,
            had_next_user=next_msg is not None and next_msg.get("role") == "user",
        )

        synthetic_results = [
            {
                "type": "tool_result",
                "tool_use_id": tuid,
                "content": "tool execution was interrupted; continue without this result",
                "is_error": True,
            }
            for tuid in missing
        ]

        if next_msg and next_msg.get("role") == "user":
            merged_content: list[Any] = []
            existing = next_msg.get("content")
            if isinstance(existing, list):
                merged_content.extend(existing)
            elif isinstance(existing, str):
                merged_content.append({"type": "text", "text": existing})
            merged_content.extend(synthetic_results)
            repaired.append({**next_msg, "content": merged_content})
            i += 2
        else:
            repaired.append({"role": "user", "content": synthetic_results})
            i += 1

    return repaired


def _with_cache_breakpoint(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return a copy of ``messages`` with a cache_control marker on the
    most recent user message's last content block.

    This caches the entire conversation prefix up to that point, so each
    subsequent turn only pays the uncached price for the *new* delta.
    Uses the 5-minute ephemeral TTL — the message tail turns over fast
    as tool_result blocks accumulate, so 1h writes would rarely be hit.
    """
    if not messages:
        return messages

    # Find the LAST user message
    last_user_idx = None
    for i in range(len(messages) - 1, -1, -1):
        if messages[i].get("role") == "user":
            last_user_idx = i
            break
    if last_user_idx is None:
        return messages

    # Build a shallow copy of messages with the marker added.
    new_messages = list(messages)
    last_user = dict(messages[last_user_idx])
    content = last_user.get("content")

    # Normalise: a string content becomes a single text block
    if isinstance(content, str):
        new_content = [
            {"type": "text", "text": content, "cache_control": _session_cache_control()}
        ]
    elif isinstance(content, list) and content:
        # Mark the last block — this caches everything up through it.
        new_content = [dict(b) for b in content]
        last = dict(new_content[-1])
        last["cache_control"] = _session_cache_control()
        new_content[-1] = last
    else:
        return messages

    last_user["content"] = new_content
    new_messages[last_user_idx] = last_user
    return new_messages


# Tool schemas exposed to Claude
_TOOLS: list[dict[str, Any]] = [
    {
        "name": "list_files",
        "description": (
            "List files and directories at a path inside the workspace. "
            "Use '.' for the workspace root. Directories are suffixed with '/'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Workspace-relative path. Use '.' for root.",
                }
            },
            "required": ["path"],
        },
    },
    {
        "name": "read_file",
        "description": "Read the UTF-8 contents of a file inside the workspace.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Workspace-relative file path.",
                }
            },
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": (
            "Create or overwrite a file inside the workspace with the given contents. "
            "Always provide the COMPLETE file contents — there is no partial-edit tool. "
            "Allowed extensions: .tsx, .ts, .jsx, .js, .css, .json, .html, .svg, .md."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Workspace-relative file path.",
                },
                "content": {
                    "type": "string",
                    "description": "Full UTF-8 file contents.",
                },
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "run_build",
        "description": (
            "Run esbuild against the current workspace and return success/stderr. "
            "Use this to verify your code compiles. Call after meaningful changes "
            "and ALWAYS as the last step before stopping."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
]


def _tools_with_cache_control() -> list[dict[str, Any]]:
    """Return ``_TOOLS`` with a cache-control marker on the last entry.

    Anthropic caches the full tools array as a single prefix block when
    cache_control is present on any tool, so we mark only the last one.
    Built dynamically so the TTL follows ``_EXTENDED_CACHE_TTL_ENABLED``.
    """
    tools = [dict(t) for t in _TOOLS]
    tools[-1] = {**tools[-1], "cache_control": _stable_cache_control()}
    return tools


def _derive_app_name(prompt: str, max_len: int = 50) -> str:
    """Extract a short app name from the user's prompt.

    Strategy: use the first non-empty line, stripped of leading verbs
    like "Build a/an", "Create a/an". Falls back to the first 50 chars.
    Planning later updates this to the agent-chosen name.
    """
    first_line = next(
        (ln.strip() for ln in prompt.splitlines() if ln.strip()), prompt.strip()
    )
    import re as _re

    cleaned = _re.sub(
        r"^(build|create|make|design)\s+(a|an|the)?\s*",
        "",
        first_line,
        flags=_re.IGNORECASE,
    ).strip()
    # Collapse trailing "app/application" noise.
    cleaned = _re.sub(r"\s*(app|application)\b.*$", "", cleaned, flags=_re.IGNORECASE).strip()
    cleaned = cleaned.strip(".,:;")
    if not cleaned:
        cleaned = first_line
    if len(cleaned) > max_len:
        cleaned = cleaned[: max_len - 1].rstrip() + "…"
    # Title-case common patterns while leaving all-caps acronyms alone.
    return cleaned[:max_len] or "Untitled App"


def warm_golden_workspace() -> Path:
    """Build (or refresh) the golden workspace with pre-installed node_modules.

    Copies the base template into ``_GOLDEN_WORKSPACE`` and runs
    ``npm install`` once.  Subsequent ``_setup_workspace`` calls copy
    from here instead of running npm install per generation.

    Safe to call multiple times — it replaces the golden dir atomically
    (write to a temp dir, then rename).

    Returns the golden workspace path.
    """
    staging = _GOLDEN_WORKSPACE.with_name(_GOLDEN_WORKSPACE.name + ".staging")

    # Clean up any leftover staging dir from a previous interrupted run.
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)

    # Copy base template files.
    for entry in _BASE_TEMPLATE.iterdir():
        if entry.name in {"node_modules", "dist", ".git", "README.md"}:
            continue
        dest = staging / entry.name
        if entry.is_dir():
            shutil.copytree(entry, dest)
        else:
            shutil.copy2(entry, dest)

    # Overwrite index.html and global.css with agent-path versions so the
    # golden workspace is a ready-to-use snapshot.
    (staging / "index.html").write_text(_AGENT_INDEX_HTML, encoding="utf-8")
    global_css = staging / "src" / "styles" / "global.css"
    if global_css.is_file():
        global_css.write_text(_AGENT_GLOBAL_CSS, encoding="utf-8")

    # npm install into the staging dir.
    result = subprocess.run(  # noqa: S603 — controlled args, no shell
        ["npm", "install", "--no-audit", "--no-fund", "--loglevel=error"],
        cwd=str(staging),
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )
    if result.returncode != 0:
        shutil.rmtree(staging, ignore_errors=True)
        raise RuntimeError(
            f"npm install failed while warming golden workspace "
            f"(exit {result.returncode}):\n{result.stderr[:2000]}"
        )

    # Near-atomic swap: rename old → .old, move staging → target, then
    # delete .old.  Minimises the window where no golden dir exists, and
    # shutil.move works across filesystem boundaries (unlike Path.rename).
    old = _GOLDEN_WORKSPACE.with_name(_GOLDEN_WORKSPACE.name + ".old")
    if old.exists():
        shutil.rmtree(old)
    if _GOLDEN_WORKSPACE.exists():
        _GOLDEN_WORKSPACE.rename(old)
    shutil.move(str(staging), str(_GOLDEN_WORKSPACE))
    if old.exists():
        shutil.rmtree(old, ignore_errors=True)

    logger.info(
        "golden_workspace_warmed",
        path=str(_GOLDEN_WORKSPACE),
        node_modules_entries=len(list((_GOLDEN_WORKSPACE / "node_modules").iterdir())),
    )
    return _GOLDEN_WORKSPACE


class AgentService:
    """Run a Claude tool-use loop against a fresh PWA workspace.

    DB strategy: this service takes a session FACTORY rather than a single
    session, because the agent loop runs for several minutes and Neon's
    serverless pooler aggressively closes idle connections. Instead of
    holding one long-lived session, every DB operation opens its own
    short-lived session, commits, and closes immediately.
    """

    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._session_factory = session_factory
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            timeout=_AGENT_TIMEOUT_S,
        )

    # ------------------------------------------------------------------ DB

    async def _create_generation_record(
        self,
        user_id: uuid.UUID,
        prompt: str,
        app_id: uuid.UUID | None,
    ) -> uuid.UUID:
        """Insert the row and return its id. Session is closed immediately."""
        async with self._session_factory() as session:
            gen = Generation(
                user_id=user_id,
                app_id=app_id,
                prompt=prompt,
                build_status="generating",
            )
            session.add(gen)
            await session.flush()
            gen_id = gen.id
            await session.commit()
            return gen_id

    async def _update_generation(self, gen_id: uuid.UUID, **fields) -> None:
        """Apply field updates to a generation row in a fresh short-lived session.

        Retries once on Neon pooler `InterfaceError: connection is closed`.
        When the agent loop runs for 5+ minutes, the pooled connection
        SQLAlchemy holds can be silently killed by Neon's pooler — our
        `pool_pre_ping` covers stale checkouts, but NOT connections that
        die mid-transaction. On failure we discard the session and try
        again with a fresh one.
        """
        from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError

        last_err: Exception | None = None
        for attempt in range(2):
            try:
                async with self._session_factory() as session:
                    await session.execute(
                        update(Generation)
                        .where(Generation.id == gen_id)
                        .values(**fields)
                    )
                    await session.commit()
                return
            except (InterfaceError, OperationalError, DBAPIError) as exc:
                last_err = exc
                logger.warning(
                    "update_generation_connection_retry",
                    generation_id=str(gen_id),
                    attempt=attempt + 1,
                    error=str(exc)[:200],
                )
                # Fresh pool checkout on next loop iteration.
                continue

        # Both attempts failed — re-raise so callers can decide.
        assert last_err is not None
        raise last_err

    async def _flush_cost_to_db(
        self,
        gen_id: uuid.UUID,
        tracker: TokenTracker,
        critique_result: "CritiqueResult | None" = None,
        **extra_fields: Any,
    ) -> None:
        """Persist accumulated token usage + cost to the Generation row.

        Must be called on EVERY exit path (success + early failures) so
        user billing reconciles with Anthropic's real spend. Silently
        skipping this on budget/max_iterations exits lets a user burn
        Claude credits without their monthly budget ticking up.

        Also emits the per-generation ``agent_cache_stats`` event with
        aggregate cache hit metrics — this is the primary data source for
        the ≥40% cache-hit acceptance criterion in PROJECT_PLAN.md T1.1.
        """
        total_input = tracker.total_input_tokens
        total_output = tracker.total_output_tokens
        total_cost = round(tracker.total_cost_usd, 6)
        if critique_result is not None:
            total_cost = round(total_cost + critique_result.cost_usd, 6)

        # Cache telemetry — logged before DB flush because logs ship even
        # when Neon is having a bad minute. Extended TTL flag is included
        # so the dashboard can segment hit rates by cache strategy.
        cache_read = tracker.total_cache_read_tokens
        cache_write = tracker.total_cache_write_tokens
        hit_ratio = tracker.cache_hit_ratio
        # Per-step breakdown feeds the PostHog cost-per-step dashboard used
        # to verify T1.2's 75%-savings-on-fix-cycles target. Without this
        # the aggregate cost is the only visible number and Haiku/Sonnet
        # attribution has to be reverse-engineered from logs.
        per_step = tracker.per_step_summary()
        if cache_read or cache_write or total_input:
            logger.info(
                "agent_cache_stats",
                generation_id=str(gen_id),
                cache_read_tokens=cache_read,
                cache_write_tokens=cache_write,
                input_tokens=total_input,
                output_tokens=total_output,
                hit_ratio=hit_ratio,
                cost_usd=total_cost,
                extended_ttl=_EXTENDED_CACHE_TTL_ENABLED,
                per_step=per_step,
            )
            sentry_sdk.set_context(
                "claude_cache",
                {
                    "hit_ratio": hit_ratio,
                    "cache_read_tokens": cache_read,
                    "cache_write_tokens": cache_write,
                    "input_tokens": total_input,
                    "extended_ttl": _EXTENDED_CACHE_TTL_ENABLED,
                },
            )

        if total_input == 0 and total_output == 0 and not extra_fields:
            return  # nothing to persist

        try:
            await self._update_generation(
                gen_id,
                input_tokens=total_input,
                output_tokens=total_output,
                cost_usd=total_cost,
                **extra_fields,
            )
        except Exception:
            logger.exception(
                "cost_flush_failed",
                generation_id=str(gen_id),
            )

    async def _resolve_app_slug(
        self, app_id: uuid.UUID | None, user_id: uuid.UUID, prompt: str
    ) -> tuple[str, int, uuid.UUID]:
        """Return (slug, next_version, app_id).

        If ``app_id`` points to an existing app, reuse its slug and bump
        the version. Otherwise create a fresh App row so it shows up on
        the user's /my-apps dashboard immediately (status='building').
        The row is updated to 'ready' / 'failed' after the orchestrator
        completes via ``_finalize_app_record``.
        """
        if app_id is not None:
            async with self._session_factory() as session:
                result = await session.execute(select(App).where(App.id == app_id))
                app = result.scalar_one_or_none()
                if app is not None:
                    next_version = (app.current_version or 0) + 1
                    return app.slug, next_version, app.id

        # New app — create the row now so the user sees it building in
        # /my-apps. Derive a sensible name from the prompt's first line.
        slug = f"agent-{uuid.uuid4().hex[:10]}"
        name = _derive_app_name(prompt)
        async with self._session_factory() as session:
            new_app = App(
                user_id=user_id,
                slug=slug,
                name=name,
                status="building",
                current_version=1,
            )
            session.add(new_app)
            await session.flush()
            new_app_id = new_app.id
            await session.commit()
        return slug, 1, new_app_id

    async def _finalize_app_record(
        self,
        app_id: uuid.UUID,
        *,
        status: str,
        public_url: str | None = None,
        version: int | None = None,
        theme_color: str | None = None,
    ) -> None:
        """Update the App row at the end of generation. Retries on Neon drops."""
        fields: dict[str, Any] = {"status": status}
        if public_url is not None:
            fields["url"] = public_url
        if version is not None:
            fields["current_version"] = version
        if theme_color is not None:
            fields["theme_color"] = theme_color

        from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError

        for attempt in range(2):
            try:
                async with self._session_factory() as session:
                    await session.execute(
                        update(App).where(App.id == app_id).values(**fields)
                    )
                    await session.commit()
                return
            except (InterfaceError, OperationalError, DBAPIError) as exc:
                logger.warning(
                    "finalize_app_record_retry",
                    app_id=str(app_id),
                    attempt=attempt + 1,
                    error=str(exc)[:200],
                )
                if attempt == 1:
                    raise

    # ------------------------------------------------------------ workspace

    @staticmethod
    def _setup_workspace(workspace: Path) -> None:
        """Set up a generation workspace from the golden cache or base template.

        If a pre-warmed golden workspace exists at ``_GOLDEN_WORKSPACE``
        (built via ``warm_golden_workspace()``), the entire directory
        — including ``node_modules`` — is copied in one shot (~0.5 s).
        Otherwise falls back to copying the base template + ``npm install``
        (~15-30 s).

        Post-copy fixes applied regardless of source:

        - Overwrite ``index.html`` with the minimal CSP-safe version.
        - Overwrite ``src/styles/global.css`` with class-based dark mode
          Tailwind v4 config.
        """
        golden_node_modules = _GOLDEN_WORKSPACE / "node_modules"

        if golden_node_modules.is_dir():
            # Fast path: copy everything from the pre-warmed golden workspace.
            for entry in _GOLDEN_WORKSPACE.iterdir():
                if entry.name in {"dist", ".git", "README.md"}:
                    continue
                dest = workspace / entry.name
                if entry.is_dir():
                    shutil.copytree(entry, dest)
                else:
                    shutil.copy2(entry, dest)
            logger.info("workspace_setup_from_golden_cache", workspace=str(workspace))
        else:
            # Fallback: copy base template + npm install.
            logger.warning(
                "golden_workspace_missing_falling_back_to_npm_install",
                golden=str(_GOLDEN_WORKSPACE),
            )
            for entry in _BASE_TEMPLATE.iterdir():
                if entry.name in {"node_modules", "dist", ".git", "README.md"}:
                    continue
                dest = workspace / entry.name
                if entry.is_dir():
                    shutil.copytree(entry, dest)
                else:
                    shutil.copy2(entry, dest)

            result = subprocess.run(  # noqa: S603 — controlled args, no shell
                ["npm", "install", "--no-audit", "--no-fund", "--loglevel=error"],
                cwd=str(workspace),
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
            if result.returncode != 0:
                raise RuntimeError(
                    f"npm install failed (exit {result.returncode}):\n"
                    f"{result.stderr[:2000]}"
                )

        # --- Overwrite index.html with the minimal CSP-safe version ---
        (workspace / "index.html").write_text(_AGENT_INDEX_HTML, encoding="utf-8")

        # --- Overwrite global.css with class-based dark mode v4 config ---
        global_css = workspace / "src" / "styles" / "global.css"
        if global_css.is_file():
            global_css.write_text(_AGENT_GLOBAL_CSS, encoding="utf-8")

        # --- Inject Firebase config for auth-enabled apps ---
        # Always injected so the agent can import it when needed.
        # esbuild tree-shakes unused imports, so non-auth apps pay no cost.
        config_dir = workspace / "src" / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
        (config_dir / "firebase.ts").write_text(
            _firebase_config_ts(), encoding="utf-8"
        )

    # -------------------------------------------------------------- tool exec

    def _execute_tool(
        self,
        workspace: Path,
        tool_name: str,
        tool_input: dict[str, Any],
    ) -> tuple[str, bool]:
        """Run one tool. Returns (result_text, is_error)."""
        try:
            if tool_name == "list_files":
                return list_files(workspace, tool_input.get("path", ".")), False
            if tool_name == "read_file":
                return read_file(workspace, tool_input["path"]), False
            if tool_name == "write_file":
                return (
                    write_file(workspace, tool_input["path"], tool_input["content"]),
                    False,
                )
            if tool_name == "run_build":
                # Use workspace-local copy of esbuild.config.mjs — Node ESM
                # module resolution looks for `esbuild` in node_modules
                # relative to the SCRIPT's directory, not the cwd. The
                # workspace has its own node_modules from npm install.
                build_result = run_build(
                    workspace,
                    config_script=workspace / "esbuild.config.mjs",
                    timeout_seconds=120,
                )
                # Trim aggressively. On success the agent only needs to
                # know it worked. On failure we keep the last 2KB of
                # stderr where the actual error message is.
                if build_result.success:
                    # Guard against shipping the base-template stub: the
                    # build succeeds with the placeholder App.tsx intact
                    # because it's valid TSX, but deploying it would show
                    # "App is loading… placeholder" to the user.
                    if _app_tsx_is_placeholder(workspace):
                        payload = {
                            "success": False,
                            "stderr": (
                                "src/App.tsx is still the base-template placeholder. "
                                "You must OVERWRITE src/App.tsx with the actual app "
                                "implementation (composing your components, wiring the "
                                "store, rendering the real UI). The placeholder is "
                                "detected by the marker string "
                                "'__APPIO_PLACEHOLDER_APP_TSX_DO_NOT_SHIP__' — "
                                "the tripwire comment in the stub. Do NOT copy "
                                "this marker into your rewrite. Write a real "
                                "App.tsx and call run_build() again."
                            ),
                            "duration_seconds": round(build_result.duration_seconds, 2),
                        }
                        return json.dumps(payload), True
                    payload = {
                        "success": True,
                        "duration_seconds": round(build_result.duration_seconds, 2),
                    }
                else:
                    payload = {
                        "success": False,
                        "stderr": (build_result.stderr or "")[-2000:],
                        "duration_seconds": round(build_result.duration_seconds, 2),
                    }
                return json.dumps(payload), not build_result.success
            return f"unknown tool: {tool_name}", True
        except AgentToolError as exc:
            return f"tool error: {exc}", True
        except KeyError as exc:
            return f"missing required parameter: {exc}", True
        except Exception as exc:
            logger.exception("agent_tool_unexpected_error", tool=tool_name)
            return f"unexpected tool error: {exc}", True

    # -------------------------------------------------------- preview upload

    async def _upload_preview(
        self,
        dist_dir: Path,
        *,
        generation_id: str,
        turn: int,
        slug: str,
    ) -> str | None:
        """Upload dist/ to R2 as a temporary preview.

        Returns the preview URL on success, ``None`` on failure (best-effort).
        """
        if not dist_dir.is_dir() or not (dist_dir / "index.html").is_file():
            return None

        try:
            build_config = _build_config_from_settings()
            r2 = R2Client(
                account_id=build_config.r2_account_id,
                access_key=build_config.r2_access_key,
                secret_key=build_config.r2_secret_key,
                bucket=build_config.r2_bucket,
                endpoint_url=build_config.r2_endpoint,
            )
            result = await asyncio.to_thread(
                r2.upload_preview_dist,
                dist_dir,
                generation_id=generation_id,
                turn=turn,
            )
            preview_url = (
                f"https://{slug}.appiousercontent.com"
                f"/_preview/{generation_id}/{turn}/"
            )
            logger.info(
                "preview_uploaded",
                generation_id=generation_id,
                turn=turn,
                file_count=result.file_count,
                total_bytes=result.total_bytes,
                url=preview_url,
            )
            return preview_url
        except Exception as exc:
            logger.warning(
                "preview_upload_failed",
                generation_id=generation_id,
                turn=turn,
                error=str(exc),
            )
            return None

    # ------------------------------------------------------ agent loop core

    async def _run_tool_loop(
        self,
        *,
        workspace: Path,
        system_blocks: list[dict[str, Any]],
        messages: list[dict[str, Any]],
        tracker: TokenTracker,
        step: AgentStep,
        max_iterations: int,
        generation_id: str,
        iteration_offset: int = 0,
        linter: MidStreamLinter | None = None,
        budget_usd: float = _MAX_COST_USD,
    ):
        """Core Claude tool-use loop, factored out so it can run twice
        (once for the initial generation, once for the vision-fix pass).

        Mutates ``messages`` in place and records tokens in ``tracker``.
        Yields (event_type, payload) tuples for the caller to forward as
        SSE events. The final yielded tuple is always
        ``("done", {"reason": <reason>, "iterations": N, "final_text": str})``.
        Possible reasons:

        - ``"end_turn"`` — agent finished gracefully (no more tool calls)
        - ``"max_iterations"`` — exhausted the per-loop iteration cap
        - ``"budget"`` — global budget cap reached
        - ``"api_error"`` — Claude API call failed
        - ``"recovered"`` — API failed but workspace already had a dist/
          from a previous build, so we can still deploy
        """
        step_tokens = tracker.begin_step(step)
        model = step_tokens.model
        iterations = 0
        final_text = ""
        _has_called_run_build = False
        _has_written_files = False
        _build_nudge_sent = False
        # Per-build write counter. Sonnet 4.6 sometimes ignores the prompt's
        # "batch writes, then build" guidance and writes one file per turn
        # for dozens of iterations — burning the iteration budget without
        # ever verifying the code compiles. We inject an inline reminder
        # into tool results once this crosses the threshold; count resets
        # on every run_build.
        _writes_since_build = 0
        _BUILD_URGENT_NUDGE_THRESHOLD = 8
        # Tracks whether the MOST RECENT run_build call produced a working
        # dist/ — i.e. we have something shippable on hand. Used to treat
        # max_iterations as a graceful end-turn instead of a hard failure.
        _has_successful_build = False
        # Fix-pass guardrail: Haiku is fast and cheap but can loop on
        # architectural problems. Count consecutive failed run_build calls
        # and escalate to Sonnet after the threshold (T1.2).
        _fix_pass_consecutive_build_failures = 0
        _fix_pass_fallback_active = False

        logger.info(
            "agent_loop_model_selected",
            generation_id=generation_id,
            step=step.value,
            model=model.model_id,
        )

        while iterations < max_iterations:
            iterations += 1

            try:
                safe_messages = _repair_tool_use_pairs(
                    messages, generation_id=generation_id
                )
                cached_messages = _with_cache_breakpoint(safe_messages)
                extra_headers: dict[str, str] = {}
                if _EXTENDED_CACHE_TTL_ENABLED:
                    extra_headers["anthropic-beta"] = _EXTENDED_TTL_BETA_HEADER

                # Retry transient Anthropic overload (529) and rate limit
                # (429) with exponential backoff. These are server-side
                # hiccups, not bugs in our prompts — a 30-90s wait usually
                # clears them. After 3 attempts we give up and let the
                # existing error path fire so the generation doesn't hang.
                response = None
                last_exc: Exception | None = None
                for attempt in range(3):
                    try:
                        response = await self._client.messages.create(
                            model=model.model_id,
                            max_tokens=_MAX_TOKENS_PER_TURN,
                            system=system_blocks,
                            tools=_tools_with_cache_control(),
                            messages=cached_messages,
                            extra_headers=extra_headers or None,
                        )
                        break
                    except Exception as exc_inner:
                        msg = str(exc_inner).lower()
                        transient = (
                            "overloaded" in msg
                            or "529" in msg
                            or "rate_limit" in msg
                            or "429" in msg
                        )
                        if not transient or attempt == 2:
                            last_exc = exc_inner
                            raise
                        wait = 2 ** attempt * 15  # 15s, 30s
                        logger.warning(
                            "agent_claude_api_transient_retry",
                            generation_id=generation_id,
                            attempt=attempt + 1,
                            wait_seconds=wait,
                            error=str(exc_inner)[:200],
                        )
                        yield (
                            "status",
                            {
                                "message": (
                                    f"Anthropic is overloaded — retrying in "
                                    f"{wait}s (attempt {attempt + 2}/3)."
                                )
                            },
                        )
                        await asyncio.sleep(wait)
                if response is None:
                    raise last_exc if last_exc else RuntimeError("no response")
            except Exception as exc:
                logger.exception(
                    "agent_claude_api_error",
                    generation_id=generation_id,
                )
                if (workspace / "dist" / "index.html").is_file():
                    yield (
                        "status",
                        {
                            "message": (
                                f"Claude API error mid-loop ({exc}) — "
                                "deploying last successful build."
                            )
                        },
                    )
                    yield (
                        "done",
                        {
                            "reason": "recovered",
                            "iterations": iterations,
                            "final_text": final_text,
                        },
                    )
                    return
                yield (
                    "done",
                    {
                        "reason": "api_error",
                        "error": str(exc),
                        "iterations": iterations,
                        "final_text": final_text,
                    },
                )
                return

            cache_read = getattr(response.usage, "cache_read_input_tokens", 0) or 0
            cache_write = getattr(response.usage, "cache_creation_input_tokens", 0) or 0
            step_tokens.add(
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                cache_read_tokens=cache_read,
                cache_write_tokens=cache_write,
            )
            cost_so_far = tracker.total_cost_usd

            # Per-turn cache breadcrumb — shows up in Sentry traces so we
            # can inspect cache behaviour on any error. Ratio denominator
            # matches TokenTracker.cache_hit_ratio so numbers line up.
            turn_denom = response.usage.input_tokens + cache_read + cache_write
            turn_hit_ratio = (
                round(cache_read / turn_denom, 4) if turn_denom > 0 else 0.0
            )
            sentry_sdk.add_breadcrumb(
                category="claude.cache",
                message=f"{step.value} turn {iterations}: cache_hit={turn_hit_ratio:.2f}",
                data={
                    "step": step.value,
                    "iteration": iterations,
                    "cache_read_tokens": cache_read,
                    "cache_write_tokens": cache_write,
                    "input_tokens": response.usage.input_tokens,
                    "hit_ratio": turn_hit_ratio,
                },
                level="info",
            )

            yield (
                "agent_turn",
                {
                    "iteration": iteration_offset + iterations,
                    "cost_usd": cost_so_far,
                },
            )

            if cost_so_far > budget_usd:
                yield (
                    "done",
                    {
                        "reason": "budget",
                        "cost_usd": cost_so_far,
                        "iterations": iterations,
                        "final_text": final_text,
                    },
                )
                return

            tool_uses = []
            for block in response.content:
                if block.type == "text":
                    final_text = block.text
                    if block.text.strip():
                        yield ("agent_text", {"text": block.text[:500]})
                elif block.type == "tool_use":
                    tool_uses.append(block)
                    tool_input_path = ""
                    try:
                        if isinstance(block.input, dict):
                            p = block.input.get("path")
                            if isinstance(p, str):
                                tool_input_path = p
                    except Exception:
                        pass
                    yield ("tool_call", {"name": block.name, "path": tool_input_path})

            logger.info(
                "agent_iter_end_state",
                generation_id=generation_id,
                iteration=iterations,
                stop_reason=response.stop_reason,
                num_tool_uses=len(tool_uses),
                has_written_files=_has_written_files,
                has_called_run_build=_has_called_run_build,
                build_nudge_sent=_build_nudge_sent,
                step=step.value,
            )

            if response.stop_reason != "tool_use":
                # If agent stopped without ever calling run_build but did
                # write files, nudge it once to build before finalizing.
                if (
                    not _has_called_run_build
                    and _has_written_files
                    and not _build_nudge_sent
                    and step == AgentStep.GENERATION
                ):
                    _build_nudge_sent = True
                    messages.append({"role": "assistant", "content": response.content})
                    # If the assistant's last response contained any tool_use
                    # blocks (stop_reason="max_tokens" leaves a dangling
                    # partial tool_use, and Anthropic still enforces the
                    # tool_use → tool_result pairing), we have to answer
                    # each of them with a synthetic tool_result OR the
                    # next API call will 400. Prepend tool_results to the
                    # nudge, not plain text.
                    nudge_blocks: list[dict[str, Any]] = []
                    for block in response.content:
                        if getattr(block, "type", None) == "tool_use":
                            tuid = getattr(block, "id", None)
                            if tuid:
                                nudge_blocks.append(
                                    {
                                        "type": "tool_result",
                                        "tool_use_id": tuid,
                                        "content": (
                                            "tool call skipped — you wrote "
                                            "files but did not run_build. "
                                            "Call run_build() on your next "
                                            "turn instead of this tool."
                                        ),
                                        "is_error": True,
                                    }
                                )
                    nudge_blocks.append(
                        {
                            "type": "text",
                            "text": (
                                "You wrote files but did not call "
                                "run_build(). Call run_build() now. "
                                "Nothing else — just run_build()."
                            ),
                        }
                    )
                    messages.append({"role": "user", "content": nudge_blocks})
                    logger.info(
                        "agent_nudge_run_build",
                        generation_id=generation_id,
                        iteration=iterations,
                        dangling_tool_uses=len(nudge_blocks) - 1,
                    )
                    continue  # one more iteration

                yield (
                    "done",
                    {
                        "reason": "end_turn",
                        "iterations": iterations,
                        "final_text": final_text,
                    },
                )
                return

            tool_results = []
            for tool_block in tool_uses:
                tool_input = dict(tool_block.input)
                result_text, is_error = await asyncio.to_thread(
                    self._execute_tool,
                    workspace,
                    tool_block.name,
                    tool_input,
                )
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_block.id,
                        "content": result_text,
                        "is_error": is_error,
                    }
                )
                # Track tool calls for run_build nudge logic
                if tool_block.name == "write_file" and not is_error:
                    _has_written_files = True
                    _writes_since_build += 1
                elif tool_block.name == "run_build":
                    _has_called_run_build = True
                    _writes_since_build = 0
                    # Upload a temporary preview on successful build so the
                    # live-preview iframe can display the latest iteration.
                    build_succeeded = False
                    if not is_error:
                        try:
                            parsed = json.loads(result_text)
                        except (json.JSONDecodeError, TypeError):
                            parsed = {}
                        if parsed.get("success"):
                            build_succeeded = True
                            _has_successful_build = True
                            turn = iteration_offset + iterations
                            yield (
                                "preview_upload",
                                {
                                    "generation_id": generation_id,
                                    "turn": turn,
                                },
                            )
                        else:
                            # A later failed rebuild invalidates the last
                            # good one — agent needs to fix something.
                            _has_successful_build = False
                    # Track consecutive Haiku fix-pass build failures so we
                    # can escalate to Sonnet after the threshold.
                    if step == AgentStep.FIX_PASS and not _fix_pass_fallback_active:
                        if build_succeeded:
                            _fix_pass_consecutive_build_failures = 0
                        else:
                            _fix_pass_consecutive_build_failures += 1

                # Submit successful write_file calls to the mid-stream linter.
                if (
                    linter is not None
                    and tool_block.name == "write_file"
                    and not is_error
                ):
                    linter.submit(tool_input["path"], tool_input["content"])

            # Collect any lint warnings from the previous batch of writes
            # and inject them into the tool results so the agent sees them
            # on its very next turn.
            if linter is not None:
                lint_result = await linter.collect()
                if lint_result.has_warnings:
                    yield ("lint", {"warnings": lint_result.to_agent_context()})
                    tool_results.append(
                        {
                            "type": "text",
                            "text": lint_result.to_agent_context(),
                        }
                    )

            # Runtime build-nudge: if the agent has written N+ files since
            # the last run_build (or ever), inject an urgent reminder so it
            # verifies the code compiles before burning more iterations.
            # Fires only during the main generation loop — the fix pass
            # has its own model + shorter budget.
            if (
                step == AgentStep.GENERATION
                and _writes_since_build >= _BUILD_URGENT_NUDGE_THRESHOLD
            ):
                logger.info(
                    "agent_forced_build_reminder",
                    generation_id=generation_id,
                    iteration=iterations,
                    writes_since_build=_writes_since_build,
                )
                tool_results.append(
                    {
                        "type": "text",
                        "text": (
                            f"[system reminder] You have written "
                            f"{_writes_since_build} files without calling "
                            f"run_build(). STOP writing new files. Call "
                            f"run_build() on your very next turn to verify "
                            f"what you have so far compiles. If build fails, "
                            f"fix the specific errors. Do not add more "
                            f"features until the current code builds."
                        ),
                    }
                )

            # App.tsx watchdog — runs whenever any write just completed.
            # Sonnet sometimes scaffolds 10+ components but ignores the
            # build tool's "overwrite src/App.tsx" error and keeps adding
            # more components. Once any file has been written in this turn
            # AND src/App.tsx is still the base-template stub, inject a
            # blunt, specific instruction: the NEXT tool call must be
            # write_file to src/App.tsx. Much stronger signal than the
            # build-error text because it lands in every subsequent turn
            # until App.tsx is fixed.
            if (
                step == AgentStep.GENERATION
                and any(
                    tb.name == "write_file" for tb in tool_uses
                )
                and _app_tsx_is_placeholder(workspace)
            ):
                wrote_app_tsx_this_turn = any(
                    tb.name == "write_file"
                    and isinstance(tb.input, dict)
                    and tb.input.get("path") in {"src/App.tsx", "/src/App.tsx"}
                    for tb in tool_uses
                )
                if not wrote_app_tsx_this_turn:
                    logger.info(
                        "agent_app_tsx_watchdog_reminder",
                        generation_id=generation_id,
                        iteration=iterations,
                    )
                    tool_results.append(
                        {
                            "type": "text",
                            "text": (
                                "[CRITICAL] src/App.tsx is STILL the "
                                "base-template placeholder. The deploy "
                                "pipeline will refuse to ship this app "
                                "until you OVERWRITE src/App.tsx with the "
                                "real app implementation (compose the "
                                "components you've written, wire the "
                                "store, render the actual UI). Your very "
                                "next tool call MUST be write_file with "
                                "path='src/App.tsx' — do not write any "
                                "other file before that."
                            ),
                        }
                    )

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

            # Fix-pass Haiku→Sonnet fallback (T1.2 guardrail). Runs AFTER
            # tool results are committed so the next turn sees both the
            # failure context and the stronger model. Opens a new tracker
            # step so Sonnet-priced tokens bill correctly; the step label
            # stays FIX_PASS so per-phase dashboards don't fragment.
            if (
                step == AgentStep.FIX_PASS
                and not _fix_pass_fallback_active
                and _fix_pass_consecutive_build_failures
                >= _FIX_PASS_HAIKU_FAILURE_THRESHOLD
                and model.model_id != SONNET_4_6.model_id
            ):
                _fix_pass_fallback_active = True
                prev_model_id = model.model_id
                step_tokens = tracker.begin_step(
                    AgentStep.FIX_PASS, model_override=SONNET_4_6
                )
                model = step_tokens.model
                logger.info(
                    "fix_pass_fallback_to_sonnet",
                    generation_id=generation_id,
                    consecutive_failures=_fix_pass_consecutive_build_failures,
                    fallback_from=prev_model_id,
                    fallback_to=model.model_id,
                    iteration=iterations,
                )
                yield (
                    "status",
                    {
                        "message": (
                            f"Haiku fix pass failed "
                            f"{_fix_pass_consecutive_build_failures}× — "
                            f"escalating to {model.model_id} for the rest "
                            "of the fix pass."
                        )
                    },
                )

        # Loop exhausted without an end_turn. If we already have a working
        # build in dist/, treat that as a graceful stop so we deploy what
        # the agent has instead of throwing away a working app over a
        # dangling iteration budget. The agent was probably polishing.
        yield (
            "done",
            {
                "reason": "end_turn" if _has_successful_build else "max_iterations",
                "iterations": iterations,
                "final_text": final_text,
                "exhausted_budget": True,
            },
        )

    # ----------------------------------------------------------- agent loop

    async def generate(
        self,
        *,
        user_id: uuid.UUID,
        prompt: str,
        app_id: uuid.UUID | None = None,
        user_tier: str = "free",
    ):
        """Async generator yielding SSE-formatted strings.

        Streams progress events while the agent works, then runs the
        existing build pipeline and yields the final public URL.
        """
        # Wall-clock timer + outcome tag drive the T1.3 cost-telemetry event
        # emitted from the finally block. ``outcome`` is reset at each exit
        # path; falling through to the happy-path yield leaves it "success".
        started_at = time.perf_counter()
        outcome = "incomplete"
        total_iterations = 0

        # --- App + Generation records ---
        # Always have an App row up-front so /my-apps shows "building" tiles.
        slug, version, resolved_app_id = await self._resolve_app_slug(
            app_id, user_id, prompt
        )
        gen_id = await self._create_generation_record(
            user_id, prompt, resolved_app_id
        )
        generation_id = str(gen_id)
        yield _sse("status", "Setting up workspace...", generation_id=generation_id)

        # --- Workspace ---
        tmp = tempfile.mkdtemp(prefix=f"appio-agent-{slug}-")
        workspace = Path(tmp)

        try:
            try:
                await asyncio.to_thread(self._setup_workspace, workspace)
            except Exception as exc:
                await self._update_generation(gen_id, build_status="failed")
                logger.exception("agent_workspace_setup_failed", generation_id=generation_id)
                yield _sse("error", f"Workspace setup failed: {exc}")
                outcome = "workspace_setup_failed"
                return

            yield _sse("status", "Workspace ready. Planning...")

            # --- Token tracker (shared across all pipeline steps) ---
            tracker = TokenTracker()

            # --- PLANNING STEP (Sonnet 4.6, no tools) ---
            # Produces a structured build plan that the agent follows,
            # reducing wasted iterations and improving component selection.
            agent_prompt = prompt
            plan_step = tracker.begin_step(AgentStep.PLANNING)
            try:
                plan_result = await generate_plan(prompt, plan_step)
                agent_prompt = plan_result.to_agent_message(prompt)
                yield _sse(
                    "plan",
                    f"Plan ready: {plan_result.app_name} — "
                    f"{len(plan_result.screens)} screens, "
                    f"{len(plan_result.files_to_create)} files",
                    app_name=plan_result.app_name,
                    theme_color=plan_result.theme_color,
                    screens=len(plan_result.screens),
                    steps=len(plan_result.implementation_steps),
                    cost_usd=plan_result.cost_usd,
                )
            except PlanningError as exc:
                # Planning is best-effort — fall back to raw prompt if it fails.
                logger.warning(
                    "planning_failed_fallback_to_raw_prompt",
                    generation_id=generation_id,
                    error=str(exc),
                )
                yield _sse(
                    "status",
                    f"Planning skipped ({exc}) — proceeding with raw prompt.",
                )

            # --- RAG RETRIEVAL (Voyage AI embeddings → pgvector) ---
            # Retrieve relevant UI patterns, Tailwind v4 rules, and component
            # library docs.  Cached for the duration of the generation — the
            # same snippets feed both the initial loop and the fix pass.
            rag_snippets_text = ""
            try:
                rag_snippets = await retrieve_snippets(
                    user_prompt=prompt,
                    session_factory=self._session_factory,
                    top_k=5,
                )
                rag_snippets_text = format_snippets_for_prompt(rag_snippets)
                if rag_snippets:
                    logger.info(
                        "agent_rag_injected",
                        generation_id=generation_id,
                        snippet_count=len(rag_snippets),
                        top_score=round(rag_snippets[0].score, 3),
                        categories=[s.category for s in rag_snippets],
                    )
            except Exception as exc:
                # RAG is best-effort — never block generation.
                logger.warning(
                    "agent_rag_retrieval_failed",
                    generation_id=generation_id,
                    error=str(exc),
                )

            yield _sse("status", "Starting agent...")

            # --- Agent tool-use loop ---
            # System prompt: 1h TTL marker (see cache strategy notes above).
            # Caching the prompt + tools array is the big win — ~15K stable
            # prefix tokens reused across every turn in the loop.
            system_blocks = [
                {
                    "type": "text",
                    "text": _load_agent_system_prompt(),
                    "cache_control": _stable_cache_control(),
                }
            ]

            # RAG snippets come AFTER the cache breakpoint and carry NO
            # cache_control. Per T1.1: RAG content varies per user prompt,
            # so caching these tokens would rack up cache_write cost with
            # no chance of reuse on the next generation.
            if rag_snippets_text:
                system_blocks.append({
                    "type": "text",
                    "text": rag_snippets_text,
                })
            messages: list[dict[str, Any]] = [
                {"role": "user", "content": agent_prompt}
            ]
            total_iterations = 0
            final_text = ""
            critique_result: CritiqueResult | None = None
            screenshots: list[ScreenshotResult] = []

            # --- Mid-stream linter (Haiku 4.5, runs in parallel) ---
            lint_step = tracker.begin_step(AgentStep.LINTING)
            mid_stream_linter = MidStreamLinter(step_tokens=lint_step)

            # --- INITIAL agent loop (Sonnet 4.6 for best code quality) ---
            # Budget reserves critique + fix pass so we don't overrun _MAX_COST_USD.
            async for event_type, payload in self._run_tool_loop(
                workspace=workspace,
                system_blocks=system_blocks,
                messages=messages,
                tracker=tracker,
                step=AgentStep.GENERATION,
                max_iterations=_MAX_TOOL_ITERATIONS,
                generation_id=generation_id,
                linter=mid_stream_linter,
                budget_usd=_GENERATION_LOOP_BUDGET_USD,
            ):
                if event_type == "done":
                    reason = payload["reason"]
                    total_iterations = payload["iterations"]
                    final_text = payload.get("final_text", final_text)
                    if reason == "api_error":
                        await self._flush_cost_to_db(
                            gen_id, tracker, build_status="failed"
                        )
                        logger.error(
                            "generation_failed_api_error",
                            generation_id=generation_id,
                            iterations=total_iterations,
                            error=payload.get("error"),
                        )
                        yield _sse("error", f"Claude API error: {payload.get('error')}")
                        outcome = "api_error"
                        return
                    if reason == "budget":
                        await self._flush_cost_to_db(
                            gen_id, tracker, build_status="failed"
                        )
                        logger.error(
                            "generation_failed_budget",
                            generation_id=generation_id,
                            iterations=total_iterations,
                            cost_usd=payload.get("cost_usd"),
                        )
                        yield _sse(
                            "error",
                            f"Budget cap reached: ${payload['cost_usd']:.2f} > ${_MAX_COST_USD:.2f}",
                        )
                        outcome = "budget_exceeded"
                        return
                    if reason == "max_iterations":
                        await self._flush_cost_to_db(
                            gen_id, tracker, build_status="failed"
                        )
                        logger.error(
                            "generation_failed_max_iterations",
                            generation_id=generation_id,
                            iterations=total_iterations,
                            max=_MAX_TOOL_ITERATIONS,
                            cost_usd=tracker.total_cost_usd,
                        )
                        yield _sse(
                            "error",
                            f"Agent exceeded {_MAX_TOOL_ITERATIONS} tool iterations. "
                            "Try a simpler prompt or break the app into smaller parts.",
                        )
                        outcome = "max_iterations"
                        return
                    # end_turn or recovered — fall through to vision pass
                    break
                if event_type == "agent_turn":
                    cost = tracker.total_cost_usd
                    yield _sse(
                        "agent_turn",
                        f"Iteration {payload['iteration']} — {cost:.3f} USD spent",
                        iterations=payload["iteration"],
                        cost_usd=cost,
                    )
                elif event_type == "tool_call":
                    yield _sse(
                        "tool_call",
                        payload["name"],
                        tool_name=payload["name"],
                        path=payload.get("path", ""),
                    )
                elif event_type == "agent_text":
                    yield _sse("agent_text", payload["text"])
                elif event_type == "preview_upload":
                    preview_url = await self._upload_preview(
                        workspace / "dist",
                        generation_id=payload["generation_id"],
                        turn=payload["turn"],
                        slug=slug,
                    )
                    if preview_url:
                        yield _sse(
                            "preview_ready",
                            f"Preview ready (iteration {payload['turn']})",
                            url=preview_url,
                        )
                elif event_type == "lint":
                    yield _sse("lint", payload.get("warnings", ""))
                elif event_type == "status":
                    yield _sse("status", payload.get("message", ""))

            # --- VISION FEEDBACK PASS (adaptive: only if needed) ---
            # Only attempt if the agent left a working dist/ behind. The
            # screenshots and critique are wrapped in best-effort try/except —
            # any failure here just skips the pass and proceeds to deploy.
            # Also skip if we'd blow past the total budget — critique is a
            # quality tool, not worth blowing cost guarantees for.
            budget_remaining = _MAX_COST_USD - tracker.total_cost_usd
            if budget_remaining < _CRITIQUE_RESERVE_USD:
                yield _sse(
                    "status",
                    f"Vision pass skipped — ${budget_remaining:.2f} budget remaining "
                    f"< ${_CRITIQUE_RESERVE_USD:.2f} critique reserve.",
                )
            elif (workspace / "dist" / "index.html").is_file():
                yield _sse("status", "Capturing screenshots for vision review...")
                try:
                    screenshots = await asyncio.to_thread(
                        capture_app_screenshots, workspace
                    )
                    yield _sse(
                        "status",
                        f"Captured {len(screenshots)} screenshots. Asking vision critic...",
                    )
                    critique_result = await request_critique(screenshots)

                    yield _sse(
                        "critique",
                        f"Vision score: {critique_result.overall_score}/10 "
                        f"— {len(critique_result.issues)} issues",
                        score=critique_result.overall_score,
                        summary=critique_result.summary,
                        issue_count=len(critique_result.issues),
                        cost_usd=critique_result.cost_usd,
                    )
                except (ScreenshotError, CritiqueError) as exc:
                    logger.warning(
                        "vision_pass_failed_skipping",
                        generation_id=generation_id,
                        error=str(exc),
                    )
                    yield _sse(
                        "status",
                        f"Vision pass skipped ({type(exc).__name__}) — deploying as-is.",
                    )
                except Exception as exc:
                    logger.exception(
                        "vision_pass_unexpected_error",
                        generation_id=generation_id,
                    )
                    yield _sse(
                        "status",
                        f"Vision pass error ({exc}) — deploying as-is.",
                    )

            # --- VISION FIX PASS (adaptive trigger) ---
            if (
                critique_result is not None
                and critique_result.needs_fix_pass
            ):
                fix_message = critique_result.to_agent_message()
                if fix_message:
                    fix_model = pick_model(AgentStep.FIX_PASS)
                    yield _sse(
                        "status",
                        f"Score {critique_result.overall_score}/10 — "
                        f"running fix pass with {fix_model.model_id}.",
                    )
                    messages.append({"role": "user", "content": fix_message})

                    async for event_type, payload in self._run_tool_loop(
                        workspace=workspace,
                        system_blocks=system_blocks,
                        messages=messages,
                        tracker=tracker,
                        step=AgentStep.FIX_PASS,
                        max_iterations=_MAX_FIX_PASS_ITERATIONS,
                        generation_id=generation_id,
                        iteration_offset=total_iterations,
                        # Fix pass respects the absolute ceiling. Reserves
                        # have already been spent on critique.
                        budget_usd=_MAX_COST_USD,
                    ):
                        if event_type == "done":
                            reason = payload["reason"]
                            total_iterations += payload["iterations"]
                            final_text = payload.get("final_text", final_text)
                            if reason in {"api_error", "budget", "max_iterations"}:
                                # Fix pass failed; deploy what we already had.
                                yield _sse(
                                    "status",
                                    f"Fix pass ended early ({reason}) — deploying initial build.",
                                )
                            break
                        if event_type == "agent_turn":
                            cost = tracker.total_cost_usd
                            yield _sse(
                                "agent_turn",
                                f"Fix iteration {payload['iteration']} — {cost:.3f} USD spent",
                                iterations=payload["iteration"],
                                cost_usd=cost,
                            )
                        elif event_type == "tool_call":
                            yield _sse(
                                "tool_call",
                                payload["name"],
                                tool_name=payload["name"],
                                path=payload.get("path", ""),
                            )
                        elif event_type == "preview_upload":
                            preview_url = await self._upload_preview(
                                workspace / "dist",
                                generation_id=payload["generation_id"],
                                turn=payload["turn"],
                                slug=slug,
                            )
                            if preview_url:
                                yield _sse(
                                    "preview_ready",
                                    f"Preview ready (fix iteration {payload['turn']})",
                                    url=preview_url,
                                )
                        elif event_type == "agent_text":
                            yield _sse("agent_text", payload["text"])

            iterations = total_iterations
            total_input_tokens = tracker.total_input_tokens
            total_output_tokens = tracker.total_output_tokens

            # Flush token/cost accounting before deploy. _flush_cost_to_db
            # swallows any transient DB error so a Neon blip doesn't also
            # lose the final deployed app.
            await self._flush_cost_to_db(gen_id, tracker, critique_result)
            final_cost = tracker.total_cost_usd
            if critique_result is not None:
                final_cost = round(final_cost + critique_result.cost_usd, 6)

            yield _sse(
                "status",
                "Agent finished. Building & deploying...",
                cost_usd=final_cost,
                iterations=iterations,
            )

            # --- Pre-deploy safety net: refuse to ship the placeholder ---
            # The agent-loop build check already catches this mid-run, but
            # defend-in-depth so a budget-exhausted/max-iteration exit with
            # a stale "success" build can't slip a base-template stub into
            # production. User already paid for the tokens — at least tell
            # them what happened instead of deploying an empty app.
            if _app_tsx_is_placeholder(workspace):
                await self._flush_cost_to_db(
                    gen_id, tracker, critique_result, build_status="failed"
                )
                try:
                    await self._finalize_app_record(
                        resolved_app_id, status="failed"
                    )
                except Exception:
                    logger.exception(
                        "agent_app_finalize_failed_on_placeholder",
                        generation_id=generation_id,
                        app_id=str(resolved_app_id),
                    )
                logger.error(
                    "agent_deploy_aborted_placeholder_app_tsx",
                    generation_id=generation_id,
                    app_id=slug,
                )
                yield _sse(
                    "error",
                    "The agent never wrote src/App.tsx — it only scaffolded "
                    "components but left the entry point as the base-template "
                    "placeholder. Refusing to deploy. Please try again.",
                )
                outcome = "placeholder_deploy_refused"
                return

            # --- Inject "Built with Appio" badge for free-tier users ---
            # Server-side injection into dist/index.html so it cannot be
            # removed by editing app source.  Pro/Creator tiers skip this.
            if user_tier == "free":
                badge_injected = await asyncio.to_thread(
                    _inject_appio_badge, workspace / "dist", slug=slug
                )
                if badge_injected:
                    logger.info(
                        "appio_badge_injected",
                        generation_id=generation_id,
                        app_id=slug,
                    )
                else:
                    logger.warning(
                        "appio_badge_injection_failed",
                        generation_id=generation_id,
                        app_id=slug,
                        reason="missing index.html or </body> tag",
                    )

            # --- Hand off to orchestrator for validate / upload / publish ---
            try:
                build_config = _build_config_from_settings()
                orchestrator = Orchestrator(build_config)
                build_result = await orchestrator.build_from_workspace(
                    workspace,
                    app_id=slug,
                    version=version,
                    generation_id=generation_id,
                )
            except BuildError as exc:
                await self._flush_cost_to_db(
                    gen_id, tracker, critique_result, build_status="failed"
                )
                logger.error(
                    "agent_build_failed",
                    stage=exc.stage,
                    error=str(exc),
                    generation_id=generation_id,
                )
                yield _sse(
                    "error",
                    f"Build/deploy failed at {exc.stage}: {exc}",
                )
                outcome = "build_failed"
                return
            except Exception as exc:
                try:
                    await self._flush_cost_to_db(
                        gen_id, tracker, critique_result, build_status="failed"
                    )
                except Exception:
                    pass
                logger.exception(
                    "agent_build_unexpected_error",
                    generation_id=generation_id,
                )
                yield _sse("error", f"Unexpected deploy error: {type(exc).__name__}: {exc}")
                outcome = "deploy_error"
                return

            # Compute workspace expiry based on user tier (T2.18)
            ws_expires_at = None
            if build_result.workspace_url:
                ttl = workspace_ttl_for_tier(user_tier)
                ws_expires_at = datetime.now(timezone.utc) + ttl

            try:
                await self._update_generation(
                    gen_id,
                    build_status="success",
                    public_url=build_result.public_url,
                    workspace_url=build_result.workspace_url,
                    workspace_expires_at=ws_expires_at,
                )
                # Flip the user-facing App row to "ready" with the final URL
                # so /my-apps shows it as live. Best-effort: don't fail the
                # whole generation if this one UPDATE blinks.
                try:
                    await self._finalize_app_record(
                        resolved_app_id,
                        status="ready",
                        public_url=build_result.public_url,
                        version=version,
                    )
                except Exception:
                    logger.exception(
                        "agent_app_finalize_failed",
                        generation_id=generation_id,
                        app_id=str(resolved_app_id),
                    )
            except Exception as exc:
                logger.exception(
                    "agent_success_update_failed",
                    generation_id=generation_id,
                )
                # The build succeeded — we still want to tell the user
                # the public URL even if persisting the success state failed.
                yield _sse(
                    "complete",
                    f"App deployed (DB update failed: {exc})",
                    generation_id=generation_id,
                    public_url=build_result.public_url,
                    slug=slug,
                    version=version,
                )
                outcome = "success_db_flaky"
                return

            # --- MOCKUP GENERATION (best-effort, after deploy) ---
            mockup_urls: list[str] = []
            if screenshots:
                try:
                    mockup_results = await asyncio.to_thread(
                        compose_mockups, screenshots
                    )
                    r2 = R2Client(
                        account_id=build_config.r2_account_id,
                        access_key=build_config.r2_access_key,
                        secret_key=build_config.r2_secret_key,
                        bucket=build_config.r2_bucket,
                        endpoint_url=build_config.r2_endpoint,
                    )
                    mockup_upload = await asyncio.to_thread(
                        r2.upload_mockups,
                        [(m.label, m.png_bytes) for m in mockup_results],
                        app_id=slug,
                    )
                    mockup_urls = mockup_upload.urls
                    logger.info(
                        "mockups_generated",
                        generation_id=generation_id,
                        count=len(mockup_urls),
                    )
                except Exception as exc:
                    logger.warning(
                        "mockup_generation_failed",
                        generation_id=generation_id,
                        error=str(exc),
                    )

            outcome = "success"
            yield _sse(
                "complete",
                "App deployed successfully!",
                generation_id=generation_id,
                public_url=build_result.public_url,
                slug=slug,
                version=version,
                mockup_urls=mockup_urls,
                tokens={
                    "input_tokens": total_input_tokens,
                    "output_tokens": total_output_tokens,
                    "cost_usd": final_cost,
                    "per_step": tracker.per_step_summary(),
                },
                build={
                    "file_count": build_result.file_count,
                    "total_bytes": build_result.total_bytes,
                    "duration_seconds": round(build_result.duration_seconds, 2),
                },
                final_text=final_text[:1000],
            )
        finally:
            # If the App row is still in 'building' (i.e. we exited before
            # finalizing on success), mark it 'failed' so /my-apps doesn't
            # show permanent "Building..." spinners. Idempotent guard via
            # a status check inside _finalize_app_record's UPDATE.
            _app_id = locals().get("resolved_app_id")
            if _app_id is not None:
                try:
                    async with self._session_factory() as session:
                        current = await session.execute(
                            select(App).where(App.id == _app_id)
                        )
                        app_row = current.scalar_one_or_none()
                        if app_row is not None and app_row.status == "building":
                            await self._finalize_app_record(
                                _app_id, status="failed"
                            )
                except Exception:
                    logger.exception(
                        "agent_finally_app_finalize_failed",
                        generation_id=generation_id,
                    )

            # Last-ditch cost flush: if the generator was cancelled by
            # client disconnect (SSE abort, watchdog timeout, nav away),
            # `tracker` still carries the Claude spend we just incurred.
            # Without this, Anthropic bills the user but our DB / monthly
            # budget counter shows $0 — they can farm free calls by
            # pre-cancelling. Safe to call multiple times (idempotent
            # UPDATE with the same values).
            _tracker = locals().get("tracker")
            if _tracker is not None and (
                _tracker.total_input_tokens or _tracker.total_output_tokens
            ):
                try:
                    await self._flush_cost_to_db(gen_id, _tracker)
                except Exception:
                    logger.exception(
                        "agent_finally_cost_flush_failed",
                        generation_id=generation_id,
                    )

            # T1.3 cost telemetry — PostHog event + rolling p90 alert check.
            # Emitted ONCE here so every exit path (success, failure, client
            # cancel) feeds the same dashboard. Guard on tracker existing so
            # an early bail before planning doesn't emit a zero-cost event.
            _critique = locals().get("critique_result")
            if _tracker is not None and (
                _tracker.total_input_tokens or _tracker.total_output_tokens
            ):
                try:
                    critique_cost = (
                        _critique.cost_usd if _critique is not None else 0.0
                    )
                    total_cost = round(
                        _tracker.total_cost_usd + critique_cost, 6
                    )
                    event = CostEvent(
                        generation_id=str(gen_id),
                        user_id=str(user_id),
                        user_tier=user_tier,
                        outcome=outcome,
                        iterations=total_iterations,
                        time_seconds=round(time.perf_counter() - started_at, 3),
                        cost_usd=total_cost,
                        input_tokens=_tracker.total_input_tokens,
                        output_tokens=_tracker.total_output_tokens,
                        cache_read_input_tokens=_tracker.total_cache_read_tokens,
                        cache_write_input_tokens=_tracker.total_cache_write_tokens,
                        cache_hit_ratio=_tracker.cache_hit_ratio,
                        model_breakdown=build_model_breakdown(
                            _tracker.per_step_summary()
                        ),
                    )
                    await record_generation_cost(event)
                except Exception:
                    logger.exception(
                        "agent_cost_telemetry_failed",
                        generation_id=generation_id,
                    )
            shutil.rmtree(workspace, ignore_errors=True)


def _build_config_from_settings() -> BuildConfig:
    """Build a BuildConfig directly from pydantic Settings.

    The standard ``load_config()`` reads ``os.environ`` directly, which
    doesn't include ``.env`` values when uvicorn loads the app. Pydantic
    Settings already parsed ``.env``, so we forward those values here.
    POC always uses the local runner.
    """
    account_id = settings.cloudflare_account_id
    return BuildConfig(
        templates_dir=_TEMPLATES_DIR,
        fly_api_token="",
        fly_app_name="appio-builder",
        fly_machine_ids=(),
        fly_region="iad",
        r2_account_id=account_id,
        r2_bucket=settings.cloudflare_r2_bucket,
        r2_access_key=settings.cloudflare_r2_access_key,
        r2_secret_key=settings.cloudflare_r2_secret_key,
        r2_endpoint=(
            f"https://{account_id}.r2.cloudflarestorage.com"
            if account_id
            else ""
        ),
        cloudflare_api_token=settings.cloudflare_api_token,
        cloudflare_account_id=account_id,
        kv_namespace_id=settings.cloudflare_kv_namespace_id,
        build_timeout_seconds=120,
        max_retries=3,
        use_local_runner=True,
        local_builder_dir=None,
    )


def _sse(event_type: str, message: str | None = None, **fields: Any) -> str:
    payload: dict[str, Any] = {"type": event_type}
    if message is not None:
        payload["message"] = message
    payload.update({k: v for k, v in fields.items() if v is not None})
    return f"data: {json.dumps(payload)}\n\n"
