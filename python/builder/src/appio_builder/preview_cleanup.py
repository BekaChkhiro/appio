"""Cleanup of expired preview artifacts from R2.

Previews are stored under ``_preview/{app_id}/{token}/`` and should be
deleted after 24 hours if not promoted to a production build.

Usage:
    - Called by a Dramatiq periodic task or a cron-triggered API endpoint.
    - Can also be invoked manually via ``python -m appio_builder.preview_cleanup``.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from .config import BuildConfig, load_config
from .r2 import R2Client

__all__ = ["cleanup_expired_previews"]

log = logging.getLogger(__name__)

# Previews older than this are eligible for deletion.
MAX_AGE = timedelta(hours=24)


def cleanup_expired_previews(
    config: BuildConfig | None = None,
    *,
    max_age: timedelta = MAX_AGE,
) -> int:
    """Delete preview objects older than ``max_age`` from R2.

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

    # List all objects under _preview/ prefix
    paginator = client._s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=client.bucket, Prefix="_preview/"):
        contents = page.get("Contents", [])
        if not contents:
            continue

        # Batch delete (S3/R2 supports up to 1000 per request)
        to_delete = []
        for obj in contents:
            last_modified = obj.get("LastModified")
            if last_modified and last_modified < cutoff:
                to_delete.append({"Key": obj["Key"]})

        if not to_delete:
            continue

        # Delete in chunks of 1000
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
                    "preview_cleanup_delete_failed",
                    extra={"chunk_size": len(chunk)},
                )
                # Continue with remaining chunks

    log.info("preview_cleanup_complete", extra={"deleted": deleted})
    return deleted


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    count = cleanup_expired_previews()
    print(f"Deleted {count} expired preview objects.")
