# Implementation plan 4: say how solid each result is (portal, tech-lens)

**Date:** 2026-10-04 · **Folder:** 2026-10-04/3, after GPT's review in [folder 2](../2/ux-review-and-recommendations.md) · **Status:** approved on 4 Oct ("make the plan and then execute it"). Build notes in §9.

**Backend and skills:** [tech-atlas plan 4](../../../../tech-atlas/docs/2026-10-04/3/implementation-plan.md).

---

## 1. Why

GPT's review found the right problem: scores, priorities and statuses appear without saying how solid they are or how old. I checked each claim against the code and the live data on 4 Oct:

- **Hidden coverage.** AgenticOps shows Strategic fit 8, but only 1 of its 3 measures had evidence. Adoption shows "—" from 0 of 3. The API sends these counts; the technology page drops them.
- **A verdict that isn't one.** Agentic AI's grey line says "Best P2 in Cloud", which reads like the verdict for the whole technology. Without a priority, the line says just "Assessed ·", with no date.
- **Unexplained gaps.** A missing priority is explained only in a hover tooltip on the run page.
- **Old work looks new.** The Point of View says "Written Oct 4". It doesn't say it rests on the Sep 11 assessment.
- **A backlog on a reading page.** 133 "Write" rows follow the one written Point of View. "Rewrite all" beside that one card writes 134.
- **Five steps that aren't.** Operations numbers five steps, though collecting already finds signals and organizes technologies. After each collection, the "Next:" banner points at checking older pages.
- **Briefing.** It says "most important first", but the order is your signal list's. A 400 px details column sits empty until you click a finding.
- **The Point of View text itself** overstates and repeats. That is a skill fix; see the atlas plan §3.

What this plan leaves out of GPT's plan, and why, is in §8.

## 2. Rules for every change

- A number says how solid it is, beside it and in words: "8 · 1 of 3 measures", "Not enough evidence (0 of 3)". Never a dash alone, never an empty bar.
- Scores show at most one decimal.
- Results carry their date: "Assessed Sep 11". A Point of View says which assessment it rests on.
- No new pages, endpoints, tabs or libraries. Reuse what is there.
- Each changed page updates its intro and its "How to read this page" box.
- Every box fills its row. Check at 400, 1,100, 1,440 and 1,920 px.

## 3. Step 1: scores and dates

**Shared helpers** (`lib/scoring.tsx`):
- `formatScore(n)`: at most one decimal (7.29 → "7.3", 8 → "8").
- `scoreNote(axis)`: what a score rests on. It is empty when every measure was scored, "1 of 3 measures" when some were, and "Not enough evidence (0 of 3)" when none were.
- `noPriorityReason(placement)`: for example "No priority or horizon yet: not enough evidence on how soon it arrives." It comes from the placement's how-soon and how-big inputs.

**Technology page** (`app/admin/technologies/[id]/page.tsx`):
- **Fabric rows:**
  - each score shows "· 1 of 3" when partial;
  - a score with no evidence shows "not enough evidence" in place of the bar;
  - a row without a priority says why, which needs `placement` in the summary (atlas B3).
- **Grey line:** "Assessed Sep 11 · read 26 pages · …", replacing "Best P2 in Cloud" and the bare "Assessed".
- **"Up to date" sentence:** names the assessment date.
- **Empty findings:** a technology with pages but no findings says "No findings yet. Its 6 pages are listed below."
- **"Evidence from collections":** hidden when not recorded. It used to say "Not recorded (assessed before the upgrade)" (`components/EvidenceLine.tsx`).
- **Help text:** updated.

**State meanings** (`lib/states.ts`): "Up to date" adds "That doesn't mean the evidence is complete: its Point of View lists what's missing."

**Assessment page** (`app/admin/scoring/assessments/[id]/[aid]/page.tsx`):
- **Title:** the display name, so "AgenticOps", not the stored "agenticops".
- **Header line:** "Assessed Sep 11 · read 6 pages", plus "recalculated <date>" only for recomputed rows. The bare "scored" goes.
- **Score cards:** "Partial: 2 of 3 measures scored". With nothing scored: "Not enough evidence: 0 of 3 measures scored".
- **"Outside TORA":** becomes "Other measures", showing measure names instead of the codes X1–X3.
- **Placement:** plain sentences, with the reason when there is no priority.
- **Metrics to watch:**
  - intro: "Suggested by the assessment and not tracked automatically: the next assessment checks them";
  - "should rise ↑" replaces "watching it rise";
  - the labels become Now, Threshold and If crossed;
  - a source link appears when the metric has one (new skill field).
- **Pages section:** "The evidence dossier" becomes "Pages linked to this technology now". Its text already says the list is today's.
- **Help text:** updated.

**Run page** (`app/admin/scoring/assessments/[id]/page.tsx`): titled "Assessment run · Sep 11". The run id shows only with Technical details on.

## 4. Step 2: Points of View

**Point of View page** (`app/admin/scoring/pov/[id]/[tech]/page.tsx`):
- **Header:** "Written Oct 4 · from the Sep 11 assessment · version 1", with the date only. The assessment date is the earliest `created_at` of its assessments, which the page already loads.
- **Order:** headline, Recommendation, Summary, Evidence gaps, Metrics to watch, then the rest.
- **Scores table:**
  - measure coverage under each score;
  - "Priority" and "Horizon" spelled out;
  - a "Details →" link per fabric to its assessment, which lists the cited sources;
  - a one-line key.
- **"How the scores were derived":** closed until opened. Printing opens it.
- **Load errors:** a failure to load the scores or measure names shows its reason. Before, the column just vanished.
- **"Print / Save as PDF"** replaces "Download PDF".
- **Metrics to watch:** the same words as the assessment page. They are written once per technology and copied to each fabric, so one set is complete.
- **Help text:** updated.

**Points of View list** (`app/admin/scoring/pov/page.tsx`):
- **Waiting list:** replaced by one line linking to Technologies → "Ready for a Point of View". Search, paging and "Write these N" already live there.
- **Cards:** "Written Oct 4 · from the Sep 11 assessment" (atlas B4).
- **Long lists:** a search box and "Show more" (24 at a time).
- **"Rewrite all":** the question gives the real scope: N replaced and M written for the first time.
- **Help text:** updated.

**Waiting links** (`lib/waiting.ts`): "ready for a Point of View" links to the Technologies filter, as "new pages" already does.

## 5. Step 3: Operations and the next-step banner

- **Process board** (`components/ProcessBoard.tsx`):
  - the step numbers go;
  - the Collect card says each collection also finds signals on new pages and organizes technologies;
  - the Signals card says "Automatic for new pages", then for example "240 older pages not checked yet", with a quiet button instead of a highlighted card;
  - Organize already says "Automatic after each collection".
- **Coverage note** (`app/admin/operations/page.tsx`): "What was collected is complete." goes, and "Which" becomes "Which websites?" The intro and help are updated.
- **Next-step banner** (`lib/next-step.ts`): its "Next:" no longer suggests checking older pages.
- **Backend:** atlas B1 and B2.

## 6. Step 4: Briefing

All in `app/admin/page.tsx` and `components/SignalPanel.tsx`:
- **Intro:** "…with your signal types first, in your signal list's order", replacing "most important first".
- **Recent findings band:** its text adds "or with no publication date". Two of this week's 119 have none.
- **Details column:** from 1,440 px, it appears only after a finding is clicked. SignalPanel drops its placeholder.
- **Help text:** updated.

## 7. Checks

- `tsc --noEmit`, `npm run lint`, and the atlas tests.
- **Playwright** at 400, 1,100, 1,440 and 1,920 px:
  - help boxes, capped elements, empty grid columns and sideways scrolling;
  - screenshots of the Technology (AgenticOps, Agentic AI), Assessment, Point of View, Points of View list, Operations and Briefing pages.
- **Real data:**
  - AgenticOps shows "8 · 1 of 3 measures" and "Not enough evidence (0 of 3)";
  - Agentic AI shows 7.3, not 7.29;
  - the Point of View says Sep 11;
  - the list has no 133 rows.

## 8. Not taken from GPT's plan, and why

| GPT proposed | Why not |
|---|---|
| "Eligible for a brief", "Written briefs" | You chose "Ready for a Point of View" on 4 Oct. Every page says Point of View, and "brief" sits next to "Briefing". |
| "Fabric" → "Business area" | It is Tata Communications' own Digital Fabric term, defined in the help boxes. |
| Original-method snapshots, basis flags, recompute warnings, legacy guards (its B1–B3) | No data has those cases: there is 1 Point of View and it records its assessments, 0 of 352 assessments are recomputed, both runs used today's settings, and every assessment has a date. Worth doing the day someone edits measure weights. |
| Operations rebuilt into 7 sections | Relabelling the five cards gives the same message. The rebuild would also break 8 help texts that say "Check again on Operations". |
| Tabs, search, paging and URL state for the Points of View list | The Technologies filter already does all of that for the waiting list. |
| A modal dialog for the finding panel | It is non-modal on purpose, so you can click the next finding. On phones it already fills the screen. |
| Searching for a finding past the first 100 on a page | The most findings on any one page is 7. |
| A dropdown for signal types on phones | They are already one row of chips. |
| Ignoring stale responses, double-click guards, print open/restore, both evidence-gap shapes, hiding batch buttons while searching | All already built. |
| A per-fabric source map on the Point of View | One "Details →" link per fabric reaches the cited sources. |

## 9. Build notes

**Built and deployed on 4 Oct, by 11:00 UTC.** All four steps are as planned, plus the atlas plan's backend and skills. The portal was deployed once and the API twice. The second API deploy carried one more Point of View input fix (atlas plan §7).

**Changes from the plan:**
- **Watch metrics weren't lost.** On checking, the metrics are written once per technology and copied to each fabric. So GPT's "only the first fabric is shown" isn't a bug, and showing one set is right. I had called it a real bug in my review of GPT's plan; that was wrong.
- **Point of View header:** reads "Written Oct 4 · assessed Sep 11 from 6 pages · version 3". The technology page's Point of View box also says "assessed Sep 11".
- **Old trailing URLs:** older watch metrics end their "Now" text with a raw URL. It is lifted out into the same "source ↗" link that new metrics have.
- **Fabric order:** fabrics on the Point of View page follow the order the Point of View writes them in (by id). Before, the table and the gaps disagreed.
- **Bug fixed:** the scores table's screen-reader-only header escaped its scroll box and widened the page by up to 115 px on phones. The box is now `relative`.
- **Lint:** clearing the score error at the start of `load()` broke the set-state-in-effect rule. The run, its assessments and the measure names now load together, and set the scores or the error once.

**Checks, all on the live portal (3100):**
- **Plan 4 checks** (`plan4_check.py`): every changed page says what §3–§6 promise and drops the old words. The Briefing list is 1,092 px wide until a finding is opened, then 684 px with the details column; Escape closes it. Nothing scrolls sideways at 400, 1,100, 1,440 or 1,920 px. There are no page errors.
- **This morning's suite:**
  - every help box works (help check);
  - nothing stops short of its container at any width (caps check);
  - the grid check flags only the known false positive on the source form;
  - the layout audit finds no sideways scrolling, title collisions or page errors at 6 widths.
- **Code:** `tsc --noEmit` and `npm run lint` are clean.
- **Screenshots** in the session scratchpad: `plan4-*.png`.

**Live data after the deploy (AgenticOps, the one Point of View):**
- **Coverage:** "Strategic fit 8 · 1 of 3 measures" and "Adoption not enough evidence (0 of 3)".
- **Missing priority:** "No priority or horizon yet: not enough evidence on how soon it arrives".
- **The Point of View:** now version 3. It opens "Monitor AgenticOps; the evidence supports a controlled assessment, not investment yet", with the recommendation first. Copies of the replaced data are in the atlas plan's `replaced/` folder.

**After your review (4 Oct):** Metrics to watch had too little space between Now, Threshold and If crossed. Now 40 px separates the two columns and 12 px the rows, and the three labels are in italics. Montserrat's true italic is now loaded (`app/layout.tsx`); before, the browser slanted the upright face. Deployed and checked at 400, 1,100 and 1,920 px.
