"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  User,
  Settings,
  Plus,
  ChevronDown,
  LayoutGrid,
  Store,
  UserCircle,
  Flame,
  BarChart3,
} from "lucide-react";
import { useChatStore } from "@/stores/chat-store";

type ScreenItem = { id: string; label: string; icon: React.ReactNode };

const DEFAULT_SCREENS: ScreenItem[] = [
  { id: "home", label: "Home", icon: <Home size={14} /> },
  { id: "detail", label: "Detail", icon: <Flame size={14} /> },
  { id: "add", label: "Add", icon: <Plus size={14} /> },
  { id: "stats", label: "Stats", icon: <BarChart3 size={14} /> },
  { id: "profile", label: "You", icon: <User size={14} /> },
];

const GLOBAL_NAV = [
  { href: "/build", label: "Create", icon: Plus },
  { href: "/my-apps", label: "My Apps", icon: LayoutGrid },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

interface EditorSidebarProps {
  appName: string | null;
  appStatus: string | null;
}

export function EditorSidebar({ appName, appStatus }: EditorSidebarProps) {
  const [currentScreen, setCurrentScreen] = useState("home");
  const router = useRouter();
  const pathname = usePathname();
  const clearMessages = useChatStore((s) => s.clearMessages);

  function handleNewApp() {
    clearMessages();
    router.push("/build");
  }

  const displayName = appName ?? "New app";
  const isNew = !appName;

  return (
    <div className="flex h-full flex-col">
      {/* Project header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3.5"
        style={{ borderBottom: "1px solid var(--hair)" }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
          style={{ background: "var(--accent-token)", color: "#fff" }}
        >
          A
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[13px] font-semibold"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
          >
            {displayName}
          </div>
          <div
            className="truncate text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            {isNew ? "Start building" : "Your workspace"}
          </div>
        </div>
        <ChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      </div>

      {/* Screens */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Screens
        </span>
        <button
          className="rounded p-1 transition-colors hover:bg-white/5"
          style={{ color: "var(--text-muted)" }}
          title="Add screen"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-2">
        {DEFAULT_SCREENS.map((s) => (
          <div
            key={s.id}
            onClick={() => setCurrentScreen(s.id)}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors"
            style={{
              background:
                currentScreen === s.id ? "var(--surface-2)" : "transparent",
              color:
                currentScreen === s.id
                  ? "var(--text-primary)"
                  : "var(--text-muted)",
              fontWeight: currentScreen === s.id ? 500 : 400,
            }}
          >
            {s.icon}
            <span className="flex-1">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Bottom actions */}
      <div className="px-3 pb-3 pt-2" style={{ borderTop: "1px solid var(--hair)" }}>
        <button
          onClick={handleNewApp}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-primary)",
            border: "1px solid var(--hair)",
          }}
        >
          <Plus size={14} />
          New app
        </button>

        <div className="mt-1 flex items-center gap-2 rounded-md px-2.5 py-2 text-[12px] transition-colors hover:bg-white/5"
          style={{ color: "var(--text-muted)", cursor: "pointer" }}
        >
          <Settings size={14} />
          <span>Settings</span>
        </div>
      </div>
    </div>
  );
}
