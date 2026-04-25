/**
 * Security headers for served PWAs.
 *
 * The CSP is intentionally restrictive — generated PWAs are mostly
 * static. `connect-src 'self'` permits same-origin requests only,
 * which is needed for push notification subscription endpoints
 * (`/api/push/*`). Cross-origin network access remains blocked.
 *
 * `appiousercontent.com` is on the Public Suffix List (or should be —
 * see infra/pwa-worker/README.md). Even without PSL inclusion, the
 * combination of:
 *   - separate registrable domain (no shared cookies with appio.app)
 *   - `frame-ancestors 'none'`
 *   - HSTS preload
 * neutralizes cookie-tossing and clickjacking.
 */

/**
 * Editor origins that are allowed to embed deployed apps in an iframe.
 * This is the Appio editor itself (appio.app + beta + local dev) — which
 * is a trust boundary we already rely on for user auth. Clickjacking
 * from these origins would require a compromised Appio editor, which is
 * a bigger problem than iframe embedding.
 *
 * Override at deploy time via the EDITOR_ORIGINS env var if needed.
 */
const DEFAULT_EDITOR_ORIGINS =
  "https://appio.app https://beta.appio.app http://localhost:3000 http://localhost:3001";

function buildProdCsp(editorOrigins: string): string {
  return [
    "default-src 'self'",
    // Allow Cloudflare's auto-injected analytics beacon. CF injects
    // `https://static.cloudflareinsights.com/beacon.min.js` into every
    // HTML response served through a zone with Web Analytics enabled.
    // Blocking it doesn't disable the injection — only the execution —
    // which produces noisy CSP console errors in every user's browser.
    "script-src 'self' https://static.cloudflareinsights.com",
    // Tailwind v4 emits CSS variables and CSS-in-CSS rules. `unsafe-inline`
    // for *style* (not script) is the standard accommodation; it does not
    // weaken script protection.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    // 'self' allows same-origin requests for push subscription API
    // (/api/push/*). No cross-origin network access is permitted.
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    // Allow embedding ONLY from the Appio editor. Third-party sites
    // still cannot frame the user's app (clickjacking protection).
    `frame-ancestors ${editorOrigins}`,
    "form-action 'self'",
    "base-uri 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Base preview CSP directives (everything except frame-ancestors).
 * `frame-ancestors` is injected at runtime from the PREVIEW_FRAME_ANCESTORS
 * env var so dev/staging/prod can each allow the correct origins.
 */
const PREVIEW_CSP_BASE = [
  "default-src 'self'",
  // See buildProdCsp — same Cloudflare beacon auto-injection applies to previews.
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  // frame-ancestors appended at runtime
  "form-action 'self'",
  "base-uri 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "upgrade-insecure-requests",
];

const DEFAULT_PREVIEW_FRAME_ANCESTORS = DEFAULT_EDITOR_ORIGINS;

export function buildSecurityHeaders(editorOrigins?: string): Record<string, string> {
  const origins = editorOrigins || DEFAULT_EDITOR_ORIGINS;
  return {
    "Content-Security-Policy": buildProdCsp(origins),
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    // X-Frame-Options intentionally omitted — CSP `frame-ancestors` is the
    // modern equivalent and supports an allowlist (XFO only knows DENY /
    // SAMEORIGIN / specific single origin via ALLOW-FROM which is deprecated).
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
    ].join(", "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

export function buildPreviewSecurityHeaders(frameAncestors?: string): Record<string, string> {
  const ancestors = frameAncestors || DEFAULT_PREVIEW_FRAME_ANCESTORS;
  const previewCsp = [
    ...PREVIEW_CSP_BASE,
    `frame-ancestors ${ancestors}`,
  ].join("; ");

  return {
    "Content-Security-Policy": previewCsp,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    // Allow iframe embedding — no X-Frame-Options (CSP frame-ancestors takes precedence)
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
    ].join(", "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}
