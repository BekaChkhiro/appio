"""Dramatiq actor for asynchronous PWA builds.

T2.2b: The spec-based build path has been removed. The agent pipeline
(AgentService) now handles building via tool-use and calls
``Orchestrator.build_from_workspace()`` directly. This module is kept for
the builds domain polling fallback (``GET /api/v1/builds/{id}/status``)
and for any future async deploy tasks.

The actor is registered lazily — importing this module no longer requires
a running Redis broker, so the API process and the test suite can import
``appio_builder.tasks`` without side effects.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from .config import load_config
from .orchestrator import BuildError, Orchestrator

__all__ = [
    "BROKER_AVAILABLE",
    "configure_broker",
]

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Broker setup
# ---------------------------------------------------------------------------

try:
    import dramatiq
    from dramatiq.brokers.redis import RedisBroker

    BROKER_AVAILABLE = True
except ImportError:  # pragma: no cover - dramatiq is a hard dep, but be safe
    dramatiq = None  # type: ignore[assignment]
    RedisBroker = None  # type: ignore[assignment]
    BROKER_AVAILABLE = False


_broker_configured = False


def configure_broker(redis_url: str | None = None) -> None:
    """Wire Dramatiq to Redis.

    Idempotent — safe to call from API startup. Pass ``redis_url`` explicitly
    or let it fall back to the ``REDIS_URL`` environment variable.
    """
    global _broker_configured
    if _broker_configured or not BROKER_AVAILABLE:
        return
    url = redis_url or os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    broker = RedisBroker(url=url)
    dramatiq.set_broker(broker)  # type: ignore[union-attr]
    _broker_configured = True
    log.info("dramatiq broker configured", extra={"url": url})
