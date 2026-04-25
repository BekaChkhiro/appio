// Convex schema for the expense-tracker template — see docs/adr/001-convex-tenant-isolation.md
//
// EVERY multi-tenant table must:
//   1. Declare `tenantId: v.string()` (= Firebase uid).
//   2. Define an index whose name starts with `by_tenant`.
//   3. Be queried via `.withIndex("by_tenant…", q => q.eq("tenantId", ctx.tenantId))`.

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  transactions: defineTable({
    tenantId: v.string(),
    amount: v.number(),
    description: v.string(),
    category: v.string(),
    type: v.union(v.literal("income"), v.literal("expense")),
    // ISO date key YYYY-MM-DD — supports range queries without timezone ambiguity.
    date: v.string(),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_and_type", ["tenantId", "type"])
    .index("by_tenant_and_category", ["tenantId", "category"])
    .index("by_tenant_and_date", ["tenantId", "date"]),
});
