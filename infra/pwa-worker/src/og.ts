/**
 * Social media crawler (bot) detection and Open Graph meta tag serving.
 *
 * When a social platform (Facebook, Twitter, LinkedIn, Slack, Discord, etc.)
 * fetches a shared link like `expense-tracker.appiousercontent.com`, the
 * crawler needs a lightweight HTML response with OG meta tags instead of
 * the full React PWA (which it can't execute).
 *
 * We detect crawlers via User-Agent and serve a minimal HTML page with
 * OG tags. The page also includes a `<meta http-equiv="refresh">` so
 * real users who somehow see this page get redirected to the PWA.
 */

const BOT_USER_AGENTS = [
  "facebookexternalhit",
  "Facebot",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "Discordbot",
  "WhatsApp",
  "TelegramBot",
  "Googlebot",
  "bingbot",
  "Pinterestbot",
  "redditbot",
  "Applebot",
  "Embedly",
  "ChatGPT-User",
];

export function isSocialBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_USER_AGENTS.some((bot) => userAgent.includes(bot));
}

export interface AppMeta {
  name: string;
  description: string | null;
  theme_color: string | null;
}

/**
 * Try to read app metadata from KV. The key format is `{app_id}:meta`
 * and the value is a JSON string: `{"name":"...","description":"...","theme_color":"..."}`.
 *
 * Falls back to a synthetic meta object using the app_id as the name.
 */
export async function getAppMeta(
  kv: KVNamespace,
  appId: string
): Promise<AppMeta> {
  try {
    const raw = await kv.get(`${appId}:meta`, { cacheTtl: 300 });
    if (raw) {
      return JSON.parse(raw) as AppMeta;
    }
  } catch {
    // Ignore parse errors — fall through to default
  }
  // Fallback: humanize the slug (e.g. "expense-tracker" → "Expense Tracker")
  const name = appId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { name, description: null, theme_color: null };
}

/**
 * Build a minimal HTML page with Open Graph meta tags for social crawlers.
 */
export function buildOgHtml(
  appId: string,
  meta: AppMeta,
  appUrl: string,
  appBaseUrl: string
): string {
  const title = escapeHtml(meta.name);
  const description = escapeHtml(
    meta.description ?? `${meta.name} — a PWA built with Appio`
  );
  const themeColor = escapeHtml(meta.theme_color ?? "#7c3aed");
  const safeAppUrl = escapeHtml(appUrl);
  const sharePageUrl = escapeHtml(
    `${appBaseUrl}/app/${encodeURIComponent(appId)}`
  );
  const ogImageUrl = escapeHtml(
    `${appBaseUrl}/api/og?name=${encodeURIComponent(meta.name)}&color=${encodeURIComponent(meta.theme_color ?? "#7c3aed")}`
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${description}">

<!-- Open Graph -->
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:url" content="${safeAppUrl}">
<meta property="og:site_name" content="Appio">
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${ogImageUrl}">

<!-- Theme -->
<meta name="theme-color" content="${themeColor}">

<!-- Redirect real users to the PWA -->
<meta http-equiv="refresh" content="0;url=${safeAppUrl}">
<link rel="canonical" href="${safeAppUrl}">
</head>
<body>
<p>Redirecting to <a href="${safeAppUrl}">${title}</a>...</p>
<p><a href="${sharePageUrl}">View on Appio</a></p>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
