#!/usr/bin/env python3
"""Build the golden node_modules workspace for agent generation.

Usage:
    python scripts/warm-golden-workspace.py

Creates the golden workspace (default: /var/cache/appio-template/) with
the base template + node_modules pre-installed.  Subsequent agent
generations copy from here instead of running ``npm install`` per
workspace (~15 s -> ~0.5 s).

Override the path via the GOLDEN_WORKSPACE_PATH env var for local dev:
    GOLDEN_WORKSPACE_PATH=/tmp/appio-golden python scripts/warm-golden-workspace.py
"""

import sys
from pathlib import Path

# Ensure repo packages are importable.
_repo = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_repo / "apps" / "api"))
sys.path.insert(0, str(_repo / "python" / "builder" / "src"))
sys.path.insert(0, str(_repo / "python" / "shared" / "src"))
sys.path.insert(0, str(_repo / "python" / "db" / "src"))

from domains.generation.agent_service import warm_golden_workspace  # noqa: E402


def main() -> None:
    print("Warming golden workspace...")  # noqa: T201
    path = warm_golden_workspace()
    nm = path / "node_modules"
    count = len(list(nm.iterdir())) if nm.is_dir() else 0
    print(f"Done: {path}  ({count} node_modules entries)")  # noqa: T201


if __name__ == "__main__":
    main()
