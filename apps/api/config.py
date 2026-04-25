from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Neon pooler URL (for app queries — use the -pooler endpoint)
    database_url: str
    # Neon direct URL (for Alembic migrations — supports prepared statements)
    database_direct_url: str = ""

    redis_url: str = "redis://localhost:6379/0"
    anthropic_api_key: str = ""
    firebase_project_id: str = ""
    firebase_service_account_path: str = ""  # Path to service account JSON; empty = use ADC

    # Firebase Web SDK config — injected into generated PWAs for auth
    firebase_web_api_key: str = ""
    firebase_web_auth_domain: str = ""
    firebase_web_app_id: str = ""
    firebase_web_storage_bucket: str = ""
    firebase_web_messaging_sender_id: str = ""
    # Appio sandbox Convex deployment (T2.1) — shared across all preview
    # apps; tenant isolation enforced at the query layer (see ADR 001).
    # On publish (T3.6) apps migrate to a user-owned Convex deployment via
    # OAuth and these vars are no longer used for that app.
    appio_sandbox_convex_url: str = ""
    appio_sandbox_convex_site_url: str = ""
    appio_sandbox_convex_deployment: str = ""

    # ── T3.8 — Convex deploy-key publish ────────────────────────────────
    # Fernet-compatible base64 key (generate via `Fernet.generate_key()`).
    # Required when the publish feature is enabled.
    # ADR 007 documents the shift from OAuth to per-app deploy keys.
    convex_token_encryption_key: str = ""

    # ── T3.9 — Scratch-deployment data migration ────────────────────────
    # Convex Team Access Token for the Management API (scratch deployment
    # provisioning + teardown). Generate at dashboard.convex.dev/team/settings/
    # access-tokens on the Appio team account. Required for real migrations;
    # leave empty to run tests with FakeConvexManagementClient.
    convex_platform_access_token: str = ""

    # Convex project ID within Appio's team where scratch deployments are
    # provisioned. Must be manually created once in the Convex dashboard
    # (any name, e.g. "appio-scratch-host") — the numeric project ID goes here.
    convex_scratch_host_project_id: str = ""

    # Deploy key for the Appio sandbox Convex deployment, used by the publish
    # pipeline to invoke Appio-internal functions (_appio_internal:*) via
    # `npx convex run`. Plain text (not Fernet-encrypted) because it's a
    # server secret, not per-user data. See docs/adr/007 §Data migration.
    appio_sandbox_deploy_key: str = ""

    cloudflare_r2_bucket: str = ""
    cloudflare_account_id: str = ""
    cloudflare_r2_access_key: str = ""
    cloudflare_r2_secret_key: str = ""
    cloudflare_api_token: str = ""
    cloudflare_kv_namespace_id: str = ""
    sentry_dsn: str = ""
    debug: bool = False

    # CORS — NEVER add *.appio.app or *.appiousercontent.com
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://appio.app",
        "https://app.appio.app",
    ]

    # Rate limiting
    rate_limit_default: str = "100/minute"
    rate_limit_generation_free: str = "3/day"
    rate_limit_signup_per_ip: str = "3/day"

    # Transactional email (Resend)
    resend_api_key: str = ""

    # Stripe billing (set all of these for production)
    stripe_api_key: str = ""
    stripe_webhook_secret: str = ""
    # Map Stripe Price IDs → internal tier. Populate from the Stripe dashboard
    # after creating products for Pro / Creator subscriptions.
    stripe_price_pro: str = ""
    stripe_price_creator: str = ""

    # Pre-warmed golden workspace path. Default works on Fly.io / Docker.
    # Override via GOLDEN_WORKSPACE_PATH env var for local dev.
    golden_workspace_path: str = "/var/cache/appio-template"

    # Voyage AI — embeddings for RAG knowledge base
    voyage_api_key: str = ""
    # Set to False to disable RAG retrieval in the agent loop (for A/B testing)
    agent_rag_enabled: bool = True

    # ── T1.3 — Cost optimization budget + telemetry ─────────────────────
    # Hard ceiling per generation. Reserves below must sum to <= this value;
    # the main generation loop gets what's left after critique + fix-pass.
    max_generation_cost_usd: float = 0.50
    # Hard iteration cap on the agent tool-use loop (was 25 pre-T1.3).
    max_generation_iterations: int = 15
    # Reserved for the Sonnet vision critique call (~1 invocation).
    critique_reserve_usd: float = 0.10
    # Reserved for the Haiku-backed post-vision fix pass (up to 5 turns).
    fix_pass_reserve_usd: float = 0.06

    # PostHog — per-generation cost/latency event sink (dashboard source).
    # Leave empty to disable emission (local dev default).
    posthog_api_key: str = ""
    posthog_host: str = "https://us.i.posthog.com"

    # Slack — inbound webhook URL for rolling-window p90 cost alerts.
    # Leave empty to disable alerting.
    slack_cost_alert_webhook_url: str = ""
    # Alert threshold: fire when p90 of recent generations exceeds this USD amount.
    cost_alert_p90_threshold_usd: float = 0.30
    # Rolling window size for p90 calculation (Redis-backed).
    cost_alert_window_size: int = 100
    # Do not alert until at least this many samples are in the window
    # (p90 is noisy on tiny samples — avoid spurious pages during ramp-up).
    cost_alert_min_samples: int = 20
    # Minimum seconds between Slack alerts, to prevent firehose during incidents.
    cost_alert_cooldown_seconds: int = 900

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
