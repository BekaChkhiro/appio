import { ReactNode, useCallback, useEffect, useState } from "react";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

interface NotificationPermissionProps {
  /** VAPID public key (base64url). Obtained from `/api/push/vapid-key`. */
  vapidKey?: string;
  /** Called after the user is successfully subscribed. */
  onSubscribe?: (subscription: PushSubscription) => void;
  /** Called when permission is denied or an error occurs. */
  onError?: (error: string) => void;
  /** Custom prompt message shown to the user. */
  message?: string;
  /** Custom button label. */
  buttonLabel?: string;
  /** Override the entire prompt UI. Receives `requestPermission` callback and current state. */
  children?: (ctx: {
    permission: PermissionState;
    requesting: boolean;
    requestPermission: () => void;
  }) => ReactNode;
}

/**
 * Push notification opt-in component. Handles the full flow:
 * 1. Check browser support
 * 2. Fetch VAPID public key from same-origin `/api/push/vapid-key`
 * 3. Request `Notification` permission
 * 4. Subscribe via `pushManager.subscribe()`
 * 5. Send subscription to `/api/push/subscribe`
 *
 * If the user has already granted permission, this component is invisible.
 *
 * Usage:
 * ```tsx
 * <NotificationPermission
 *   message="Get reminders for your habits!"
 *   buttonLabel="Enable Notifications"
 * />
 * ```
 *
 * Or with custom render:
 * ```tsx
 * <NotificationPermission>
 *   {({ permission, requesting, requestPermission }) => (
 *     permission === "default" ? (
 *       <Button onClick={requestPermission} disabled={requesting}>
 *         {requesting ? "Enabling..." : "Turn on reminders"}
 *       </Button>
 *     ) : null
 *   )}
 * </NotificationPermission>
 * ```
 */
export function NotificationPermission({
  vapidKey: vapidKeyProp,
  onSubscribe,
  onError,
  message = "Stay updated with push notifications",
  buttonLabel = "Enable Notifications",
  children,
}: NotificationPermissionProps) {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === "undefined") return "unsupported";
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
    return Notification.permission as PermissionState;
  });
  const [requesting, setRequesting] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("appio_push_dismissed") === "1";
    } catch {
      return false;
    }
  });

  // Watch for external permission changes (e.g. user changes in browser settings).
  useEffect(() => {
    if (permission === "unsupported") return;
    const handler = () => setPermission(Notification.permission as PermissionState);
    let cleanup: (() => void) | null = null;

    navigator.permissions?.query?.({ name: "notifications" as PermissionName })
      .then((status) => {
        status.addEventListener("change", handler);
        cleanup = () => status.removeEventListener("change", handler);
      })
      .catch(() => { /* navigator.permissions.query not available */ });

    return () => cleanup?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requestPermission = useCallback(async () => {
    if (permission === "unsupported" || permission === "denied") return;
    setRequesting(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result !== "granted") {
        onError?.("Permission denied");
        setRequesting(false);
        return;
      }

      // Get service worker registration.
      const registration = await navigator.serviceWorker.ready;

      // Resolve VAPID key: prop > fetch from same-origin endpoint.
      let applicationServerKey = vapidKeyProp;
      if (!applicationServerKey) {
        const res = await fetch("/api/push/vapid-key");
        if (!res.ok) throw new Error("Failed to fetch VAPID key");
        const data = await res.json();
        applicationServerKey = data.key;
      }

      // Subscribe to push service.
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(applicationServerKey!),
      });

      // Send subscription to backend.
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      onSubscribe?.(subscription);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Subscription failed";
      onError?.(msg);
    } finally {
      setRequesting(false);
    }
  }, [permission, vapidKeyProp, onSubscribe, onError]);

  // Custom render via children function.
  if (children) {
    return <>{children({ permission, requesting, requestPermission })}</>;
  }

  // Nothing to show if already granted, denied, unsupported, or dismissed.
  if (permission !== "default" || dismissed) return null;

  return (
    <div className="mx-4 my-3 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <BellSolidIcon />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">
          {message}
        </p>
        <div className="flex items-center gap-2 mt-2.5">
          <button
            type="button"
            onClick={requestPermission}
            disabled={requesting}
            className={[
              "h-9 px-4 rounded-lg text-sm font-semibold",
              "bg-indigo-500 hover:bg-indigo-600 text-white",
              "transition-all duration-150 active:scale-[0.97]",
              "disabled:opacity-50 disabled:active:scale-100",
            ].join(" ")}
          >
            {requesting ? "Enabling..." : buttonLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              try { localStorage.setItem("appio_push_dismissed", "1"); } catch {}
            }}
            className="h-9 px-3 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Convert a base64url-encoded VAPID public key to a Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function BellSolidIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
