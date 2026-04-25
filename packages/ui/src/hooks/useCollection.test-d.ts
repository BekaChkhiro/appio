/**
 * Compile-time contract tests for `useCollection`.
 *
 * This file is intentionally not executed at runtime. It rides the existing
 * `tsc --noEmit` gate. A `// @ts-expect-error` marker that stops producing a
 * type error will itself become a tsc error, so every negative assertion is
 * self-verifying.
 *
 * No Convex app code is imported. Phantom refs are constructed inline with
 * `{} as FunctionReference<...>` so the tests are hermetic.
 */

import type { FunctionReference } from "convex/server";
import { useCollection } from "./useCollection";

// ---------------------------------------------------------------------------
// Phantom ref helpers — typed stubs with no runtime presence.
// ---------------------------------------------------------------------------

type Task = { _id: string; title: string };

/** A query that takes no args and returns Task[]. */
const listTasks = {} as FunctionReference<"query", "public", Record<string, never>, Task[]>;

/** A query that requires { limit: number }. */
const listPaged = {} as FunctionReference<"query", "public", { limit: number }, Task[]>;

/** A mutation whose only arg is { title: string }. */
const createTask = {} as FunctionReference<"mutation", "public", { title: string }, string>;

/** A mutation whose only arg is { id: string }. */
const deleteTask = {} as FunctionReference<"mutation", "public", { id: string }, null>;

/** A mutation whose only arg is { id: string; title: string }. */
const updateTask = {} as FunctionReference<
  "mutation",
  "public",
  { id: string; title: string },
  null
>;

// ---------------------------------------------------------------------------
// Assertion 1 — Basic list-only call
//   `add`, `update`, and `remove` must be `undefined` when no mutations are
//   configured; `data` must be `Task[] | undefined`.
// ---------------------------------------------------------------------------
{
  const result = useCollection({ list: listTasks });

  // Positive: shape matches the expected return type.
  result satisfies {
    data: Task[] | undefined;
    loading: boolean;
    add: undefined;
    update: undefined;
    remove: undefined;
  };
}

// ---------------------------------------------------------------------------
// Assertion 2 — `data` inference narrowing
//   The return type of the query ref propagates all the way to `data`.
// ---------------------------------------------------------------------------
{
  const result = useCollection({ list: listTasks });

  // `data` must be Task[] | undefined, not `any` or `unknown`.
  const d: Task[] | undefined = result.data;
  void d;
}

// ---------------------------------------------------------------------------
// Assertion 3 — `listArgs` enforcement
//   Correct args shape compiles; wrong type for a known arg is a type error.
// ---------------------------------------------------------------------------
{
  // Positive: correct args type is accepted.
  useCollection({ list: listPaged, listArgs: { limit: 10 } });

  // Negative: wrong type for `limit` must be rejected.
  // @ts-expect-error — `limit` must be number, not string.
  useCollection({ list: listPaged, listArgs: { limit: "ten" } });
}

// ---------------------------------------------------------------------------
// Assertion 4 — Mutation slots narrow correctly
//   When a mutation is provided the slot is callable; when omitted it is
//   `undefined`.
// ---------------------------------------------------------------------------
{
  const withAdd = useCollection({
    list: listTasks,
    mutations: { add: createTask },
  });

  // `add` is callable when configured.
  withAdd satisfies { add: (args: { title: string }) => Promise<string> };

  // `update` and `remove` remain `undefined`.
  withAdd satisfies { update: undefined; remove: undefined };
}

// ---------------------------------------------------------------------------
// Assertion 5 — Mutation arg inference
//   Calling `add` with the correct args compiles; wrong arg type is an error.
// ---------------------------------------------------------------------------
{
  const { add, update, remove } = useCollection({
    list: listTasks,
    mutations: {
      add: createTask,
      update: updateTask,
      remove: deleteTask,
    },
  });

  // Positive: correct arg shapes.
  void add({ title: "Buy milk" });
  void update({ id: "abc", title: "Updated" });
  void remove({ id: "abc" });

  // Negative: wrong type for `add`'s `title` argument.
  // @ts-expect-error — `title` must be string, not number.
  void add({ title: 42 });
}

// ---------------------------------------------------------------------------
// Assertion 6 — `skip` is an optional boolean
//   `skip: true` is accepted; `skip: "yes"` is a type error.
// ---------------------------------------------------------------------------
{
  // Positive: boolean value is accepted.
  useCollection({ list: listTasks, skip: true });
  useCollection({ list: listTasks, skip: false });

  // Negative: string is not assignable to `boolean | undefined`.
  // @ts-expect-error — `skip` must be boolean, not string.
  useCollection({ list: listTasks, skip: "yes" });
}
