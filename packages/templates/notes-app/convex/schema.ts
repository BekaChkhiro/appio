// Convex schema for the notes-app template — see docs/adr/001-convex-tenant-isolation.md
//
// EVERY multi-tenant table must:
//   1. Declare `tenantId: v.string()` (= Firebase uid).
//   2. Define an index whose name starts with `by_tenant`.
//   3. Be queried via `.withIndex("by_tenant…", q => q.eq("tenantId", ctx.tenantId))`.

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  folders: defineTable({
    tenantId: v.string(),
    name: v.string(),
    color: v.string(),
    createdAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  notes: defineTable({
    tenantId: v.string(),
    title: v.string(),
    content: v.string(),
    folderId: v.optional(v.id("folders")),
    pinned: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_and_pinned", ["tenantId", "pinned"])
    .index("by_tenant_and_folder", ["tenantId", "folderId"]),
});
