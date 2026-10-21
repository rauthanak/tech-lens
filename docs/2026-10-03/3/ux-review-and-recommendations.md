# Tech Lens: complete, prioritized results and a clearer review journey

**Date:** 2026-10-03  
**Status:** UX recommendations and implementation handoff; application changes require the user's approval.  
**Audience:** the agent/model implementing changes in Tech Lens and supporting changes in Tech Atlas.  
**Scope:** incremental improvements to the application currently running at `http://localhost:3100/admin`.

This document is the primary UX handoff for this iteration. Supporting backend requirements are included here to avoid maintaining two competing specifications. It builds on [the portal plan 2](../2/implementation-plan.md), [the earlier UI suggestions](../2/UI-suggestions.md), and [the Atlas plan 2](../../../../tech-atlas/docs/2026-10-03/2/implementation-plan.md). Those documents describe existing decisions; inspect the current code before implementation because much of plan 2 is already implemented.

## 1. Product objective and the user's correction

The user still finds the application confusing after the redesign. They want a framework that is simple, configurable, scalable, resilient, and intuitive. They explicitly clarified that an end user wants to see **everything produced by a run or analysis**, ideally in decreasing order of importance.

An earlier recommendation to limit the Briefing to five to eight findings does not satisfy that requirement. Do not implement a permanently capped highlights feed as the only results experience. Pagination is appropriate; silently omitting findings is not.

The intended product experience is:

> I can see what this run produced, understand why some findings appear first, investigate a finding, and decide what to do next. I can also inspect all the underlying evidence and exceptions.

The main journey is:

**Review results → open a finding → understand the related technology → review/update its assessment → read/create its Point of View.**

The operator's collection and maintenance activities remain available in Operations and Setup. Support both reading and operating the application through clear organization; this recommendation does not require a new role/permissions system.

## 2. Observations from the live application

The following observations came from a read-only browser review on 3 Oct. Counts describe that inspected dataset, not fixed UI constants.

| Observation | Consequence for the end user |
|---|---|
| Briefing rendered 53 signal entries and was approximately 8,256px high at a 1,440 × 1,000 viewport. | A user must read many screens before understanding the whole result or reaching the next actions. |
| The first technology group occupied most of the first viewport. | The first screen gives little sense of breadth or which development deserves attention first. |
| The Cisco/NVIDIA partnership appeared under several technology groups. | The same finding can look like several separate developments. |
| Two near-identical ML-KEM findings appeared consecutively. | Users must determine whether these are independent evidence or duplicate representations. Exact cross-technology duplication and semantic similarity are different problems. |
| “For the analyst” started around 7,945px down the page. | Guidance exists but is hard to discover. |
| Entries marked 2021, 2022, and 2024 appeared under “What's new,” alongside an Oct 3 collection date. | Newly collected material can be mistaken for a recent event. |
| Agentic AI's detail page began with another long signal feed, pushing its assessment and Point of View below it. | The user has to read supporting material before understanding the current conclusion. |
| “Open technology” in the first signal panel chose the first related technology, 6G, even when reached through Agentic AI. | The destination is ambiguous and the user's context can be lost. |
| At 1,100px width all main navigation moved into a hamburger menu. | Primary destinations become harder to discover on a typical laptop-sized viewport. |
| The Technologies register showed 1,853 entries with Docs, Pages, Sources, and H1/H2/H3 columns. | The register exposes inventory statistics more clearly than it exposes what needs review. |
| Operations offered Check, Assess, and Write as separate prominent actions. | Their relationships and the scope of each action are not immediately clear. They can apply to different technology sets. |
| The global header showed six “problems,” all of which were collection coverage limits in the inspected run. | Coverage limits can look like failures of the whole application. |

The current visual identity can be retained. The highest-value changes concern hierarchy, scope, ordering, wording, and navigation.

## 3. Design principles and boundaries

1. **Complete coverage:** every stored signal and every collected page in the selected scope is reachable, including unmatched signals, pages without signals, set-aside pages, unchanged visits, and analysis failures.
2. **Transparent priorities:** users can understand the ordering. “Never miss” is a user preference, not proof of commercial significance or verified scientific importance.
3. **One context:** run/date scope, filters, selection, and back links survive navigation.
4. **Progressive detail:** list rows support scanning; the panel supports investigation; the technology page supports evaluation and decisions.
5. **Explicit units:** signals, distinct pages, visits, technologies, assessments, and Points of View have different meanings. Do not add their counts together.
6. **Outcome-led actions:** explain what an action produces and which records it affects before asking the user to start it.
7. **Shared facts:** keep readiness, evidence freshness, ranking, and counts authoritative in Atlas. The portal owns wording and layout.
8. **Reuse:** preserve existing routes, components, APIs, the evidence service, and job lifecycle where practical.

Do not introduce an additional ranking LLM, vector database, semantic deduplication service, workflow engine, event bus, permissions subsystem, or generalized dashboard framework for this iteration. A small deterministic ranking function and shared results UI are sufficient.

## 4. Information architecture

Keep the existing main destinations initially: Briefing, Signals, Technologies, Points of View. Keep Operations and Setup visually secondary. Avoid spending this iteration on wholesale route/name changes.

- **Briefing:** the complete reviewable result for a selected collection or collection-time window. It leads with findings and transparent ordering.
- **Signals:** the same signal browsing experience, with its existing deeper filters and links to configure rules. It must not use a different definition of priority or signal counts.
- **Technologies:** discover technologies and review their current state. Operational register statistics become secondary.
- **Points of View:** browse conclusions and identify assessments awaiting writing.
- **Operations:** collect, maintain, inspect coverage, retry/resume jobs, and review job history.
- **Setup:** configure sources, signal rules, scoring, prompts/skills, and crawl settings.

Briefing and Signals should reuse one results-list implementation, with different surrounding context. Do not build two separate search, sorting, pagination, or selection systems. Shared controls can be simple components/hooks; no configurable page-builder abstraction is needed.

## 5. Briefing: a complete results workspace

### 5.1 Scope comes first

Place a scope selector next to the page title:

- **Latest finished collection**: initial default when no scope is specified. Show date/time and status, resolving it to a concrete run ID.
- **A selected collection**: selectable from recent collections, with a route to older history.
- **Last 7 / 30 / 90 days**: explicitly based on collection time, covering multiple collections.

The default changes the current seven-day landing behavior intentionally: the user's request emphasizes reviewing what a run produced. The rolling-window options remain readily available.

“Finished” can include completed, interrupted, or failed collections with stored results. Display the actual status; do not describe a failed collection as completed. If a collection is currently running, show a separate progress notice and an explicit “View live results” option. Keep the finished scope stable until the user chooses to switch.

Examples:

- `Collection: Oct 3, 8:32 PM · Completed with coverage limits`
- `Collected in the last 7 days · Sep 26–Oct 3`
- `Live collection · Results are still arriving`

Resolve rolling windows to fixed `from`/`to` boundaries while reviewing and paginating. The UI must not advance the time boundary on each request, causing results to move between pages.

Changing scope clears incompatible filters and pagination, with a visible explanation when a filter was removed. Preserve valid source, signal-type, and technology filters where possible. A bookmarked historical run must never silently fall back to the latest run.

### 5.2 Header and counts

Show a compact summary of the selected scope. Example using the inspected dataset:

`183 new/changed pages · 135 never-miss matches · 77 other signals`

Supporting counts can show `12 pages set aside`, `N pages with analysis issues`, and coverage status. These are examples, not constants.

Definitions:

| Label | Unit and meaning |
|---|---|
| Never-miss matches | Stored signal hits that matched configured rules during analysis; not distinct pages. |
| Other signals | Stored hits with `signal_id = other`; not the number of grouped labels from `/signals/other`. |
| All signals | Never-miss matches plus other signal hits in scope. |
| New/changed pages | Non-stub stored document versions collected in scope. |
| All collected pages | All saved page visits in scope, including unchanged stubs. Explain this distinction in the list. |
| Set aside | Pages excluded from organizing/scoring by a Can ignore rule. |
| Analysis issues | Pages with failed or partial analysis. May overlap another page category. |
| Technologies affected | Distinct registered technologies linked to scoped evidence; not a sum of tags. |

A page can contain several signals. Analysis issues can overlap page categories. These cards/tabs are not a mutually exclusive arithmetic partition.

Do not substitute workspace-wide pipeline totals for selected-run counts. Label collection coverage separately from analysis errors and service health.

### 5.3 Page structure

```text
Radar briefing                        Collection: Oct 3, 8:32 PM ▾
Completed with coverage limits · View collection details
183 new/changed pages · 135 never-miss matches · 77 other signals

Needs your attention                                      Review →
25 technologies need assessment updates · 35 await Points of View
Workspace-wide actions; results below are scoped to this collection

Search findings…                 Filters                  Reset
All signals (212) | Never-miss (135) | Other (77)
All collected pages (…) | Set aside (12)
Sort: Your priorities first ▾       Group: None / Technology

PARTNERSHIP                Matches your partnership priority
Cisco and NVIDIA collaborate on enterprise agent security
One sentence explaining the development's relevance.
Agentic AI · AI Security · +3 technologies
Event date unknown · Collected Oct 3 · Cisco Blogs      Details →

RESEARCH                  Matches your research priority
ML-KEM implementation reports performance improvements
One sentence of relevance.
Post-quantum cryptography
Published Oct 1 · Collected Oct 3 · arXiv              Details →

Showing 20 of 212 signals                              Load more
```

This is an illustrative hierarchy. The final copy must use stored facts and accurate date labels. The default feed continues until all results are accessible. No hidden top-ten cap, no permanently omitted “more groups,” and no automatic summarization required for this layout.

### 5.4 Needs your attention

Move guidance near the top, keeping it compact enough that findings remain visible in the first desktop viewport.

- Use the existing `pipeline.for_analyst` and shared evidence readiness rules.
- Start with review links: “Review assessment updates,” “Review assessments awaiting a Point of View,” or “Review interrupted assessment.”
- A review link shows the actual target technologies and their relevant states before a batch action is offered.
- Show a collapsed secondary entry for old pages awaiting a signal-list check; this maintenance activity should not dominate normal results review.
- If empty, use a small “No pending actions” line or omit the section.
- Workspace-wide actions must say so. If a button acts only on selected-run technologies, Atlas must calculate that intersection and the confirmation must name that scope.
- A selected-run intersection may filter eligible targets; it must not bypass state rules or include off/assessing technologies.
- Show estimated calls in the action review/confirmation. Batch scope must be visible before the user commits to a potentially large assessment.

The existing counts for checking, assessing, and writing may refer to different evidence and technology sets. Do not draw a forced linear sequence implying the same records flow through all three actions at this moment.

### 5.5 Full coverage through tabs

- **All signals:** a flat complete hit list, including unlinked technologies and unmatched signals.
- **Never-miss:** the stored configured-rule matches. A rule being removed later must not erase its historical matches.
- **Other:** individual unmatched hits, with the same details panel. Keep the existing grouped “suggestions for new rules” as an optional secondary view; its three-example cap is not a complete feed.
- **All collected pages:** all page visits saved in scope. Filter by new/changed, unchanged, no signals, analysis issues, source, and technology.
- **Set aside:** retained pages, rule name, rationale where stored, and the explicit exclusion from assessment.

All collected pages also provides the path to pages without any signals. A quiet signal feed with collected evidence must say “No signals found in this scope; N pages were collected,” with a link to those pages. Do not say nothing was collected.

Tabs must use their real units: `212 signals`, `12 pages`, etc. Changing tabs resets item pagination and selection while keeping compatible scope filters.

## 6. Importance and sorting

### 6.1 Meaning of priority

Use the label **“Your priorities first”** rather than “Most important” or an unexplained importance score. This first implementation prioritizes user-configured interest and known dates. It does not claim to measure business impact, verify a scientific breakthrough, or establish source independence.

Do not rank by number of technology tags, frequency of a finding across groups, number of stored copies, or number of words in its summary. A broadly tagged vendor overview should not win simply because it names many technologies.

Funding, patents, research, deployments, and partnerships have no universal ordering. Let the user establish their signal-type order.

### 6.2 Minimal configuration

Add optional `display_rank` to signal-rule configuration:

- Integer, lower comes earlier; default `100` when absent.
- Used for enabled `never_miss` rules only.
- Give the editor a secondary “Order in results” control. A simple number field with “Lower numbers appear first” is sufficient; drag-and-drop is unnecessary.
- Existing rules all default equally. Do not invent priorities for TCL without an explicit business preference.
- A missing/disabled rule's stored matches remain visible, with a neutral historical-match label.
- Display order changes take effect on the next results refresh and require **no model calls and no recheck**.
- Preserve current rank when an existing edit client omits the optional field; do not reset it silently on unrelated edits.
- Persist it through the existing configuration/seed/Changes mechanism. Check live Changes before deploying changed seeds, as existing plans require.

Current Atlas `snapshot.signals_hash()` explicitly hashes rule ID, name, look-for text, and mode. Keep display metadata outside that detection hash and outside summarization prompts. Reordering the UI must not make stored pages stale or change crawling behavior.

### 6.3 Deterministic ordering for version 1

Use a single backend sort rule, shared by Briefing and Signals:

1. **Match band:** active never-miss matches, then historical configured matches whose rule is disabled/removed/changed to Can ignore, then unmatched `other` signals.
2. **Configured display rank:** applies within active never-miss matches; equal defaults preserve equal priority.
3. **Date band:** recent known event/publication date, then unknown date, then known older background evidence.
4. **Best usable date:** descending within the date band, respecting precision.
5. **Collection timestamp:** descending.
6. **Stable tie-breaker:** `doc_id`, then stored signal index `n`.

For a predictable initial rule, “background evidence” means its known date interval ends more than 30 days before the fixed scope reference time (`as_of`). For a historical collection, use that collection's finish time; for a rolling window, use its fixed `to`. Do not create a new administration screen just for this threshold.

Unknown dates stay visible and are explicitly labelled. A date after `as_of` is not treated as a recent completed event; retain the raw date with a caution/uncertain-date label and put it in the unknown/uncertain band.

Every row has a short ordering explanation, such as:

- “Matches your funding priority.”
- “Matched a rule that is now disabled.”
- “Other signal — no configured rule matched.”
- “Older evidence, newly collected.”

All equal ranks are allowed. The explanation can then say “Matches your signal list,” without pretending one rule was assigned greater importance.

Alternative sorts: **Newest collected**, **Newest known event/publication**, and **Your priorities first**. Clearly label the date basis. Sorting changes list order, not eligibility or counts.

### 6.4 Assessment relevance

Show existing assessment fabric/priority context where available on the technology page. In version 1, use a technology filter to focus findings rather than joining every signal to every assessment for a composite score.

Unassessed technologies remain fully discoverable. Do not downgrade them because they have no P/H/TORA values. A relevance-based sort using existing assessments can be considered later if user testing demonstrates a need; it is not required for this handoff's first release.

### 6.5 Rank before pagination

Sort the complete matching result set before slicing a page. Sorting only the 20/50 returned items is incorrect: a higher-priority finding could remain on page 12.

Calculate total and facet counts using the same scope and eligibility predicates. Avoid one database query per signal. Join the small signal-rule metadata once; batch any related-technology lookups for the visible page.

Apply filtering, derived sort keys, sorting, counts, and pagination server-side, preferably in the existing MongoDB aggregation pattern. A small pure helper can define rule/date keys and build the corresponding expressions. Do not download the entire result set to the browser to sort it, or require an unbounded Python in-memory result list. Reuse scope indexes; add an index only where the actual query/check shows it is needed.

Offset pagination can remain for this iteration. Preserve fixed scope boundaries and stable tie-breakers. If results/rules change during review, offer “Results updated — refresh” and reset pagination on refresh. Do not promise an immutable historical snapshot or silently append an incompatible ordering.

## 7. Dates, freshness, and provenance

Distinguish these separate facts:

| Fact | Source | Display |
|---|---|---|
| Event timing | `signals.when`, when usable | `Event: Oct 1, 2026` or the stored month/year/free text. |
| Publication timing | Document `published_date` | `Published: Oct 1, 2026`; never relabel publication as the event date. |
| Collection timing | `scraped_at` | `Collected: Oct 3, 2026`. |
| Assessment timing | Latest qualifying assessment | `Assessed: Sep 11, 2026`. |
| Point of View timing | `composed_at` | `Written: …`; link it to the assessment actually used. |

Expose document publication date in `FoundHit`; it is not currently projected by `signals.hits()`.

Use a small deterministic date helper for supported ISO day, month, and year values. Preserve the raw strings. Represent precision internally as an interval for ordering/classification; a year such as 2021 must not be displayed as an invented January 1 event. Do not parse arbitrary natural language with a new model call. Unusable/ambiguous dates remain raw text with an unknown sort date.

Choose a usable event date first; otherwise use a usable publication date and label the basis. If the stored event text is free text and publication date is usable, show both with their correct labels. Do not silently substitute collection time into an event date field.

“Recent findings” requires date context. For collection-scoped views, prefer “Findings collected in this run” or “Newly collected evidence.” Older material remains in the same complete result set with a background label; users may explicitly filter it out.

Stored document analysis can change during a later Check again. The collection association proves when evidence was collected, not that its analysis text is an immutable snapshot from that run. Explain this in collection details. If a reliable per-document analysis timestamp is available, show it; otherwise do not invent one. Immutable analysis history is outside this iteration.

## 8. Finding rows and the detail panel

### 8.1 Scan-friendly row

Required visible content:

1. Signal type chip and priority explanation.
2. A human-readable headline for what happened.
3. One short paragraph/line explaining relevance when stored.
4. Source and correctly labelled date.
5. Up to two related technology links, followed by `+N technologies` opening the full list in the panel.
6. An obvious Details affordance and selected-row state.

Use existing `what`, `title`, and `implication`. Clamp list text visually, keeping full text accessible in the panel. Do not create a new LLM call per row solely to shorten it. If `what` is absent, fall back to source title/URL and label missing analysis appropriately. Short copy must not drop caveats such as “vendor-reported,” “proposed standard,” or “date not stated.”

Use a readable text measure rather than full-width paragraphs stretching across a 1,400px container. A main list plus a compact attention area, or a bounded single column, can use the available width without producing very long lines.

### 8.2 Identity and duplicates

- One stored hit is identified by `doc_id:n`. Show that hit once in the flat feed even if attached to several technologies.
- Keep multiple distinct signals on one page; a partnership and a product launch are different hits.
- When grouping by technology, references may appear in several groups. State that group counts overlap and do not sum to a unique total. Each group's hit list must still be fully paginated; remove current five-hit/ten-full-group caps as coverage boundaries.
- Do not automatically merge findings from different document versions or sources by headline similarity. Source corroboration and duplicate ingestion require different treatment.
- Near-identical HTML/PDF representations can be handled later using already reliable source/canonical identifiers. Show both until that relationship is known. This iteration fixes exact display duplication without a semantic deduplication subsystem.

### 8.3 Detail panel

Reuse `SignalPanel`. Show full finding text, who, event/publication/collection dates, relevance, exact supporting quote, source link, all related technologies, priority explanation, and analysis caveats.

Primary navigation rules:

- When opened within a known technology context, the primary button names and opens it: `Open Agentic AI`.
- When opened from the flat feed with exactly one linked technology, name that technology.
- With multiple related technologies and no originating context, provide explicit named links or “Choose a technology.” Do not select the first ID invisibly.
- Unlinked signals show “No technology linked yet” and still allow opening the source.
- Label the external action `Open source article` or `Open source page`, rather than the ambiguous “Open the page.”

Keep URL-addressable selection, Esc/close, focus movement/restoration, and keyboard interaction. Preserve underlying scope and filters when opening/closing. A stale `doc_id:n` after reanalysis must show “This finding has changed or is no longer available” with a route back to the current page's findings, rather than silently opening an unrelated hit.

For narrow screens, use a full-width panel with visible title and close action. On desktop, selected-row highlighting and clear panel boundaries should make the relationship evident.

## 9. Technology page: conclusion, change, evidence

### 9.1 Recommended order

1. Back link retaining the originating results scope and filters.
2. Technology title, readable state, fabric labels, and Manage as a secondary control.
3. **What changed / next action:** why an update is needed, with one primary action.
4. **Current assessment:** per-fabric priorities/horizons and TORA, with explanations and assessment date.
5. **Point of View:** headline, written date, freshness relative to its own assessment, Open/Create/Update action.
6. **Recent findings:** a compact preview with a complete “View all findings” route/count.
7. **Evidence:** expandable paginated pages, including no-signal evidence and analysis caveats.

Example:

```text
← Results from Oct 3
Agentic AI                                      Manage ▾
Assessment needs updating
10 evidence pages have been added since the Sep 11 assessment.
[Review new evidence] [Update assessment]

Current assessment · Sep 11
Cloud: Priority P2 · Horizon H2     Explain scoring / Assessment details
Market 7 · Strategic fit 9 · Adoption 4

Point of View
No Point of View has been written from this assessment.

Recent findings (19)                             View all →
Evidence pages (…)                               Expand →
```

Example counts and values are illustrative. P/H values must use the actual configured definitions; do not assume P2 means a fixed business recommendation or H2 a particular number of years.

### 9.2 State-to-action wording

Continue using Atlas's single readiness state. Do not reimplement its logic in React.

| Backend state | User-facing meaning | Primary action |
|---|---|---|
| `off` | Assessment is switched off for this technology. Findings can still be reviewed. | Review evidence; enable through Manage if desired. |
| `assessing` | An assessment is running. | View progress; prevent a duplicate start. |
| `stopped_partway` | The newer assessment stopped; visible conclusions come from the previous qualifying assessment. | Resume assessment, after explaining it resumes the existing run. |
| `not_assessed` | No qualifying assessment exists yet. | Assess technology. |
| `new_evidence` | Evidence exists that the current assessment has not read. | Update assessment. |
| `no_pov` | The latest qualifying assessment awaits a Point of View. | Create/Update Point of View, depending on whether an older one exists. |
| `current` | No outstanding evidence/write step under the current rules. | Open Point of View. |

When both review and processing are offered, distinguish the primary/secondary visual weight. Do not imply that an old Point of View already incorporates the new evidence.

Show model-call estimates in confirmation with exact target scope, approximate cost, and expected output. A small optional “Estimated processing: about N model calls” note is acceptable; it should not replace the action's purpose in the primary label.

For partial assessments, display missing/unscorable values as unavailable with the stored reason; do not turn them into zero or fabricate a placement. Count technology-complete assessments using the existing gate/fabric rule, not whole-run status alone.

## 10. Technologies register and Point of View library

### 10.1 Technologies

Keep search prominent. Promote review-oriented columns:

- Technology.
- State, such as Needs assessment / New evidence / Ready to write / Current / Stopped.
- New evidence count where supported.
- Latest assessment date.
- A clear Open action.

Keep inventory detail such as Docs vs Pages, alias count, source count, and horizon breakdown in expandable/technical details. Explain their units when displayed. The inspected page currently exposes different counts for repeated visits and distinct pages; do not conceal that distinction by simply relabelling both as pages.

Add state filters to support attention links. Fetch state for only the required page using the existing batched evidence functions where feasible. If a state filter determines membership, filter the full eligible set before pagination; annotating the current first 100 technologies is not enough.

Move “Organize technologies” to Operations or a clearly secondary maintenance area. Most readers should first understand the technology, not be invited to rerun organizing.

### 10.2 Points of View

Written cards show technology, headline, fabrics, assessment used, written date, and evidence freshness. Pending rows say “Latest assessment awaiting a Point of View,” including technologies with an older written version.

Keep per-run version semantics accurate: a PoV for a newer assessment can start at version 1. Label its assessment/date so a user does not interpret that as losing a newer version. Do not redesign persistence/version history here.

Review eligible technologies before batch Write/Rewrite. Reuse `pov_targets()` and existing compose APIs. A current display ordering change does not change scoring or PoV eligibility.

## 11. Operations, status, and next-step prompts

- Preserve the process board but mark automatic activities explicitly. Collection already performs signal extraction and organizing; “Check again” is reprocessing stored pages after rule changes, not a mandatory step after every collection.
- Explain the output of each manual action in one sentence.
- Show the number and identities of targets for assessment/writing before confirmation.
- Keep source coverage limits separate from analysis failures and job/service failures. A page budget being reached does not mean the completed run produced no useful results.
- Use labels such as “Completed with coverage limits” and “Some source pages remain unvisited.” Keep source-specific counts and the settings link available.
- For a selected historical run, display that run's recorded coverage and analysis errors. Global `/api/problems` describes current workspace issues and must not be presented as the historical run's problem list.
- StatusPill remains a compact workspace activity indicator. Its popover can contain current problems and maintenance links without overwhelming result rows.
- NextStep gives one clear outcome and a review link. Say “Review updated assessments” before offering batch writing; do not send users directly into another costly action without context.
- A failed or interrupted job shows retained results, its actual error, and the correct retry/resume path.

Use plain completion summaries with accurate successful/failed units: “5 Points of View written; 1 failed” rather than wording that counts failures as successfully written.

## 12. Navigation and state preservation

- Retain visible primary navigation at laptop widths when it fits. Place Operations/Setup in an overflow menu before hiding every primary destination. Test at 1,100px and 1,280px; breakpoint values should follow actual fit, not a blanket `xl` assumption.
- Preserve URL state for collection/window, tab, filters, sort, grouping, and selected finding.
- Use distinct query parameters: existing `signal=<doc_id>:<n>` is selection; use `signal_id` for a signal-type filter. Do not overload one parameter with both meanings.
- Existing links use names such as `run`, `days`, and `tab`; preserve them or map them compatibly. API naming can stay `run_id`.
- Back links carry an encoded full originating path. Validate that it belongs to `/admin` or a `/admin/…` route; a string starting `/administrator` is not a valid admin destination.
- Browser back/forward and panel close restore the right view. Keep loaded-page count/offset in URL or a small existing-session list cache if needed to restore position. Avoid introducing a persistence framework.
- Preserve the selected technology context through the panel and subsequent detail navigation.
- Scope/filter/sort changes reset pagination. Never mix old rows with a new query.

## 13. Supporting Atlas work and suggested contracts

These are proposed changes, not descriptions of APIs that already exist. Reuse current endpoints where appropriate. A small results-metadata endpoint is preferable to overloading the capped technology-grouped Briefing response with incompatible meanings.

### 13.1 Existing pieces to reuse

| Existing code/API | Useful behavior | Current limitation relevant to this work |
|---|---|---|
| `app/api/signals.py::hits()` and `/api/signals/found` | Flat hits, `doc_id:n`, filters, pagination, aligned technology IDs. | Sorts by collection time; excludes stubs; does not project publication date. |
| `/api/signals/other` | Groups unmatched hits into rule suggestions. | `total` counts groups; only three examples per group, so it cannot supply complete Other results. |
| `/api/signals/set-aside` | Paginated excluded pages and totals. | Needs consistent scope/filter handling alongside other results. |
| `/api/runs/{id}/documents` | All saved visits in a collection, including stubs; source filtering. | Needs lightweight search/status filters for the proposed all-pages browser. |
| `/api/runs/{id}` | Selected-run metadata, recorded coverage, analysis errors, evidence-use links. | Workspace activity fields must remain explicitly separate from selected-run facts. |
| `/api/briefing` | Current window/grouped landing data. | Ten full groups, five hits per group, and five unlinked hits cannot provide complete coverage. |
| `app/services/evidence.py` | Shared state, evidence freshness, batch eligibility. | Reuse its facts; do not invent portal readiness rules. |
| `/api/technologies/{id}/summary` | Assessment, unfinished run, PoV, new evidence, estimates. | Mostly supports reordering the technology page already. |

### 13.2 Results metadata

Suggested read-only endpoint:

```text
GET /api/results/summary?run_id=<id>
GET /api/results/summary?from=<ISO>&to=<ISO>
```

Return concrete scope, status, counts, selected-scope coverage, and filter metadata. Validate conflicting scope arguments; return a helpful 422 rather than selecting one silently. A missing run returns 404.

Illustrative shape:

```json
{
  "scope": {
    "kind": "collection",
    "run_id": "example",
    "from": "2026-10-03T20:00:00Z",
    "to": "2026-10-03T21:00:00Z",
    "as_of": "2026-10-03T21:00:00Z",
    "status": "completed"
  },
  "counts": {
    "signal_hits": 212,
    "configured_hits": 135,
    "other_hits": 77,
    "collected_visits": 240,
    "new_changed_pages": 183,
    "unchanged_visits": 57,
    "set_aside_pages": 12,
    "pages_without_signals": 0,
    "analysis_issue_pages": 0
  },
  "coverage": {"limited_sources": 6, "failed_sources": 0}
}
```

Numbers are illustrative, especially no-signal counts; compute them from stored records. Define `pages_without_signals` as new/changed pages with no hits that were not set aside and have no analysis error. Failure/partial and set-aside remain separately filterable. Do not report analysis failures as successful “nothing found.”

For windows, use `[from, to)` timestamp semantics consistently. For a concrete run, membership is by `run_id`, not a timestamp approximation. A selected run's bounds are context/display information and do not discard records belonging to it.

### 13.3 Extend the flat hits query

Support these additions to `/api/signals/found`:

- `sort=priority|collected|event` with stable backend ordering.
- `until` as the upper collection-time bound, paired with existing `since`.
- `q` for a literal, bounded search over stored title, `what`, `who`, and linked technology names. Escape regex input; no semantic search dependency.
- Optional `tech_id`, resolved to the canonical current name, while retaining `tech` for existing clients.
- Existing `run_id`, `source_id`, `signal_id`, `on_list`, `doc_id`, `limit`, and `skip` remain compatible.
- Project `published_date`, date display/basis metadata, and priority explanation for visible hits.

Example added row fields:

```json
{
  "published_date": "2026-10-01",
  "priority": {"band": "configured", "display_rank": 100,
               "reason": "Matches your research signal rule"},
  "date": {"basis": "publication", "raw": "2026-10-01",
           "precision": "day", "background": false}
}
```

Keep date normalization and ranking in one small backend helper. Return data/codes where possible and let the portal word the labels. A disabled/deleted rule uses stored match name and explicit status rather than losing the hit.

Reuse `signal_id=other` to retrieve the complete individual Other feed. Ensure `doc_id` panel retrieval is not accidentally narrowed by the surrounding list's search/filter parameters. Resolve its requested hit robustly even if a document has more signals than the endpoint's page limit.

### 13.4 Page browsing and counts

Extend the existing selected-run documents endpoint with search/status filters, and provide the same lightweight document-list behavior for date-window scopes. Prefer one shared query helper over repeated implementations.

Use a read-only `/api/results/pages` endpoint for window browsing if this keeps route responsibilities clearer. Proposed status filters: `all`, `new_changed`, `unchanged`, `no_signal`, `analysis_issue`, `set_aside`. Share their predicates with summary counts.

Return lightweight fields: ID, title, URL, source, collected/publication date, `is_stub`, `ref_doc_id`, rule exclusion, analysis status/error, technology links, and summary. Full extracted text loads only when requested. Existing text retention/pruning behavior remains explicit.

Distinguish unchanged visits from new evidence. A collection can have no new signals but many unchanged pages; their previous analysis can be reached through the page's existing reference relationship.

For an unchanged visit, open its page record to explain that visit, and resolve previous signal details through `ref_doc_id` when needed. `/signals/found?doc_id=<stub-id>` currently excludes stubs and cannot directly supply those hits. Preserve the current visit's collection context while identifying the original content version in the detail view.

### 13.5 Facets and configuration

- Tab totals are computed for scope plus search and technology filters, before tab-specific filtering.
- Filter-option counts respect scope/search/technology and the active tab, while excluding the particular filter dimension being counted. Explain counts as available matching hits.
- Return full `total` after all selected filters for pagination. Do not use Other group totals in a signal counter.
- Add optional `display_rank` to SignalEdit, stored signal rows, response types, seed serialization, and Changes handling. Detection fingerprints/prompts remain unaffected.
- Preserve old links and clients. Do not change the meaning of existing fields such as `on_list` or `total` without a coordinated update.

## 14. Portal implementation map

| File/area | Recommended change |
|---|---|
| `app/admin/page.tsx` | Replace capped technology-grouped landing with scoped metadata, attention summary, complete paginated results, and explicit empty/error states. |
| `app/admin/signals/page.tsx` | Reuse results controls/list/panel; retain deeper filtering and signal-configuration entry point. |
| `components/SignalItem.tsx` | Shorter scan form, two visible technology tags, explicit Details, dates and priority reason; keep full detail in panel. |
| `components/SignalPanel.tsx` | Named contextual destination, full dates/provenance, safe stale-selection behavior, keyboard/focus handling. |
| `components/AnalystBox.tsx` | Compact near-top review summary; target review before costly bulk actions. |
| `app/admin/technologies/[id]/page.tsx` | Reorder current conclusion/change/action before supporting findings; preserve state logic and existing manage tools. |
| `app/admin/technologies/page.tsx` | Review-state filters and columns; secondary inventory details. |
| `app/admin/scoring/pov/page.tsx` | Accurate pending wording and assessment provenance; target review before batch write. |
| `components/TopBar.tsx` | Keep primary routes visible at laptop widths; overflow secondary routes first. |
| `components/StatusPill.tsx`, `ProcessBoard.tsx`, `NextStep.tsx` | Distinguish workspace vs selected-run facts, coverage vs failures, automatic work vs manual reprocessing. |
| `components/SignalListEditor.tsx`, `lib/signals.ts` | Display rank control/types; explain that ordering changes cost no model calls. |
| `lib/here.ts`, BackLink | Preserve full scope/filter context and exact admin-route validation. |

A shared `ResultsList`/`ResultsControls` and a small results-query hook are reasonable extractions if they replace real duplication. Avoid turning these into generalized configurable widgets.

Read `tech-lens/AGENTS.md` and relevant installed Next.js guides before coding. Retain required Suspense boundaries for search parameters. Follow the repo's actual Next version rather than remembered conventions.

## 15. Loading, errors, accessibility, and responsive behavior

- Show list/header skeletons while initial data loads; avoid an unexplained blank main area.
- Abort or ignore obsolete requests when scope/filter changes. An older seven-day response must not overwrite the newly selected historical run.
- If a section fails, retain other successful sections and show an inline Retry. Service unavailability should not expose terminal commands as the primary end-user recovery instruction; put diagnostics in Operations.
- Pagination errors leave loaded rows visible and allow retry without appending duplicate hits.
- Preserve current list until refresh is intentional; label loading/new-results clearly so old data is not mistaken for the new scope.
- Empty states distinguish no collection, no matches, no signals on collected pages, no newer evidence, all-set-aside results, and unavailable historical run.
- Source failures and partial analysis retain useful results with caveats.
- Make sort, grouping, tabs, filters, load-more, and panel actions keyboard operable. Use visible focus, accessible names, selected tab state, and status announcements.
- Do not rely on color to distinguish priority, age, failure, or partial analysis.
- Preserve focus after panel close; when the originating row no longer exists, return focus to the results heading/controls.
- Test 400px, 1,100px, 1,280px, and 1,440px widths. Ensure dates/actions wrap without horizontal overflow.
- Keep print output for Points of View free of navigation/panels/notices.

## 16. Suggested delivery order

### A. Complete scoped results and scan-friendly reading

Implement scope metadata, fixed windows, complete flat hit/page browsing, shared list controls, truthful counts/dates, exact-hit display deduplication, early attention summary, and contextual panel destinations. Preserve existing routes. This establishes the correct review model.

### B. Transparent configurable priority

Add display rank, pure date/priority helpers, full-set backend sort before pagination, priority explanations, and configuration persistence. Build no new LLM-dependent ranking step. Demonstrate a priority change without a recheck or model-call increase.

### C. Technology decisions and navigation

Reorder technology pages, add review-state filtering, improve batch target review, navigation fit, and operations wording. Reuse the evidence/readiness service throughout.

Each increment should be demoed with the existing real data and approved before expanding scope. Do not rerun production collection/scoring or deploy merely to validate UI layout without the user's permission.

## 17. Acceptance criteria and verification

### Results completeness

1. With 212 hits in scope, users can reach all 212 through pagination; no top-five/top-ten limit silently excludes records.
2. The same `doc_id:n` appears once in flat mode despite multiple technology links. Two different hits on one page both remain visible.
3. Other results paginate individual hits, not three examples from each grouped suggestion.
4. Unlinked, no-signal, set-aside, unchanged, failed, and partly analysed pages are reachable with truthful status.
5. Counts reconcile with database/API units and the exact selected scope; overlapping page categories are explained.
6. Known older evidence is labelled but remains accessible by default.

### Ranking and dates

7. Raising a configured rule's priority moves all its eligible hits ahead of lower-ranked rules across the complete dataset, including previously unloaded pages.
8. Rule reordering changes no summarization hash, stale-page count, crawler behavior, or model-call count.
9. Missing rank values default equally; disabled/deleted rules preserve historical hits.
10. Repeated requests with unchanged data produce stable ordering and pagination.
11. Day, month, year, missing, ambiguous, and future dates are handled without invented precision or collection dates masquerading as event dates.
12. A 2021 event collected in the selected 2026 run is labelled older evidence; a genuinely recent dated finding is labelled with its actual date basis.
13. Date sort, priority sort, tab selection, and filters operate before pagination.

### Scope and navigation

14. Selected-run results never include another run merely because it finished later or is currently shown by pipeline.
15. Rolling-window queries share fixed boundaries; selecting a run uses run membership.
16. An interrupted/failed collection with saved evidence remains reviewable and accurately labelled.
17. Context survives opening a panel, opening a technology, visiting a Point of View, and returning; filters and results position are restored.
18. A signal opened from Agentic AI offers `Open Agentic AI`, not an arbitrary first related ID.
19. Stale selection URLs produce a clear recovery state; malformed internal return URLs are rejected.

### Decisions and resilience

20. The first desktop viewport exposes scope, result coverage, priority explanation, and a discoverable review action.
21. The technology page exposes assessment freshness and next action before its long evidence feed.
22. Bulk actions show eligible targets, expected output, scope, and approximate calls before confirmation; cancelled confirmation starts no work.
23. Hub state, review-target lists, pipeline counts, and compose batch eligibility agree with Atlas's existing readiness functions.
24. Ordinary collection coverage limits are distinguishable from failed analysis and service failures.
25. Rapid filter changes, failed fetches, and failed load-more preserve correct scope and already loaded results.
26. The full journey works with keyboard only and at narrow/laptop widths. Primary navigation remains discoverable.

Verification should use the existing Atlas test suite, meaningful backend tests for ranking/count/scope/hash behavior, Lens lint/build, and manual UI checks against dev data. A new frontend test framework is not required solely for this iteration. Do not claim checks passed until they have actually been run.

For the user demo, ask a reviewer unfamiliar with the implementation to:

1. Identify the scope and explain the first finding's position.
2. Find a funding/patent/research development using filters.
3. Reach the last result and locate a no-signal or set-aside page.
4. Distinguish an older event from a recent collection.
5. Open a related technology and explain whether its assessment needs updating.
6. Review batch targets and return to the original findings without losing context.

Record where the reviewer hesitates. Adjust labels/layout before adding more capabilities.

## 18. Assumptions and decisions to confirm during the demo

No clarification is required to prepare this document. The following proposed defaults make implementation reviewable:

- Latest finished collection is the initial Briefing scope; rolling windows remain selectable.
- All signal priorities start equal until the user orders them.
- Priority means user-configured relevance, with a disclosed date rule; it is not a measured impact score.
- Background evidence uses the explicit initial 30-day rule and remains included by default.
- Search is literal over existing fields; technology filtering uses stable IDs where supported.
- Grouping is optional; flat mode is the initial default.
- Existing TCL visual styling and route names are retained for the first increment.

Confirm these defaults in the screen demo before release. If the user prefers a seven-day default or different initial signal priorities, those are small configuration/product adjustments. They do not justify an additional framework.

## 19. Scope of this document

This handoff authorizes no application changes, deployment, production collection, or model-consuming processing by itself. It records the requested recommendations and rationale for another implementing agent. The user's explicit instruction remains that application changes require permission.
