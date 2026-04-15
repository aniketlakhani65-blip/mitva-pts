#!/bin/bash
# =============================================================================
# Mitva PTS — one-click setup + run (macOS / Linux)
# On macOS: double-click this file in Finder.
# First time, you may need to: right-click -> Open (to bypass Gatekeeper).
# =============================================================================

set -e
cd "$(dirname "$0")"

echo ""
echo "============================================================"
echo "  Mitva PTS - Setup and Run"
echo "============================================================"
echo ""

# --- Check Node is installed -------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not installed or not on PATH."
    echo "Download it from https://nodejs.org and install the LTS version."
    read -n 1 -s -r -p "Press any key to close..."
    exit 1
fi

echo "[1/4] Installing dependencies (this takes a few minutes the first time)..."
npm install

if [ ! -f "prisma/dev.db" ]; then
    echo ""
    echo "[2/4] Creating the local SQLite database..."
    npx prisma migrate dev --name init

    echo ""
    echo "[3/4] Loading seed data (admin user, stages, sample orders)..."
    npm run db:seed
else
    echo ""
    echo "[2/4] Database already exists - skipping migrate."
    echo "[3/4] Skipping seed (already loaded)."
fi

echo ""
echo "============================================================"
echo "  [4/4] Starting the app on http://localhost:3000"
echo ""
echo "  Log in with:"
echo "    Email:    admin@mitva.local"
echo "    Password: admin123"
echo ""
echo "  Press Ctrl+C in this window to stop the server."
echo "============================================================"
echo ""

# Open the browser after a short delay, in the background
( sleep 6 && (command -v open >/dev/null && open http://localhost:3000 || xdg-open http://localhost:3000) ) &

npm run dev
