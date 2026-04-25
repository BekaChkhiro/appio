// Reference implementation of tenant-isolated queries + mutations.
// Generated apps may copy this pattern.

import { v } from "convex/values";
import {
  tenantQuery,
  tenantMutation,
} from "./_helpers";

export const list = tenantQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("items")
      .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenantId))
      .order("desc")
      .collect(),
});

export const listOpen = tenantQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("items")
      .withIndex("by_tenant_and_completed", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("completed", false),
      )
      .collect(),
});

export const create = tenantMutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) =>
    ctx.db.insert("items", {
      tenantId: ctx.tenantId,
      title,
      completed: false,
      createdAt: Date.now(),
    }),
});

export const toggle = tenantMutation({
  args: { id: v.id("items") },
  handler: async (ctx, { id }) => {
    // Direct .get() by ID is allowed — IDs are opaque/unguessable. We still
    // verify ownership before mutating to defend against reused IDs.
    const item = await ctx.db.get(id);
    if (item === null) throw new Error("not found");
    if (item.tenantId !== ctx.tenantId) throw new Error("not authorised");
    await ctx.db.patch(id, { completed: !item.completed });
  },
});

export const remove = tenantMutation({
  args: { id: v.id("items") },
  handler: async (ctx, { id }) => {
    const item = await ctx.db.get(id);
    if (item === null) return;
    if (item.tenantId !== ctx.tenantId) throw new Error("not authorised");
    await ctx.db.delete(id);
  },
});
