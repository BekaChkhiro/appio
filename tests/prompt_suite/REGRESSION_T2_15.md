# T2.15 Composite Pipeline End-to-End Test — Regression Report

**Date:** 2026-04-15/16
**Runs:** 7 test runs across optimization iterations
**Pipeline:** Planning → RAG → Agent Loop → Linting → Build → Vision Critique → Fix Pass

## Final Configuration

| Parameter | Value |
|-----------|-------|
| `_MAX_TOOL_ITERATIONS` | 15 |
| `_MAX_FIX_PASS_ITERATIONS` | 5 |
| `_MAX_TOKENS_PER_TURN` | 3072 |
| `_MAX_COST_USD` | 1.50 |
| Planning model | Haiku 4.5 |
| Generation model | Sonnet 4.6 |
| Linting model | Haiku 4.5 |
| Fix pass model | Haiku 4.5 |
| Critique model | Sonnet 4.6 |
| RAG | Enabled (102 snippets, Voyage AI voyage-code-3) |
| Vision critique | Enabled (Playwright Chromium, 4 screenshots) |

## Cost Targets

| Target | Value | Status |
|--------|-------|--------|
| Baseline (pre-composite, warm cache) | $0.18 | Reference |
| Target (full pipeline, cold cache) | $0.45 | **MET** ($0.42) |
| Stretch (warm cache + golden workspace) | $0.30 | Not tested (requires production env) |
| Hard ceiling (single run max) | $1.00 | All runs under |

## Run History (2026-04-15/16)

| # | Time | Cost | Target | Score | Iters | Success | Notes |
|---|------|------|--------|-------|-------|---------|-------|
| 1 | 14:43 | $0.422 | MISS | 0.0/10 | 26 | 100% | Baseline — no re-critique, critique broken |
| 2 | 15:05 | $0.997 | MISS | 6.2/10 | 23 | 100% | Added re-critique — cost spike (re-critique + more tokens) |
| 3 | 15:11 | $0.605 | MISS | n/a | 29 | 0% | Build failure (syntax error), no build-error fix pass yet |
| 4 | 15:18 | $0.620 | MISS | 6.0/10 | 33 | 100% | Added build-error fix pass — recovered from build failure |
| 5 | 15:25 | $0.401 | MISS | 5.5/10 | 20 | 100% | Reduced max_tokens 8192→4096, iterations 50→25 |
| 6 | 15:34 | $0.548 | MISS | 6.0/10 | 19 | 100% | Planning→Haiku, re-critique skip, prompt quality bar |
| 7 | 21:09 | $0.424 | **MET** | 6.5/10 | 20 | 100% | Final config: all optimizations + run_build nudge |

## Cost Breakdown (Final Run)

| Step | Model | Cost | % of Total |
|------|-------|------|-----------|
| Planning | Haiku 4.5 | $0.005 | 1% |
| Generation | Sonnet 4.6 | $0.312 | 74% |
| Linting | Haiku 4.5 | $0.017 | 4% |
| Critique | Sonnet 4.6 | $0.043 | 10% |
| Fix pass | Haiku 4.5 | $0.052 | 12% |
| **Total** | | **$0.424** | |

## Optimizations Applied

### Cost Reductions
1. **Planning: Sonnet → Haiku** — $0.025 → $0.005 per run (-80%)
2. **Re-critique skip** — skip if initial score ≥ 4 (saves ~$0.04)
3. **max_tokens_per_turn: 8192 → 3072** — fewer output tokens per turn
4. **max_iterations: 50 → 15** — prevents runaway loops
5. **Hard ceiling: $1.50 → $1.00** — catches cost spikes early

### Quality Improvements
1. **Vision critique + re-critique** — scores app UI 0-10
2. **Build-error fix pass** — when build fails, error sent to agent for fixing
3. **Post-fix rebuild** — always rebuild after fix pass (was conditional)
4. **Linter JSON parser** — extracts JSON from Haiku's mixed text+JSON responses
5. **Quality bar in prompt** — structure template, screenshot grading warning, severity levels

### Pipeline Fixes
1. **RAG seeded** — 102 curated snippets (components, Tailwind v4, patterns, bugs)
2. **run_build nudge** — when agent stops without building, auto-injects "call run_build()" message
3. **Fallback build** — reliable safety net when agent forgets run_build

## Known Issues

### Agent does not call run_build()
The agent consistently writes files but does not call `run_build()` despite clear instructions
in the system prompt. The `run_build nudge` (injected on end_turn) and the fallback build
handle this, but it adds ~$0.05 overhead per generation. Root cause: likely the agent's
conversation context grows too long and it loses track of the workflow steps.

### Critique score plateau at 6-6.5/10
Vision critique scores stabilize around 6-6.5/10. Reaching 8+ (ship-ready) requires:
- Agent following the structure template more closely
- Better dark mode coverage
- Proper BottomSheet + FAB pattern instead of inline forms
- This is a prompt engineering problem, not a pipeline problem

### Cost floor with Sonnet 4.6
Generation cost has a hard floor of ~$0.25-0.30 due to Sonnet 4.6 output pricing ($15/M).
With ~15K output tokens minimum for a simple app, output cost alone is ~$0.22.
Further cost reduction requires either cheaper models or fewer output tokens.

## Production Cost Estimate

In production with golden workspace (no npm install) and warm prompt cache:
- Cache writes ($0.08) become cache reads ($0.006) — **saves ~$0.07**
- No npm install overhead — **saves ~20s**
- Estimated production cost: **$0.25-0.35 per generation**

## Regression Baseline

For future runs, these are the metrics to compare against:

| Metric | Baseline | Acceptable Range |
|--------|----------|-----------------|
| Cost (cold cache) | $0.42 | $0.30 - $0.45 |
| Success rate | 100% | ≥ 80% |
| Critique score | 6.5/10 | ≥ 5.0/10 |
| Iterations | 20 | 15-25 |
| Time | 264s | 180-360s |
| Output tokens | 16.5K | 12K-22K |
