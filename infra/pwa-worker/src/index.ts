/**
 * Appio PWA Worker
 * ----------------
 * Serves user-built PWAs from Cloudflare R2 on `*.appiousercontent.com`.
 *
 * Routing model:
 *
 *   https://{app_id}.appiousercontent.com/{path}
 *     │
 *     ├─→ KV[app_id] = "v{N}"   (version pointer, written by builder)
 *     │
 *     └─→ R2[{app_id}/v{N}/{path}]   (or index.html for SPA fallback)
 *
 * The builder (python/builder/src/appio_builder/r2.py) sets per-object
 * Cache-Control / Content-Type on upload, so we forward those headers
 * directly. The Worker only adds security headers (CSP, HSTS, etc.).
 *
 * Cache strategy:
 *
 *   - Mutable assets (index.html, sw.js, manifest.json): always hit R2
 *     so version bumps are reflected immediately. Their R2 Cache-Control
 *     is `no-cache, must-revalidate`.
 *   - Immutable hashed assets: wrapped with Cache API keyed by version,
 *     so content hash + version together guarantee freshness.
 */

import { buildPreviewSecurityHeaders, buildSecurityHeaders } from "./headers";
import { buildOgHtml, getAppMeta, isSocialBot } from "./og";
import { handlePushApi, type PushEnv } from "./push";
import { extractAppId, isMutableAsset, normalizePath } from "./routing";

export interface Env {
  PWA_BUCKET: R2Bucket;
  VERSION_KV: KVNamespace;
  APEX_DOMAIN: string;
  APP_BASE_URL?: string; // e.g. "https://appio.app" — used for OG share page links
  LOG_LEVEL?: string;
  // Push notification bindings (optional — push disabled if absent).
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  PUSH_KV?: KVNamespace;
  // Preview iframe embedding — controls CSP frame-ancestors for preview
  // deploys. Set per environment in wrangler.toml. Omit for default
  // (https://appio.app https://beta.appio.app).
  PREVIEW_FRAME_ANCESTORS?: string;
}

const STATIC_METHODS = new Set(["GET", "HEAD"]);
const PUSH_API_PREFIX = "/api/push/";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const appId = extractAppId(url.hostname, env.APEX_DOMAIN);
    if (!appId) {
      return notFound("Invalid host");
    }

    // ---- Push API routes (POST /api/push/*) --------------------------------
    if (url.pathname.startsWith(PUSH_API_PREFIX)) {
      if (!env.PUSH_KV || !env.VAPID_PUBLIC_KEY) {
        return new Response(JSON.stringify({ error: "Push not configured" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      const pushResponse = await handlePushApi(request, env as PushEnv, appId);
      if (pushResponse) return pushResponse;
    }

    // ---- Static file serving (GET / HEAD only) -----------------------------
    if (!STATIC_METHODS.has(request.method)) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    // ---- Preview path: /_preview/{generation_id}/{turn}/{path} ---------------
    // Preview deploys are temporary R2 objects uploaded during the agent
    // tool-use loop. They skip KV version lookup and are never cached.
    if (url.pathname.startsWith("/_preview/")) {
      return handlePreview(request, env, url);
    }

    // ---- Social bot detection: serve OG meta tags for crawlers ---------------
    // Social media crawlers (Facebook, Twitter, Slack, etc.) can't execute
    // the React PWA, so we serve a lightweight HTML page with OG tags
    // on root-path requests from known bot user-agents.
    const ua = request.headers.get("User-Agent");
    if (isSocialBot(ua) && (url.pathname === "/" || url.pathname === "")) {
      const meta = await getAppMeta(env.VERSION_KV, appId);
      const appUrl = `https://${appId}.${env.APEX_DOMAIN}`;
      const appBaseUrl = env.APP_BASE_URL ?? "https://appio.app";
      const html = buildOgHtml(appId, meta, appUrl, appBaseUrl);
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // ---- 1. resolve current version from KV --------------------------------
    const pointer = await env.VERSION_KV.get(appId, { cacheTtl: 60 });
    if (!pointer) {
      return notFound("App not found");
    }
    const version = parseVersionPointer(pointer);
    if (!version) {
      return notFound("Invalid version pointer");
    }

    // ---- 2. resolve object key with SPA fallback ---------------------------
    const requestedPath = normalizePath(url.pathname);
    const objectKey = `${appId}/v${version}/${requestedPath}`;
    const isSpaFallbackEligible = !hasFileExtension(requestedPath);

    // ---- 3. cache lookup (immutable assets only) ---------------------------
    // Cache key reuses the original request's host (Cloudflare warns
    // against synthetic hostnames — they trigger DNS lookups and split
    // the cache) but rewrites the path so the version is part of the
    // key. Old cached entries become orphans on version bumps and are
    // evicted by LRU; no explicit purge needed.
    const cacheKey = new Request(
      `https://${url.hostname}/__appio_cache__/v${version}/${requestedPath}`,
      { method: "GET" },
    );
    const cache = caches.default;
    const cacheable = !isMutableAsset(requestedPath);

    if (cacheable) {
      const hit = await cache.match(cacheKey);
      if (hit) {
        return withSecurityHeaders(hit, request.method);
      }
    }

    // ---- 4. R2 fetch (with SPA fallback) -----------------------------------
    let object = await env.PWA_BUCKET.get(objectKey, {
      onlyIf: parseConditionalHeaders(request),
    });

    if (!object && isSpaFallbackEligible) {
      const fallbackKey = `${appId}/v${version}/index.html`;
      object = await env.PWA_BUCKET.get(fallbackKey);
    }

    if (!object) {
      return notFound("Not found");
    }

    // R2 conditional GET miss: get() returns an R2Object (NOT
    // R2ObjectBody) where the body property is undefined. We can't use
    // `'body' in object` because the TypeScript Headers type widens it,
    // so we discriminate at runtime by checking the property value.
    if ((object as R2ObjectBody).body === undefined) {
      const headers = new Headers();
      copyR2Headers(object, headers);
      return withSecurityHeaders(
        new Response(null, { status: 304, headers }),
        request.method,
      );
    }

    const headers = new Headers();
    copyR2Headers(object, headers);

    // Always build the full-body response first so the cache stores a
    // complete entry even when the request is HEAD. We strip the body
    // for HEAD only at the very end via withSecurityHeaders.
    let response = new Response(object.body, { status: 200, headers });

    if (cacheable && request.method === "GET") {
      // Cache only on GET — caching a HEAD-derived (null body) response
      // would poison subsequent GETs. Clone before adding security
      // headers so we can tighten the CSP later without re-uploading.
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    response = withSecurityHeaders(response, request.method);
    return response;
  },
} satisfies ExportedHandler<Env>;

// ------------------------------------------------------------ preview

// generation_id is a UUID from the agent pipeline (e.g. "550e8400-e29b-41d4-a716-446655440000")
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TURN_PATTERN = /^\d{1,4}$/;

/**
 * Serve preview deploys from R2 under `_preview/{generation_id}/{turn}/`.
 *
 * Preview assets are uploaded during the agent loop (after each successful
 * `run_build`) with `no-cache` headers. We:
 *   - Skip KV version lookup (the full path IS the R2 key)
 *   - Never cache in the Worker (previews are ephemeral)
 *   - Use relaxed `frame-ancestors` so the Lovable-style split-panel
 *     editor on appio.app can iframe the preview
 */
async function handlePreview(request: Request, env: Env, url: URL): Promise<Response> {
  // Path: /_preview/{generation_id}/{turn}/{file_path}
  // Strip leading slash → _preview/{generation_id}/{turn}/{file_path}
  const rawPath = url.pathname.slice(1);

  // Decode percent-encoded characters before validation (defense-in-depth
  // against %2E%2E traversal — R2 keys are flat so traversal doesn't work
  // at the storage layer, but we reject it at the edge regardless).
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return notFound("Invalid path encoding");
  }

  if (decodedPath.includes("..")) {
    return notFound("Invalid path");
  }

  // Validate structure: _preview/{generation_id}/{turn}[/{file_path}]
  // Filter empty segments from trailing slashes.
  const segments = decodedPath.split("/").filter(Boolean);
  if (segments.length < 3) {
    return notFound("Invalid preview path");
  }

  // Length >= 3 guaranteed by the check above; tell TypeScript.
  const generationId = segments[1]!;
  const turn = segments[2]!;

  if (!UUID_PATTERN.test(generationId)) {
    return notFound("Invalid generation ID");
  }
  if (!TURN_PATTERN.test(turn)) {
    return notFound("Invalid turn number");
  }

  // Build the R2 object key. The preview prefix is always
  // _preview/{generation_id}/{turn}. Any path segments beyond that
  // are the file path within the dist/ directory.
  const previewPrefix = `_preview/${generationId}/${turn}`;
  const filePath = segments.length > 3 ? segments.slice(3).join("/") : "index.html";
  const objectKey = `${previewPrefix}/${filePath}`;

  let object = await env.PWA_BUCKET.get(objectKey);

  // SPA fallback: routes without a file extension get the root index.html
  if (!object && !hasFileExtension(filePath)) {
    object = await env.PWA_BUCKET.get(`${previewPrefix}/index.html`);
  }

  if (!object) {
    return notFound("Preview not found");
  }

  if ((object as R2ObjectBody).body === undefined) {
    const headers = new Headers();
    copyR2Headers(object, headers);
    return withPreviewSecurityHeaders(
      new Response(null, { status: 304, headers }),
      request.method,
      env,
    );
  }

  const headers = new Headers();
  copyR2Headers(object, headers);
  // Force no-cache on all preview responses regardless of what R2 metadata says
  headers.set("Cache-Control", "no-cache, must-revalidate");

  const response = new Response(object.body, { status: 200, headers });
  return withPreviewSecurityHeaders(response, request.method, env);
}

// ---------------------------------------------------------------- helpers

function parseVersionPointer(pointer: string): number | null {
  // Pointer format is `v{N}` (see python/builder/src/appio_builder/kv.py)
  if (!pointer.startsWith("v")) return null;
  const n = Number.parseInt(pointer.slice(1), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function hasFileExtension(path: string): boolean {
  const last = path.lastIndexOf("/");
  const tail = last === -1 ? path : path.slice(last + 1);
  return tail.includes(".");
}

function parseConditionalHeaders(request: Request): R2Conditional | undefined {
  // Map HTTP conditional GET headers to R2Conditional fields. The R2
  // semantics are "perform the operation if the condition holds", so:
  //
  //   If-None-Match: <etag>      → only return body if etag does NOT match
  //                                → R2 returns R2Object (body undefined) on miss
  //                                → we translate to HTTP 304
  //
  //   If-Modified-Since: <date>  → only return body if uploaded AFTER <date>
  //                                (NOT uploadedBefore — that's
  //                                 If-Unmodified-Since semantics)
  const ifNoneMatch = request.headers.get("If-None-Match");
  const ifModifiedSince = request.headers.get("If-Modified-Since");
  if (!ifNoneMatch && !ifModifiedSince) return undefined;

  const cond: R2Conditional = {};

  if (ifNoneMatch) {
    // Strip optional W/ weak prefix and surrounding quotes per RFC 9110.
    const cleaned = ifNoneMatch.replace(/^W\//, "").replace(/^"|"$/g, "");
    if (cleaned !== "*") cond.etagDoesNotMatch = cleaned;
  }

  if (ifModifiedSince) {
    const date = new Date(ifModifiedSince);
    if (!Number.isNaN(date.getTime())) cond.uploadedAfter = date;
  }

  return cond;
}

function copyR2Headers(object: R2Object, headers: Headers): void {
  // Forward what the builder set on the object.
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);

  // Belt-and-braces defaults if the builder didn't set them.
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }
}

function withSecurityHeaders(response: Response, method: string): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(buildSecurityHeaders())) {
    headers.set(k, v);
  }
  return new Response(method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function withPreviewSecurityHeaders(response: Response, method: string, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(buildPreviewSecurityHeaders(env.PREVIEW_FRAME_ANCESTORS))) {
    headers.set(k, v);
  }
  return new Response(method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function notFound(message: string): Response {
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  for (const [k, v] of Object.entries(buildSecurityHeaders())) {
    headers.set(k, v);
  }
  return new Response(`${message}\n`, { status: 404, headers });
}
