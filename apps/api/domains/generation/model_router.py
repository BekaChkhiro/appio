"""Multi-model router for the AI generation pipeline.

Selects the appropriate Claude model for each step of the agent loop:

- **generation** (initial build): Sonnet 4.6 — best code quality
- **fix_pass** (post-vision fixes): Haiku 4.5 — targeted edits, 10× cheaper
- **critique** (vision review): Sonnet 4.6 — needs strong visual reasoning

Each model carries its own pricing so cost tracking stays accurate when
the agent switches models mid-generation.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from typing import Any


class AgentStep(str, Enum):
    """Logical steps in the generation pipeline."""

    PLANNING = "planning"
    GENERATION = "generation"
    LINTING = "linting"
    FIX_PASS = "fix_pass"
    CRITIQUE = "critique"


@dataclass(frozen=True, slots=True)
class ModelConfig:
    """Model identity + pricing per million tokens."""

    model_id: str
    input_cost_per_m: float
    output_cost_per_m: float
    # Prompt-cache multipliers (relative to input_cost_per_m)
    cache_read_multiplier: float = 0.1
    cache_write_multiplier: float = 1.25

    @property
    def cache_read_per_m(self) -> float:
        return self.input_cost_per_m * self.cache_read_multiplier

    @property
    def cache_write_per_m(self) -> float:
        return self.input_cost_per_m * self.cache_write_multiplier

    def compute_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        cache_read_tokens: int = 0,
        cache_write_tokens: int = 0,
    ) -> float:
        """Compute USD cost with prompt-cache awareness."""
        return round(
            (input_tokens / 1_000_000) * self.input_cost_per_m
            + (output_tokens / 1_000_000) * self.output_cost_per_m
            + (cache_read_tokens / 1_000_000) * self.cache_read_per_m
            + (cache_write_tokens / 1_000_000) * self.cache_write_per_m,
            6,
        )


# ── Pre-built configs for supported models ──────────────────────────

SONNET_4_5 = ModelConfig(
    model_id="claude-sonnet-4-5",
    input_cost_per_m=3.00,
    output_cost_per_m=15.00,
)

SONNET_4_6 = ModelConfig(
    model_id="claude-sonnet-4-6",
    input_cost_per_m=3.00,
    output_cost_per_m=15.00,
)

HAIKU_4_5 = ModelConfig(
    model_id="claude-haiku-4-5-20251001",
    input_cost_per_m=0.80,
    output_cost_per_m=4.00,
)

# ── Default step → model mapping ────────────────────────────────────

_DEFAULT_ROUTING: dict[AgentStep, ModelConfig] = {
    # Planning is the foundation for the whole generation — a weak plan
    # cascades into wasted agent iterations. PROJECT_PLAN.md T2.9/T2.10
    # specifies Sonnet for planning. Override with APPIO_MODEL_PLANNING=
    # claude-haiku-4-5-20251001 for cost A/B testing.
    # Note: the SDK runner (use_agent_sdk=true) overrides to SONNET_4_5
    # because the bundled Claude Code CLI doesn't recognize the
    # "claude-sonnet-4-6" alias. Legacy raw-Anthropic path keeps SONNET_4_6
    # since that's what we've been running in production.
    AgentStep.PLANNING: SONNET_4_6,
    AgentStep.GENERATION: SONNET_4_6,
    AgentStep.LINTING: HAIKU_4_5,
    AgentStep.FIX_PASS: HAIKU_4_5,
    AgentStep.CRITIQUE: SONNET_4_6,
}

# Environment variable overrides (e.g. APPIO_MODEL_FIX_PASS=claude-sonnet-4-6
# to use Sonnet for fix passes too).
_MODEL_LOOKUP: dict[str, ModelConfig] = {
    "claude-sonnet-4-5": SONNET_4_5,
    "claude-sonnet-4-6": SONNET_4_6,
    "claude-haiku-4-5-20251001": HAIKU_4_5,
}


def _load_routing() -> dict[AgentStep, ModelConfig]:
    """Build the step→model map, applying any env overrides."""
    routing = dict(_DEFAULT_ROUTING)
    for step in AgentStep:
        env_key = f"APPIO_MODEL_{step.value.upper()}"
        override = os.environ.get(env_key)
        if override and override in _MODEL_LOOKUP:
            routing[step] = _MODEL_LOOKUP[override]
    return routing


# Resolved once at import time; restart to pick up env changes.
_ROUTING = _load_routing()


def pick_model(step: AgentStep) -> ModelConfig:
    """Return the ModelConfig for a given pipeline step."""
    return _ROUTING[step]


@dataclass
class StepTokens:
    """Per-step token accumulator for granular cost tracking."""

    step: AgentStep
    model: ModelConfig
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0

    def add(
        self,
        input_tokens: int,
        output_tokens: int,
        cache_read_tokens: int = 0,
        cache_write_tokens: int = 0,
    ) -> None:
        self.input_tokens += input_tokens
        self.output_tokens += output_tokens
        self.cache_read_tokens += cache_read_tokens
        self.cache_write_tokens += cache_write_tokens

    @property
    def cost_usd(self) -> float:
        return self.model.compute_cost(
            self.input_tokens,
            self.output_tokens,
            self.cache_read_tokens,
            self.cache_write_tokens,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "step": self.step.value,
            "model": self.model.model_id,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cache_read_tokens": self.cache_read_tokens,
            "cache_write_tokens": self.cache_write_tokens,
            "cost_usd": self.cost_usd,
        }


class TokenTracker:
    """Tracks token usage across multiple pipeline steps with different models."""

    def __init__(self) -> None:
        self._steps: list[StepTokens] = []
        self._current: StepTokens | None = None

    def begin_step(
        self, step: AgentStep, model_override: ModelConfig | None = None
    ) -> StepTokens:
        """Start tracking a new step. Returns the StepTokens accumulator.

        ``model_override`` lets callers (e.g. the fix-pass guardrail that
        falls back from Haiku to Sonnet after repeated failures) start a
        new accumulator priced against a different model while keeping the
        pipeline step label intact. Without it, callers would have to
        choose between accurate cost accounting and meaningful step
        labelling.
        """
        model = model_override if model_override is not None else pick_model(step)
        st = StepTokens(step=step, model=model)
        self._steps.append(st)
        self._current = st
        return st

    @property
    def current(self) -> StepTokens | None:
        return self._current

    @property
    def total_cost_usd(self) -> float:
        return round(sum(s.cost_usd for s in self._steps), 6)

    @property
    def total_input_tokens(self) -> int:
        return sum(s.input_tokens for s in self._steps)

    @property
    def total_output_tokens(self) -> int:
        return sum(s.output_tokens for s in self._steps)

    @property
    def total_cache_read_tokens(self) -> int:
        return sum(s.cache_read_tokens for s in self._steps)

    @property
    def total_cache_write_tokens(self) -> int:
        return sum(s.cache_write_tokens for s in self._steps)

    @property
    def cache_hit_ratio(self) -> float:
        """Fraction of billable input tokens served from cache.

        Denominator = uncached input + cache reads + cache writes, so this
        reflects the real dollar-weighted hit rate (cache writes cost more
        than reads but less than uncached; writes represent prompt prefix
        we paid to cache but didn't yet reuse). Range [0.0, 1.0].
        """
        denom = (
            self.total_input_tokens
            + self.total_cache_read_tokens
            + self.total_cache_write_tokens
        )
        if denom == 0:
            return 0.0
        return round(self.total_cache_read_tokens / denom, 4)

    def per_step_summary(self) -> list[dict[str, Any]]:
        return [s.to_dict() for s in self._steps]
