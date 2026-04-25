// Habit operations for the habit-tracker template.
// All handlers tenant-scoped via tenantQuery / tenantMutation (see base/convex/_helpers.ts).

import { v } from "convex/values";
import { tenantQuery, tenantMutation } from "./_helpers";

const FREQUENCIES = new Set(["daily", "weekdays", "weekends", "custom"]);

export const listHabits = tenantQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("habits")
      .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenantId))
      .order("desc")
      .collect(),
});

export const getHabit = tenantQuery({
  args: { id: v.id("habits") },
  handler: async (ctx, { id }) => {
    const habit = await ctx.db.get(id);
    if (habit === null) return null;
    if (habit.tenantId !== ctx.tenantId) return null;
    return habit;
  },
});

export const createHabit = tenantMutation({
  args: {
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    frequency: v.string(),
  },
  handler: async (ctx, { name, icon, color, frequency }) => {
    const trimmedName = String(name).trim();
    if (trimmedName.length === 0) throw new Error("habit name is required");
    if (trimmedName.length > 120) throw new Error("habit name too long");
    if (!FREQUENCIES.has(frequency)) throw new Error("invalid frequency");
    return ctx.db.insert("habits", {
      tenantId: ctx.tenantId,
      name: trimmedName,
      icon,
      color,
      frequency,
      createdAt: Date.now(),
    });
  },
});

export const deleteHabit = tenantMutation({
  args: { id: v.id("habits") },
  handler: async (ctx, { id }) => {
    const habit = await ctx.db.get(id);
    if (habit === null) return;
    if (habit.tenantId !== ctx.tenantId) throw new Error("not authorised");
    // Cascade-delete completions — streaks without a habit are meaningless.
    const linked = await ctx.db
      .query("completions")
      .withIndex("by_tenant_and_habit", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("habitId", id),
      )
      .collect();
    for (const c of linked) await ctx.db.delete(c._id);
    await ctx.db.delete(id);
  },
});
