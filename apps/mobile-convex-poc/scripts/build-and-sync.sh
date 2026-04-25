#!/usr/bin/env bash
# Build the todo-list-convex template and stage it into Capacitor's webDir.
#
# Pass --skip-sync to bypass `cap sync` (used by setup.sh during initial
# bootstrap, before the iOS/Android platforms exist).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE_DIR="$(cd "$ROOT_DIR/../../packages/templates/todo-list-convex" && pwd)"
BASE_DIR="$(cd "$ROOT_DIR/../../packages/templates/base" && pwd)"

SKIP_SYNC=0
for arg in "$@"; do
  case "$arg" in
    --skip-sync) SKIP_SYNC=1 ;;
  esac
done

WORK_DIR="${TMPDIR:-/tmp}/appio-convex-poc-build"

echo "→ Staging build in $WORK_DIR"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"

# Overlay base, then the template.
cp -R "$BASE_DIR"/. "$WORK_DIR"/
cp -R "$TEMPLATE_DIR"/. "$WORK_DIR"/

cd "$WORK_DIR"

# Surface that real Firebase + Convex config is required.
if grep -q "REPLACE_ME" src/config/firebase.ts 2>/dev/null \
   || grep -q "REPLACE_ME" src/config/convex.ts 2>/dev/null; then
  cat >&2 <<'EOF'
⚠️  Firebase or Convex config still has REPLACE_ME placeholders.

Edit packages/templates/todo-list-convex/src/config/{firebase,convex}.ts
with real credentials before running the mobile tests — otherwise the
Convex WebSocket will reject the JWT and you'll measure connection
errors instead of offline latency.
EOF
  exit 1
fi

echo "→ npm install"
npm install --silent --no-audit --no-fund

echo "→ npx convex dev --once (deploys functions + generates _generated/)"
# `convex codegen` alone only writes client types — it does NOT push
# functions/schema. Use `convex dev --once` so the sandbox deployment
# stays in sync with the local convex/ folder, otherwise client queries
# fail with "could not find public function". Auth comes from the user's
# global ~/.convex/config.json (no deploy key needed for personal dev
# deployments).
npx convex dev --once --typecheck=disable

echo "→ esbuild"
node esbuild.config.mjs

echo "→ Substituting template placeholders in index.html (POC values)"
# The base template's index.html has {{PLACEHOLDER}} slots normally
# replaced by the Appio code generator. For the POC we hardcode them.
INDEX_HTML="dist/index.html"
sed -i '' \
  -e 's|{{APP_NAME}}|Appio Convex POC|g' \
  -e 's|{{APP_SHORT_NAME}}|Convex POC|g' \
  -e 's|{{APP_DESCRIPTION}}|T2.3 mobile validation harness|g' \
  -e 's|{{PRIMARY_COLOR}}|#6366f1|g' \
  -e 's|{{PRIMARY_LIGHT_COLOR}}|#818cf8|g' \
  -e 's|{{BACKGROUND_COLOR}}|#f8fafc|g' \
  -e 's|{{SURFACE_COLOR}}|#ffffff|g' \
  -e 's|{{TEXT_PRIMARY_COLOR}}|#0f172a|g' \
  -e 's|{{TEXT_SECONDARY_COLOR}}|#64748b|g' \
  -e 's|{{THEME_COLOR}}|#6366f1|g' \
  "$INDEX_HTML"

# manifest.json carries the same placeholders.
if [ -f "dist/manifest.json" ]; then
  sed -i '' \
    -e 's|{{APP_NAME}}|Appio Convex POC|g' \
    -e 's|{{APP_SHORT_NAME}}|Convex POC|g' \
    -e 's|{{APP_DESCRIPTION}}|T2.3 mobile validation harness|g' \
    -e 's|{{BACKGROUND_COLOR}}|#f8fafc|g' \
    -e 's|{{THEME_COLOR}}|#6366f1|g' \
    "dist/manifest.json"
fi

echo "→ Staging into apps/mobile-convex-poc/www/"
rm -rf "$ROOT_DIR/www"
mkdir -p "$ROOT_DIR/www"
cp -R dist/. "$ROOT_DIR/www/"

if [ "$SKIP_SYNC" -eq 0 ]; then
  cd "$ROOT_DIR"
  echo "→ npx cap sync"
  npx cap sync
fi

echo "✅ Build + stage complete."
