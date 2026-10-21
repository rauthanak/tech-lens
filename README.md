# Tech Lens

Tech Lens is the web portal for **[Tech Atlas](https://github.com/rauthanak/tech-atlas)** —
the browser app for the technology radar. It is a Next.js app that talks to the
Tech Atlas API.

It serves two addresses from one build: the analysts' portal, and
**Frontier**, the leaders' read-only screen.

What's in the portal, from the top menu (**Briefing · Technologies · Points of
View | Operations · Setup**):

- **Briefing** (home): two to-do lists first, **Before scoring (Gate 1)** and
  **Before publishing (Gate 2)**, each row with its count and a link to where
  it's done; then what was found on the watched sources, your signal types
  first, over a window you choose or one collection. Click a finding for the
  quote and its source in a side panel.
- **Technologies**: the register, with views (tracked, not assessed, emerging,
  mature, possible nascent, imported with little evidence, switched off) and
  filters (commercial availability, domain, TRL, evidence, fabric). Each row
  has an on/off switch; several can be switched together; "+ Add technology"
  adds one by hand. One page per technology says where it stands and its next
  step, its commercial availability, TRL, domain and evidence (each with why),
  then a tab per fabric with its priority, measures, use cases and path to
  scale. Find evidence and Add a link fill an evidence gap.
- **Points of View**: the written conclusions, each with when it was written,
  in the writer's time zone, and what's new since.
- **Operations**: collect, organize, classify, assess and write; problems with
  their fixes; and the history of every run that used the model, with its
  tokens in, out and reused, by skill.
- **Setup**: Sources, Signal list, Scoring method (method, fabrics, measures,
  weights and grid, open questions), Classification (commercial availability,
  domains and sub-domains, TRL levels), Path to scale, Import technologies,
  Finance, Skills (with "Where each skill is used"), Crawl settings, and
  Changes (edits not yet in the seeding data).

**Frontier** ("Executive view" in the top bar) is the screen for Tata's
leaders, at its own address: the priority grid and table by fabric, what isn't
placed yet and why, and each Point of View. Nothing else is reachable from it:
no Setup, no runs, no buttons that use the model.

The status pill at the top right always says what is running, and every button
that uses the model says about how many model calls it takes before it starts.
The Technical details switch, on pages that have one, adds code names, ids and
inventory counts; everything else is in plain words.

## How to run it

Everything (this portal, the Tech Atlas API, and the database) starts together
with one command using Docker — **follow the step-by-step guide in the
[Tech Atlas README](https://github.com/rauthanak/tech-atlas#readme)**. It is
written for people who have never coded: you download both projects side by
side, install Docker Desktop, and run `docker compose up` from the
`tech-atlas` folder. The portal then runs at <http://localhost:3100>, and
Frontier at <http://localhost:3200>.

## For developers (run without Docker)

Needs Node.js, plus the Tech Atlas API running on port 8100.

- macOS/Linux: `./start.sh`
- Windows: double-click `start.bat` (runs `start.ps1`)

Both do `npm install` and start the dev server on <http://localhost:3100>.
Requests to `/api/*` are proxied to the API (`TECH_ATLAS_API_URL`, default
`http://127.0.0.1:8100` — see `next.config.ts`). The same app serves Frontier
when started with `APP_SIDE=frontier` (see `proxy.ts`).
