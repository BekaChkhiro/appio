"use client";

import type { ReactNode } from "react";
import { AdminGate } from "./admin-gate";
import { AdminSidebar } from "./sidebar";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
      </div>
    </AdminGate>
  );
}
