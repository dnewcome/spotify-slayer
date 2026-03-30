#!/usr/bin/env bash
# devsnap.sh — capture a devlog snapshot
# Usage: scripts/devsnap.sh [--note "optional note"] [--port 9001] [--no-screenshot] [--window]
#
# Screenshot modes (tried in order unless --window is set):
#   default : Chrome headless — good for CI/no display, but no WebGL
#   --window: grab the live window showing the app — captures real WebGL visuals
#             tries xdotool to find the browser window by title, falls back to full screen
#
# Reads DEVSNAP_PORT env var for port (default 9001).
# Creates devlog/YYYY-MM-DD-HHmmss-<slug>.md with screenshot if server is up.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEVLOG_DIR="$REPO_ROOT/devlog"
ASSETS_DIR="$DEVLOG_DIR/assets"
PORT="${DEVSNAP_PORT:-9001}"
NOTE=""
SKIP_SCREENSHOT=0
WINDOW_MODE=0

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --note) NOTE="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --no-screenshot) SKIP_SCREENSHOT=1; shift ;;
    --window) WINDOW_MODE=1; shift ;;
    *) NOTE="$1"; shift ;;
  esac
done

DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)

# Build slug from commit message or note
COMMIT_MSG=$(git -C "$REPO_ROOT" log -1 --pretty=%s 2>/dev/null || echo "snapshot")
# Strip [snap] tag and sanitize to slug
RAW_SLUG="${NOTE:-$COMMIT_MSG}"
SLUG=$(echo "$RAW_SLUG" | sed 's/\[snap\]//g' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-48)

ENTRY_FILE="$DEVLOG_DIR/${TIMESTAMP}-${SLUG}.md"
SCREENSHOT_FILE="$ASSETS_DIR/${TIMESTAMP}-${SLUG}.png"
SCREENSHOT_REL="assets/${TIMESTAMP}-${SLUG}.png"

# --- Screenshot ---
SCREENSHOT_STATUS="no screenshot"
if [[ $SKIP_SCREENSHOT -eq 0 ]]; then

  if [[ $WINDOW_MODE -eq 1 ]]; then
    # Window mode: capture the live screen (shows real WebGL)
    # Wayland: use grim; X11: use xdotool + import
    echo "📸 Capturing live screen..."
    if [[ "${XDG_SESSION_TYPE:-}" == "wayland" ]] || [[ -n "${WAYLAND_DISPLAY:-}" ]]; then
      # Wayland path
      if command -v grim &>/dev/null && grim "$SCREENSHOT_FILE" 2>/dev/null; then
        # wlroots-based compositor (Sway, Hyprland, etc.)
        SCREENSHOT_STATUS="captured (grim/wayland)"
      else
        # GNOME Wayland: PrtSc saves to ~/Pictures/Screenshots — wait for user
        SHOTS_DIR="$HOME/Pictures/Screenshots"
        mkdir -p "$SHOTS_DIR"
        # Record newest file before the prompt
        BEFORE=$(ls -t "$SHOTS_DIR"/*.png 2>/dev/null | head -1 || true)
        echo ""
        echo "  ┌─────────────────────────────────────────────────┐"
        echo "  │  Press PrtSc to take a screenshot, then         │"
        echo "  │  press Enter here when done.                    │"
        echo "  └─────────────────────────────────────────────────┘"
        read -r _
        # Find the newest file added after the prompt
        AFTER=$(ls -t "$SHOTS_DIR"/*.png 2>/dev/null | head -1 || true)
        if [[ -n "$AFTER" && "$AFTER" != "$BEFORE" ]]; then
          cp "$AFTER" "$SCREENSHOT_FILE"
          SCREENSHOT_STATUS="captured (gnome prtsc)"
        else
          echo "⚠️  No new screenshot detected in $SHOTS_DIR"
          SCREENSHOT_STATUS="no new screenshot"
        fi
      fi
    else
      # X11 path
      WIN_ID=""
      if command -v xdotool &>/dev/null; then
        WIN_ID=$(xdotool search --onlyvisible --name "Threequencer" 2>/dev/null | head -1 || true)
        [[ -z "$WIN_ID" ]] && WIN_ID=$(xdotool search --onlyvisible --name "localhost:$PORT" 2>/dev/null | head -1 || true)
        [[ -z "$WIN_ID" ]] && WIN_ID=$(xdotool search --onlyvisible --name "localhost" 2>/dev/null | head -1 || true)
      fi
      if [[ -n "$WIN_ID" ]]; then
        echo "   Found window $WIN_ID via xdotool"
        import -window "$WIN_ID" "$SCREENSHOT_FILE" 2>/dev/null \
          && SCREENSHOT_STATUS="captured (window)" \
          || SCREENSHOT_STATUS="import failed"
      else
        echo "   Window not found — capturing full screen"
        import -window root "$SCREENSHOT_FILE" 2>/dev/null \
          && SCREENSHOT_STATUS="captured (full screen)" \
          || SCREENSHOT_STATUS="import failed"
      fi
    fi

  else
    # Default mode: Chrome headless (no display needed, no WebGL)
    # Resolve chrome binary across Linux and macOS
    CHROME_BIN=""
    for candidate in \
      google-chrome \
      google-chrome-stable \
      chromium \
      chromium-browser \
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    do
      if command -v "$candidate" &>/dev/null || [[ -x "$candidate" ]]; then
        CHROME_BIN="$candidate"
        break
      fi
    done

    if curl -sf --max-time 2 "http://localhost:$PORT" > /dev/null 2>&1; then
      echo "📸 Taking screenshot of http://localhost:$PORT ..."
      if [[ -z "$CHROME_BIN" ]]; then
        SCREENSHOT_STATUS="chrome not found"
        echo "⚠️  Chrome/Chromium not found — skipping screenshot"
      else
        "$CHROME_BIN" \
          --headless=new \
          --disable-gpu \
          --no-sandbox \
          --window-size=1280,720 \
          --screenshot="$SCREENSHOT_FILE" \
          "http://localhost:$PORT" \
          2>/dev/null && SCREENSHOT_STATUS="captured" || SCREENSHOT_STATUS="chrome failed"
      fi
    else
      SCREENSHOT_STATUS="server not running on port $PORT"
      echo "⚠️  Server not running on port $PORT — skipping screenshot"
    fi
  fi
fi

# --- Git context ---
GIT_HASH=$(git -C "$REPO_ROOT" log -1 --pretty=%h 2>/dev/null || echo "")
GIT_MSG=$(git -C "$REPO_ROOT" log -1 --pretty=%s 2>/dev/null || echo "")
GIT_DATE=$(git -C "$REPO_ROOT" log -1 --pretty=%ci 2>/dev/null || date)
FILES_CHANGED=$(git -C "$REPO_ROOT" diff --name-only HEAD~1 HEAD 2>/dev/null | head -20 | sed 's/^/  - /' || echo "  (no diff)")

# --- Write entry ---
{
  echo "# ${NOTE:-$GIT_MSG}"
  echo ""
  echo "_${DATE}_"
  echo ""
  if [[ "$SCREENSHOT_STATUS" == "captured" ]]; then
    echo "![]($SCREENSHOT_REL)"
    echo ""
  fi
  echo "## What happened"
  echo ""
  echo "<!-- Claude or you: fill this in -->"
  echo ""
  if [[ -n "$NOTE" ]]; then
    echo "> $NOTE"
    echo ""
  fi
  echo "## Files touched"
  echo ""
  echo "$FILES_CHANGED"
  echo ""
  echo "## Tweet draft"
  echo ""
  echo "<!-- fill me in -->"
  echo ""
  echo "---"
  echo ""
  echo "_commit: ${GIT_HASH} · screenshot: ${SCREENSHOT_STATUS}_"
} > "$ENTRY_FILE"

echo "✅ Devlog entry: $ENTRY_FILE"
if [[ "$SCREENSHOT_STATUS" == "captured" ]]; then
  echo "   Screenshot: $SCREENSHOT_FILE"
fi
