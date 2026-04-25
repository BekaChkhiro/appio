// Completion operations for the habit-tracker template.
// All handlers tenant-scoped via tenantQuery / tenantMutation (see base/convex/_helpers.ts).
// `date` is always a YYYY-MM-DD string — the client is responsible for computing it
// in the user's local timezone so "today" means what the user expects.

import { v } from "convex/values";
import { tenantQuery, tenantMutation } from "./_helpers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertValidDate(date: string): void {
  if (!DATE_RE.test(date)) throw new Error("date must be YYYY-MM-DD");
}

export const listCompletionsByHabit = tenantQuery({
  args: { habitId: v.id("habits") },
  handler: async (ctx, { habitId }) =>
    ctx.db
      .query("completions")
      .withIndex("by_tenant_and_habit", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("habitId", habitId),
      )
      .order("desc")
      .collect(),
});

export const listCompletionsByDate = tenantQuery({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    assertValidDate(date);
    return ctx.db
      .query("completions")
      .withIndex("by_tenant_and_date", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("date", date),
      )
      .collect();
  },
});

export const toggleCompletion = tenantMutation({
  args: { habitId: v.id("habits"), date: v.string() },
  handler: async (ctx, { habitId, date }) => {
    assertValidDate(date);
    const habit = await ctx.db.get(habitId);
    if (habit === null || habit.tenantId !== ctx.tenantId) {
      throw new Error("habit not found");
    }
    const existing = await ctx.db
      .query("completions")
      .withIndex("by_tenant_habit_date", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("habitId", habitId).eq("date", date),
      )
      .unique();
    if (existing === null) {
      return ctx.db.insert("completions", {
        tenantId: ctx.tenantId,
        habitId,
        date,
        completed: true,
        createdAt: Date.now(),
      });
    }
    await ctx.db.patch(existing._id, { completed: !existing.completed });
    return existing._id;
  },
});
