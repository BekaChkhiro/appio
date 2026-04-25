import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

type AnyQueryRef = FunctionReference<"query">;
type AnyMutationRef = FunctionReference<"mutation">;

type QueryResult<Q extends AnyQueryRef> = FunctionReturnType<Q>;

type MutationCaller<M extends AnyMutationRef | undefined> =
  M extends AnyMutationRef
    ? (args: FunctionArgs<M>) => Promise<FunctionReturnType<M>>
    : undefined;

export type UseCollectionConfig<
  Q extends AnyQueryRef,
  Add extends AnyMutationRef | undefined = undefined,
  Update extends AnyMutationRef | undefined = undefined,
  Remove extends AnyMutationRef | undefined = undefined,
> = {
  list: Q;
  listArgs?: FunctionArgs<Q>;
  skip?: boolean;
  mutations?: {
    add?: Add;
    update?: Update;
    remove?: Remove;
  };
};

export type UseCollectionReturn<
  Q extends AnyQueryRef,
  Add extends AnyMutationRef | undefined,
  Update extends AnyMutationRef | undefined,
  Remove extends AnyMutationRef | undefined,
> = {
  data: QueryResult<Q> | undefined;
  loading: boolean;
  add: MutationCaller<Add>;
  update: MutationCaller<Update>;
  remove: MutationCaller<Remove>;
};

/**
 * Reactive wrapper around a Convex list query plus its CRUD mutations.
 *
 * Backs T3.1 — the single entry point agent-generated apps use to read a
 * tenant-scoped collection. `list` is a typed Convex function reference
 * (e.g. `api.tasks.listTasks`), so type inference carries through to
 * `data`. Mutations are optional; pass only the ones the view needs.
 *
 * The hook never attaches an optimistic-update envelope itself — callers
 * that want optimistic UI should use `useMutation(ref).withOptimisticUpdate`
 * directly (the audited-mutation pattern in the todo-list-convex template
 * is the reference implementation).
 *
 * Sandbox vs. published routing is handled upstream by the template's
 * `ConvexClientProvider` — the hook just consumes whichever client is in
 * context. For UI that needs to display the active mode, use the
 * separate `useConvexMode` hook.
 *
 * ```tsx
 * const { data, loading, add, remove } = useCollection({
 *   list: api.tasks.listTasks,
 *   mutations: {
 *     add: api.tasks.createTask,
 *     remove: api.tasks.deleteTask,
 *   },
 * });
 * ```
 */
export function useCollection<
  Q extends AnyQueryRef,
  Add extends AnyMutationRef | undefined = undefined,
  Update extends AnyMutationRef | undefined = undefined,
  Remove extends AnyMutationRef | undefined = undefined,
>(
  config: UseCollectionConfig<Q, Add, Update, Remove>,
): UseCollectionReturn<Q, Add, Update, Remove> {
  const { list, listArgs, skip, mutations } = config;

  // Convex `useQuery` treats the sentinel string "skip" as "don't fetch".
  // We pass the raw args when active and the sentinel when paused.
  //
  // When `listArgs` is omitted, we pass `{}`. Callers supplying a query
  // whose args type requires fields will see the type error at the
  // `useCollection({ list })` call site (because `listArgs` becomes
  // required); callers on zero-arg queries get the ergonomic no-arg
  // default. This is intentional — it mirrors `useQuery(ref)` without
  // args for zero-arg Convex queries.
  const queryArgs = (skip === true ? "skip" : (listArgs ?? {})) as
    | FunctionArgs<Q>
    | "skip";
  const data = useQuery(list, queryArgs) as QueryResult<Q> | undefined;

  // Rules of Hooks forbids a conditional `useMutation`, so we register
  // a caller for every slot every render. Slots the consumer left
  // unconfigured fall back to the `list` ref as a placeholder — we
  // surface `undefined` for those slots in the return value below, so
  // the placeholder closure is never invoked. `useMutation` as shipped
  // in convex@^1.35 builds a closure that only validates the ref kind
  // when the caller fires, which keeps this pattern runtime-safe.
  //
  // UPGRADE POLICY: if a future Convex release validates the ref kind
  // eagerly inside `useMutation` itself, this pattern breaks and every
  // consumer omitting a slot would throw at render. Pin the peer range
  // floor to a tested minor (see package.json `peerDependencies.convex`)
  // and re-verify this behaviour whenever the floor moves.
  const addMutation = useMutation(
    (mutations?.add ?? list) as AnyMutationRef,
  );
  const updateMutation = useMutation(
    (mutations?.update ?? list) as AnyMutationRef,
  );
  const removeMutation = useMutation(
    (mutations?.remove ?? list) as AnyMutationRef,
  );

  const add = useCallback(
    (args: unknown) => addMutation(args as never),
    [addMutation],
  );
  const update = useCallback(
    (args: unknown) => updateMutation(args as never),
    [updateMutation],
  );
  const remove = useCallback(
    (args: unknown) => removeMutation(args as never),
    [removeMutation],
  );

  // Return `undefined` slots for mutations the caller didn't configure so
  // the narrowed type from `MutationCaller<M>` matches runtime behaviour.
  return useMemo(
    () =>
      ({
        data,
        loading: data === undefined && skip !== true,
        add: (mutations?.add !== undefined ? add : undefined) as MutationCaller<Add>,
        update: (mutations?.update !== undefined
          ? update
          : undefined) as MutationCaller<Update>,
        remove: (mutations?.remove !== undefined
          ? remove
          : undefined) as MutationCaller<Remove>,
      }),
    [data, skip, mutations?.add, mutations?.update, mutations?.remove, add, update, remove],
  );
}
