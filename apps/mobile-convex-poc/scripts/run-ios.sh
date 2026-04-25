#!/usr/bin/env bash
# Build + install + launch the harness on an iOS Simulator.
#
# Why not `npx cap run ios`: that helper builds into `ios/DerivedData/`
# which sits inside the repo. When the repo lives in an iCloud-synced
# location (the default for ~/Desktop on modern macOS), the FileProvider
# daemon stamps every build artefact with a `com.apple.fileprovider.fpfs`
# extended attribute that codesign refuses with:
#   "resource fork, Finder information, or similar detritus not allowed"
# Symptom: every iOS build fails on CodeSign of CapacitorCordova.framework.
#
# Fix: build into /tmp (never iCloud-synced) by passing -derivedDataPath
# explicitly, then install + launch via simctl.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Pick the first booted iPhone, or boot iPhone 17 Pro if none.
TARGET_UDID="${1:-}"
if [ -z "$TARGET_UDID" ]; then
  TARGET_UDID=$(xcrun simctl list devices booted | grep -oE '\([A-F0-9-]{36}\)' | head -1 | tr -d '()')
fi
if [ -z "$TARGET_UDID" ]; then
  echo "→ No booted simulator — booting iPhone 17 Pro"
  TARGET_UDID=$(xcrun simctl list devices available | grep -m1 "iPhone 17 Pro " | grep -oE '\([A-F0-9-]{36}\)' | tr -d '()')
  xcrun simctl boot "$TARGET_UDID"
  open -a Simulator
fi

echo "→ Target: $TARGET_UDID"

DERIVED="/tmp/appio-convex-poc-derived"
APP_PATH="$DERIVED/Build/Products/Debug-iphonesimulator/App.app"
BUNDLE_ID="app.appio.convexpoc"

echo "→ Building (DerivedData → $DERIVED, outside iCloud)"
xcodebuild \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -destination "id=$TARGET_UDID" \
  -derivedDataPath "$DERIVED" \
  -quiet \
  build

if [ ! -d "$APP_PATH" ]; then
  echo "❌ Expected app bundle not found at $APP_PATH"
  exit 1
fi

echo "→ Installing"
xcrun simctl install "$TARGET_UDID" "$APP_PATH"

echo "→ Launching"
xcrun simctl launch "$TARGET_UDID" "$BUNDLE_ID"

echo "✅ Running. Simulator window should be in the foreground."
