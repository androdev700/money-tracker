#!/usr/bin/env bash
# Installs Money Tracker as an always-on service on this Mac. Safe to re-run (also how you update).
#   scripts/install-mac.sh                 everything
#   SKIP_OLLAMA=1 scripts/install-mac.sh   regex parsing only, no local LLM
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL=com.money-tracker
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/money-tracker"
MODEL="${OLLAMA_MODEL:-qwen2.5:3b}"
DOMAIN="gui/$(id -u)"

step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }

if [[ $EUID -eq 0 ]]; then
  echo "Run this without sudo: as root it leaves files you can't update later. It asks for your password if it needs it."
  exit 1
fi

command -v brew >/dev/null || { echo "Homebrew is required: https://brew.sh"; exit 1; }

step "Node"
if ! command -v node >/dev/null || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)'; then
  brew install node
fi
NODE_BIN="$(command -v node)"
echo "$NODE_BIN $(node -v)"

if [[ "${SKIP_OLLAMA:-0}" != 1 ]]; then
  step "Ollama + $MODEL"
  command -v ollama >/dev/null || brew install ollama
  brew services start ollama >/dev/null
  for _ in {1..20}; do curl -sf http://127.0.0.1:11434/api/tags >/dev/null && break; sleep 1; done
  ollama pull "$MODEL"
fi

step "Build"
cd "$APP_DIR"
npm ci --no-audit --no-fund
npm run build
mkdir -p data "$LOG_DIR"
if [[ ! -f .env ]]; then
  cp .env.example .env
  [[ "${SKIP_OLLAMA:-0}" == 1 ]] && sed -i '' 's#^OLLAMA_URL=.*#OLLAMA_URL=#' .env
  echo "Created .env — add GMAIL_USER and GMAIL_APP_PASSWORD, then re-run this script."
fi
chmod 600 .env

step "launchd service ($LABEL)"
NEW_PLIST="$(mktemp)"
sed -e "s#__NODE__#$NODE_BIN#g" -e "s#__APP_DIR__#$APP_DIR#g" -e "s#__LOG_DIR__#$LOG_DIR#g" \
  scripts/com.money-tracker.plist > "$NEW_PLIST"

# Over SSH the GUI domain refuses bootstrap/bootout from your shell ("125: Domain does not support
# specified action"); root may act on it as long as you're logged in on the Mac itself.
lctl() {
  launchctl "$@" 2>/dev/null && return 0
  [[ -n "${SSH_CONNECTION:-}" ]] && sudo launchctl "$@"
}

if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1 && cmp -s "$NEW_PLIST" "$PLIST"; then
  # Same definition already loaded: restarting picks up the new code, no unload needed.
  lctl kickstart -k "$DOMAIN/$LABEL" || { echo "Could not restart $LABEL."; exit 1; }
else
  install -m 644 "$NEW_PLIST" "$PLIST"
  if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
    lctl bootout "$DOMAIN/$LABEL" || true
    for _ in {1..20}; do launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1 || break; sleep 0.25; done
  fi
  if ! lctl bootstrap "$DOMAIN" "$PLIST"; then
    echo "Could not load $LABEL into $DOMAIN. Make sure you're logged in on the Mac (auto-login, or via"
    echo "Screen Sharing), then re-run this script — from Terminal on the Mac if SSH keeps failing."
    exit 1
  fi
  lctl enable "$DOMAIN/$LABEL"
fi
rm -f "$NEW_PLIST"
PORT="$(grep -E '^PORT=' .env | cut -d= -f2 || true)"; PORT="${PORT:-4100}"
for _ in {1..20}; do curl -sf "http://127.0.0.1:$PORT/api/status" >/dev/null && break; sleep 0.5; done
curl -sf "http://127.0.0.1:$PORT/api/status" >/dev/null && echo "Running on http://127.0.0.1:$PORT (logs: $LOG_DIR/server.log)" \
  || { echo "Service did not come up — see $LOG_DIR/server.log"; exit 1; }

step "Tailscale"
TS="$(command -v tailscale || true)"
[[ -z "$TS" && -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]] && TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale
if [[ -n "$TS" ]]; then
  "$TS" serve --bg "$PORT"
  "$TS" serve status
else
  echo "Tailscale not found. Install it (https://tailscale.com/download/mac), log in, then re-run this script."
fi
