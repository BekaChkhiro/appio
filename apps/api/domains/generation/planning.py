"""Planning service for the agent generation pipeline.

Before the agent tool-use loop begins, we ask Claude (Sonnet 4.6, no tools)
to analyse the user's prompt and produce a structured build plan: which files
to create, which UI components to use, the Zustand store shape, and a
step-by-step implementation order.

The plan is injected into the agent loop's first user message so the agent
starts with a clear roadmap instead of figuring everything out on the fly.
This reduces wasted iterations, improves component selection, and cuts cost.

Structured output is guaranteed via ``tool_choice`` forcing Claude to call
a ``submit_plan`` tool with a strict JSON schema — the same pattern used by
``critique.py`` for the vision review.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import anthropic
import structlog

from apps.api.config import settings
from apps.api.domains.generation.model_router import (
    AgentStep,
    StepTokens,
    pick_model,
)

log = structlog.stdlib.get_logger()

__all__ = ["PlanningError", "PlanResult", "generate_plan"]

_MAX_TOKENS = 4096
_TIMEOUT_S = 45.0

# Plan-shape limits — keep in sync with the constraints documented in
# _PLANNING_SYSTEM. Enforced after parsing so a chatty plan can't blow up
# the agent's context or burn iterations on too-ambitious scope.
_MAX_SCREENS = 5
_MAX_UI_COMPONENTS_PER_SCREEN = 6
_MAX_FILES_TO_CREATE = 20
_MAX_IMPLEMENTATION_STEPS = 20


# ── System prompt ──────────────────────────────────────────────────────

_PLANNING_SYSTEM = """\
You are a senior mobile app architect planning the implementation of a \
Progressive Web App. You will receive a user's app description and must \
produce a structured build plan for the agent that will write the code.

## Context

The agent works in a sandboxed workspace with:
- React 18 + TypeScript + Zustand + Tailwind v4
- A pre-built iOS-style UI component library: Screen, AppBar, TabBar, \
Card, ListItem, FAB, BottomSheet, Button, IconButton, Input, TextArea, \
SegmentedControl, EmptyState, ThemeProvider, Icons (20 SVG icons)
- esbuild for builds, localStorage for persistence
- Max viewport: 430px (iPhone 14 Pro Max)

## Your job

Analyse the user's prompt and produce a plan that covers:

1. **App identity**: name, theme color, whether dark mode is needed
2. **Screens**: which top-level screens exist and what each shows
3. **Components**: which UI library components to use on each screen, \
plus any app-specific components to create (e.g. TaskRow, HabitChart)
4. **Store shape**: Zustand store(s) — state fields, key actions, \
localStorage persistence keys
5. **Files to create**: exact file paths the agent should write
6. **Implementation order**: numbered steps the agent should follow

## Constraints

- Max 5 screens (pages/tabs)
- Max 6 UI components per screen
- Use the pre-built component library — do NOT reinvent buttons, cards, etc.
- Forms MUST go in a BottomSheet triggered by FAB, never inline
- All content inside <Screen> (430px max-width)
- No responsive breakpoints (sm:, md:, lg:)
- Tailwind v4: use dark: variants, opacity modifiers (bg-indigo-500/80), \
NO @apply, NO tailwind.config.js, NO bg-opacity-* (v3 removed)
- Available icons: Home, Settings, Plus, Check, Trash, Edit, Search, \
Star, Heart, Moon, Sun, ChevronLeft, ChevronRight, ChevronDown, \
Calendar, Clock, Tag, User, Bell, BarChart

Call the submit_plan tool ONCE with your complete plan.
"""


# ── Tool schema for structured output ──────────────────────────────────

_PLAN_TOOL: dict[str, Any] = {
    "name": "submit_plan",
    "description": (
        "Submit the structured build plan. Call this exactly once "
        "with the complete plan for the agent."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "app_name": {
                "type": "string",
                "description": "Short display name for the app (2-30 chars).",
            },
            "theme_color": {
                "type": "string",
                "description": "Primary theme color as 6-digit hex (e.g. #6366f1).",
            },
            "needs_dark_mode": {
                "type": "boolean",
                "description": "Whether the app should support dark mode toggle.",
            },
            "screens": {
                "type": "array",
                "description": "Top-level screens/tabs in the app.",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Screen name (e.g. 'Home', 'Settings').",
                        },
                        "purpose": {
                            "type": "string",
                            "description": "One-sentence purpose of this screen.",
                        },
                        "ui_components": {
                            "type": "array",
                            "description": (
                                "UI library components used on this screen "
                                "(e.g. AppBar, Card, ListItem, FAB, BottomSheet)."
                            ),
                            "items": {"type": "string"},
                        },
                        "custom_components": {
                            "type": "array",
                            "description": (
                                "App-specific components to create for this screen "
                                "(e.g. TaskRow, HabitChart). Empty if none needed."
                            ),
                            "items": {"type": "string"},
                        },
                    },
                    "required": ["name", "purpose", "ui_components"],
                },
            },
            "store": {
                "type": "object",
                "description": "Zustand store design.",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Store file name without extension (e.g. 'appStore').",
                    },
                    "state_fields": {
                        "type": "array",
                        "description": "State fields with types (e.g. 'tasks: Task[]').",
                        "items": {"type": "string"},
                    },
                    "actions": {
                        "type": "array",
                        "description": "Key actions/mutations (e.g. 'addTask(text: string)').",
                        "items": {"type": "string"},
                    },
                    "persistence_key": {
                        "type": "string",
                        "description": "localStorage key for persistence (e.g. 'habit-tracker-state').",
                    },
                },
                "required": ["name", "state_fields", "actions", "persistence_key"],
            },
            "files_to_create": {
                "type": "array",
                "description": (
                    "Exact workspace-relative file paths the agent should create, "
                    "in implementation order (e.g. 'src/store/appStore.ts', 'src/App.tsx')."
                ),
                "items": {"type": "string"},
            },
            "implementation_steps": {
                "type": "array",
                "description": (
                    "Numbered step-by-step instructions for the agent. "
                    "Each step should be a concise action (e.g. "
                    "'Create Zustand store with Task type and CRUD actions')."
                ),
                "items": {"type": "string"},
            },
        },
        "required": [
            "app_name",
            "theme_color",
            "needs_dark_mode",
            "screens",
            "store",
            "files_to_create",
            "implementation_steps",
        ],
    },
}


# ── Result types ───────────────────────────────────────────────────────

class PlanningError(RuntimeError):
    """Raised when the planning call fails."""


@dataclass(frozen=True, slots=True)
class ScreenPlan:
    name: str
    purpose: str
    ui_components: list[str]
    custom_components: list[str]


@dataclass(frozen=True, slots=True)
class StorePlan:
    name: str
    state_fields: list[str]
    actions: list[str]
    persistence_key: str


@dataclass(frozen=True, slots=True)
class PlanResult:
    app_name: str
    theme_color: str
    needs_dark_mode: bool
    screens: list[ScreenPlan]
    store: StorePlan
    files_to_create: list[str]
    implementation_steps: list[str]
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int
    cost_usd: float

    def to_agent_message(self, original_prompt: str) -> str:
        """Format the plan as the first user message for the agent loop.

        Includes the original user prompt followed by the structured plan
        so the agent has both the creative intent and the technical roadmap.
        """
        lines = [
            original_prompt,
            "",
            "---",
            "",
            "## Build Plan (follow this roadmap)",
            "",
            f"**App name:** {self.app_name}",
            f"**Theme:** {self.theme_color}",
            f"**Dark mode:** {'yes' if self.needs_dark_mode else 'no'}",
            "",
            "### Screens",
            "",
        ]

        for i, screen in enumerate(self.screens, 1):
            lines.append(f"{i}. **{screen.name}** — {screen.purpose}")
            lines.append(f"   UI components: {', '.join(screen.ui_components)}")
            if screen.custom_components:
                lines.append(
                    f"   Custom components: {', '.join(screen.custom_components)}"
                )

        lines.extend([
            "",
            "### Store design",
            "",
            f"File: `src/store/{self.store.name}.ts`",
            f"Persistence key: `{self.store.persistence_key}`",
            "",
            "State:",
        ])
        for sf in self.store.state_fields:
            lines.append(f"- `{sf}`")

        lines.append("")
        lines.append("Actions:")
        for action in self.store.actions:
            lines.append(f"- `{action}`")

        lines.extend([
            "",
            "### Files to create (in order)",
            "",
        ])
        for f in self.files_to_create:
            lines.append(f"- `{f}`")

        lines.extend([
            "",
            "### Implementation steps",
            "",
        ])
        for i, step in enumerate(self.implementation_steps, 1):
            lines.append(f"{i}. {step}")

        lines.extend([
            "",
            "---",
            "",
            "Follow the plan above. Start by inspecting the workspace "
            "(list_files, read UI components), then implement each step. "
            "Run run_build at the end.",
        ])

        return "\n".join(lines)


# ── Main entry point ───────────────────────────────────────────────────

async def generate_plan(
    prompt: str,
    step_tokens: StepTokens,
) -> PlanResult:
    """Generate a structured build plan from the user's prompt.

    Uses tool_choice to force Claude to return schema-conformant JSON.
    Cost is tracked via the provided ``step_tokens`` accumulator.

    Raises ``PlanningError`` on API or parsing failures.
    """
    model = pick_model(AgentStep.PLANNING)
    log.info("planning_model_selected", model=model.model_id)

    client = anthropic.AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        timeout=_TIMEOUT_S,
    )

    try:
        response = await client.messages.create(
            model=model.model_id,
            max_tokens=_MAX_TOKENS,
            system=[
                {
                    "type": "text",
                    "text": _PLANNING_SYSTEM,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            tools=[_PLAN_TOOL],
            tool_choice={"type": "tool", "name": "submit_plan"},
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError as exc:
        raise PlanningError(f"planning API error: {exc}") from exc
    except Exception as exc:
        raise PlanningError(f"planning call failed: {exc}") from exc

    # Track tokens
    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens
    cache_read = getattr(response.usage, "cache_read_input_tokens", 0) or 0
    cache_write = getattr(response.usage, "cache_creation_input_tokens", 0) or 0
    step_tokens.add(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_read_tokens=cache_read,
        cache_write_tokens=cache_write,
    )

    # Extract the tool_use block
    tool_block = next(
        (b for b in response.content if b.type == "tool_use" and b.name == "submit_plan"),
        None,
    )
    if tool_block is None:
        raise PlanningError("Claude did not call submit_plan tool")

    payload = tool_block.input
    cost = model.compute_cost(input_tokens, output_tokens, cache_read, cache_write)

    try:
        raw_screens = payload.get("screens", [])[:_MAX_SCREENS]
        screens = [
            ScreenPlan(
                name=str(s.get("name", "")),
                purpose=str(s.get("purpose", "")),
                ui_components=[str(c) for c in s.get("ui_components", [])][
                    :_MAX_UI_COMPONENTS_PER_SCREEN
                ],
                custom_components=[str(c) for c in s.get("custom_components", [])],
            )
            for s in raw_screens
        ]
        if not screens:
            raise PlanningError("plan contained no screens")

        store_data = payload.get("store", {})
        store = StorePlan(
            name=str(store_data.get("name", "appStore")),
            state_fields=[str(f) for f in store_data.get("state_fields", [])],
            actions=[str(a) for a in store_data.get("actions", [])],
            persistence_key=str(store_data.get("persistence_key", "app-state")),
        )

        files_to_create = [str(f) for f in payload.get("files_to_create", [])][
            :_MAX_FILES_TO_CREATE
        ]
        impl_steps = [str(s) for s in payload.get("implementation_steps", [])][
            :_MAX_IMPLEMENTATION_STEPS
        ]

        plan = PlanResult(
            app_name=str(payload.get("app_name", "App")),
            theme_color=str(payload.get("theme_color", "#6366f1")),
            needs_dark_mode=bool(payload.get("needs_dark_mode", True)),
            screens=screens,
            store=store,
            files_to_create=files_to_create,
            implementation_steps=impl_steps,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_tokens=cache_read,
            cache_write_tokens=cache_write,
            cost_usd=cost,
        )

        # Observability: surface when Claude returns an oversized plan so
        # we can tune the system prompt. Values are already clamped above.
        original_screen_count = len(payload.get("screens", []))
        if original_screen_count > _MAX_SCREENS:
            log.warning(
                "plan_truncated_screens",
                requested=original_screen_count,
                kept=_MAX_SCREENS,
            )

        return plan
    except PlanningError:
        raise
    except Exception as exc:
        raise PlanningError(f"malformed plan payload: {exc}") from exc
