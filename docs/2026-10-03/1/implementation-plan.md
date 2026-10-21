# Implementation plan 1: signals and one clear process

**App:** tech-lens (portal) · **Date:** 2026-10-03 · **Status:** signed off and implemented on 2026-10-03 (see the build notes at the end).
**Companion:** [tech-atlas plan](../../../../tech-atlas/docs/2026-10-03/1/implementation-plan.md). Its §2 holds the decisions and its §7 the API contract this portal uses.

---

## 1. Summary

What changes for the people using the portal:

1. **A process strip at the top of every page:**
   **Collect evidence → Identify signals → Organize technologies → Assess opportunities → Produce Points of View.**
   Each step shows its status, one number and one button, and steps that need you are highlighted.
2. **A Signals page:** what was found (with quotes and implications), "Other" developments, pages set aside and why, and the editable list. That list has two sections, *Never miss* and *Always ignore*.
3. **The menu follows the process, and all setup sits in one place:** Sources, Signal list, Scoring method, Skills.
4. **The run page tells one story, using recorded facts only.** This run's collection, signals and technologies come first, then the assessments whose evidence actually included its pages. The "HAND-OFF · SEPARATE CLOCK" split is gone. Anything based only on timing is labelled "Latest workspace activity".
5. **Plain words by default.** Technical detail (agents, sub-stages, model calls) sits behind an *Under the hood* switch.
6. **Sources show how each one is read:** website, data source, or never. You can edit start pages, saved searches and crawl settings.
7. **A Changes page under Setup.**
   - It lists every configuration edit that isn't in the seeding data, with the seeding value next to the live value.
   - Edits take effect the moment they're saved. **Update seeding data** writes the ones you tick into the seeding data, so the next deployment ships with them.
   - The menu item shows how many edits there are.

Never-miss signals add emphasis; always-ignore rules set qualifying pages aside (atlas plan §2, decisions 1 and 5).

## 2. Before writing code

- **Read the Next.js docs first.** `AGENTS.md` warns that this Next.js version (16) has breaking changes. Before writing code, read the relevant guides in `node_modules/next/dist/docs/` (routing, client components, data fetching, `useParams`, `useSearchParams`) and heed deprecation notices.
- **Rebuild after changes.** The portal in Docker is a production build, so changes need `next build`, or `docker compose up --build` from tech-atlas.
- **Keep the house style:** copper accent `#8a4b2d`, mono eyebrows, flat cards, `BackendError` for first-load failures and silent polling.
- **Keep it simple:**
  - plain React state and `fetch`, as the existing pages do;
  - no new libraries: no state manager, UI kit or diff library;
  - shared components only where a piece is used twice or more.
  - If something turns out more complex than this plan suggests, stop and ask first.

## 3. Menu

| Group | Item | Route | Status |
|---|---|---|---|
| Process | Overview | `/admin` | existing |
| | Collect evidence | `/admin/runs` | existing (renamed from "Runs") |
| | Signals | `/admin/signals` | **new** |
| | Technologies | `/admin/technologies` | existing |
| | Assessments | `/admin/scoring/assessments` | existing route; moves out of the Scoring tabs |
| | Points of View | `/admin/scoring/pov` | existing route; moves out of the Scoring tabs |
| Setup | Sources | `/admin/sources` | existing |
| | Signal list | `/admin/signals?tab=list` | **new** (a tab of the Signals page) |
| | Scoring method | `/admin/scoring` | existing |
| | Skills | `/admin/prompts` | existing |
| | Changes | `/admin/changes` | **new**, with a count badge when any edit isn't in the seeding data |

- **Sidebar footer:** the *Under the hood* switch (§7).
- **Routes:** all existing routes stay, so no links break.
- **Scoring tab bar:** only the menu and the tab bar change. `app/admin/scoring/layout.tsx` shows the setup tabs on setup routes only: *Method* (the old Overview), Fabrics, Measures, Weights & Grid, and *Open questions* (the old Pending decisions). It hides the tab bar on Assessments and Points of View.
- **Active state:** a menu item is highlighted for its own route only. Assessments and Points of View no longer light up "Scoring".

## 4. Process strip

**What and where**
- New component `components/ProcessStrip.tsx`, rendered by `app/admin/layout.tsx` above every page.
- It is hidden in print (`print:hidden`), so the PDF of a Point of View stays clean.

**Data**
- One call: `GET /api/pipeline` (atlas §7).
- Refresh every 5 s while anything runs (collection, re-check, resolve, scoring, composing), otherwise every 30 s.
- Also refresh when the browser tab regains focus.
- A failed poll keeps the last data on screen.

**Steps**

| Step | Number | Status text | Button |
|---|---|---|---|
| Collect evidence | Pages in the latest run (new ones in brackets) | "Collecting…" while running · "✓ {date}" · "Stopped {date}" · "Not run yet". When `collect.incomplete` > 0, add "{n} sources incomplete". | **Start run**: `POST /api/runs`. Disabled while a run or re-check is active, with the reason as a tooltip. |
| Identify signals | Never-miss hits found in the latest run (new or changed pages only), with Other and set aside beneath | "Re-check needed: {n} pages" when `stale_pages` > 0 · "Re-checking {done}/{total}" · "✓" | **Open**: `/admin/signals` |
| Organize technologies | Technologies in the register | "Organizing…" while a resolve runs · "✓ {date}" | **Review**: `/admin/technologies` |
| Assess opportunities | Technologies assessed in the latest scoring run | "Assessing {done}/{total}" · "New evidence since the last assessment" when `new_evidence` (a statement about timing, not use) · "✓ {date}" | **Assess**: `/admin/scoring/assessments`, where the evidence floor is chosen. Running and resuming are disabled while a re-check runs. |
| Produce Points of View | Composed, with pending beneath | "Writing {done}/{total}" · "{n} to write" · "✓" | **Write**: `/admin/scoring/pov` |

**Behaviour**
- The current page's step is highlighted.
- *Needs you* states get a copper outline: Re-check needed, New evidence since the last assessment, and Points of View to write.
- The strip wraps on narrow windows.
- **One visual language:** the strip replaces the run page's ladder and the scoring run's small `StageFlow`. Both move under the hood.

## 5. Pages

### 5.1 Signals (`/admin/signals`, new)

The page has four tabs, selected with `?tab=found|other|set-aside|list`. The default is *found*.

**Banner, on every tab**
- When `stale_pages` > 0 it reads: "**{n} pages** were checked against an older list. Re-check them ({n} model calls)."
- **Re-check** has an inline "Start re-check? / Cancel" confirmation, then calls `POST /api/signals/recheck`.
- Progress comes from the `recheck` job in `GET /api/signals`.
- The button is disabled while a collection run or an assessment run is active, with the reason shown. A re-check rewrites stored summaries, so it never runs alongside either.
- An `interrupted` job shows "Interrupted: re-check to finish the remaining pages".

**Found**
- **Filters:** signal (select), technology (debounced search), source (select), run (select, defaulting to "all"), and "since" (date).
- **Hit cards:**
  - the signal name as a copper chip;
  - **what** happened, in bold;
  - who and when;
  - the *implication*;
  - the quote, in italic and muted;
  - the page title as a link, plus source, collected date and a run link;
  - technology chips, each linking to the technology page.
- 50 cards per page, with "Load more".
- **Empty state:** "No signals found yet. Run a collection, or re-check stored pages."

**Other**
- Groups by label, each with its count and up to 3 examples (what, plus a link).
- **Make it a signal** opens the List editor prefilled: name = the label, look-for = the first example's *what*, mode = Never miss.

**Set aside**
- Pages with the rule that set them aside, their summary and a link. Can be filtered by run.
- A line explains: "Kept for checking; excluded from technologies and scoring."

**List**
- **Two sections, Never miss and Always ignore.** Each row shows:
  - the name and the look-for text (truncated);
  - an on/off toggle, which saves immediately;
  - hits in total and in the last run. Zero shows in amber as "not seen yet: check sources";
  - an **Edit** button.
- **Editor panel:** on the right, sticky.
  - **Fields:** name; *what to look for*, with the helper text "Describe it in plain words, including what makes it significant"; mode; enabled.
  - **Buttons:** Save, Cancel, and Delete, which confirms inline: "Delete this signal? It stops applying from the next run and is listed in Changes. Past hits keep their name." To pause a signal instead, switch it off.
  - API validation messages (409 duplicate name, 422 reserved name) appear next to the field.
- **Add signal** opens an empty editor.
- A note under the list reads: "Edits apply from the next run. Stored pages need a re-check, offered in the banner."

### 5.2 Sources

**List** (`components/SourceBrowser.tsx`)
- New column *How it's read*: **Website**, **Data source** (with the adapter's label), or **Never** (with the note as a tooltip).
- New filter segment: All · Website · Data source · Never.
- *Never* rows show a lock. Their enabled dot is replaced by "not collectable".
- Data sources with a backlog show an amber **Incomplete** badge: "{n} still to collect", the sum of `progress[*].remaining`, or "too broad" when a search is marked so.
- The header gets a **Crawl settings** link.

**Editor** (`/admin/sources/[id]`) adds:
- **Website sources:**
  - **Start pages:** a list editor. Empty means start from the source URL. Help text: "RSS or Atom feeds work too."
  - **Follow links to other sites, one hop:** a toggle. Help text: "For link aggregators such as Hacker News."
- **Data sources:**
  - **Saved searches:** a list editor. The format help, example and a *Not configured: set {keys}* warning come from `GET /api/sources/adapters`.
  - **Progress per saved search,** shown beside each search: "collected through {through} · {remaining} still to collect · checked {checked_at}". A backlog shows in amber with the hint "Raise the page budget or narrow the search." A search marked `too_broad` shows "Too broad: narrow the search" in amber. Removing a search also removes its progress.
- **Never sources:** every field is read-only. The note shows why, and the enabled toggle is disabled.

**Crawl settings** (`/admin/sources/settings`, new)
- **Fields:**
  - *Links the crawler never follows* (a list editor);
  - *Page part size* (characters), with the help text "Pages longer than this are split into parts and processed in parallel; nothing is cut";
  - *Parts processed in parallel*;
  - *First-run lookback (days)* for data sources.
- Uses `GET` and `PUT /api/settings/crawl`. 422 messages appear inline.

### 5.3 Collect evidence: runs list and run page

**Runs list** (`/admin/runs`)
- The title becomes "Collect evidence".
- New *Signals* column, showing "{never miss} · {set aside}" from the run's totals, or "—" for older runs.

**Run page** (`/admin/runs/[id]`). This replaces the 30/70 ladder:
1. **Header:** unchanged (status, times, Terminate).
2. **Three step cards in a row**, matching the strip's look:
   - **Collect evidence:** sources, pages, documents, new.
   - **Identify signals:** never miss, other, set aside. Links to Signals filtered to this run.
   - **Organize technologies:** resolve status and technology count. "Skipped: another organize was running" when there is no resolve.
3. **Used in.** Recorded facts only, from `used_in`:
   - **When the run's pages were used:** for each assessment run whose assessments read this run's pages, "Used in assessments of {n} technologies (assessment run {id}, {date})", with a link. Then the number of Points of View built from them.
   - **When none were used:** "Not used in any assessment yet. Review technology names, then choose what to assess," with **Technologies** and **Assessments** buttons.
   - **Assessments from before the upgrade:** "Not recorded for assessments before the upgrade."
   - **Latest workspace activity,** in a separate, muted line under its own label, from `latest_activity`: "Latest workspace activity: assessment run {id} started {date}". It is never worded as if this run's pages were used.
4. **Sources table:** the existing table, grouped by horizon, plus:
   - a *How it's read* icon;
   - the per-source error text;
   - an amber **Incomplete** badge with the source's `incomplete_note`, such as "page budget reached: 120 links not visited" or "25 still to collect".
5. **Under the hood** (switch on only):
   - the stage timeline and sub-stage history (planning, dispatching, supervisors);
   - the resolver phases with timings and model calls.

   These reuse the existing drill-down pieces (`FlowBox`, `RESOLVE_PHASES` and so on), moved here.

**Removed:** the *HAND-OFF · SEPARATE CLOCK* divider and the boxes showing the latest scoring run and Point of View count from anywhere.

### 5.4 Documents of one source in a run (`/admin/runs/[id]/sources/[sid]`)

- **Signal chips** under each document's technologies. Clicking a chip expands *what*, *implication* and the quote.
- **"Set aside: {rule}" badge** where it applies.
- **"Partly analysed" badge** in amber when `partial` is true, with the hint "One part of this page failed; the next re-check retries it."
- **Under the hood:** "split into {n} parts" when `parts` > 1.

### 5.5 Technology page (`/admin/technologies/[id]`)

- A new section, **Signals for this technology**, above the document list.
- It uses `GET /api/signals/found?tech={name}`: the latest 20, with "Load more".
- **Empty state:** "No signals yet."

### 5.6 Assessments (`/admin/scoring/assessments/[id]`)

- Under the header: "Evidence from collection runs: {ids}". This is the union of the run's assessments' `evidence_runs`, each linked. Runs from before the upgrade show "Not recorded".
- On an assessment page, the same line lists that assessment's own `evidence_runs`.
- `StageFlow` moves under the hood; the strip shows progress.

### 5.7 Scoring method

- Tabs as listed in §3. Content unchanged.

### 5.8 Overview (`/admin`)

- Health stays.
- Sections are reordered to follow the process.
- **New Signals section:**
  - never-miss hits in the latest run;
  - Other;
  - set aside;
  - "re-check needed", if any;
  - the top 5 signals by hits in the last run.

### 5.9 Skills (`/admin/prompts`)

- **`lib/prompts.ts` `PROMPT_IMPACT`:**
  - `article_summary` now also finds signals from the Signal list, and its output feeds the Signals page.
  - `link_selection` now prefers links likely to carry never-miss signals.
  - `scout` now uses `collect_source` and covers data sources.
- **On save:** the API's 422 message lists the placeholders the prompt must keep. It is shown above the editor.

### 5.10 Changes (`/admin/changes`, new)

Edits apply the moment they're saved. This page only decides which of them go into the seeding data, which is the configuration the next deployment ships with.

- **A line at the top:** "Seeding data loaded {loaded_at}. A deployment that loads new seeding data replaces edits that weren't written into it."
- **What's listed:** one row per edit that isn't in the seeding data, from `GET /api/changes`. Each row shows:
  - what it is (for example "Signal · Funding round", "Prompt · article_summary", "Source · arXiv");
  - added, edited or deleted;
  - when it was edited;
  - each changed field as *seeding value → live value*. Long text, such as a prompt, appears as two side-by-side blocks; no diff library is needed.
- **Actions:**
  - a checkbox per row, plus *Select all*;
  - **Update seeding data**, for the ticked rows, with an inline confirmation: "Write {n} edits into the seeding data? The next deployment will use them."
- **Afterwards:**
  - A line names the files written, for example "Updated seeds/signals.json. Push with git to share it."
  - Written rows drop off the list; the others stay.
  - If a write fails, the API's message names the file, and its rows stay listed.
- **Empty state:** "No edits since the seeding data was loaded. The live configuration matches it."
- **Badge:** the menu item shows the count, from the same endpoint, refreshed every 30 s and after any save.

## 6. Plain words

| Today | Becomes |
|---|---|
| Runs | Collect evidence |
| Orchestrating · Crawling | Planning · Collecting |
| Resolving · Resolve | Organizing technologies |
| Scoring run | Assessment run |
| Pending decisions | Open questions |
| LLM / FREE chips, sub-stage ladders, resolver passes | Under the hood only |
| TORA | Kept, since it's the client's framework, with the axis names spelled out |

Backend stage values don't change. The portal maps them through one table in `lib/pipeline.ts`.

## 7. Under the hood switch

- **`lib/hood.ts`:** a `useHood()` hook. The value lives in `localStorage`, wrapped in try/catch, and defaults to off.
- **Where the switch sits:** in the sidebar footer.
- **`components/Hood.tsx`:** wraps technical blocks, which render only when the switch is on.

## 8. Shared code

| File | Purpose |
|---|---|
| `lib/pipeline.ts` | Types for `/api/pipeline`; status → label and style; the stage-name map (§6) |
| `lib/signals.ts` | Types for signal rows, hits, Other groups and set-aside pages; mode labels |
| `lib/hood.ts` | The under-the-hood hook |
| `components/ProcessStrip.tsx` | The strip (§4) |
| `components/SignalChip.tsx` | A chip that expands to *what*, *implication* and the quote |
| `components/ListEditor.tsx` | An editor for a list of strings: add, edit, remove, reorder. Used for start pages, saved searches and skip patterns. |
| `components/Hood.tsx` | The wrapper for technical blocks |
| `lib/format.ts` | `STATUS_STYLES` adds `failed`, `interrupted` and `incomplete` |

## 9. States and errors

- **Loading errors:** a failed first load shows `BackendError`. A failed poll keeps the last data silently, as the scoring page does today.
- **Disabled buttons:** a button is disabled, with the reason, whenever the API would answer 409. The reasons:
  - a run, a re-check, a scoring run or a compose job is active;
  - there is nothing to re-check;
  - a re-check can't start during collection or assessment, and assessment can't start or resume during a re-check.
- **Facts versus timing:** links between steps come only from recorded fields (`used_in`, `evidence_runs`). Timing-based information is always labelled "Latest workspace activity" or "since the last assessment".
- **Validation:** API messages (422) appear next to the field they concern.
- **Empty states:** every list has one, as worded above.
- **Older data:** missing fields show "—" or "not recorded".
- **Print:** the strip and sidebar are hidden.

## 10. Verification and acceptance

- **Build:** `next build` and `eslint` pass.
- **Walkthrough with the pilot data from atlas §9:**
  1. Start a run from the strip. The strip shows "Collecting…", then "✓".
  2. Identify signals shows a number, and the Signals page shows hits with quotes and implications.
  3. From the Other tab, *Make it a signal* adds a row to the List.
  4. The re-check banner appears, and a re-check runs until the count reaches 0.
- **Run page:**
  - no hand-off section;
  - "Used in" lists only assessments whose evidence included this run;
  - a run whose pages fed no assessed technology says "Not used in any assessment yet", even when an assessment run started later;
  - the latest assessment run appears only under "Latest workspace activity";
  - incomplete sources show their badge and note;
  - the under-the-hood detail is hidden by default and appears with the switch on.
- **Sources:**
  - a *Never* source cannot be enabled;
  - start pages, saved searches and crawl settings save and survive an API restart;
  - a data source with a backlog shows "Incomplete" and its progress per search;
  - a too-broad search shows its warning.
- **Documents:** signal chips expand, a set-aside page shows its rule, and a partly analysed page shows its badge.
- **Signal list:** a deleted signal disappears at once, stays deleted across an API restart, and appears in Changes as deleted. After Update seeding data, it's gone from the seed file. Its past hits still show its name.
- **Changes:**
  - edits to a prompt, a source, a signal and a scoring item each take effect at once and appear with their seeding and live values;
  - an edit changed back by hand drops off the list;
  - Update seeding data writes only the ticked rows into the `seeds/` files, also from Docker. Those rows drop off the list, and the rest stay;
  - the menu badge shows the count.
- **Re-check exclusions:** Re-check is disabled during an assessment run, and Run scoring and Resume are disabled during a re-check, each with its reason.
- **Menu:**
  - every route works;
  - the Scoring tab bar shows only setup tabs;
  - the active highlighting is correct.
- **Narrow window:** the strip and step cards wrap without horizontal scrolling.

## 11. Rollout, aligned with the tech-atlas phases

| tech-atlas phase | Portal work |
|---|---|
| 0 and 1 (foundations, signals) | Changes page and menu badge (5.10), Signals page (5.1), signal chips on documents (5.4), technology signals (5.5), Skills impact text (5.9) |
| 2 and 3 (crawler, query sources) | Sources list, editor and crawl settings (5.2) |
| 4 (process view) | Strip (4), menu (3), run pages (5.3), assessment evidence (5.6), scoring tabs (5.7), overview (5.8), plain words (6), under the hood (7) |

Each phase ends with the same sign-off as the tech-atlas plan.

## 12. Not in this iteration

- Alerts.
- A "Run full cycle" button.
- Momentum charts.
- Grouping hits that describe the same event.
- A reader-facing (non-admin) area.

## Appendix: files touched (tech-lens)

**New**
- `components/EvidenceLine.tsx` (the "Evidence from collection runs" line, used by both assessment pages)
- `app/admin/signals/page.tsx`
- `app/admin/sources/settings/page.tsx`
- `app/admin/changes/page.tsx`
- `components/ProcessStrip.tsx`, `SignalChip.tsx`, `ListEditor.tsx`, `Hood.tsx`
- `lib/pipeline.ts`, `lib/signals.ts`, `lib/hood.ts`

**Changed**
- `app/admin/layout.tsx`: the strip
- `components/Sidebar.tsx`: menu groups, the switch, and the Changes badge
- `app/admin/scoring/layout.tsx`: setup tabs only
- `app/admin/page.tsx`: overview
- `app/admin/runs/page.tsx` and `app/admin/runs/[id]/page.tsx`: rework
- `app/admin/runs/[id]/sources/[sid]/page.tsx`: signal chips, set-aside badge
- `app/admin/technologies/[id]/page.tsx`: signals section
- `app/admin/scoring/assessments/[id]/page.tsx`: evidence line, `StageFlow` under the hood
- `app/admin/sources/[id]/page.tsx`: start pages, outbound toggle, saved searches, never sources
- `components/SourceBrowser.tsx`: *How it's read* column and filter
- `lib/prompts.ts`: impact text
- `lib/format.ts`: statuses


## Build notes (2026-10-03)

Implemented as planned. Details settled while building:
- **Next.js 16:** pages that read `?tab=` (the Signals page and the sidebar) call `useSearchParams` inside a `<Suspense>` boundary, which the production build requires. `useParams` stays synchronous.
- **The Under the hood switch** subscribes with React's `useSyncExternalStore`: the value lives in `localStorage`, and a window event updates every open component at once.
- **The Changes badge** refreshes every 30 s and after every save: editors call `configChanged()` from `lib/api.ts`.
- **Assessments and Points of View** have their own page headers ("Step 4", "Step 5"), now that the scoring tab bar shows only on setup pages.
- **Checks:** `next build`, `eslint` and `tsc` pass. The pages were checked with screenshots against the dev API: Overview, Signals (Found and List), the run page, the documents page, Changes, Sources and the source editor.
