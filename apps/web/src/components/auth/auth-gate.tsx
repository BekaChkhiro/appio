"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@appio/auth";
import { Sparkles, AlertTriangle } from "lucide-react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const redirect = encodeURIComponent(pathname || "/build");
      router.replace(`/auth/sign-in?redirect=${redirect}`);
    }
  }, [user, loading, router, pathname]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <div>
          <p className="text-sm font-medium">Authentication failed</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {error.message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-primary hover:underline"
        >
          Reload page
        </button>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <Sparkles className="h-6 w-6 animate-pulse text-primary" />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
