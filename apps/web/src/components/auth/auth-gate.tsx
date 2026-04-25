"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@appio/auth";
import { Sparkles } from "lucide-react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const redirect = encodeURIComponent(pathname || "/build");
      router.replace(`/auth/sign-in?redirect=${redirect}`);
    }
  }, [user, loading, router, pathname]);

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
