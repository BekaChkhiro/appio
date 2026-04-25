import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./useAuth";
import { api, ApiError } from "@/lib/api";

export type BackendUser = {
  user_id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  tier: string;
  email_verified: boolean;
};

/**
 * Syncs the Firebase user to the backend on login.
 * Returns the backend user profile (tier, email_verified, etc.).
 */
export function useBackendSync() {
  const { user, signOut } = useAuth();
  const syncedUid = useRef<string | null>(null);
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Reset when user signs out
  useEffect(() => {
    if (!user) {
      syncedUid.current = null;
      setBackendUser(null);
      setSyncError(null);
    }
  }, [user]);

  useEffect(() => {
    if (!user || syncedUid.current === user.uid) return;

    let cancelled = false;

    async function sync() {
      try {
        setSyncError(null);
        const data = await api.post<BackendUser>("/auth/login");
        if (!cancelled) {
          syncedUid.current = user!.uid;
          setBackendUser(data);
        }
      } catch (error) {
        if (cancelled) return;

        if (error instanceof ApiError && error.status === 403) {
          // Disposable email or other forbidden — sign out
          setSyncError("This email address is not allowed. Please use a different account.");
          await signOut();
          return;
        }

        console.warn("Backend sync failed:", error);
        setSyncError("Could not connect to server. Some features may be limited.");
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [user, signOut]);

  const resync = useCallback(async () => {
    if (!user) return null;
    syncedUid.current = null; // force re-sync
    try {
      const data = await api.post<BackendUser>("/auth/login");
      syncedUid.current = user.uid;
      setBackendUser(data);
      setSyncError(null);
      return data;
    } catch (error) {
      console.warn("Backend resync failed:", error);
      return null;
    }
  }, [user]);

  return { backendUser, syncError, resync };
}
