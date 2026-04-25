"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@appio/auth";
import { DollarSign, LogOut, ShieldCheck, Users } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: ShieldCheck },
  { href: "/costs", label: "Cost Monitor", icon: DollarSign },
  { href: "/users", label: "Users", icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950/60 px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500 text-sm font-bold text-white">
          A
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Appio Admin</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            internal
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors " +
                (isActive
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100")
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <div className="px-2">
            <p className="truncate text-xs font-medium text-white">
              {user.displayName || user.email}
            </p>
            {user.email && (
              <p className="truncate text-[10px] text-slate-500">{user.email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
