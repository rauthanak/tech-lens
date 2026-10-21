# Tech Lens UX review: make findings and conclusions understandable

**Date:** 2026-10-04  
**Iteration:** 1 for this date  
**Status:** historical review and screenshot baseline; superseded as implementation scope. No application changes authorized by this document.  
**Reviewed:** the live Briefing, findings panel, Agentic AI and AgenticOps technology pages, Point of View library, the existing AgenticOps Point of View, its assessment run and Cloud assessment detail, and Operations. Desktop, laptop, and narrow-screen layouts were inspected.

**Current handoff:** follow the [finalized iteration 2 recommendations](../2/ux-review-and-recommendations.md) and [finalized implementation plan](../2/implementation-plan.md). Those documents govern the next release and explicitly defer the broader API/features originally proposed here. This document preserves review evidence; its remaining implementation suggestions are historical, not an additional checklist.

The requested URL was supplied with a trailing comma. The review uses the intended application route, `http://localhost:3100/admin`.

This document retains the original October 4 review, including its supporting Atlas observations. The [previous UX handoff](../../2026-10-03/3/ux-review-and-recommendations.md), [implemented portal plan 3](../../2026-10-03/3/implementation-plan.md), and [Atlas plan 3](../../../../tech-atlas/docs/2026-10-03/3/implementation-plan.md) provide historical context only. This review concerns the newer live implementation, not the old technology-grouped home screen. Use the finalized iteration 2 documents for current implementation instructions.

## 1. Verdict: appearance, usability, and product direction

### How it looks

The application now looks coherent and professionally styled. The navy header, light background, restrained color palette, readable cards, and persistent laptop navigation provide a useful foundation. Retain the identity and existing components.

The Briefing is substantially improved: findings are presented in a paginated flat list, type filters are visible, dates distinguish older articles, and pending work is near the top. The technology page now puts the assessment above its findings. Coverage limits are separated from actual operational problems.

Remaining visual weaknesses:

- The empty details column reserves about 400px on a wide screen before a finding is selected.
- Long generated headlines still compete with dense metadata and many technology chips.
- Small uppercase/monospace section labels and faint technical labels make essential assessment meaning less prominent than the numbers.
- Several actions have similar visual weight, even when some are maintenance and others are business decisions.
- Adding “How to read this page” has helped, but essential meanings still depend on opening that help.

### Is it intuitive for someone new?

It is usable for someone familiar with the workflow, but a new user still has to learn the application's internal vocabulary to interpret its outputs. The largest issue is now **understanding the conclusion and its limitations**, rather than locating a screen.

A newcomer sees “P2,” “H2,” “Strategic fit 8,” “—,” “133 ready,” and “Up to date.” These describe different things, but the UI does not consistently explain those differences where decisions are made.

This is a heuristic review based on the live UI and its data. It is not a formal usability study, and no measured task-success percentage is claimed.

### Product direction

Keep complete results. The user explicitly wants everything a collection or analysis produced, in an understandable priority order. Do not revert to a permanently capped highlights dashboard.

For each screen, lead with its user question:

| Screen | User question |
|---|---|
| Briefing | What did we find, why are these findings first, and how do I investigate all of them? |
| Technology | What is this technology, what does it mean for TCL, and what is still unresolved? |
| Assessment | How did we reach this evaluation, and which parts have enough evidence? |
| Point of View | What should TCL consider doing, why, and what could change that recommendation? |
| Operations | What is happening automatically, what needs a decision, and what actually failed? |

## 2. Evidence from the current live review

All counts below are observations from this review. They must not become hard-coded UI text.

| Observation | Implication |
|---|---|
| Briefing showed 212 findings from 183 new/changed pages, divided into 119 recent findings and 93 older articles. | Scope and units are clearer than before, but “findings” does not cover every evidence outcome. |
| Initial pagination displayed 20 rows. “Show 20 more” increased it to 40; continuing through the final 12-item page reached all 212 findings with 212 unique stored hit identities. Funding filtering exposed all six matches: two recent and four older. | Preserve the working list/filter approach and its verified complete coverage for this dataset. |
| The desktop initial page was about 3,066px high; mobile about 4,204px for 20 rows. | Pagination bounds the list, but long text and header/controls still dominate a small viewport. |
| At 1,100px, Briefing, Technologies, Points of View, Operations, and Setup remained visible. | The previous laptop-navigation problem has been addressed. Do not redesign it again without evidence. |
| The intro says “most important first,” while ordering is by article age band and the signal list's order. | The wording overstates what the ranking establishes. |
| Funding appears first, including a music-learning startup, irrespective of whether its relevance to TCL has been established. | Configured type order is a preference; it is not an item-level importance or TCL-fit score. |
| Agentic AI shows Cloud P2/H2 with scores 7/9/4, while Interaction and Network have no priority/horizon and missing adoption scores. | The user needs a per-business-area conclusion and a visible reason for missing values. |
| Agentic AI's Strategic fit for Network appears as 7.29, while incomplete scores are explained mainly in hover/help. | Excess precision and hidden incompleteness can create false certainty. |
| AgenticOps says “Up to date,” while its priority/horizon and adoption readiness cannot be established. | Workflow freshness and evidence sufficiency are being conflated in the overall impression. |
| The current AgenticOps PoV was written on Oct 4 from scoring run `536b15ec2302`; its assessment is dated Sep 11. | A new writing timestamp must not imply a fresh assessment or new evidence. |
| AgenticOps has Market 4.5 based on 2/3 measures, Strategic fit 8 based on 1/3, and Adoption unavailable based on 0/3 in both Cloud and Network. | The score table's headline numbers need their coverage displayed alongside them. |
| The AgenticOps register currently reports six pages from one source. Its assessor repeatedly describes the evidence as vendor-reported. | Several pages do not establish independent corroboration. Current register source counts must be distinguished from frozen assessment evidence. |
| The PoV library displayed one written PoV and 133 waiting technologies in a long list with per-row Write buttons. | Availability and work backlog need separate views, search, and explicit target review. |
| Operations renders five numbered columns: Collect, Check signals, Organize, Assess, Points of View. | It resembles five mandatory sequential actions, although collection already extracts findings and organizes technologies. |
| Operations shows 240 pages to check, 25 technologies to assess, and 133 PoVs to write. | These are different scopes; simultaneous highlighted buttons do not tell a new user what to do first or whether all actions are required. |

The review also inspected rendered screenshots, opened a finding, followed assessment links, filtered funding results, and exercised read-only pagination. It did not start collection, checking, assessment, writing, or recomputation jobs.

### Baseline screenshots

- [Briefing, desktop](assets/briefing-desktop.png)
- [Briefing, laptop](assets/briefing-laptop.png)
- [Briefing, mobile](assets/briefing-mobile.png)
- [Agentic AI technology](assets/technology-agentic-ai.png)
- [AgenticOps technology](assets/technology-agenticops.png)
- [AgenticOps Point of View](assets/pov-agenticops.png)
- [AgenticOps Cloud assessment](assets/assessment-agenticops-cloud.png)
- [Operations](assets/operations.png)

These screenshots document the reviewed starting point. They are not proposed new designs.

## 3. Highest-priority changes

| Priority | Change | Rationale |
|---|---|---|
| First | Separate workflow freshness, scoring completeness, and business conclusion. | “Current” must not mean “proven,” and a high partial score must not imply all relevant questions were answered. |
| First | Show the assessment date beside the PoV writing date and use the assessment's stored method. | Readers need to know which evidence and scoring method produced the conclusion. |
| First | Replace unexplained missing placement/adoption dashes with readable reasons. | Missing evidence is an actionable outcome, not an empty cell. |
| First | Make the PoV a decision brief before exposing full score arithmetic. | New readers need recommendation, reasons, limitations, and next evidence to seek. |
| Next | Replace the five equal numbered Operations steps with automatic work, reviewable decisions, and optional maintenance. | The current structure teaches an inaccurate user workflow. |
| Next | Add explicit scope, sorting explanation, search, and an evidence-outcomes route to Briefing. | Users need all results and a truthful explanation of priority order. |
| Next | Improve technology descriptions and per-business-area interpretation. | Numbers alone do not answer what a technology means for TCL. |
| Next | Make the PoV library a searchable reading/review workspace with a separate pending view. | A backlog of 133 Write buttons overwhelms the single useful brief. |

“First” indicates recommendation priority, not permission to implement or deploy. The user controls approval.

## 4. Shared language and trustworthy state

### 4.1 Three independent facts

Display these separately instead of one reassuring all-purpose status:

1. **Workflow freshness:** whether stored evidence has been read by the latest qualifying assessment and whether the PoV uses it.
2. **Assessment completeness:** which measures/fabrics could be scored; missing evidence, analysis failures, and partial scores.
3. **Business conclusion:** the actual stored placement/recommendation, including “Priority not established.”

Example for AgenticOps:

```text
Point of View uses the latest stored assessment
Assessment: Sep 11 · Point of View written: Oct 4
Priority not established · Adoption evidence missing
Strategic fit: 8/10, based on 1 of 3 measures
```

The first line preserves the true backend `current` state without suggesting a fully supported business decision. Do not change readiness or scores solely to improve presentation.

### 4.2 Language mapping

| Current wording | Recommended wording or presentation |
|---|---|
| Most important first | Your signal priorities first; explain that recent/older article bands also influence order. |
| Fabric | Business area, with the configured name: Cloud, Network, Interaction, IoT. Technical views can retain Fabric. |
| Best P2 in Cloud | Cloud: P2 priority under the configured assessment method; show its definition and evidence completeness. |
| H2 | H2 · Mid-term band, only if this is the frozen method's mapping. Do not invent calendar years. |
| Strategic 8 | Strategic fit: 8/10 · 1 of 3 measures scored, when applicable. |
| — for a missing score | Not assessed from available evidence, with the actual missing-data reason. |
| — for a missing placement | Priority/horizon not established; show the missing input or stored explanation. |
| Ready for a Point of View | Eligible to generate a brief from the stored assessment; the assessment may be partial. |
| Up to date | PoV uses the latest stored assessment; show assessment date and outstanding evidence gaps separately. |
| Inflection | Suggested trigger for reassessment. |
| Watching it rise | Current recorded observation and suggested trigger; do not imply live monitoring. |
| Rewrite | Rewrite wording from this assessment; scores and evidence do not refresh. |
| Assess now for new evidence | Update assessment, after showing what will be included and the estimated processing. |
| Recompute roll-ups | Recalculate totals from stored scores, in Method/details. Explain that it does not gather new evidence. |

The frozen method's labels and mappings are authoritative. The seed file currently records the H1/H2/H3 mapping as a proposal requiring confirmation with TCL; expose that caveat in method details. Do not present a provisional mapping as an approved TCL policy.

### 4.3 Precision and missing data

- Display axis scores as `x/10`, rounded consistently to one decimal where necessary. Preserve full stored precision for arithmetic and technical drill-down.
- Add a visible `Partial — 1 of 3 measures scored` next to partial axis values. A tooltip can supplement it, but must not be its only explanation.
- Coverage counts are not statistical confidence percentages. Do not label 1/3 as “33% confidence.”
- Do not show an unavailable adoption score as an empty zero-length bar. Show text explaining it is unavailable; an actual zero must remain distinguishable.
- If a placement can be calculated with some missing inputs, display its stored partial/provisional status and missing inputs. Never invent one from the highest axis score.
- Differentiate insufficient evidence, model/scoring failure, and not applicable where the record supports that distinction. Use “Reason not recorded” for legacy records without the information.

## 5. Briefing improvements

### 5.1 Preserve what is working

Keep the complete flat feed, current per-type rail, recent/older grouping, 20-item pagination, selected-row highlighting, and detail panel. Keep laptop navigation. Preserve existing `run`, `days`, `type`, `tech`, `source`, and `signal` URL behavior.

Do not rebuild the original technology-grouped landing or reintroduce a top-five/top-ten coverage cap.

### 5.2 Make scope and order visible controls

Recommended header/control structure:

```text
Radar briefing
Review all findings and evidence from your selected collections.

Scope: Last 7 days ▾                  Select a collection…
Collected Oct …–Oct … · 212 findings · 183 new/changed pages

Search findings…        Type ▾   Technology ▾   Source ▾
Order: Signal priorities, then publication date ▾
All findings | Evidence pages | Set aside / analysis issues
```

- Retain the current seven-day default for this iteration; it is already implemented and usable. Make selected collection browsing directly discoverable rather than available only through Operations/back links. This supersedes the previous handoff's proposed latest-run default for the next small improvement.
- Display the actual collection-time interval, including the year when useful.
- Label pending work as **Workspace tasks**, with `Review 25 assessment updates` and `Review 133 eligible briefs`. Their counts are workspace-wide even when the feed is filtered to one collection.
- Provide literal search over existing headline/what/title/who and technology terms, with server-side filtering before pagination. Search input should be escaped and bounded; no semantic-search system is required.
- Expose a Source filter and existing Technology filter as controls. At present they appear chiefly when arriving through a link.
- Expose two initially useful sort choices: current signal-priority ordering and newest collected. The API already supports `briefing` and `collected`; use those before adding another score.
- Explain current priority order inline. The algorithm currently puts article-age bands before signal-list rank; do not describe this as a pure global impact ranking.
- Count labels should make the rail/list relationship understandable: a type may have `6 total · 2 recent · 4 older`. A filtered header can show that breakdown without adding noise to every rail item.

### 5.3 Right panel and readable rows

- Do not permanently reserve an empty details column. Before selection, use a comfortable two-column rail/list layout; after selection, reveal the existing details area on sufficiently wide screens.
- Keep list text within a readable measure, roughly 70–90 characters for a line where practical; do not expand paragraph text to the entire desktop width.
- Retain short clamped headlines, but preserve full text and qualifiers in the panel. If stored `headline` is missing, use the existing fallback; do not rerun every document just to improve this layout.
- Make row selection and the details destination visually explicit. `+N technologies` should open/expand the actual list rather than remain ambiguous static text.
- Explain generic relevance as “Why this matters” from stored analysis. Label “Why this matters to TCL” only when TCL-specific evidence or reasoning is actually stored; the current music-learning funding example must not receive fabricated TCL relevance.
- Relevance to a selected technology must come from that finding's technology relationship, not every tag on a broad source page. Preserve newer per-finding links. For legacy fallback links, say “Linked through the source page” where known rather than implying a verified event-specific connection.
- Unknown publication dates should be labelled “Publication date unknown”; collection date can be shown alongside. An unknown date must not be silently classified as a known recent publication.

### 5.4 Complete evidence outcomes

The flat signal feed is complete for stored findings, but some collection outcomes remain elsewhere:

- Pages with no extracted findings.
- Set-aside pages and their rules.
- Unchanged saved visits.
- Partly analysed or failed pages.

Provide an explicit Evidence pages view/link from the selected scope. It can reuse the existing collection/document browser and lightweight API additions described in the previous handoff. Do not require navigating into Setup to inspect an excluded result from a specific collection.

Explain units: 212 findings may come from 183 pages; multiple findings can belong to one page. Set-aside and analysis-issue counts are page counts, not signal counts, and can overlap other categories.

### 5.5 Navigation and refresh

- Preserve loaded-row count and return position when visiting a technology and coming back. Current Show more state is not kept in the address; URL filter preservation alone does not restore a 100-row review position.
- Keep a fixed scope while paginating. A background collection/check completion should offer “Results updated — refresh” rather than silently replacing a list being reviewed.
- Avoid loading a newly selected filter against the previous scope while its summary request is pending. Ignore stale summary/list responses and expose a clear loading transition.
- Distinguish “No findings recorded” from “Nothing collected.” Show evidence counts and a route to pages in the former case.

## 6. Technology page: explain the technology and current conclusion

### 6.1 Recommended opening

```text
← Briefing, with original filters
Agentic AI                                       Manage ▾
Short description, if a stored/curated description is available

Assessment needs updating
10 evidence pages were added after the Sep 11 assessment.
[Review these pages] [Update assessment]

Current view by business area
Cloud          P2 · H2 under the recorded method       View reasoning
Interaction    Priority not established               Adoption evidence missing
Network        Priority not established               Adoption evidence missing

Point of View
Not written from the assessment currently shown.
Explain whether to update assessment first or draft from existing results.
```

The layout should immediately tell a reader whether they are seeing a current conclusion, a partial conclusion, or an outdated assessment. Current assessment date must be visible without opening an assessment run.

### 6.2 Technology description

“Everything the radar knows about this technology” describes the page, not the technology. Add a short definition only where an existing stored description, reviewed text, or suitable PoV summary exists. Do not fabricate one from the name or launch automatic description calls for all 1,853 technologies.

If a dedicated description is needed, allow an optional curated description through existing Manage/update mechanisms as a later small addition. Treat this as secondary to score meaning and missing-data explanations. With no description available, do not display a dominant “No description” card.

### 6.3 Assessment presentation

Replace the single unexplained bar row with a compact per-area summary containing:

- Business-area name.
- Priority and horizon with readable configured definitions, or “Not established.”
- Why it has that status, using stored placement/missing-input information.
- Market potential, strategic fit, and adoption readiness as `/10` values with visible coverage.
- Assessment date and a named `View Cloud reasoning` link.

A small expandable explanation is sufficient; three large dashboards are unnecessary. Keep all scored areas reachable and avoid collapsing everything to the “best” priority.

The current Agentic AI examples need explicit explanations:

- Cloud P2/H2 is a result from Sep 11; ten additional pages have not been incorporated.
- Interaction and Network have missing adoption evidence, so blank placements are not negative recommendations.
- A 7.29 score should display about 7.3/10 with its partial coverage, while stored precision remains unchanged.

### 6.4 Empty and partial cases

- Not assessed: say what an assessment evaluates and show its estimated processing before starting.
- No PoV but an assessment exists: explain the next choice. If new evidence exists, updating the assessment is the recommended processing action; generating a brief from the older assessment remains a clearly labelled optional action if existing eligibility permits it.
- No extracted findings but evidence pages exist, as on AgenticOps: say “No extracted findings recorded; 6 evidence pages are available.” Do not imply the technology has no evidence.
- Legacy assessment without recorded evidence-run IDs: say “This older assessment does not record collection links.” Avoid implying it read no evidence or that its sources were independently verified.
- Off, assessing, and interrupted states retain the existing authoritative backend logic. Resuming from a technology page resumes its existing assessment run, potentially covering other unfinished technologies; disclose that scope.

### 6.5 Business conclusion before administrative detail

Keep aliases, merges, naming corrections, and enable/disable in Manage. Put collection IDs and technical method details behind named links. Retain source/evidence access for users who want to investigate everything.

## 7. Assessment screens: make reasoning inspectable

### 7.1 Start with the answer and the unanswered questions

For an individual technology/business-area assessment:

```text
AgenticOps · Cloud assessment
Assessed Sep 11 · Based on 6 pages · Source independence not established

Priority not established
Reason: maturity and commercial-adoption inputs could not be scored.

Market potential 4.5/10   Partial: 2/3 measures scored
Strategic fit    8.0/10   Partial: 1/3 measures scored
Adoption readiness       Not assessed: 0/3 measures scored

[View evidence] [How the evaluation works]
```

Use the actual stored missing reasons and arithmetic. The AgenticOps Cloud page currently reports timeline 0/2 and potential 1/4, which is a different coverage calculation from TORA axes. Keep those counts distinct.

### 7.2 Details hierarchy

- Default: conclusion, missing inputs, readable axis cards, and evidence coverage.
- Expand an axis: contributing measures, scored/total count, weights used, justification, strongest counter-case, and cited sources.
- Expand Method: complete formulas, priority grid, cutpoints, timeline bands, and extra measures.
- Expand Evidence: the full available dossier, read-page links where recorded, legacy limitations, and retention/pruning notices.

Do not put a 12-measure wall of prose or the priority-grid arithmetic before the conclusion. Users who want all detail must still be able to reach it.

### 7.3 Method correctness

The current PoV page fetches `/api/scoring/measures`, the live configuration, to name measures and show weights for an older assessment. The run lifecycle records a frozen `snapshot`, but `/api/scoring/runs/{id}` currently excludes it. If the live method changes, historical explanations can be labelled incorrectly.

Expose a small read-only method view from the relevant stored run snapshot: measure ID/code/name/axis/weight, priority/horizon mappings, cutpoints, and method versions/open questions. Expose only necessary fields, not arbitrary run configuration or credentials. Use those recorded definitions on historical assessment and PoV screens. If unavailable in a legacy record, explicitly label method metadata unavailable rather than substitute today's method silently.

This is a correctness requirement, not a new scoring system. Scores and roll-ups remain unchanged.

### 7.4 Assessment run overview

The batch run page currently opens with technical grid/formulas and an ID-led title. Improve it incrementally:

- Title: `Assessment results · Sep 11`, with run ID in technical detail.
- Summary: technologies processed, technologies with calculable placements, technologies with unresolved evidence gaps, and failures where supported. Business-area row counts and technology counts must be distinct.
- Search and business-area/state filters before a readable results table.
- Default columns: Technology, Business area, Conclusion/priority, Evidence completeness, Assessed date, View reasoning.
- Keep the current priority/disruptiveness grids as optional exploration, with full formulas under Method.
- Keep recalculation secondary and explain that it uses stored scores; no new evidence is gathered.

## 8. Point of View: a readable decision brief

### 8.1 Actual example reviewed

The existing PoV inspected was:

- **Technology:** AgenticOps.
- **URL:** `http://localhost:3100/admin/scoring/pov/536b15ec2302/agenticops`.
- **Written:** Oct 4, version 1.
- **Assessment used:** Sep 11, scoring run `536b15ec2302`.
- **Business areas:** Cloud and Network.
- **Scores in each:** Market potential 4.5, partial 2/3; Strategic fit 8, partial 1/3; Adoption unavailable, 0/3.
- **Priority/horizon:** neither established.
- **Stored recommendation:** monitor the opportunity and validate production/commercial/TCL-specific evidence before assigning investment priority.

This review evaluates the clarity and provenance of the application's stored analysis. It does not independently verify Cisco's claims, market figures, or the generated recommendation.

### 8.2 What makes this PoV difficult

1. The first prominent score table shows Strategic 8 without prominent evidence coverage. Only one measure, business-area fit, contributed; portfolio adjacency and right to play are missing.
2. `Prio`, `Hzn`, `—`, `n/a`, weights, and an expanded score-derivation column require prior method knowledge.
3. The writing timestamp is visible, but the underlying assessment date is not equally prominent.
4. Narrative sections repeat the same caveat across summary, recommendation, TORA, maturity, market view, placement, and capability gap.
5. Evidence gaps are long per-area lists, making the immediate validation work hard to identify.
6. Watch metrics contain long current-value/threshold prose and raw URLs. The UI labels them as if being monitored, although the displayed observations are stored text, not demonstrated live monitoring.
7. The watch narrative says a threshold could move H3 toward H2, while the actual assessment has no established H3 horizon. This should be qualified as a proposed future possibility rather than shown as movement from an assigned starting point.
8. No immediate source map connects the executive recommendation to stored measure citations. The underlying Cloud assessment does contain those links.

### 8.3 Proposed reading order

```text
AgenticOps                                      Export / More actions
Point of View · Written Oct 4 · Assessment Sep 11
Uses latest stored assessment · Evidence incomplete

RECOMMENDATION
Monitor and validate before assigning investment priority.

WHY
Strong fit with Cloud and Network operations.
Commercial adoption and TCL-specific capability evidence remain unverified.

WHAT WE CAN / CANNOT CONCLUDE
Market: 4.5/10, partial 2/3
Strategic fit: 8/10, partial 1/3
Adoption: not assessed from available evidence
Priority and horizon: not established

NEXT EVIDENCE TO SEEK
Named paying production customers and independent operating outcomes.
TCL assets, customer demand, and delivery/partner capabilities.

WHAT WOULD CHANGE THE VIEW
Recorded current observation | Suggested reassessment trigger | Rationale

Supporting analysis ▾       Full score derivation ▾       Sources / evidence ▾
```

The short wording above is an illustrative paraphrase of this stored PoV. Do not turn it into a universal recommendation for every technology.

### 8.4 Reuse existing sections first

- Promote stored `sections.recommendation` and `sections.headline`; do not infer an official investment decision from the UI's P codes.
- Use `summary` as the explanation. Keep full narrative accessible under named supporting sections.
- Visually shorten paragraphs with expandable text rather than cutting caveats away.
- Combine section navigation under three reader questions: Recommendation and rationale; Evidence gaps and what to watch; Scores, method, and sources.
- Preserve every original generated section somewhere in the full analysis. Do not silently replace a long existing PoV with a newly invented summary.
- Optional bullet-form executive fields can be added to future generation only if the user approves prompt/schema changes. Do not regenerate every existing PoV automatically. The first implementation can reorganize current stored fields without any additional model calls.
- Put full derivation behind a disclosure or tab. A small summary with evidence coverage can remain visible beside the executive view.
- Increase essential section-label readability; small uppercase technical captions should not be the only way readers discover the recommendation.

### 8.5 Make partial scores honest

The AgenticOps strategic-fit result must visibly communicate:

> 8/10 is based on business-area fit only. Portfolio adjacency and TCL's right to play were not assessed from the available evidence.

Render this from recorded scored/missing measures. Do not label the technology as conclusively high strategic fit for TCL merely because the mean is 8. Keep the actual calculated score unchanged.

Evidence coverage is a descriptive qualification, not a new confidence score. A brief can remain useful with incomplete assessment; show its limitations rather than automatically blocking all writing.

### 8.6 Dates and assessment identity

- Display written date and assessed date together, including year when needed.
- Fetch/display only the assessment IDs recorded in that PoV's `assessment_ids`, not an arbitrary latest assessment or unrelated row from the run.
- Obtain measure metadata from that assessment run's stored method.
- Explain Rewrite: it writes again from the same assessment; it does not update scores, retrieve evidence, or establish live watch measurements.
- Offer a separate contextual `Review new evidence / Update assessment` path where current technology state says it is needed.
- Do not label a brief written today from old evidence as “updated today” without clarifying what changed.
- Preserve per-assessment-run version semantics: version 1 of a newer run can coexist with an older run's written brief. Use dates/run basis to make it understandable.

### 8.7 Evidence and sources

- Provide named source links from the cited URLs in the assessment measures, with which measure/claim they support.
- Deduplicate identical URLs in a Sources list for readability, while keeping all citation relationships.
- Source links are evidence offered by the assessor, not automatic independent verification.
- Distinguish current technology inventory (`6 pages from 1 source`) from frozen assessment evidence. For legacy assessments lacking recorded dossier page IDs, source diversity of the frozen assessment is unknown; say so.
- Preserve vendor-reported caveats where present. Six pages from one publisher must not be described as six independent confirmations.
- Missing source/dossier provenance must remain an explicit limitation; do not reconstruct a historical dossier from today's linked pages and label it exact.

### 8.8 Watch metrics

Use a compact structured table or cards:

| Recorded observation | Suggested reassessment trigger | Why it matters |
|---|---|---|
| Stored statement with source and observation date if available. | The stored proposal, clearly labelled as a suggested condition. | Stored explanation; no promise of automatic score movement. |

- Expand the complete prose and source details on request.
- Onboarding counts are not automatically paying-customer or production counts; retain the sample PoV's distinction.
- The thresholds of 1,000 paying organizations, 20 integrations, and 10 customer workflows are model-produced suggestions in this sample. Do not present them as approved TCL policy, measured future outcomes, or an automatically enforced scoring rule.
- A threshold being met means it is worth reassessing; it does not automatically assign H2/P2.
- If no observation date/live-check result is recorded, say “Stored observation; not automatically tracked.” Do not fabricate a last-checked date.
- When a suggested horizon movement starts from an unassigned horizon, qualify it or show a visible inconsistency note and the original wording under details. Do not silently invent the starting H3.

### 8.9 Printing/export

Default export should prioritize the executive brief, dates, evidence limitations, score coverage, and source links. Offer full derivation as an optional appendix/export choice.

The current print handler opens every measure disclosure. If the screen becomes more executive-focused, do not unexpectedly print a much larger document than the user chose. Preserve readable page breaks and restore disclosure states after printing.

## 9. Point of View library

The current library has one useful written brief followed by 133 pending rows. Separate reading and production:

- **Written briefs (1):** searchable cards/list with technology, recommendation/headline, business areas, assessment date, written date, and unresolved evidence status.
- **Eligible to generate (133):** searchable/paginated target list with assessment date and completeness. Explain that eligibility means a qualifying stored assessment exists, not that the business conclusion is fully established.
- Keep single-item Write available. Before Write selected/all, show target identities, scope, and approximate calls.
- Keep Rewrite all under secondary actions for existing briefs, with an explicit explanation that evidence/scores stay unchanged.
- Do not conceal pending targets or remove partial assessments merely to make the backlog smaller. Use filters and pagination with truthful totals.
- Label missing placement “Not established” on cards instead of leaving the business-area pill to imply a positive recommendation.

## 10. Operations: separate automation, decisions, and maintenance

### 10.1 Recommended structure

```text
Operations
Manage data collection and processing. Review outputs before starting more work.

Current activity
Nothing running · Last collection Oct 3 · Last assessment Oct 4

Collect and find evidence
Collect pages → Extract findings → Link technologies
The last two happen automatically during a collection.
[Start collection] [View latest results]

Decisions waiting for you
25 technologies have unread evidence      [Review assessment targets]
133 assessments can produce a brief       [Review writing targets]
Interrupted work, if present              [Review / Resume]

Optional maintenance ▾
240 older pages have not been checked against the current signal list.
[Review what will be checked] [Check stored pages]
Manual technology organization           [Details / Organize]

Issues needing attention / Coverage details
History
Technical service health ▾
```

### 10.2 Why this is clearer

- A user starts one collection; extraction and organizing are automatic. They are not instructed to click three steps after every collection.
- The current numbered Check signals step describes optional reprocessing of stored evidence, not a mandatory prerequisite to assessment or reading.
- Assessment and writing are reviewable decisions with different target sets, rather than three simultaneous bright primary buttons.
- Historical data maintenance is clearly separated from handling new evidence.
- A new user can inspect useful results without starting model-consuming work.

### 10.3 Action review and accurate scope

Keep the existing APIs and jobs. Change the entry experience:

- Collection confirmation shows configured sources/page budgets and expected output. Coverage limits are expected boundaries, not an invitation to raise budgets unconditionally.
- Assessment target review shows technology, reason it is eligible, assessment/evidence date, and new-page count. Show selected target count and approximate calls before Start.
- Writing target review shows technology, assessment used, completeness, and whether an older brief exists.
- Checking review explains which older pages/rule versions are affected and that it may add/remove signal matches and set-aside decisions. Do not imply it refreshes all scores or rewrites briefs automatically.
- Resume identifies the actual interrupted run and its remaining technologies. No duplicate start.
- Recompute identifies that it changes derived roll-ups from saved measures, not evidence or base measure scores.
- Cancellation starts no work. A failed POST must show an actionable error and retain target selection.

If a selected subset cannot be passed to an existing batch-writing endpoint, add an optional target parameter validated against the shared `pov_targets()` result. Do not label a button “Write selected” while secretly invoking compose-all.

### 10.4 History and issues

- History rows lead with date, activity, result, and View results. Run IDs/model-call counts are secondary detail.
- Distinguish completed execution from complete evidence coverage and complete scoring. “Completed” is not proof that every measure had enough evidence.
- Coverage says “6 sources reached their configured page limit; some links were not visited.” Replace the ambiguous “What was collected is complete” with “Collected results are available,” unless analysis completion has been explicitly checked.
- Separate actual analysis failures, source configuration issues, interrupted jobs, and normal coverage limits.
- Replace “Which” with `View affected sources`.
- Offer budget/settings links without implying a larger budget is always the right solution; narrowing sources/queries and skip patterns are also valid.
- For a source requiring environment keys, default text says source configuration is incomplete; put terminal/restart instructions behind Technical details.
- Service health can be collapsed for readers, visible for operators. Preserve diagnostics; avoid making ports/database labels dominant user content.

## 11. Cross-screen consistency and first-use guidance

### 11.1 Minimal inline guidance

Use short explanations at the point of decision:

- Finding: a development extracted from a collected page.
- Assessment: an evaluation of market potential, fit, and adoption for TCL business areas using available evidence.
- Point of View: a written recommendation based on a named assessment, including limitations and watch conditions.

Keep the current help disclosure for formulas and detailed instructions. Essential missing-score meaning, dates, partial coverage, and action purpose must be visible before opening help.

Do not add a forced onboarding tour, user-role wizard, or more modal confirmations beyond the existing cost/action confirmation. First-use guidance can be one dismissible sentence or a permanent concise subtitle.

### 11.2 Consistent provenance

- Use the same date basis and state wording in technology, assessment, PoV, and library views.
- Show full configured business-area names, not unexplained Fabric/Prio/Hzn abbreviations in primary views.
- Sources and scores use the same assessment IDs throughout a PoV journey.
- Back navigation preserves run/window/filter/loaded position and the originating technology.
- A current workspace queue must never be described as a count from the selected collection.
- Current generated narrative and historical stored arithmetic can disagree. Display the recorded outcome, expose the inconsistency, and retain full text. Do not silently alter a stored recommendation to reconcile it.

## 12. Engineering handoff: small supporting changes

These requirements support the UX; they are proposed changes, not claims about existing API fields.

### Existing components to reuse

| Area | Existing implementation | Proposed work |
|---|---|---|
| Briefing | `app/admin/page.tsx`, `SignalItem`, `SignalPanel`, `/api/briefing`, `/signals/found` | Scope/search/sort controls, evidence links, conditional detail column, state restoration. |
| Technology | `app/admin/technologies/[id]/page.tsx`, `/technologies/{id}/summary` | Readable status/area interpretation; expose dates, measure coverage, and missing reasons. |
| Assessment | Existing run/detail pages and full assessment GET | Default conclusion-first layout; full method/evidence disclosures retained. |
| PoV | `app/admin/scoring/pov/[id]/[tech]/page.tsx`, stored `sections`, assessment IDs | Recommendation-first layout, historical method/provenance, citations, qualified watch metrics. |
| Library | `app/admin/scoring/pov/page.tsx`, `_pov_state`, `pov_targets()` | Written/pending views, pagination/search, validated target review. |
| Operations | `ProcessBoard`, `Operations`, `CollectButton`, `ConfirmAction`, pipeline | Automatic-flow summary plus decisions and maintenance. Existing job lifecycle remains. |

### Backend facts needed

1. **Assessment display basis:** `assessed_at`, scoring run ID, exact assessment IDs, per-axis `score/scored/of/partial`, and recorded placement inputs/missing reasons. Much of this is already stored; expose it consistently rather than calculate display certainty in React.
2. **Method metadata:** filtered frozen snapshot for the named run, as described in §7.3. Add a small read-only method endpoint or a bounded method field; avoid returning the whole snapshot on every list request.
3. **PoV basis:** recorded `assessment_ids` and their date/method/evidence references. The full PoV response already stores this identity; ensure the UI actually uses it.
4. **Evidence overview:** exact read-page/source counts only when recorded. A null legacy provenance field remains null, never a guessed count from today's documents.
5. **Search/evidence scope:** reuse common scope/filter predicates for list and counts. Apply filtering/sorting before pagination. Existing ranking must remain deterministic and shared.
6. **Batch review:** existing eligibility helper is authoritative. Add explicit subset handling only where the backend currently cannot honor reviewed selections.

Do not create a new recommendation-scoring model or significance pipeline. Do not recompute old assessments just to label them. Do not create additional LLM calls for UI explanations that can be derived from stored scored/missing measures. Future executive-field generation requires approval as a separate prompt/schema change.

### Reliability requirements

- PoV data, assessment explanations, method metadata, and source links have separate loading/error states. The current PoV page silently swallows assessment/measure-fetch errors; unavailable reasoning must be shown as unavailable, not omitted as though none exists.
- Keep narrative readable if derivation fails, with an inline retry and limitation notice.
- Scope/filter changes abort or ignore obsolete responses; load-more failures preserve loaded rows.
- Use stable result identities and consistent date boundaries. Background refresh must not reorder an active review silently.
- Formatting does not modify underlying scores. Method labels must remain tied to the original assessment.
- Preserve existing API compatibility and deployment/configuration rules.

## 13. Implementation order and restraint

1. **Trust and clarity:** expose assessed/written dates, visible partial coverage, unavailable-placement reasons, historical method metadata, and correct current-status wording. These fix misleading impressions without changing scoring.
2. **Technology and PoV reading:** reorganize current stored content into conclusion, reasons, evidence gaps, watch conditions, and full supporting detail. Use existing fields first.
3. **Operations and library:** separate automatic work/decisions/maintenance; add target review and readable written/pending views.
4. **Briefing refinements:** conditional details column, search and scope/sort controls, evidence outcomes, context/position restoration, mobile polish.

Demo each coherent increment with the existing records. Keep complete outputs available. Only widen scope if observed user hesitation remains after these improvements. No redesign of the brand, no generalized page-builder, no new workflow framework, and no semantic-ranking service are required.

## 14. Acceptance criteria and user tasks

### Meaning and provenance

1. A new reader can identify the AgenticOps recommendation and its missing evidence without expanding score derivation or reading every narrative section.
2. The PoV clearly shows `Written Oct 4` and `Assessment Sep 11`; Rewrite never implies refreshed evidence.
3. Strategic fit 8/10 visibly says 1/3 measures scored and identifies the missing TCL portfolio/right-to-play evidence.
4. Adoption unavailable is distinguishable from adoption zero; no misleading empty score bar.
5. Missing P/H values say not established and explain the actual missing inputs.
6. Historical measure names/weights/maps come from the original method. Changing live setup does not change historical explanations.
7. Workflow-current status can coexist visibly with unresolved placement/evidence gaps.
8. Watch thresholds are labelled suggested reassessment conditions; no fictitious live monitoring, approved policy, or automatic H/P transition.
9. Stored measure citations remain reachable from the PoV. Legacy missing dossier provenance is explicit.
10. Executive formatting preserves full narrative, caveats, per-area results, and source access.

### Review and operations

11. A user can review all findings, not just highlights; pagination/filter counts retain correct units and scope.
12. A user can find all six funding findings and distinguish two recent/four older in the inspected dataset.
13. Scope/search/filter changes reset pagination correctly; back navigation restores loaded position and selected context.
14. No-signal, excluded, unchanged, or failed evidence is accessible from the selected scope.
15. The first technology viewport communicates definition where available, assessed date, business-area conclusion, evidence completeness, and next review action.
16. The Operations page clearly states collection automatically extracts findings and organizes technologies. Checking old pages is optional maintenance when needed, not a compulsory step 2.
17. Batch review shows actual eligible target identities and exact action scope before confirming approximate calls; cancellation performs no mutation.
18. Pending library totals mean generation eligibility, not a fully supported investment recommendation or publication readiness.
19. Completed jobs, coverage limits, partial scoring, and failures have distinct labels.
20. A failure in supporting assessment/method fetches is visible while available narrative remains readable.

### Accessibility and export

21. No key meaning relies on hover, color, or a hidden help panel alone.
22. Keyboard users can filter, paginate, select findings, close/restore focus, inspect scores, and review targets.
23. Test 400px, 1,100px, 1,280px, and 1,440px widths. Primary conclusions/actions remain readable and no horizontal page overflow appears.
24. Executive and full-detail print choices preserve dates, limitations, source links, and readable page breaks; disclosure state is restored afterward.

### Short first-time-user demo

Ask a reviewer unfamiliar with the implementation to complete these tasks without coaching:

1. Find a funding development and explain why it appears before another finding.
2. Open Agentic AI and say which business areas have a placement, which do not, and whether the assessment has read the newest evidence.
3. Open AgenticOps's PoV and explain its recommendation, the difference between writing and assessment dates, and why an 8 does not establish TCL's right to play.
4. Find the source evidence and one measure that could not be scored.
5. Explain which Operations work happens automatically, which task they would review next, and what Check stored pages affects.
6. Return to the original filtered list without losing scope or review position.

Record hesitation, misunderstood labels, and wrong destinations. Use those observations to refine copy/layout before adding features. Do not invent measured usability results or arbitrary confidence scores.

## 15. What was verified and what remains for implementation

The review inspected live screens at desktop/laptop/mobile widths, opened the details view, visited the existing PoV and its assessment, checked current AgenticOps metadata, used funding filtering, and paginated through all 212 findings with no duplicate stored hit identities. It also read the current portal/API code and configuration to distinguish display issues from method/data limitations.

No production jobs, recomputation, configuration edits, application code changes, deployment, or model-consuming calls were performed. Recommendations, baseline screenshots, and this Markdown handoff are the only project deliverables.

Implementation validation should use existing Atlas tests for provenance/eligibility/query behavior, Lens lint/build, and manual real-data UX checks. Add meaningful regression checks for historical method use, partial/missing labels, selected batch scope, and pagination/state restoration. There is no need to introduce a frontend test framework solely for this visual/content iteration.

The default assumptions here are to retain current branding, existing route names, the current seven-day default, complete findings, and existing scoring/readiness behavior. New investor-impact ranking, curated technology definitions, or future PoV executive fields are separate product choices, not prerequisites for making these screens understandable.

The document is a recommendation, not approval to implement. Application changes and processing/deployment still require the user's permission.
