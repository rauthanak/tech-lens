# Tech Lens

Tech Lens is the web portal for **[Tech Atlas](https://github.com/rauthanak/tech-atlas)** —
the browser app where you manage sources, watch crawl runs, and explore the
scored technology radar. It is a Next.js app that talks to the Tech Atlas API.

## How to run it

Everything (this portal, the Tech Atlas API, and the database) starts together
with one command using Docker — **follow the step-by-step guide in the
[Tech Atlas README](https://github.com/rauthanak/tech-atlas#readme)**. It is
written for people who have never coded: you download both projects side by
side, install Docker Desktop, and run `docker compose up` from the
`tech-atlas` folder. The portal then runs at <http://localhost:3100>.

## For developers (run without Docker)

Needs Node.js, plus the Tech Atlas API running on port 8100.

- macOS/Linux: `./start.sh`
- Windows: double-click `start.bat` (runs `start.ps1`)

Both do `npm install` and start the dev server on <http://localhost:3100>.
Requests to `/api/*` are proxied to the API (`TECH_ATLAS_API_URL`, default
`http://127.0.0.1:8100` — see `next.config.ts`).
