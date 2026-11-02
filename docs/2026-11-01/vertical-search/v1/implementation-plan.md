# Vertical search, and pages per source: the portal's part (v1)

The master plan, with the API contract, is `../../../../../tech-atlas/docs/2026-11-01/vertical-search/v1/implementation-plan.md`. The specification sits beside it. This file covers only what changes in tech-lens.

**Status: approved and built on 1 Nov; live; 516 tests pass. Differences from this plan are listed at the end of the master plan.**

Norman's principles, applied throughout:
- defaults that work without a choice;
- what can't be used is visible but greyed out, with why;
- the cost is shown before anything runs;
- feedback per place while it runs and after;
- one button, in the places people already know.

## S2. Crawl depth and links per level (Setup › Settings)

- **`app/admin/(setup)/sources/settings/page.tsx`**, beside "Page budget per source":
  - **Levels of links to follow:** a number, 1 to 20.
  - **Links kept per level:** a choice of **Automatic** (the default) or **A fixed number**, which shows a number box.
- **A line under the three fields**, from the API's `reach` and `links_needed`:
  - Automatic: "Reads up to {pages} pages, up to {depth} levels deep, about {links_needed} links per level."
  - Fixed and reachable: "Reads up to {pages} pages, up to {depth} levels deep, {links} links per level."
  - Fixed and not reachable (amber): "With {depth} levels and {links} links per level, a website reaches at most {reach} pages. Choose Automatic, or raise links per level to {links_needed}, to reach {pages}."
- **`app/admin/(setup)/changes/page.tsx`:** labels for the two new settings ("Levels of links to follow", "Links kept per level").

## S1. Pages per source

- **`app/admin/(setup)/sources/[id]/page.tsx`** (edit, and Add source, which shares it):
  - A number field, **Pages per collection**, beside the switch and group. It is blank by default.
  - Its hint says: "Blank: the default, {N} pages (Setup › Settings)." N is read from the crawl settings the page already loads for Settings, or from the runs preview.
  - On save it sends `pages: Number(value) || 0`. 0 clears it.
  - For a data source the hint adds: "Its saved searches share these pages."
  - For a website, the same "Reads up to…" line as Settings, for this source's budget. It turns amber when a fixed links-per-level can't reach it.
- **`components/SourceBrowser.tsx`:** a source with its own budget shows "{N} pages" in muted text under its name, in amber with "can't be reached with the links per level" when that applies. A source without one shows nothing.
- **`lib/actions.ts` `collectQuestion`:** uses `pages_in_all` when it differs from `pages_per_source × websites`: "Up to {pages_in_all} pages across {websites} (some have their own page budget)". Otherwise the wording is as today. `app/admin/page.tsx:207` gets the same.
- **`app/admin/runs/[id]/page.tsx` (about line 347):** "stopped by the page limit" uses each source row's `budget`, falling back to `crawl_settings.pages_per_source`. Add `budget?: number` to `SourceStat`.

## S4. Write Points of View waits for Assess

- **`lib/pipeline.ts` `blockedReason`:** add the job `"pov"`. While `isLive(p.assess.status)` it returns "Waits for the assessment run to finish ({done} of {total})."
- **`components/RunSteps.tsx`, step 5:** `ConfirmAction` gets `disabled={blockedReason(p, "pov")}`. The page already shows a disabled action's reason beside it, the same way Assess shows "A check of stored pages is in progress."
- The same rule applies wherever Write them appears for all technologies. Find the other uses of `compose_all` and give each the same `disabled`. A 409 from the server is shown as its message, as today.

## S5. The plural

- **`components/RunSteps.tsx`:** `Progress` takes an optional `whats` (plural form) and calls `plural(of, what, whats)`. Assess passes `what="technology" whats="technologies"`. "technology with new pages" gets `whats="technologies with new pages"`.

## S5b. Organize's wording

- **`components/RunSteps.tsx` (about line 238):** when the resolve wasn't a full re-organize (`r.replace` false), it says "Merged {raw_strings} names from the {new_pages} new pages". "From every page collected so far" stays for `replace: true`. Add `replace` and `new_pages` to the resolve type.

## S6. Publish to leaders on the Operations page

- **`components/RunSteps.tsx`, step 6:** the step's `action` uses the existing `usePublish()` hook from `components/PublishEdition.tsx`, the same hook the Briefing's `GateList` uses. Its intro and panel render in the step; the "Publish on the Briefing →" link stays as a secondary link.
- **Disabled while an assessment runs:** `blockedReason(p, "publish")` returns the same reason as the server ("An assessment run is in progress.").
- **No server change:** `POST` publish already refuses during a scoring run (`services/editions.py`, `busy.reason("scoring")`).

## S3. Find evidence as a vertical search

**`components/FindEvidence.tsx`.** Its props, its modes (`only: "button" | "past"`) and every call site stay the same.

**The button** opens a panel in place of today's one-step confirm. It's an inline panel under the button, not a modal, so the page stays readable. Esc closes it and focus returns to the button.

**The panel, top to bottom:**

1. **Looking for:** one line, read-only. It shows the query from the preview, and "Searched under: {names}" when there's more than one name.
2. **Where to look:** a checklist from `preview.places`, in the API's order:
   - Each row shows its label and a short kind word: "papers", "counts", "the radar's websites", "the web".
   - Available places start ticked.
   - An unavailable place is shown unticked and greyed out, with its `why` under it. Its checkbox can't be ticked.
   - Under the list: "Not here? Add a source" (a link to `/admin/sources/new`).
3. **How many per place:** a select with 5, 10, 20 or Other. Other shows a number box, 1 to 50, with "up to 50" beside it. The default is `preview.per_place`.
4. **The cost line**, refetched from the preview when the choices change: "About {pages} pages to read (one model call each) and {searches} searches." When `why_not` is set it's shown instead, and Find is disabled.
5. **Find** (the primary action) and **Cancel**.

**While it runs**, `JobLine` shows one line per place: "Research papers: 5 found, 3 new, 3 filed" / "Patents: not searched — needs the patent-office keys" / "The radar's websites: 0 found". Each place's pages list under it, as today's rows, each with its status.

**After:**
- From a gap: the last line is the re-run's outcome, as today.
- From the technology's button: "Its evidence was judged again: {verdict}. It isn't assessed automatically; it's on Assess's list." The last part links to the Assess step.

**Past jobs** (`Past`): each job shows its places ("searched: research papers, counts, the radar's websites") and its query. Old jobs without places read as "the web".

**Types (`lib/…` where `Gap`, `Preview` and `Job` live):**
- `Gap` gains `places?: string[]` and `per_place?: number`.
- `Preview` gains `names`, `places`, `per_place`, `cost`.
- `JobResult` gains `place`.
- `Job` gains `places_done`.

**Settings (`components/RadarSettings.tsx`):** the "Find evidence: searches per day" row is removed; the person decides in the panel.

## Checks

- `npx tsc --noEmit`, `npx eslint` on the changed files.
- A read-only walk, signed in as Akshay:
  - a source page with and without its own pages;
  - the run page;
  - the Find evidence panel on PQC (opened, choices changed, cost line read, then Cancel);
  - Write them greyed out only while an Assess runs. That's checked from the code path; no run is started for it.
- The one real Find evidence is pressed only with Akshay's yes.
- Screenshots for the Training Manual are taken read-only with `take_screens.py` and `make_crops.py`.
