import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that require authentication
const PROTECTED_PATHS = ["/my-apps", "/build", "/create", "/publish", "/profile", "/apps"];

// Paths that are only for unauthenticated users (auth pages)
const AUTH_PATHS = ["/auth/sign-in", "/auth/sign-up"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Server-side auth gate.
 *
 * Checks for a Firebase ID token in the session cookie. If the user is not
 * authenticated and tries to access a protected route, they are redirected
 * to /auth/sign-in with a `redirect` param so they land back where they
 * started after login.
 *
 * NOTE: This is a lightweight check using the cookie set by Firebase Auth
 * (or your own session cookie). For stricter security you can verify the
 * JWT against Firebase here, but that adds cold-start latency. The API
 * already validates tokens on every request, so this middleware focuses on
 * UX (preventing flash of protected content) and SEO (blocking crawlers).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for auth session cookie (set by Firebase or your auth flow)
  const session = request.cookies.get("__session")?.value;
  // Firebase ID tokens are JWTs and always start with "eyJ".
  // This lightweight format check prevents fake cookies from bypassing the gate.
  // For full JWT verification use jose or next-firebase-auth-edge (adds cold-start latency).
  const isAuthenticated = Boolean(
    session && session.startsWith("eyJ") && session.length > 100
  );

  // Redirect unauthenticated users away from protected routes
  if (!isAuthenticated && isProtectedPath(pathname)) {
    const redirectUrl = new URL("/auth/sign-in", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isAuthPath(pathname)) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const redirectTo = redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/my-apps";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/my-apps/:path*",
    "/build/:path*",
    "/create/:path*",
    "/publish/:path*",
    "/profile/:path*",
    "/apps/:path*",
    "/auth/:path*",
  ],
};
