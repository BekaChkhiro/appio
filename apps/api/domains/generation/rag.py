"""RAG knowledge base — embedding + retrieval for agent generation.

Stores curated UI patterns, Tailwind v4 rules, component library docs, and
mobile design snippets as pgvector embeddings.  At generation time the user
prompt is embedded via Voyage AI and the top-K most relevant snippets are
injected into the agent's system prompt.

Usage (wired into the agent loop — see agent_service.py):

    from apps.api.domains.generation.rag import retrieve_snippets

    snippets = await retrieve_snippets(
        user_prompt="habit tracker with weekly charts",
        session_factory=sf,
        top_k=5,
    )
    # → list[RAGResult] with .title, .content, .category, .score
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

import structlog
import voyageai
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from appio_db.models import RAGSnippet
from apps.api.config import settings

logger = structlog.stdlib.get_logger()

# Voyage AI model for code/technical content — 1024 dimensions
_EMBED_MODEL = "voyage-code-3"
_EMBED_DIMENSIONS = 1024

# Cache Voyage client (module-level singleton)
_voyage_client: voyageai.AsyncClient | None = None


def _get_voyage_client() -> voyageai.AsyncClient:
    """Lazy-init the Voyage AI async client."""
    global _voyage_client
    if _voyage_client is None:
        if not settings.voyage_api_key:
            raise RuntimeError("VOYAGE_API_KEY not set — cannot embed for RAG")
        _voyage_client = voyageai.AsyncClient(api_key=settings.voyage_api_key)
    return _voyage_client


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts via Voyage AI.

    Args:
        texts: Up to 128 texts per batch (Voyage API limit).

    Returns:
        List of 1024-dim float vectors, one per input text.
    """
    client = _get_voyage_client()
    result = await client.embed(texts, model=_EMBED_MODEL, input_type="document")
    return result.embeddings


async def embed_query(query: str) -> list[float]:
    """Embed a single query string (uses query input_type for asymmetric search)."""
    client = _get_voyage_client()
    result = await client.embed([query], model=_EMBED_MODEL, input_type="query")
    return result.embeddings[0]


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class RAGResult:
    """A retrieved snippet with similarity score."""
    title: str
    content: str
    category: str
    tags: list[str]
    score: float  # 1.0 = identical, 0.0 = orthogonal


async def retrieve_snippets(
    user_prompt: str,
    session_factory: async_sessionmaker[AsyncSession],
    *,
    top_k: int = 5,
    category_filter: str | None = None,
    score_threshold: float = 0.3,
) -> list[RAGResult]:
    """Retrieve the most relevant knowledge base snippets for a user prompt.

    Args:
        user_prompt: The user's app description / generation prompt.
        session_factory: SQLAlchemy async session factory.
        top_k: Maximum number of snippets to return.
        category_filter: Optional category to restrict search (e.g. "tailwind_v4").
        score_threshold: Minimum cosine similarity to include (0.0–1.0).

    Returns:
        List of RAGResult sorted by descending similarity.
    """
    if not settings.agent_rag_enabled:
        return []

    query_embedding = await embed_query(user_prompt)

    # pgvector cosine distance: 1 - cosine_similarity
    # So we order by distance ASC and convert back to similarity score
    distance_expr = RAGSnippet.embedding.cosine_distance(query_embedding)

    stmt = (
        select(
            RAGSnippet.title,
            RAGSnippet.content,
            RAGSnippet.category,
            RAGSnippet.tags,
            (1 - distance_expr).label("score"),
        )
        .order_by(distance_expr)
        .limit(top_k)
    )

    if category_filter:
        stmt = stmt.where(RAGSnippet.category == category_filter)

    async with session_factory() as session:
        rows = (await session.execute(stmt)).all()

    results = [
        RAGResult(
            title=row.title,
            content=row.content,
            category=row.category,
            tags=list(row.tags),
            score=float(row.score),
        )
        for row in rows
        if row.score >= score_threshold
    ]

    logger.info(
        "rag_retrieval",
        prompt_len=len(user_prompt),
        results=len(results),
        top_score=results[0].score if results else 0.0,
    )
    return results


def format_snippets_for_prompt(snippets: list[RAGResult]) -> str:
    """Format retrieved snippets as a text block for injection into the system prompt.

    Returns a markdown section that can be appended to the agent system prompt.
    """
    if not snippets:
        return ""

    lines = ["## Relevant Knowledge Base Snippets", ""]
    for i, s in enumerate(snippets, 1):
        lines.append(f"### {i}. {s.title} [{s.category}]")
        lines.append(s.content)
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Admin: bulk insert snippets (used by seed script)
# ---------------------------------------------------------------------------

async def upsert_snippets(
    snippets: list[dict],
    session_factory: async_sessionmaker[AsyncSession],
) -> int:
    """Insert or update snippets in the knowledge base.

    Each snippet dict must have: title, category, content, tags.
    Embeddings are generated automatically via Voyage AI.

    Deduplication is by (category, title) — existing rows with the same
    category+title are deleted before insert.

    Returns:
        Number of snippets inserted.
    """
    if not snippets:
        return 0

    # Generate embeddings in batches
    # Use small batches with delay to respect Voyage AI rate limits
    # (free tier: 3 RPM, 10K TPM)
    all_texts = [f"{s['title']}\n\n{s['content']}" for s in snippets]
    all_embeddings: list[list[float]] = []

    batch_size = 8
    for i in range(0, len(all_texts), batch_size):
        batch = all_texts[i : i + batch_size]
        if i > 0:
            await asyncio.sleep(21)  # stay under 3 RPM limit
        batch_embeddings = await embed_texts(batch)
        all_embeddings.extend(batch_embeddings)
        logger.info("rag_embed_batch", batch=i // batch_size + 1, total=len(batch))

    async with session_factory() as session:
        async with session.begin():
            # Delete existing snippets with same (category, title)
            for s in snippets:
                await session.execute(
                    text(
                        "DELETE FROM rag_snippets WHERE category = :cat AND title = :title"
                    ),
                    {"cat": s["category"], "title": s["title"]},
                )

            # Bulk insert
            objects = [
                RAGSnippet(
                    category=s["category"],
                    title=s["title"],
                    content=s["content"],
                    tags=s.get("tags", []),
                    embedding=emb,
                )
                for s, emb in zip(snippets, all_embeddings)
            ]
            session.add_all(objects)

    logger.info("rag_upsert", count=len(snippets))
    return len(snippets)
