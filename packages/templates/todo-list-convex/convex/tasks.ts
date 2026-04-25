// Task operations for the todo-list-convex template.
//
// All five operations are tenant-scoped. tenantQuery / tenantMutation
// (from _helpers.ts, provided by the base template at build time) resolve
// ctx.tenantId from the Firebase identity so handlers can focus on the
// data. See docs/adr/001-convex-tenant-isolation.md for the required
// query pattern and the pre-build scanner rules it enforces.

import { v } from "convex/values";
import { tenantQuery, tenantMutation } from "./_helpers";

export const listTasks = tenantQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("tasks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenantId))
      .order("desc")
      .collect(),
});

export const getTask = tenantQuery({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    // Direct `.get()` by id is allowed (ids are opaque/unguessable). We
    // still verify tenant ownership so a leaked id can't be dereferenced
    // cross-tenant.
    const task = await ctx.db.get(id);
    if (task === null) return null;
    if (task.tenantId !== ctx.tenantId) return null;
    return task;
  },
});

export const createTask = tenantMutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    const trimmed = String(title).trim();
    if (trimmed.length === 0) throw new Error("title is required");
    if (trimmed.length > 280) throw new Error("title too long");
    return ctx.db.insert("tasks", {
      tenantId: ctx.tenantId,
      title: trimmed,
      completed: false,
      createdAt: Date.now(),
    });
  },
});

export const toggleTask = tenantMutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const task = await ctx.db.get(id);
    if (task === null) throw new Error("not found");
    if (task.tenantId !== ctx.tenantId) throw new Error("not authorised");
    await ctx.db.patch(id, { completed: !task.completed });
  },
});

export const deleteTask = tenantMutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const task = await ctx.db.get(id);
    if (task === null) return;
    if (task.tenantId !== ctx.tenantId) throw new Error("not authorised");
    await ctx.db.delete(id);
  },
});
