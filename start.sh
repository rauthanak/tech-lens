#!/usr/bin/env bash
# ── tech-lens · DEV ───────────────────────────────────────────────────
# http://localhost:3100  (expects tech-atlas on :8100)
set -e
cd "$(dirname "$0")"
npm install
npm run dev
