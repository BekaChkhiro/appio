import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import firebase_admin
import sentry_sdk
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from firebase_admin import credentials as firebase_credentials
from sentry_sdk.integrations.fastapi import FastApiIntegration
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from appio_db import close_db, get_session_factory, init_db
from apps.api.config import settings
from apps.api.core.exceptions import register_exception_handlers
from apps.api.core.logging import setup_logging
from apps.api.core.middleware import RequestIDMiddleware, limiter
from apps.api.core.rate_limit import close_redis_pool
from apps.api.domains.admin.router import router as admin_router
from apps.api.domains.apps.router import router as apps_router
from apps.api.domains.auth.router import router as auth_router
from apps.api.domains.billing.router import router as billing_router
from apps.api.domains.builds.router import router as builds_router
from apps.api.domains.generation.router import router as generation_router
from apps.api.domains.generation.agent_service import warm_golden_workspace
from apps.api.domains.templates.router import router as templates_router
from apps.api.domains.themes.router import router as themes_router
from apps.api.domains.convex.router import router as convex_router

setup_logging(debug=settings.debug)
logger = structlog.stdlib.get_logger()

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
    )
    logger.info("sentry_initialized")


def _init_firebase() -> None:
    """Initialize Firebase Admin SDK (idempotent — safe to call multiple times)."""
    try:
        firebase_admin.get_app()
        return  # Already initialized
    except ValueError:
        pass  # Not yet initialized — proceed
    if settings.firebase_service_account_path:
        cred = firebase_credentials.Certificate(settings.firebase_service_account_path)
        firebase_admin.initialize_app(cred)
    else:
        # Use Application Default Credentials (ADC) or GOOGLE_APPLICATION_CREDENTIALS
        firebase_admin.initialize_app()
    logger.info("firebase_initialized", project_id=settings.firebase_project_id)


async def _warm_golden_workspace_bg() -> None:
    """Warm the golden node_modules cache in a background thread."""
    try:
        await asyncio.to_thread(warm_golden_workspace)
    except Exception:
        logger.warning("golden_workspace_warm_failed", exc_info=True)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    is_neon = "neon" in settings.database_url
    init_db(settings.database_url, is_neon=is_neon)
    logger.info("database_connected")
    _init_firebase()
    # Warm the golden workspace in a background thread so the first
    # generation doesn't pay the ~15 s npm-install cost.
    asyncio.create_task(_warm_golden_workspace_bg())
    yield
    await close_redis_pool()
    logger.info("redis_pool_closed")
    await close_db()  # type: ignore[no-untyped-call]
    logger.info("database_disconnected")


app = FastAPI(
    title="Appio API",
    version="0.1.0",
    lifespan=lifespan,
)

# Middleware (order matters — outermost first)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

# Custom exception handlers
register_exception_handlers(app)

# Routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(apps_router, prefix="/api/v1/apps", tags=["apps"])
app.include_router(generation_router, prefix="/api/v1/generate", tags=["generation"])
app.include_router(builds_router, prefix="/api/v1/builds", tags=["builds"])
app.include_router(billing_router, prefix="/api/v1/billing", tags=["billing"])
app.include_router(templates_router, prefix="/api/v1/templates", tags=["templates"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(themes_router, prefix="/api/v1/themes", tags=["themes"])
app.include_router(convex_router, prefix="/api/v1/convex", tags=["convex"])


async def _check_db() -> str:
    """Check database connectivity."""
    try:
        factory = get_session_factory()
        async with factory() as session:
            await session.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        return "error"


async def _check_redis() -> str:
    """Check Redis connectivity via the shared connection pool."""
    try:
        from apps.api.core.rate_limit import _get_redis
        r = _get_redis()
        await r.ping()
        return "ok"
    except Exception:
        return "error"


@app.get("/health")
async def health() -> Any:
    """Health check with DB and Redis connectivity tests (parallel)."""
    db_status, redis_status = await asyncio.gather(
        _check_db(), _check_redis(), return_exceptions=False
    )

    status = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
    result = {
        "status": status,
        "service": "appio-api",
        "db": db_status,
        "redis": redis_status,
    }

    if status == "degraded":
        return JSONResponse(content=result, status_code=503)
    return result
