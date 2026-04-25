// Tenant-aware Convex helpers — see docs/adr/001-convex-tenant-isolation.md
//
// Wrap query/mutation/action handlers so that the Firebase identity is
// resolved exactly once and the tenant id is exposed on `ctx.tenantId`.
// Inside the handler, all `ctx.db.query(...)` chains MUST still call
// `.withIndex("by_tenant…", q => q.eq("tenantId", ctx.tenantId))` — the
// pre-build scanner enforces this.

import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  action,
} from "./_generated/server";
import type {
  QueryCtx,
  MutationCtx,
  ActionCtx,
} from "./_generated/server";

export type TenantQueryCtx = QueryCtx & { tenantId: string };
export type TenantMutationCtx = MutationCtx & { tenantId: string };
export type TenantActionCtx = ActionCtx & { tenantId: string };

class NotAuthenticatedError extends Error {
  constructor() {
    super("not authenticated");
    this.name = "NotAuthenticatedError";
  }
}

async function resolveTenantId(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new NotAuthenticatedError();
  return identity.subject;
}

type AnyValidator = Record<string, ReturnType<typeof v.any>>;

interface HandlerSpec<C, A, R> {
  args?: A;
  handler: (ctx: C, args: ArgsFor<A>) => Promise<R> | R;
}

type ArgsFor<A> = A extends AnyValidator
  ? { [K in keyof A]: unknown }
  : Record<string, never>;

/**
 * `tenantQuery` — like Convex's `query()` but injects `ctx.tenantId`.
 *
 * ```ts
 * export const list = tenantQuery({
 *   args: {},
 *   handler: async (ctx) =>
 *     ctx.db
 *       .query("tasks")
 *       .withIndex("by_tenant", q => q.eq("tenantId", ctx.tenantId))
 *       .collect(),
 * });
 * ```
 */
export function tenantQuery<A extends AnyValidator | undefined, R>(
  spec: HandlerSpec<TenantQueryCtx, A, R>,
) {
  return query({
    args: (spec.args ?? {}) as A extends AnyValidator ? A : Record<string, never>,
    handler: async (ctx, args) => {
      const tenantId = await resolveTenantId(ctx);
      return spec.handler({ ...ctx, tenantId } as TenantQueryCtx, args);
    },
  });
}

export function tenantMutation<A extends AnyValidator | undefined, R>(
  spec: HandlerSpec<TenantMutationCtx, A, R>,
) {
  return mutation({
    args: (spec.args ?? {}) as A extends AnyValidator ? A : Record<string, never>,
    handler: async (ctx, args) => {
      const tenantId = await resolveTenantId(ctx);
      return spec.handler({ ...ctx, tenantId } as TenantMutationCtx, args);
    },
  });
}

export function tenantInternalQuery<A extends AnyValidator | undefined, R>(
  spec: HandlerSpec<TenantQueryCtx, A, R>,
) {
  return internalQuery({
    args: (spec.args ?? {}) as A extends AnyValidator ? A : Record<string, never>,
    handler: async (ctx, args) => {
      const tenantId = await resolveTenantId(ctx);
      return spec.handler({ ...ctx, tenantId } as TenantQueryCtx, args);
    },
  });
}

export function tenantInternalMutation<A extends AnyValidator | undefined, R>(
  spec: HandlerSpec<TenantMutationCtx, A, R>,
) {
  return internalMutation({
    args: (spec.args ?? {}) as A extends AnyValidator ? A : Record<string, never>,
    handler: async (ctx, args) => {
      const tenantId = await resolveTenantId(ctx);
      return spec.handler({ ...ctx, tenantId } as TenantMutationCtx, args);
    },
  });
}

export function tenantAction<A extends AnyValidator | undefined, R>(
  spec: HandlerSpec<TenantActionCtx, A, R>,
) {
  return action({
    args: (spec.args ?? {}) as A extends AnyValidator ? A : Record<string, never>,
    handler: async (ctx, args) => {
      const tenantId = await resolveTenantId(ctx);
      return spec.handler({ ...ctx, tenantId } as TenantActionCtx, args);
    },
  });
}
