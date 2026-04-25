// Appio-internal Convex functions — only callable via `npx convex run` with a deploy key.
// Never export these via public query/mutation/action; Convex enforces the internal boundary.

import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

// Read rows for a given tenantId from a given table, using cursor-based pagination.
// Called on the SANDBOX deployment with the sandbox deploy key.
export const exportTenantRows = internalQuery({
  args: {
    tenantId: v.string(),
    tableName: v.string(),
    cursor: v.union(v.string(), v.null()),   // null on first call
    numItems: v.number(),                     // recommend 500
  },
  handler: async (ctx, { tenantId, tableName, cursor, numItems }) => {
    // ctx.db.query requires a literal table name at compile time; `as any` is
    // required here because tableName is dynamic. The caller is the Python
    // orchestrator — it has already validated tableName against schema.ts.
    const result = await (ctx.db.query(tableName as any) as any)
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .paginate({ cursor, numItems });
    return {
      rows: result.page,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// Count rows for a tenantId in a given table (used for verification after migration).
export const countTenantRows = internalQuery({
  args: { tenantId: v.string(), tableName: v.string() },
  handler: async (ctx, { tenantId, tableName }) => {
    // ctx.db.query `as any` — dynamic table name; see exportTenantRows comment.
    const rows = await (ctx.db.query(tableName as any) as any)
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect();
    return { count: rows.length };
  },
});

// Bulk-insert pre-shaped rows into the scratch deployment.
// Called on the SCRATCH deployment with the scratch deploy key.
// Strips _id and _creationTime before insert so Convex auto-generates them.
// expectedTenantId is an independent defence-in-depth check: rejects any row
// whose tenantId doesn't match, so a symmetric bug in exportTenantRows cannot
// silently deliver another tenant's data.
export const bulkInsert = internalMutation({
  args: {
    tableName: v.string(),
    expectedTenantId: v.string(),      // NEW — defence in depth
    rows: v.array(v.any()),
  },
  handler: async (ctx, { tableName, expectedTenantId, rows }) => {
    let inserted = 0;
    for (const row of rows) {
      const r = row as any;
      if (r.tenantId !== expectedTenantId) {
        // Defence-in-depth: a symmetric bug in exportTenantRows cannot reach
        // here without mismatched tenantIds. Fail loudly.
        throw new Error(
          `tenantId mismatch in bulkInsert: row has '${r.tenantId}' ` +
          `but expected '${expectedTenantId}'`
        );
      }
      // Strip system fields — Convex rejects _id and _creationTime on insert.
      const { _id, _creationTime, ...fields } = r;
      // ctx.db.insert `as any` — dynamic table name; see exportTenantRows comment.
      await (ctx.db as any).insert(tableName, fields);
      inserted++;
    }
    return { inserted };
  },
});

// Count all rows in a given table (post-migration verification on scratch).
export const countAllRows = internalQuery({
  args: { tableName: v.string() },
  handler: async (ctx, { tableName }) => {
    // ctx.db.query `as any` — dynamic table name; see exportTenantRows comment.
    const rows = await (ctx.db.query(tableName as any) as any).collect();
    return { count: rows.length };
  },
});
