"""Dramatiq worker entrypoint.

Run as: ``dramatiq apps.api.worker``

Configures the Redis broker first (so actors register against the right
broker), then imports the actor modules so they get registered with
dramatiq's discovery.
"""

from __future__ import annotations

import logging
import os

from appio_builder.tasks import configure_broker

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# Step 1: configure broker BEFORE importing actor modules. Actors
# register with whatever broker is set at import time.
configure_broker(os.environ.get("REDIS_URL"))
log.info("dramatiq broker configured for worker")

# Step 2: import actor modules so dramatiq discovers them.
from apps.api.domains.convex import tasks as _convex_tasks  # noqa: F401, E402

log.info("dramatiq actors registered")
