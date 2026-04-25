import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  serverTimestamp,
  type Firestore,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import type { FirebaseConfig } from "./useAuth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FirestoreDoc<T = DocumentData> = T & { id: string };

export type QueryFilter = {
  field: string;
  op: "<" | "<=" | "==" | "!=" | ">=" | ">" | "array-contains" | "in";
  value: unknown;
};

export type QueryOptions = {
  where?: QueryFilter | QueryFilter[];
  orderBy?: { field: string; direction?: "asc" | "desc" };
  limit?: number;
};

export type UseCollectionReturn<T> = {
  /** Current documents — empty array while loading or on error. */
  data: FirestoreDoc<T>[];
  /** True until the first snapshot arrives. */
  loading: boolean;
  /** Firestore error message, if any. */
  error: string | null;
  /** Add a new document (auto-generated ID). Returns the new doc ID. */
  add: (item: Omit<T, "id">) => Promise<string>;
  /** Overwrite a document by ID (creates if missing). */
  set: (id: string, item: Omit<T, "id">) => Promise<void>;
  /** Merge-update specific fields on a document. */
  update: (id: string, fields: Partial<T>) => Promise<void>;
  /** Delete a document by ID. */
  remove: (id: string) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Module-level singleton — one Firestore instance per app
// ---------------------------------------------------------------------------

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;

function _ensureInit(config: FirebaseConfig): Firestore {
  if (_db) return _db;

  const existing = getApps();
  _app = existing.length > 0 ? existing[0] : initializeApp(config);

  // Initialize Firestore with persistent IndexedDB cache and multi-tab
  // support. Uses the modern Firebase v10+ API (replaces the deprecated
  // enableIndexedDbPersistence). Falls back to getFirestore if the
  // persistent cache init fails (e.g. no IndexedDB support).
  try {
    _db = initializeFirestore(_app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Firestore may already be initialized (e.g. by useAuth's getAuth
    // triggering an internal init). Fall back to the existing instance.
    _db = getFirestore(_app);
  }

  return _db;
}

// ---------------------------------------------------------------------------
// Per-subscription external store
// ---------------------------------------------------------------------------

type SnapshotState<T> = {
  data: FirestoreDoc<T>[];
  loading: boolean;
  error: string | null;
};

function createCollectionStore<T>(
  db: Firestore,
  path: string,
  options?: QueryOptions,
) {
  let state: SnapshotState<T> = { data: [], loading: true, error: null };
  const listeners = new Set<() => void>();
  let destroyed = false;

  function notify() {
    listeners.forEach((l) => l());
  }

  // Build Firestore query from options
  const constraints: QueryConstraint[] = [];

  if (options?.where) {
    const filters = Array.isArray(options.where)
      ? options.where
      : [options.where];
    for (const f of filters) {
      constraints.push(where(f.field, f.op, f.value));
    }
  }
  if (options?.orderBy) {
    constraints.push(
      orderBy(options.orderBy.field, options.orderBy.direction ?? "asc"),
    );
  }
  if (options?.limit) {
    constraints.push(firestoreLimit(options.limit));
  }

  const q = query(collection(db, path), ...constraints);

  // Real-time listener
  const unsub: Unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (destroyed) return;
      state = {
        data: snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as FirestoreDoc<T>),
        loading: false,
        error: null,
      };
      notify();
    },
    (err) => {
      if (destroyed) return;
      state = { ...state, loading: false, error: err.message };
      notify();
    },
  );

  return {
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getSnapshot() {
      return state;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsub();
      listeners.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Real-time Firestore collection hook for generated Appio PWAs.
 *
 * Mirrors the Zustand pattern: returns reactive `data` array plus CRUD
 * methods. Offline-first — reads from IndexedDB cache when offline,
 * syncs when back online.
 *
 * ```tsx
 * import { useCollection } from "./components/ui";
 * import { firebaseConfig } from "./config/firebase";
 *
 * function TaskList({ userId }: { userId: string }) {
 *   const { data: tasks, loading, add, update, remove } = useCollection<Task>(
 *     firebaseConfig,
 *     `users/${userId}/tasks`,
 *   );
 *
 *   if (loading) return <p>Loading...</p>;
 *
 *   return tasks.map((t) => (
 *     <Card key={t.id}>
 *       <p>{t.title}</p>
 *       <Button onClick={() => update(t.id, { done: !t.done })}>Toggle</Button>
 *       <Button onClick={() => remove(t.id)}>Delete</Button>
 *     </Card>
 *   ));
 * }
 * ```
 *
 * @param config - Firebase config (from `src/config/firebase.ts`)
 * @param collectionPath - Firestore collection path (e.g. `users/{uid}/tasks`)
 * @param options - Optional query filters, ordering, and limit
 */
export function useCollection<T = DocumentData>(
  config: FirebaseConfig,
  collectionPath: string,
  options?: QueryOptions,
): UseCollectionReturn<T> {
  const db = _ensureInit(config);

  // Stable key for the subscription — recreate only when path/options change
  const optionsKey = options ? JSON.stringify(options) : "";

  const storeRef = useRef<ReturnType<typeof createCollectionStore<T>> | null>(
    null,
  );

  // Create / recreate store when path or options change
  if (
    !storeRef.current ||
    (storeRef.current as any).__key !== collectionPath + optionsKey
  ) {
    storeRef.current?.destroy();
    const store = createCollectionStore<T>(db, collectionPath, options);
    (store as any).__key = collectionPath + optionsKey;
    storeRef.current = store;
  }

  const store = storeRef.current;

  // Clean up on unmount
  useEffect(() => {
    return () => {
      storeRef.current?.destroy();
      storeRef.current = null;
    };
  }, []);

  // Stable subscribe/getSnapshot references for useSyncExternalStore.
  // The store ref may change when path/options change, so we wrap in
  // callbacks that always read from the current ref.
  const subscribe = useCallback(
    (cb: () => void) => storeRef.current!.subscribe(cb),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collectionPath, optionsKey],
  );
  const getSnapshot = useCallback(
    () => storeRef.current!.getSnapshot(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collectionPath, optionsKey],
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const colRef = collection(db, collectionPath);

  const add = useCallback(
    async (item: Omit<T, "id">) => {
      const docRef = await addDoc(colRef, {
        ...item,
        _createdAt: serverTimestamp(),
      });
      return docRef.id;
    },
    [colRef],
  );

  const set = useCallback(
    async (id: string, item: Omit<T, "id">) => {
      await setDoc(doc(db, collectionPath, id), {
        ...item,
        _updatedAt: serverTimestamp(),
      });
    },
    [db, collectionPath],
  );

  const update = useCallback(
    async (id: string, fields: Partial<T>) => {
      await updateDoc(doc(db, collectionPath, id), {
        ...fields,
        _updatedAt: serverTimestamp(),
      });
    },
    [db, collectionPath],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db, collectionPath, id));
    },
    [db, collectionPath],
  );

  return { ...state, add, set, update, remove };
}
