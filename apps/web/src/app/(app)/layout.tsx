"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGate } from "@/components/auth/auth-gate";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AuthGate>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <AppSidebar currentPath={pathname} />

        {/* Main content area */}
        <main className="flex flex-1 flex-col overflow-hidden pb-16 md:pb-0">
          {children}
        </main>

        {/* Mobile bottom nav (hidden on desktop) */}
        <BottomNav currentPath={pathname} />
      </div>
    </AuthGate>
  );
}
