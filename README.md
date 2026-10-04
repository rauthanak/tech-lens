# Tech Lens

Tech Lens is the web portal for **[Tech Atlas](https://github.com/rauthanak/tech-atlas)** —
the browser app for the technology radar. It is a Next.js app that talks to the
Tech Atlas API.

What's in it, from the top menu:

- **Briefing** (home): what the latest collections found, grouped by technology,
  with what is waiting for the analyst and new Points of View.
- **Signals**: every signal found, on the list or not, and the pages set aside;
  click one for the full story in a side panel.
- **Technologies**: the register, and one page per technology that follows it
  from its signals to its assessment and Point of View.
- **Points of View**: the deliverables, with what's new since each was written.
- **Operations**: each step of the process with its next action, problems with
  their fixes, and the history of collections and assessment runs.
- **Setup**: sources, the signal list, the scoring method, skills, crawl
  settings, and Changes (edits not yet in the seeding data).

The status pill at the top right always says what is running, and every button
that uses the model says about how many model calls it takes before it starts.

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
