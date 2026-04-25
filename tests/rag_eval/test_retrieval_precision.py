"""Retrieval-precision harness for the RAG knowledge base (T3.4 acceptance).

Validates that `packages/prompts/rag/snippets.json` contains enough
Convex-focused content — and indexes to retrieve it — to satisfy:

    acceptance: retrieval precision >= 80% on a 10-prompt sample set
    (PROJECT_PLAN.md T3.4)

Two test paths, intentionally different in what they prove:

1. Structural + keyword-bridge tests (CI default, always run).
   Proves the *content* is shaped correctly: JSON is valid, 20+ Convex
   snippets exist, golden titles are present in the corpus, and each
   golden prompt has at least one keyword bridge to its must-have
   snippet (content/title/tags overlap). These are the necessary
   preconditions for real retrieval to succeed.

2. Real Voyage + Neon test (opt-in: `pytest -m rag_real`).
   Runs ``retrieve_snippets()`` against the seeded pgvector index and
   asserts the 80% gate end-to-end. Requires VOYAGE_API_KEY and
   DATABASE_URL, plus a completed `scripts/seed_rag.py` run after any
   change to snippets.json. This is the authoritative acceptance gate.

The fake BM25 test is deliberately *not* strict — lexical BM25 is a poor
proxy for semantic embedding quality. It runs as a diagnostic (prints the
top-5 ranking for each prompt) and asserts only a loose lower bound to
catch a catastrophically empty corpus.
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any, NamedTuple

import pytest

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SNIPPETS_PATH = PROJECT_ROOT / "packages" / "prompts" / "rag" / "snippets.json"


# ---------------------------------------------------------------------------
# Golden set — 10 canonical prompts paired with their must-have snippet title.
#
# Titles are matched as case-insensitive substrings so small cosmetic edits
# don't break the test. The substring must be distinctive enough to
# unambiguously identify one snippet (enforced by
# `test_golden_substrings_are_unambiguous`).
#
# "also_relevant" lists additional titles whose presence in top-5 is a
# *bonus signal* for the real-path test but is not required to pass.
# ---------------------------------------------------------------------------


class GoldenCase(NamedTuple):
    prompt: str
    must_have_substring: str
    also_relevant: tuple[str, ...]


GOLDEN_SET: list[GoldenCase] = [
    GoldenCase(
        prompt=(
            "Build a todo app where users can add tasks and the list stays in "
            "sync between their phone and laptop in real time"
        ),
        must_have_substring="useCollection — typed CRUD",
        also_relevant=(
            "Convex schema — multi-tenant",
            "useQuery — reactive",
            "useMutation — Convex mutation",
        ),
    ),
    GoldenCase(
        prompt=(
            "Habit tracker with a daily streak counter — data needs to persist "
            "across devices when the user signs in"
        ),
        must_have_substring="habit tracker schema with streak",
        also_relevant=(
            "useCollection — typed CRUD",
            "Convex schema — multi-tenant",
        ),
    ),
    GoldenCase(
        prompt=(
            "Notes app with folders. Each note belongs to a folder. Users can "
            "create, rename, and delete folders."
        ),
        must_have_substring="related tables with Id references",
        also_relevant=(
            "Convex schema — multi-tenant",
        ),
    ),
    GoldenCase(
        prompt=(
            "Expense tracker for iPhone that still works when the user is in "
            "airplane mode and syncs automatically when the connection comes back"
        ),
        must_have_substring="Capacitor + Convex",
        also_relevant=(
            "airplane-mode UX",
            "connection state",
        ),
    ),
    GoldenCase(
        prompt=(
            "Real-time quiz app where the leaderboard updates live as soon as "
            "anyone answers a question"
        ),
        must_have_substring="useQuery — reactive Convex queries",
        also_relevant=(
            "Convex pagination",
            "useMutation — Convex mutation",
        ),
    ),
    GoldenCase(
        prompt=(
            "Let users sign in with Google, save their profile in the cloud, "
            "and keep them signed in across sessions"
        ),
        must_have_substring="Firebase Auth + Convex JWT bridge",
        also_relevant=(
            "Convex schema — multi-tenant",
        ),
    ),
    GoldenCase(
        prompt=(
            "Send a daily reminder notification to every user at 9am in their "
            "local morning"
        ),
        must_have_substring="scheduled function — cron",
        also_relevant=(
            "Convex action",
        ),
    ),
    GoldenCase(
        prompt=(
            "Dashboard that shows this month's total spending broken down by "
            "category with a chart"
        ),
        must_have_substring="expense tracker with monthly category aggregation",
        also_relevant=(
            "withIndex — single and composite",
            "Convex pagination",
        ),
    ),
    GoldenCase(
        prompt=(
            "A team collaboration app — each user should only be able to see "
            "their own projects, never anyone else's"
        ),
        must_have_substring="Missing tenant filter",
        also_relevant=(
            "tenantQuery and tenantMutation",
            "Convex schema — multi-tenant",
            "Missing ownership check",
        ),
    ),
    GoldenCase(
        prompt=(
            "Shopping list that feels instant when the user taps — items should "
            "appear immediately even when the phone is offline"
        ),
        must_have_substring="airplane-mode UX",
        also_relevant=(
            "connection state",
            "withOptimisticUpdate",
            "Capacitor + Convex",
        ),
    ),
]

PRECISION_THRESHOLD = 0.80
MIN_HITS = math.ceil(PRECISION_THRESHOLD * len(GOLDEN_SET))  # 8/10


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _load_snippets() -> list[dict[str, Any]]:
    with SNIPPETS_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _title_in_results(substring: str, titles: list[str]) -> bool:
    needle = substring.lower()
    return any(needle in t.lower() for t in titles)


# Very small stopword list — we deliberately keep domain-ish terms like
# "sync", "offline", "auth" because they carry retrieval signal.
STOPWORDS: frozenset[str] = frozenset(
    {
        "a", "an", "and", "any", "are", "as", "at", "be", "by", "can",
        "could", "do", "every", "for", "from", "get", "has", "have",
        "i", "if", "in", "into", "is", "it", "its", "just", "let",
        "like", "make", "my", "of", "on", "only", "or", "our", "own",
        "should", "so", "some", "such", "than", "that", "the", "their",
        "them", "they", "this", "those", "to", "up", "use", "user",
        "users", "was", "were", "what", "when", "where", "which",
        "who", "will", "with", "would", "you", "your",
        # these appear EVERYWHERE in the corpus so they're not discriminative
        "app", "apps", "data", "show", "build", "create", "add", "new",
    }
)


def _tokenize(text: str) -> list[str]:
    return [
        t.lower()
        for t in re.findall(r"[A-Za-z][A-Za-z0-9_-]+", text)
        if t.lower() not in STOPWORDS and len(t) > 1
    ]


def _snippet_tokens(snippet: dict[str, Any]) -> set[str]:
    """Bag-of-tokens drawn from title + tags + content."""
    tokens = set(_tokenize(snippet["title"]))
    tokens.update(t.lower() for t in snippet.get("tags", []))
    tokens.update(_tokenize(snippet["content"]))
    return tokens


# ---------------------------------------------------------------------------
# Structural tests — always run, strict
# ---------------------------------------------------------------------------


def test_snippets_file_is_valid_json() -> None:
    snippets = _load_snippets()
    assert snippets, "snippets.json is empty"
    required = {"title", "category", "content", "tags"}
    for i, s in enumerate(snippets):
        missing = required - s.keys()
        assert not missing, f"snippet #{i} missing fields: {missing}"
        assert isinstance(s["tags"], list)


def test_convex_coverage_minimum_20() -> None:
    """T3.4 delivers >= 20 Convex-focused snippets."""
    snippets = _load_snippets()
    convex_entries = [
        s
        for s in snippets
        if "convex" in s["title"].lower()
        or "convex" in {t.lower() for t in s.get("tags", [])}
    ]
    assert len(convex_entries) >= 20, (
        f"T3.4 acceptance requires >=20 Convex-focused snippets in the "
        f"corpus; found {len(convex_entries)}."
    )


def test_no_duplicate_titles() -> None:
    snippets = _load_snippets()
    counts = Counter(s["title"] for s in snippets)
    dupes = {title: n for title, n in counts.items() if n > 1}
    assert not dupes, f"duplicate titles in snippets.json: {dupes}"


def test_firebase_auth_snippet_preserved() -> None:
    """Keep the Firebase Auth snippet (T3.4 description: 'Keep Firebase
    Auth + FCM docs in RAG — still in use for those features')."""
    snippets = _load_snippets()
    has_firebase_auth = any(
        "firebase" in s["title"].lower() and "auth" in s["title"].lower()
        for s in snippets
    )
    assert has_firebase_auth, "Firebase Auth snippet must remain in the corpus"


def test_golden_substrings_are_unambiguous() -> None:
    """Each must-have substring should match exactly one corpus title —
    otherwise the per-case assertion is meaningless (multiple snippets
    could satisfy it). also_relevant entries aren't required to be unique
    since they're bonus signals."""
    snippets = _load_snippets()
    titles = [s["title"] for s in snippets]
    for case in GOLDEN_SET:
        matches = [t for t in titles if case.must_have_substring.lower() in t.lower()]
        assert len(matches) == 1, (
            f"must_have_substring {case.must_have_substring!r} for prompt "
            f"{case.prompt[:60]!r} matched {len(matches)} titles: {matches}"
        )


def test_prompt_to_must_have_has_keyword_bridge() -> None:
    """Each golden prompt should share at least one discriminative token
    with its must-have snippet's (title + tags + content). Zero overlap
    means even a perfect embedding can't bridge them — that's an
    authoring bug, not a retrieval bug."""
    snippets = _load_snippets()
    title_to_snippet = {s["title"]: s for s in snippets}

    misses: list[tuple[str, str]] = []
    for case in GOLDEN_SET:
        target = next(
            (
                s
                for title, s in title_to_snippet.items()
                if case.must_have_substring.lower() in title.lower()
            ),
            None,
        )
        assert target is not None, f"must-have title missing for {case.prompt!r}"
        prompt_tokens = set(_tokenize(case.prompt))
        snippet_tokens = _snippet_tokens(target)
        overlap = prompt_tokens & snippet_tokens
        if not overlap:
            misses.append((case.prompt[:70], target["title"]))

    assert not misses, (
        "Golden prompts with zero keyword overlap with their must-have snippet:\n"
        + "\n".join(f"  - {p!r} -> {t!r}" for p, t in misses)
    )


# ---------------------------------------------------------------------------
# Fake BM25 path — diagnostic + loose lower bound
# ---------------------------------------------------------------------------


def _bm25_rank(
    prompt: str,
    snippets: list[dict[str, Any]],
    *,
    top_k: int,
    k1: float = 1.5,
    b: float = 0.75,
) -> list[tuple[dict[str, Any], float]]:
    """Classic BM25 over (title + content + tags) per snippet.

    Returns list of (snippet, score) sorted descending by score, top_k only.
    """
    docs = [_snippet_tokens(s) for s in snippets]
    doc_lens = [len(d) for d in docs]
    avgdl = sum(doc_lens) / max(1, len(doc_lens))

    # Document frequency for IDF
    df: Counter[str] = Counter()
    for d in docs:
        df.update(d)
    n_docs = len(docs)

    prompt_tokens = _tokenize(prompt)

    def idf(term: str) -> float:
        # Classic Robertson-Sparck-Jones IDF floor (can go negative otherwise)
        return math.log(1 + (n_docs - df[term] + 0.5) / (df[term] + 0.5))

    scored: list[tuple[dict[str, Any], float]] = []
    for snippet, doc, dl in zip(snippets, docs, doc_lens):
        score = 0.0
        # BM25 counts term frequency per document. Our bag-of-tokens is a set
        # so we approximate TF with presence (1 if in doc, else 0). This is
        # a known simplification — BM25 over a boolean term presence still
        # correlates well with real retrieval on short, keyword-dense docs.
        for term in set(prompt_tokens):
            if term not in doc:
                continue
            tf = 1.0
            norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * dl / max(1, avgdl)))
            score += idf(term) * norm
        scored.append((snippet, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]


def test_fake_bm25_diagnostic(capsys: pytest.CaptureFixture[str]) -> None:
    """Prints the BM25 top-5 for each golden prompt and asserts a loose
    lower bound (>=5/10 hits). BM25 is a lexical proxy; failing here
    means the corpus has almost no keyword overlap with realistic user
    prompts — likely a content authoring problem.

    The real-path test (`test_real_precision_meets_80`) is the actual
    acceptance gate; this one is a tripwire.
    """
    snippets = _load_snippets()
    hits = 0
    lines: list[str] = [
        "",
        "BM25 retrieval (lexical proxy for real embedding retrieval):",
        "=" * 72,
    ]
    for case in GOLDEN_SET:
        ranked = _bm25_rank(case.prompt, snippets, top_k=5)
        titles = [s["title"] for s, _ in ranked]
        hit = _title_in_results(case.must_have_substring, titles)
        if hit:
            hits += 1
        marker = "HIT " if hit else "MISS"
        lines.append(f"\n[{marker}] {case.prompt[:70]}")
        lines.append(f"   expected substring: {case.must_have_substring!r}")
        for i, (snippet, score) in enumerate(ranked, 1):
            lines.append(f"   {i}. ({score:5.2f}) {snippet['title']}")

    lines.append("")
    lines.append(f"BM25 hits: {hits}/{len(GOLDEN_SET)}")
    lines.append("=" * 72)
    with capsys.disabled():
        print("\n".join(lines))

    # Very loose gate — real retrieval will do better than lexical BM25.
    # This exists only to catch a catastrophically empty/misshapen corpus.
    assert hits >= 5, (
        f"BM25 found only {hits}/{len(GOLDEN_SET)} must-have snippets. "
        "This is a lexical lower bound — the corpus is almost certainly "
        "too thin or titles are misleading. See printed ranking above."
    )


# ---------------------------------------------------------------------------
# Real-path test — the authoritative T3.4 acceptance gate
# ---------------------------------------------------------------------------


try:
    from appio_db.session import create_engine, create_session_factory
    from apps.api.domains.generation.rag import retrieve_snippets

    _REAL_IMPORTS_OK = True
except Exception:  # pragma: no cover — opt-in path
    _REAL_IMPORTS_OK = False


def _real_path_available() -> bool:
    return (
        _REAL_IMPORTS_OK
        and bool(os.environ.get("VOYAGE_API_KEY"))
        and bool(os.environ.get("DATABASE_URL"))
    )


@pytest.mark.rag_real
@pytest.mark.skipif(
    not _real_path_available(),
    reason="rag_real requires VOYAGE_API_KEY, DATABASE_URL, and importable apps.api modules",
)
async def test_real_precision_meets_80(capsys: pytest.CaptureFixture[str]) -> None:
    """Hit the seeded pgvector index via Voyage embeddings. Asserts the
    T3.4 acceptance bar: at least 80% of golden prompts must retrieve
    their must-have snippet in top-5.

    Pre-requisite: ``python scripts/seed_rag.py`` has been run since the
    last snippets.json change (otherwise the index lags the corpus).
    """
    # Mirror the env handling in scripts/seed_rag.py so settings resolve the
    # same way the real pipeline does.
    os.environ.setdefault("ANTHROPIC_API_KEY", "not-needed-for-rag-eval")
    os.environ.setdefault("AGENT_RAG_ENABLED", "true")
    from apps.api.config import settings
    settings.voyage_api_key = os.environ["VOYAGE_API_KEY"]

    database_url = os.environ["DATABASE_URL"]
    engine = create_engine(database_url, is_neon="neon" in database_url)
    session_factory = create_session_factory(engine)

    hits = 0
    bonus_hits = 0
    lines: list[str] = [
        "",
        "Live retrieval (Voyage + Neon pgvector):",
        "=" * 72,
    ]

    # Voyage free tier: 3 RPM. seed_rag.py uses 21 s between batches; we
    # mirror that here so a free-tier user can run the acceptance test end
    # to end without hitting rate limits. Paid tier can drop this via env.
    rpm_sleep = float(os.environ.get("RAG_EVAL_RPM_SLEEP_SECONDS", "21"))

    try:
        for i, case in enumerate(GOLDEN_SET):
            if i > 0 and rpm_sleep > 0:
                await asyncio.sleep(rpm_sleep)
            results = await retrieve_snippets(
                user_prompt=case.prompt,
                session_factory=session_factory,
                top_k=5,
                score_threshold=0.0,  # rank-only; floor filtering is product-tunable
            )
            titles = [r.title for r in results]
            hit = _title_in_results(case.must_have_substring, titles)
            if hit:
                hits += 1
            bonus_hits += sum(
                1
                for substring in case.also_relevant
                if _title_in_results(substring, titles)
            )
            marker = "HIT " if hit else "MISS"
            lines.append(f"\n[{marker}] {case.prompt[:70]}")
            lines.append(f"   expected substring: {case.must_have_substring!r}")
            for r_i, r in enumerate(results, 1):
                lines.append(f"   {r_i}. ({r.score:.3f}) {r.title}")
    finally:
        await engine.dispose()

    precision = hits / len(GOLDEN_SET)
    lines.append("")
    lines.append(
        f"Precision: {hits}/{len(GOLDEN_SET)} = {precision:.0%} "
        f"(threshold: {PRECISION_THRESHOLD:.0%})"
    )
    lines.append(
        f"Bonus (also_relevant hits across all prompts): {bonus_hits}"
    )
    lines.append("=" * 72)
    with capsys.disabled():
        print("\n".join(lines))

    assert hits >= MIN_HITS, (
        f"T3.4 acceptance: retrieval precision >= {PRECISION_THRESHOLD:.0%}; "
        f"got {hits}/{len(GOLDEN_SET)} = {precision:.0%}. See printed "
        "ranking above for which prompts missed."
    )
