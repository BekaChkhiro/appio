/**
 * Push notification API routes for generated PWAs.
 *
 * Served on the same origin as the PWA (`*.appiousercontent.com`) so
 * `connect-src 'self'` in the CSP allows the client to reach these
 * endpoints without cross-origin issues.
 *
 * Routes:
 *   GET  /api/push/vapid-key    → returns the VAPID public key
 *   POST /api/push/subscribe    → stores a push subscription in KV
 *   POST /api/push/unsubscribe  → removes a subscription from KV
 *   POST /api/push/send         → sends a push to all subscribers (requires auth)
 *
 * Subscriptions are stored in Cloudflare KV under:
 *   push:{app_id}:subs → JSON array of PushSubscription objects
 *
 * VAPID keys are stored as Worker secrets:
 *   VAPID_PUBLIC_KEY  — base64url-encoded public key
 *   VAPID_PRIVATE_KEY — base64url-encoded private key
 *   VAPID_SUBJECT     — mailto: or https: URL identifying the sender
 */

import type { Env } from "./index";

/** Maximum subscriptions stored per app (prevent abuse). */
const MAX_SUBS_PER_APP = 10_000;

/**
 * Handle push API requests. Returns a Response if the path matches an
 * API route, or null if the request should fall through to the static
 * file handler.
 */
export async function handlePushApi(
  request: Request,
  env: PushEnv,
  appId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/push/vapid-key" && request.method === "GET") {
    return handleVapidKey(env);
  }

  if (path === "/api/push/subscribe" && request.method === "POST") {
    return handleSubscribe(request, env, appId);
  }

  if (path === "/api/push/unsubscribe" && request.method === "POST") {
    return handleUnsubscribe(request, env, appId);
  }

  if (path === "/api/push/send" && request.method === "POST") {
    return handleSend(request, env, appId);
  }

  return null; // Not a push API route.
}

/** Extended Env with push-specific bindings. */
export interface PushEnv extends Env {
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  PUSH_KV: KVNamespace;
}

// ── Route handlers ───────────────────────────────────────────────────

function handleVapidKey(env: PushEnv): Response {
  if (!env.VAPID_PUBLIC_KEY) {
    return jsonResponse({ error: "Push not configured" }, 503);
  }
  return jsonResponse({ key: env.VAPID_PUBLIC_KEY });
}

async function handleSubscribe(
  request: Request,
  env: PushEnv,
  appId: string,
): Promise<Response> {
  const sub = await parseJsonBody(request);
  if (!sub || !sub.endpoint || !sub.keys) {
    return jsonResponse({ error: "Invalid subscription" }, 400);
  }

  const kvKey = `push:${appId}:subs`;
  const existing = await getSubscriptions(env.PUSH_KV, kvKey);

  // Deduplicate by endpoint.
  const filtered = existing.filter((s: Subscription) => s.endpoint !== sub.endpoint);
  if (filtered.length >= MAX_SUBS_PER_APP) {
    return jsonResponse({ error: "Subscription limit reached" }, 429);
  }

  filtered.push({
    endpoint: sub.endpoint as string,
    keys: sub.keys as { p256dh: string; auth: string },
    createdAt: new Date().toISOString(),
  });

  await env.PUSH_KV.put(kvKey, JSON.stringify(filtered));
  return jsonResponse({ ok: true, count: filtered.length });
}

async function handleUnsubscribe(
  request: Request,
  env: PushEnv,
  appId: string,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body || !body.endpoint) {
    return jsonResponse({ error: "Missing endpoint" }, 400);
  }

  const kvKey = `push:${appId}:subs`;
  const existing = await getSubscriptions(env.PUSH_KV, kvKey);
  const filtered = existing.filter((s: Subscription) => s.endpoint !== body.endpoint);

  if (filtered.length === 0) {
    await env.PUSH_KV.delete(kvKey);
  } else {
    await env.PUSH_KV.put(kvKey, JSON.stringify(filtered));
  }

  return jsonResponse({ ok: true });
}

async function handleSend(
  request: Request,
  env: PushEnv,
  appId: string,
): Promise<Response> {
  // Authenticate: require a bearer token that matches the app's push
  // secret stored in KV. This is set by the Appio backend when push
  // notifications are enabled for an app.
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const expectedToken = await env.PUSH_KV.get(`push:${appId}:secret`);
  if (!expectedToken || !timingSafeEqual(token, expectedToken)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const payload = await parseJsonBody(request);
  if (!payload || !payload.title) {
    return jsonResponse({ error: "Missing title" }, 400);
  }

  const kvKey = `push:${appId}:subs`;
  const subscriptions = await getSubscriptions(env.PUSH_KV, kvKey);

  if (subscriptions.length === 0) {
    return jsonResponse({ sent: 0, failed: 0 });
  }

  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body || "",
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    url: payload.url,
    actions: payload.actions,
  });

  // Send to all subscriptions using Web Push protocol.
  const results = await Promise.allSettled(
    subscriptions.map((sub: Subscription) =>
      sendWebPush(sub, payloadStr, env),
    ),
  );

  // Remove expired subscriptions (410 Gone).
  const expired: string[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    if (result.status === "fulfilled" && result.value === true) {
      sent++;
    } else if (result.status === "fulfilled" && result.value === false) {
      // Subscription expired — mark for removal.
      failed++;
      expired.push(subscriptions[i]!.endpoint);
    } else {
      failed++;
    }
  }

  // Clean up expired subscriptions.
  if (expired.length > 0) {
    const cleaned = subscriptions.filter(
      (s: Subscription) => !expired.includes(s.endpoint),
    );
    if (cleaned.length === 0) {
      await env.PUSH_KV.delete(kvKey);
    } else {
      await env.PUSH_KV.put(kvKey, JSON.stringify(cleaned));
    }
  }

  return jsonResponse({ sent, failed, expired: expired.length });
}

// ── Web Push sending ─────────────────────────────────────────────────

interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt?: string;
}

/**
 * Send a push message using the Web Push protocol (RFC 8291 + RFC 8292).
 *
 * Uses the web-push compatible JWT VAPID auth. Returns:
 *   true  — sent successfully
 *   false — subscription expired (should be removed)
 *   throws — transient error
 */
async function sendWebPush(
  sub: Subscription,
  payload: string,
  env: PushEnv,
): Promise<boolean> {
  // Build the VAPID JWT for authorization.
  const audience = new URL(sub.endpoint).origin;
  const jwt = await buildVapidJwt(audience, env.VAPID_SUBJECT, env.VAPID_PRIVATE_KEY);
  const vapidAuth = `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`;

  // Encrypt the payload per RFC 8291 (aes128gcm).
  const encrypted = await encryptPayload(
    payload,
    sub.keys.p256dh,
    sub.keys.auth,
  );

  const response = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuth,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body: encrypted,
  });

  if (response.status === 201 || response.status === 202) return true;
  if (response.status === 404 || response.status === 410) return false;
  throw new Error(`Push failed: ${response.status}`);
}

// ── VAPID JWT ────────────────────────────────────────────────────────

async function buildVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const claimsB64 = base64url(JSON.stringify(claims));
  const unsigned = `${headerB64}.${claimsB64}`;

  // Import the VAPID private key.
  // Expected format: base64url-encoded PKCS8 DER (standard output from `web-push generate-vapid-keys`).
  const privateKeyBytes = base64urlToBytes(privateKeyBase64);
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyBytes,
      { name: "ECDSA", namedCurve: "P-256" } as unknown as SubtleCryptoImportKeyAlgorithm,
      false,
      ["sign"],
    );
  } catch (err) {
    // Try raw format as fallback (32-byte "d" parameter).
    try {
      key = await crypto.subtle.importKey(
        "raw",
        privateKeyBytes,
        { name: "ECDSA", namedCurve: "P-256" } as unknown as SubtleCryptoImportKeyAlgorithm,
        false,
        ["sign"],
      );
    } catch {
      throw new Error(
        `Invalid VAPID_PRIVATE_KEY: could not import as PKCS8 or raw P-256 key. ` +
        `Generate keys with: npx web-push generate-vapid-keys. Original error: ${err}`,
      );
    }
  }

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  );

  return `${unsigned}.${arrayToBase64url(new Uint8Array(signature))}`;
}

// ── Payload encryption (RFC 8291 aes128gcm) ──────────────────────────

async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string,
): Promise<ArrayBuffer> {
  const payloadBytes = new TextEncoder().encode(payload);
  const authSecret = base64urlToBytes(authBase64);
  const clientPublicKey = base64urlToBytes(p256dhBase64);

  // Generate an ephemeral ECDH key pair.
  const localKeyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" } as unknown as SubtleCryptoGenerateKeyAlgorithm,
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;

  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
  const localPublicKeyBytes = new Uint8Array(localPublicKeyRaw as ArrayBuffer);

  // Import client's public key (keyUsages must include deriveBits for spec compliance).
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" } as unknown as SubtleCryptoImportKeyAlgorithm,
    false,
    ["deriveBits"],
  );

  // Derive shared secret via ECDH.
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
    localKeyPair.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // HKDF to derive IKM (input keying material).
  // info = "WebPush: info\0" + clientPublicKey + localPublicKey
  const authInfo = concatBytes(
    new TextEncoder().encode("WebPush: info\0"),
    clientPublicKey,
    localPublicKeyBytes,
  );
  const ikm = await hkdfDerive(authSecret, sharedSecret, authInfo, 32);

  // Generate 16-byte random salt.
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive content encryption key (CEK) and nonce per RFC 5869 + RFC 8291.
  // Each derivation uses its own info string but INDEPENDENT HKDF-Expand
  // calls (RFC 8291 §3.3 specifies separate info for each, counter=1 each).
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpandSingle(
    prk,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdfExpandSingle(
    prk,
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    12,
  );

  // Pad the payload: content + 0x02 delimiter (RFC 8291 §2, minimal padding).
  const padded = new Uint8Array(payloadBytes.length + 1);
  padded.set(payloadBytes);
  padded[payloadBytes.length] = 0x02;

  // Encrypt with AES-128-GCM.
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    padded,
  );

  // Build aes128gcm header: salt (16) + rs (4, big-endian) + idlen (1) + keyid (65).
  // Record size 4096 per RFC 8291 §2 — max plaintext bytes per encrypted record.
  const AEAD_RECORD_SIZE = 4096;
  const headerBuf = new Uint8Array(16 + 4 + 1 + localPublicKeyBytes.length);
  headerBuf.set(salt, 0);
  new DataView(headerBuf.buffer).setUint32(16, AEAD_RECORD_SIZE);
  headerBuf[20] = localPublicKeyBytes.length;
  headerBuf.set(localPublicKeyBytes, 21);

  return concatBuffers(headerBuf.buffer, encrypted);
}

// ── Crypto helpers ───────────────────────────────────────────────────

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = await crypto.subtle.sign("HMAC", key, ikm);
  return new Uint8Array(prk);
}

/**
 * HKDF-Expand (RFC 5869 §2.3) — single extraction with counter=1.
 * RFC 8291 §3.3 uses separate HKDF-Expand calls (each with counter=1)
 * for CEK and nonce, with different info strings.
 */
async function hkdfExpandSingle(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  // T(1) = HMAC-Hash(PRK, info || 0x01)
  const input = concatBytes(info, new Uint8Array([1]));
  const output = await crypto.subtle.sign("HMAC", key, input);
  return new Uint8Array(output).slice(0, length);
}

async function hkdfDerive(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const prk = await hkdfExtract(salt, ikm);
  return hkdfExpandSingle(prk, info, length);
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ── Encoding helpers ─────────────────────────────────────────────────

function base64url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function arrayToBase64url(arr: Uint8Array): string {
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function concatBuffers(...buffers: ArrayBuffer[]): ArrayBuffer {
  const total = buffers.reduce((n, b) => n + b.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    result.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return result.buffer;
}

// ── KV helpers ───────────────────────────────────────────────────────

async function getSubscriptions(kv: KVNamespace, key: string): Promise<Subscription[]> {
  const raw = await kv.get(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
