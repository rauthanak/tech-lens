# Final implementation plan: the next Tech Lens usability release

**Date:** 2026-10-04  
**Iteration:** 2 — finalized with reduced scope  
**Scope:** presentation and usability in Tech Lens, with limited changes to existing Tech Atlas responses and validation.  
**Status:** detailed implementation handoff. The user authorized finalizing documentation; implementation, processing, and deployment need separate authorization.

This is the **authoritative implementation plan**. The [final review](ux-review-and-recommendations.md) explains the user problems and rationale. Both documents are self-contained. [Iteration 1](../1/ux-review-and-recommendations.md) supplies historical observations/screenshots, not additional scope. The earlier broader version of this plan is superseded.

## 1. Objective, release boundary, and instructions to the implementing model

Make the existing application understandable to a new user without requiring an explanation of its internals. Users should identify the evaluation, its evidence limits, the recommendation, complete results, and the scope of an action before starting work.

Implement the agreed presentation changes in existing pages. Reuse stored analysis, existing navigation/components, and existing jobs. Detail in this document explains implementation; it is not permission to expand the feature set.

### Include

- Technology/assessment/PoV information hierarchy and readable score completeness.
- Correct writing/assessment dates, method provenance, and missing-value explanations.
- Written/eligible PoV views, simple client-side search, and bounded display pagination.
- Operations grouping and accurate existing single/all action scope.
- Briefing reading space, honest labels/count scope, complete pagination, and keyboard behavior.
- Limited public metadata in three existing read responses and stricter explicit assessment selection validation.

### Exclude from this release

- New endpoints or page routes.
- Aggregated evidence browsing, exact historical-page retrieval, and new document/finding lookup filters.
- Multi-select batch writing, target-list contracts, batch chunking, or a selection wizard.
- New Briefing search/sort options, a third date band, or item-level importance scoring.
- Custom cross-page cache/session restoration infrastructure.
- New prompts, generated executive fields, bulk definitions, automatic reanalysis/recomposition, or migrations.
- New dependencies, scoring formulas, job machinery, recalculation-history storage, or deployment/startup changes.

Use existing collection/source pages for complete page outcomes, measure citations for assessment evidence, and explicit legacy limitations. Do not create deferred features as an implementation shortcut.

## 2. Baseline and relevant files

Before editing, read `tech-lens/AGENTS.md` and relevant installed Next.js documentation. Inspect current local changes and preserve work belonging to other developers. The following code was inspected during planning; check it again because it may evolve.

| Area | Tech Lens files | Supporting Tech Atlas files |
|---|---|---|
| Technology | `app/admin/technologies/[id]/page.tsx`, `app/admin/technologies/page.tsx`, `lib/states.ts` | `src/app/api/technologies.py`, `src/app/services/evidence.py` |
| Assessment | `app/admin/scoring/assessments/[id]/page.tsx`, `app/admin/scoring/assessments/[id]/[aid]/page.tsx`, `lib/scoring.tsx` | `src/app/api/scoring_runs.py` |
| PoV | `app/admin/scoring/pov/[id]/[tech]/page.tsx`, `app/admin/scoring/pov/page.tsx` | `src/app/api/scoring_runs.py` |
| Operations | `app/admin/operations/page.tsx`, `components/ProcessBoard.tsx`, `components/ConfirmAction.tsx`, `components/ServiceHealth.tsx` | Existing `src/app/api/pipeline.py` and `src/app/services/evidence.py` behavior |
| Briefing | `app/admin/page.tsx`, `components/SignalItem.tsx`, `components/SignalPanel.tsx`, `lib/signals.ts` | Existing `src/app/api/briefing.py`, `src/app/api/signals.py` contracts |
| Shared/navigation | `components/PageHeader.tsx`, `components/EvidenceLine.tsx`, `components/BackLink.tsx`, `components/NextStep.tsx`, `lib/here.ts`, `lib/format.ts`, `lib/actions.ts`, `lib/pipeline.ts`, `lib/waiting.ts`, `lib/next-step.ts`, `app/globals.css` | Existing source/collection/readiness responses |

The reviewed examples, if still present, are:

- Briefing: 212 findings, 183 new/changed pages, all six funding findings accessible.
- Agentic AI: September 11 assessment; ten newer pages; different placements/completeness across business areas.
- AgenticOps: Market 4.5 from 2/3 measures, Strategic fit 8 from 1/3, Adoption unavailable from 0/3, no priority/horizon.
- AgenticOps PoV: `/admin/scoring/pov/536b15ec2302/agenticops`, written October 4 from a September 11 assessment.
- Operations: 240 older pages to check, 25 technologies with new evidence, 133 eligible briefs, one written brief at inspection time.

These are demonstrations, not hard-coded values or verified external business claims. Use disposable fixtures for automated tests.

## 3. Ordered delivery tasks

| Task | Deliverable | Depends on | Why this order |
|---|---|---|---|
| T1 | Shared meaning/types and the limited Atlas changes in §5. | Baseline inspection. | Establishes truthful display data before rearranging screens. |
| T2 | Technology and assessment views, §6. | T1. | Fixes interpretation of scores and missing evidence. |
| T3 | PoV reading/provenance/printing, §7. | T1 and shared presentation. | Makes the recommendation and its basis understandable. |
| T4 | Library and Operations, §8–9. | T1–T3 where reused. | Separates reading from starting work. |
| T5 | Briefing and navigation polish, §10. | Existing finding APIs. | Improves investigation without adding a results system. |
| T6 | Integrated checks and unfamiliar-user walkthrough, §11. | All tasks. | Verifies understanding and preserves working behavior. |

Demonstrate each coherent task using existing records before proceeding to wider scope. Ship dependent API additions before the UI that consumes them. A missing new field during rollout should show a local unavailable/legacy state rather than crash.

## 4. Shared presentation rules

### 4.1 Separate workflow, evidence, and conclusion

Use three separate statements, rather than one reassuring all-purpose status:

```text
PoV uses the latest stored assessment
Assessed Sep 11 · PoV written Oct 4
Priority not established · Adoption evidence missing
Strategic fit 8/10 · Partial: 1 of 3 measures scored
```

Keep backend readiness/state logic unchanged. Update frontend labels in `lib/states.ts` and corresponding page/help text:

- `no_pov`: `Eligible for a brief`; explain that a stored assessment exists and can be incomplete.
- `current`: `PoV uses latest assessment`; explain that unresolved evidence/placement can remain. Remove “Nothing to do” as a statement of business completeness.
- Preserve the meaning of off, assessing, new evidence, not assessed, and stopped partway.

Audit `lib/waiting.ts`, PageHelp text, and completion prompts for old “ready/up to date/act now” implications. Do not change backend state names or eligibility.

### 4.2 Scores, partial coverage, and missing values

Add shared display types to `lib/scoring.tsx`; widen the technology page's current local type, which drops already-returned `scored/of` fields.

```typescript
type AxisResult = {
  score: number | null;
  scored?: number;
  of?: number;
  partial: boolean;
};
```

Use one small repeated-score component if needed across Technology, Assessment, and PoV; keep page layouts/actions in their pages. A general card/schema/rendering framework is unnecessary.

| Stored situation | Display |
|---|---|
| Numeric score with full recorded coverage | `7/10 · 3 of 3 measures scored`. |
| Numeric score with partial coverage | `8/10 · Partial: 1 of 3 measures scored`. |
| Null score with no scored measures | `Insufficient evidence`, with recorded coverage/missing reasons. |
| No assessment | `Not assessed`, not an empty score row. |
| Missing legacy counts | `Coverage not recorded`; never invent `0/0`. |
| Actual numeric zero | `0/10`, visibly distinct from null. |
| Missing placement | `Priority/Horizon not established`, with actual missing inputs or a link to reasoning. |

Display at most one decimal; retain full stored precision internally. Do not recalculate scores, convert coverage to confidence, count missing measures as zero, or present a null score as a zero-length bar. Essential meaning must not rely on hover/color/help alone.

Use full business-area/axis names in reader views. Preserve configured/stored area names and supplementary colors. P/H codes retain their stored values; show recorded method meaning where available, with provisional/open-question notes. Do not invent calendar years or approved TCL policy.

### 4.3 Dates, context, and errors

Use existing `formatDay`/`formatTime` for timestamps and `formatDate` for publication-day fields. Date-only publication values must not shift a day because of timezone conversion. Include year for older/multi-year history when necessary.

Differentiate loading, empty, failed, and legacy-unavailable states. A failed supporting read must not erase a successful recommendation or pretend reasoning never existed. Add local Retry; ignore responses belonging to a previous route/query. No new data-fetching library is needed.

Reuse `withFrom`, `safeFrom`, and `BackLink`. Add missing `from` propagation to existing Technology/PoV/Assessment links. Preserve URL state. Do not promise exact restoration of previously loaded deep lists across remounts; custom cache behavior is deferred.

## 5. T1: precise and limited backend work

There are **no new endpoints**. Backend application edits are limited to `api/scoring_runs.py`, `api/technologies.py`, and the compact assessment projection in `services/evidence.py`, plus focused tests. Existing crawling, scoring/composition engines, query/ranking algorithms, prompts, job lifecycle, and Mongo collections remain unchanged.

### B1. Extend the existing technology summary

**Existing endpoint:** `GET /api/technologies/{tech_id}/summary`.

`evidence._assessment()` already passes the full stored TORA values including `scored`, `of`, and `partial`. Consume those fields in Lens; do not add another coverage calculation.

Add these fields to the existing compact `assessment.fabrics[]` entries:

- `created_at`: stored assessment timestamp, or null if legacy/unavailable.
- `placement`: stored placement object, or null; includes existing timeline/potential composites and their coverage.
- `tora_basis`: stored original/recomputed marker, or null.

Keep current `assessment_id`, `fabric_id`, `fabric`, `priority`, `horizon`, and `tora` fields. Add no measures, dossiers, or text payload to each area entry.

The summary already queries the PoV's referenced assessments to compute new evidence since the PoV. Reuse those rows and add:

- `pov.assessed_at`: the existing `evidence.reading()` date convention, only when the referenced basis/dates are available.
- `pov.basis_complete`: whether a nonempty recorded assessment-ID list resolved completely. This is record availability, not evidence sufficiency/confidence.
- `pov.summary`: stored `sections.summary` text when present, alongside the current headline. Add it to the existing projection; no generation call.

Resolve the unique recorded IDs against the rows already queried. A row from another run/technology is not a valid basis reference. Set `basis_complete=false` if the list is absent/empty or any reference cannot be resolved to the expected basis. When every reference resolves and every basis timestamp is available, `assessed_at` follows the current convention: the earliest recorded area-assessment timestamp. Otherwise it is null. All references can resolve while a timestamp is missing; in that case `basis_complete=true` and `assessed_at=null` are valid, and the UI explains date unavailability separately.

Check timestamp availability before calling `evidence.reading()` for this PoV display metadata; do not let a legacy missing date raise an error in the new projection. Reuse a valid reading for the existing new-since-PoV count. If the basis cannot be established safely, leave that already-nullable count unavailable rather than calculating it from a partial or guessed basis. This guard does not change latest-assessment readiness. Do not substitute the technology's latest assessment date for an older PoV. Do not infer historical source independence from current inventory counts.

**Why:** these additions explain missing placement and provide subject context/basis without per-area detail requests on the main technology screen.

### B2. Add original-method metadata to the existing single-run response

**Existing endpoint:** `GET /api/scoring/runs/{run_id}`. Leave the run-list endpoint unchanged.

Add a `method` object derived from that run's already-stored `snapshot`:

```text
method.recorded: boolean
method.measures[]:
  _id, code, name, axis, weight, definition, required_evidence, version, open_question
method.fabrics[]:
  _id, name, definition, version, open_question
method.priority_grid:
  grid, timeline_from, potential_from, timeline_cutpoints, potential_cutpoints,
  version, open_question; or null
method.horizons:
  map, version, open_question; or null
```

Whitelist these fields. Do not return raw `snapshot`, unrelated scoring configuration, prompts, provider settings, or credentials. Preserve all current run/progress/assessment response fields.

The current query excludes `snapshot`. Fetch it internally for this single-run request, remove it from the response dictionary, then construct `method` from explicit allowed keys. Select `priority_grid` and `horizons` from the snapshot's `scoring_config` entries by their stored `_id`; do not query live configuration. Use a small `RecordedMethod` display type in Lens rather than assuming it has every field required by editable Setup types.

- Unknown run remains 404.
- Missing snapshot returns `method.recorded=false`, empty measure/fabric arrays, and null config objects.
- A recorded snapshot can still have individual missing fields; consumers must not substitute current defaults silently.
- Method data describes the original scoring basis. It is not a claim about later recalculation settings.

Update historical consumers to use this object instead of `/api/scoring/measures` or `/api/scoring/config`. Setup editing continues using those live endpoints.

**Recomputed records:** `engine.recompute_run()` currently uses current settings, overwrites totals/placement, and stores a `tora_basis` timestamp marker without retaining the exact settings used. Preserve that behavior in this release.

For `tora_basis == "scored"`, original method metadata can explain original totals. For recomputed/unknown basis, show the stored results and original measure reasoning, but explicitly say exact recalculation settings were not recorded. Do not label original weights as proving recalculated totals. If a mixed/recomputed run cannot be explained by one recorded grid, show the full results table and a limitation instead of presenting the original grid as authoritative for those rows.

**Why:** one additive field fixes misleading historical explanations without a method endpoint or a history migration.

### B3. Enrich the existing library response with compact display facts

**Existing endpoint:** `GET /api/scoring/povs`.

For `povs[]`:

- Add `assessed_at` and `basis_complete`, using its exact recorded assessment IDs, not the technology's latest run.
- Extend each existing `placements[]` entry with the stored `tora`, `created_at`, and `tora_basis`. Keep all current placement fields.

Apply B1's reference/date rules here too. Incomplete references do not hide the written brief; they give it a visible provenance limitation and an unavailable aggregate assessment date.

For `uncomposed[]`:

- Retain existing `scoring_run_id`, `tech_id`, `technology`, and `assessed_at`.
- Add `fabrics[]` using the compact assessment projection from the already-calculated authoritative readiness state.

Use existing row/state maps and batched database reads; no request/query per rendered row. Preserve `assessed`, `job`, and current eligibility. Full measure text, watch text, method snapshots, and dossier pages do not belong in this list response.

**Why:** cards and pending rows can explain incomplete evidence and older assessment dates without another API or a waterfall of detail reads. `basis_complete` only indicates referenced-record availability.

### B4. Tighten explicit assessment-start validation

**Existing endpoint:** `POST /api/scoring/runs`.

When `technologies` is explicitly supplied:

1. Require at least one ID; keep the existing maximum of 200.
2. Reject blank/duplicate IDs and validate every ID exists and is enabled before calling the scoring starter.
3. Reject the entire invalid request with 422 and a readable reason; do not silently drop IDs or fall through to general selection.
4. Preserve existing busy/active-run 409 behavior. Valid explicit lists continue to use the existing engine.

An omitted `technologies` field retains the existing supported top/min-doc selection. Do not change the general selection/scoring rules or add automatic batching.

**Why:** an explicit empty list currently can fall through to broader engine selection. This is a small validation fix with meaningful action-scope consequences.

### Backend acceptance

Existing consumers retain their fields. Snapshot/live method changes remain distinguishable. Older PoV dates come from its basis. Coverage survives the summary. Invalid explicit starts invoke no worker. No saved assessment, prompt, or configuration is modified by these reads.

## 6. T2: Technology and assessment screens

### U1. Technology page

**Edit:** `app/admin/technologies/[id]/page.tsx` and shared display types/components.

Use this reading order:

```text
Technology name
Stored context where available, labelled with its PoV basis

Current evaluation
Assessed date · New pages not yet included · PoV basis/date
One readable conclusion per business area

Primary state-appropriate action / View reasoning / Current evidence pages

Assessment by business area
Readable scores and coverage / Placement or missing inputs / Details

PoV summary
Findings preview / View all findings
Current evidence pages
Manage and assessment/method links
```

Implementation:

- Remove the aggregate “Best P2” verdict. Show each applicable area, including incomplete ones.
- Explain missing placement from stored composites: for example, no scored timeline inputs means timing is not established. Use method/full-measure reasoning for specific missing evidence; do not guess from a high axis score. If a legacy reason is absent, say it was not recorded and link to Details.
- Show the assessment date and unread page count near its conclusion. Ten unread pages are not included merely because the inventory now contains them.
- Use `pov.summary` as attributed context when available; preserve full text through an ordinary disclosure if long. It can be from an older assessment, so keep its basis date visible. Do not create a definition from headline keywords.
- Without suitable context, use the subtitle `Market potential, strategic fit, and adoption across TCL business areas`; do not invent subject text or make description generation a prerequisite.
- Keep the existing findings preview and a complete all-findings link. Label it a preview; retain legacy page-level match behavior.
- Empty findings with pages says `No extracted findings recorded; n current evidence pages available` using real counts.
- Rename Pages to `Current evidence pages` and clarify these are today's linked inventory, not a frozen assessed dossier.
- Keep Manage secondary, preserving naming, aliases, merging, and enable/disable.
- Avoid displaying the same processing button multiple times in the header and empty sections. One primary action plus informative section links is enough.

State/action behavior remains based on the backend:

| State | Presentation/action |
|---|---|
| `off` | Outputs stay readable; Manage can enable it. |
| `assessing` | Show progress/View run; keep prior results. |
| `stopped_partway` | Show prior qualifying results plus interrupted-run notice. Resume names the actual wider run. |
| `not_assessed` | Explain assessment purpose and estimated scope before starting. |
| `new_evidence` | Show unread count; primary action updates assessment. Existing older brief remains available. |
| `no_pov` | Offer generation from the existing assessment, with its incompleteness visible. |
| `current` | Open its PoV; show evidence gaps independently of current workflow state. |

**Why:** the reader gets meaning, limitations, and a relevant next action before inventory/administration.

### U2. Individual assessment

**Edit:** `app/admin/scoring/assessments/[id]/[aid]/page.tsx`.

Put technology/business area, assessed date, placement/missing inputs, axis scores/coverage, and evidence limitations first. Follow with named disclosures for axis reasoning, suggested reassessment conditions, Method, and current linked evidence.

- Keep every measure score, justification, missing reason, counter-case, and citation accessible.
- Fetch the existing run response for recorded method metadata; do not fetch live configuration as the historical explanation.
- Timeline `0/2` and TORA adoption `0/3` are different composites; display separately and keep their units clear.
- Rename the current “The evidence dossier” section to `Current linked evidence pages`. Its existing technology-documents query is a present inventory. Keep measure citations and `EvidenceLine` collection links; missing legacy provenance stays explicit.
- Do not add exact historical document lookup or reconstruct lost page versions.
- Apply recomputed-method limitations from B2.

**Why:** the UI explains why a placement is unresolved while retaining the detail an analyst needs.

### U3. Assessment run overview

**Edit:** `app/admin/scoring/assessments/[id]/page.tsx`.

- Title: `Assessment results · <date>`; move ID into technical detail.
- Show execution progress and distinct technology/area-row counts separately.
- Put existing search/business-area controls and results table before the optional priority grid/formulas. Reuse full-row client filtering.
- Use readable unavailable/partial labels instead of unexplained dashes/hover markers alone.
- Replace historical live-config requests with `run.method`. Missing method means unavailable, not default cutpoints/maps asserted as historical truth.
- Keep Recompute under Method/secondary actions. State that it changes derived totals/placement with current settings, gathers no new evidence, and does not rescore measures. Do not trigger it to repair UI labels.

**Why:** users can inspect outcomes before learning grid arithmetic.

**T2 acceptance:** AgenticOps visibly distinguishes 8/10 from full coverage and explains its unresolved timing/placement; Agentic AI shows per-area differences and unread evidence; null and zero remain distinguishable; current inventory is accurately labelled.

## 7. T3: PoV reading, provenance, sources, and printing

### U4. Resolve the recorded basis

**Edit:** `app/admin/scoring/pov/[id]/[tech]/page.tsx`.

1. Extend the PoV type with existing `assessment_ids`, `scoring_run_id`, and `tech_id` fields.
2. Fetch the PoV first; fetch only its referenced assessments through the existing full-assessment route. Encode IDs in URLs. That route validates run membership.
3. Read `method` from the existing single-run endpoint; remove the live `/api/scoring/measures` dependency for historical explanation.
4. Show assessed date (or actual area-date range where relevant) beside written date/version. Missing/partial basis dates say unavailable/incomplete; do not attach the newest technology assessment.
5. Keep separate narrative/assessment/method failure states and per-route guards. Successful narrative and successful area rows remain readable if another request fails; show retry/limitations.
6. Legacy missing `assessment_ids` means exact basis unavailable. Do not silently filter all current run assessments and present them as recorded PoV evidence.

If a valid recomputation timestamp is later than `composed_at`, show `This brief predates recalculated totals; the narrative and current totals may differ.` If the marker cannot be dated reliably, show the recalculation limitation without inventing chronology. No automatic rewrite.

### U5. Rearrange existing content

Default order:

```text
Title / Written date / Assessed date / Version / Important provenance limits
Recommendation
Why this is the current view: existing headline and summary
Assessment at a glance: per-area scores, coverage, unresolved placement
Evidence to seek next: stored gaps
Suggested reassessment conditions
Supporting analysis / Full score reasoning / Sources
```

- Promote `sections.recommendation` verbatim. It remains readable by default, including qualifiers; missing text says no recommendation was recorded.
- Use stored headline/summary for rationale. Do not parse prose into an official decision tag or create a new summary through a model.
- Move full derivation out of the permanent wide sidebar. Use native disclosures for supporting detail; essential gaps stay visible next to the recommendation/scores.
- Preserve every original section: headline, summary, TORA analysis, maturity, market view, placement rationale, capability gap, evidence gaps, recommendation.
- Handle `evidence_gaps` as either legacy text or per-area lists, without dropping either shape.
- Use shared score presentation. Where method is missing, keep measure results readable by stored code/ID and disclose unknown definitions/weights rather than importing today's labels silently.

**Why:** the reader understands the business recommendation first and can still inspect its entire basis.

### U6. Conditions, citations, and export

- Rename watch content to `Suggested reassessment conditions`.
- Render stored observation, proposed condition, and rationale, with source/date only when recorded. Say `Stored observation; not automatically tracked` when no live check exists.
- Preserve each business area's conditions; do not silently take only the first assessment. Deduplicate only exact duplicates while retaining area labels.
- For unassigned horizon plus H3→H2 narrative, add a contextual note: no horizon is currently established and a new assessment would be required. Preserve original text.
- Gather `measures[].evidence_urls` from referenced assessments. Deduplicate URL display while retaining area/measure associations. Use readable HTTP(S) links; render generated text as text, not injected HTML.
- Keep existing collection links and current inventory access. Do not call current pages exact frozen evidence or independent corroboration.
- Rename Download PDF to `Print / Save as PDF`, keeping browser print and the existing full-analysis disclosure expansion/restoration. Make Recommendation print first, then complete supporting analysis. Include dates, gaps, coverage, sources, and provenance warnings.
- Do not add executive/full export modes or a PDF library in this release. Avoid page breaks inside small blocks and test that print/cancel restores disclosure state.

**T3 acceptance:** a reader finds the stored recommendation and limitations without opening arithmetic; September 11 and October 4 are both visible; all sections/citations remain accessible; failed support reads do not erase narrative; printing includes truthful provenance.

## 8. T4a: a simpler PoV library and accurate existing actions

### U7. Written and eligible views

**Edit:** `app/admin/scoring/pov/page.tsx`.

Use `Written briefs` by default and `Eligible to generate` as the second view. Preserve `view=written|eligible`, `q`, and `page` in the URL. Existing `#waiting` links open Eligible. Invalid page/view values fall back safely.

Reuse the complete existing `/api/scoring/povs` response:

- Search literal case-insensitive substrings in technology/display name and headline for Written; technology/display name for Eligible.
- Filter the complete array before slicing into 20-row pages. Never search only the visible rows.
- Reset page to 1 for a new search/view; clamp it when refreshed results shrink.
- Show matching count separately from each view's full count, plus Previous/Next and readable range.
- No server-side library pagination/search contract in this release.

Written cards show stored headline, areas/placement or unresolved text, assessment date, written date/version, and visible incomplete coverage. Eligible rows show assessed date and compact area completeness. `basis_complete` describes record availability, not analytical confidence.

No recommendation may be inferred from missing placement. Eligible means a qualifying stored assessment is available, not that investment readiness has been established.

### U8. Keep single/all semantics explicit

Use these existing actions without adding a target-list API:

| Action | Actual scope and wording |
|---|---|
| Single generation | Existing `POST /scoring/runs/{run}/pov/{tech}` for the displayed technology/assessment. Show that basis date and estimated one call. |
| Detail rewrite | Same named historical run; wording says evidence/scores are not refreshed. |
| All-eligible generation | Existing `compose_all` with `recompose=false`; label `Generate all currently eligible briefs`. |
| Broad regeneration | Existing `recompose=true`; move to Operations maintenance, with actual latest-assessment scope and replacement effect. |

The all-eligible action covers the full workspace queue, including rows outside current search/page. Explain this at confirmation and show approximate calls from the full queue, not filtered/visible count. It resolves eligibility at start, not a frozen client selection; do not promise exact snapshot targets.

Show all-eligible generation only in the unsearched Eligible view to reduce accidental scope ambiguity; searched rows retain individual generation. After work starts, refresh using existing job/pipeline behavior and preserve failure reporting. Partial eligible assessments are not removed merely because their evidence is incomplete.

Remove the misleading primary “Rewrite all” from Written. Broad regeneration is available in Operations maintenance as described below. There are no checkboxes, Write selected, new target caps, or automatic chunking.

**Why:** library browsing stays simple while existing actions have truthful scope.

## 9. T4b: Operations and related prompts

### U9. Render groups using existing state and links

**Edit:** `components/ProcessBoard.tsx`, `app/admin/operations/page.tsx`.

Replace the five numbered columns with:

```text
Current activity: running progress / Nothing running / latest result links
Collect evidence: one collection action; extraction/organization are automatic
Decisions to review: new-evidence technologies / eligible briefs / interrupted runs
Maintenance: check stored pages / organize manually / broad brief regeneration
Issues and coverage: failures and source limits are separate
History: readable results and links
Technical service details: secondary diagnostics
```

Reuse `usePipeline()` and existing actions; no new store, polling service, or workflow model.

- Source queue counts from `p.assess.techs_with_new_evidence` and `p.pov.pending`. `for_analyst` is capped at three prompts and is not the full queue inventory.
- Link assessment review to `/admin/technologies?state=new_evidence`; link brief review to `/admin/scoring/pov?view=eligible`. Keep the existing registry search, state filter, and single-technology actions.
- Keep existing all-new-evidence assessment on the registry's unsearched state view, clearly labelled as all queue technologies, not visible rows. Send its existing explicit ID list. Do not truncate/partition a set exceeding the existing 200-ID limit; explain the limitation and retain per-technology actions.
- Preserve existing not-assessed evidence-floor behavior, with accurate action/count wording.
- Preserve Resume for the actual existing run and disclose that it can include other unfinished technologies. Show prior results and link to the run; do not start a replacement job.
- Collection text: `Collection also extracts findings and organizes technologies automatically.` Its existing confirmation shows configured budgets and expected output.
- Keep check/organize in Maintenance. Checking stored pages may change findings/exclusions and does not automatically reassess or rewrite briefs.
- Broad regeneration uses `writePovs(true)` and is labelled `Generate/replace briefs from all latest assessments`. It includes technologies with no existing brief and replaces versions that already exist. When Maintenance is opened, use the existing library response's `assessed` count for scope/cost; do not infer it from pending or written counts. A failed count read disables that action with Retry.

Update Operations help so it describes the groups instead of a mandatory five-step sequence. Update completion/next-work wording in `NextStep`, `lib/next-step.ts`, and `lib/waiting.ts` to `Review available work` / `Available to review`; preserve job completion facts and result links.

### U10. Issues, history, confirmation, and health

- Keep configuration failures, fetch/analysis errors, interruptions, and normal page-limit coverage separate.
- Change `Which` to `View affected sources`, and settings action to `Review source scope and limits`.
- Replace unconditional collected-completeness wording with `Collected results are available`, plus recorded failures/partial outcomes.
- Problems/History fetch errors get local unavailable/Retry states; failed reads are not “no problems” or empty history.
- History leads with date/activity/result/View results. Reuse existing collection/assessment list links for complete history; do not create a new history API.
- Technical health cards can be in a disclosure, but a service failure must remain visible through an outside notice. Keep one existing health check/state source; collapsing detail must not suppress detection or duplicate polling.
- Improve `ConfirmAction`: a newly blocked action disables final confirmation too, not just the initial button. Keep Cancel, visible busy/error, and retry. Recheck the current disabled reason on confirmation; backend busy validation remains authoritative.
- No extra successive confirmation dialogs. Single-item and bulk processing have their scopes stated in the existing confirmation.

For the existing Technologies registry search, preserve its existing query in `q` URL state when navigating to detail. Reuse the existing API/search; this is context preservation, not a new search feature.

**T4 acceptance:** the screen does not imply five manual steps; no queue is hidden by the three-prompt cap; single/all scope is clear; search cannot masquerade as a selected batch; cancellation starts nothing; stale/blocked actions fail visibly without broadening work.

## 10. T5: Briefing, finding details, and existing evidence access

### U11. Readable layout and truthful scope

**Edit:** `app/admin/page.tsx`, `components/SignalItem.tsx`, `components/SignalPanel.tsx`.

Keep current APIs, seven-day default, configured type ordering, two age bands, existing filters/deep links, and complete pagination.

- Label window `Collected: ...`; keep published and event dates distinct.
- Replace “most important first” with a short description of existing ordering: age band, configured signal preference, then dates. No TCL significance score is implied.
- Rename non-older band `Recent or undated findings`. Explain that known dates are within 30 days of collection and missing publication dates are included here. Label undated rows `Publication date unavailable · Collected <date>` rather than implying publication recency.
- Keep `Older articles` and its existing explanation. Do not change backend `_keys()`/counts or add an unknown band/count.
- At the existing wide breakpoint, create a detail column only if `signal` is selected. Otherwise use available list width; remove the empty reserved placeholder column.
- On smaller screens retain a drawer. Use native modal dialog behavior when it overlays the page, with inert background/focus/Escape; the docked panel remains a nonmodal region. No dialog dependency.
- Keep full headline/what/implication, quote, source, and every related technology in details. Allow two implication lines in the list if needed for readability; a small chip preview is sufficient when detail provides all labels.
- On narrow screens use a labelled type select/disclosure instead of a long rail before content. Retain every type and count.
- Move pending-work prompts below the main reading controls and label them `Across the workspace`; link to review pages instead of offering processing on Briefing.

### U12. Preserve working results and ordinary navigation

- Keep all findings accessible through Load more, with the filtered API total. No highlights cap.
- Use the existing summary's fixed `from/to` for all pages of an active list. A selected run retains run membership.
- Guard summary/list/load-more responses with active scope/list keys. Clear outdated data on scope changes rather than putting old rows under new headers/counts.
- Type changes reset visible pages and selected detail; keep the scope summary valid only for its matching run/window/source/technology.
- Prevent duplicate Load more; retain rows and offer Retry after failure. A stale response must not append or clear loading/error for a new selection.
- If background collection/rechecking completes during an active review, show a local Refresh notice rather than silently replacing/reordering rows. For changed/rechecked findings, refresh before appending further pages to avoid mixing old/new ordinal data. This is local page state, not a custom cache.
- Opening/closing the panel uses existing `signal` URL state and `scroll:false`; keep selected-row context and restore invoking focus after layout settles. If a remount no longer renders the invoking row, restore focus to the findings heading/region instead.
- Retain existing `doc_id:n` lookup behavior. If it is not found on the first fetched page, continue the existing paginated `doc_id` request until found/exhausted, with loading/error handling; do not declare a finding missing just because its ordinal is beyond 100. No new `n` endpoint/filter or permanent identity model.
- Cross-page Back links preserve run/window/type/source/technology context through `from`. Exact loaded-row/scroll restoration across remounts is not promised by this release; document observed native behavior instead of creating a cache automatically.

### U13. Complete evidence remains reachable through current pages

- In run-scoped Briefing, link `View collection details` to `/admin/runs/{run}` with `from` context.
- In window-scoped Briefing, link `View collections` to the existing collection list. Label it as navigation to collections, not a precisely filtered aggregate evidence view.
- Existing source-result pages provide saved pages, no findings, exclusions, unchanged visits, partial/failed analysis, and retained text where available. Keep these outcomes and links intact.
- From Technology/Assessment/PoV, keep current inventory, citation, and recorded collection links labelled accurately.
- Missing legacy provenance, pruned text, source failures with no saved document, and unvisited budget-limited links remain distinct limitations. Do not fabricate records or reconstruct historical evidence from current inventory.

**T5 acceptance:** all matching findings remain reachable; actual ordering/unknown dates are understandable; selection creates useful reading space; scope/counts remain coherent; collection/page outcomes stay accessible without a new results route.

## 11. T6: verification and walkthrough

### 11.1 Focused backend regressions

Use the existing disposable `tech_atlas_test` setup in `tests/conftest.py`. Stub workers/model calls when testing starts. Tests should verify externally meaningful behavior, not CSS or mirrored implementation.

| Check | Required case |
|---|---|
| Technology summary | Coverage remains intact; compact placement/basis/date; older PoV date uses its recorded basis; missing/mismatched references become explicit null/false; missing date does not crash or pretend a reference is absent. |
| Run method | Original snapshot remains unchanged by live Setup edits; whitelisted projection; no raw snapshot/secrets; missing/partial method; recalculation limitation distinguishable. |
| Library | Correct older assessment date and coverage; eligible rows preserve readiness; no per-row detail query; existing response fields retained. |
| Explicit start | Empty/blank/duplicate/unknown/disabled IDs invoke no starter; valid selection passed unchanged; omitted selection retains supported behavior; existing busy 409. |
| Existing behavior | Off/new-evidence/interrupted/current states and PoV eligibility still pass; query/order/pagination contracts unchanged. |

Extend `tests/test_tech_summary.py` and add a focused `tests/test_scoring_display.py` for method/start behavior if no suitable existing file covers it. Existing exact-response assertions may need to account for additive fields while preserving prior semantics.

Run from repository roots using installed tooling:

```sh
# tech-atlas
.venv/bin/python -m pytest tests/test_tech_summary.py tests/test_scoring_display.py tests/test_evidence.py tests/test_pipeline.py tests/test_briefing.py tests/test_signals_api.py

# tech-lens
npm run lint
npm run build
```

Run the full existing Atlas suite once after integration of changed shared projections/validation. No new frontend test framework is required; use installed tooling and browser checks. New tests must stub processing rather than spend real model calls.

### 11.2 Browser/behavior checks

Inspect 400px, 1,100px, 1,280px, and 1,440px widths:

- Main conclusion, dates, gaps, and actions are readable without horizontal page overflow.
- Keyboard filters/pagination/disclosures/panels and visible focus work; modal and docked semantics match behavior.
- Null score versus actual zero; partial versus fully recorded coverage; absent versus failed requests.
- Long recommendations and both evidence-gap shapes retain full text.
- Original versus recomputed versus missing method does not silently use live metadata.
- PoV uses referenced IDs/dates; supporting read failure preserves narrative with Retry.
- Library filters full arrays before pagination; page clamps after refresh; all-generation is clearly workspace-wide and hidden during search.
- Single rewrite uses named run; maintenance regeneration uses all latest assessments with correct replacement/new-generation wording.
- Confirm Cancel sends no mutation; blocked/double-confirm actions do not start duplicate requests.
- Briefing pagination/filter totals remain complete on an unchanged dataset; load-more errors retain rows; background completion needs deliberate refresh.
- Run/window/filter Back context survives. Record deep loaded-list restoration limitations honestly.
- Print includes full analysis, dates, coverage, sources, limitations, and restores disclosure state on print/cancel.

For the previously reviewed unchanged dataset, verify six funding matches and all 212 unique finding identities. If data changed, validate against new API totals; do not assert historical counts as constants.

### 11.3 First-time-user tasks

Without developer coaching, ask an unfamiliar reviewer to:

1. Explain Briefing's collection window and ordering; find an older/undated item and all funding results.
2. Explain Agentic AI's per-area results and whether the newest evidence is included.
3. Explain AgenticOps's recommendation and why 8/10 from 1/3 does not establish its complete TCL business case.
4. Distinguish written date, assessed date, workflow freshness, and evidence sufficiency.
5. Open a missing measure, source citation, and collection/current-page results with correct understanding of scope.
6. Explain which work collection does automatically and what checking old pages changes.
7. Explain what a single versus all-eligible action would process, then cancel.
8. Return through existing Back links with original filters/context intact.

Record misunderstood labels, hesitant navigation, and inaccessible content. Adjust wording/hierarchy before adding deferred features. Do not claim a measured usability success rate without conducting the study.

## 12. Completion checklist and implementation report

- [ ] T1: three existing read responses provide limited display data; explicit assessment starts validate safely.
- [ ] T2: Technology/Assessment show conclusions, dates, coverage, missing inputs, and accurately labelled inventory.
- [ ] T3: PoV recommendation and limitations lead; exact basis/method failures are honest; all narrative/citations/print remain accessible.
- [ ] T4: Written/Eligible library and Operations groups are understandable; existing single/all actions have truthful scope.
- [ ] T5: Briefing reading space, date/order labels, full pagination, keyboard behavior, and current result links work.
- [ ] T6: focused/full backend tests, Lens lint/build, browser checks, and unfamiliar-user observations are recorded.
- [ ] No new endpoints/routes/cache/batch-target machinery, prompts, migrations, or scoring/job/deployment changes were introduced.

Handoff the changed behavior, affected files/response additions, verification results, screenshots of Technology/PoV/Operations/Briefing, and remaining legacy/navigation limitations. Deferred features are not missing implementation work for this release.

## 13. Documentation finalization record

The existing code/API contracts and prior live UX review informed this finalized reduced scope. The recommendation and plan now agree on inclusion, deferral, action semantics, and backend boundaries.

Application implementation and its tests were not performed while finalizing these documents. No collection, rechecking, assessment, composition, recalculation, or deployment was started. The commands/checklists above instruct the implementing model; they are not claims of passed application validation.
