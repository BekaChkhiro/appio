#!/usr/bin/env python3
"""Seed the RAG knowledge base with curated snippets.

Usage:
    # From repo root, with env vars set:
    python scripts/seed_rag.py

    # Or with explicit env file:
    DATABASE_URL=... VOYAGE_API_KEY=... python scripts/seed_rag.py

Reads snippets from packages/prompts/rag/snippets.json, generates Voyage AI
embeddings, and upserts into the rag_snippets table.

Requires: VOYAGE_API_KEY and DATABASE_URL env vars.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

# Add project roots to path so imports work
_repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_repo_root / "apps" / "api"))
sys.path.insert(0, str(_repo_root / "python" / "db" / "src"))
sys.path.insert(0, str(_repo_root / "python" / "shared" / "src"))


async def main() -> None:
    # Validate env
    database_url = os.environ.get("DATABASE_URL")
    voyage_key = os.environ.get("VOYAGE_API_KEY")

    if not database_url:
        print("ERROR: DATABASE_URL env var not set")
        sys.exit(1)
    if not voyage_key:
        print("ERROR: VOYAGE_API_KEY env var not set")
        sys.exit(1)

    # Load snippets
    snippets_path = _repo_root / "packages" / "prompts" / "rag" / "snippets.json"
    if not snippets_path.exists():
        print(f"ERROR: Snippets file not found: {snippets_path}")
        sys.exit(1)

    with open(snippets_path) as f:
        snippets = json.load(f)

    print(f"Loaded {len(snippets)} snippets from {snippets_path.name}")

    # Count by category
    cats: dict[str, int] = {}
    for s in snippets:
        cats[s["category"]] = cats.get(s["category"], 0) + 1
    for cat, count in sorted(cats.items()):
        print(f"  {cat}: {count}")

    # Initialize database
    from appio_db.session import create_engine, create_session_factory

    is_neon = "neon" in database_url
    engine = create_engine(database_url, is_neon=is_neon)
    session_factory = create_session_factory(engine)

    # Patch settings for RAG service
    os.environ["ANTHROPIC_API_KEY"] = os.environ.get("ANTHROPIC_API_KEY", "not-needed")
    os.environ.setdefault("AGENT_RAG_ENABLED", "true")

    from apps.api.config import settings
    settings.voyage_api_key = voyage_key

    # Import RAG service (after settings are patched)
    from apps.api.domains.generation.rag import upsert_snippets

    print(f"\nGenerating embeddings via Voyage AI (voyage-code-3)...")
    print(f"This may take a minute for {len(snippets)} snippets...")

    count = await upsert_snippets(snippets, session_factory)

    print(f"\n✅ Successfully seeded {count} snippets into rag_snippets table")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
