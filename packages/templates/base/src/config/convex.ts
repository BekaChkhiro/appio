// Convex deployment URL + mode for this app.
//
// Drafts/previews point at the Appio shared sandbox (tenant-isolated by
// Firebase uid — see docs/adr/001-convex-tenant-isolation.md). On publish
// (T3.6), the user's OAuth flow rewrites this file: `CONVEX_URL` is
// repointed at the user's own deployment and `CONVEX_MODE` flips to
// `"published"`. Consumers can read the mode via `useConvexMode()` from
// `@appio/ui/hooks` — useful for UI badges that surface "Preview" state.

import type { ConvexMode } from "@appio/ui/hooks";

export const CONVEX_URL =
  "https://adventurous-corgi-465.eu-west-1.convex.cloud";

export const CONVEX_MODE: ConvexMode = "sandbox";
