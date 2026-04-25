# ADR 007 — Deploy-key-based publish flow (supersedes ADR 006's OAuth partner dependency)

Status: Accepted — 2026-04-21
Task: T3.8
Supersedes (in part): ADR 006

## Context

ADR 006 designed the publish flow around Convex's OAuth 2.0 partner integration:
Appio registers as a verified OAuth app, the user clicks "Connect with Convex",
Appio gets a team-scoped token, and the server programmatically provisions a
new deployment in the user's team before pushing schema/functions/data.

Research on 2026-04-21 revealed two things that invalidate the original
framing:

1. **The OAuth partner flow requires Convex to approve Appio's verification
   request.** Unverified OAuth apps can only authenticate for the developer's
   own team — useless for onboarding end users. Approval timeline is 1–4
   weeks and is a hard external blocker for the publish feature as shipped
   in T3.6.

2. **Convex's Management API is fully public and self-service.** Any user
   can generate a **Team Access Token** from
   `https://dashboard.convex.dev/team/settings/access-tokens` and use it to
   hit `https://api.convex.dev/v1/` for `create_project`, `create_deployment`,
   `list_deployments`, etc. OAuth is a UX polish on top of this API, not a
   gate to the underlying capability.

This ADR picks the **boring, safe** path: have the user paste a per-deployment
**`CONVEX_DEPLOY_KEY`** (the same mechanism every Convex CI/CD pipeline uses)
and let Appio push code via the stock `npx convex deploy` CLI. No
partnership, no undocumented APIs, no speculation about rate limits on
`create_project`.

## Decision

### Credential model: per-app deploy key paste

The user performs a short one-time setup in the Convex dashboard **per
published app**:

1. Sign in at `dashboard.convex.dev` (free, 30 seconds)
2. Create a new project (or reuse an existing one)
3. Settings → Deploy Keys → "Generate Production Deploy Key"
4. Copy the key (`prod:teamslug|...` format) + the deployment URL
5. Paste both into Appio's Publish modal

Appio stores the pair encrypted in `app_convex_credentials` (one row per
app), keyed on `app_id`. Multiple apps = multiple deploy keys. This is
friction we accept as the cost of a 100%-reliable, partnership-free
launch path.

### Push/import mechanism: `npx convex` CLI subprocess

Schema push, function push, and data import all go through the official
CLI, invoked as a subprocess from the publish worker with
`CONVEX_DEPLOY_KEY` set as an environment variable for that invocation
only:

```python
env = {**os.environ, "CONVEX_DEPLOY_KEY": decrypt(credentials.key)}
await asyncio.create_subprocess_exec(
    "npx", "convex", "deploy", "--cmd-url-env-var-name", "CONVEX_URL",
    cwd=workspace, env=env, ...
)
```

Rationale: this is the exact code path Convex themselves documents for
CI/CD, used in production by thousands of teams. If `npx convex deploy`
works, our publish flow works. If it breaks, it's a Convex-side bug that
Convex is motivated to fix — not our custom HTTP client with undocumented
assumptions.

### Security

- **Encryption at rest.** `CONVEX_DEPLOY_KEY` is sensitive (write access
  to the user's deployment). We reuse the Fernet + `CONVEX_TOKEN_ENCRYPTION_KEY`
  infrastructure from T3.6 (`apps/api/domains/convex/crypto.py`) — no new
  secrets or rotation scheme to design.
- **Never logged.** structlog calls must not include the key. A grep guard
  in CI asserts this.
- **Per-app blast radius.** A deploy key grants access to exactly one
  deployment. Compromise of Appio's DB leaks per-app access, not the
  user's entire Convex account (which a Team Access Token or OAuth
  refresh token would).
- **Rotation.** The Publish modal always re-prompts for the key on
  re-publish if the user wants to rotate; Appio never attempts to
  "refresh" a deploy key.

### Data migration: scratch-deployment pattern

`npx convex export` does full-deployment snapshots only — no row-level
filter. Since our sandbox is shared across users (tenant-isolated by
`tenantId == firebaseUid`), a naive export would leak cross-tenant data.

The migration flow instead:

1. Appio runs a server-side action on the **sandbox** deployment that
   copies the publishing user's `tenantId`-scoped rows to a fresh
   **scratch deployment** provisioned just for this publish job (short-
   lived, 1-hour TTL).
2. `npx convex export --path /tmp/snapshot.zip` against the scratch
   deployment produces a clean, tenant-free snapshot.
3. `npx convex import --replace /tmp/snapshot.zip` against the user's
   new deployment loads the data.
4. The scratch deployment is torn down.

This trades a slightly more complex orchestration for a zero-risk leak
guarantee. The scratch deployment pattern is deliberately expensive per
publish (extra provisioning) — that's fine because publish is a rare,
user-initiated event, not a hot path.

### What T3.6/T3.7 code we keep

- **`_step_rewrite_config`** — unchanged, still rewrites `src/config/convex.ts`
  with the user's deployment URL
- **`_step_rebuild`** — unchanged, still rebuilds dist + pushes to R2 + KV
- **`build_published_workspace`** in `apps/api/domains/builds/tasks.py` — unchanged
- **`R2Client.download_workspace` / `upload_published_workspace`** — unchanged
- **Fernet encryption helper** at `apps/api/domains/convex/crypto.py` — reused
- **`AppPublishJob` + state machine** — adjusted (drop `provisioning` step,
  add `validating_credentials`), but the progress-tracking shape is kept

### What T3.6 code we remove

- **`apps/api/domains/convex/oauth_service.py`** — entire module
- **OAuth router endpoints**: `/oauth/start`, `/oauth/callback`, `/oauth/status`,
  `/oauth/revoke`
- **`ConvexOAuthToken` model + Alembic migration** — deleted after any
  existing rows are dropped (no production rows — T3.6 was framework-only)
- **`provision_deployment` / `exchange_code` / `refresh_token` / `revoke_token`
  on `ConvexPlatformClient` Protocol** — removed; the `HttpxConvexPlatformClient`
  module shrinks to a thin wrapper over the CLI subprocess (or disappears entirely)
- **Settings**: `convex_oauth_client_id`, `convex_oauth_client_secret`,
  `convex_platform_api_url` — removed

### Future path: OAuth as v2 polish

We self-register an **unverified** OAuth app in Convex's dashboard for
internal testing (works for our own team today, no approval needed). When
beta feedback shows deploy-key paste is a real friction (e.g. ≥30% of
users drop out at the paste step), we apply for OAuth verification and
ship the polished flow as an **additive** option — the credentials table
gets a `source: enum('deploy_key', 'oauth')` column, not a migration.

## Consequences

**Positive:**
- Publish flow ships with zero external dependencies.
- Stack trace of any runtime failure lands inside `npx convex` — Convex
  support can diagnose; we don't carry that weight.
- Per-app credentials are the natural granularity for revocation and
  rotation ("regenerate my key for just this app").

**Negative:**
- Per-publish UX friction: ~30 seconds of dashboard clicks + paste, per
  app. Acceptable for beta (30 users × 2–3 apps = 60–90 total pastes
  across beta lifetime).
- `npx convex` subprocess introduces a Node.js + `convex` npm package
  requirement on the publish worker's Docker image.
- Scratch-deployment pattern for data export costs 1 extra deployment
  per publish (short-lived), which will consume sandbox-side Convex
  budget. Monitor via the existing cost telemetry dashboard.

**Neutral:**
- `AppPublishJob` state machine is simpler (one less step) but the
  `validating_credentials` step is new, so net zero step count.

## Links

- [T3.6 implementation](../../apps/api/domains/convex/)
- [T3.7 rewrite + rebuild](../../apps/api/domains/convex/migration_service.py)
- [Convex Management API](https://docs.convex.dev/management-api)
- [Convex CLI docs](https://docs.convex.dev/cli)
- [ADR 006 (superseded for OAuth-dependent sections)](./006-convex-oauth-and-publish.md)
