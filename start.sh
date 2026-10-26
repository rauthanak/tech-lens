#!/usr/bin/env bash
# ── tech-lens · DEV ───────────────────────────────────────────────────
# http://localhost:3100  (expects tech-atlas on :8100)
set -e
cd "$(dirname "$0")"
# the locked versions, installed only when package-lock.json changed since the last install
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then npm ci; fi
npm run dev
