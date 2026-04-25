"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Plus, LayoutGrid, Store, User } from "lucide-react";
import { cn } from "@appio/ui";
import { useChatStore } from "@/stores/chat-store";

const navItems = [
  { href: "/create", label: "Create", icon: Plus },
  { href: "/my-apps", label: "My Apps", icon: LayoutGrid },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/profile", label: "Profile", icon: User },
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

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/80 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClick(item.href)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute -top-1 h-0.5 w-8 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
