# Review of 5 Nov: the portal's part (v1)

The master plan, with the API contract, is `../../../../../tech-atlas/docs/2026-11-05/review-5-nov/v1/implementation-plan.md`. The specification sits beside it. This file covers only what changes in tech-lens.

**Status: built and live on 6 Nov; 529 tests pass; Changes 0. Differences from this plan are listed at the end of the master plan.**

Norman's principles, applied throughout:
- one glance shows what matters, and details fold away;
- an empty part says why it is empty, and never vanishes;
- every figure and bullet shows where it came from;
- nothing new to learn: each change goes into a place people already use, built like what's next to it.

Before writing code, read the relevant guide in `node_modules/next/dist/docs/` (this Next.js differs from the usual one).

## S1. "Changed by hand" in the Publish panel (`components/PublishEdition.tsx`)

- `Since` gains `hand_changes: HandChange[]` and `now.too_early: number`.
- **Under the "Publishing now sends …" line**, when `hand_changes.length > 0`, add a `<details>`, closed by default, built like "Not placed yet":
  - **summary:** "▶ {N} changes made by hand since {editionName(last)}";
  - **one row per change:**
    - first line: the technology's name, linked to `/admin/technologies/{id}?tab=assessment`, plus " · {fabric}" when set;
    - second line, what changed:
      - a score: "{measure}: the radar's {before} → {after} by hand";
      - Tata's figure: "{measure} entered as {after}";
      - a priority: "Priority: the scores give {before} → set to {after}";
      - undone: "{measure or Priority} set by hand: undone";
    - third line, in grey: "{by.name}, {formatAt(at, tz)} · Reason: {reason}";
    - when `pov_before`, an amber line: "Its Point of View was written before this change: rewrite it before publishing." (wording settled by pre-build test 2).
- The strip's column line (`lines`) adds the count to "Since then: …", e.g. "4 changes by hand".
- **"Publishing now sends …"** adds ", plus {N} too early to place" when `now.too_early > 0`.
- **No new button.** Rewriting and undoing happen on the technology's page, as today.

## S2. Too early to place

**Setting** (`components/RadarSettings.tsx`):
- A checkbox like "Classify after collection": **"Show 'too early to place' on the leaders' view"**.
- Its hint: "Lists the catalog technologies whose evidence is too thin or not credible to place yet, under the grid, with one line in the Wait corner. Takes effect at the next Publish."
- `app/admin/(setup)/changes/page.tsx` gets the label for `frontier_too_early`.

**Data** (`components/frontier/items.ts`): `Published` gains `too_early: TooEarly[]` (default `[]`).

**The Wait corner** (`components/frontier/Grid.tsx`):
- The grid takes an optional `tooEarly: number`.
- When it is above 0, the Wait quadrant's label gets a third line under its sub-line: an SVG `<a href="#too-early">` holding a `<tspan>`: "+{N} too early to place", 10.5px, link colour, underlined on hover.
- The label is `pointer-events-none` today, so this line alone takes pointer events.
- **Collision:** the label's box (line 260) grows by one line (14px) for Wait when the line shows, so dots and names keep clear of it. The width takes the longest of the three lines.
- `aria-label`: "{N} catalog technologies too early to place: jump to the list".
- The same applies in every lens and fabric. The table view (`components/frontier/Table.tsx`) shows no corner, only the section.

**The section** (`components/frontier/Sections.tsx`):
- A new `TooEarly({ items })` beside `NotPlaced`, with the same look, and `id="too-early"` for the jump.
- Heading: "Too early to place · {N}".
- Text: "From Tata's catalog. The radar has looked, but the evidence so far is too thin or not credible to say how soon or how big. More evidence can move them onto the grid."
- **Two `<details>` groups:** "Evidence too thin so far · {n}" and "Evidence not credible yet · {n}". They are closed when the list is long, using the same 12 rule as `NotPlaced`. They are open in print.
- Each item: the name, then the reason in grey on the same line (`text-muted`). No link.
- **Not rendered** when `items.length === 0`, which covers the setting being off and older editions.
- **`app/frontier/page.tsx`:**
  - renders it after `<NotPlaced>`;
  - passes `tooEarly={data.too_early.length}` to the grid;
  - the header line adds " · {N} too early to place".

  It isn't filtered by fabric or stage.
- **`app/frontier/pack/page.tsx`:** the same section, after "Not placed yet".

## S3. Checked figures (`components/PovText.tsx`, `components/UseCaseSize.tsx`, `lib/value.ts`)

- **Types:** `Size` gains `quote?: string | null`; the PoV's market `size` gains `quote`; `Pov` gains `growth_rate`.
- **Market size card** (`PovText.tsx` around line 301):
  - **value:** the band, unchanged;
  - **first line:** "“{quote}”" in quotes, then "({scope}, {year})" and the source number. Where `quote` is absent (older figures, decision (a)), the current wording "From a figure of $…B" stays;
  - **second line**, when `growth_rate` is not null: "**Growing:** “{growth_rate.quote}” {refs}", or, with `cagr_pct: null`, "No page gives a growth rate";
  - the footnote changes to: "A band, with the page's own words. The radar never shows a figure it can't find on its page."
  - With decision (b): `size.unchecked` shows "Checked from the next assessment".
- **`UseCaseSize`:** after `size.words`, the quote in grey on its own line: "“{quote}”".

## S4. Industry on each use case

- **`ValueSummary`** (`PovText.tsx` line 346): `Row` gains `industry`. `caseCell` shows it after the title as a small grey label (`text-[11px] text-muted rounded border border-line px-1`), e.g. `Banking and financial services`.
- **`components/PovValue.tsx`** (the technology's Assessment tab): the same label next to each use case's title.
- The order is unchanged (biggest first, from the server).

## S5. Five new Point of View parts (`components/PovText.tsx`)

- **Type:** `Pov.sections` gains `customer_need`, `alternatives`, `players`, `risks`, `whats_new`, each `string[] | undefined`.
- **A small `Bullets({ title, items, admin, techId })` component** (in `PovText.tsx`, beside `Section`):
  - **`undefined`** (a Point of View from before v12): renders nothing;
  - **`[]`:** the title, then "The pages reviewed don't cover this yet." On the admin's page this is followed by a "Find evidence" link to `/admin/technologies/{id}`;
  - **otherwise:** a list, each item through `renderCitations` so `[n]` links to the source list, as in every section.
- **Risks:** right after the Recommendation, in the same column (`<Section title="Recommendation">` then `<Bullets title="Risks">`).
- **New fold "The market around it":**
  - goes right after "How each use case makes money, in full";
  - hint: "why customers want it · alternatives · who's building it · what's new";
  - holds four `Bullets`, in that order;
  - the fold shows only when at least one of the four keys is present, so older Points of View don't show it.
- **Print:** folds print open, as today.
- **Leaders' view:** `app/frontier/pov/[id]/[tech]` uses the same `PovText`, so it needs no change. The edition pack likewise.

## Checks before handing over

- `npm run lint` and the type check pass.
- **Read-only walks** of the live portal, pressing no button that changes data:
  - the Publish panel with and without hand changes;
  - the leaders' grid with the corner line, the jump to the list, the list folded and opened, and the table view;
  - the edition pack;
  - a v12 Point of View with full parts and with empty ones, and a v11 Point of View showing nothing new;
  - the market card with a quote and a growth rate, and with neither;
  - phone width.
- Screenshots for the Training Manual retaken with `take_screens.py` (read-only), `map_screens.py` and `make_crops.py`.
