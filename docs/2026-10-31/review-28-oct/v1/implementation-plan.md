# Answering the 28 Oct review: the portal's part (v1)

The portal's half of the plan. The specification, the API contract, the order of work, the tests on the API side and the client documents are all in the master:
- `../../../../../tech-atlas/docs/2026-10-31/review-28-oct/v1/specification.md`
- `../../../../../tech-atlas/docs/2026-10-31/review-28-oct/v1/implementation-plan.md`

Step numbers below are the master's.

**Status: waiting for Akshay's approval. No code until then.**

Checks for every step: `npm run build` and lint green. Each changed screen is shown to Akshay on the running portal, using a scale copy for anything that saves.

---

## Step 1. R1: Tata's 2×2

1. **New `lib/grid.ts`**: the one place the layout lives.
   - `QUADRANTS`: Act (now, bigger), Plan (later, bigger), Watch (now, smaller), Wait (later, smaller). Each has `top` (now) and `right` (bigger).
   - `TIMELINE_ROWS = ["near", "mid", "far"]` (now at the top) and `POTENTIAL_COLS = ["low", "mid", "high"]` (bigger to the right), for every table of cells.
   - `AXIS_TITLES`:
     - vertical "Impact timeline (how soon)", with ends "Now" and "Later";
     - horizontal "Impact potential (how big)", with ends "Low" and "High";
     - in Defence, the horizontal is "Disruption threat".
2. **`components/frontier/Grid.tsx`**:
   - x is `sx(upOf(item, lens))` and y is `sy(item.how_soon)`. That applies in the dots (`:268`), the frontier staircase (`:281`, points become `[up, soon]`) and the split lines (`:382-383`: the vertical line at `cutpoints.how_big[1]`, the horizontal at `cutpoints.how_soon[1]`).
   - The quadrant boxes (`:252-265`) read `lib/grid.ts`.
   - The axis captions (`:479-489`) use `AXIS_TITLES`.
   - The sub-label becomes `now|later · bigger|smaller`.
   - The doc comment at `:133` and the QUADRANTS comment at `:29` are rewritten to match.
   - Zoom, pan, spread, naming and the tooltip are untouched.
3. **`components/frontier/items.ts`**:
   - `frontierOf` is unchanged: a dominance test is symmetric in its two axes.
   - `LENS_WORDS` keeps its words for the tooltip and table.
4. **`app/admin/(setup)/scoring/config/page.tsx` `PriorityGridTable`** and **`app/admin/scoring/assessments/[id]/page.tsx`** (the "How a cell is chosen" table, `:92-93, 377-390`):
   - both import the rows and columns from `lib/grid.ts`, and their local `TIMELINE_COLS` and `POTENTIAL_ROWS` are removed;
   - each cell is `grid[`${row}_${col}`]`;
   - the corner label reads "How soon ↓ · How big →".
5. **Text**:
   - `lib/scoring.tsx` `PRIORITY_LEGEND` becomes "Priority P1 (act now) to P6 (no action yet)".
   - The help on `app/frontier/page.tsx:85-95` is rewritten: down is how soon (Now at the top); across is how big; the corners with Tata's meanings; where the solid lines sit.
6. **The print pack** (`app/frontier/pack/page.tsx`) uses `Grid`, so it follows with no change.

## Step 2. R2: the panel behind a dot

1. **`components/frontier/items.ts`**: `Published` gains `grid_from: { how_soon: string[]; how_big: string[] } | null`.
2. **New `components/frontier/PlacementPanel.tsx`**. Props: `item`, `gridFrom`, `lens`, `admin`, `onClose`.
   - It fetches `/api/frontier/pov/{tech_id}` once per technology (kept while the page is open), then picks `fabrics.find(f => f.fabric_id === item.fabric_id)`.
   - It shows:
     - the heading: technology, fabric chip, priority, quadrant name (from `lib/grid.ts`), evidence word;
     - **How soon** and **How big**, each from its `gridFrom` list. Each measure row shows the name (from `measures[]`), the score with the existing `scoreShade`, the first sentence of `justification` with "more" (the rest, `counter_case`, refs), or the state text for unscored and waiting, worded as on the Point of View. When `gridFrom` is null, there is one list, "Measures", in the order of `measures[]`.
     - **Open the Point of View** (`povHref(item)`).
   - **Admin only**: **Change** on each row opens `ChoiceForm` (score 0–10, reason required) and calls `decide({kind: "hand_score", tech_id, fabric_id: scope === "technology" ? null : item.fabric_id, measure_id, value, reason})`. The scope comes from the frozen `measures[]`; when it's missing, `fabric_id` is the dot's fabric.
     - After saving: "Saved. The dot moves in the next edition; on the technology's Assessment tab it applies now." with a link to `/admin/technologies/{tech_id}?tab=assessment&fabric={fabric_id}`.
   - Errors use `BackendError`, and say why: no PoV in this edition, or the edition is gone.
   - Layout: on wide screens a right-hand column beside the grid, which the grid's width already allows (`ResizeObserver`); on a phone, below the grid. Close with × or Esc.
3. **`Grid.tsx`**:
   - A click on a dot calls a new `onPick(item)` prop instead of `router.push` (`:214`).
   - The picked dot gets a ring.
   - Keyboard Enter on a dot does the same.
   - The `aria-label` ending "opens its Point of View" becomes "shows what placed it".
4. **`app/frontier/page.tsx`**:
   - It holds `picked` state, passes `onPick` to `Grid` and renders `PlacementPanel` with `data.grid_from` and `useMe()?.role === "admin"`.
   - The pack page passes no `onPick`, so the pack keeps its static grid.
5. **The table view is unchanged**: its rows still open the Point of View.

## Step 3. R3: Add source

1. **The edit form becomes a component.** The form in `app/admin/(setup)/sources/[id]/page.tsx` moves to `components/SourceForm.tsx`, with props `source` (or empty for new), `adapters`, `groups`, `onSave` and `mode: "edit" | "new"`. The edit page becomes a thin wrapper around it, with no change in what it shows.
2. **New page `app/admin/(setup)/sources/new/page.tsx`**: the same form with `mode: "new"`.
   - It adds **What kind** (Website / Data source) and, for a data source, the **connector** (from `/api/sources/adapters`, with its help, example and "Not configured: set … in .env").
   - It shows the id the name makes, under the name field ("Saved as converge_digest").
   - `onSave` posts to `/api/sources`. On success it goes to the new source's page with "Added. The next collection reads it." On refusal it shows the API's reason.
3. **`app/admin/(setup)/sources/page.tsx`**: an **Add source** button in the header, linking to `/admin/sources/new`. The help gains one line: "Add source adds a website or a data source; it is live at once and shows on Changes, where Keep as defaults saves it into the seeding data."
4. **Group choices**: the distinct `cluster` values from the list `SourceBrowser` already loads. No new call.

## Step 4. R6: ballpark size on use cases

1. **`lib/value.ts`**: `UseCase` gains `size?: { basis: "evidence" | "comparable" | "none"; band?: string | null; saving_pct?: number | null; covers?: string; year?: number | null; comparable?: string | null; why_comparable?: string | null; refs?: number[]; reason?: string | null; evidence_needed?: string | null }`.
2. **One small `components/UseCaseSize.tsx`**, used in both places below, so the wording lives once:
   - "$1–10B (what it covers, year) [n]";
   - "about 15% saving on … [n]";
   - "comparable: <name>" with `why_comparable` on hover and in print;
   - "No reliable data: <reason>";
   - "—" for a Point of View from before sizes.
3. **`components/PovText.tsx`**, "Use cases, fabric by fabric" (`:416-483`): a **Ballpark size** column in the table, and a labelled line in the phone/print card. The rows arrive sorted from the API.
4. **`components/UseCases.tsx`** (Assessment tab): the same line under each use case's title.
   - For `basis: "none"`, **Find evidence** with `gap={{ kind: "use_case", tech_id, fabric_id, key }}`.
   - **`lib/findEvidence.ts`**: `Gap` gains `key?: string`.

## Step 5. R5

No portal code. The two connectors appear in Add source's connector list from `/api/sources/adapters`, with their search help.

## Step 7. Screens for the client documents

These are taken from the running portal, read-only:
- the 2×2 (Growth and Defence);
- the panel (leader and admin);
- Weights & Grid;
- Add source;
- a Point of View with ballpark sizes;
- a trend page in a technology's evidence.

They are listed in `final_deliverable/training-manual/take_screens.py` and mapped and cropped with its sibling scripts.
