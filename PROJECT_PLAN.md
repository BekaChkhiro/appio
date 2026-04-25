# Appio — Build Apps with Words

> AI-powered PWA builder. Users describe apps in chat, an autonomous Claude agent writes React + TypeScript + Tailwind v4 + Convex code via tool-use loop, esbuild compiles the output into static PWAs served from isolated subdomains on `appiousercontent.com`. Includes a vision feedback loop (Playwright screenshots → Claude critique → fix pass) for quality assurance.
>
> **Architecture: Optimized Agent + Dual Convex.** All generation goes through the Claude agent tool-use pipeline with prompt caching (Sonnet 4.6 system prompt cached, ~40-50% input savings on stable portions) and Haiku 4.5 for AutoFix lint cycles (75% cheaper). Opus 4.6 advisor strategy added Sprint 4 as experimental (beta API). Generated apps use a **two-stage Convex model**: drafts and previews run on Appio's shared sandbox Convex (free, isolated by tenant_id); on publish, users connect their own Convex account via OAuth and the app migrates to their deployment. This avoids the 300-deployment Pro plan ceiling, shifts production cost to users, and keeps the builder onboarding frictionless.
>
> **Design Excellence.** Generated apps differentiate via 5 curated Theme Personas (minimal-mono, vibrant-gradient, brutalist-bold, glassmorphic-soft, editorial-serif) with OKLCH color tokens (with iOS 15 RGB fallback), Motion animation presets (10 named patterns), and a Layout Block Registry (15 high-level shadcn-blocks-style compositions). Escapes the "generic shadcn look" that defines most AI builders.
>
> **Platform: PWA + Capacitor.** The main platform app is a Next.js 15 PWA with Lovable-inspired split-panel UI (chat + live preview). Distributed as: web app (primary), iOS/Android via Capacitor (deferred — App Store submissions out of scope this sprint), desktop via installable PWA.
>
> **Scope: 16-week builder excellence sprint.** This PROJECT_PLAN focuses narrowly on builder quality — minimum cost-per-generation, maximum design quality, complex app support. Marketing site, marketplace, content moderation, App Store submissions are out of scope and will be re-planned after Sprint 5.

## Project Info

- **Project Type**: AI App Builder Platform (focused 16-week excellence sprint)
- **Status**: Sprint 3 DONE ✅ (T3.1–T3.10). Sprint 4 T4.1 DONE, T4.2 DONE ✅ — remaining T4.3, T4.4
- **Created**: 2026-04-06
- **Last Updated**: 2026-04-21
- **Timeline**: 16 weeks (5 sprints, 24 tasks — T3.7 added post-T3.6 to track publish pipeline stub wire-up)
- **Team Size**: 1 developer (solo)
- **Plugin Version**: 1.1.1

## Tech Stack — Builder Platform (Appio's own infrastructure)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Main App (PWA)** | **Next.js 15 (App Router)** | SSR/SSG for landing+SEO, static export for Capacitor, App Router code splitting |
| **Native Wrapper** | **Capacitor 6** | Same codebase → App Store + Play Store (deferred), good plugin ecosystem |
| **UI Components** | **shadcn/ui (Radix UI + Tailwind)** | Lovable-style design system, accessible, unstyled primitives |
| **Styling** | **Tailwind CSS v4** | Purge-optimized, consistent with generated PWAs |
| **Animations** | **Motion** (framer-motion successor) | Page transitions, layout animations, gesture-driven interactions, smaller bundle |
| **Server State** | **TanStack Query v5** | Caching, background refetch, optimistic updates, offline support |
| **Client State** | **Zustand** | Minimal API, persist middleware for IndexedDB/localStorage |
| **Auth** | **Firebase Web SDK v10** | 50K MAU free, Google/Apple OAuth, JWT bridge to Convex |
| **SSE Client** | **fetch() + ReadableStream** | POST + custom headers support, no polyfill needed |
| **Service Worker** | **@serwist/next (Workbox)** | Precache + runtime caching, offline support, background sync |
| **Gestures** | **@use-gesture/react** | Pull-to-refresh, swipe-to-delete, touch + mouse |
| **Icons** | **Lucide React** | Tree-shakeable, web-native |
| **AI Engine — Primary** | **Claude Sonnet 4.6** + Adaptive Thinking + Tool-Use + **Prompt Caching** | Best code generation; ~40-50% input savings via cached system prompt + tool definitions (RAG portion not cacheable since varies per query) |
| **AI Engine — AutoFix** | **Claude Haiku 4.5** | Lint/typecheck fix cycles; 75% cheaper than Sonnet for routine fixes |
| **AI Engine — Advisor** (Sprint 4, experimental) | **Claude Opus 4.6** (advisor tool, beta header) | Escalation-only; +2.7pp accuracy and -12% per-task cost vs Sonnet solo. Beta API — production fallback required |
| **Appio Sandbox Convex** | **Convex (single shared deployment)** | Hosts draft/preview apps, isolated by tenant_id (userId field on every document); avoids 300-deployment ceiling |
| Backend | **FastAPI + uvicorn** | Python AI ecosystem, Pydantic v2, auto-docs, async-native |
| ORM | **SQLAlchemy 2.0 (async) + Alembic** | Python-native, async support, mature migrations |
| Database | **Neon PostgreSQL (serverless)** | Usage-based ($5/mo min + $0.14/CU-hr), DB branching per PR, built-in pooler |
| Job Queue | **Dramatiq + Redis Cloud (paid $7/mo, 250MB)** | Actively maintained, 10x faster than ARQ |
| PWA Build | **esbuild + @tailwindcss/postcss** (in Fly Machine + nsjail) | ~300-500ms builds including Tailwind |
| File Storage | Cloudflare R2 | Zero egress fees, S3-compatible |
| PWA Serving | **Cloudflare R2 + Workers** | Wildcard subdomain routing, edge caching, SPA fallback |
| PWA Domain | **appiousercontent.com** (separate registrable domain) | Cookie isolation, prevent session hijacking / cookie tossing |
| Payments | **Stripe (web)** + Capacitor IAP (deferred) | Stripe 2.9% on web; IAP only when App Store submission lands |
| Analytics | PostHog | Cost telemetry dashboard, generation success rates, cache hit rates |
| Monitoring | Sentry | Error tracking, performance monitoring (setup from day 1) |
| Validation | **Pydantic v2** | Auto-serialization; OpenAPI spec → TypeScript types via codegen |
| CI/CD | GitHub Actions | Turborepo cache (JS only), separate Python CI jobs |
| Monorepo | Turborepo (JS) + Make/just (Python orchestration) | Turborepo has no Python support; use it for JS, Make for Python |
| Builder Infra | **Fly.io Machines** (Firecracker microVM) | Hardware-level isolation, ~300ms restart (stopped machines), scale-to-zero |

## Tech Stack — Generated Apps (what AI produces for users)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Build Tool** | **esbuild** (custom config) | ~500ms builds, equivalent to Vite, already proven in production |
| **Framework** | **React 19 + TypeScript** | Industry-standard for AI generation; largest training corpus |
| **Styling** | **Tailwind CSS v4 (CSS variables, OKLCH + RGB fallback)** | CSS-first, design-token-friendly. iOS 15 fallback to RGB sRGB |
| **UI Primitives** | **shadcn/ui** | Default for every successful AI builder; copy-paste, fully customizable |
| **Theme System** | **5 Curated Theme Personas** | Differentiator: escape generic shadcn look. Each persona = palette + typography + radius/shadow tokens |
| **Layout Composition** | **Layout Block Registry** (15 blocks) | High-level compositions; agent picks blocks, not raw primitives. ~87% token reduction on UI code |
| **Animations** | **Motion** (10 named presets) | Premium feel via consistent animation language; bundle smaller than framer-motion |
| **Routing** | **React Router 7** | Lovable's choice; AI generates correctly; large install base |
| **Forms** | **React Hook Form + Zod** | Industry standard, AI generates accurately, type-safe |
| **Client State** | **Zustand** (persist middleware) | Lightweight, AI-friendly, IndexedDB persistence for offline writes |
| **Backend (Draft/Preview)** | **Appio Sandbox Convex** (shared, tenant_id isolated) | Zero friction during builder exploration; user pays $0 until publish |
| **Backend (Published)** | **User-owned Convex** (OAuth-connected) | On publish, OAuth flow connects user's own Convex account; app migrates from sandbox to user's deployment. Unlimited scale, cost shifted to user |
| **Auth** | **Firebase Auth** (JWT bridge to Convex) | Mature OAuth providers (Google, Apple); Convex `auth.config.ts` validates Firebase tokens |
| **Push Notifications** | **Firebase Cloud Messaging** (Capacitor native, deferred) | Best mobile delivery; activates when App Store submission sprint lands |
| **Payments** | **Stripe (web)** | Same as builder platform |
| **Icons** | **Lucide React** | Tree-shakeable |

## Target Users

- **App Creator**: Non-technical user who wants to build a mobile app by describing it in natural language
- **App Consumer**: User who installs apps built by creators (out of scope for this sprint)
- **Admin**: Platform team monitoring cost telemetry and beta feedback

## Architecture Overview

```
User (Browser / Desktop PWA)
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Next.js 15 PWA (apps/web/)                     │
│  ┌─────────────────┐  ┌──────────────────────┐  │
│  │ (marketing)      │  │ (app)                │  │
│  │ Landing, Pricing │  │ Chat + Live Preview  │  │
│  │ SSR/SSG          │  │ My Apps, Templates   │  │
│  └─────────────────┘  └──────────────────────┘  │
│  ┌─────────────────────────────────────────────┐ │
│  │ @serwist Service Worker                     │ │
│  │ Precache + Runtime Cache + Background Sync  │ │
│  └─────────────────────────────────────────────┘ │
│  packages/api-client │ packages/auth │ packages/ui│
└──────────────────────┬───────────────────────────┘
                       │ HTTPS + SSE (fetch + ReadableStream)
                       ▼
┌──────────────────────────────────────┐
│  FastAPI (uvicorn)                   │
│  /api/v1/generate  (SSE streaming)   │────▶ Claude API (Sonnet 4.6 cached
│  /api/v1/themes/generate (NEW)       │      + Haiku 4.5 autofix
│  /api/v1/apps      (CRUD)           │      + Opus 4.6 advisor [Sprint 4])
│  /api/v1/auth      (Firebase JWT)    │
│  /api/v1/convex/oauth (NEW)          │
│  /api/v1/billing   (Stripe)         │
└──────────┬───────────┬───────────────┘
           │           │
     ┌─────┘           └─────┐
     ▼                       ▼
┌──────────┐         ┌──────────────┐
│ Neon PG  │         │ Redis Cloud  │
│ (builder)│         │ (Dramatiq)   │
└──────────┘         └──────┬───────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │ Fly.io Machines  │
                   │ esbuild+Tailwind │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────────────┐
                   │ Cloudflare R2 + Workers  │
                   │ *.appiousercontent.com   │
                   └─────────────────────────┘

  Generated Apps talk to (one of):

  Draft / Preview ────▶ ┌──────────────────────────────┐
                        │ Appio Sandbox Convex          │
                        │ (shared deployment,           │
                        │  tenant_id-isolated)          │
                        │ Cost: borne by Appio (free    │
                        │ tier sufficient for previews) │
                        └──────────────────────────────┘

  Published     ─────▶ ┌──────────────────────────────┐
                        │ User-owned Convex             │
                        │ (OAuth-connected at publish)  │
                        │ + Firebase Auth (JWT)         │
                        │ Cost: borne by user           │
                        └──────────────────────────────┘
```

### Distribution Model

```
Single Codebase (Next.js 15 PWA)
    │
    ├── Web (PWA)         → deploy to Vercel / Cloudflare Pages [PRIMARY THIS SPRINT]
    ├── iOS App Store     → deferred (post-Sprint 5 mini-sprint)
    ├── Google Play Store → deferred (post-Sprint 5 mini-sprint)
    └── Desktop           → Install as PWA from browser (Windows/macOS/Linux)
```

### Monorepo Structure

```
appio/
├── apps/
│   ├── web/                 # Main PWA app (Next.js 15)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (marketing)/   # Landing, pricing (SSR/SSG)
│   │   │   │   ├── (app)/         # Authenticated app (Lovable-style split UI)
│   │   │   │   │   ├── create/    # Chat + Live Preview (main screen)
│   │   │   │   │   ├── my-apps/   # Apps dashboard
│   │   │   │   │   ├── publish/   # NEW: OAuth Convex + publish flow
│   │   │   │   │   ├── profile/
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── layout.tsx     # Root layout (providers, fonts)
│   │   │   │   └── globals.css    # CSS variables (shadcn/ui theme)
│   │   │   ├── components/
│   │   │   └── stores/
│   │   ├── public/
│   │   │   ├── manifest.json
│   │   │   └── icons/
│   │   ├── capacitor.config.ts    # Configured but not built this sprint
│   │   ├── ios/                   # Deferred
│   │   └── android/               # Deferred
│   │
│   ├── api/                 # FastAPI — main backend (Python)
│   └── admin/               # Next.js — admin panel (cost telemetry)
│
├── packages/
│   ├── ui/                  # Design System (shadcn/ui — Radix + Tailwind)
│   │   └── src/
│   │       ├── primitives/        # Button, input, card, dialog, sheet, tabs
│   │       ├── blocks/            # NEW: 15 layout blocks
│   │       ├── animations/        # NEW: 10 Motion presets
│   │       ├── hooks/
│   │       │   ├── useAuth.ts     # Firebase Auth + Convex JWT bridge
│   │       │   └── useCollection.ts # Convex-backed reactive queries (handles sandbox + user-owned)
│   │       └── components/
│   │           ├── LoginScreen.tsx
│   │           └── PaywallScreen.tsx
│   │
│   ├── api-client/          # TypeScript API client + SSE + hooks
│   ├── auth/                # Firebase Web SDK auth provider
│   ├── config/              # Shared configuration (platform detection, feature flags)
│   ├── templates/           # PWA template skeletons (Convex-backed)
│   │   ├── base/                  # Base skeleton (esbuild + Tailwind v4 + React 19 + Convex)
│   │   ├── todo-list/             # Migrated to Convex in Sprint 2
│   │   ├── notes-app/             # Migrated in Sprint 3
│   │   ├── habit-tracker/         # Migrated in Sprint 3
│   │   ├── expense-tracker/       # Migrated in Sprint 3
│   │   ├── quiz-app/              # Migrated in Sprint 3
│   │   └── _legacy/               # Archived Firestore-based templates
│   ├── prompts/             # System prompts (versioned, testable)
│   │   ├── v1/
│   │   │   ├── agent_system.md    # Updated for Convex + theme personas + blocks
│   │   │   └── system.md
│   │   └── rag/                   # RAG knowledge base (Convex docs)
│   ├── themes/              # NEW: 5 Theme Personas
│   │   ├── minimal-mono.ts
│   │   ├── vibrant-gradient.ts
│   │   ├── brutalist-bold.ts
│   │   ├── glassmorphic-soft.ts
│   │   └── editorial-serif.ts
│   └── convex-platform/     # NEW: Convex OAuth client + Management API wrapper
│       └── src/
│           ├── oauth.ts           # Convex OAuth flow
│           ├── migration.ts       # Sandbox → user deployment data migration
│           └── client.ts          # Token storage, refresh
│
├── python/
│   ├── shared/              # Shared Pydantic schemas, constants
│   ├── db/                  # SQLAlchemy models, Alembic migrations, seed
│   └── builder/             # Build orchestration, agent tools, scanner
├── docker/
├── scripts/
├── tests/
│   └── prompt-suite/        # Automated prompt → PWA validation tests
├── turbo.json
├── pyproject.toml
└── package.json
```

### AI Generation Pipeline — Optimized Agent

**Pipeline (cost-optimized):**
1. User describes app in chat
2. `POST /api/v1/generate/` opens an SSE stream (agent mode)
3. Agent sets up workspace from `packages/templates/base` (pre-warmed golden workspace, ~0.5s)
4. **Theme persona classifier** (Haiku 4.5, ~$0.001): user prompt → picks 1 of 5 personas
5. **Planning phase**: Sonnet 4.6 (no tools) generates structured build plan — component structure, file order, store shape
6. **Agent tool-use loop** (up to 15 iterations, hard cap):
   - **Sonnet 4.6 with prompt caching** — system prompt + tool definitions cached (40-50% input savings; RAG retrievals NOT cached because they vary per query)
   - **Opus 4.6 advisor** available via `advisor` tool (max_uses: 3 per request, Sprint 4 only) — escalation only when stuck. Beta API — graceful fallback to Sonnet alone if API errors
   - Claude calls `list_files` / `read_file` / `write_file` / `run_build`
   - After each `write_file`, async **Haiku 4.5** lint check runs in parallel (75% cheaper than Sonnet for fixes)
   - After each `run_build` success, temp preview uploaded to R2 → SSE `preview_ready` event
   - RAG retrieval injects relevant component library docs + Convex patterns
   - Layout Block Registry preferred over raw primitives (87% token reduction on UI code)
   - Loop ends when Claude stops requesting tools or hits budget cap ($0.50 max)
7. **Vision critique**: Playwright captures 4 screenshots (light/dark × empty/data) → Sonnet 4.6 vision review (0-100 rubric)
8. **Fix pass** (if critique score < 80 or high-severity issues): up to 5 more iterations with Haiku for routine fixes
9. **Deploy to sandbox**: app deployed to Appio's shared Convex sandbox (tenant_id = userId for isolation), R2 upload → KV pointer update
10. SSE `complete` event with `public_url` ({slug}.appiousercontent.com) — preview-only at this point
11. SSE heartbeat (`: keep-alive\n\n` every 15s) prevents Fly.io idle timeout

**Publish Flow (separate trigger from generation):**
1. User clicks "Publish" on a generated app
2. UI shows "Connect your Convex account" modal (OAuth flow)
3. OAuth → user's Convex account → Appio receives team token
4. `convex-platform.migration.ts` provisions new deployment in user's account
5. Schema + data migrated from Appio sandbox → user's Convex
6. App's `convex.json` config updated to point to user's deployment
7. App rebuilt + redeployed with new Convex URL
8. App marked "published" — sandbox copy archived after 30-day grace period

**Cost telemetry per generation:**
- input_tokens, output_tokens, cache_read_input_tokens, cache_write_input_tokens
- advisor_invocations (Opus calls, Sprint 4 onward)
- model_breakdown (Sonnet vs Haiku token split)
- total_cost_usd, time_seconds
- **Convex sandbox usage attribution** (function calls, storage, bandwidth per generated app)
- Streamed to PostHog dashboard for real-time monitoring

### Security Architecture

**Content domain isolation:**
PWAs served from `appiousercontent.com` (completely separate registrable domain). This prevents:
- Cookie tossing attacks (subdomain cannot set cookies for parent domain)
- Session hijacking via shared cookies
- Phishing attacks using trusted domain name

**CSP headers on generated PWAs** (set by Cloudflare Worker, dynamic per-app):
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' {convex_url} https://*.firebaseapp.com https://*.googleapis.com;
  frame-ancestors 'none';       /* Production: no iframe embedding */
  form-action 'self';
  base-uri 'self';
```
where `{convex_url}` is dynamically injected per-app: either Appio sandbox URL (drafts) or user's specific Convex deployment URL (published apps). Wildcard `*.convex.cloud` avoided to prevent cross-app data access.

**Note:** Preview deploys (`_preview/` prefix) use `frame-ancestors https://appio.app https://beta.appio.app` to allow iframe embedding in the Lovable-style split-panel editor. Production deploys keep `frame-ancestors 'none'`.

**Builder sandbox (Fly Machine + nsjail):**
- Fly Machine = Firecracker microVM (hardware-level isolation, stronger than Docker + gVisor)
- nsjail inside the VM for process-level restrictions:
  - No network access
  - Memory limit: 512MB
  - CPU limit: 1 core
  - PID limit: 100
  - Read-only filesystem (except /tmp)
  - No capabilities
- Pre-installed node_modules in image (no `npm install` at runtime)
- Docker base: `node:20-slim` (Debian, NOT Alpine — Tailwind v4 Oxide engine requires glibc)

**Pre-build code scanning** (expanded forbidden patterns — critical for agent-only architecture):
```
child_process, fs, net, eval, Function(, dangerouslySetInnerHTML,
innerHTML, outerHTML, document.write, window.location, javascript:,
importScripts, postMessage, __proto__, constructor[, opener, top., parent.
```

**Post-build output validation:**
- Only allow: .html, .js, .css, .svg, .png, .ico, .webp, .json, .woff2
- Reject files >5MB, symlinks, unexpected file types

**R2 versioned deployment** (prevents mixed old/new files during rebuild):
- Each build uploads to `{app_id}/v{version}/`
- Cloudflare KV stores current version pointer per app
- Worker reads KV → serves from correct version prefix
- Atomic switch: update KV pointer after all files uploaded

**Sandbox tenant isolation:**
- All sandbox Convex documents include `tenantId` field (= Firebase userId)
- All Convex queries enforce `withIndex('by_tenant', q => q.eq('tenantId', identity.subject))`
- Cross-tenant data access blocked at query layer
- Audit query in agent_system.md: agent MUST include tenant filter on every query

### UI Design System — Lovable-Inspired Builder UX

**Design philosophy:** Lovable-style split-panel editor with premium feel. Dark mode default, glassmorphism elements, smooth Motion animations, shadcn/ui component library.

**Layout — Split-Panel Editor (Desktop):**
```
┌──────────────────────────────────────────────────────────┐
│  Logo   [Projects ▾]              [Theme] [Share] [⚙️]   │
├──────────────────┬───────────────────────────────────────┤
│                  │                                       │
│   Chat Panel     │         Live Preview                  │
│   (Left ~35%)    │         (Right ~65%)                  │
│                  │                                       │
│  ┌────────────┐  │  ┌─────────────────────────────────┐  │
│  │ AI message │  │  │                                 │  │
│  │ with code  │  │  │    Generated App Preview        │  │
│  │ changes    │  │  │    (iframe)                     │  │
│  └────────────┘  │  │                                 │  │
│                  │  │    Mobile / Tablet / Desktop     │  │
│  ┌────────────┐  │  │    viewport toggle              │  │
│  │ User msg   │  │  │                                 │  │
│  └────────────┘  │  └─────────────────────────────────┘  │
│                  │                                       │
│  ┌────────────┐  │  [Mobile 📱] [Tablet] [Desktop 🖥️]    │
│  │ AI building│  │  [Visual Edit ✏️] [Code </>]          │
│  │ progress...│  │                                       │
│  └────────────┘  │                                       │
│                  │                                       │
│ ┌──────────────┐ │                                       │
│ │ Type message │ │                                       │
│ │         [➤] │ │                                       │
│ └──────────────┘ │                                       │
├──────────────────┴───────────────────────────────────────┤
│  [+ New Chat]  [📁 Files]  [🔀 Git]  [📊 Logs]          │
└──────────────────────────────────────────────────────────┘
```

**Layout — Mobile (< 768px):** Tabs-ით გადართვა Chat ↔ Preview, არა split.

**Color System (CSS Variables — shadcn/ui pattern, HSL format):**
```css
/* globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 4%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 4%;
  --primary: 262 83% 58%;            /* Appio brand purple */
  --primary-foreground: 0 0% 100%;
  --secondary: 240 5% 96%;
  --secondary-foreground: 240 6% 10%;
  --muted: 240 5% 96%;
  --muted-foreground: 240 4% 46%;
  --accent: 240 5% 96%;
  --accent-foreground: 240 6% 10%;
  --border: 240 6% 90%;
  --input: 240 6% 90%;
  --ring: 262 83% 58%;
  --radius: 0.625rem;
}

.dark {
  --background: 240 10% 4%;
  --foreground: 0 0% 98%;
  --card: 240 10% 6%;
  --card-foreground: 0 0% 98%;
  --primary: 262 83% 58%;
  --primary-foreground: 0 0% 100%;
  --secondary: 240 4% 16%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 4% 16%;
  --muted-foreground: 240 5% 65%;
  --border: 240 4% 16%;
  --input: 240 4% 16%;
  --ring: 262 83% 58%;
}
```

**Typography:**
```
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

H1: 2rem/700  |  H2: 1.5rem/600  |  Body: 0.875rem/400
Small: 0.75rem/400  |  Code: 0.8125rem/400  |  Button: 0.875rem/500
```

**Animation System (Motion):**
- Chat messages: slide-in from bottom, staggered delay
- Page transitions: cross-fade + subtle scale (AnimatePresence)
- Preview card: expand animation on `preview_ready`
- Bottom nav: sliding active indicator (Motion `layoutId`)
- Pull-to-refresh: spring physics via Motion + @use-gesture
- Skeleton shimmer: CSS animation (lightweight)
- Button hover: subtle scale(1.02) + shadow lift
- Card hover: border color transition to primary
- Toast: slide-in from right

**Chat Panel Design:**
- AI messages: `--muted` background, rounded corners, avatar icon
- User messages: `--primary` background, white text
- Code blocks: dark background, syntax highlighting (Shiki)
- Typing indicator: animated dots
- Progress steps: "Setting up project...", "Writing components...", "Building..."

**Premium Effects:**
- Top navbar: `backdrop-filter: blur(12px)`, semi-transparent
- Modal overlays: backdrop blur
- Glassmorphism on floating elements
- Deep dark backgrounds (not pure black) in dark mode
- Primary purple glow on interactive elements
- Subtle border separation for depth

### Neon PostgreSQL Configuration

```python
engine = create_async_engine(
    NEON_POOLER_URL,  # Use -pooler endpoint, NOT direct connection
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,           # CRITICAL: detect cold-start stale connections
    pool_recycle=300,
    connect_args={
        "ssl": "require",
        "prepared_statement_cache_size": 0,  # CRITICAL: Neon pooler compatibility
    },
)
# Note: For Alembic migrations, use direct connection string WITH prepared statement caching
```

### FastAPI Project Structure

```
apps/api/
├── main.py                  # FastAPI app factory, middleware, lifespan
├── config.py                # Pydantic Settings (env vars)
├── dependencies.py          # Shared deps (get_db, get_current_user)
├── core/
│   ├── security.py          # Firebase JWT verification (sync def — runs in threadpool)
│   ├── exceptions.py
│   └── middleware.py        # CORS, rate limiting, logging
├── domains/
│   ├── auth/
│   │   ├── router.py        # /api/v1/auth
│   │   ├── schemas.py
│   │   └── service.py       # Firebase token verification + user sync to Neon
│   ├── apps/
│   │   ├── router.py        # /api/v1/apps
│   │   ├── schemas.py
│   │   ├── service.py
│   │   └── dependencies.py
│   ├── generation/
│   │   ├── router.py        # /api/v1/generate (SSE streaming)
│   │   ├── schemas.py
│   │   ├── agent_service.py # Claude agent tool-use loop with caching + advisor
│   │   ├── planning.py      # Pre-generation structured planning
│   │   ├── critique.py      # Vision-based code review (screenshots, 0-100 rubric)
│   │   ├── linter.py        # Mid-stream Haiku 4.5 lint checks
│   │   ├── model_router.py  # Per-step model selection: Sonnet/Haiku/Opus(advisor)
│   │   ├── cost_tracker.py  # NEW: per-request token + cost telemetry (incl. Convex)
│   │   ├── theme_classifier.py # NEW: Haiku-based persona picker
│   │   ├── screenshot.py    # Playwright screenshot capture
│   │   └── rag.py           # RAG knowledge base retrieval (Convex docs)
│   ├── themes/
│   │   ├── router.py        # NEW: /api/v1/themes/generate (image/text → OKLCH)
│   │   ├── schemas.py
│   │   └── service.py       # Haiku 4.5 vision-based theme generation
│   ├── convex/              # NEW domain
│   │   ├── router.py        # /api/v1/convex/oauth (start, callback, status)
│   │   ├── schemas.py
│   │   ├── oauth_service.py # OAuth 2.0 flow with Convex platform
│   │   └── migration_service.py # Sandbox → user deployment data migration
│   ├── builds/
│   │   ├── router.py        # /api/v1/builds
│   │   ├── schemas.py
│   │   ├── service.py
│   │   └── tasks.py         # Dramatiq tasks: Fly Machine build + R2 upload
│   └── billing/
│       ├── router.py        # /api/v1/billing (Stripe webhook uses Request, not Pydantic body)
│       ├── schemas.py
│       └── service.py       # Stripe webhooks + tier enforcement
└── tests/
```

---

## Sprint 1 — Cost Optimization (Weeks 1-2)

> Reduce per-generation cost 40-60% with prompt caching and Haiku 4.5 for AutoFix. Zero-architectural-risk infrastructure win before bigger structural changes. Establishes cost telemetry baseline. **Advisor strategy moved to Sprint 4** (beta API — production fallback required first).

#### T1.1: Prompt caching for agent endpoint
- [x] **Status**: DONE ✅
- **Complexity**: Medium
- **Dependencies**: None
- **Description**:
  - Add `cache_control: {type: "ephemeral"}` to agent system prompt (~10K tokens) and tool definitions (~5K tokens)
  - **Do NOT** add cache_control to RAG-retrieved chunks — they vary per query and would break prefix match
  - Use 5-minute cache TTL for active sessions, 1-hour TTL for stable system prompt + tool defs
  - Verify cache hit rate via `response.usage.cache_read_input_tokens`
  - Realistic target: 40-50% input token cache hit rate (not 90% — RAG portion not cacheable)
  - Add Sentry telemetry for cache hit/miss rates per request
  - Document cache breakpoint strategy in `apps/api/domains/generation/agent_service.py`
  - Acceptance: 100 sample generations show ≥40% average input token cache hit rate

#### T1.2: Haiku 4.5 for AutoFix loop
- [x] **Status**: DONE ✅
- **Complexity**: Low
- **Dependencies**: None
- **Description**:
  - Refactor `model_router.py` to route AutoFix calls to `claude-haiku-4-5`
  - Lint/typecheck fixes don't need Sonnet's reasoning depth
  - Sonnet remains for primary code generation; Haiku handles mid-stream lint fixes
  - Track per-fix cost reduction (target: 75% savings on fix cycles)
  - **Quality guardrails**: fallback to Sonnet if Haiku fix attempt fails 2x consecutively (Haiku 4.5 prone to incomplete answers without lint/test gates per Anthropic docs)
  - Run prompt suite pre/post to verify no quality regression
  - Acceptance: per-generation total cost drops measurably; lint pass-rate unchanged ±2%

#### T1.3: Hard iteration cap + cost telemetry dashboard
- [x] **Status**: DONE ✅
- **Complexity**: Medium
- **Dependencies**: T1.1, T1.2
- **Description**:
  - Enforce hard cap: 15 iterations max in agent tool-use loop (currently 50)
  - Implement budget guard: $0.50 max per generation (down from $3)
  - Per-request telemetry: `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_write_input_tokens`, `cost_usd`, `model_breakdown`, `time_seconds`
  - PostHog dashboard: cost per generation (p50/p90/p99), cache hit rate over time, per-template cost breakdown
  - Alert threshold: p90 cost > $0.30 → Slack webhook
  - Comparison view: pre/post-Sprint-1 metrics side-by-side
  - **Baseline**: $0.50/gen (per memory). **Target**: $0.20/gen (60% reduction).
  - Acceptance: dashboard live with at least 100 post-optimization data points; baseline → target reduction confirmed

---

## Sprint 2 — Convex POC + Design Foundation (Weeks 3-5)

> Validate Convex on Capacitor mobile (offline UX) via single end-to-end Todo template. Set up Appio's shared sandbox Convex deployment with tenant isolation. Build Theme Persona schema and Motion library foundation in parallel. Two parallel tracks (backend POC + design foundation) so we de-risk Convex while design layer takes shape.

#### T2.1: Appio Sandbox Convex setup + tenant isolation pattern
- [x] **Status**: DONE ✅
- **Complexity**: High
- **Dependencies**: None
- **Description**:
  - Create Appio's shared Convex deployment ("appio-sandbox-prod")
  - Define tenant isolation pattern: every document has `tenantId: v.string()` (= Firebase userId)
  - Standard query pattern enforced: `ctx.db.query('table').withIndex('by_tenant', q => q.eq('tenantId', identity.subject))`
  - Index every table on `by_tenant` (composite indexes where needed)
  - Document tenant pattern with Architecture Decision Record in `docs/adr/001-convex-tenant-isolation.md`
  - Pre-build scanner: rejects Convex code without tenant filter on queries (prevents agent forgetting filter → cross-tenant leak)
  - Acceptance: ADR written + scanner active + sandbox deployment provisioned

#### T2.2: Convex POC — Todo template end-to-end (sandbox)
- [x] **Status**: DONE ✅
- **Complexity**: High
- **Dependencies**: T2.1
- **Description**:
  - Create new template: `packages/templates/todo-list-convex/`
  - Define Convex schema in `convex/schema.ts` (tasks table with `tenantId` + by_tenant index)
  - Implement queries: `listTasks`, `getTask`; mutations: `createTask`, `toggleTask`, `deleteTask` — all tenant-filtered
  - Wire React frontend with `useQuery`/`useMutation` hooks
  - All operations hit Appio sandbox Convex (not user-owned yet — that's Sprint 3)
  - Verify: User A's tasks invisible to User B (cross-tenant isolation)
  - Verify: create task in one browser tab → instant UI update in second tab (reactive)
  - Document: setup steps, deploy flow, expected sandbox costs at scale (1000 active drafts)
  - Acceptance: Todo app builds, deploys to R2, fully functional with real-time sync, tenant isolation verified

#### T2.3: Capacitor + Convex offline strategy validation
- [x] **Status**: DONE ✅
- **Complexity**: High
- **Dependencies**: T2.2
- **Description**:
  - Wrap Todo Convex POC with Capacitor iOS + Android shells (locally — no App Store submission)
  - Test offline scenarios: airplane mode → write task → reconnect → verify sync correctness
  - Measure WebSocket reconnect latency on mobile network switches (WiFi ↔ cellular)
  - Implement local-first pattern: optimistic Zustand store + Convex sync on reconnect
  - Compare offline UX vs current Firestore-based template (acceptance criteria: parity or better)
  - Document mobile-specific Convex patterns for `agent_system.md` (Sprint 3)
  - **Go/No-Go decision criteria**: documented offline UX comparison + reconnect latency numbers
  - Acceptance: written report with empirical numbers + go/no-go decision on Convex for mobile

#### T2.4: Firebase Auth → Convex JWT bridge
- [x] **Status**: DONE ✅
- **Complexity**: Medium
- **Dependencies**: T2.2
- **Description**:
  - Configure Convex `auth.config.ts` to accept Firebase ID tokens (Firebase issuer URL + project ID)
  - Convex queries/mutations get authenticated user via `ctx.auth.getUserIdentity()`
  - `tenantId` derives from `identity.subject` (Firebase UID)
  - Update `useAuth` hook in `packages/ui` to inject Firebase token into Convex client
  - Test: Google + Apple OAuth → Firebase Auth → Convex authenticated query returns correct user
  - Acceptance: end-to-end auth flow works in POC Todo app on web + iOS + Android

#### T2.5: Theme Personas — 5 curated presets
- [x] **Status**: DONE ✅
- **Complexity**: Medium
- **Dependencies**: None
- **Description**:
  - Extend `template.config.json` schema: add `persona` field (enum of 5)
  - Create `packages/themes/` with 5 personas:
    - `minimal-mono` (Linear-style: mono fonts, tight spacing, monochrome accents)
    - `vibrant-gradient` (Stripe-style: bold gradients, generous padding, sans hero)
    - `brutalist-bold` (Vercel-style: sharp borders, high contrast, no shadows)
    - `glassmorphic-soft` (Apple-style: backdrop blur, soft radii, depth via layering)
    - `editorial-serif` (Notion-style: serif headlines, calm palette, generous line-height)
  - Each persona: OKLCH color palette + RGB sRGB fallback (for iOS 15 WebView) + typography pair + radius/shadow tokens + animation timings
  - Validate: each persona passes WCAG AA contrast checks programmatically (in both color spaces)
  - Acceptance: all 5 personas render correctly in template picker preview on iOS 15+ and modern browsers
  - **Implementation notes (2026-04-20):**
    - `packages/themes/` ships 5 personas + schema (`Persona`, `PersonaId`, palette/typography/shape/motion)
    - Validator enforces WCAG AA in both OKLCH and RGB color spaces + fallback drift ≤ΔRGB 12
    - Current state: 0 errors, 17 warnings (all `OUT_OF_GAMUT` from Tailwind v4 P3 palette — expected; iOS 15 uses the hex fallback)
    - `personaToCss()` helper emits `:root { … @supports not (color: oklch(0 0 0)) { … hex fallback … } }` stylesheets
    - Template registry (`packages/templates/index.ts`) now requires `persona: PersonaId`; startup assertion fails if any template references a missing persona. All 6 templates tagged (todo-list + todo-list-convex → minimal-mono, notes-app → editorial-serif, habit-tracker → brutalist-bold, expense-tracker → glassmorphic-soft, quiz-app → vibrant-gradient)
    - Preview route `apps/web/src/app/(app)/create/personas/page.tsx` renders each persona in both schemes with swatches + buttons + type samples + motion/shape metadata
    - ADR `docs/adr/003-theme-personas.md` documents the dual color-space strategy and 5-vs-N rationale

#### T2.6: Motion library integration
- [x] **Status**: DONE ✅
- **Complexity**: Medium
- **Dependencies**: T2.5
- **Description**:
  - Replace `framer-motion` with `motion` (smaller bundle, active maintainer, same React API)
  - Update `packages/templates/base/package.json`
  - Define 10 named animation presets in `packages/ui/animations/`:
    - `pageTransition`, `listStagger`, `cardReveal`, `gestureSwipe`, `modalSpring`, `fabExpand`, `toastSlide`, `pullToRefresh`, `tabSlide`, `skeletonShimmer`
  - Each preset: timing curve + duration + variants (with `prefers-reduced-motion` fallback)
  - Acceptance: 10 presets working in POC Todo app, bundle size reduction documented
  - **Implementation notes (2026-04-20):**
    - `packages/ui/src/animations/` ships 10 presets + `useAnimationPreset` / `useStaggerPreset` hooks that resolve full-vs-reduced variants via `useReducedMotion() === true` (null-safe — null is treated as "don't reduce" pre-hydration)
    - `skeletonShimmer` is exposed both as a Motion variant (fallback) and as a canonical CSS class `.animate-skeleton-shimmer` (with `@media (prefers-reduced-motion: reduce)`); the CSS path is preferred for skeletons
    - `@appio/ui` adds `./animations` and `./animations/skeleton-shimmer.css` subpath exports + `motion` peerDep
    - `packages/templates/base/package.json` adds `motion@^12.0.0` → 708 KB installed vs framer-motion@11's ~2.1 MB (~67% reduction)
    - POC wiring in `packages/templates/todo-list-convex/src/App.tsx`: `cardReveal` on SignInScreen surface, `pageTransition` on TodoScreen `<main>`, `listStagger` + `AnimatePresence` on the task list (ul stays mounted on empty state so last-item delete animates out)
    - `apps/web` was already fully on `motion/react` (no framer-motion imports anywhere in Appio) — no main-app migration required
    - ADR `docs/adr/004-motion-animation-presets.md` documents the decision, bundle math, and reduced-motion strategy
    - Follow-up queued: update `agent_system.md` (Sprint 3, T3.3) so the agent emits `motion/react` imports and picks presets by name rather than authoring inline timings

---

## Sprint 3 — Convex Migration + OAuth (Weeks 6-9)

> Migrate `packages/ui` data hooks from Firestore to Convex (sandbox-aware). Update agent prompts and RAG knowledge base. Migrate remaining 4 templates. Build Convex OAuth integration + Publish flow (sandbox → user-owned migration). After this sprint, Convex is the primary backend with dual-stage architecture (sandbox for drafts, user-owned for published).

#### T3.1: Rewrite useCollection hook for Convex (sandbox-aware)
- [x] **Status**: DONE ✅ (narrow scope — offline write queue deferred to T3.1b per ADR 005)
- **Complexity**: High
- **Dependencies**: T2.2, T2.3
- **Description**:
  - New: `useCollection` hook backed by Convex `useQuery`
  - Same external API: `useCollection<T>(config, path, options)` — agent code unchanged
  - Internal: maps Firestore-style queries (where, orderBy, limit) to Convex query functions
  - **Sandbox-aware**: hook detects whether app is in sandbox mode (default) or published mode (uses user's own Convex deployment via OAuth token)
  - Reactive by default — no manual refetch needed
  - Local-first via Zustand persist middleware (offline writes queue → sync on reconnect)
  - Compatibility shim for legacy templates (path `users/{uid}/tasks` → Convex query parameter with `tenantId`)
  - Acceptance: existing Firestore-based templates work with new `useCollection` (pre-migration validation)

#### T3.2: Rewrite useAuth hook with Convex bridge
- [x] **Status**: DONE ✅
- **Complexity**: Medium
- **Dependencies**: T2.4, T3.1
- **Description**:
  - `useAuth` returns Convex-aware user identity (`subject`, `email`, `name` from Firebase JWT)
  - `<LoginScreen>` component external API unchanged
  - Internal: Firebase `signIn` → `onAuthStateChanged` → `convexClient.setAuth(token)`
  - Token refresh handled automatically (Convex client auto-refreshes via Firebase `getIdToken`)
  - Logout: clear Firebase session + `convexClient.clearAuth()`
  - Acceptance: auth flow identical from agent's POV; no breaking changes to `<LoginScreen>` props

#### T3.3: Update agent_system.md Backend Stack section
- [x] **Status**: DONE ✅
- **Complexity**: Medium
- **Dependencies**: T3.1, T3.2
- **Description**:
  - Rewrite "Backend Stack — Decision Matrix" section for Convex patterns
  - Update few-shot examples: 5 backend patterns (auth-only, auth+convex, auth+convex+push, auth+payments, full SaaS)
  - Document: `useCollection`/`useAuth` API stays the same; Convex powers it under the hood (sandbox or user-owned)
  - Add: when to use Convex `actions` (external API calls, scheduled tasks)
  - Add: schema definition pattern (TypeScript `schema.ts`) — MUST include `tenantId` + `by_tenant` index
  - Add: Capacitor + Convex offline patterns from T2.3 report
  - Add: HARD RULE — every query MUST filter by tenantId (pre-build scanner enforces)
  - Verify: agent generates correct Convex code for 10 sample prompts, all with proper tenant isolation
  - Acceptance: prompt-suite quality score holds steady or improves vs Firestore baseline; zero tenant isolation violations

#### T3.4: Update RAG knowledge base for Convex
- [x] **Status**: DONE ✅
- **Complexity**: Medium
- **Dependencies**: T3.3
- **Description**:
  - Re-index Convex docs in `packages/prompts/rag/` (replace Firestore docs)
  - Curate top 20 Convex patterns: queries, mutations, schema, auth, file storage, scheduled functions, actions, indexes, multi-tenant patterns
  - Update RAG retrieval prompts to surface Convex examples for relevant queries
  - Test retrieval relevance: 10 sample prompts → verify correct Convex docs retrieved
  - Keep Firebase Auth + FCM docs in RAG (still in use for those features)
  - Acceptance: retrieval precision ≥80% on sample prompt set

#### T3.5: Migrate remaining 4 templates to Convex
- [x] **Status**: DONE ✅
- **Complexity**: High
- **Dependencies**: T3.1, T3.2, T3.3
- **Description**:
  - Templates: `notes-app`, `habit-tracker`, `expense-tracker`, `quiz-app`
  - Each gets `convex/schema.ts` + queries/mutations + tenant isolation
  - Update `template.config.json`: `storageBackend` changes from `"localStorage"`/`"firestore"` to `"convex"`
  - Verify each template builds + deploys to sandbox + reactive UI works
  - Old Firestore-based templates archived in `packages/templates/_legacy/`
  - Test end-to-end: agent generates each template variant via canonical prompts
  - Acceptance: all 5 templates (incl. POC todo) generate, build, deploy to sandbox, function correctly
  - **Implementation notes (2026-04-21):**
    - 4 templates now ship `convex/schema.ts` + per-table query/mutation files using `tenantQuery` / `tenantMutation` from `base/convex/_helpers.ts`:
      - `notes-app`: `schema.ts` (notes+folders) + `notes.ts` + `folders.ts`
      - `habit-tracker`: `schema.ts` (habits+completions) + `habits.ts` + `completions.ts`
      - `expense-tracker`: `schema.ts` (transactions) + `transactions.ts`
      - `quiz-app`: `schema.ts` (quizzes+attempts) + `quizzes.ts` + `attempts.ts`
    - All pass `python/builder/src/appio_builder/convex_scanner.py` (0 tenant-isolation findings)
    - `storageBackend` flipped to `"convex"` + `dataModel` descriptors updated to Convex types (`_id: Id<'table'>` + `tenantId` + `number` for timestamps). Legacy Zustand stores (`src/stores/*.ts`) removed.
    - `python/codegen/` (deprecated path still used by preview + prompt_suite) learned two branches: localStorage (Zustand stores + barrel) vs Convex (overlay template's `convex/` over base, rewrite `src/index.tsx` to wrap `<App/>` in `<ConvexClientProvider>`, skip stores barrel). `TemplateConfig` gained `storage_backend: str`; `render_component_tsx` emits `api` + `useQuery`/`useMutation` imports for Convex templates instead of `import * as Stores`.
    - Codegen tests rewritten: `_expense_spec()` fixture now uses `api.transactions.listTransactions` in JSX body; added `_todo_spec()` for localStorage path coverage via `todo-list`; new assertions cover Convex overlay presence, stores absence, and ConvexClientProvider wrapping of `<App/>`.
    - "Old Firestore-based templates archived" criterion: **vacuously satisfied** — none of the 5 templates were ever Firestore; the historical localStorage shim (`todo-list`) is intentionally retained as the dual-mode codegen's localStorage test fixture + a reference for the mobile app (`apps/mobile/app/(tabs)/index.tsx`) and shared schemas.
    - End-to-end deploy verification (T5.1 acceptance gate) is bounded by what was achievable inside the PR: deterministic codegen output is structurally correct + typechecks, scanner clean, test suite green (89 passed on affected paths; 7 unrelated pre-existing failures in `test_auth_bridge.py` / `test_autofix.py` remain as separate tech debt). Running a real sandbox build requires Convex deployment credentials + workspace npm install + R2 upload — that belongs in T5.1's multi-feature verification.

#### T3.6: Convex OAuth integration + Publish flow
- [x] **Status**: DONE ✅ (framework; 3 pipeline steps shipped as stubs per ADR 006 scoping — end-to-end wire-up tracked as T3.7)
- **Complexity**: High
- **Dependencies**: T3.1, T3.5
- **Description**:
  - Register Appio as OAuth 2.0 application with Convex Platform APIs
  - New domain: `apps/api/domains/convex/` with `oauth_service.py` + `migration_service.py`
  - New endpoint: `POST /api/v1/convex/oauth/start` → returns Convex OAuth URL
  - New endpoint: `POST /api/v1/convex/oauth/callback` → exchanges code for team token, encrypts in Neon
  - New page: `apps/web/src/app/(app)/publish/[appId]/` → "Connect Convex to publish" modal
  - **Migration flow**:
    1. User clicks Publish → OAuth modal
    2. OAuth complete → `migration_service.provision_deployment(user_token, app_id)`
    3. Provision new deployment in user's Convex account (Management API)
    4. Push schema (`convex/schema.ts`) + functions to user's deployment
    5. Copy data from Appio sandbox (filtered by tenantId) → user's deployment
    6. Update app's `convex.json` with user's deployment URL
    7. Rebuild app + redeploy with new Convex URL
    8. Mark app "published" — sandbox copy archived after 30-day grace period
  - **Token storage**: encrypted at rest in Neon (use `cryptography.Fernet` with key from env)
  - **Token refresh**: handle Convex token expiry, prompt user to re-auth if needed
  - **Error handling**: graceful failure if user revokes Convex access — app falls back to read-only mode
  - Acceptance: end-to-end publish flow works for POC Todo app; data correctly migrated; published app reactive in user's Convex

#### T3.7: Publish pipeline — wire up stub steps (data copy, config rewrite, rebuild)
- [x] **Status**: DONE ✅
- **Complexity**: High
- **Dependencies**: T3.6
- **Description**:
  - ADR 006 shipped T3.6 with 3 publish pipeline steps as intentional stubs, each blocked on a distinct dependency. This task wires them up once the blockers land.
  - **`_step_copy_data` stub → real sandbox export/import** (external blocker: Convex Management API must expose a tenantId-filtered export endpoint, or Convex must approve Appio as OAuth partner granting Data API access)
    - Replace empty JSONL dump with real export scoped to `tenantId` from Appio sandbox Convex.
    - Import into user's newly provisioned deployment.
    - Verify row counts match before marking step done.
  - **`_step_rewrite_config` stub → real R2 workspace rewrite** (internal blocker: workspace persistence to R2)
    - Read the app's workspace from R2 (`{app_id}/latest/src/config/convex.ts`).
    - Replace `CONVEX_URL` constant with the user's deployment URL.
    - Flip `CONVEX_MODE` from `"sandbox"` to `"published"` (triggers the `useConvexMode` hook's Preview-banner hide per ADR 005).
    - Upload modified workspace back to R2 under a new version prefix.
  - **`_step_rebuild` stub → real builds-domain enqueue** (internal blocker: `apps.api.domains.builds` must expose a public enqueue function; currently the Dramatiq task is internal to the domain)
    - Expose `enqueue_rebuild(app_id, version)` in `apps/api/domains/builds/tasks.py`.
    - Call from `_step_rebuild` and poll `builds` table until the job reaches `published` or fails.
    - Propagate build errors back to the publish job with a structured failure reason.
  - **Integration test:** provision a real OAuth-linked user deployment (can be a test Convex account), publish the POC Todo template end-to-end, verify user's Convex now contains the data + the published R2 bundle points at it.
  - Acceptance: POC Todo app publishes end-to-end — data migrated, config rewritten, app rebuilt and served at `{slug}.appiousercontent.com` talking to user-owned Convex. All 7 pipeline steps return "published".

#### T3.8: Deploy-key-based publish flow (supersedes ADR 006 OAuth path)
- [x] **Status**: DONE ✅
- **Complexity**: High
- **Dependencies**: T3.6, T3.7
- **Description**:
  - Research on 2026-04-21 revealed ADR 006's OAuth partner dependency was based on an incorrect premise: Convex's Management API is fully public and self-service. **ADR 007** documents the revised architecture.
  - **Scope**: replace the OAuth flow from T3.6 with a deploy-key paste flow. Keep T3.6/T3.7's rewrite + rebuild pipeline (already battle-tested) unchanged.
  - **New: `AppConvexCredentials` model**
    - Per-app encrypted storage of `CONVEX_DEPLOY_KEY` + `CONVEX_URL`
    - Reuses the Fernet + `CONVEX_TOKEN_ENCRYPTION_KEY` helper from T3.6 (`apps/api/domains/convex/crypto.py`)
    - Alembic migration adds the table; drops `convex_oauth_tokens` in the same migration (no prod rows — T3.6 was framework-only)
  - **New credentials endpoints** at `apps/api/domains/convex/router.py`:
    - `POST /api/v1/convex/credentials/{app_id}` — paste deploy key + URL (validates `prod:` prefix and `https://*.convex.cloud` URL shape)
    - `GET /api/v1/convex/credentials/{app_id}` — bool "are creds set" + URL (never returns the key)
    - `DELETE /api/v1/convex/credentials/{app_id}` — revoke / clear
  - **Migration service refactor** (`apps/api/domains/convex/migration_service.py`):
    - Drop `_step_provision` (user already provisioned the deployment in the dashboard)
    - Add `_step_validate_credentials` as pipeline step 1 — loads + decrypts creds, stores `CONVEX_URL` on the job
    - `_step_push_schema` / `_step_push_functions` → subprocess `npx convex deploy --cmd-url-env-var-name CONVEX_URL` with `CONVEX_DEPLOY_KEY` in env (NEVER logged)
    - `_step_copy_data` → scratch-deployment pattern per ADR 007: server-side action on sandbox copies tenantId-scoped rows to a 1-hour-TTL scratch deployment, `npx convex export` from scratch, `npx convex import --replace` to user deployment, tear down scratch
    - `_step_rewrite_config` + `_step_rebuild` + `_step_mark_published` — **unchanged from T3.7**
  - **Remove from T3.6**:
    - `apps/api/domains/convex/oauth_service.py` (entire module)
    - OAuth router endpoints (`/oauth/start`, `/oauth/callback`, `/oauth/status`, `/oauth/revoke`)
    - `ConvexOAuthToken` model (via Alembic migration)
    - `provision_deployment` / `exchange_code` / `refresh_token` / `revoke_token` methods on the `ConvexPlatformClient` Protocol + both implementations
    - Settings: `convex_oauth_client_id`, `convex_oauth_client_secret`, `convex_platform_api_url`
  - **Docker/deps**: publish worker image needs Node.js + `convex` npm package available; update `docker/builder/Dockerfile`
  - **Frontend** (`apps/web/src/app/(app)/publish/[appId]/page.tsx`): replace "Connect with Convex" button with a "Paste deploy key" form + step-by-step instructions (link to Convex dashboard, explain the 3-click key generation)
  - **Security guardrails**:
    - CI grep guard asserting `CONVEX_DEPLOY_KEY` never appears in any `logger.info/warning/error` call site
    - Unit test verifying the key is stripped from `PublishError` messages surfaced via `/publish/status`
    - subprocess env isolation — deploy key never set on the parent process env
  - **Tests**:
    - Credentials endpoints: happy path + validation failures + encryption round-trip
    - Each refactored pipeline step, including the scratch-deployment data migration
    - End-to-end mock using `FakeConvexCli` (new fake that shims subprocess calls)
  - Acceptance: POC Todo app publishes end-to-end without any OAuth. User pastes a real Convex deploy key, Appio pushes schema/functions/data via `npx convex`, rewrite + rebuild still produces a working app at `{slug}.appiousercontent.com` talking to user-owned Convex. All pipeline steps return "published".
  - **Implementation notes (2026-04-21):**
    - 73/73 tests pass (19 credentials + 8 CLI scrub + 24 migration + 22 existing)
    - `AppConvexCredentials` model + Alembic migration 011 (additive, `convex_oauth_tokens` kept for now)
    - `credentials_service.py` — validate + encrypt (Fernet) + upsert + load-for-publish
    - `cli.py` — async `npx convex deploy` / `import` subprocess wrapper with **deploy-key scrubbing** on stdout/stderr (security review HIGH fix locked in by 8 dedicated tests)
    - `migration_service.py` — pipeline refactored: `_step_validate_credentials` + `_step_push_code` replace `_step_provision` + `_step_push_schema` + `_step_push_functions`. Pipeline order adjusted so `_step_rewrite_config` runs **before** `_step_push_code` (workspace must be on disk before `npx convex deploy` reads it).
    - Removed: `oauth_service.py`, `client.py`, all OAuth router endpoints, OAuth settings from `config.py`, OAuth test module
    - `_step_copy_data` remains a documented no-op — full scratch-deployment pattern tracked as T3.9
    - ruff + mypy clean on all modified/created files
    - **Deferred as followups:**
      - T3.9 — scratch-deployment scoped data migration
      - T3.10 — Publish modal UI (frontend)
      - TOCTOU race on concurrent credential pastes (MEDIUM, use `ON CONFLICT DO UPDATE`)
      - `load_credentials_for_publish` — add defensive `user_id` param (LOW, defense in depth)
      - Drop `ConvexOAuthToken` + `ConvexDeployment` tables in migration 012
      - Docker: add Node.js + `convex` npm package to publish worker image

#### T3.9: Scratch-deployment data migration
- [x] **Status**: DONE ✅
- **Complexity**: High
- **Dependencies**: T3.8
- **Description**:
  - Replace `_step_copy_data` no-op stub with the scratch-deployment pattern from ADR 007 §Data migration.
  - **Flow per publish job:**
    1. Appio runs a server-side Convex action on the sandbox deployment that copies the publishing user's `tenantId`-scoped rows into a freshly provisioned **scratch deployment** (short-lived, 1-hour TTL).
    2. Appio generates a deploy key for the scratch deployment via Convex Management API.
    3. `npx convex export --path /tmp/snapshot.zip` against the scratch deployment produces a clean, tenant-free snapshot.
    4. `npx convex import --replace /tmp/snapshot.zip` against the user's deployment using their deploy key loads the data.
    5. Tear down the scratch deployment + invalidate its deploy key.
  - Uses already-built `apps/api/domains/convex/cli.py::run_convex_import` (unused in T3.8, wired in this task).
  - Required new infra: a server-side Convex action in the sandbox that accepts `tenantId` + scratch-deployment URL/key and streams the rows over. This lives in `packages/templates/base/convex/` as a reserved Appio-only mutation.
  - **Security requirement:** the scratch deployment must NEVER be exposed to users — it's a transient migration buffer. Teardown must be reliable even on pipeline failure (use `try/finally` wrapper).
  - Acceptance: Todo app publish end-to-end correctly moves the user's `tenantId`-scoped rows into their Convex deployment. Cross-tenant isolation verified: user A's publish does not leak user B's data. Scratch deployment is always torn down within 1 hour of publish attempt (even on failure).

#### T3.10: Publish modal UI (Paste deploy key)
- [x] **Status**: DONE ✅
- **Complexity**: Medium
- **Dependencies**: T3.8
- **Description**:
  - Update `apps/web/src/app/(app)/publish/[appId]/page.tsx` — replace "Connect with Convex" OAuth button with a "Paste deploy key" form.
  - Form fields: `deployment_url` (text, pattern-validated client-side), `deploy_key` (password input).
  - Step-by-step instructions panel with screenshots/text:
    1. Sign in at `dashboard.convex.dev`
    2. New Project (or pick existing)
    3. Settings → Deploy Keys → Generate Production Deploy Key
    4. Copy key + URL, paste here
  - POST to `/api/v1/convex/credentials/{app_id}` on submit.
  - After success → call existing `POST /api/v1/convex/publish/{app_id}` and poll job status.
  - UX: "credentials already set" state hides the form and shows "Re-paste key" option (calls DELETE then POST).
  - Accessibility: proper label/aria for the password field; warn users the key is sensitive.
  - Acceptance: end-to-end user flow works in browser — paste key → click Publish → see progress → see success with the published URL. UI remains usable on mobile (split-panel collapses).

---

## Sprint 4 — Design Excellence + Advisor (Weeks 10-13)

> Ship the design differentiators that escape "generic shadcn look": AI Theme Generator (image/text → OKLCH tokens), Layout Block Registry (15 high-level blocks), and tightened Quality Bar in agent prompt with explicit design rules. **New**: integrate Opus 4.6 advisor strategy as experimental feature (beta API with graceful fallback). This is where Appio's premium positioning becomes visible to users.

#### T4.1: AI Theme Generator (image/text → OKLCH tokens)
- [x] **Status**: DONE ✅
- **Complexity**: High
- **Dependencies**: T2.5
- **Description**:
  - New endpoint: `POST /api/v1/themes/generate` (input: text prompt OR image URL)
  - Use Haiku 4.5 with vision for image input (~$0.001-0.005 per generation)
  - Output: full OKLCH color palette + RGB sRGB fallback + typography pair + radius/shadow tokens (matches Theme Persona schema)
  - Validation: WCAG AA contrast checks before returning (in both color spaces)
  - UI: theme generator panel in chat sidebar (split-panel)
  - User can save generated themes to personal palette library (Neon DB: `user_themes` table)
  - Acceptance: 10 sample inputs (5 images + 5 text prompts) produce visually coherent, WCAG-compliant themes

#### T4.2: Layout Block Registry — 15 high-level blocks
- [x] **Status**: DONE ✅
- **Complexity**: High
- **Dependencies**: T2.5, T2.6
- **Description**:
  - Create `packages/ui/blocks/` with shadcn-blocks-style compositions
  - Initial 15 blocks:
    - `hero-centered`, `hero-split`, `dashboard-stats`, `settings-panel`, `marketplace-grid`, `profile-card`, `pricing-table`, `feature-grid`, `testimonials`, `faq-accordion`, `footer-multi`, `login-card`, `onboarding-stepper`, `empty-state-illustrated`, `command-palette`
  - Each block: full composition (not just primitive), uses Theme Persona tokens, includes Motion preset
  - Update `agent_system.md`: agent prefers blocks over composing primitives from scratch
  - Token savings: each block reference ~200 tokens vs 1500 for raw composition (~87% reduction on UI code)
  - Test: agent picks correct blocks for sample prompts (e.g., "landing page" → `hero-centered` + `feature-grid` + `testimonials` + `footer-multi`)
  - Acceptance: 15 blocks render correctly across all 5 personas; agent uses blocks in ≥80% of generations
  - **Implementation notes (2026-04-22):**
    - New package `@appio/layout-blocks` (NOT `packages/ui/blocks/` — kept as its own workspace package so `@appio/ui` stays lean + blocks can evolve independently). 19 files, 3,924 lines of typed React.
    - All 15 blocks shipped across 3 batches:
      - **Batch 1 (landing):** `HeroCentered`, `HeroSplit`, `FeatureGrid`, `Testimonials`, `FooterMulti`
      - **Batch 2 (dashboard/forms/auth):** `DashboardStats`, `SettingsPanel`, `PricingTable`, `LoginCard`, `OnboardingStepper`
      - **Batch 3 (utility):** `MarketplaceGrid`, `ProfileCard`, `FaqAccordion`, `EmptyStateIllustrated`, `CommandPalette`
    - Persona integration is zero-config — blocks use shadcn Tailwind classes (`bg-background`, `text-foreground`, `bg-primary`, `border-border`, `bg-muted`, `text-muted-foreground`, `bg-card`). Whatever persona is in scope (`personaToCss()` emits OKLCH; apps/web uses HSL) drives the palette automatically. Typography pulls `var(--font-heading, inherit)` so editorial-serif renders serif, brutalist-bold renders heavy-sans, etc.
    - Motion presets baked in: blocks activate `cardReveal` / `listStagger` / `pageTransition` at mount. Agent prompt explicitly warns not to wrap blocks in extra motion containers (double-animation fight).
    - `DashboardStats` uses universal green/red/muted trend colors (not persona tokens) — dashboards are traffic-light-semantic regardless of brand. `invertTrend: true` flag handles "down is good" metrics (churn, latency, errors).
    - `CommandPalette` uses virtual-focus pattern (input owns real focus, row shows visual `aria-selected`). Full keyboard nav: ↑↓ Home End Enter Esc. Matches against label + description + extra `keywords` array.
    - Registry (`packages/layout-blocks/src/registry.ts`) exposes `blockRegistry`, `availableBlockIds`, `getAgentPromptListings()` — exhaustive over `BLOCK_IDS` so picker UIs + prompt generators iterate the full taxonomy in O(1).
    - `agent_system.md` gained a "Layout Blocks" subsection under "The UI component library" with all 15 usage examples, import pattern, and "when to use blocks vs `./components/ui`" decision tree. Pending-block warning removed — all 15 are live.
    - 15 `layout_blocks` entries added to `packages/prompts/rag/snippets.json` (125 → 140 total) via an idempotent `scripts/add-layout-block-snippets.py` script.
    - Visual verification surface: `apps/web/src/app/(app)/blocks-gallery/page.tsx` + `components/blocks-gallery/` renders every block × every persona × light/dark. Realistic sample data exercises full prop surface (all optional slots filled).
    - Gates: `tsc --noEmit` clean on `@appio/layout-blocks`, `@appio/ui`, `apps/web` after each batch.
    - **Deferred follow-up:** the `≥80% agent block-adoption` acceptance metric is a *measurement*, not an implementation gate — it needs a live prompt-suite run against the updated `agent_system.md`. This naturally lands in T5.1 (Multi-feature app generation test) where real end-to-end runs already exercise the agent with cost-telemetry + generated-code inspection. Measurement will be added to T5.1's acceptance checklist.

#### T4.3: Updated quality bar in agent_system.md (with explicit rubric)
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Dependencies**: T4.1, T4.2
- **Description**:
  - Rewrite "Quality bar" section with explicit design rules:
    - Animation requirements: every interactive element references a Motion preset (no custom inline animations)
    - Spacing: must use design token scale (no arbitrary px values; only tokens like `space-2`, `space-4`)
    - Typography hierarchy: max 3 type sizes per screen
    - Color: must use Persona palette (no inline hex outside tokens)
    - Layout: must use blocks for hero/dashboard/settings (not raw primitive composition)
  - Vision critique scoring updated: 0-10 → 0-100 with explicit rubric:
    - Animation (0-15), Spacing (0-15), Typography (0-15), Color (0-15), Layout (0-15), Accessibility (0-15), Mobile (0-10)
  - High-severity issues block deploy: missing animations, color violations, accessibility fails
  - Update `critique.py` to enforce new rubric
  - Acceptance: prompt-suite mean critique score ≥85; pre/post comparison shows quality lift

#### T4.4: Advisor strategy integration (experimental, Opus 4.6)
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Dependencies**: T1.1, T1.3
- **Description**:
  - Add `anthropic-beta: advisor-tool-2026-03-01` header to agent requests
  - Configure advisor tool: `model=claude-opus-4-6`, `max_uses=3`, `name=advisor`, `type=advisor_20260301`
  - Sonnet 4.6 remains executor; consults Opus only when stuck on architectural decisions
  - **Graceful fallback**: if advisor API errors (beta downtime, header rejection), continue with Sonnet alone — no user-visible failure
  - **Feature flag**: PostHog flag `enable-advisor` to disable globally if needed
  - Track advisor invocations separately in cost telemetry (Sprint 1 dashboard extended)
  - Expected: +2.7pp accuracy on prompt suite + ~12% net cost reduction (per Anthropic benchmarks)
  - Document escalation patterns in `agent_system.md`: "When to consult advisor"
  - **Risk acknowledgments**: no Priority Tier for Opus advisor calls (latency may spike), no streaming (TTFT increases per consultation)
  - Acceptance: prompt-suite quality score improves with advisor enabled; advisor invoked on average 0.5-1.5 times per generation; fallback path tested via API mock

---

## Sprint 5 — Polish & Beta (Weeks 14-16)

> Validate end-to-end with multi-feature complex app generation including the Publish flow. Lock in cost telemetry. Onboard 30 beta users from personal network + warm intros. Document the new stack. After this sprint, the builder is production-ready and we move to other product surfaces (marketing site, marketplace, App Store submissions).

#### T5.1: Multi-feature app generation test (end-to-end with Publish)
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Dependencies**: T3.5, T3.6, T3.7, T4.2, T4.3
- **Description**:
  - Generate "expense tracker with auth + Convex sync + dark mode + chart visualizations" via single prompt
  - Verify on sandbox: full stack generated, Convex schema correct (with tenantId), real-time sync works
  - Trigger Publish flow → OAuth Convex → migration → app live on user's Convex
  - Verify on user's Convex: data preserved, schema deployed, app reactive
  - Cost target: under $0.20 per generation (down from $0.50 baseline) on Appio side
  - Time target: under 60 seconds end-to-end generation; under 30 seconds publish migration
  - Run 10 variations: different theme personas, complexity levels, integrations (auth-only, auth+sync, auth+payments)
  - Document failure modes for next iteration
  - **Layout-blocks adoption measurement (carried over from T4.2):** include at least 3 marketing/dashboard/auth-shaped prompts ("landing page for X", "dashboard with KPIs", "pricing page"). Grep generated code for `@appio/layout-blocks` imports. Calculate block-adoption rate; target ≥80% of block-appropriate generations should use at least one block. If rate is lower, update `agent_system.md` examples or tune RAG retrieval — don't ship Sprint 5 until the adoption bar is met.
  - Acceptance: 8/10 variations succeed end-to-end; cost + time targets met on at least 7/10; Publish flow works on at least 8/10; layout-blocks adoption ≥80% on block-appropriate prompts

#### T5.2: Cost telemetry validation + Convex usage tracking
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Dependencies**: T1.3, T5.1
- **Description**:
  - PostHog dashboard final review: cost per generation (p50, p90, p99), cache hit rate over time, advisor usage, per-template cost breakdown
  - **Convex sandbox usage tracking**: function calls, storage, bandwidth attributed per generated app via Convex's internal logs API
  - Cost-per-day budget alerts (Slack webhook on threshold breach)
  - Generation success rate by reason (build error, lint fail, vision critique fail, advisor exhausted)
  - Pre/post optimization comparison report: actual savings vs projected ($0.50 → $0.20 = 60% reduction)
  - **Sandbox cost projection**: extrapolate from 30 beta users → 1000 users → 10K users for capacity planning
  - Acceptance: dashboard documented in README; alerts firing correctly on test thresholds; Convex sandbox cost trajectory validated

#### T5.3: Beta launch (PWA web-only, 30 testers from personal network)
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Dependencies**: T5.1, T5.2
- **Description**:
  - **Acquisition**: 30 testers via personal network + warm intros (Twitter followers, friends, ex-colleagues, mobile creators in network)
  - **Scope**: PWA web-only — App Store submissions deferred to post-Sprint-5 mini-sprint
  - Onboarding flow: explain credit system, sample prompts, template gallery, theme persona picker
  - **Critical onboarding moment**: explain Publish flow + Convex OAuth gracefully (this is the friction point)
  - In-app feedback widget (Sentry user feedback)
  - Beta-specific feature flags (PostHog): rollback if issues
  - Support inbox (Linear ticket integration)
  - Beta launch communication: personal Twitter posts, direct DM to network, no public launch yet
  - Track key metrics: signup-to-first-app rate, generation success rate, OAuth completion rate at publish
  - Acceptance: 30 invites sent + accepted; ≥10 users complete first generation; publish flow attempted by ≥5 users

#### T5.4: Documentation update + sprint retrospective
- [ ] **Status**: TODO
- **Complexity**: Low
- **Dependencies**: T5.3
- **Description**:
  - Update `README.md` with new stack (Convex dual-stage, theme personas, blocks, cost optimizations)
  - Migration guide for any closed-alpha users still on Firestore
  - Architecture diagram update reflecting final stack (sandbox + user-owned Convex)
  - Cost analysis report: actual savings vs projected, broken down by lever (caching, Haiku autofix, advisor)
  - Sprint retrospective doc: what worked, what didn't, what's next (App Store submissions, marketing site, marketplace)
  - Beta feedback synthesis: top 5 user pain points, top 5 wins
  - Acceptance: documentation merged; retrospective reviewed; next sprint planning queued

---

## Out of Scope for This 16-Week Sprint

The following work areas are intentionally deferred until after Sprint 5 completes:

- **App Store + Play Store Submissions** — Capacitor packaging + Apple/Google review (~3-4 week mini-sprint after Sprint 5)
- **Marketing & Landing Pages** — full marketing site, pricing page, blog
- **Marketplace** — backend API, UI, publishing flow, public app gallery, social features
- **Content Moderation** — automated content scanning, abuse reporting, takedown flows
- **Custom Domains** — user-owned domain mapping for published apps
- **Rating & Review System** — for marketplace apps
- **Creator Profiles** — public creator pages
- **Cloud Data Sync for Apps** — cross-device sync for end users of generated apps (handled by user's Convex once published)
- **API Integrations** — third-party service connections (Slack, Notion, Zapier, etc.)
- **iOS Shortcuts Integration** — Siri shortcuts for installed PWAs
- **Public Beta Launch** — Product Hunt, Indie Hackers public posts

These will be re-planned and prioritized in fresh sprints after the builder excellence work lands and beta feedback is collected.
