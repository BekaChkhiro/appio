"""Builder runtime configuration.

Loaded from environment variables. Mirrors :class:`apps.api.config.Settings`
for the subset of values the builder worker needs, so the worker can be
deployed independently of the FastAPI process if we ever split them.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

__all__ = ["BuildConfig", "load_config"]


@dataclass(frozen=True, slots=True)
class BuildConfig:
    # --- Templates ---
    # Where the codegen finds template skeletons. The builder reads this only
    # so it can locate the codegen's output and (in dev) run a local build.
    templates_dir: Path

    # --- Fly.io Machines ---
    fly_api_token: str
    fly_app_name: str
    # Comma-separated machine IDs from the warm pool. The orchestrator picks
    # one round-robin per build (no scheduler — Fly handles capacity).
    fly_machine_ids: tuple[str, ...]
    fly_region: str

    # --- Cloudflare R2 (S3-compatible) ---
    r2_account_id: str
    r2_bucket: str
    r2_access_key: str
    r2_secret_key: str
    # https://{account_id}.r2.cloudflarestorage.com — derived if empty.
    r2_endpoint: str

    # --- Cloudflare KV (version pointers) ---
    cloudflare_api_token: str
    cloudflare_account_id: str
    kv_namespace_id: str

    # --- Build limits ---
    build_timeout_seconds: int
    max_retries: int

    # --- Local dev ---
    # When True, run esbuild via subprocess on the host instead of dispatching
    # to a Fly Machine. Useful for tests and CI; never enable in prod.
    use_local_runner: bool
    # Path to the pre-built builder image's working directory on the host
    # (only relevant when ``use_local_runner=True``). The script there must
    # accept the generated project as its current working directory.
    local_builder_dir: Path | None


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


def _env_int(key: str, default: int) -> int:
    raw = _env(key)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_bool(key: str, default: bool = False) -> bool:
    raw = _env(key).lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _env_path(key: str, default: Path) -> Path:
    raw = _env(key)
    return Path(raw).expanduser().resolve() if raw else default


def _repo_root() -> Path:
    # __file__ = python/builder/src/appio_builder/config.py
    return Path(__file__).resolve().parents[4]


def load_config() -> BuildConfig:
    """Build a :class:`BuildConfig` from the current process environment.

    Missing values become empty strings / empty tuples — the orchestrator
    validates required fields lazily so unit tests can run with no env at all.
    """
    repo = _repo_root()
    default_templates = repo / "packages" / "templates"

    machine_ids_raw = _env("FLY_BUILDER_MACHINE_IDS")
    machine_ids = tuple(
        m.strip() for m in machine_ids_raw.split(",") if m.strip()
    )

    r2_account = _env("CLOUDFLARE_R2_ACCOUNT_ID") or _env("CLOUDFLARE_ACCOUNT_ID")
    r2_endpoint = _env("CLOUDFLARE_R2_ENDPOINT")
    if not r2_endpoint and r2_account:
        r2_endpoint = f"https://{r2_account}.r2.cloudflarestorage.com"

    return BuildConfig(
        templates_dir=_env_path("APPIO_TEMPLATES_DIR", default_templates),
        fly_api_token=_env("FLY_API_TOKEN"),
        fly_app_name=_env("FLY_BUILDER_APP_NAME", "appio-builder"),
        fly_machine_ids=machine_ids,
        fly_region=_env("FLY_BUILDER_REGION", "iad"),
        r2_account_id=r2_account,
        r2_bucket=_env("CLOUDFLARE_R2_BUCKET", "appio-pwas"),
        r2_access_key=_env("CLOUDFLARE_R2_ACCESS_KEY"),
        r2_secret_key=_env("CLOUDFLARE_R2_SECRET_KEY"),
        r2_endpoint=r2_endpoint,
        cloudflare_api_token=_env("CLOUDFLARE_API_TOKEN"),
        cloudflare_account_id=_env("CLOUDFLARE_ACCOUNT_ID"),
        kv_namespace_id=_env("CLOUDFLARE_KV_NAMESPACE_ID"),
        build_timeout_seconds=_env_int("APPIO_BUILD_TIMEOUT", 60),
        max_retries=_env_int("APPIO_BUILD_MAX_RETRIES", 3),
        use_local_runner=_env_bool("APPIO_BUILDER_LOCAL", False),
        local_builder_dir=_env_path(
            "APPIO_LOCAL_BUILDER_DIR", repo / "docker" / "builder"
        ),
    )
