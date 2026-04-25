#!/usr/bin/env python3
"""Success rate dashboard reporter for the prompt suite (T3.4).

Reads the latest results JSON and prints a formatted dashboard to the
terminal. Can also compare two runs to show regressions.

Usage::

    python -m tests.prompt-suite.report                   # Show latest
    python -m tests.prompt-suite.report --compare prev    # Compare latest vs previous
    python -m tests.prompt-suite.report --file results/run-20260407.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

RESULTS_DIR = Path(__file__).parent / "results"


def _bar(passed: int, total: int, width: int = 20) -> str:
    """Render a progress bar."""
    if total == 0:
        return "░" * width
    filled = round(passed / total * width)
    return "█" * filled + "░" * (width - filled)


def _load_report(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _get_sorted_runs() -> list[Path]:
    if not RESULTS_DIR.is_dir():
        return []
    return sorted(
        (p for p in RESULTS_DIR.glob("run-*.json")),
        key=lambda p: p.name,
        reverse=True,
    )


def print_dashboard(report: dict) -> None:
    total = report["total"]
    passed = report["passed"]
    rate = report["success_rate"]
    cost = report["total_cost_usd"]

    print()
    print("╭" + "─" * 62 + "╮")
    print(f"│  {'PROMPT SUITE DASHBOARD':^58}  │")
    print("├" + "─" * 62 + "┤")
    print(f"│  Run: {report.get('run_at', 'unknown'):<54}  │")
    print(f"│  {_bar(passed, total, 40)} {passed}/{total} ({rate}%)  │")
    print(f"│  Cost: ${cost:<55.4f}│")
    print("├" + "─" * 62 + "┤")

    # Per-template breakdown
    by_template = report.get("by_template", {})
    for tmpl in sorted(by_template):
        stats = by_template[tmpl]
        t_passed = stats["passed"]
        t_total = stats["total"]
        t_rate = round(t_passed / t_total * 100) if t_total > 0 else 0
        icon = "✅" if t_rate == 100 else "⚠️ " if t_rate >= 50 else "❌"
        bar = _bar(t_passed, t_total, 15)
        line = f"{icon} {tmpl:<20} {bar} {t_passed}/{t_total} ({t_rate}%)"
        print(f"│  {line:<58}  │")

    print("├" + "─" * 62 + "┤")

    # Failed tests detail
    failures = [r for r in report.get("results", []) if not r.get("passed")]
    if failures:
        print(f"│  {'FAILURES':^58}  │")
        print("│" + " " * 62 + "│")
        for f in failures:
            fid = f["fixture_id"]
            stage = f.get("failed_stage", "?")
            # Find the error from the failed stage
            error = ""
            for s in f.get("stages", []):
                if not s["passed"] and s.get("error"):
                    error = s["error"][:50]
                    break
            line = f"  {fid}: failed at {stage}"
            print(f"│{line:<62}│")
            if error:
                print(f"│    {error:<58}│")
    else:
        print(f"│  {'ALL TESTS PASSED ✅':^58}  │")

    print("╰" + "─" * 62 + "╯")

    # Target check
    target = 50
    if rate >= target:
        print(f"\n  ✅ MVP target met: {rate}% >= {target}%")
    else:
        print(f"\n  ⚠️  Below MVP target: {rate}% < {target}%")
    print()


def print_comparison(latest: dict, previous: dict) -> None:
    """Print a comparison between two runs."""
    print("\n── Run Comparison ──")
    l_rate = latest["success_rate"]
    p_rate = previous["success_rate"]
    delta = l_rate - p_rate
    arrow = "↑" if delta > 0 else "↓" if delta < 0 else "→"
    print(f"  Previous: {p_rate}% ({previous['passed']}/{previous['total']})")
    print(f"  Latest:   {l_rate}% ({latest['passed']}/{latest['total']})")
    print(f"  Change:   {arrow} {abs(delta):.1f}%")

    # Find regressions (passed before, failed now)
    prev_passed = {
        r["fixture_id"] for r in previous.get("results", []) if r.get("passed")
    }
    curr_failed = {
        r["fixture_id"] for r in latest.get("results", []) if not r.get("passed")
    }
    regressions = prev_passed & curr_failed
    if regressions:
        print(f"\n  ❌ Regressions ({len(regressions)}):")
        for r in sorted(regressions):
            print(f"    - {r}")

    # Find fixes (failed before, passed now)
    prev_failed = {
        r["fixture_id"] for r in previous.get("results", []) if not r.get("passed")
    }
    curr_passed = {
        r["fixture_id"] for r in latest.get("results", []) if r.get("passed")
    }
    fixes = prev_failed & curr_passed
    if fixes:
        print(f"\n  ✅ Fixed ({len(fixes)}):")
        for r in sorted(fixes):
            print(f"    - {r}")
    print()


def print_composite_dashboard(report: dict) -> None:
    """Print the composite pipeline (T2.15) results dashboard."""
    summary = report["summary"]
    targets = report["targets"]

    print()
    print("╭" + "─" * 62 + "╮")
    print(f"│  {'COMPOSITE PIPELINE DASHBOARD (T2.15)':^58}  │")
    print("├" + "─" * 62 + "┤")
    print(f"│  Run: {report.get('run_at', 'unknown'):<54}  │")
    print(f"│  Runs: {report.get('num_runs', '?'):<55} │")
    print("├" + "─" * 62 + "┤")

    # Cost metrics
    avg = summary["avg_cost_usd"]
    target = targets["target_cost_usd"]
    stretch = targets.get("stretch_target_usd", 0.10)
    baseline = targets["baseline_cost_usd"]
    met = "✅" if summary["target_met"] else "⚠️ "
    savings = summary["savings_vs_baseline_pct"]

    print(f"│  {met} Avg Cost:     ${avg:.4f}  (target ≤${target:.2f}){' ' * 20}│")
    print(f"│  🎯 Stretch:     ${stretch:.2f}   (aspirational){' ' * 27}│")
    print(f"│  📊 Baseline:    ${baseline:.2f}   savings: {savings:+.1f}%{' ' * 22}│")
    print(f"│  📈 Min/Max:     ${summary['min_cost_usd']:.4f} / ${summary['max_cost_usd']:.4f}{' ' * 27}│")
    print(f"│  ⏱️  Avg Time:    {summary['avg_time_seconds']:.1f}s{' ' * 41}│")
    print(f"│  🔄 Avg Iters:   {summary['avg_iterations']:.1f}{' ' * 42}│")
    if summary.get("avg_critique_score"):
        print(f"│  👁️  Avg Score:   {summary['avg_critique_score']:.1f}/10{' ' * 38}│")
    print("├" + "─" * 62 + "┤")

    # Per-step breakdown
    print(f"│  {'PER-STEP AVERAGE COST':^58}  │")
    per_step = report.get("per_step_avg_cost", {})
    for step, cost in sorted(per_step.items()):
        bar_width = min(int(cost / avg * 20), 20) if avg > 0 else 0
        bar = "█" * bar_width + "░" * (20 - bar_width)
        line = f"  {step:<15} {bar} ${cost:.4f}"
        print(f"│{line:<62}│")

    print("├" + "─" * 62 + "┤")

    # Success rate
    rate = summary["success_rate"]
    if rate >= 1.0:
        print(f"│  {'✅ ALL RUNS PASSED':^58}  │")
    else:
        print(f"│  {'⚠️  SOME RUNS FAILED':^58}  │")
        runs = report.get("runs", [])
        for r in runs:
            if not r.get("passed"):
                fid = r["fixture_id"]
                stage = r.get("failed_stage", "?")
                print(f"│    {fid}: failed at {stage:<43}│")

    print("╰" + "─" * 62 + "╯")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Prompt suite results dashboard")
    parser.add_argument("--file", type=Path, help="Path to a specific results JSON")
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Compare latest run with the previous one",
    )
    parser.add_argument(
        "--composite",
        action="store_true",
        help="Show latest composite pipeline (T2.15) results",
    )
    args = parser.parse_args()

    if args.composite:
        composite_runs = sorted(
            (p for p in RESULTS_DIR.glob("composite-*.json")),
            key=lambda p: p.name,
            reverse=True,
        )
        if composite_runs:
            report = _load_report(composite_runs[0])
            print_composite_dashboard(report)
        else:
            print("No composite results found. Run the composite test first:")
            print("  ANTHROPIC_API_KEY=sk-... pytest tests/prompt_suite/test_composite.py -v -s")
        return

    if args.file:
        if not args.file.is_file():
            print(f"Error: {args.file} not found", file=sys.stderr)
            sys.exit(1)
        report = _load_report(args.file)
        # Detect composite report by its 'test' field
        if report.get("test") == "composite_pipeline_t2.15":
            print_composite_dashboard(report)
        else:
            print_dashboard(report)
        return

    runs = _get_sorted_runs()
    if not runs:
        latest = RESULTS_DIR / "latest.json"
        if latest.is_file():
            report = _load_report(latest)
            print_dashboard(report)
        else:
            print("No results found. Run the prompt suite first:")
            print("  ANTHROPIC_API_KEY=sk-... pytest tests/prompt-suite/ -v")
        return

    report = _load_report(runs[0])
    print_dashboard(report)

    if args.compare and len(runs) >= 2:
        previous = _load_report(runs[1])
        print_comparison(report, previous)
    elif args.compare:
        print("Only one run found — nothing to compare against.")


if __name__ == "__main__":
    main()
