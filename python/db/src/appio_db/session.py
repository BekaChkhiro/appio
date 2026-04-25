"""Async database engine and session factory for Neon PostgreSQL."""

import logging
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


def _strip_url_params(url: str) -> str:
    """Remove sslmode/channel_binding from URL — asyncpg uses connect_args instead."""
    parts = urlsplit(url)
    qs = parse_qs(parts.query)
    qs.pop("sslmode", None)
    qs.pop("channel_binding", None)
    return urlunsplit(parts._replace(query=urlencode(qs, doseq=True)))


def create_engine(database_url: str, *, is_neon: bool = True):
    """Create async engine configured for Neon PostgreSQL.

    Args:
        database_url: Neon pooler connection string (use -pooler endpoint).
        is_neon: If True, apply Neon-specific settings (SSL, no prepared stmt cache).
    """
    connect_args: dict = {}
    if is_neon:
        database_url = _strip_url_params(database_url)
        connect_args = {
            "ssl": "require",
            # Neon's pooler runs pgbouncer in transaction mode, which can't
            # hold prepared-statement state across connections. We set both
            # flags — asyncpg issue #1058 shows that only setting one still
            # occasionally creates named prepared statements.
            "prepared_statement_cache_size": 0,
            "statement_cache_size": 0,
            # Belt-and-braces: unnamed prepared statements never collide when
            # pgbouncer reuses the underlying connection for a new session.
            "prepared_statement_name_func": lambda: "",
        }

    return create_async_engine(
        database_url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,  # CRITICAL: detect cold-start stale connections
        # Recycle aggressively. Neon's pooler closes idle-in-transaction
        # and slow-cycle connections unpredictably; keeping pool_recycle
        # below their median idle-kill window (~90-120s) means SQLAlchemy
        # forces a reconnect before the server side hangs up on us.
        # Long agent generations (5-10 min) would otherwise commit against
        # a pooled connection that Neon has already reaped.
        pool_recycle=60,
        connect_args=connect_args,
    )


def create_session_factory(engine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# Default engine/session — initialized via init_db()
_engine = None
_async_session: async_sessionmaker[AsyncSession] | None = None


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
    retry=retry_if_exception_type((OperationalError, DBAPIError)),
    reraise=True,
)
def init_db(database_url: str, *, is_neon: bool = True):
    """Initialize the global engine and session factory. Call once at startup."""
    global _engine, _async_session
    _engine = create_engine(database_url, is_neon=is_neon)
    _async_session = create_session_factory(_engine)
    logger.info("Database engine initialized")


async def close_db():
    """Dispose of the global engine. Call at shutdown."""
    global _engine, _async_session
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _async_session = None
        logger.info("Database engine closed")


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    if _async_session is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _async_session
