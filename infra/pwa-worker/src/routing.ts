/**
 * Subdomain → app_id extraction and path normalization.
 *
 * Hostnames look like `{app_id}.appiousercontent.com`. We accept exactly
 * one DNS label in front of the apex; multi-level subdomains are
 * rejected so e.g. `evil.user.appiousercontent.com` cannot impersonate a
 * sibling app.
 *
 * The `app_id` slug must match a strict charset to prevent path-injection
 * into the R2 key. The DB-side slug generator is the source of truth;
 * this is a defense-in-depth check.
 */

const APP_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function extractAppId(host: string, apexDomain: string): string | null {
  const normalizedHost = host.toLowerCase();
  const normalizedApex = apexDomain.toLowerCase();

  if (!normalizedHost.endsWith(`.${normalizedApex}`)) return null;

  const label = normalizedHost.slice(0, -1 - normalizedApex.length);
  // Reject multi-level subdomains (e.g. "a.b.appiousercontent.com").
  if (label.length === 0 || label.includes(".")) return null;
  if (!APP_ID_PATTERN.test(label)) return null;

  return label;
}

export function normalizePath(pathname: string): string {
  // Strip leading slash; an empty string maps to the SPA entry point.
  let path = pathname.startsWith("/") ? pathname.slice(1) : pathname;

  // Refuse traversal segments. The R2 key would be safe regardless
  // (the bucket has no parent), but we don't want to silently rewrite.
  if (path.includes("..")) return "index.html";

  // Empty path → root document.
  if (path === "") return "index.html";

  // Trailing slash → index.html in that "directory".
  if (path.endsWith("/")) return `${path}index.html`;

  return path;
}

/**
 * Mutable assets must always be revalidated against R2 because they
 * embed pointers to other (hashed) files and a stale copy would point
 * at versions that no longer exist.
 */
const MUTABLE_BASENAMES = new Set([
  "index.html",
  "sw.js",
  "service-worker.js",
  "manifest.json",
  "manifest.webmanifest",
  "gate.js",
]);

export function isMutableAsset(path: string): boolean {
  const idx = path.lastIndexOf("/");
  const basename = idx === -1 ? path : path.slice(idx + 1);
  return MUTABLE_BASENAMES.has(basename);
}
