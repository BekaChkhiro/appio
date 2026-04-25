#!/usr/bin/env bash
# Run the T3.4 retrieval-precision acceptance test against live Voyage + Neon.
# Requires VOYAGE_API_KEY and DATABASE_URL in .env.
# Takes ~3.5 minutes (10 prompts × 21s Voyage rate-limit pause).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

set -a
# shellcheck disable=SC1091
source .env
set +a

PYTHONPATH="$REPO_ROOT" .venv/bin/python -m pytest tests/rag_eval/ -m rag_real -v -s
