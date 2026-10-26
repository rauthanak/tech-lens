#!/usr/bin/env bash
# ── tech-lens · PROD ──────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"
# the locked versions, installed only when package-lock.json changed since the last install
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then npm ci; fi
npm run build
npm run start
