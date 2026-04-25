// Convex schema for the habit-tracker template — see docs/adr/001-convex-tenant-isolation.md
//
// EVERY multi-tenant table must:
//   1. Declare `tenantId: v.string()` (= Firebase uid).
//   2. Define an index whose name starts with `by_tenant`.
//   3. Be queried via `.withIndex("by_tenant…", q => q.eq("tenantId", ctx.tenantId))`.

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  habits: defineTable({
    tenantId: v.string(),
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    // "daily" | "weekdays" | "weekends" | "custom"
    frequency: v.string(),
    createdAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  completions: defineTable({
    tenantId: v.string(),
    habitId: v.id("habits"),
    // ISO date key YYYY-MM-DD — lets us query a single day without timezone ambiguity.
    date: v.string(),
    completed: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_and_habit", ["tenantId", "habitId"])
    .index("by_tenant_habit_date", ["tenantId", "habitId", "date"])
    .index("by_tenant_and_date", ["tenantId", "date"]),
});
