#!/usr/bin/env sh
# StockFlow first-time setup for macOS / Linux. Needs Node.js 20.9+ (LTS) from https://nodejs.org
set -e
cd "$(dirname "$0")"
npm ci --no-audit --no-fund
node local/stockflow.mjs setup
node local/stockflow.mjs autostart on
echo "Done. StockFlow now starts automatically. Open http://localhost:3000"
