// Convex schema for the base template — see docs/adr/001-convex-tenant-isolation.md
//
// EVERY multi-tenant table must:
//   1. Declare `tenantId: v.string()` (= Firebase uid).
//   2. Define an index whose name starts with `by_tenant`.
//   3. Be queried via `.withIndex("by_tenant…", q => q.eq("tenantId", ctx.tenantId))`.
//
// The pre-build scanner rejects any `ctx.db.query(...)` chain that does not
// satisfy rule 3, so forgetting tenancy is a build-time error.

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Example multi-tenant table. Generated apps replace / extend this with
  // their own tables; the rules above still apply.
  items: defineTable({
    tenantId: v.string(),
    title: v.string(),
    completed: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_and_completed", ["tenantId", "completed"]),
});
