"""Cleanup of expired workspace archives from R2.

Workspaces are stored under ``workspaces/{generation_id}.tar.gz`` with
tier-based TTLs:

    - Free:    24 hours
    - Pro:     7 days
    - Creator: 30 days

Because R2 object metadata doesn't carry tier info, we rely on the
``generations.workspace_expires_at`` column in the database. The cleanup
job lists objects under the ``workspaces/`` prefix, cross-references
with the DB, and deletes anything past its expiry.

For the simpler initial implementation we just use R2's LastModified
against the longest TTL (30 days) as a safety net — objects older than
30 days are always deleted regardless of tier. The per-tier expiry is
enforced at the DB level: expired workspaces return ``workspace_url=None``
in API responses.

Usage:
    - Called by a Dramatiq periodic task or a cron-triggered API endpoint.
    - Can also be invoked manually via ``python -m appio_builder.workspace_cleanup``.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from .config import BuildConfig, load_config
from .r2 import R2Client

__all__ = ["WORKSPACE_TTL", "cleanup_expired_workspaces"]

log = logging.getLogger(__name__)

# Tier → TTL mapping.
WORKSPACE_TTL: dict[str, timedelta] = {
    "free": timedelta(hours=24),
    "pro": timedelta(days=7),
    "creator": timedelta(days=30),
}

# Hard ceiling: objects older than this are always deleted (safety net).
_MAX_AGE = timedelta(days=31)


def cleanup_expired_workspaces(
    config: BuildConfig | None = None,
    *,
    max_age: timedelta = _MAX_AGE,
) -> int:
    """Delete workspace archives older than *max_age* from R2.

    Returns the number of objects deleted.
    """
    cfg = config or load_config()
    client = R2Client(
        account_id=cfg.r2_account_id,
        access_key=cfg.r2_access_key,
        secret_key=cfg.r2_secret_key,
        bucket=cfg.r2_bucket,
        endpoint_url=cfg.r2_endpoint,
    )

    cutoff = datetime.now(timezone.utc) - max_age
    deleted = 0

    paginator = client._s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=client.bucket, Prefix="workspaces/"):
        contents = page.get("Contents", [])
        if not contents:
            continue

        to_delete = []
        for obj in contents:
            last_modified = obj.get("LastModified")
            if last_modified and last_modified < cutoff:
                to_delete.append({"Key": obj["Key"]})

        if not to_delete:
            continue

        for i in range(0, len(to_delete), 1000):
            chunk = to_delete[i : i + 1000]
            try:
                client._s3.delete_objects(
                    Bucket=client.bucket,
                    Delete={"Objects": chunk, "Quiet": True},
                )
                deleted += len(chunk)
            except Exception:
                log.warning(
                    "workspace_cleanup_delete_failed",
                    extra={"chunk_size": len(chunk)},
                )

    log.info("workspace_cleanup_complete", extra={"deleted": deleted})
    return deleted


def workspace_ttl_for_tier(tier: str) -> timedelta:
    """Return the workspace retention period for the given user tier."""
    return WORKSPACE_TTL.get(tier, WORKSPACE_TTL["free"])


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    count = cleanup_expired_workspaces()
    print(f"Deleted {count} expired workspace archives.")
