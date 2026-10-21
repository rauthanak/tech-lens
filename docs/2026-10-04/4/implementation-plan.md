# Implementation plan 5: Point of View sections, fabrics left out, printing (portal, tech-lens)

**Date:** 2026-10-04 · **Folder:** 2026-10-04/4 · **Status:** approved on 4 Oct ("do it please"). The printing fix was added the same day, when you reported it. Built, deployed and checked; see §4.

**Backend and skill:** [tech-atlas plan 5](../../../../tech-atlas/docs/2026-10-04/4/implementation-plan.md).

---

## 1. Why

- **"Why just 7 sections, when there are 12 measures per fabric?"** The sections didn't follow the measures:
  - three sections explained the three scores, without saying which measures each rests on;
  - Maturity and Market view retold measures those sections already covered;
  - Disruption threat and Serviceable capture appeared only inside Placement.
- **"Why only 2?"** AgenticOps was assessed in Cloud and Network only. Before scoring, one step judges which of the four fabrics are relevant to a technology. No page said so.
- **Print / Save as PDF** gave 13 pages for AgenticOps:
  - whole sections jumped to the next page, so pages 1, 2 and 5 were half empty;
  - the grey page background printed as a box inside white margins;
  - the scores came on page 5, after the text that quotes them;
  - 8 pages of raw per-measure notes followed.
- **Metrics to watch** had almost no space between Now, Threshold and If crossed.

## 2. Rules

- One order for every screen and for paper: what to do, then why, score by score, then what's missing and what would change it.
- Each measure is explained once, in its own section.
- On paper:
  - one column;
  - white;
  - text flows across pages, with headings kept with their text;
  - no box runs on empty to the bottom of a page.
- No new pages, endpoints or libraries.

## 3. Changes

**Metrics to watch** (`components/WatchMetrics.tsx`, `app/layout.tsx`):
- 40 px between Now and Threshold, and 12 px before If crossed;
- the three labels in italics, using Montserrat's true italic, which is now loaded.

**Point of View page** (`app/admin/scoring/pov/[id]/[tech]/page.tsx`):
- **Sections follow the measures:**
  - Market Potential, Strategic Fit and Adoption Readiness, each with a "Measures: …" line;
  - Other measures, with the line "Not part of the three scores: …";
  - then Priority and horizon.

  The measure names come from the measures list, so edits in Setup show up. "TORA ·" is gone from the headings. Older Points of View still show their Maturity, Market view and Capability gap.
- **Order:** Recommendation, Summary, the five sections, Evidence gaps, Metrics to watch. On narrow screens and on paper, the scores table follows the summary. On wide screens it stays in the right column.
- **Under the scores:** "Not assessed in Interaction or IoT: judged not relevant to this technology before scoring."
- **How the scores were derived:**
  - "Other measures", not "Additional signals";
  - "no score", not "n/a";
  - "Not enough evidence. Would need: …", not "NOT ASSESSABLE —".
- **Help:** updated, including the 12 measures and what prints.

**Technology page:** the same "Not assessed in …" line under the fabric rows, with the help updated. `lib/format.ts` gains `orList` ("Interaction or IoT").

**Print / Save as PDF** (`app/globals.css` and the page):
- **Paper and layout:** white paper, in one column whatever the paper size.
- **Page breaks:**
  - text may break across pages, with at least 3 lines on either side;
  - headings stay with their first lines;
  - cards, metrics and table rows stay whole.
- **No empty boxes:** Metrics to watch, Evidence gaps and the derivation print without boxes, full width, so a page break leaves no empty frame.
- **Scores:** they print after the summary, without the Details column.
- **How the scores were derived:** it prints only if it's open, after the rest, starting on its own page.

For AgenticOps that gives 4 pages instead of 13, or 12 with the derivation open. The PDFs are in this folder:
- `agenticops-print-before.pdf`
- `agenticops-print-after.pdf`
- `agenticops-print-after-with-derivation.pdf`

## 4. Build notes

**Built and deployed on 4 Oct.** The API was deployed after the comparison in atlas §3; the portal was deployed twice, first for the metrics spacing, then for the rest.

**Checks, on the live portal (3100):**
- **Code:** `tsc --noEmit` and `npm run lint` are clean.
- **Plan 5 checks** (`plan5_check.py`), at 400, 1,100, 1,440 and 1,920 px, with 0 failures. They cover:
  - every new section is present, in order, with no old headings;
  - the measures lines;
  - the fabrics line appears exactly once;
  - the derivation's words;
  - no sideways scrolling and no page errors on either page.
- **Metrics to watch,** on the Point of View and assessment pages: the labels are italic, with 40 px and 12 px gaps.
- **This morning's suites:**
  - every help box works;
  - nothing is capped short of its container;
  - the grid check flags only the known false positive on the source form;
  - the layout audit finds no page errors.
- **Print:** I read the PDFs page by page: AgenticOps and Agentic AI on the dev copy, and AgenticOps on live, each with the derivation open and closed.
