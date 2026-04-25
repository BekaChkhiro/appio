#!/usr/bin/env bash
# One-time setup for the T2.3 mobile validation harness.
#
# Generates the iOS + Android native projects on the machine running the
# experiment. We do NOT commit these — they're regenerated per machine
# (CocoaPods + Gradle wrappers are platform-specific and would otherwise
# bloat the repo + pin Pods versions to whoever ran cap add first).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d node_modules ]; then
  echo "→ Installing JS dependencies"
  npm install
fi

# Need a webDir before `cap add` succeeds. Build the template first so
# Capacitor has something real to copy.
echo "→ Building todo-list-convex into www/"
bash scripts/build-and-sync.sh --skip-sync

if [ ! -d ios ]; then
  echo "→ Adding iOS platform (requires Xcode + CocoaPods)"
  npx cap add ios
fi

if [ ! -d android ]; then
  echo "→ Adding Android platform (requires Android Studio + JDK 17)"
  npx cap add android
fi

echo "→ Initial sync"
npx cap sync

cat <<'EOF'

✅ Setup complete.

Next:
  npm run open:ios       # opens Xcode workspace
  npm run open:android   # opens Android Studio

Then follow docs/runbooks/t2.3-mobile-validation.md for the test scenarios.
EOF
