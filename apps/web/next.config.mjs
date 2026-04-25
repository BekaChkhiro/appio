import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// ── Security headers ─────────────────────────────────────────────
// Applied to every route by Next.js. CSP intentionally permissive on
// script/style because Tailwind v4 + Next dev still needs unsafe-inline/eval;
// lock down in production via NEXT_PUBLIC_ENABLE_STRICT_CSP=1 once tested.
const isProd = process.env.NODE_ENV === "production";
const strictCsp = process.env.NEXT_PUBLIC_ENABLE_STRICT_CSP === "1";

// Firebase Google/Apple OAuth popup loads apis.google.com/gsi helpers
// and opens an iframe on accounts.google.com. Both must be in script-src
// and frame-src respectively or sign-in silently fails.
const firebaseAuthOrigins = [
  "https://apis.google.com",
  "https://accounts.google.com",
  "https://www.gstatic.com",
];

// Cloudflare origins (analytics, beacon, insights)
const cloudflareOrigins = [
  "https://static.cloudflareinsights.com",
  "https://*.cloudflareinsights.com",
];

// Cloudflare Pages injects an inline script that loads beacon.min.js.
// Even in strict mode we must allow 'unsafe-inline' for script-src
// because Cloudflare's beacon loader is an inline <script> we cannot hash.
const scriptSrc = strictCsp
  ? [
      "'self'",
      "'unsafe-inline'",
      ...firebaseAuthOrigins,
      ...cloudflareOrigins,
      "https://*.posthog.com",
      "https://*.sentry.io",
    ]
  : [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      ...firebaseAuthOrigins,
      ...cloudflareOrigins,
      "https://*.posthog.com",
      "https://*.sentry.io",
    ];

const connectSrc = [
  "'self'",
  "https://*.appio.app",
  "https://api.appio.app",
  "https://api.rideway.ge",
  "https://*.googleapis.com",
  "https://*.firebaseio.com",
  "https://*.firebaseapp.com",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://apis.google.com",
  "https://accounts.google.com",
  "https://*.posthog.com",
  "https://*.sentry.io",
  "https://*.ingest.sentry.io",
  ...cloudflareOrigins,
  // Local dev
  ...(isProd ? [] : ["http://localhost:8000", "ws://localhost:3000", "ws://localhost:3001"]),
];

const csp = [
  `default-src 'self'`,
  `script-src ${scriptSrc.join(" ")}`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com`,
  `img-src 'self' data: blob: https:`,
  `script-src-elem 'self' 'unsafe-inline' ${cloudflareOrigins.join(" ")} ${firebaseAuthOrigins.join(" ")} https://*.posthog.com https://*.sentry.io`,
  `style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com`,
  `font-src 'self' data: https://fonts.gstatic.com https://cdn.fontshare.com`,
  `connect-src ${connectSrc.join(" ")}`,
  `frame-src 'self' https://*.firebaseapp.com https://*.appiousercontent.com https://accounts.google.com https://apis.google.com`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // COOP deliberately OFF: Firebase's OAuth popup flow calls window.close()
  // on the child, which `same-origin` or `same-origin-allow-popups` blocks
  // (child frame is cross-origin on accounts.google.com). Setting
  // `unsafe-none` restores the browser default and lets Firebase finish
  // the sign-in handshake. Known issue tracked at firebase/firebase-js-sdk.
  { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: undefined, // 'export' for Capacitor builds
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  images: {
    unoptimized: false, // set true for static export (Capacitor)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.appio.app",
        pathname: "/_mockups/**",
      },
    ],
  },
  typescript: {
    // Type checking done separately via tsc
    ignoreBuildErrors: false,
  },
  transpilePackages: [
    "@appio/ui",
    "@appio/auth",
    "@appio/api-client",
    "@appio/config",
  ],
  async headers() {
    return [
      {
        // Main CSP for all pages
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Service worker: no CSP (it has its own execution context)
        source: "/sw.js",
        headers: [
          { key: "Content-Security-Policy", value: "default-src *; connect-src *; script-src *" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  // Hide X-Powered-By: Next.js
  poweredByHeader: false,
};

export default withSerwist(nextConfig);
