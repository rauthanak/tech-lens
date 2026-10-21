# Final UX review and recommendations: make Tech Lens understandable

**Date:** 2026-10-04  
**Iteration:** 2 — finalized after the scope review  
**Status:** final recommendations for the next usability release; application changes require separate user authorization.

Read this document for **what should change and why**. Read the [implementation plan](implementation-plan.md) for **what to edit, how to implement it, and how to verify it**. These two documents form the current handoff. [Iteration 1](../1/ux-review-and-recommendations.md) is historical review evidence and screenshots; its broader feature/API proposals are not additional requirements.

## 1. Verdict and the product problem

The application looks coherent and professionally styled. Its branding, top navigation, restrained colors, and reusable cards are a good foundation. The remaining usability problem is the amount of interpretation required to understand an evaluation and choose what to do next.

A newcomer sees scores, P/H codes, blank values, “Up to date,” several processing queues, and five numbered Operations cards. Those elements describe different facts, but the screen often leaves the reader to connect them.

The next release should improve the meaning and order of existing information. It should help the user answer:

1. What am I looking at, and which evidence/date does it cover?
2. What conclusion does the system support, and what remains unknown?
3. Where can I inspect the reasoning or complete results?
4. What happens if I choose this processing action?

Keep full results and supporting analysis accessible. A simpler first screen should not turn the application into a permanently capped highlights dashboard.

This is a heuristic review of the live screens inspected earlier on October 4, supported by a code inspection during finalization. It is not a formal usability study, and the external claims within stored assessments were not independently verified. No new live collection or analysis was run to finalize these documents.

## 2. Observations that support the recommendations

| Observed behavior | User interpretation risk |
|---|---|
| Briefing showed 212 findings from 183 new/changed pages, with working complete pagination. | A finding and a page are different units. Keep both labels explicit and preserve the complete list. |
| Six funding findings were accessible, including older articles. | Date scope must distinguish when a page was collected from when its article was published. |
| The intro says “most important first,” but ordering follows article-age bands and configured signal-type preference. | Users may assume each finding has been assessed for TCL importance when it has not. |
| A wide screen reserves an empty details column before a finding is selected. | The main reading area becomes unnecessarily narrow. |
| Agentic AI leads with “Best P2 in Cloud,” while other areas have missing placement/adoption values. | One area's result can be mistaken for the conclusion across the technology. |
| AgenticOps has Strategic fit 8/10 from 1/3 measures and Market potential 4.5/10 from 2/3. | High numbers can look fully supported while key TCL-specific measures are missing. |
| AgenticOps says its PoV uses the latest assessment, yet adoption and priority/horizon remain unavailable. | Workflow freshness can look like business readiness. |
| Its PoV was written October 4 using a September 11 assessment. | Newly written prose can appear newly assessed. |
| The PoV dedicates a large sidebar to derivation while repeating qualifications across many narrative sections. | The reader encounters arithmetic and repetition before understanding the recommendation. |
| The library has one written PoV and 133 eligible technologies, with many Write buttons. | A reading workspace becomes dominated by a processing backlog. |
| Operations has five numbered cards, including checking and organizing. | The user may believe five manual steps are required after every collection, although extraction and organization are automatic. |

These counts are observations, not permanent application values. The [baseline screenshots](../1/ux-review-and-recommendations.md#baseline-screenshots) document the inspected screens.

## 3. Final release boundary

### Include now

- Clearer labels, dates, score completeness, and missing-value explanations.
- Technology and assessment pages that explain the conclusion before technical detail.
- A recommendation-first PoV, with sources, qualifications, and full original analysis retained.
- Written/eligible library views with simple search and pagination over the existing complete response.
- Operations grouped into current activity, collection, decisions, maintenance, issues, and history.
- A Briefing that uses available reading space, explains its existing order, and preserves complete pagination.
- Existing result/evidence links, with accurate descriptions of their scope.
- Small additions to existing API responses and assessment-start validation where needed for truthful presentation.

### Defer explicitly

| Deferred addition | Why it can wait |
|---|---|
| New aggregated evidence page and page-outcome API | Collection/source pages already expose stored page outcomes. Improve their entry links and labels first. |
| Separate historical-evidence API/browser | Measure citations and recorded collection links are already useful. Clearly label current inventory and legacy gaps. |
| Separate method endpoint | A limited original-method projection can be returned by the existing run API. |
| Multi-select PoV generation and target-list API changes | Single-technology and all-eligible actions already exist. Give them accurate scope labels; add arbitrary subsets when requested. |
| New Briefing search/sort modes or a third publication-age band | These are useful exploration features, but are not necessary to fix the current meaning and hierarchy problems. |
| Custom cross-page Briefing cache | Preserve existing URL context and check native navigation first. Do not build a cache before observing the remaining problem. |
| New generated executive fields, definitions, or significance scores | Existing content can be rearranged now without prompt changes, backfills, or more model calls. |

Deferred does not mean hidden work that the implementing model should add “while there.” These features require a later decision. There are no new endpoints, routes, dependencies, collections, or data migrations in this release.

## 4. Common language: explain meaning where the user needs it

### 4.1 Three facts must remain separate

For AgenticOps, an understandable presentation is:

```text
PoV uses the latest stored assessment
Assessed Sep 11 · PoV written Oct 4
Priority and horizon not established
Strategic fit 8/10 · Partial: 1 of 3 measures scored
Adoption readiness: insufficient evidence
```

“Latest” describes which stored assessment is used. It does not establish that all evidence is sufficient or that TCL should invest. Measure coverage is not statistical confidence.

### 4.2 Recommended wording

| Current wording/presentation | Recommended meaning |
|---|---|
| Fabric | Business area; use the stored name, such as Cloud or Network. |
| Strategic 8 | Strategic fit 8/10, with scored/total coverage beside it. |
| Missing score shown as a dash or zero-length bar | Insufficient evidence, Not assessed, or Value unavailable, based on the actual state. |
| Missing P/H | Priority/Horizon not established, with recorded missing inputs or a link to reasoning. |
| Ready for a Point of View | Eligible to generate a brief from an assessment; evidence may still be incomplete. |
| Up to date | PoV uses the latest stored assessment; show dates and gaps separately. |
| Most important first | Ordered by your signal preferences; also explain existing age-band ordering. |
| Metrics to watch / Inflection | Suggested reassessment conditions, showing stored observations and proposed triggers. |
| Rewrite | Rewrite wording from this named assessment; it does not collect evidence or rescore measures. |

Keep P/H codes for readers who know the method. Explain them using recorded configuration where available. Do not invent calendar-year bands or approved investment-policy labels. Existing provisional horizon definitions remain explicitly provisional.

Help can explain formulas further. Essential score coverage, dates, missing evidence, and action scope must be visible without opening help.

## 5. Technology page: understand the subject and the evaluation

### Recommended reading order

```text
Technology name
Available stored context, with its basis/attribution

Current evaluation
Assessed date · New evidence not yet included · PoV basis, where present
Readable conclusions per business area

[Read PoV] / [Update assessment] / [Generate brief], as state permits
[View reasoning] [Current evidence pages]

Assessment by business area
Market / Strategic fit / Adoption, each with coverage
Priority / Horizon, or actual reasons they remain unresolved

PoV summary
Findings preview / View all findings
Current evidence pages
Manage / Assessment run / Method details
```

### What should change and why

1. **Remove “Best P2” as the overall verdict.** Each business area has its own evaluation. Display Cloud, Network, and other relevant areas rather than allowing the strongest code to imply a universal recommendation.
2. **Show coverage alongside scores.** “8/10 · 1 of 3 measures scored” preserves the result while exposing its limitations. Missing counts in a legacy record should say coverage was not recorded.
3. **Explain missing values.** An unavailable adoption score is not zero, and an unassigned priority is not automatically a negative recommendation. Display the stored missing reasons where available; otherwise say the reason was not recorded.
4. **Put dates and unread evidence beside the evaluation.** Agentic AI's ten newer pages were not read by the displayed September 11 assessment. A user should see that before interpreting its numbers.
5. **Explain the subject only from available text.** A stored PoV summary may provide useful context; label it with its assessment basis. If no suitable description exists, use a concise evaluation subtitle and retain source access. Do not fabricate a definition or generate one for every technology.
6. **Keep evidence accessible with honest labels.** The technology inventory contains current linked pages; it is not necessarily the exact historical dossier.
7. **Fix contradictory empty states.** For AgenticOps, say “No extracted findings recorded; 6 current evidence pages available.” An empty signal list does not mean the assessment had no evidence.
8. **Keep Manage secondary.** Naming, aliases, merging, and enable/disable matter, but they should not dominate understanding the conclusion.

Existing states remain authoritative. Disabled technology can retain readable outputs; assessing/interrupted states retain previous results; partial evidence can still support a qualified PoV. A Resume action identifies the existing run, including its wider unfinished scope where applicable.

## 6. Assessment pages: conclusion first, full reasoning available

An individual assessment should start with business area, assessed date, placement or missing inputs, and visible score coverage. It then exposes each contributing measure, justification, missing evidence, counter-case, and citations.

The run overview should put readable results and existing search/business-area filters before grid formulas. Counts must distinguish technologies from business-area rows. Grids and complete method detail remain optional supporting exploration.

Two correctness points need explicit treatment:

- The current PoV/run pages use live scoring configuration to explain older assessments. Use the original method recorded in the run for original scoring. Changing Setup should not silently change a historical explanation.
- Recompute uses current settings and mutates stored roll-ups/placement without storing the exact recalculation method. Show that limitation on recomputed records; do not claim the original weights prove the new totals. This release does not redesign recalculation history.

Rename the assessment page's current “evidence dossier” section to `Current linked evidence pages`. Its existing API reads today's inventory. Keep measure citations and recorded collection links accessible; identify missing historical provenance rather than reconstructing it from current pages.

## 7. Point of View: lead with the recommendation and its limits

### Actual example

The reviewed AgenticOps PoV recommends monitoring and validating production/commercial and TCL-specific evidence before assigning investment priority. Its scores show market potential 4.5/10 with 2/3 coverage and strategic fit 8/10 with 1/3; adoption, priority, and horizon are unavailable.

The stored recommendation is useful. The screen needs to make that meaning easier to read.

### Recommended reading order

```text
AgenticOps — Point of View
Written Oct 4 · Assessment Sep 11 · Version 1
PoV basis and important evidence limitations

Recommendation
Stored recommendation, including its qualifications

Why this is the current view
Stored headline and summary

Assessment at a glance
Per-area scores, coverage, and unresolved placement

Evidence to seek next
Stored gaps, preserving Cloud/Network differences

Suggested reassessment conditions
Stored observation / Suggested trigger / Rationale

Supporting analysis ▾   Full score reasoning ▾   Sources ▾
```

### What should change and why

- Promote the existing recommendation. Do not invent an “Invest” or “Monitor” category by parsing prose or P codes.
- Show writing date and underlying assessment date with comparable prominence. Resolve the assessments referenced by that PoV; do not attach a technology's newer evaluation to an older brief.
- Put coverage and uncertainty beside the visible scores/recommendation. Keep them visible even when arithmetic is collapsed.
- Move full derivation out of the permanent large sidebar. Preserve every original section and all measure reasoning in clearly named supporting sections.
- Preserve full recommendation text. Use paragraph spacing and disclosures for supporting material rather than generating a new summary. Missing recommendation says it was not recorded.
- Read sources from stored measure citations. Deduplicate URLs for readability while retaining which area/measure they support. Citation is not independent verification.
- Explain watch conditions as suggestions to reassess. Stored observations are not automatically tracked, thresholds are not approved TCL policy, and meeting one does not automatically assign a P/H value.
- The AgenticOps watch text discusses H3 → H2 while no horizon is assigned. Show a contextual limitation and preserve the original prose; do not invent a starting H3.
- If totals were recalculated after the brief was written, show that the narrative and current totals may differ. Do not regenerate automatically.

Keep browser printing as the export mechanism. Label it `Print / Save as PDF`; do not add a new export service or format selector in this release. Print the full existing analysis, including dates, limitations, coverage, and sources, and restore disclosure states afterward. Executive-only export is deferred.

## 8. PoV library: a reading workspace with a separate queue

Use `Written briefs` as the default view and `Eligible to generate` as the second view. Each has a count, simple search, and 20-row pagination over its complete existing data array.

Written cards show technology, stored headline, assessed/written dates, areas, and evidence/placement limitations. Eligible rows show technology, assessment date, and completeness; say that eligibility means an assessment exists, not that a fully supported investment recommendation exists.

Single-item generation uses the existing technology/run endpoint. Bulk generation retains the existing all-currently-eligible action with honest scope:

- It includes eligible technologies outside the current text search or visible page.
- It resolves eligibility when work starts, so the displayed count/cost is a current estimate, not a frozen selected batch.
- There is no “Write selected” or arbitrary-subset behavior in this release.

Keep rewriting one historical brief on its detail page. Move the current broad “Rewrite all” operation to Operations maintenance and explain that it uses latest assessments, replaces existing versions, and can generate briefs that were missing. It must not be presented as rewriting only the currently visible written cards.

This separates reading from production without introducing new batch machinery.

## 9. Operations: make automation and choices clear

### Recommended structure

```text
Current activity
What is running, or Nothing running; latest result links

Collect evidence
Collection extracts findings and organizes technologies automatically.
[Start collection] [View latest collection/results]

Decisions to review
Technologies with new evidence             [Review technologies]
Assessments eligible for a brief           [Review eligible briefs]
Interrupted assessment, if present         [View run / Resume]

Maintenance ▾
Check stored pages under current rules
Organize manually
Generate/replace briefs from all latest assessments

Issues and coverage
Failures and incomplete analysis / Source page-limit information

History
Date / Activity / Result / View output

Technical service details ▾
```

### What should change and why

1. Remove the five equal numbered action cards. A user should not believe checking and organizing must be manually repeated after every collection.
2. Use the existing Technologies state-filtered page and Eligible library for reviewing queues. Add no target-review workflow or selection wizard.
3. Use full pipeline queue counts, not just `for_analyst`, which is capped at three prompts. A queue must not disappear because another prompt took its place.
4. Preserve current progress, result access, and Resume behavior. Completed execution does not mean every input was scorable or every source page was visited.
5. Explain confirmation scope and approximate processing before starting. Cancel starts nothing; error states preserve the attempted context.
6. Separate failures from page limits. Replace “Which” with “View affected sources,” and “Raise it” with “Review source scope and limits.” More crawling is a choice, not the assumed solution.
7. Replace the unconditional “What was collected is complete” claim with “Collected results are available,” together with recorded failures/partial analysis.
8. Keep History readable and complete through existing links. Put ports, database labels, IDs, and terminal instructions in technical detail. A service failure still needs a visible notice.

Use `Review available work` wording for completion prompts; avoid teaching a mandatory “Next step 2/3/4” chain elsewhere in the interface.

## 10. Briefing: improve reading without adding another results system

Retain its complete flat list, current configured ordering, seven-day default, type filters, and pagination.

```text
Radar briefing                         Collected: Last 7 days
Findings from new/changed pages; collection/source context
Ordered by article age band and your signal preferences

Signal types / Active filters
Findings list                          Details only when selected
[Show more]                            n of total shown

[View collection details] / [View collections]
Across the workspace: work available to review
```

Recommendations:

- Let the list use the available width until a finding is selected. Keep the existing wide breakpoint and use a detail column only when needed.
- Keep headline, implication, source/date, and a few technology chips readable. Full text and all related technologies remain in the detail view.
- Label collection scope clearly. Publication date and free-form event text are different facts.
- Replace “most important first” with accurate wording about signal preference and existing age-band order. No item-level importance score is being added.
- The existing non-older band includes undated articles. Label it `Recent or undated findings`, and label missing publication dates on individual rows. Keep the backend's two-band order; do not invent a separate unknown-date count or say every item is recent.
- Keep type/count scope clear. Filters must not leave stale rows or totals under a new selection.
- Put workspace processing prompts below the main reading controls and explicitly label their broader scope.
- On narrow screens, collapse the long type rail into a labelled select/disclosure while retaining every category.
- Reuse collection/source-result links for page outcomes. For a selected run, link directly to that collection. For a multi-run window, label the link `View collections`; do not pretend it is a new precisely scoped aggregated page browser.

Preserve URL filters and safe back links. Opening/closing the selected panel should keep its row/context and restore keyboard focus. Exact restoration of many loaded pages after cross-page navigation is a known later enhancement; this release does not introduce a custom cache or promise persisted review sessions.

## 11. Backend boundary and delivery order

Only these backend adjustments belong to the finalized release:

1. Add compact display metadata to the existing technology summary: placement inputs, assessment basis/date, and the date behind a PoV.
2. Add a whitelisted original-method projection to the existing single-run response. Keep missing/recomputed provenance honest.
3. Add assessment date and compact completeness to the existing PoV library response, reusing records already queried.
4. Reject explicit empty/invalid/disabled assessment selections before creating work.

Coverage numbers are already returned by Atlas; the Technology UI needs to consume them. No new score calculation or model call is needed.

Deliver shared meaning/metadata first; then Technology/Assessment/PoV reading; then Operations/library; then Briefing polish and final browser verification. The implementation plan specifies the exact tasks, response fields, and checks. Existing crawling, extraction, scoring, composition, readiness, job concurrency, and configuration behavior remain authoritative.

## 12. Acceptance and first-user walkthrough

The release is successful when an unfamiliar reviewer can:

1. Explain which period a finding list covers and why a finding appears first.
2. Reach all matching findings and the existing collection/page results.
3. Explain Agentic AI's per-area evaluation and whether its newest pages were assessed.
4. Explain AgenticOps's recommendation and why 8/10 from 1/3 measures leaves important uncertainty.
5. Distinguish an assessment date from a writing date and workflow freshness from evidence completeness.
6. Inspect a missing measure and its citations without reading every formula first.
7. Explain which Operations work is automatic, which is optional maintenance, and what a single/all action will process.
8. Navigate through existing back links with its run/window/filter context intact.

Check keyboard access, visible focus, truthful loading/error/empty states, print behavior, and 400px/1,100px/1,280px/1,440px layouts. Capture misunderstandings and adjust copy/hierarchy before adding deferred features. Do not claim measured usability improvement until a walkthrough or study has actually been conducted.

The finalized handoff contains detailed changes with a deliberately limited feature scope. Application implementation and processing were not performed while preparing it.
