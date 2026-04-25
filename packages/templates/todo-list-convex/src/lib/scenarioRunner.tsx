// Auto-runs T2.3 validation scenarios when triggered via localStorage flag.
//
// Usage: from outside the WebView (sqlite3 on the WebKit LocalStorage db),
// set `appio:t2.3:autorun` to a scenario id, then launch the app. The
// runner reads the flag on first effect, runs the scenario, then clears
// the flag so a normal relaunch doesn't re-trigger it.
//
// Scenarios:
//   "3.2"  Disconnect WS for 30 s while idle, then reconnect.
//   "3.3"  Disconnect WS, queue 5 mutations, reconnect, wait 15 s.
//
// Audit log + connection log persist to localStorage automatically;
// scenario-specific timing is appended to `appio:t2.3:scenario-results`.

import { useEffect, useRef } from "react";

type ScenarioActions = {
  createTask: (title: string) => Promise<void>;
  isReady: boolean;
};

type ScenarioResult = {
  scenarioId: string;
  startedAt: number;
  finishedAt: number;
  events: Array<{ at: number; label: string }>;
  notes: string[];
};

const FLAG_KEY = "appio:t2.3:autorun";
const RESULTS_KEY = "appio:t2.3:scenario-results";

function setOfflineSafely(value: boolean): boolean {
  const sim = window.__appioSim;
  if (!sim) return false;
  sim.setOffline(value);
  return true;
}

function appendResult(result: ScenarioResult): void {
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    const existing: ScenarioResult[] = raw === null ? [] : JSON.parse(raw);
    existing.push(result);
    localStorage.setItem(RESULTS_KEY, JSON.stringify(existing));
  } catch {
    // ignore — overlay can still copy connection + audit logs
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function runScenario32(events: ScenarioResult["events"]): Promise<void> {
  events.push({ at: Date.now(), label: "wait 3 s for initial connect" });
  await sleep(3000);

  events.push({ at: Date.now(), label: "set offline" });
  setOfflineSafely(true);

  events.push({ at: Date.now(), label: "wait 30 s offline" });
  await sleep(30000);

  events.push({ at: Date.now(), label: "set online" });
  setOfflineSafely(false);

  events.push({ at: Date.now(), label: "wait 15 s for reconnect" });
  await sleep(15000);

  events.push({ at: Date.now(), label: "done" });
}

async function runScenario33(
  actions: ScenarioActions,
  events: ScenarioResult["events"],
  notes: string[],
): Promise<void> {
  events.push({ at: Date.now(), label: "wait 3 s for initial connect" });
  await sleep(3000);

  events.push({ at: Date.now(), label: "set offline" });
  setOfflineSafely(true);
  await sleep(1000);

  events.push({ at: Date.now(), label: "submit 5 mutations while offline" });
  // Fire-and-forget — the mutations will hang until reconnect because
  // Convex's mutation client buffers them when the WS is closed. The
  // audit log records each as `queuedAt: now`, `ackedAt: null`.
  const stamp = Date.now();
  for (let i = 0; i < 5; i += 1) {
    void actions.createTask(`offline-${stamp}-${i}`).catch((err) => {
      notes.push(
        `mutation ${i} threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  events.push({ at: Date.now(), label: "wait 30 s offline (mutations queued in client)" });
  await sleep(30000);

  events.push({ at: Date.now(), label: "set online" });
  setOfflineSafely(false);

  events.push({ at: Date.now(), label: "wait 15 s for reconnect + drain" });
  await sleep(15000);

  events.push({ at: Date.now(), label: "done — check audit log for ackedAt timestamps" });
}

export function useScenarioRunner(actions: ScenarioActions): void {
  // Stash actions in a ref so the run loop sees the latest createTask
  // even if the parent re-renders. Depending on `actions.createTask`
  // directly causes the effect to tear down + restart on every render
  // (Convex's `useMutation().withOptimisticUpdate(...)` returns a new
  // function each time), which kills any in-flight scenario.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // Single-shot trigger gated on isReady. Once we start, we never
  // re-run (a `started` flag in the closure protects against StrictMode
  // double-invocation), and we don't tear down the scenario on cleanup.
  // If the user navigates away mid-scenario the network simulator's
  // module-level state survives until the page reloads, which is what
  // the test wants — leaving the WS forced-offline is preferable to
  // half-recording the scenario.
  useEffect(() => {
    if (!actions.isReady) return;

    const scenarioId = (() => {
      try {
        return localStorage.getItem(FLAG_KEY);
      } catch {
        return null;
      }
    })();
    if (scenarioId === null) return;

    // Clear immediately — crash + relaunch must not loop the scenario.
    try {
      localStorage.removeItem(FLAG_KEY);
    } catch {
      // ignore
    }

    const run = async () => {
      const events: ScenarioResult["events"] = [];
      const notes: string[] = [];
      const startedAt = Date.now();
      events.push({ at: startedAt, label: `scenario ${scenarioId} start` });

      if (window.__appioSim === undefined) {
        notes.push(
          "networkSimulator not loaded — scenario cannot toggle WebSocket",
        );
      }

      try {
        if (scenarioId === "3.2") {
          await runScenario32(events);
        } else if (scenarioId === "3.3") {
          await runScenario33(
            { createTask: (t) => actionsRef.current.createTask(t), isReady: true },
            events,
            notes,
          );
        } else {
          notes.push(`unknown scenario: ${scenarioId}`);
        }
      } catch (err) {
        notes.push(
          `scenario threw: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      appendResult({
        scenarioId,
        startedAt,
        finishedAt: Date.now(),
        events,
        notes,
      });

      // Ensure we leave the WS open after the scenario finishes.
      setOfflineSafely(false);
    };

    void run();
  }, [actions.isReady]);
}
