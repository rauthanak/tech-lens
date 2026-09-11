#!/usr/bin/env bash
# ── tech-lens · PROD ──────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"
npm install
npm run build
npm run start
