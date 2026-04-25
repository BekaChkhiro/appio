#!/usr/bin/env bash
# T2.3 automated scenario runner — exercises every Convex offline /
# reconnect behaviour we can control without a physical device.
#
# Captures empirical numbers into stdout (parsed/stored later by ADR 002).
# Logs persist in the WebView's localStorage SQLite, which we read out via
# WebKit's standard storage path.
#
# Scenarios:
#   3.1   Cold launch × N            — terminate + relaunch + measure
#   3.2   Idle disconnect            — set autorun flag → app drops + restores WS
#   3.3   Queued mutations           — set autorun flag → app drops, fires 5
#                                      mutations, restores WS, drains
#   3.4   Background → resume        — defocus + foreground
#   WV    WebView reap               — kill WebContent processes
#
# 3.5 (WiFi↔cellular) still requires a physical device; not automatable.
set -euo pipefail

UDID="${1:-5A4B71C7-C5F7-4F72-851C-C0312BD88572}"
BUNDLE_ID="app.appio.convexpoc"

# Locate the WebKit LocalStorage SQLite under this app's container.
APP_DATA_ROOT="$HOME/Library/Developer/CoreSimulator/Devices/$UDID/data/Containers/Data/Application"
LS_DB=""
for d in "$APP_DATA_ROOT"/*/; do
  if [ -d "$d/Library/WebKit/$BUNDLE_ID" ]; then
    candidate=$(find "$d/Library/WebKit/$BUNDLE_ID" -name "localstorage.sqlite3" 2>/dev/null | head -1)
    if [ -n "$candidate" ]; then
      LS_DB="$candidate"
      break
    fi
  fi
done
if [ -z "$LS_DB" ]; then
  echo "❌ Could not locate localStorage.sqlite3. Has the app been launched at least once?"
  exit 1
fi
echo "📁 LocalStorage: $LS_DB"

# ─────────────────────────────────────────────────────────────────────────
# Helpers.
# ─────────────────────────────────────────────────────────────────────────

read_key() {
  local key="$1"
  local out="/tmp/appio-poc-ls-$$.bin"
  sqlite3 "$LS_DB" "SELECT writefile('$out', value) FROM ItemTable WHERE key='$key';" >/dev/null 2>&1
  if [ -f "$out" ]; then
    iconv -f UTF-16LE -t UTF-8 "$out" 2>/dev/null
    rm -f "$out"
  fi
}

clear_logs() {
  sqlite3 "$LS_DB" "DELETE FROM ItemTable WHERE key IN ('appio:t2.3:connection-log','appio:t2.3:mutation-audit','appio:t2.3:scenario-results','appio:t2.3:autorun');" >/dev/null 2>&1 || true
}

# WebKit stores localStorage values as UTF-16 LE BLOB. To set a value
# externally we must encode UTF-8 → UTF-16LE then INSERT it as a BLOB.
write_key() {
  local key="$1"
  local value="$2"
  local tmp="/tmp/appio-poc-ls-write-$$"
  printf "%s" "$value" | iconv -f UTF-8 -t UTF-16LE > "$tmp"
  local hex
  hex=$(xxd -p "$tmp" | tr -d '\n')
  rm -f "$tmp"
  sqlite3 "$LS_DB" "INSERT OR REPLACE INTO ItemTable(key, value) VALUES('$key', x'$hex');" >/dev/null
}

cold_launch() {
  local label="$1"
  local t0 t1
  t0=$(date +%s)
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  sleep 1
  xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null 2>&1
  t1=$(date +%s)
  sleep 8
  echo "  $label: terminate→launch wall-clock = $((t1 - t0))s (+ 8s settle)"
}

background_then_resume() {
  local label="$1"
  local seconds="${2:-15}"
  echo "  $label: pushing app to background (launching Settings)"
  xcrun simctl launch "$UDID" "com.apple.Preferences" >/dev/null 2>&1 || true
  sleep "$seconds"
  echo "  $label: foregrounding app"
  xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null 2>&1
  sleep 6
}

reap_webview() {
  local label="$1"
  echo "  $label: killing WebContent processes (simulates iOS reaping)"
  pkill -9 -f "WebContent.*$BUNDLE_ID" 2>/dev/null || true
  pkill -9 -f "com.apple.WebKit.WebContent" 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null 2>&1
  sleep 8
}

# Trigger an in-app autorun scenario: set localStorage flag, restart app,
# wait for the React useEffect to detect + run the scenario, then settle.
# Total budget = scenario duration + 10 s buffer.
run_autorun_scenario() {
  local scenario_id="$1"
  local budget_seconds="$2"
  echo "  scenario $scenario_id: setting autorun flag + launching"
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  sleep 1
  write_key "appio:t2.3:autorun" "$scenario_id"
  xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null 2>&1
  echo "  scenario $scenario_id: running for $budget_seconds s"
  sleep "$budget_seconds"
}

# ─────────────────────────────────────────────────────────────────────────
# Run.
# ─────────────────────────────────────────────────────────────────────────

echo
echo "━━━ Reset all T2.3 logs ━━━"
clear_logs
xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
sleep 1

echo
echo "━━━ Scenario 3.1: Cold launch × 3 ━━━"
cold_launch "cold-1"
cold_launch "cold-2"
cold_launch "cold-3"

echo
echo "━━━ Scenario 3.4: Background → resume (15 s) ━━━"
background_then_resume "bg-resume" 15

echo
echo "━━━ Scenario 3.2: Idle disconnect (in-app WS patch, 30 s offline + 15 s recover) ━━━"
run_autorun_scenario "3.2" 60

echo
echo "━━━ Scenario 3.3: Queued mutations (in-app WS patch, 5 mutations during 30 s offline + 15 s drain) ━━━"
run_autorun_scenario "3.3" 60

echo
echo "━━━ Captured logs ━━━"

echo
echo "── connection-log ──"
read_key "appio:t2.3:connection-log" | python3 -m json.tool 2>/dev/null \
  || read_key "appio:t2.3:connection-log"

echo
echo "── mutation-audit ──"
read_key "appio:t2.3:mutation-audit" | python3 -m json.tool 2>/dev/null \
  || read_key "appio:t2.3:mutation-audit"

echo
echo "── scenario-results ──"
read_key "appio:t2.3:scenario-results" | python3 -m json.tool 2>/dev/null \
  || read_key "appio:t2.3:scenario-results"

echo
echo "✅ Done. Out-of-scope: scenario 3.5 (WiFi↔cellular handoff — physical device only)"
