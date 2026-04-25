// Convex schema for the todo-list-convex template.
//
// Follows docs/adr/001-convex-tenant-isolation.md: every row carries a
// `tenantId` (= Firebase uid) and every query is forced through a
// `by_tenant…` index at the pre-build scanner layer.

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    tenantId: v.string(),
    title: v.string(),
    completed: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_and_completed", ["tenantId", "completed"]),
});
