import { useEffect, useState, type FormEvent } from "react";
import { useConvex } from "convex/react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import {
  cardReveal,
  listStagger,
  pageTransition,
  useAnimationPreset,
  useStaggerPreset,
} from "@appio/ui/animations";
import { useCollection, useConvexMode } from "@appio/ui/hooks";

import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { firebaseConfig } from "./config/firebase";
import { useAuth } from "./components/ui/useAuth";
import {
  useAuditedCreateTask,
  useAuditedToggleTask,
  useAuditedDeleteTask,
} from "./lib/mutationAudit";
import { InstrumentOverlay } from "./lib/InstrumentOverlay";
import { useScenarioRunner } from "./lib/scenarioRunner";

export default function App() {
  const auth = useAuth(firebaseConfig);

  // T2.3 POC: auto-sign-in anonymously when no user is present so the
  // Convex offline scenarios can run without depending on popup-based
  // OAuth (which doesn't work in Capacitor's WKWebView). Production
  // templates should swap this for a real sign-in flow + native plugin.
  useEffect(() => {
    if (auth.loading) return;
    if (auth.user !== null) return;
    auth.signInAnonymous().catch(() => {
      // The diagnostic loading screen surfaces auth init errors; the
      // sign-in screen renders below as a fallback if this throws.
    });
  }, [auth.loading, auth.user, auth.signInAnonymous]);

  if (auth.loading) {
    return <LoadingDiagnostics />;
  }

  if (auth.user === null) {
    return (
      <>
        <SignInScreen signIn={auth.signInAnonymous} />
        <InstrumentOverlay />
      </>
    );
  }

  return (
    <>
      <TodoScreen userLabel={auth.user.email ?? auth.user.uid} onSignOut={auth.signOut} />
      <InstrumentOverlay />
    </>
  );
}

function SignInScreen({ signIn }: { signIn: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const reveal = useAnimationPreset(cardReveal);

  const handleSignIn = async () => {
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "sign-in failed");
    }
  };

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <motion.div
        className="w-full max-w-sm space-y-4 rounded-2xl bg-[color:var(--color-surface)] p-6 shadow-sm"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={reveal.variants}
        transition={reveal.transition}
      >
        <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
          To-Do List (Convex)
        </h1>
        <p className="text-sm text-[color:var(--color-text-secondary)]">
          T2.3 POC — anonymous session. Each device gets its own tenantId.
        </p>
        <button
          type="button"
          onClick={handleSignIn}
          className="w-full rounded-lg bg-[color:var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity active:opacity-90"
        >
          Continue (anonymous)
        </button>
        {error !== null && (
          <p className="text-xs text-red-600">{error}</p>
        )}
      </motion.div>
    </main>
  );
}

function TodoScreen({
  userLabel,
  onSignOut,
}: {
  userLabel: string;
  onSignOut: () => Promise<void>;
}) {
  // T3.1 proof-of-concept — the read goes through the shared
  // @appio/ui/hooks useCollection wrapper. Mutations stay on the
  // audited path so we preserve the T2.3 optimistic-update +
  // mutation-audit instrumentation; useCollection mutation slots are
  // the lighter-weight alternative for templates that don't need the
  // audit log.
  const { data: tasks } = useCollection({ list: api.tasks.listTasks });
  const mode = useConvexMode();
  const createTask = useAuditedCreateTask();
  const toggleTask = useAuditedToggleTask();
  const deleteTask = useAuditedDeleteTask();
  const page = useAnimationPreset(pageTransition);
  const stagger = useStaggerPreset(listStagger);

  // Auto-run any scenario queued via localStorage (set by run-scenarios.sh
  // before launch). No-op if no flag is set.
  useScenarioRunner({ createTask, isReady: tasks !== undefined });

  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length === 0 || submitting) return;
    setSubmitting(true);
    setTitle("");
    try {
      await createTask(trimmed);
    } catch {
      // Optimistic patch already showed the row; on hard failure the
      // audit log carries the error and the cache reverts. Re-surfacing
      // here would just re-render the input — runbook covers recovery.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.main
      className="min-h-dvh px-4 py-6"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={page.variants}
      transition={page.transition}
    >
      <div className="mx-auto max-w-xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
              Tasks
            </h1>
            <p className="text-xs text-[color:var(--color-text-secondary)]">
              Signed in as {userLabel}
              {mode === "sandbox" && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                  Preview
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="text-xs text-[color:var(--color-text-secondary)] underline-offset-2 hover:underline"
          >
            Sign out
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a task…"
            maxLength={280}
            className="flex-1 rounded-lg border border-black/10 bg-[color:var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          />
          <button
            type="submit"
            disabled={submitting || title.trim().length === 0}
            className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Add
          </button>
        </form>

        <section>
          {tasks === undefined ? (
            <p className="text-sm text-[color:var(--color-text-secondary)]">
              Loading tasks…
            </p>
          ) : (
            <motion.ul
              className="space-y-2"
              initial="initial"
              animate="animate"
              variants={stagger.variants}
            >
              <AnimatePresence initial={false}>
                {tasks.map((task) => (
                  <TaskItem
                    key={task._id}
                    id={task._id}
                    title={task.title}
                    completed={task.completed}
                    onToggle={() => toggleTask(task._id)}
                    onDelete={() => deleteTask(task._id)}
                    itemVariants={stagger.itemVariants}
                  />
                ))}
              </AnimatePresence>
              {tasks.length === 0 && (
                <li className="text-sm text-[color:var(--color-text-secondary)]">
                  No tasks yet.
                </li>
              )}
            </motion.ul>
          )}
        </section>
      </div>
    </motion.main>
  );
}

// On-device diagnostic shown when auth.loading stays true past 2 s.
// Exposes Firebase init state, Convex connection state, last error,
// and lets us bypass the gate manually so we can still test the UI.
function LoadingDiagnostics() {
  const convex = useConvex();
  const [tick, setTick] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    const onError = (e: ErrorEvent) =>
      setErrors((prev) => [...prev, `error: ${e.message}`]);
    const onRejection = (e: PromiseRejectionEvent) =>
      setErrors((prev) => [
        ...prev,
        `unhandled rejection: ${String(e.reason)}`,
      ]);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      clearInterval(id);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  let convexState = "(unknown)";
  try {
    const s = (
      convex as unknown as {
        connectionState: () => { isWebSocketConnected: boolean };
      }
    ).connectionState();
    convexState = s.isWebSocketConnected ? "ws: open" : "ws: closed";
  } catch (err) {
    convexState = `ws: error (${err instanceof Error ? err.message : err})`;
  }

  // Real Firebase init errors get parked here by useAuth (since the
  // browser's cross-origin error handler swallows them as "Script error.").
  const authInitErrors =
    (window as unknown as { __appioAuthInitErrors?: string[] })
      .__appioAuthInitErrors ?? [];

  const elapsedSec = Math.floor((tick * 500) / 1000);

  return (
    <main className="min-h-dvh p-4 text-xs">
      <div className="mx-auto max-w-md space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="text-base font-semibold text-slate-900">
          Loading… ({elapsedSec}s)
        </div>
        <div className="space-y-1 font-mono text-[11px] text-slate-700">
          <div>convex: {convexState}</div>
          <div>firebase project: {firebaseConfig.projectId}</div>
          <div>firebase appId: {firebaseConfig.appId.slice(0, 25)}…</div>
          <div>
            user agent:{" "}
            <span className="break-all">
              {navigator.userAgent.slice(0, 80)}…
            </span>
          </div>
          <div>capacitor: {String(typeof (window as unknown as { Capacitor?: unknown }).Capacitor !== "undefined")}</div>
        </div>
        {authInitErrors.length > 0 && (
          <div className="space-y-1 rounded bg-amber-50 p-2 font-mono text-[10px] text-amber-800">
            <div className="font-semibold">firebase init errors:</div>
            {authInitErrors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}
        {errors.length > 0 && (
          <div className="space-y-1 rounded bg-red-50 p-2 font-mono text-[10px] text-red-700">
            <div className="font-semibold">caught errors:</div>
            {errors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          If this stays stuck for &gt; 5 s, Firebase Auth has not received its
          first onAuthStateChanged callback. Common causes: invalid Firebase
          config, blocked third-party requests, or Firebase Auth REST endpoint
          timing out. Check Safari → Develop → Simulator for full logs.
        </p>
      </div>
      <InstrumentOverlay />
    </main>
  );
}

function TaskItem({
  id,
  title,
  completed,
  onToggle,
  onDelete,
  itemVariants,
}: {
  id: Id<"tasks">;
  title: string;
  completed: boolean;
  onToggle: () => Promise<void>;
  onDelete: () => Promise<void>;
  itemVariants: Variants;
}) {
  return (
    <motion.li
      layout
      data-task-id={id}
      className="flex items-center gap-3 rounded-lg bg-[color:var(--color-surface)] px-3 py-2 shadow-sm"
      variants={itemVariants}
      exit="exit"
    >
      <input
        type="checkbox"
        checked={completed}
        onChange={() => void onToggle()}
        className="h-4 w-4 accent-[color:var(--color-primary)]"
      />
      <span
        className={
          "flex-1 text-sm " +
          (completed
            ? "text-[color:var(--color-text-secondary)] line-through"
            : "text-[color:var(--color-text-primary)]")
        }
      >
        {title}
      </span>
      <button
        type="button"
        onClick={() => void onDelete()}
        className="text-xs text-[color:var(--color-text-secondary)] hover:text-red-600"
        aria-label="Delete task"
      >
        ✕
      </button>
    </motion.li>
  );
}
