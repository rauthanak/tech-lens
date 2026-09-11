# ── tech-lens · DEV (Windows) ─────────────────────────────────────────
# http://localhost:3100  (expects tech-atlas on :8100)
# Windows equivalent of start.sh.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "error: need Node.js — install from https://nodejs.org" -ForegroundColor Red
  exit 1
}

npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run dev
