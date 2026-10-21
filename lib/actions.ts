"use client";

import { fetchJson, sendJson } from "@/lib/api";
import { plural } from "@/lib/format";
import { refreshPipeline } from "@/lib/pipeline";

// The actions that start work, each written once: every button that starts
// one shows its cost first (ConfirmAction) and refreshes the pipeline after.

export type RunsPreview = { websites: number; data_sources: number; pages_per_source: number };

export const fetchRunsPreview = () => fetchJson<RunsPreview>("/api/runs/preview");

/** "about 216 model calls" */
export const calls = (n: number) => `about ${plural(n, "model call")}`;

export const collectQuestion = (v: RunsPreview | null) =>
  "Start a collection? " +
  (v ? `Up to ${v.pages_per_source} pages from each of ${plural(v.websites, "website")}` +
    (v.data_sources ? `, plus the saved searches of ${plural(v.data_sources, "data source")}` : "") + ". " : "") +
  "Each new or changed page uses at least one model call.";

export async function startCollection(): Promise<string> {
  const run = await sendJson<{ id: string }>("/api/runs", "POST", {});
  await refreshPipeline();
  return run.id;
}

export async function startCheck(): Promise<void> {
  await sendJson("/api/signals/recheck", "POST");
  await refreshPipeline();
}

export async function startAssessment(techIds: string[]): Promise<string> {
  const run = await sendJson<{ scoring_run_id: string }>("/api/scoring/runs", "POST", { technologies: techIds });
  await refreshPipeline();
  return run.scoring_run_id;
}

export async function resumeAssessment(runId: string): Promise<void> {
  await sendJson(`/api/scoring/runs/${runId}/resume`, "POST");
  await refreshPipeline();
}

/** Write the Points of View that are waiting, or rewrite every one. */
export async function writePovs(recompose = false): Promise<void> {
  await sendJson("/api/scoring/povs/compose_all", "POST", { recompose });
  await refreshPipeline();
}

export async function organizeTechnologies(): Promise<void> {
  await sendJson("/api/technologies/resolve", "POST", {});
  await refreshPipeline();
}

/** Classify technologies: these, or every one with new pages. */
export async function startClassify(techIds: string[] | null): Promise<string> {
  const run = await sendJson<{ run_id: string }>("/api/classify", "POST",
    techIds ? { tech_ids: techIds } : { all_pending: true });
  await refreshPipeline();
  return run.run_id;
}
