# Implementation plan 3: findings first, portal (tech-lens)

**Date:** 2026-10-04 · **Plan:** 3 · **Status:** built and deployed on 4 Oct. The build notes are in §9, and the master's §8 has the rest.

**Master plan:** [tech-atlas implementation-plan.md](../../../../tech-atlas/docs/2026-10-03/3/implementation-plan.md). It holds the phases, the backend work and the API contract.

**Mockup:** https://claude.ai/artifact/VfGNP5Dr9YvvCu1WRpBtGD shows the Briefing as phase A would build it, on the real Oct 3 findings.

**The review it answers:** [ux-review-and-recommendations.md](ux-review-and-recommendations.md).

This file holds the screens, the words and the checks.

---

## 1. Words

A **finding** is one development found on a page. Each finding has a **type**, taken from your signal list, or Other.

Plan 2 called findings "signals". The Briefing now says "findings", and "signal list" stays the name of the list in Setup.

| Today | Plan 3 |
|---|---|
| What's new, by technology | Recent findings · Older articles |
| For the analyst | Waiting for you |
| Not on the list · X | Other · X |
| Open technology | Open {technology}, only when the finding has one technology |
| Open the page | Open source page ↗ |
| Make it a signal | Add to signal list |
| 6 problems (page limits) | 6 websites reached their page limit |
| See all 212 signals → | removed: every finding is on the Briefing |
| Signals (menu) | removed |

## 2. Briefing (phase A)

The mockup is the reference. From top to bottom:

1. **Header.**
   - The title, "Radar briefing", then one line: "212 findings from 183 new or changed pages · last collected Oct 3 from 6 sources".
   - On the right, the window: Last 7 days / Last 30 days / Last 90 days / All time.
   - For one collection (`?run=`), the line reads "Collection of Oct 3 · Completed · 212 findings from 183 new or changed pages". A stopped or failed collection says so, with its reason.
2. **New Points of View**, shown only when there are some: "New Points of View: Agentic AI, ML-KEM →".
3. **Waiting for you**, shown only when something waits. Each item is a link:
   - "An assessment stopped partway →" goes to Operations;
   - "25 technologies have new pages since their assessment →" goes to Operations in phase A. In phase B it goes to Technologies, filtered to New evidence;
   - "35 technologies are ready for a Point of View →" goes to the waiting list on Points of View.

   Checking older pages isn't listed here; it stays on Operations.
4. **Rail: "Found in this window".**
   - It lists "All findings 212", then each type with its count, in the signal list's order, with Other last.
   - Clicking a type filters the list; clicking it again shows all types.
   - A note sits under it: "The list follows the order of your signal list. You change it in Setup → Signal list, and it costs no model calls."
   - On a phone, the rail is one scrolling row of chips, without the note.
5. **The list**, in two bands:
   - "Recent findings · 119": "Published within 30 days of being collected; your signal types first, in your signal list's order, then other findings."
   - "Older articles · 93": "Published more than 30 days before they were collected: found now, but not new."

   Inside a band, a small header names each type, with its count.

   Rows come 20 at a time: "Show 20 more", with "40 of 212 shown". At the end: "That's all 212 findings."
6. **Filters that come from links** show as pills above the list, each with ×:
   - "Technology: agentic ai";
   - "Collection of Oct 3";
   - "Source: Cisco Blogs".
7. **Empty states:**
   - nothing collected: "Nothing collected yet. Collect from Operations.";
   - an empty window: "No findings in the last 7 days; the last collection was Sep 11.", with a link to the last 30 days;
   - an empty filter: "No Partnership findings in this window."

**The address** carries `?days`, `?run`, `?type`, `?tech`, `?source` and `?signal` (the panel). These are the Signals page's own names, so its old links keep working. "Show more" isn't kept in the address.

**Row** (`SignalItem`). It has one form everywhere: the Briefing, the technology page and a collection's source page.
- **Headline:** `headline` from phase C, or `what` until then, at most 2 lines.
  - An Other row starts with a dashed tag that carries its label.
- **"Why it matters: …":** 1 line.
- **Details line:** source · date · up to 3 technology chips, then "+N".
  - The date reads "Published Oct 1". The year shows when it differs from the collection's year, and always in the Older articles band.
  - With no publication date, it reads "Collected Oct 3".
  - The chips link to their technology pages.
- **Opening:** clicking anywhere on the row opens the panel. The open row stays highlighted.

**Panel** (`SignalPanel`), from top to bottom:
- **Heading:** the type and the full headline.
- **Dates line:** "Published Oct 3, 2026 · Collected Oct 3 · Event 2026-10".
- **Older articles only:** "Older article: published Sep 22, 2020, found in the collection of Oct 3."
- **Details:** who, why it matters, the quote, the source with "via {source}", and every technology as a link.
- **Buttons:**
  - "Open {technology}", only when the finding has exactly one technology;
  - "Open source page ↗";
  - for Other findings, "Add to signal list".

**Status pill:** its panel lists each waiting item as a link to where it's handled. It always agrees with the Briefing and Operations.

## 3. Signals folds in (phase A)

**Redirects**, in `next.config.ts`:
- `/admin/signals` goes to `/admin`, keeping its query;
- `?tab=other` goes to `/admin/signals/list#suggestions`, and `?tab=set-aside` to `/admin/signals/list#set-aside`;
- the existing `?tab=list` redirect stays.

**Setup → Signal list** gains three things:
- **Reordering:** Never miss rows get ↑ ↓, under the line "Findings on the Briefing follow this order. Reordering costs no model calls and doesn't mark pages as not yet checked."
- **"Suggestions from recent findings"** (`#suggestions`): Other findings from the last 30 days, grouped by label (today's Not-on-the-list groups). Each group has "Add to signal list".
- **"Set aside recently"** (`#set-aside`): pages set aside in the last 30 days, with the rule that set each aside, and "Show more".

**Menu:** Briefing · Technologies · Points of View │ Operations · Setup.

**Links that pointed at Signals:**
- the technology page's "All signals →" becomes "View all N findings →", to `/admin?tech=…&days=all`;
- the next-step banner after a collection goes to `/admin?run=…`;
- a collection's page gets "See its findings →", to `/admin?run=…`.

**`app/admin/signals/page.tsx` is deleted.** Its pieces move:
- `FilterChip` into the Briefing;
- `NotOnTheList` and the set-aside list into Setup;
- `CheckBanner` is removed, because Operations' Check step already does its job.

## 4. Technology page (phase B)

From top to bottom:
1. back link;
2. name and fabrics;
3. the state in one sentence, with the main button and Manage;
4. Assessment;
5. Point of View;
6. Findings: the top 5 in the Briefing's order, then "View all N findings →";
7. Pages.

| State | Sentence | Main button (unchanged) |
|---|---|---|
| new_evidence | "10 new pages since the Sep 11 assessment. Assess again to include them." | Assess now · about N model calls |
| not_assessed | "Not assessed yet." | Assess now |
| no_pov | "Assessed Sep 11. Ready for a Point of View." | Write Point of View |
| current | "Up to date: the Point of View uses the latest assessment." | Open Point of View |
| stopped_partway, assessing, off | as today | as today |

The "New page" rows in today's "What's happening" go away; those pages are listed under Pages.

## 5. Technologies list (phase B)

- **Columns:** Technology · State · New pages · Assessed · Point of View.
- **State filter, with counts:** All · New evidence · Ready to write · Not assessed · Stopped · Current · Off. Search stays.
- **Batch buttons**, both through ConfirmAction:
  - filtered to New evidence: "Assess these 25 · about 890 model calls";
  - filtered to Ready to write: "Write these 35 · about 35 model calls".
- **Details:** the inventory cards and the Docs / Pages / Sources / H1·H2·H3 columns move behind TechnicalDetailsSwitch.
- **Organize technologies** moves to Operations.

## 6. Points of View, Operations, next step, menu (phase B)

- **Points of View:**
  - written ones come first;
  - the waiting list's header reads "Waiting for a Point of View · 35", with "Write all 35 · about 35 model calls";
  - each waiting row reads "Write · about 1 model call";
  - "Rewrite all" appears only when some Points of View exist, as a secondary button under them.
- **Operations:**
  - Problems lists real problems only;
  - a Coverage line follows: "6 websites reached their page limit (40 pages each). Raise it in Crawl settings →";
  - Organize technologies sits in the maintenance area.
- **Next-step banner:**
  - what finished, with a link to its results;
  - "Next: … →", linking to the list of those technologies;
  - no button that spends model calls.
- **Menu:** the full menu shows from 1,024 px (`lg`). Its five items fit beside the pill.

## 7. Phase C in the portal

- Rows show `headline` when there is one.
- Chips show the finding's own technologies.
- Technology names show `label` everywhere they appear: hub title, chips, lists and Points of View.

## 8. Checks

- Lint and build pass, and every page loads in headless Chromium with no errors.
- At widths of 400, 1,100, 1,280 and 1,440 px, nothing scrolls sideways.
- Keyboard: rows, panel and rail all work. Esc closes the panel and returns focus to its row.
- **The first-screen test**, at 1,440 × 900:
  - the Briefing shows the header line, Waiting for you, the rail and the first findings;
  - the technology page shows its state and next step.

## 9. Build notes (4 Oct)

**New files:**
- `lib/waiting.ts`: the waiting items in words, and where each is handled;
- `lib/tech-labels.ts`: name capitals, read once;
- `lib/states.ts`: state words, order and colours;
- `components/SignalSuggestions.tsx` and `components/SetAsideList.tsx`, moved out of the old Signals page.

**Removed:** `app/admin/signals/page.tsx` and `components/AnalystBox.tsx`.

**Where the build differs from the plan:**
- **Rail on wide screens:** from 900 px it's a sticky column with the order note. Below that it becomes one scrolling row of chips, without the note.
- **Findings without technologies:** on a collection's source page they set `withTechnologies={false}`, because that page lists its technologies above.
- **Technology page:** its "Findings" list shows the top 5 in the Briefing's order, and the "New page" rows are gone. The rename field says capitals are kept for display.
- **Batch buttons on Technologies** use exactly the pipeline's waiting items, so they show only when no search narrows the list. With a search on, the page says "Clear the search to act on them all."
- **Wording:** "signals" became "findings" in the Operations history and the collections list.

**Checks:** see the master's §8.

## 10. After review: what the states mean (4 Oct)

**Definitions:** `STATE_MEANING` in `lib/states.ts` says what each state means and what to do. The Technologies list shows them under the filter: every state shown on "All", only the chosen one under a filter.

| State | Shown as | Meaning |
|---|---|---|
| new_evidence | New evidence | Assessed before, and new pages about it have arrived since. Assess again to include them. |
| no_pov | Ready for a Point of View (was "Ready to write") | Assessed, but its Point of View isn't written yet. |
| stopped_partway | Stopped partway | Its assessment stopped before finishing. Resume the run to finish it. |
| assessing | Being assessed | An assessment is running for it now. |
| not_assessed | Not assessed | Never assessed. Assessments cost model calls, so they run only on the technologies you choose. |
| current | Up to date | Its Point of View uses its latest assessment, and no new pages have arrived since. Nothing to do. |
| off | Switched off | Kept, but left out of assessments. Switch it back on from its page. |

**The Not assessed line** adds: "Assess one from its page, or a group by page count on Assessment runs", with a link, and, from `over_floor`: "99 of them now have 3 or more pages, the bar the Sep 11 assessment used."

**Its batch button**, on the Not assessed filter: "Assess the 99 with 3+ pages · about 4,950 model calls", through ConfirmAction. Like the other batch buttons, it hides during a search.

**Checks:** type-check and lint clean. Headless on Docker at 400, 1,100, 1,280 and 1,440 px: no errors, nothing scrolls sideways. The confirm question was opened and cancelled, never started.

**Seen, not changed:** at phone width the page header's right side (the Technical details switch here) overlaps a long title. `PageHeader` doesn't wrap; it's older than this change.

## 11. After review: a description on every page (4 Oct)

The user asked for some basic information on every page and tab, collapsed at first, and for the Briefing to stop listing new Points of View, which won't scale.

**The pattern:**
- `components/PageHelp.tsx`: "How to read this page", a native `<details>` that is closed whenever the page opens. It holds 3–5 short points.
- `PageHeader` gains two props:
  - `intro`: one plain sentence under the title, always shown;
  - `help`: the points.
- `PageHeader` now wraps, so on phones the control beside the title moves under it. This fixes the title overlap.
- The Scoring method tabs don't use `PageHeader`, so they render `PageHelp` under their own intro.

**Coverage:** all 24 pages that show anything. The old assessment Point of View address only redirects.

**Moved or removed:**
- The Briefing's "New Points of View" line is gone. The rail's order note now sits in the Briefing's help.
- Long or technical intros were rewritten, for example Skills' "nothing is hardcoded" and Assessment runs' "scoring method as it stands".

**Wording corrected along the way:**
- "Check again on the Signals page" now reads "on Operations", on a collection's page and in Skills.
- Skills now says the summary skill feeds the Briefing, and that technologies are organized from Operations, not the Technologies tab.
- The `technology_label` skill is mapped: Organizing technologies. It no longer says "not wired in yet".
- Collections' column is now "Findings · set aside", and a source in a collection carries the eyebrow "Collection …".
- On one assessment:
  - the Placement heading no longer claims it recomputes by itself;
  - the evidence list says it shows pages linked now, not the dossier the scorer read.
- On Weights & Grid, two notes are corrected:
  - weights are edited on Measures;
  - X1 and X2 feed the grid, and X3 feeds the Point of View.

**A plan 3 bug, fixed:** "Add to signal list" on the Signal list's own suggestions changed the address but never opened the form, because the editor read `?name=` only on first load. The draft now follows the address, and closing the form clears it, so the same suggestion opens it again.

**Checks:**
- Type-check and lint are clean.
- Headless on Docker, 24 pages at 1,440 and 400 px:
  - each has one closed help box that opens with the mouse or keyboard;
  - no page errors;
  - no title spills beside its control.
- One page is still wider than a phone: a Point of View, by 18 px. That fix is in the layout proposal.

**Layout:** approved and built the same day; see §12.

## 12. After review: using the screen (4 Oct)

The user said the pages didn't use the screen and weren't fully responsive. A measurement of 25 pages at 400, 768, 1,024, 1,280, 1,440 and 1,920 px agreed:
- at 1,920 px the portal stopped at 1,400 px;
- seven pages capped themselves at about 900 px;
- headers squeezed on phones;
- one Point of View page was 18 px wider than a phone.

**Built:**
- **Canvas:** 1,760 px (`layout.tsx`, `TopBar`, `NextStep`). Paragraphs keep their own `max-w` for line length.
- **Caps removed** on:
  - Points of View, Assessment runs, one assessment run and one assessment;
  - Changes cards, the Scoring method tiles and open questions, and Open questions;
  - a collection's Used in box and its analysis-failures box.
- **Grids:**
  - written Points of View: 1, 2 or 3 across;
  - the waiting list: 1 or 2 across. At 3 across, long names pushed their Write button onto a second line;
  - one assessment's measures: 2 across from 1,280 px;
  - fabrics: 4 across from 1,536 px. The fabric cards are top-aligned flex columns, because browsers centre a button's content.
- **Two-column forms** from 1,024 px:
  - a source: the register entry on the left, start pages or saved searches on the right;
  - Crawl settings: skipped links on the left, the limits on the right. The page-budget help now mentions data sources.
- **Briefing:** from 1,440 px, the grid is rail · list · panel (`220px · 1fr · 400px`, and `240 · 1fr · 460` from 1,800 px).
  - `SignalPanel docked` sits sticky in the third column.
  - Until a finding is chosen it shows "Click a finding to read it here…".
  - It leaves focus on the list; Esc clears the selection.
  - Below 1,440 px the panel still slides over, and `lib/media.ts` (`useMedia`) decides which.
  - The list's 820 px cap is gone.
- **Phones:**
  - the Point of View grid gets `grid-cols-1`, a shrinkable column, so its table no longer stretches the page;
  - the skill page's side column lets long code paths wrap.

**Checks:**
- Type-check and lint are clean.
- Headless on Docker at all six widths: no sideways overflow on any page, and no page errors.
- Docked panel: there at 1,440 and 1,920 px, overlay at 1,280 px; focus stays on the list; Esc restores the prompt.

**Follow-up the same day: no element stops short.** The user showed the help box, the state definitions and a lone Point of View card ending at fixed widths while the rows around them ran edge to edge.
- **`PageHeader`:**
  - title, intro and live lines sit beside `right` (`flex-1 basis-96`; `right` wraps below on narrow screens);
  - "How to read this page" sits under that row across the full width;
  - the intro is capped at `max-w-4xl`, for line length only.
- **`PageHelp`:**
  - full width, with its points in two columns from 1,024 px (`lg:columns-2`);
  - only the words underline on hover. An underlined arrow turned into a bar when it rotated;
  - no browser outline on click, and a soft padded ring on keyboard focus.
- **Caps removed everywhere a box, list or input carried one:**
  - the Technologies state definitions, and its search box, which now fills its row;
  - the Briefing's never-collected card;
  - the Changes note and write result;
  - the fabric edit card, now with Name and Open question two across;
  - a never-collected source's note;
  - a collection's notes, error box and technical details;
  - `BackendError`, `ServiceHealth`, and the Suggestions and Set aside notes.
- **Points of View cards** use `repeat(auto-fit, minmax(min(100%, 26rem), 1fr))`, so a lone card fills the row.
- **Fixed splits that stack on phones:**
  - a skill's form and "Where it acts", side by side from 1,024 px;
  - a collection's stages and stage detail, side by side from 768 px.
- **Checks:**
  - on every page at 400, 1,100, 1,440 and 1,920 px, with every help box open, no box, list or input sits more than 40 px short of its container because of a max-width, and no grid leaves an empty column;
  - no sideways overflow at six widths, and no page errors.
