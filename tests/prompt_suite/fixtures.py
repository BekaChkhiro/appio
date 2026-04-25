"""Regression prompt fixtures for the prompt engineering test suite (T3.4).

Each fixture maps a template ID to a list of test prompts. Every prompt
must produce a valid hybrid spec, pass code generation, and build
successfully with esbuild.

Prompts are intentionally varied: simple one-liners, detailed feature
requests, and edge-case phrasing. The goal is to catch regressions in
the AI generation pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass

__all__ = ["PROMPT_FIXTURES", "PromptFixture"]


@dataclass(frozen=True, slots=True)
class PromptFixture:
    """A single test prompt with metadata for reporting."""

    id: str
    template: str
    prompt: str
    description: str
    # Minimum expected pages — a quick sanity check on the spec.
    min_pages: int = 1


PROMPT_FIXTURES: tuple[PromptFixture, ...] = (
    # ── todo-list ──────────────────────────────────────────────────────
    PromptFixture(
        id="todo-simple",
        template="todo-list",
        prompt="Build me a simple to-do list app with categories",
        description="Basic to-do app — happy path",
        min_pages=1,
    ),
    PromptFixture(
        id="todo-detailed",
        template="todo-list",
        prompt=(
            "I need a task manager with three categories: Work, Personal, "
            "and Shopping. Each task should have a priority level. Show a "
            "progress bar at the top."
        ),
        description="Detailed to-do with priorities and progress",
        min_pages=2,
    ),
    # ── expense-tracker ────────────────────────────────────────────────
    PromptFixture(
        id="expense-simple",
        template="expense-tracker",
        prompt="Create an expense tracker that groups transactions by date",
        description="Basic expense tracker — happy path",
        min_pages=1,
    ),
    PromptFixture(
        id="expense-charts",
        template="expense-tracker",
        prompt=(
            "Build a personal budget app with monthly spending charts, "
            "category breakdowns, and a balance card at the top. Use a "
            "green and white color scheme."
        ),
        description="Expense tracker with charts and theming request",
        min_pages=2,
    ),
    # ── notes-app ──────────────────────────────────────────────────────
    PromptFixture(
        id="notes-simple",
        template="notes-app",
        prompt="Make a notes app where I can organize notes into folders",
        description="Basic notes app — happy path",
        min_pages=1,
    ),
    PromptFixture(
        id="notes-search",
        template="notes-app",
        prompt=(
            "Create a notes application with a search bar, folder "
            "navigation, and a rich text editor. I want a dark theme "
            "with purple accents."
        ),
        description="Notes app with search and dark theme request",
        min_pages=2,
    ),
    # ── quiz-app ───────────────────────────────────────────────────────
    PromptFixture(
        id="quiz-simple",
        template="quiz-app",
        prompt="Build a geography quiz app with multiple choice questions",
        description="Basic quiz app — happy path",
        min_pages=1,
    ),
    PromptFixture(
        id="quiz-timer",
        template="quiz-app",
        prompt=(
            "I want a trivia quiz with a countdown timer, score tracking, "
            "and a results screen that shows which answers were wrong. "
            "Include at least 10 questions about science."
        ),
        description="Quiz with timer, scoring, and results",
        min_pages=2,
    ),
    # ── habit-tracker ──────────────────────────────────────────────────
    PromptFixture(
        id="habit-simple",
        template="habit-tracker",
        prompt="Create a daily habit tracker with streaks",
        description="Basic habit tracker — happy path",
        min_pages=1,
    ),
    PromptFixture(
        id="habit-weekly",
        template="habit-tracker",
        prompt=(
            "Build a habit tracker that shows a weekly chart of completed "
            "habits, daily check-in buttons, and streak counters. Use a "
            "blue and orange color palette."
        ),
        description="Habit tracker with weekly charts and theming",
        min_pages=2,
    ),
)
