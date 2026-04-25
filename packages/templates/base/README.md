# Base Template

Shared files for all PWA templates. These are included in every generated PWA build.

## Files

- `esbuild.config.mjs` — Build script: esbuild + PostCSS/Tailwind plugin, precache manifest generation
- `tailwind.config.js` — Tailwind config with CSS custom property-based theme colors
- `sw.js` — Static service worker template (cache-first strategy, precache manifest injected at build)
- `index.html` — HTML shell with theme CSS variables (placeholders filled by code generator)
- `package.json` — Shared dependencies pre-installed in Docker builder image
- `src/index.tsx` — React entry point (mounts App to #root)
- `src/styles/global.css` — Tailwind CSS import
- `src/ConvexClientProvider.tsx` — Firebase Auth → Convex JWT bridge (T2.4). Convex-backed templates wrap their React root in `<ConvexClientProvider>`; non-Convex apps ignore it. Adapter calls `useAuth().getIdToken()` so every Convex request carries the current Firebase ID token, which `convex/auth.config.ts` validates against Firebase's issuer + project id.
- `src/config/convex.ts` — Default CONVEX_URL pointing at the Appio sandbox deployment. Orchestrator overwrites on publish (T3.6).
- `src/config/firebase.ts` — Firebase config stub. Orchestrator replaces with per-app credentials at generation time.
- `convex/auth.config.ts` — Convex backend auth config. Declares the Firebase issuer (`securetoken.google.com/{project}`) and audience so `ctx.auth.getUserIdentity()` resolves for valid Firebase ID tokens.
- `convex/_helpers.ts` — `tenantQuery` / `tenantMutation` / `tenantAction` wrappers. Derive `ctx.tenantId` from `identity.subject` (see `docs/adr/001-convex-tenant-isolation.md`).
