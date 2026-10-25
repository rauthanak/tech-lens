# Implementation plan v1, 23 Oct 2026: portal side

The full plan, with the reasons, measurements, order of work, checks and the decisions needed, is the master in tech-atlas: [tech-atlas/docs/2026-10-23/implementation-plan/v1/implementation-plan.md](../../../../../tech-atlas/docs/2026-10-23/implementation-plan/v1/implementation-plan.md). This file only lists the portal files each section touches, so the plan isn't written twice.

| Master § | What | Portal files |
|---|---|---|
| 1 | Classify finished in parts, said plainly | `components/RunSteps.tsx`, Operations History |
| 2 | Skipped pages shown with reasons | `app/admin/runs/[id]/page.tsx`, `app/admin/runs/[id]/sources/[sid]/page.tsx` |
| 3 | Signs to watch: what a threshold is, labelled layout, edit and overrule (kept in assessments; a person's change is a decision) | `components/CrossedSigns.tsx`, `components/FabricAssessment.tsx`, `components/PovText.tsx` |
| 4 | Shorter Briefing | `app/admin/page.tsx`, `components/GateList.tsx` |
| 5 | Pages of 50: `usePaged`, `useClientPage`, `<Pager>` | new `lib/paging.ts` and `components/Pager.tsx`; Technologies, Briefing, technology Pages, run-source pages, Points of View, History, Assessment run, Set aside, Suggestions, Import, Changes |
| 6 | One kind of filter | `app/admin/technologies/page.tsx` split into `TechFilters.tsx`, `TechRow.tsx`, `TechBulkBar.tsx`; new `components/FilterChips.tsx`; Points of View, Setup › Sources |
| 7 | Technology Overview in two columns | `app/admin/technologies/[id]/page.tsx`, `components/TechAnswers.tsx`, `WaitingOnYou.tsx`, `LookFor.tsx`, `PageHeader.tsx` |
| 8 | Operations › History tab | `app/admin/operations/page.tsx`, new `app/admin/operations/history/page.tsx`, `components/OperationsTabs.tsx` |
| 9 | Path to scale: dropped (23 Oct) | none |
| 10 | Don Norman items A–F | listed per item in the master |
| 11 | Speed and memory: memoised rows, hidden-tab pause, shared hooks and stores, leaders' grid memo, splitting large files | `lib/pipeline.ts`, `lib/changes.ts`, `lib/findEvidence.ts`, `components/frontier/Grid.tsx`, `components/frontier/items.ts`, `app/frontier/page.tsx`, new `lib/run-states.ts` |

Checks for the portal: `npx tsc --noEmit`, `npx eslint`, walks in `docs/2026-10-20/1/checks/` (new `plan10-phaseN.py` and `perf.py`) at 1440 and 400 px.
