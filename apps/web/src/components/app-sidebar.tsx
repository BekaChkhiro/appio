"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Plus, LayoutGrid, Store, User, PanelLeft } from "lucide-react";
import { cn } from "@appio/ui";
import { UserMenu } from "@/components/auth/user-menu";
import { useChatStore } from "@/stores/chat-store";

const navItems = [
  { href: "/create", label: "Create", icon: Plus },
  { href: "/my-apps", label: "My Apps", icon: LayoutGrid },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/profile", label: "Profile", icon: User },
];

const SIDEBAR_COLLAPSED_KEY = "appio-sidebar-collapsed";

interface AppSidebarProps {
  currentPath: string;
}

export function AppSidebar({ currentPath }: AppSidebarProps) {
  const router = useRouter();
  const clearMessages = useChatStore((s) => s.clearMessages);
  const [collapsed, setCollapsed] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored) setCollapsed(stored === "true");
  }, []);

  // Persist collapsed state
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const handleCreateClick = (href: string) => (e: React.MouseEvent) => {
    if (href === "/create") {
      e.preventDefault();
      clearMessages();
      router.push("/create");
    }
  };

  return (
    <aside
      className="app-sidebar flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200"
      style={{ width: collapsed ? 68 : 240 }}
    >
      {/* Logo */}
      <div
        className="flex h-14 shrink-0 items-center border-b border-border px-4"
        style={{ justifyContent: collapsed ? "center" : "flex-start" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            A
          </div>
          {!collapsed && <span className="text-lg font-semibold">Appio</span>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleCreateClick(item.href)}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              style={{ justifyContent: collapsed ? "center" : "flex-start" }}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-primary"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <item.icon className="relative z-10 h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className="relative z-10">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer — collapse toggle + account menu */}
      <div className="border-t border-border p-2">
        <button
          onClick={toggleCollapsed}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-md py-1.5 text-[11px] font-medium transition-colors"
          style={{ color: "var(--text-muted)" }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeft size={14} />
          {!collapsed && (
            <span>Collapse</span>
          )}
        </button>
        <UserMenu variant={collapsed ? "compact" : "full"} />
      </div>
    </aside>
  );
}
