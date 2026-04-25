"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Plus, LayoutGrid, Store, User } from "lucide-react";
import { cn } from "@appio/ui";
import { useChatStore } from "@/stores/chat-store";

const navItems = [
  { href: "/create", label: "Create", icon: Plus, matches: ["/create", "/build"] },
  { href: "/my-apps", label: "Apps", icon: LayoutGrid, matches: ["/my-apps", "/apps", "/publish"] },
  { href: "/marketplace", label: "Market", icon: Store, matches: ["/marketplace"] },
  { href: "/profile", label: "Profile", icon: User, matches: ["/profile"] },
];

interface BottomNavProps {
  currentPath: string;
}

export function BottomNav({ currentPath }: BottomNavProps) {
  const router = useRouter();
  const clearMessages = useChatStore((s) => s.clearMessages);

  const handleClick = (href: string) => (e: React.MouseEvent) => {
    if (href === "/create") {
      e.preventDefault();
      clearMessages();
      router.push("/create");
    }
  };

  const isItemActive = (item: (typeof navItems)[number]) =>
    item.matches.some(
      (path) => currentPath === path || currentPath.startsWith(`${path}/`)
    );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/90 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="mx-auto grid h-16 max-w-[520px] grid-cols-4 items-center gap-1 px-2 pt-1">
        {navItems.map((item) => {
          const isActive = isItemActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClick(item.href)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute inset-0 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <item.icon className="relative z-10 h-5 w-5" />
              <span className="relative z-10 max-w-full truncate leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
