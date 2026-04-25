"""Dramatiq worker entrypoint.

Run as: ``dramatiq apps.api.worker``

Order matters:
1. Configure Redis broker (so actors register against the right broker)
2. Initialise the SQLAlchemy session factory (run_publish_job needs it)
3. Import actor modules so dramatiq discovers them
"""

from __future__ import annotations

import logging
import os

from appio_builder.tasks import configure_broker
from appio_db import init_db

from apps.api.config import settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# Step 1: configure broker BEFORE importing actor modules. Actors
# register with whatever broker is set at import time.
configure_broker(os.environ.get("REDIS_URL"))
log.info("dramatiq broker configured for worker")

# Step 2: initialise the database session factory. Actors call
# get_session_factory() which raises RuntimeError without this.
_is_neon = "neon" in settings.database_url
init_db(settings.database_url, is_neon=_is_neon)
log.info("database initialised for worker")

# Step 3: import actor modules so dramatiq discovers them.
from apps.api.domains.convex import tasks as _convex_tasks  # noqa: F401, E402

log.info("dramatiq actors registered")
