"""Shared pytest configuration for the prompt engineering test suite.

Provides:
- ``--skip-esbuild`` flag to run without Node.js
- ``--skip-browser`` flag to run without Playwright
- ``--prompt-id`` filter to run a single fixture
- Automatic results collection to ``tests/prompt-suite/results/``
"""

from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pytest


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--skip-esbuild",
        action="store_true",
        default=False,
        help="Skip the esbuild build stage (runs Claude + codegen only)",
    )
    parser.addoption(
        "--skip-browser",
        action="store_true",
        default=False,
        help="Skip Playwright browser validation",
    )
    parser.addoption(
        "--prompt-id",
        action="store",
        default=None,
        help="Run only the fixture with this ID (e.g., 'todo-simple')",
    )
    # Composite pipeline test options (T2.15)
    parser.addoption(
        "--composite-runs",
        action="store",
        default=5,
        type=int,
        help="Number of composite pipeline runs (default: 5)",
    )
    parser.addoption(
        "--skip-vision",
        action="store_true",
        default=False,
        help="Skip vision critique + fix pass in composite test",
    )
    parser.addoption(
        "--skip-rag",
        action="store_true",
        default=False,
        help="Skip RAG retrieval in composite test (no Voyage AI needed)",
    )


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    """Skip prompt suite tests if ANTHROPIC_API_KEY is not set."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        skip_marker = pytest.mark.skip(
            reason="ANTHROPIC_API_KEY not set — prompt suite requires Claude API access"
        )
        for item in items:
            if "prompt_suite" in item.keywords:
                item.add_marker(skip_marker)

    # Filter by --prompt-id if specified
    prompt_id = config.getoption("--prompt-id")
    if prompt_id:
        selected = []
        deselected = []
        for item in items:
            if hasattr(item, "callspec") and item.callspec.params.get("fixture", None):
                if item.callspec.params["fixture"].id == prompt_id:
                    selected.append(item)
                else:
                    deselected.append(item)
            else:
                selected.append(item)
        if deselected:
            config.hook.pytest_deselected(items=deselected)
            items[:] = selected


@pytest.fixture
def skip_esbuild(request: pytest.FixtureRequest) -> bool:
    if request.config.getoption("--skip-esbuild"):
        return True
    # Also skip if node is not available
    if shutil.which("node") is None:
        return True
    return False


@pytest.fixture
def skip_browser(request: pytest.FixtureRequest) -> bool:
    if request.config.getoption("--skip-browser"):
        return True
    try:
        import playwright  # noqa: F401
        return False
    except ImportError:
        return True


# ── Results collection ─────────────────────────────────────────────────────

_RESULTS_DIR = Path(__file__).parent / "results"


class ResultsCollector:
    """Pytest plugin that collects prompt suite results into a JSON file."""

    def __init__(self) -> None:
        self.results: list[dict] = []
        self.run_started: datetime | None = None

    def pytest_sessionstart(self, session: pytest.Session) -> None:
        self.run_started = datetime.now(tz=timezone.utc)

    def pytest_sessionfinish(self, session: pytest.Session, exitstatus: int) -> None:
        if not self.results:
            return

        _RESULTS_DIR.mkdir(parents=True, exist_ok=True)

        total = len(self.results)
        passed = sum(1 for r in self.results if r.get("passed"))
        by_template: dict[str, dict] = {}
        for r in self.results:
            tmpl = r.get("template", "unknown")
            if tmpl not in by_template:
                by_template[tmpl] = {"total": 0, "passed": 0, "failed": 0}
            by_template[tmpl]["total"] += 1
            if r.get("passed"):
                by_template[tmpl]["passed"] += 1
            else:
                by_template[tmpl]["failed"] += 1

        report = {
            "run_at": self.run_started.isoformat() if self.run_started else None,
            "total": total,
            "passed": passed,
            "failed": total - passed,
            "success_rate": round(passed / total * 100, 1) if total > 0 else 0,
            "by_template": by_template,
            "total_cost_usd": round(
                sum(r.get("cost_usd", 0) for r in self.results), 4
            ),
            "results": self.results,
        }

        # Write timestamped report
        ts = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        report_path = _RESULTS_DIR / f"run-{ts}.json"
        report_path.write_text(
            json.dumps(report, indent=2, default=str), encoding="utf-8"
        )

        # Also write a "latest" symlink-style copy
        latest_path = _RESULTS_DIR / "latest.json"
        latest_path.write_text(
            json.dumps(report, indent=2, default=str), encoding="utf-8"
        )

        # Print summary to terminal
        print(f"\n{'=' * 60}")
        print(f"  PROMPT SUITE RESULTS: {passed}/{total} passed ({report['success_rate']}%)")
        print(f"  Total cost: ${report['total_cost_usd']:.4f}")
        print(f"{'=' * 60}")
        for tmpl, stats in sorted(by_template.items()):
            rate = round(stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
            print(f"  {tmpl}: {stats['passed']}/{stats['total']} ({rate}%)")
        print(f"  Report: {report_path}")
        print(f"{'=' * 60}\n")


_collector = ResultsCollector()


def pytest_configure(config: pytest.Config) -> None:  # noqa: F811
    config.addinivalue_line(
        "markers",
        "prompt_suite: marks tests as prompt suite (requires ANTHROPIC_API_KEY)",
    )
    config.pluginmanager.register(_collector, "prompt_suite_collector")


def record_result(result_dict: dict) -> None:
    """Called by test functions to record a pipeline result."""
    _collector.results.append(result_dict)
