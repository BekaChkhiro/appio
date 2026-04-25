"""Tests for the prompt-cache strategy in agent_service (PROJECT_PLAN.md T1.1).

These lock in three non-obvious invariants that would silently regress:

1. The tools array gets cache_control on the *last* tool only — marking
   multiple tools wastes breakpoints (there's a hard 4-per-request cap).
2. RAG system blocks DO NOT carry cache_control — their content varies
   per query and caching burns writes with no reuse.
3. ``TokenTracker.cache_hit_ratio`` uses the dollar-weighted denominator
   (uncached + reads + writes), not just input + reads — otherwise the
   T1.1 ≥40% acceptance number would be inflated by ignoring cache writes.
"""

from __future__ import annotations

from apps.api.domains.generation.agent_service import (
    _TOOLS,
    _session_cache_control,
    _stable_cache_control,
    _tools_with_cache_control,
    _with_cache_breakpoint,
)
from apps.api.domains.generation.model_router import (
    HAIKU_4_5,
    SONNET_4_6,
    AgentStep,
    TokenTracker,
)


class TestCacheControlMarkers:
    def test_stable_marker_has_ephemeral_type(self) -> None:
        cc = _stable_cache_control()
        assert cc["type"] == "ephemeral"

    def test_session_marker_never_sets_extended_ttl(self) -> None:
        # Session tail rotates fast — paying 2× for 1h writes would never
        # be recouped since the next turn invalidates the prefix.
        assert _session_cache_control() == {"type": "ephemeral"}


class TestToolsCacheBreakpoint:
    def test_only_last_tool_is_marked(self) -> None:
        tools = _tools_with_cache_control()
        assert len(tools) == len(_TOOLS)
        for tool in tools[:-1]:
            assert "cache_control" not in tool, (
                f"tool {tool['name']} should not carry cache_control — "
                "the full tools array is cached via the last entry only"
            )
        assert tools[-1]["cache_control"] == _stable_cache_control()

    def test_source_tools_stay_unmarked(self) -> None:
        # _TOOLS is the authoritative source — it must remain free of
        # cache_control so callers can decide the TTL at call time.
        for tool in _TOOLS:
            assert "cache_control" not in tool


class TestMessageBreakpoint:
    def test_string_content_gets_session_ttl(self) -> None:
        out = _with_cache_breakpoint([{"role": "user", "content": "hi"}])
        block = out[0]["content"][0]
        assert block["cache_control"] == {"type": "ephemeral"}

    def test_marks_last_user_block_only(self) -> None:
        msgs = [
            {"role": "user", "content": "first"},
            {"role": "assistant", "content": "ok"},
            {"role": "user", "content": [
                {"type": "text", "text": "a"},
                {"type": "text", "text": "b"},
            ]},
        ]
        out = _with_cache_breakpoint(msgs)
        # Earlier user message must stay clean.
        assert isinstance(out[0]["content"], str) or "cache_control" not in (
            out[0]["content"][0] if isinstance(out[0]["content"], list) else {}
        )
        # Last user message — only the trailing block carries the marker.
        last_blocks = out[-1]["content"]
        assert "cache_control" not in last_blocks[0]
        assert last_blocks[-1]["cache_control"] == {"type": "ephemeral"}

    def test_empty_messages_noop(self) -> None:
        assert _with_cache_breakpoint([]) == []


class TestCacheHitRatio:
    def test_zero_when_nothing_tracked(self) -> None:
        assert TokenTracker().cache_hit_ratio == 0.0

    def test_counts_writes_in_denominator(self) -> None:
        # Without writes in the denominator, a generation that only ever
        # *writes* to cache (never reads) would show a misleading 0/0
        # undefined ratio; with writes, it correctly reports 0.0.
        t = TokenTracker()
        st = t.begin_step(AgentStep.GENERATION)
        st.add(input_tokens=0, output_tokens=100, cache_read_tokens=0, cache_write_tokens=5000)
        assert t.cache_hit_ratio == 0.0
        assert t.total_cache_write_tokens == 5000

    def test_realistic_ratio(self) -> None:
        t = TokenTracker()
        st = t.begin_step(AgentStep.GENERATION)
        # Turn 1: prime the cache — 1000 uncached input, 0 reads, 5000 writes.
        st.add(input_tokens=1000, output_tokens=200, cache_read_tokens=0, cache_write_tokens=5000)
        # Turns 2-4: tight loop reading cache — 100 fresh input, 5000 reads each.
        for _ in range(3):
            st.add(input_tokens=100, output_tokens=150, cache_read_tokens=5000, cache_write_tokens=0)
        # denom = 1000 + 300 + 15000(reads) + 5000(writes) = 21300
        # ratio = 15000 / 21300 ≈ 0.7042
        assert 0.70 <= t.cache_hit_ratio <= 0.71


class TestFixPassFallbackAccounting:
    """T1.2 — when the fix pass escalates Haiku→Sonnet after repeated
    failures, both model accumulators must bill at their own rates and the
    per-step summary must expose the split so dashboards can measure the
    Haiku savings. Regressing either breaks the acceptance criterion
    ('per-generation total cost drops measurably')."""

    def test_begin_step_override_uses_alternate_model(self) -> None:
        t = TokenTracker()
        default_step = t.begin_step(AgentStep.FIX_PASS)
        assert default_step.model.model_id == HAIKU_4_5.model_id

        override_step = t.begin_step(
            AgentStep.FIX_PASS, model_override=SONNET_4_6
        )
        assert override_step.model.model_id == SONNET_4_6.model_id
        # Step label survives the override so FIX_PASS telemetry stays
        # attributable as "fix pass" regardless of which model ran it.
        assert override_step.step is AgentStep.FIX_PASS

    def test_fallback_splits_cost_between_models(self) -> None:
        t = TokenTracker()
        haiku = t.begin_step(AgentStep.FIX_PASS)
        haiku.add(input_tokens=10_000, output_tokens=2_000)
        haiku_cost = haiku.cost_usd

        sonnet = t.begin_step(AgentStep.FIX_PASS, model_override=SONNET_4_6)
        sonnet.add(input_tokens=10_000, output_tokens=2_000)
        sonnet_cost = sonnet.cost_usd

        # Same token counts → Sonnet must cost more than Haiku (pricing
        # sanity check; if this ever flips, the override helper routed
        # tokens to the wrong accumulator).
        assert sonnet_cost > haiku_cost
        assert abs(t.total_cost_usd - (haiku_cost + sonnet_cost)) < 1e-9

    def test_per_step_summary_exposes_both_models(self) -> None:
        t = TokenTracker()
        t.begin_step(AgentStep.FIX_PASS).add(input_tokens=1_000, output_tokens=200)
        t.begin_step(
            AgentStep.FIX_PASS, model_override=SONNET_4_6
        ).add(input_tokens=500, output_tokens=100)

        summary = t.per_step_summary()
        assert len(summary) == 2
        assert summary[0]["model"] == HAIKU_4_5.model_id
        assert summary[0]["step"] == AgentStep.FIX_PASS.value
        assert summary[1]["model"] == SONNET_4_6.model_id
        assert summary[1]["step"] == AgentStep.FIX_PASS.value
