"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@appio/auth";
import { useQuery } from "@tanstack/react-query";
import { api, ApiRequestError, AuthError } from "@appio/api-client";
import { ShieldOff, Loader2 } from "lucide-react";

/**
 * Fetches /api/v1/admin/costs — it's the lightest admin-only endpoint we
 * have, so we repurpose it as a "ping" to verify the current user has
 * admin tier. A 403 means signed in but not admin; auth error means
 * token expired.
 */
function useAdminPing(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-ping"],
    enabled,
    staleTime: 60_000,
    retry: (_, err) => !(err instanceof ApiRequestError && err.status === 403),
    queryFn: async () => {
      try {
        await api.get("/api/v1/admin/costs");
        return { admin: true } as const;
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 403) {
          return { admin: false } as const;
        }
        throw err;
      }
    },
  });
}

export function AdminGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const ping = useAdminPing(!!user && !loading);

  // Redirect unauthenticated users to the main app's sign-in.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      const appOrigin =
        process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000";
      const redirect = encodeURIComponent(`/admin${pathname || ""}`);
      window.location.href = `${appOrigin}/auth/sign-in?redirect=${redirect}`;
    }
  }, [user, loading, pathname]);

  if (loading || !user) {
    return <CenteredSpinner label="Checking authentication…" />;
  }

  if (ping.isLoading) {
    return <CenteredSpinner label="Verifying admin access…" />;
  }

  if (ping.data && !ping.data.admin) {
    return <AccessDenied email={user.email} />;
  }

  if (ping.error) {
    const err = ping.error;
    if (err instanceof AuthError) {
      return <AccessDenied email={user.email} reason="Session expired. Sign in again." />;
    }
    return (
      <AccessDenied
        email={user.email}
        reason={err instanceof Error ? err.message : "Unknown error"}
      />
    );
  }

  return <>{children}</>;
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function AccessDenied({ email, reason }: { email?: string | null; reason?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-slate-300">
      <ShieldOff className="h-8 w-8 text-red-500" />
      <h1 className="text-2xl font-semibold text-white">Admin access required</h1>
      <p className="max-w-md text-sm text-slate-400">
        {reason ??
          `The account ${email ?? ""} doesn't have admin permissions. Contact an existing admin to grant access.`}
      </p>
    </div>
  );
}
