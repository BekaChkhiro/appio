"""App-wide constants."""

APP_NAME = "Appio"
API_VERSION = "v1"

# Tier limits
FREE_TIER_MAX_APPS = 2
FREE_TIER_DAILY_GENERATIONS = 100  # local testing — production uses 3
PRO_TIER_DAILY_GENERATIONS = 0  # unlimited
CREATOR_TIER_DAILY_GENERATIONS = 0  # unlimited

# Monthly token budgets (USD) — automatic blocking when exceeded
FREE_TIER_MONTHLY_BUDGET_USD = 50.00  # local testing — production uses 1.00
PRO_TIER_MONTHLY_BUDGET_USD = 50.00
CREATOR_TIER_MONTHLY_BUDGET_USD = 100.00

# IP rate limits
MAX_ACCOUNT_CREATIONS_PER_IP_PER_DAY = 3

# Progressive friction: first N generations are instant, then cooldown applies
INSTANT_GENERATIONS_BEFORE_COOLDOWN = 2
COOLDOWN_SECONDS = 30

# Build limits
MAX_BUILD_TIMEOUT_SECONDS = 60
MAX_AUTOFIX_RETRIES = 2
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB

# Allowed output file extensions for builds
ALLOWED_BUILD_EXTENSIONS = {
    ".html", ".js", ".css", ".svg", ".png", ".ico",
    ".webp", ".json", ".woff2",
}

# Forbidden code patterns (pre-build scan)
FORBIDDEN_PATTERNS = [
    "child_process", "fs", "net", "eval", "Function(",
    "dangerouslySetInnerHTML", "innerHTML", "outerHTML",
    "document.write", "window.location", "javascript:",
    "importScripts", "postMessage", "__proto__",
    "constructor[", "opener", "top.", "parent.",
    # T2.7 expansions
    "document.cookie", "XMLHttpRequest", "sendBeacon",
    "SharedArrayBuffer", "Atomics",
]
