// Mutation audit log for the T2.3 mobile validation harness.
//
// Every Convex mutation invoked from the app (create/toggle/delete) is
// stamped into a Zustand store with a queuedAt timestamp and an
// `ackedAt` slot we fill once the server confirms the write (Convex
// returns a Promise from `useMutation` that resolves after server
// commit). If `ackedAt` never lands but the device shows the row in
// `listTasks`, the mutation succeeded out-of-band — also useful signal.
//
// This is **instrumentation, not a production write queue.** Convex's
// own client buffers mutations during disconnect and replays on
// reconnect (one of the things T2.3 is here to verify). The audit log
// lets us prove or disprove that behaviour empirically by diffing the
// log against the server state after a scenario completes.
//
// On top of the audit, we attach `withOptimisticUpdate` to each
// mutation so the UI mutates immediately — closer to the offline UX a
// user would expect, and it isolates "did the optimistic patch render
// instantly" from "did the server eventually accept it" as separate
// observables.

import { useCallback } from "react";
import { create } from "zustand";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

export type AuditEntry = {
  /** Stable id we generate before the mutation fires. */
  localId: string;
  kind: "create" | "toggle" | "delete";
  /** Human-readable label for the overlay. */
  label: string;
  /** Convex doc id once we know it. For create() that's only post-ack. */
  serverId: Id<"tasks"> | null;
  queuedAt: number;
  ackedAt: number | null;
  errorAt: number | null;
  errorMessage: string | null;
};

type AuditStore = {
  entries: AuditEntry[];
};

const STORAGE_KEY = "appio:t2.3:mutation-audit";

export const useAuditStore = create<AuditStore>(() => ({ entries: [] }));

// Hydrate once on module load — survives WebView reloads on iOS/Android
// where the JS context can be torn down on background.
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    const parsed = JSON.parse(raw) as { entries?: AuditEntry[] };
    if (Array.isArray(parsed.entries)) {
      useAuditStore.setState({ entries: parsed.entries });
    }
  }
} catch {
  // localStorage unavailable — that's fine, we just lose history on reload.
}

function persist(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(useAuditStore.getState()),
    );
  } catch {
    // ignore
  }
}

function appendEntry(entry: AuditEntry): void {
  useAuditStore.setState((s) => ({ entries: [...s.entries, entry] }));
  persist();
}

function patchEntry(localId: string, patch: Partial<AuditEntry>): void {
  useAuditStore.setState((s) => ({
    entries: s.entries.map((e) =>
      e.localId === localId ? { ...e, ...patch } : e,
    ),
  }));
  persist();
}

function nextLocalId(): string {
  // Cryptographic randomness isn't required — uniqueness within a
  // session is enough. Fall back to time + random for older WebViews.
  const cryptoObj =
    typeof crypto !== "undefined"
      ? (crypto as Crypto & { randomUUID?: () => string })
      : null;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Audited mutation hooks. Each returns the same Promise shape as the raw
// useMutation so callers get the natural error path.
// ---------------------------------------------------------------------------

export function useAuditedCreateTask(): (title: string) => Promise<void> {
  const create = useMutation(api.tasks.createTask).withOptimisticUpdate(
    (store, { title }) => {
      const list = store.getQuery(api.tasks.listTasks, {});
      if (list === undefined) return;
      const optimistic: Doc<"tasks"> = {
        _id: `optimistic-${nextLocalId()}` as unknown as Id<"tasks">,
        _creationTime: Date.now(),
        tenantId: "__optimistic__",
        title,
        completed: false,
        createdAt: Date.now(),
      };
      store.setQuery(api.tasks.listTasks, {}, [optimistic, ...list]);
    },
  );

  return useCallback(
    async (title: string) => {
      const localId = nextLocalId();
      appendEntry({
        localId,
        kind: "create",
        label: `create "${title}"`,
        serverId: null,
        queuedAt: Date.now(),
        ackedAt: null,
        errorAt: null,
        errorMessage: null,
      });
      try {
        const serverId = await create({ title });
        patchEntry(localId, {
          serverId: serverId as Id<"tasks">,
          ackedAt: Date.now(),
        });
      } catch (err) {
        patchEntry(localId, {
          errorAt: Date.now(),
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    [create],
  );
}

export function useAuditedToggleTask(): (id: Id<"tasks">) => Promise<void> {
  const toggle = useMutation(api.tasks.toggleTask).withOptimisticUpdate(
    (store, { id }) => {
      const list = store.getQuery(api.tasks.listTasks, {});
      if (list === undefined) return;
      store.setQuery(
        api.tasks.listTasks,
        {},
        list.map((task) =>
          task._id === id ? { ...task, completed: !task.completed } : task,
        ),
      );
    },
  );

  return useCallback(
    async (id: Id<"tasks">) => {
      const localId = nextLocalId();
      appendEntry({
        localId,
        kind: "toggle",
        label: `toggle ${id}`,
        serverId: id,
        queuedAt: Date.now(),
        ackedAt: null,
        errorAt: null,
        errorMessage: null,
      });
      try {
        await toggle({ id });
        patchEntry(localId, { ackedAt: Date.now() });
      } catch (err) {
        patchEntry(localId, {
          errorAt: Date.now(),
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    [toggle],
  );
}

export function useAuditedDeleteTask(): (id: Id<"tasks">) => Promise<void> {
  const remove = useMutation(api.tasks.deleteTask).withOptimisticUpdate(
    (store, { id }) => {
      const list = store.getQuery(api.tasks.listTasks, {});
      if (list === undefined) return;
      store.setQuery(
        api.tasks.listTasks,
        {},
        list.filter((task) => task._id !== id),
      );
    },
  );

  return useCallback(
    async (id: Id<"tasks">) => {
      const localId = nextLocalId();
      appendEntry({
        localId,
        kind: "delete",
        label: `delete ${id}`,
        serverId: id,
        queuedAt: Date.now(),
        ackedAt: null,
        errorAt: null,
        errorMessage: null,
      });
      try {
        await remove({ id });
        patchEntry(localId, { ackedAt: Date.now() });
      } catch (err) {
        patchEntry(localId, {
          errorAt: Date.now(),
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    [remove],
  );
}

// ---------------------------------------------------------------------------
// Export helpers for the overlay / runbook.
// ---------------------------------------------------------------------------

export function clearAuditLog(): void {
  useAuditStore.setState({ entries: [] });
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function exportAuditLog(): string {
  const { entries } = useAuditStore.getState();
  const pending = entries.filter((e) => e.ackedAt === null && e.errorAt === null);
  const acked = entries.filter((e) => e.ackedAt !== null);
  const failed = entries.filter((e) => e.errorAt !== null);
  const ackLatencies = acked
    .map((e) => (e.ackedAt as number) - e.queuedAt)
    .sort((a, b) => a - b);
  const median =
    ackLatencies.length === 0
      ? null
      : ackLatencies[Math.floor(ackLatencies.length / 2)];
  return JSON.stringify(
    {
      generatedAt: Date.now(),
      totals: {
        all: entries.length,
        acked: acked.length,
        pending: pending.length,
        failed: failed.length,
      },
      ackLatencyMs: {
        median,
        max: ackLatencies[ackLatencies.length - 1] ?? null,
      },
      entries,
    },
    null,
    2,
  );
}
