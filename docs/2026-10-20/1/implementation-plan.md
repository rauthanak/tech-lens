# Plan 9: implementation plan for the portal (tech-lens)

**Date:** 2026-10-20 · **Folder:** 2026-10-20/1 · **Status:** written 20 Oct; building waits for your go.

- **What to build:** [the specification](../../../../tech-atlas/docs/2026-10-20/1/specification.md).
- **Words, places and screens:** [ux-map.md](../../../../review-comments/10-20-2026/ux-map.md), with mock-ups in `review-comments/10-20-2026/screenshots/after-design/`.
- **The backend half:** [tech-atlas plan](../../../../tech-atlas/docs/2026-10-20/1/implementation-plan.md).
- **Paths:** all relative to `tech-lens/`.

## 0. How every item is built

1. **Read first.** This Next.js is 16.3.4 (AGENTS.md). Before touching routing, proxy, params or caching, read the matching guide in `node_modules/next/dist/docs/`. `proxy.ts` replaces middleware (`01-app/01-getting-started/16-proxy.md`).
2. **Patterns we keep:**
   - client pages that fetch `/api/...` through `lib/api.ts`;
   - a `Suspense` wrapper wherever `useSearchParams` is read;
   - URL-state filters (`router.replace(..., {scroll:false})`);
   - `withFrom` and `BackLink`;
   - `ConfirmAction` with the cost for every model action;
   - `PageHeader` with an intro and help on every page;
   - the theme tokens in `globals.css` and `lib/theme.ts`.
3. **Words come only from the UX map's word list.** Codes and ids show only under Technical details (`Hood`).
4. **Checks:**
   - `npm run lint`, the type check, and `npm run build`, all clean;
   - a headless Chromium walk inside the API container, as a first-time reader, at 1440, 1920 and 400 px: no sideways scroll, no page errors;
   - check scripts kept in `docs/2026-10-20/1/checks/`.
5. **Screenshots** of the built screens go to `review-comments/10-20-2026/screenshots/after/`, and into the client document in place of the item's design mock-up.
6. **Rebuild the lens container.** Show you the item before the next one starts.

**Shared helpers, added in the first item that needs them:**
- **`lib/api.ts`:**
  - `sendJson` adds the `X-Time-Zone: Intl.DateTimeFormat().resolvedOptions().timeZone` header (item 1);
  - `sendForm(url, FormData)`, with the same header, is for uploads (item 11).
- **`lib/format.ts`:**
  - `formatAt(iso, tz)` returns "Oct 6, 2026, 2:35 AM CDT", using `Intl.DateTimeFormat("en-US", {dateStyle:"medium", timeStyle:"short", timeZone: tz, timeZoneName:"short"})`;
  - where the browser has no abbreviation for a zone, it shows the GMT offset (item 1).
- **`components/AnswerCard.tsx`:** the one look for every model answer: label, value, source · "Why?" (a popover with the reason and numbered page links) · "Change" (item 8).
- **`components/DecisionNote.tsx`:** "set by a person on {formatAt}: {reason}", with Undo (item 6).

---

## Item 0. Quick fixes Q1–Q5

- **Q1, `app/admin/page.tsx`:**
  - with no `days` or `run` parameter, the window is "since the last collection", meaning `run=<latest collection id>` from `usePipeline()`;
  - the select gains "Since the last collection" as its first option, before 7 / 30 / 90 / all;
  - the count line reads "N findings from N pages in the Oct 6 collection".
- **Q2:**
  - `lib/prompts.ts`: each `PROMPT_IMPACT` entry gets a `title`. From item 3 the title comes from the API, with the local one as a fallback;
  - `app/admin/(setup)/prompts/[name]/page.tsx`: the h1 is the title, and the code name moves under `Hood`;
  - `app/admin/scoring/assessments/[id]/[aid]/page.tsx`: measure cards show the measure's name, from `/api/scoring/measures`, not `id.replace("-", " ")`;
  - `components/EvidenceLine.tsx`: the link text reads "Oct 6 collection", with the id under `Hood`;
  - `app/admin/(setup)/scoring/page.tsx`: the "TORA composition & weights" heading becomes "How the three scores are made".
- **Q3, `app/admin/(setup)/scoring/{fabrics,measures,config,pending}/page.tsx`:** a `PageHeader` with a title and a one-line intro, keeping each tab's existing `PageHelp` items.
- **Q4, `components/SourceBrowser.tsx`:** the "enabled" filter starts on "Switched on", with the count, and "Show all 147" clears it.
- **Q5, `README.md`:** remove the "Signals" menu and "Points of View on the Briefing"; describe the top bar as it is.

## Item 1. Switch a technology off from the list

- **`lib/api.ts`:** the `X-Time-Zone` header. **`lib/format.ts`:** `formatAt`.
- **`app/admin/technologies/page.tsx`:**
  - a tick-box column and an "On" column with a switch, which sends `PUT /api/technologies/{id}`;
  - **new `components/BulkBar.tsx`,** which appears when rows are ticked: "N selected · Switch off · Switch on", sending `POST /api/technologies/bulk`. The Move and Assess actions are added in items 7 and 8;
  - a switched-off row's status note reads "Switched off on {formatAt}". It turns amber, "N new pages since: have a look?", when `pages_since_off ≥ wake`.
- **`app/admin/technologies/[id]/page.tsx`:** the Manage switch shows "Switched off on {formatAt}" and the wake flag.
- **Check:** switch two rows off in bulk, and the assessment estimate on Assessment runs drops by two.

## Item 2. The written time, in the writer's zone

Replace `formatDay(composed_at)` with `formatAt(composed_at, composed_tz)` in:
- `app/admin/scoring/pov/[id]/[tech]/page.tsx` (the basis line, including the print copy);
- `app/admin/scoring/pov/page.tsx` (cards);
- `app/admin/technologies/[id]/page.tsx` (the Point of View line);
- `app/admin/technologies/page.tsx` (the Point of View column, which keeps the short day with the full time as a tooltip).

**Check:** rewrite one Point of View from a browser with `timezoneId: "Asia/Kolkata"`, and its page shows the India time zone. An old Point of View shows CDT.

## Item 3. Where each skill is used

- **New `app/admin/(setup)/prompts/map/page.tsx`:**
  - `GET /api/skills/map`, laid out as mock-up F: stages as columns, recipes as dashed boxes, and a skill card with its title, agent mark, calls and tokens, linking to `/admin/prompts/{name}`;
  - print styles in `globals.css` (`@media print`): one landscape page;
  - a `PageHeader` with an intro and help.
- **`app/admin/(setup)/prompts/page.tsx`:** a "Where each skill is used →" link in the header.
- **`app/admin/(setup)/layout.tsx`:** "Skills" stays active on `/admin/prompts/map`.

## Item 4. Tokens

- **`app/admin/operations/page.tsx`:** each History row gains "N tokens (M reused)", from `GET /api/usage/recent`.
- **The run pages** (`app/admin/runs/[id]/page.tsx`, `app/admin/scoring/assessments/[id]/page.tsx`) get a "Model use" table by skill, with calls, in, out, reused and failed, from `GET /api/usage?run_id=`. It sits under `Hood` except the total.
- **`app/admin/(setup)/prompts/[name]/page.tsx`:** "Last run: N calls · N tokens" beside the plan 8 preview's count.

## Item 5. Stacked calls

- **`app/admin/(setup)/scoring/measures/page.tsx`:** each measure gets a "Scored" select (per technology · per fabric · entered by Tata), saved with `PUT /api/scoring/measures/{id}`. Its help explains what each choice means for calls and for Gate 2.
- **`components/SkillPreview.tsx` and `lib/prompts.ts`:**
  - a "How it's sent" switch, "On its own · Stacked in the technology call · Stacked in the fabric call", shown for skills that belong to a recipe;
  - the stacked view labels each block with its skill's title, and highlights the current skill's block.
- **Assessment run page:** the cost line uses the new estimate. There's no layout change.

## Item 6. Gate 2 on a technology's page

**`app/admin/technologies/[id]/page.tsx`,** restructured as mock-up C:
1. BackLink and title.
2. **New `components/JourneyLine.tsx`:** Found → Classified → Ready → Assessed → Placed → Point of View, from the status and states.
3. **The next-step box:** one sentence and one action, built from the technology's gate items.
4. **The four answers:** added in item 8. Until then, this space shows the evidence line that exists today.
5. **New `components/FabricTabs.tsx`:** one tab per assessed fabric, kept in the URL as `?fabric=`. Each tab shows:
   - **the priority line:** the priority chip, "How soon x · a of b scored", "How big y · …", and "Override priority…". The override opens **new `components/OverrideDialog.tsx`**: P1–P6 and a required reason, sent with `POST /api/decisions`. With an override in force, the chip reads "P1 · override in force (computed P3)" with a `DecisionNote`, plus the amber "computed moved" flag;
   - **a measures list, using new `components/MeasureRow.tsx`.** Each row shows the name and its state:
     - **scored:** the score, a one-line reason, and "why · N sources", which expands to the justification, the counter-case and the source links;
     - **unscored:** what's missing, then **Score by hand** (a 0–10 input and a required reason), **Accept the gap**, and **Find evidence** (item 10);
     - **waiting for Tata:** **Enter**;
     - **scored by a person** or **gap accepted:** a `DecisionNote` with Undo;
   - the three axes (Market potential · Strategic fit · Adoption readiness), folded under "Score detail";
   - watch metrics (`WatchMetrics`), folded.
6. Then the existing findings, pages and Manage sections.

All data comes from `GET /api/technologies/{id}/assessment?fabric=`.

**`app/admin/scoring/assessments/[id]/[aid]/page.tsx`:** replaced by a client redirect to `/admin/technologies/{tech}?fabric={fabric}`. The data comes from the `aid`, which the router reads. Old links keep working.

**`components/TopBar.tsx`:** `/admin/scoring/assessments` stays under Operations, as history.

**Briefing (`app/admin/page.tsx`):**
- **new `components/GateList.tsx`**, two cards, "Before scoring · Gate 1" and "Before publishing · Gate 2", from `pipeline.gate1` / `gate2`;
- each row shows the count, the sentence, the sub-line and one action, as in mock-up A;
- these replace the "Waiting for you" strip.
- **`lib/waiting.ts`:** new sentence and link entries for each gate item kind.
- **`components/StatusPill.tsx` and `lib/next-step.ts`:** read the gate items.

**Points of View:** a priority with an override shows "override in force" on the list card and on the page.

**Check:** override Agentic AI · Interaction with a reason.
- It shows on the technology page, the Points of View list, and the run's grid.
- Undo restores the computed priority.
- A hand score on a held pair places it.

## Item 7. Organise the technologies

**`app/admin/technologies/page.tsx`:**
- **View pills,** from `view_counts`, each with its count: Tracked, Not assessed, Emerging, Emerging (new to Tata), Mature (not on Tata's radar), Possible nascent, Imported (little or no evidence), Switched off. The view sits in `?view=`.
- **A filter row:** Commercial availability, Domain, TRL (from–to), Evidence, Fabric, and Search. Each is in the URL.
- **Columns:** tick box · Technology · Where it is (`StatusChip`-style chip and reason) · Commercial availability (value and a small source) · TRL · Domain › sub-domain · Evidence (verdict, pages · sources) · On.
  - Before item 8 the classification columns show "Not known yet".
- **The definitions `<dl>`** under the pills is rewritten from the word list.
- **"+ Add technology"** comes in item 11.

**`lib/states.ts`:** new `RadarStatus`, `STATUS_LABELS`, `STATUS_MEANING` and `STATUS_STYLE`, from the word list. The old state labels move into row notes.

**Briefing:** the Gate 1 card gains its items ("Ready to assess · about N calls", with Assess… via `ConfirmAction`, and "switched off with new pages").

**Check:** every view's count matches its rows, and "Imported, little or no evidence" can be reached in one click.

## Item 8. Classify every technology

**New route group `app/admin/(setup)/classification/`:**
- **`layout.tsx`:** tabs like Scoring method, "Commercial availability · Domains and sub-domains · TRL levels".
- **`page.tsx`:** Commercial availability. A card list and a form like Fabrics: name, definition, order, counts as emerging, catch-all.
- **`domains/page.tsx`:** domains, and sub-domains grouped under each domain.
  - A "New" filter shows the model's proposals, each with Accept, Merge into…, and Rename.
- **`trl/page.tsx`:** the 9 levels, with editable definitions.
- **On every list page,** a save that changes a definition shows "N technologies were classified under the old wording · Re-classify N · about M tokens", using `ConfirmAction` and `POST /api/classify`.

**`app/admin/(setup)/layout.tsx`:** a new side item, "Classification", after Scoring method. Changes gets labels for the new lists (`changes/page.tsx` l.27).

**The technology page:** the four answers, using `AnswerCard`: commercial availability, TRL (with its words), domain › sub-domain, and evidence.
- **"Why?"** lists the reason and the numbered pages, with links.
- **"Change":** new `components/MoveDialog.tsx`, which picks a value from the list (an optional reason) and sends a `move` decision. Evidence has no "Change".

**Technologies list:** the classification columns are live. BulkBar gains "Move to…", for availability or domain.

**Operations:** `ProcessBoard` gains a Classify card between Organize and Assess, with "Classify N · about M tokens".

## Item 9. Possible nascent

- **Technologies:** in the `nascent` view, rows show the reason and the quote, with **Yes, nascent** and **No** buttons, which send a `nascent` decision.
- **Technology page:** a banner above the answers, "Possible nascent: {reason} · "{quote}" [page]", with the same two buttons.
- **Briefing:** the Gate 1 card gains its item.

## Item 10. Find evidence

- **New `components/FindEvidence.tsx`:**
  - props `gap` and `label` ("Find evidence" / "Find evidence for this measure" / "Find use cases");
  - it fetches `GET /api/find-evidence/preview` and shows `ConfirmAction` with the cost;
  - when no key is set, it's disabled with the reason;
  - after it starts, it polls `GET /api/find-evidence/{id}` and shows the result sentence.
- **New `components/AddLink.tsx`:** a URL field, using the same job with `gap.kind = link`.
- **Placed on:**
  - thin or no-evidence technology rows and the technology page;
  - unscored measure rows (item 6);
  - the "no use case" panel (item 12).
- **Pages it found** show "found by Find evidence on {formatAt}" in the technology's Pages list.

## Item 11. Import, and add by hand

**New `app/admin/(setup)/import/page.tsx`,** as mock-up E:
- **Step pills:** Upload · Check · Match · Review · Confirm.
- **Upload:**
  - a file input for .xlsx only, sent with `sendForm` to `POST /api/imports`;
  - a refusal shows the API's reason;
  - "Download the blank template" links to `GET /api/imports/template`.
- **Check:** the sheet used, the row count, and the columns found.
- **Match:** a `ConfirmAction` "Match N names · about M calls" (`POST /api/imports/{id}/match`), then polling.
- **Review:**
  - group pills: Matched exactly, Proposed matches, New, Values not in our lists;
  - the proposed-matches table ("In your file · Would join · Its pages") with Accept / Reject per row and "Accept all";
  - the values table, with a map-to select or Add;
  - all sent with `PUT …/items` and `PUT …/values`.
- **Confirm:** "Confirm import: X matched, Y to accept, Z new" (`POST …/confirm`).
- **History:** past imports (`GET /api/imports`), with their counts.

**`app/admin/(setup)/layout.tsx`:** a new side item, "Import technologies".

**Technologies:**
- **"+ Add technology"** opens a dialog: name and optional values. It sends `POST /api/technologies`, and the result shows "matched to X", "proposed: X?" or "added".
- **The Gate 1 item** "Import matches to accept" links to the review step.

## Item 12. The Point of View and the fabric tab

**The technology page's fabric tab (item 6) gains:**
- **"Use cases in {fabric}":** cited use cases with their links, and suggested ones marked, with **Accept** / **Reject** (`use_case` decisions) and **Find use cases** (item 10).
- **"Path to scale in {fabric}":** new `components/PathToScale.tsx`. It's a bar of the 7 steps; clicking a step sets it (a `path_step` decision with an optional reason), and the line under it is a `DecisionNote`.
- **"Finance":** new `components/FinanceCard.tsx`.
  - Folded as "not needed yet" until the step is Proof of concept or later.
  - Then it has inputs for upfront investment, yearly running cost, revenue at stake and an optional margin, with "Reset to fabric default".
  - It shows the three figures, each labelled with its source, or what's missing.

**The Point of View page (`app/admin/scoring/pov/[id]/[tech]/page.tsx`),** restructured as mock-up D, in this order:
1. the verdict;
2. **an answers row,** using `AnswerCard` for priority (with any override), maturity (TRL and its words, with `[n]` links), commercial availability, and evidence;
3. **"Where the value lands,"** per fabric. Each use case has its levers as **new `components/LeverChain.tsx`** (five linked boxes), its capital direction, its `PathToScale` (read-only), and **new `components/FinanceScreen.tsx`** (three figures, with Nick's payback line once there are inputs, drawn as a small inline SVG);
4. the narrative sections: recommendation, summary, `value`, `maturity`, then the existing score sections, folded under "Score detail";
5. evidence gaps and metrics to watch;
6. **new `components/SourcesList.tsx`:** the numbered sources (source · date · headline, each linked).

**`[n]` in the text** becomes a link to the source, through a small `renderCitations(text, sources)` in `lib/citations.ts`.

**Print:** every folded part opens, and the levers and figures print in colour (existing `@media print`).

**Setup:**
- **Fabrics** gains the levers (two, each with its mechanism), key metrics, bottlenecks (`ListEditor`), cautions, and finance defaults (margin from–to, loss rates).
- **New `app/admin/(setup)/path/page.tsx`:** the 7 steps, with name, order, evidence needed and decision.
- **New `app/admin/(setup)/finance/page.tsx`:** the table from `GET /api/finance`, with a "Missing inputs" filter and editing in place.
- Side items "Path to scale" and "Finance" are added.

## Item 13. Frontier at its own address

**New `proxy.ts`** (at the root, `export function proxy(request)`, per the Next 16 docs). It reads `process.env.APP_SIDE`, at run time, defaulting to `admin`.
- **Before coding:** read `01-app/03-api-reference/03-file-conventions/proxy.md` to confirm that run-time environment reads work in the Node proxy runtime.
- **On the frontier side:**
  - `/` is rewritten to `/frontier`;
  - every `/admin` path redirects to `/frontier`;
  - every `/api` request that isn't a GET on the allow-list gets a 403 JSON response, "Not available on the executive address";
  - **the allow-list:** `/api/frontier`, `/api/scoring/runs/{id}/pov/{tech}`, `/api/scoring/measures`, `/api/scoring/fabrics`, `/api/technologies/labels`.
- **On the admin side:** `/frontier` redirects to `/admin`.

**New route group `app/frontier/`:**
- **`layout.tsx`:** its own header, "Frontier · Tata Communications · Emerging technology radar", with no admin navigation.
- **`page.tsx`,** as mock-up G:
  - fabric pills;
  - a Grid / Table switch;
  - **new `components/frontier/Grid.tsx`:** an SVG 2×2 (Watch · Act · Wait · Plan), with dots positioned by how big and how soon, labels, override marks, and zoom and pan (wheel and drag, with + − ⌂);
  - **new `components/frontier/Table.tsx`;**
  - the not-yet-placed list.
- **`pov/[id]/[tech]/page.tsx`:** the Point of View, read-only. It reuses the item 12 components with `readOnly`, so there are no buttons.

**Admin TopBar:** an "Executive view ↗" link, which opens the executive address in a new tab. It's set by `NEXT_PUBLIC_FRONTIER_URL`, baked in at build time; the default is `http://localhost:3200`.

**Compose** (atlas `docker-compose.yml`): the `frontier` service, from the same build, with `APP_SIDE=frontier` and port 3200.

**Check:** from the executive address, every `/admin` path redirects, and a POST to any `/api` path returns 403. The grid and the table agree.

## Build notes

These are filled in as each item is built.

### Item 0: built 20 Oct 2026 (live, not saved as a version)

- **Q1 skipped by decision:** the Briefing stays as it is; the next collection fills it again.
- **U5 brought forward from item 7, as an interim:**
  - "Up to date" becomes "Tracked", in a quiet navy chip, not green;
  - the list gains Priority (the best one with its fabric, +N for the others, amber "No priority") and Measures scored ("14 of 36" with a bar, amber under half). `lib/states.ts` adds `Scored` and `thinScoring`;
  - the Tracked definition counts those with no priority in any fabric (69 of 146 on 20 Oct);
  - the technology page has a how-solid line and "x of 12 scored" on each fabric.
  - Item 7's statuses and item 8's Evidence column still replace these, as planned.
- **U2 interim** (item 6 still moves the page onto the technology's own page):
  - `TopBar` keeps Technologies lit on `/admin/scoring/assessments/{run}/{id}`; the runs list and a run's page stay under Operations;
  - the page is titled "{technology} in {fabric}". Fabric tabs come from the technology summary, only when it's the same run, and switch fabrics with `replace`, so Back returns to the technology;
  - `BackLink` has a new rule: a `from` on the fallback's own page keeps the fallback's label ("← Agentic AI").
- **Q2:**
  - `PROMPT_IMPACT[*].title` and `skillTitle()`;
  - the Skills list is in pipeline order (watch_metrics now sits before pov in the map);
  - the skill page's h1 is the title; the code name moves under Technical details; "Version N";
  - "last saved" uses the new `formatAt` (the reader's zone, no "UTC");
  - the assessment page shows measures by name, plus "Not scored: too little evidence", "What's missing", "The case against" and "Pages cited";
  - `EvidenceLine` names collections by day, fetched once from `/api/runs`, with ids under Technical details;
  - "unscorable" and "TORA" wording is gone from the run page. TORA stays on the Setup pages, explained at first use as Tata's term (it's in Tata's process flow v1.1 and the deck). The extra group is renamed "Scored alongside, outside the three scores".
- **Q3:** `PageHeader` on all five Scoring method tabs.
- **Q4:** Sources opens on "Switched on", with "Show all 147"; the filter reads Switched on / Switched off / All; the column is "On".
- **Q5:** README.
- **Checks:**
  - `docs/2026-10-20/1/checks/item0.py`: 136 checks at 1440, 1920 and 400 px, all passing, no page errors;
  - lint, tsc and build are clean;
  - the first runs caught two bugs, both fixed: the summary endpoint dropped the new count (the page crashed), and the current fabric tab wasn't highlighted, because `useParams` returns the id encoded.
- **Screens:** `review-comments/10-20-2026/screenshots/after/item-0-*.png` (6); client document version 2.
- **Left for item 5:** the model's own justifications still say "unscorable", for example "…so serviceable capture is unscorable". The scoring skills need the plain-words rule the Point of View skill already has.

### Items 1–13: built 20–21 Oct 2026 (live, not saved as a version)

All built in one pass, at your request. Lint, tsc and build are clean; the browser checks are in `docs/2026-10-20/1/checks/`.

- **Item 1:**
  - the list has tick boxes, an On switch (`POST /technologies/bulk`) and `components/BulkBar.tsx`;
  - a switched-off row says when, in its zone, and asks for a look once pages arrive.
- **Item 2:**
  - `lib/api.ts`: `sendJson` sends `X-Time-Zone`; new `sendForm`;
  - `lib/format.ts`: `formatAt`, which spells out the date and time parts, because `dateStyle` can't be combined with `timeZoneName` (that crashed the first version);
  - Points of View, the PoV list, the technology page and the technology list show the written time in the writer's zone.
- **Item 3:** `app/admin/(setup)/prompts/map` ("Where each skill is used"), which prints on one landscape page (`@page landscape-sheet`). Skills appear by title, in pipeline order.
- **Item 4:** tokens on Operations' history rows; `components/ModelUse.tsx` on the collection and assessment run pages; the last run on each skill's page; a "Let the model reason" switch per skill.
- **Item 5:**
  - Setup › Measures gains the Scored choice;
  - Weights & Grid gains "How an assessment calls the model";
  - skill pages gain "How it's sent" (`components/StackedPreview.tsx` over `GET /recipes/{id}/preview`).
- **Item 6:**
  - `components/FabricAssessment.tsx` puts one tab per fabric on the technology page;
  - each tab has the priority with override (`ChoiceForm`, `DecisionNote`), and measures needing a person first, with Score by hand, Accept the gap, Enter (Tata), Find evidence and Add a link;
  - the old assessment address is a server redirect to `/admin/technologies/{tech}?fabric=`;
  - the Briefing's `components/GateList.tsx` replaces "Waiting for you";
  - overrides are marked on the PoV list and the run grid.
- **Item 7:** the Technologies list is rewritten:
  - views with counts, and filters held in the address;
  - a status with its reason, notes, the classification columns and evidence;
  - Move to availability or domain, and Assess, from the bulk bar;
  - "+ Add technology" (`components/AddTechnology.tsx`).
- **Item 8:**
  - Setup › Classification has tabs for availability, domains and sub-domains (with Accept, Merge into and Rename for proposed ones), and TRL levels, through `components/ListItems.tsx`, which offers Re-classify after a definition changes;
  - the technology page gets four answers (`components/AnswerCard.tsx`, `TechAnswers.tsx`, `MoveDialog.tsx`);
  - Operations gains a Classify card;
  - collection runs gain a classifying stage;
  - Crawl settings gains Radar settings (`components/RadarSettings.tsx`).
- **Item 9:** a "Possibly nascent" banner on the technology page (Yes / No), its tag on list rows, and the Gate 1 item.
- **Item 10:** `components/FindEvidence.tsx` and `AddLink.tsx` over `lib/findEvidence.ts` (start, then follow), on thin technologies, unscored measures, and fabrics with no use case; pages it found say so.
- **Item 11:** `app/admin/(setup)/import` (built by a helper; see its notes), plus Add technology.
- **Item 12:**
  - the fabric tab gains Where the value lands (`UseCases.tsx`, `LeverChain.tsx`), Path to scale (`PathToScale.tsx`) and Finance (`FinanceCard.tsx`);
  - the Point of View page is reordered: verdict → priority, maturity, availability and evidence → recommendation, summary, value (per fabric, with `PovValue.tsx`), maturity → score detail, folded → gaps and metrics → numbered sources; "[n]" links to its source;
  - Setup › Fabrics gains levers, metrics, blockers, cautions and finance defaults;
  - new Setup › Path to scale and Setup › Finance pages.
- **Item 13:** `proxy.ts`, `app/frontier`, `components/frontier/*` and the compose `frontier` service (built by a helper; see its notes).
- **After the build (21 Oct):**
  - **`/` is decided in `proxy.ts`, not `next.config.ts`.** The config's redirect ran before the proxy, so the executive address went `/` → `/admin` → `/frontier` in two hops. Now each address opens on its own side in one step (admin `/` → `/admin`; executive `/` shows Frontier).
  - **Frontier gains Tata's stage buckets** (decided 20 Oct, missed in the first pass): a Stage choice beside Grid and Table, kept in the address (`stage=mature|all`). Emerging, the default, shows every stage but Mature, including technologies not classified yet; the count line says how many at Mature are left out. The table gains a Stage column and each dot's tooltip names its stage. Without it, 2G and 3G sat on the leaders' emerging grid.
  - **The walk matches words ignoring case.** Headings styled in capitals come back from the browser in capitals, which failed two checks on pages that were right.
- **21 Oct, simplified after a read-only review** (15 findings, all fixed; net 132 lines fewer):
  - **Bug:** eight one-click decisions (accept a gap, a path step, a use case, yes/no on nascent, Undo) failed silently; `components/ActButton.tsx` shows "Not saved: <why>" on all of them.
  - `lib/api.ts`: one `request()` and `errorText(e)`, used by 22 places that each wrote their own (and showed "HTTP 422").
  - `components/PovText.tsx` shared by the admin and Frontier Point of View pages, which had drifted; `ChoiceForm` takes options, so `MoveDialog` reuses it; `PageRefs`, `JobLine`, `useLeverNames`, `figureText`, `overrideNote`; `/usage` takes several run ids; dead code removed.
  - Grid.tsx's zoom and label placement are left as they are: the heaviest part of the portal, a call for you.
- **The walks no longer change live data when they stop halfway.** A run of items 1–4 crashed on "5G" matching six rows and left 5G switched off; a run of items 5–13 clicked the first Undo on Agentic AI's page, which after the import was an imported choice, not the walk's override. Both were put back. Each walk now matches by exact name, clicks the Undo beside its own override, and puts back at exit whatever it changed. item0.py checks today's screens (items 6–8 replaced its interim ones).

## Item 13, part 2: Frontier's settled details (decided 21 Oct: "build all six, simplest form")

Missed in the first pass, where the build list said they're settled when Frontier is built. The deck (pages 5, 6, 9, 11, 13, 14) and review-notes 3.1 (B12, B17, B20–B23) are the source.

1. **Publishing (B17).** "Publish the edition" ends Gate 2 (deck p.9). One button in Tech Lens (Briefing, below "Before publishing"), with an optional name ("FY27 Q3"). It freezes what leaders see: every placement and Point of View as they stand, dated in the publisher's zone. Frontier shows the latest edition, never live data; with none yet it says so. Admins keep working; leaders see the edition until the next publish.
   - **Moved since the last edition:** an arrow on a moved dot, "P3 → P2 since <last edition>" in its tooltip and the table, and a "Moved since <date>" list with each move's reason (a person's override reason, or "new scores").
2. **Lens (B20).** Growth (How big, as today) or Defence (Disruption threat up the side; "the only defence-oriented measure"). A two-way switch on Frontier; in Defence a placement without a Disruption threat entry goes to Not placed yet, "Disruption threat not entered by Tata yet".
3. **The frontier (B21).** Placements no other placement beats on both How soon and How big; a line through them, a hatched band for those near it (a seeded setting, 0.5 by default) and an "On the frontier" list. Computed for the fabric and stage shown.
4. **Assumptions in force (B22).** A Setup list (statement, date, "scenario, not forecast"), shown on Frontier and frozen into each edition. This is how "no macro model; assumptions are stated" shows up.
5. **Evidence this edition (B23).** Sources on, pages read, signals found, technologies, and counts by signal type, for the collections up to the edition; frozen into the edition.
6. **What a leader records (B12, deck p.13).** Owner and next action with a date, and resources committed (people, budget, a proof of concept), per technology per fabric, recorded in Tech Lens on the fabric tab beside the path step and the bottleneck. Entered by people, never by the model; a score never changes because of it. The state follows from what's recorded:
   - **Undefined:** a dot on the grid, no owner yet;
   - **Defined:** an owner and a next action;
   - **Aligned:** stage and bottleneck agreed (both recorded);
   - **Integrated:** resources recorded.
   Frontier shows the state on each placement (tooltip, table, Point of View) and counts by state.

### 21 Oct, later: the gaps you found, fixed (portal)

The backend plan's build notes ("21 Oct, later") say what happened and what you decided. In the portal:
- **Technologies:** a bucket strip in Tata's order with counts; "Move to…" on each row's availability and domain; Emerging and Mature least mature first; counts on every filter, a sub-domain filter and "On Tata's list / Found by the radar only"; the possibly nascent view settled from the list (`NascentFlag`, shared with the technology page and the Briefing); select all in a view; confirmations where you are.
- **Technology page:** a journey line and one next step (On Frontier means in the latest published edition); "from Tata's list (file, date)" with what the radar judged; Tata's description; Find evidence leads when there are no pages.
- **Briefing:** to-do rows act in one click with the cost first; Publish the edition.
- **Fabric tab:** two levers per use case with capital and the fabric's key metrics; bottlenecks; the path-to-scale ladder with Nick's evidence text and "evidence for the next step is in hand"; the finance card with loss rates, volume × price, displaced revenue and a payback chart; What a leader records.
- **Point of View:** a short first view (Agentic AI 1,541 px, was 10,189) with labelled folds; one numbering; overrides stated; the same page on Frontier, read-only, frozen with the edition.
- **Frontier:** editions with "moved since", the Growth/Defence lens, the frontier line and near band, assumptions, evidence this edition, commitment states.
- **Setup:** Mechanisms, Assumptions; Finance editable in place.
- **Operations:** every kind of run with tokens in, out, reused, by skill; ids and codes only under Technical details; zones on every time; README brought up to date.
