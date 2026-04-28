"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGate } from "@/components/auth/auth-gate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthGate>
      <div className="app-shell flex overflow-hidden">
        {/* Desktop sidebar */}
        <AppSidebar currentPath={pathname} />

        {/* Main content area */}
        <main className="app-main flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>

        {/* Mobile bottom nav (hidden on desktop) */}
        <BottomNav currentPath={pathname} />
      </div>
    </AuthGate>
  );
}
