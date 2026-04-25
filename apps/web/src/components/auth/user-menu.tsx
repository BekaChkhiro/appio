"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@appio/auth";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from "@appio/ui";

type UserMenuProps = {
  /**
   * Compact = icon-only avatar, used in narrow spaces (mobile bottom nav).
   * Full = avatar + name + email, used in desktop sidebar footer.
   */
  variant?: "compact" | "full";
};

function initialsOf(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase() || "?";
  }
  if (email) return email[0]?.toUpperCase() ?? "?";
  return "?";
}

export function UserMenu({ variant = "full" }: UserMenuProps) {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace("/");
  }, [router, signOut]);

  if (loading) {
    return variant === "compact" ? (
      <Skeleton className="h-9 w-9 rounded-full" />
    ) : (
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const initials = initialsOf(user.displayName, user.email);
  const displayName = user.displayName || user.email?.split("@")[0] || "Signed in";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          <Avatar className="h-9 w-9 shrink-0">
            {user.photoURL ? <AvatarImage src={user.photoURL} alt="" /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {variant === "full" && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              {user.email && (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              )}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{displayName}</p>
            {user.email && (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/profile")}>
          <UserIcon className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
