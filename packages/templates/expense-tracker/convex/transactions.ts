// Transaction operations for the expense-tracker template.
// All handlers tenant-scoped via tenantQuery / tenantMutation (see base/convex/_helpers.ts).

import { v } from "convex/values";
import { tenantQuery, tenantMutation } from "./_helpers";

const TXN_TYPE = v.union(v.literal("income"), v.literal("expense"));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertValidDate(date: string): void {
  if (!DATE_RE.test(date)) throw new Error("date must be YYYY-MM-DD");
}

function assertFiniteAmount(amount: number): void {
  if (!Number.isFinite(amount)) throw new Error("amount must be a finite number");
  if (amount < 0) throw new Error("amount must be non-negative (type determines sign)");
}

export const listTransactions = tenantQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("transactions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenantId))
      .order("desc")
      .collect(),
});

export const listByType = tenantQuery({
  args: { type: TXN_TYPE },
  handler: async (ctx, { type }) =>
    ctx.db
      .query("transactions")
      .withIndex("by_tenant_and_type", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("type", type),
      )
      .order("desc")
      .collect(),
});

export const listByCategory = tenantQuery({
  args: { category: v.string() },
  handler: async (ctx, { category }) =>
    ctx.db
      .query("transactions")
      .withIndex("by_tenant_and_category", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("category", category),
      )
      .order("desc")
      .collect(),
});

export const listByDateRange = tenantQuery({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { startDate, endDate }) => {
    assertValidDate(startDate);
    assertValidDate(endDate);
    return ctx.db
      .query("transactions")
      .withIndex("by_tenant_and_date", (q) =>
        q.eq("tenantId", ctx.tenantId).gte("date", startDate).lte("date", endDate),
      )
      .order("desc")
      .collect();
  },
});

export const getTransaction = tenantQuery({
  args: { id: v.id("transactions") },
  handler: async (ctx, { id }) => {
    const txn = await ctx.db.get(id);
    if (txn === null) return null;
    if (txn.tenantId !== ctx.tenantId) return null;
    return txn;
  },
});

export const createTransaction = tenantMutation({
  args: {
    amount: v.number(),
    description: v.string(),
    category: v.string(),
    type: TXN_TYPE,
    date: v.string(),
  },
  handler: async (ctx, { amount, description, category, type, date }) => {
    assertFiniteAmount(amount);
    assertValidDate(date);
    const trimmedDesc = String(description).trim();
    if (trimmedDesc.length > 500) throw new Error("description too long");
    const trimmedCat = String(category).trim();
    if (trimmedCat.length === 0) throw new Error("category is required");
    if (trimmedCat.length > 80) throw new Error("category too long");
    return ctx.db.insert("transactions", {
      tenantId: ctx.tenantId,
      amount,
      description: trimmedDesc,
      category: trimmedCat,
      type,
      date,
      createdAt: Date.now(),
    });
  },
});

export const updateTransaction = tenantMutation({
  args: {
    id: v.id("transactions"),
    amount: v.optional(v.number()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    type: v.optional(TXN_TYPE),
    date: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const txn = await ctx.db.get(id);
    if (txn === null) throw new Error("not found");
    if (txn.tenantId !== ctx.tenantId) throw new Error("not authorised");
    const next: Record<string, unknown> = {};
    if (patch.amount !== undefined) {
      assertFiniteAmount(patch.amount);
      next.amount = patch.amount;
    }
    if (patch.description !== undefined) {
      const trimmed = String(patch.description).trim();
      if (trimmed.length > 500) throw new Error("description too long");
      next.description = trimmed;
    }
    if (patch.category !== undefined) {
      const trimmed = String(patch.category).trim();
      if (trimmed.length === 0) throw new Error("category is required");
      if (trimmed.length > 80) throw new Error("category too long");
      next.category = trimmed;
    }
    if (patch.type !== undefined) next.type = patch.type;
    if (patch.date !== undefined) {
      assertValidDate(patch.date);
      next.date = patch.date;
    }
    await ctx.db.patch(id, next);
  },
});

export const deleteTransaction = tenantMutation({
  args: { id: v.id("transactions") },
  handler: async (ctx, { id }) => {
    const txn = await ctx.db.get(id);
    if (txn === null) return;
    if (txn.tenantId !== ctx.tenantId) throw new Error("not authorised");
    await ctx.db.delete(id);
  },
});
