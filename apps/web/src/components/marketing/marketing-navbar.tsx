"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button, cn } from "@appio/ui";
import { useAuth } from "@appio/auth";

const NAV_LINKS = [
  { href: "/#showcase", label: "Showcase" },
  { href: "/pricing", label: "Pricing" },
  { href: "#", label: "Changelog" },
];

function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        background: "var(--accent-token, #7C5CFF)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: size * 0.6,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        letterSpacing: 0,
        flexShrink: 0,
      }}
    >
      A
    </div>
  );
}

export function MarketingNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const isAuthRoute = pathname?.startsWith("/auth");

  if (isAuthRoute) return null;

  const handleSignOut = async () => {
    await signOut();
    router.refresh();
  };

  return (
    <header
      className="flex items-center justify-between gap-4 px-6 py-5 sm:px-12"
      style={{
        borderBottom: "1px solid var(--hair)",
        background: "var(--surface-0)",
      }}
    >
      <Link href="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
        <LogoMark size={22} />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 0,
            color: "var(--text-primary)",
          }}
        >
          Appio
        </span>
      </Link>

      <nav className="hidden items-center gap-7 md:flex">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "t-caption transition-colors hover:text-[var(--text-primary)]",
              pathname === link.href && "text-[var(--text-primary)]"
            )}
            style={{ cursor: "pointer", textDecoration: "none" }}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        ) : user ? (
          <>
            <Button size="sm" asChild>
              <Link href="/build">Open App</Link>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              asChild
              className="hidden sm:inline-flex"
            >
              <Link href="/auth/sign-in">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/auth/sign-up">Start free</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
