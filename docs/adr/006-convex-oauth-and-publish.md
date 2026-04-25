# ADR 006 — Convex OAuth integration and publish migration pipeline

Status: Accepted — 2026-04-21
Task: T3.6

## Context

Appio apps run on a shared sandbox Convex deployment during preview. T3.6's
goal is to let users "own" their app's backend by migrating it to a Convex
deployment in their own account. This requires:

1. Appio registering as a Convex OAuth 2.0 partner application.
2. A user-initiated authorization flow that grants Appio write access to the
   user's Convex account (scopes: `deployments:write teams:read`).
3. A multi-step async migration pipeline that provisions a new deployment,
   pushes schema + functions, copies sandbox data, rewrites the app's
   `config/convex.ts` to point at the user-owned URL, and triggers a rebuild.

The dual-stage architecture — shared sandbox for preview, user-owned deployment
for published apps — was established in ADR 001 (tenant isolation) and ADR 005
(`useConvexMode` hook). T3.6 is the backend implementation of the publish half.

## Decision

### OAuth flow

We use the standard **OAuth 2.0 Authorization Code flow**:

- `GET /api/v1/convex/oauth/start` builds an authorization URL with a
  `secrets.token_urlsafe(32)` state parameter stored in Redis (TTL 600s).
  State is keyed per `(user_id, app_id)` so the callback knows where to
  redirect after consent.
- `GET /api/v1/convex/oauth/callback` validates state (Redis GET + atomic
  DEL to prevent replay), exchanges the code for tokens, fetches team info,
  and upserts a `convex_oauth_tokens` row.
- Tokens are encrypted at rest with **Fernet** (AES-128-CBC + HMAC-SHA256)
  using a key from `CONVEX_TOKEN_ENCRYPTION_KEY`. Fernet was chosen over
  raw AES because it handles IV generation, padding, and MAC verification
  in one call, reducing the surface area for misuse.
- Token refresh is checked before every API call: if `expires_at` is within
  5 minutes, we call the refresh endpoint and re-encrypt in place.

### Mockable platform client

`ConvexPlatformClient` is defined as a `typing.Protocol`. The real
`HttpxConvexPlatformClient` and a deterministic `FakeConvexPlatformClient`
both satisfy it. The FastAPI dependency `get_convex_client()` returns the
fake when `convex_oauth_client_id` is empty (feature-disabled / local dev).
This means the entire publish flow can be exercised in tests and local dev
without real Convex credentials.

### Async publish pipeline

The publish migration is broken into 7 steps tracked in an `app_publish_jobs`
row:

```
pending → provisioning → pushing_schema → copying_data →
rewriting_config → rebuilding → published
```

`POST /api/v1/convex/publish/{app_id}` creates the job and enqueues a
Dramatiq task (`run_publish_job`). `GET /api/v1/convex/publish/{app_id}/status`
polls the most recent job row. `App.publish_status` mirrors the terminal state
so most reads avoid the join.

### Database tables

Three new tables: `convex_oauth_tokens`, `convex_deployments`,
`app_publish_jobs`. Three new nullable columns on `apps`:
`published_at`, `publish_status`, `sandbox_archived_at`. Migration 010.

## Consequences

- Users can publish apps to their own Convex account once Convex approves
  Appio as an OAuth partner.
- The feature is fully disabled (503-free; returns deterministic fake data)
  when `CONVEX_OAUTH_CLIENT_ID` is unset, so local dev is unaffected.
- The `FakeConvexPlatformClient` makes unit tests fast and hermetic.
- Steps 4 (data copy), 5 (config rewrite), and 6 (rebuild) are stubs in T3.6.
  Real wiring requires T2.18 workspace persistence (R2) and the builds
  domain task queue to be extended. See stubs in `migration_service.py`.

## Open questions

All of the following are blocked on Convex approving Appio as an OAuth partner:

- **Real Management API paths.** All paths in `HttpxConvexPlatformClient`
  are provisional (marked `TODO(T3.6)`). The exact endpoint surface for
  project/deployment provisioning, schema push, function push, and data
  import is unknown until Convex provides API documentation.
- **Scope names.** `deployments:write` and `teams:read` are guesses;
  actual Convex scope strings may differ.
- **Webhook for token revocation.** If a user revokes Appio's access via
  the Convex dashboard, we have no inbound signal. A webhook receiver
  should be added to mark the app read-only. Tracked as T3.6-followup.
- **Token response shape.** The field names (`access_token`, `refresh_token`,
  `expires_in`, `scope`) follow OAuth 2.0 RFC 6749 conventions; Convex may
  deviate.

## Out of scope for T3.6

- **Workspace config rewrite** (`_step_rewrite_config`): requires reading
  the app's `src/config/convex.ts` from R2 (T2.18 workspace persistence).
  Stubbed with a structured log entry.
- **Rebuild trigger** (`_step_rebuild`): requires the builds domain to expose
  a public enqueue function. Stubbed with a structured log entry.
- **Sandbox data copy** (`_step_copy_data`): requires a Convex Management API
  export endpoint scoped to `tenantId`. Stubbed with an empty JSONL import.
- **Token rotation scheme**: re-encryption of existing rows after a key
  rotation is not shipped. Tracked as T3.6-followup.
- **30-day sandbox archival**: `App.sandbox_archived_at` column is present
  but no scheduled job removes sandbox data. Tracked as T3.6-followup.
