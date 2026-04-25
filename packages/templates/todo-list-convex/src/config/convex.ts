// Convex deployment URL + mode for this app.
//
// Drafts/previews point at the Appio shared sandbox deployment
// (tenant-isolated by Firebase uid per ADR 001). On publish, the user's
// OAuth flow replaces this file: `CONVEX_URL` is repointed at the user's
// own deployment and `CONVEX_MODE` flips to `"published"`. Consumers read
// the mode via `useConvexMode()` from `@appio/ui/hooks`.

import type { ConvexMode } from "@appio/ui/hooks";

export const CONVEX_URL =
  "https://adventurous-corgi-465.eu-west-1.convex.cloud";

export const CONVEX_MODE: ConvexMode = "sandbox";
