# Implementation plan 2: the Tech Lens redesign, portal (tech-lens)

**Date:** 2026-10-03 · **Plan:** 2, the day's second · **Status:** frozen and signed off on 2026-10-03. Implementation is under way, phase by phase.
**Revised 3 Oct, after review:**
- back links return you to the exact results you came from (§6.2);
- the technology page follows the master plan's single readiness rule, including runs that stopped partway (§6.1);
- every cost is shown as "about" (§4.5).
**Master plan** (phases, backend, API contract): [tech-atlas implementation-plan.md](../../../../tech-atlas/docs/2026-10-03/2/implementation-plan.md).
**Design it builds:** [UI-suggestions.md](UI-suggestions.md).

The phases, their order and their sign-offs are in the master plan. This file covers the screens.

---

## 1. Ground rules

- **Versions:** Next.js 16.3.4, React 19.2.8, Tailwind 4.3.3. Before using any convention for the first time, read its guide in `node_modules/next/dist/docs/` (see AGENTS.md). These were already checked for this plan:
  - fonts: `01-app/03-api-reference/02-components/font.md`;
  - redirects: `…/05-config/01-next-config-js/redirects.md`;
  - route groups: `…/03-file-conventions/route-groups.md`.
- **Next 16 rules:**
  - `useSearchParams` needs a `<Suspense>` boundary, or the build fails;
  - `useParams` stays synchronous;
  - page files export only the page.
- **No test runner.** Every step ends with `npm run lint` and `npm run build`. Then each changed page is checked against the API on the dev servers. Each phase ends with your demo.
- **Reuse first.** Code that exists three times becomes one: status styles, priority shades, signal chips and pipeline polling.
- **Imports need no changes when files move.** Every import uses the `@/` alias.

## 2. Building blocks, made once and used everywhere

| Block | File | Phase | Replaces |
|---|---|---|---|
| Colour, type and shape tokens | `app/globals.css` (`@theme`) | 1A | 209 hard-coded colours |
| Shades and status styles | `lib/theme.ts` | 1A | 3 copies of STATUS_STYLE, 3 of PRIORITY_STYLE and 3 of scoreShade, plus GRID_CELLS and the run page's own palette |
| FabricLabel | `components/FabricLabel.tsx` | 1A | Plain fabric names |
| TopBar: brand header and menu | `components/TopBar.tsx` | 1A | `Sidebar.tsx` |
| usePipeline: one shared poll | `lib/pipeline.ts` | 1B | 6 separate `/api/pipeline` fetches |
| StatusPill | `components/StatusPill.tsx` | 1B | The strip on every page |
| TechnicalDetailsSwitch | `components/TechnicalDetailsSwitch.tsx` | 1B | HoodSwitch in the sidebar |
| SetupNav and the `(setup)` layout | `app/admin/(setup)/layout.tsx` | 1B | The sidebar's Setup group |
| useChangesCount | `lib/changes.ts` | 1B | The hook inside the sidebar |
| ConfirmAction: a two-step button that shows the cost | `components/ConfirmAction.tsx` | 1B | 3 hand-written inline confirms and one `window.confirm` |
| SignalItem | `components/SignalItem.tsx` | 2 | SignalChip and its 2 inline copies |
| SignalPanel: the side panel | `components/SignalPanel.tsx` | 2 | (new) |
| NextStep banner | `components/NextStep.tsx`, `lib/next-step.ts` | 2 | (new) |
| AnalystBox | `components/AnalystBox.tsx` | 2 | (new) |
| BackLink | `components/BackLink.tsx` | 3 | Fixed "back to …" links |
| ProcessBoard | `components/ProcessBoard.tsx` | 4 | `ProcessStrip.tsx` |
| SavedNote | `components/SavedNote.tsx` | 4 | 8 hand-written save notices |

---

## 3. Phase 0 · Before the next collection (portal part)

This covers the rename, and showing why a page couldn't be analysed (master plan §3.1 and §3.3).

| File | Change |
|---|---|
| `lib/signals.ts:1, 4, 8` | `Mode` uses `"can_ignore"`; its label is "Can ignore" |
| `app/admin/signals/page.tsx:75` | "Can ignore rules set qualifying pages aside: kept, but not used for technologies or assessments." |
| `app/admin/signals/page.tsx:433, 535` | The mode lists become `["never_miss", "can_ignore"]`; the section text at :437–439 changes to match |
| `app/admin/runs/[id]/page.tsx:118` | "Pages set aside by a Can ignore rule are left out." |
| `lib/prompts.ts:61` | "… a Can ignore match sets the page aside … It must keep {never_miss} and {can_ignore}." |
| `app/admin/runs/[id]/sources/[sid]/page.tsx:137–142` | Next to the existing "Partly analysed" badge, each page with an `analysis_error` shows its reason (wording in §8). Example: "Couldn't be analysed: model call failed (Error code: 429 – rate limit reached). Check again retries it." |
| `app/admin/runs/[id]/page.tsx` | Under the sources table, a short list headed "Pages that couldn't be analysed". Each reason shows its page count and sources, and links to those source pages. Hidden when there are none |

The rename ships in the same deploy as the backend change. Once the backend has changed, a portal that still sends `always_ignore` would get a 422.

Renamed technologies staying one technology (master plan §3.2) needs no portal change.

---

## 4. Phase 1 · Look and words

### 4.1 Step 1A: the look

**Tokens** in `app/globals.css`:
```css
@import "tailwindcss";
@theme {
  --color-ink: #040a0e;      --color-muted: #494a52;   --color-faint: #a6abb5;
  --color-line: #d1d6dc;     --color-ground: #f4f6f9;  --color-surface: #ffffff;
  --color-navy: #041a4a;     --color-navy-strong: #020e2b;
  --color-link: #0270e0;     --color-azure: #00a4ff;
  --color-failed: #b60f17;   --color-failed-dot: #f0424c;
  --color-network: #3cc3c2;  --color-cloud: #ff8437;
  --color-iot: #59ca80;      --color-interaction: #9e4aff;
  --radius-card: 10px;
}
@theme inline { --font-sans: var(--font-brand), system-ui, sans-serif; }
```
- **Utilities this gives:** `text-ink`, `bg-navy`, `border-line`, `bg-azure/10`, `rounded-card` and so on.
- **Body:** `body` gets `bg-ground text-ink`.
- **Page titles:** `.font-display` becomes the brand sans at weight 400 with −0.02em letter-spacing. That one edit restyles all 17 page titles and the Point of View headline.
- **Header:** the gradient and its azure bottom edge live in one class, `.brand-header`.
- **Not from the site:** ground, navy-strong (used for hover) and the shade ramp were derived; all the other colours come from it.

**Font.** `app/layout.tsx` loads Montserrat through `next/font/google` and puts its variable on `<html>`. Settings: weights 300–600, `subsets: ["latin"]`, `variable: "--font-brand"`.
- The Docker build already has network access, since it runs `npm ci`.
- If the client licenses Gotham for this tool, switching means `next/font/local` with their files: one file changes.

**Colour mapping.** Every hard-coded colour follows this table:

| Today | Used for | Becomes |
|---|---|---|
| `#8a4b2d` copper, `text-[var(--accent)]` | Links | `text-link` |
| `#8a4b2d`, filled | Never-miss signal chips | `bg-navy text-white`; "Not on the list" chips become `border border-navy text-navy` |
| `#8a4b2d` | Switch in the "on" state; Changes count badge | `bg-azure` (badge text `text-ink`) |
| `#8a4b2d` | Active tab underline; strip box that needs you | `border-azure`, plus an azure ring on the box |
| `#8a4b2d` | Selected fabric card | `ring-2 ring-azure` |
| `#8a4b2d` | Point of View headline rule; data bars | `border-navy`, `bg-navy` |
| `#8a4b2d` | Progress bars | `bg-azure` |
| `#8a4b2d` tints (/40, /30, /10, /5) | Outline chips, quote rules, technology/alias/variable chips; StageFlow active box | `border-navy/30`, `bg-navy/5`; StageFlow active becomes `bg-azure/10 border-azure` |
| `#7a3c1e` dark copper | Error and failure lines; Terminate | `text-failed`, `border-failed/40` |
| `#7a3c1e` | Notices after an action | `text-muted` |
| `#7a3c1e` | Active tab text, chip text, "needs you" text, live stage words | `text-ink`; live stage words also get a pulsing azure dot |
| `#171513` | Main buttons (16 places) | `rounded-full bg-navy text-white hover:bg-navy-strong` |
| `#171513`, `#1c1a17` | Selected pills and segmented controls | `bg-navy text-white` |
| `#171513`, `#1c1a17` | Text | `text-ink` |
| `#2e2b28`, `#211f1c`, `#4d4a45` | Sidebar | Removed with the sidebar |
| `#c4552f`, `#fdf3ee` | Error borders, "Down" dot, error panel | `border-failed/40`, `bg-failed-dot`, `bg-failed/5` |
| `#f7f5f2` | Page background | `bg-ground` |
| `#fbf7f3`, `#faf9f7`, `#faf5f0`, `#d9b8a3` | Quiet panels; the article box | `bg-ground` or `bg-white`, with `border-line` |
| `#fbf3ec` | Check-again banner | `bg-azure/5 border-azure/30`, because something is waiting |
| Copper ramp: P1–P6, scores of 7 and up … | Priority and score shades (3 copies) | The navy ramp in `lib/theme.ts` |
| `#d9b8a3`, `#b97d55`, `#8a4b2d` | Overview horizon bars | The navy ramp, 3 steps |
| The run page's palette `C`: `#8F5230` boxes, `#0F5B57` teal "done", cream and sand | The run's flow chart | Model-step boxes: `bg-azure/10 border-azure/40`. Done: `text-muted` with ✓. Cream and sand: `bg-ground` and `border-line`. Teal belongs to the Network fabric |
| Emerald | Completed chips, enabled dots, "✓ composed", saved notes, Changes "added" | Completed and composed: grey ✓. Enabled: `bg-azure` dot. Saved: `text-ink`. Added: "+" in ink. Green belongs to the IoT fabric |
| Amber | Running, incomplete, partial, open question, composing, unscorable | Running and composing: `bg-azure/10 text-ink` with a pulsing dot. Didn't finish, partial and unscorable: a neutral chip with ◐. Open question: a neutral chip with "?" |
| Red | Failed chips, ✕, error text | `bg-failed/10 text-failed`; ✕ on `bg-failed-dot` |
| `neutral-*` greys (about 590) | Structure | Kept. Neutral greys sit fine with the cool palette, and replacing them would add churn for no visible gain |

**Shades in `lib/theme.ts`:**
- **`STATUS`:**
  - running and terminating: `bg-azure/10 text-ink`, with a pulsing azure dot;
  - completed: `bg-neutral-100 text-muted`, with ✓;
  - failed: `bg-failed/10 text-failed`;
  - terminated and interrupted: `bg-neutral-100 text-muted`;
  - didn't finish: `bg-neutral-100 text-ink`, with ◐.
- **`PRIORITY` (P1–P6) and `scoreShade()`:** a navy ramp, darkest for the highest: #041a4a, #1d3b73, #3f5f99, #8fa6cc, #c9d5ea, #eef2f8. Text is white on the first three.
- **`FABRIC` colours** and **`HORIZON` shades.**
- **Who imports them:**
  - `lib/format.ts` (its STATUS_STYLES moves here);
  - `app/admin/page.tsx`;
  - `scoring/assessments/page.tsx`, `assessments/[id]` and `[aid]`;
  - `config`;
  - `pov/[id]/[tech]`;
  - `runs/[id]`, whose palette `C` is deleted.

**FabricLabel.** A pill in the fabric's colour, with its name in ink. It is used on the assessment run page's fabric pills, the `[aid]` page, the Point of View page and the Fabrics setup page.

**Files to restyle**, with how many hard-coded colours each has:
- **20 or more:** runs/[id] 26, assessments/[id] 24, signals 21.
- **5 to 19:** config 18, [aid] 17, globals.css 11, admin/page 9, pov/[id]/[tech] 7, changes 7, technologies/[id] 6, prompts/[name] 6, runs/[id]/sources/[sid] 5, SignalChip 5, BackendError 5.
- **Under 5:** ProcessStrip 4, sources/[id] 4, pov 3, StageFlow 3, technologies 3, fabrics 3, assessments 3, runs 3, sources/settings 2, pending 2, measures 2, scoring/layout 2, SourceBrowser 1.
- **Accent only:** EvidenceLine.
- **Deleted:** Sidebar (7).

**TopBar** replaces `Sidebar.tsx`. `app/admin/layout.tsx` becomes TopBar plus a `<main>` up to 1,400px wide.
- **Left:** a "Tech Lens" wordmark, with room for the client's logo file.
- **Menu in phase 1:** Overview · Signals · Technologies · Assessments · Points of View │ Operations · Setup.
  - Phase 2 renames Overview to Briefing.
  - Phase 3 removes Assessments.
  - Collections (today's "Collect evidence") moves into Operations.
- **Active item:** an azure underline. Setup shows the Changes count.
- **Right:** the status pill, from step 1B.
- **Narrow screens:** the wordmark, the pill and a menu button that opens the same entries.
- **Printing:** `print:hidden`, so printed Points of View stay clean.
- **Until 1B:** Operations points to `/admin/runs` and Setup to `/admin/sources`; 1B adds their pages.

**Buttons and cards:**
- Main button: `rounded-full bg-navy text-white`.
- Secondary button: `rounded-full border border-line bg-white`.
- Cards: `rounded-card border border-line bg-white`.

**Demo 1A:** every page in the new look, under the new top menu. Nothing has moved yet.

### 4.2 Step 1B: Operations, status and Setup

**usePipeline** (`lib/pipeline.ts`) is one poll that every reader shares. It is a module-level store read through `useSyncExternalStore`, the same pattern `lib/hood.ts` uses.
- **Polling:** every 5 s while anything is live, every 30 s otherwise, and again when the window regains focus.
- **After any action:** call `refreshPipeline()`.
- **It replaces these fetches:** ProcessStrip:39, admin/page.tsx:209, runs:36, signals:115, assessments:52 and assessments/[id]:125.

**StatusPill**, in the TopBar:

| State | Text |
|---|---|
| Collecting | ● Collecting · 12 pages so far |
| Checking | ● Checking pages · 31 of 216 |
| Organizing | ● Organizing technologies |
| Assessing | ● Assessing · 2 of 6 technologies |
| Writing | ● Writing Points of View · 1 of 6 |
| Idle | ● Last collected 3 Oct |
| Never collected | ● Not collected yet |
| Any of the above, with problems | … · 3 problems |

- **Dot:** pulsing azure while something runs; grey when idle; red when the latest collection failed.
- **Problem count:** `incomplete + errors` from the latest collection.
- **When clicked**, it opens a small panel with what's running and its progress, and a Problems link to the latest collection's page. From phase 4 that link goes to Operations.
- **Accessibility:** `role="status"`.

**Operations** is a new page at `app/admin/operations/page.tsx`. It holds:
- **Header:** PageHeader "Operations", with the Technical details switch.
- **The process strip,** moved here from the layout. It no longer appears on other pages.
- **Collections:** the latest 10, with "All collections →" to `/admin/runs`.
- **Assessment runs:** the latest 10, with "All assessment runs →" to `/admin/scoring/assessments`.
- **Service health,** moved from the Overview.

The two tables are extracted from `runs/page.tsx` and `scoring/assessments/page.tsx` into `CollectionsTable` and `AssessmentRunsTable`, so the full pages and Operations share them. They refresh when usePipeline reports a change, instead of running their own timers.

**Technical details switch.** HoodSwitch leaves the sidebar and becomes `TechnicalDetailsSwitch`. It appears in the header of the four places that have technical detail:
- Operations;
- the collection page;
- a collection's source pages;
- the assessment run page.

"Under the hood" becomes "Technical details".

**Setup**, built as a route group so that no address changes:
1. **Move into `app/admin/(setup)/`:**
   - `sources/`, with `[id]` and `settings`;
   - `prompts/` (Skills);
   - `changes/`;
   - the scoring setup pages: `scoring/page.tsx`, `fabrics`, `measures`, `config`, `pending` and their tab layout.
2. **Add `app/admin/(setup)/layout.tsx`.** It renders SetupNav: Sources · Signal list · Scoring method · Skills · Crawl settings · Changes, with the Changes count.
3. **Give the signal list its own page.** The editor leaves the Signals page and moves to `app/admin/(setup)/signals/list/page.tsx`, with `SignalListEditor` made from today's ListTab and SignalEditor. "Make it a signal" opens this page with the name and description filled in from the URL.
4. **Move `app/admin/scoring/layout.tsx` with them, to `(setup)/scoring/layout.tsx`.** It drops its "setup routes only" check, because only setup pages sit under it now. Assessments and Points of View keep their addresses and no longer have a layout of their own.
5. **Add redirects in `next.config.ts`:**
   - `/` → `/admin` (today `/` has no page);
   - `/admin/signals?tab=list` → `/admin/signals/list`.
6. **Confirm with a build** that the shared segments `scoring/` and `signals/` resolve as expected. Next only forbids two groups resolving to the same path. If it doesn't work, move Setup under `/admin/setup/` with redirects.

**ConfirmAction** turns `[Check again · about 216 model calls]` into "Check 216 pages again? About 216 model calls." with [Start] and [Cancel]. It replaces the three hand-written confirms and the `window.confirm` on "Recompose all".

### 4.3 Words

| Where | Today | New |
|---|---|---|
| ProcessStrip :83, :101, :112, :121, :133 | Collect evidence · Identify signals · Organize technologies · Assess opportunities · Produce Points of View | Collect · Signals · Organize · Assess · Points of View |
| runs/page.tsx :74–75 | "Step 1" · "Collect evidence" | "Operations" · "Collections" |
| runs/[id] :666, :706, :710, :719 | Eyebrow "Collect evidence"; step cards | Eyebrow "Collection"; step cards Collect · Signals · Organize |
| signals :72 | Eyebrow "Identify signals" | (none) |
| technologies/page.tsx :118 | "What the scouts actually found" | "Technologies" |
| scoring/assessments/page.tsx :93–94 | "Step 4" · "Assess opportunities" | "Operations" · "Assessment runs" |
| scoring/pov/page.tsx :127–128 | "Step 5" · "Produce Points of View" | "Points of View" |
| signals :18, :226, :261; lib/signals.ts :82; ProcessStrip :103; runs/[id] :713; admin/page.tsx :311 | Other | Not on the list |
| signals :439; runs/page.tsx :125; admin/page.tsx :314 | Various explanations of set aside | "kept, but not used for technologies or assessments" |
| signals :137, :148, :149, :153, :159, :252, :470; ProcessStrip :104–105; pipeline.ts :55–63; admin/page.tsx :330; runs/[id]/sources/[sid] :139; prompts.ts :58 | Re-check · Re-checking · "Re-check needed: N pages" | Check again · Checking · "N pages not yet checked against the signal list" |
| runs/[id] :637, :775 | Under the hood | Technical details |
| ProcessStrip :91; runs/[id] :376; SourceBrowser :242 | incomplete · Incomplete | didn't finish · Didn't finish |
| prompts/[name] :71, :78, :117 | prompt | skill |

### 4.4 Every number gets a label and a time frame

| Where | Today | New |
|---|---|---|
| Strip, Collect (ProcessStrip :84–86) | 30 (30 new) | 30 pages · 30 new or changed |
| Strip, Signals (:102–103) | 12 · 3 other · 4 set aside | 12 signals · 3 not on the list · 4 set aside, in the last collection |
| Strip (:104) | Re-checking 5/30 | Checking 5 of 30 pages |
| Strip, Organize (:113) | 245 | 245 technologies |
| Strip, Assess (:122–123) | 6/6 | 6 of 6 technologies |
| Strip, Points of View (:134–136) | 5 · 2 pending / Writing 3/10 | 5 written · 2 to write / Writing 3 of 10 |
| Collections list (runs :159–170) | 30 (30) · 12 · 4 set aside | 30 · 30 new, under a column titled "Pages saved · new or changed"; 12 signals · 4 set aside |
| Collection page (runs/[id] :684, :382–386) | 3m 12s · 12 (3) | took 3m 12s · 12 · 3 new |
| Technologies list (:140, :166, :170–171) | "last resolve completed · R raw → T technologies · D docs stamped"; 120 / 4; 12 · 30 · 8 | "Organized 3 Oct · R names → T technologies · D pages linked"; 120 articles · 4 PDFs; H1 12 · H2 30 · H3 8 |
| Technology page (:144–146) | N docs · N pages · N sources | 12 pages from 4 sources, all time |
| Assessment runs (assessments :149–151) | 6/6 techs · 160 calls | 6 of 6 technologies · 160 model calls · finished 3 Oct 14:05 |
| Assessment run (assessments/[id] :246–251) | status · stage · 6/6 techs · N LLM calls · started … | The same facts, each with its label |
| Points of View list (pov :150–155, :172, :181) | 3/10 PoVs · N failed; (N) | Writing 3 of 10 · 1 failed; Write 6 · about 6 model calls |

### 4.5 The cost on every model button

| Button | Where | What it shows |
|---|---|---|
| Start a collection | Operations strip; Collections page | Asks first: "Start a collection? Up to 40 pages from each of 4 websites, plus the saved searches of 2 data sources. Each new or changed page uses at least one model call." (from `GET /api/runs/preview`) |
| Check again | Signals banner | "216 pages not yet checked against the signal list. About 216 model calls." |
| Organize technologies (today "Run resolve") | Technologies page | "Uses a few model calls for names it hasn't seen." |
| Run assessment | Assessment runs page | "6 technologies qualify · about 168 model calls (up to 300)." This comes from the preview and replaces "×26" |
| Resume | Assessment run page | "About N model calls for the K technologies left." (the preview, with those technologies' ids) |
| Write one Point of View | Points of View list and page | "About 1 model call" |
| Write the waiting ones | Points of View list | "Write 6 · about 6 model calls" |
| Rewrite all | Points of View list | Asks first: "Rewrite all 12 Points of View? About 12 model calls. The current versions are replaced." |

Every figure is an approximate baseline. Long pages split into parts, and retried calls, can add to it, so the wording always says "about". Assessment figures come from the configured measures and fabrics, through the backend's estimate.

**Demo 1B:**
- the status pill;
- Operations, with the strip, collections, assessment runs and service health;
- Setup, with its side menu and the signal list's own page;
- plain words, labelled numbers, and a cost on every model button.

---

## 5. Phase 2 · Briefing

### 5.1 Briefing

`app/admin/page.tsx` is rewritten. Its data comes from `GET /api/briefing?days=…` and usePipeline.
- **Header:** "Radar briefing", with the window selector "Collected 27 Sep – 3 Oct ▾", offering the last 7 or 30 days. The choice is kept in the URL (`?days=`), inside a Suspense boundary.
- **Freshness line:** "Last collected 3 Oct from 6 sources · 30 new pages · 3 problems →". The problems link goes to the latest collection; from phase 4 it goes to Operations.
- **What's new, by technology:**
  - **Up to 10 groups.** Each heading reads "name · N new pages · N signals" and then the technology's state. That is "assessed 7 Sep", "not assessed yet", "being assessed", "assessment stopped partway" or "assessment switched off". The heading ends with "Open →" to the technology.
  - **Items** are compact SignalItems; clicking one opens the side panel.
  - **"and N more new pages"** links to the technology's evidence pages.
  - **After the groups:**
    - more technologies as one short line each;
    - then "No technology yet";
    - then "See all N signals →", which opens Signals for the same window.
- **Below the findings:** the analyst box and New Points of View, side by side on wide screens.
- **Empty states:**
  - **Never collected:** "Start your first collection. It visits up to 160 pages across 6 sources and finds signals on each new page." [Go to Operations]
  - **Quiet window:** "Nothing collected 27 Sep – 3 Oct. Last collected 12 Sep." [Show the last 30 days]

### 5.2 SignalPanel, the side panel

- **Address:** `?signal=<doc_id>:<n>` is added to the current page's URL with `router.replace`, without scrolling, so the panel can be shared. Closing it removes the parameter.
- **Data:** `GET /api/signals/found?doc_id=…`, then take the n-th signal.
- **Content:** as in the UI-suggestions wireframe. The buttons are "Open technology" and "Open the page ↗". For a signal not on the list, it also offers "Make it a signal", which opens `/admin/signals/list` already filled in.
- **Behaviour:**
  - Esc or × closes it;
  - focus moves into the panel and returns to the item afterwards;
  - it's a non-modal dialog;
  - on narrow screens it fills the width.

### 5.3 SignalItem

One component shows a signal everywhere. It has a compact form for the Briefing and the technology page, and a full form for the Signals feed. It shows the chip, what happened, who and when, why it matters, the source, the date and the technologies. SignalChip and its two inline copies, in signals and technologies/[id], are deleted.

### 5.4 Signals feed

`app/admin/signals/page.tsx` is rewritten.
- **Switch:** [On the list N] [Not on the list N] [Set aside N], counted within the window.
  - **On the list** is the sum of the signal facets, leaving out `other`.
  - **Not on the list** is `facets.signal.other`.
  - **Set aside** is the Set aside total.
  - URL parameters stay as they are (`tab`, `run`), so existing links keep working. `days` is added.
- **Window:** the last 7, 30 or 90 days, or All.
- **Filters,** with counts:
  - signal type;
  - source;
  - technology search;
  - collection, as a removable chip when the link came from a collection page.
- **Items** are full SignalItems; clicking one opens the panel.
- **Not on the list** shows groups, each with "N times", examples and "Make it a signal".
- **Set aside** shows each page with its rule and the line "kept, but not used for technologies or assessments".
- **Check-again banner:** reworded, and shown above the switch when pages are waiting. "Tune the list →" goes to `/admin/signals/list`.

### 5.5 For the analyst

- **AnalystBox** reads `pipeline.for_analyst`. Items come in process order: check, resume, assess, write. A technology appears in at most one item, because the backend reads each item off the technology's single state, the same one its page shows. Each item shows one sentence and a ConfirmAction with its cost, worded as in §8. While that item's job runs, the item shows its progress instead; if the job is blocked, it shows the reason from `blockedReason`.
- **What each action calls:**
  - Check calls `POST /api/signals/recheck`.
  - Resume calls `POST /api/scoring/runs/{id}/resume` for the run that stopped partway.
  - Assess calls `POST /api/scoring/runs` with `{technologies: tech_ids}`.
  - Write calls `POST /api/scoring/povs/compose_all` with `{recompose: false}`.
  - Every action then calls `refreshPipeline()`.
- **The status pill's panel** gains "For the analyst · 2 things → Briefing".

### 5.6 NextStep

- **Where:** mounted once, in the admin layout, under the TopBar.
- **When it shows:** usePipeline reports a job moving from running to completed: a collection (`collect.run_id`), a check (`signals.recheck.id`), an assessment run (`assess.scoring_run_id`) or a Point of View job (`pov.job.id`).
- **What it shows:** a single banner with the latest result (`role="status"`), with its next action and a "Later" button that dismisses it. The messages are listed in §8.
- **The next step it offers:** the first waiting item that comes after the step that just finished. Otherwise it offers a link to the results.
- **Only work that finishes while the portal is open** triggers it. Anything that finished while you were away shows under "For the analyst".

### 5.7 What moves off the old Overview

| Today on the Overview | Moves to |
|---|---|
| Service health | Operations (moved in 1B) |
| Source breakdowns by horizon and cost | One line on Sources: "136 sources · 6 switched on · H1 41 · H2 52 · H3 43 · 98 free · 38 paid" |
| Skills counts | The Skills page header |
| Top signals | Hit counts on the Signal list (already there) |
| Technologies by horizon | The Technologies list (already there) |
| Number of collections | The Collections page header |

### 5.8 Readers of the old flag

ProcessStrip and the assessment runs page read `assess.techs_with_new_evidence` instead of `assess.new_evidence`.

**Demo:**
- the Briefing as the home page;
- clicking a signal opens the side panel without leaving the page;
- the Signals feed with its switch and window;
- start a check from "For the analyst", then see the next-step prompt when it finishes.

---

## 6. Phase 3 · Technology hub

### 6.1 The hub

`app/admin/technologies/[id]/page.tsx` is rewritten.
- **Data:**
  - `GET /api/technologies/{id}/summary`;
  - `GET /api/signals/found?tech=<name>&limit=10`, merged with `summary.new_pages.recent` for "What's happening";
  - `GET /api/technologies/{id}/documents` for evidence pages. Each page comes marked `new` by the backend, using the master plan's rule (§5.1), so the portal never works it out itself.
- **Sections, in order:**
  1. **Back link.**
  2. **Header:**
     - the name;
     - FabricLabels for the fabrics it was assessed in;
     - the main button;
     - Manage ▾.
  3. **Status line:** "Assessed 7 Sep · best P2 in Cloud · read 9 pages from 2 collections · 3 new pages since".
  4. **What's happening:** the 5 newest items, signals and new pages together, then "All signals →", which opens Signals filtered to this technology.
  5. **Assessment:** one row per fabric, showing:
     - its FabricLabel;
     - priority;
     - horizon;
     - three TORA bars;
     - "Details →" to the `[aid]` page.

     Below the rows: EvidenceLine and "Assessment run →". When it hasn't been assessed: "Not assessed yet" with [Assess now · about N model calls].
  6. **Point of View:**
     - the headline;
     - "Written 8 Sep · version 2";
     - "New since written: 3 pages";
     - [Open] and [Rewrite].
  7. **Evidence pages,** collapsed; new pages are marked.
- **The main button, by state.** The state comes from the master plan's readiness rule (§5.1). The waiting count and "Write the waiting ones" use the same rule, so the technology page and the batch always agree.
  - **`off`:** no button. The page says "Assessment switched off", with a link to Manage.
  - **`assessing`:** no button. It shows "Being assessed now", with the run's progress.
  - **`stopped_partway`:** [Resume].
    - The page says "Assessment stopped partway on {date}. The results below are from the previous assessment." When there is no previous assessment, it says "Not assessed yet".
    - [Resume] asks first, with the estimate for what's left.
    - It then calls `POST /api/scoring/runs/{run}/resume`, the existing Resume.
  - **`not_assessed` or `new_evidence`:** [Assess now].
    - It asks first: "Assess {name}? About {assess_calls} model calls (up to {max})."
    - It then calls `POST /api/scoring/runs` with `{technologies: [id]}`.
    - Progress shows in the pill, and the summary reloads when the run finishes.
  - **`no_pov`:** [Write Point of View]. It asks first: "Write the Point of View? About 1 model call." It then calls `POST /api/scoring/runs/{run}/pov/{tech}` and reloads.
  - **`current`:** [Open Point of View].
- **"Read N pages"** in the status line uses `pages_read`: the pages the assessment actually included.

  When another assessment or a check is running, the button is disabled and shows the reason.
- **Manage ▾** opens today's curation tools: aliases, rename, claim an alias, switched on, and merge. Merge now asks first: "Merge X into Y? X's pages move to Y, and X is removed."

### 6.2 Back links

**A back link returns you to the exact results you came from.**
- **The link carries the address.** Links into the technology page, the Point of View page and the assessment pages carry the full address you were on, with its time window and filters. For example, `from=/admin/signals?tab=found&days=30&signal=product-launch`.
- **BackLink** links straight back to that address. Its label comes from the section, such as "← Signals" or "← Briefing".
- **Safety:** only the portal's own addresses, those starting with `/admin`, are accepted.
- **Fallback:** without a valid `from`, the link goes to the section's list.

### 6.3 Assessment and Point of View pages link to the hub

- The `[aid]` page gets "Technology →".
- The Point of View page gets "← {technology}".
- The assessment run table links each technology's name to its hub.

### 6.4 Points of View library

Each card shows:
- the headline and technology;
- one FabricLabel per fabric, with its priority and horizon;
- "Written {date} · version {n}";
- "New since written: N pages" when there are any.

"Assessed, not yet written" follows the readiness rule. It also lists technologies reassessed since their Point of View was written, and each row offers "Write from the latest assessment".

### 6.5 Top menu

Assessments leaves the menu. Batch runs live on Operations, and single assessments on each technology.

**Demo:**
- follow one technology from a Briefing signal to its Point of View in three clicks, with no menu;
- Assess now on a technology with new pages;
- the "New since written" badge in the library.

---

## 7. Phase 4 · Operations board

### 7.1 ProcessBoard

It replaces the strip; `ProcessStrip.tsx` is deleted. There are five columns. Each shows its state and has one button; while that step runs, its progress replaces the button.

| Column | Shows | Button |
|---|---|---|
| Collect | Last collected 3 Oct · 30 new pages · 1 didn't finish | [Collect now], which asks first and shows the preview |
| Check signals | 216 pages not yet checked | [Check again], with its cost |
| Organize | Automatic after each collection · last 3 Oct | none |
| Assess | 6 technologies have new pages | [Assess], with the estimate |
| Points of View | 6 to write | [Write], with its cost |

### 7.2 Problems

`GET /api/problems`, worded by the portal:

| Kind | Sentence | Fix |
|---|---|---|
| `didnt_finish` | "{source} didn't finish: {N} links left." | [Crawl settings]: "Raise the page budget, or add skip patterns for sections you don't need." |
| `too_broad` | "{source}: a saved search is too broad." | [Open source] |
| `not_configured` | "{source} isn't configured." | [How]: "Add {keys} to .env, then restart tech-atlas." |
| `source_error` | "{source} failed: {error}" | [Open collection] |
| `failed_pages` | "{N} pages couldn't be analysed: 3 × model call failed (rate limit reached), 1 × reply not in the expected format." [Show pages] lists each page with its reason | [Check again] |
| `job_failed` | "The {job} stopped: {error}" | [Resume], [Check again], [Write again] or [Open] |

### 7.3 History

Collections (`/api/runs`) and assessment runs (`/api/scoring/runs`) are merged, newest first, 20 rows at a time with "Show more". Examples:
- "3 Oct 14:05 · Collection · 30 new pages · 22 signals · 1 didn't finish · Completed →"
- "3 Oct · Assessment · 6 technologies · 160 model calls · Completed →"

### 7.4 Also in phase 4

- **The status pill** takes its problem count from `pipeline.problems`, and its Problems link opens Operations.
- **SavedNote** shows "Saved. Applies from the next run. Listed in Changes." It is used in the 8 setup editors: sources/[id], crawl settings, the skill editor, fabrics, measures, config, pending and the signal list editor.
- **Crawl settings** gets a "Page budget per source" field (1–500).
- **Operations** also keeps Service health at the bottom and the Technical details switch in its header.

**Demo:**
- the board;
- a problem with its fix, such as raising the page budget in Crawl settings;
- the history.

---

## 8. Words for the new elements

| Element | Text |
|---|---|
| For the analyst: check | "216 older pages not yet checked against the signal list" · [Check · about 216 model calls] |
| For the analyst: assess | "6 technologies have new pages since their assessment" · [Assess · about 168 model calls] |
| For the analyst: resume | "The assessment run of 3 Oct stopped with 3 technologies left" · [Resume · about 78 model calls] |
| For the analyst: write | "6 technologies are waiting for a Point of View from their latest assessment" · [Write · about 6 model calls] |
| Next step after a collection | "✓ Collected 30 new pages from 6 sources (1 didn't finish; 1 couldn't be analysed: model call failed)." Next: the first waiting item, otherwise [See what's new] |
| Next step after a check | "✓ Checked 216 pages: 40 signals found, 32 set aside. 2 couldn't be analysed: model call failed (rate limit reached)." Next: assess, if any are waiting; otherwise [See signals] |
| A page that couldn't be analysed | "Couldn't be analysed: {reason} ({detail}). Check again retries it." |
| A page whose last check failed | "Last check failed on {date}: {reason} ({detail}). Showing the earlier analysis." |
| A partly analysed page | "Partly analysed: {n} of {m} parts failed ({detail})." |
| Next step after an assessment run | "✓ Assessed 6 technologies (1 skipped)." Next: "Write 6 Points of View" [Write them · about 6 model calls] |
| Next step after writing | "✓ Wrote 6 Points of View (1 failed)." Next: [Open Points of View] |
| Technology switched off | "Assessment switched off for this technology." [Manage] |
| Assessment stopped partway | "Assessment stopped partway on {date}. The results below are from the previous assessment." [Resume · about N model calls] |
| Being assessed | "Being assessed now · {done} of {total} technologies in this run" |
| Briefing, never collected | "Start your first collection. …" [Go to Operations] |
| Briefing, quiet window | "Nothing collected 27 Sep – 3 Oct. Last collected 12 Sep." [Show the last 30 days] |

## 9. Verification

- **Every step:** `npm run lint` and `npm run build`. The build also proves the route group and the Suspense boundaries are right.
- **Every phase:**
  1. Start the dev servers (`tech-atlas/start.sh`; the portal on 3100).
  2. Check that every changed route answers 200.
  3. Check each new screen's data against its API.
  4. Your demo.
  5. Docker.
- **Printing:** a Point of View still prints cleanly, with no top bar, pill or banners.
- **Narrow screens:** check at 400px wide. The top bar collapses, the side panel fills the width, and nothing scrolls sideways.

## 10. Files by phase

| Phase | New | Changed | Moved | Deleted |
|---|---|---|---|---|
| 0 | none | lib/signals.ts, signals/page, runs/[id], runs/[id]/sources/[sid], lib/prompts.ts | none | none |
| 1A | lib/theme.ts, FabricLabel, TopBar | globals.css, app/layout.tsx, admin/layout.tsx, lib/format.ts, the 27 files listed in 4.1 | none | Sidebar.tsx |
| 1B | lib/changes.ts, StatusPill, TechnicalDetailsSwitch, ConfirmAction, CollectionsTable, AssessmentRunsTable, ServiceHealth, SignalListEditor, operations/page, (setup)/layout, (setup)/signals/list/page | lib/pipeline.ts, next.config.ts, admin/layout.tsx, and the pages in 4.3–4.5 | sources, prompts, changes, and the scoring setup pages with their tab layout, into `(setup)/` | none |
| 2 | SignalItem, SignalPanel, NextStep, AnalystBox, lib/next-step.ts | admin/page (rewritten as the Briefing), signals/page (rewritten as the feed), runs/[id]/sources/[sid] (uses SignalItem), StatusPill, ProcessStrip, assessments page, SourceBrowser, Skills page | none | SignalChip.tsx |
| 3 | BackLink | technologies/[id] (rewritten as the hub), PoV list and page, assessment pages, TopBar | none | none |
| 4 | ProcessBoard, SavedNote | operations/page (rewritten as the board), StatusPill, crawl settings, the 8 setup editors | none | ProcessStrip.tsx |

The README's description of the portal is updated at the end of each phase.

---

## 11. Build notes

### Phase 0, built 3 Oct

- **Built as planned:**
  - "Can ignore" in the mode lists, labels and help text;
  - the collection's source pages show each page's reason;
  - the collection page lists "Pages that couldn't be analysed", grouped by reason, with links to the sources.
- **Wording simplified:** every page that couldn't be analysed says "Couldn't be analysed: {reason} ({detail}). Check again retries it.", with the time. The separate "Last check failed … Showing the earlier analysis" line was dropped, because a page's earlier analysis can itself be a failure; one sentence is always true. Partly analysed pages say "Partly analysed: {detail}."
- **Technology chips on the Signals page link by id** (`technology_ids` from the API). Without a matching id they show as plain text, never a broken link.
- **Checks:** `npm run lint` and `npm run build` are clean.

### Phases 1–4, built 4 Oct

The user signed off phase 0 and asked for the rest to be built in one go, stopping only for a design or implementation change. None was needed; the choices below stay inside the plan.

- **Built as planned:**
  - **1A, the look:** tokens, Montserrat, `lib/theme.ts`, FabricLabel, TopBar; the Sidebar is gone.
  - **1B:** the shared `usePipeline` poll, StatusPill, TechnicalDetailsSwitch, the `(setup)` route group with its side menu, ConfirmAction, the redirects, and the words, labelled numbers and costs of §4.3–4.5.
  - **Phase 2:** the Briefing, SignalItem, SignalPanel, the Signals feed, AnalystBox, NextStep.
  - **Phase 3:** the technology hub, BackLink, links into the hub, and the Points of View library.
  - **Phase 4:** ProcessBoard, Problems, History, SavedNote in the setup editors, and the page budget in Crawl settings.
- **Choices inside the plan:**
  - **Operations went straight to its phase 4 form:** board, Problems, History, Service health. The 1B interim parts (the strip on Operations, two latest-10 tables, extracting CollectionsTable and AssessmentRunsTable) would only have been replaced; `ProcessStrip.tsx` is deleted. The full Collections and Assessment runs pages keep their own tables.
  - **The menu is in its final form:** Briefing · Signals · Technologies · Points of View │ Operations · Setup. Operations is also highlighted on collection and assessment-run pages.
  - **One place for each action:** `lib/actions.ts` holds the five actions that start work, plus the collection question. CollectButton serves both the board and the Collections page.
  - **Problems:** the sources that didn't finish come as one row with one fix, since several usually come together. The number of links left is read from each note, old wording included.
  - **The source editor stays on the page after saving** and shows the saved note; it used to go back to the list.
  - **The Point of View page's back link** goes to the address it came from, otherwise "← {technology}". The page also links "Technology →".
  - **Briefing:**
    - after the 10 full groups, 20 more technologies show as short lines, the rest as a link to Technologies;
    - "See all N signals" counts the window's signals with one small request.
  - **Old Overview tiles:** the counts listed in §5.7 moved (Sources and Skills headers, Collections header); the rest are dropped.
- **Two small backend additions for screens:**
  - `GET /api/runs` rows carry `incomplete`, for History's "didn't finish";
  - the pipeline's `collect` carries `error`, so the pill's dot turns red only for a real failure, not a run a person stopped.
- **The Signals area** (a second engineer worked on it alongside):
  - **Feed:** the switch with its counts, the window, filters for signal type, source, technology and collection, and an address that holds them all (`tab`, `days`, `run`, `type`, `source`, `tech`, `signal`).
  - **Signal type uses `type`,** because `signal` is the side panel's address.
  - **SignalItem, SignalPanel** (Esc closes it, focus returns to the item), and the signal list page.
  - **Delete on each signal row,** which the user asked for. It asks first, saying what changes: signals already found stay on their pages, and changing the list marks stored pages as not yet checked.
  - **"Make it a signal"** opens the list page already filled in.
- **Checked:**
  - `npm run lint` and `npm run build` are clean.
  - Every route answers 200, and both redirects work.
  - Every page loads in a headless browser with no errors, against the dev copy and against Docker.
  - **At 400px:**
    - the side panel fills the width, and the top bar fits on one line;
    - the technology page's score bars and the collection source page's columns stack instead of scrolling sideways;
    - nothing scrolls sideways.
- **Deployed to Docker on 4 Oct,** together with the backend.
