"use client";

import { useSyncExternalStore } from "react";
import { fetchJson } from "@/lib/api";

// GET /api/pipeline, polled once for every reader: every 5 s while anything
// runs, every 30 s otherwise, and again when the window regains focus. After
// any action, call refreshPipeline(). Also the plain-words names the portal
// shows for backend stage values: backend values never change; this one
// table maps them.

export type Job = { id: string; status: string; done: number; total: number; stage?: string };

/** Pages that couldn't be analysed, grouped by reason. */
export type FailureGroup = { reason: string; detail: string; pages: number; sources: string[] };

/** What is waiting for the analyst, in process order (at most three). */
export type AnalystItem =
  | { kind: "check"; count: number; calls: number }
  | { kind: "resume"; scoring_run_id: string; started_at: string; count: number; calls: number }
  | { kind: "assess"; count: number; calls: number; calls_max: number; tech_ids: string[] }
  | { kind: "write"; count: number; calls: number };

export type Pipeline = {
  collect: {
    status: string; // none | running | terminating | completed | terminated
    run_id?: string;
    stage?: string;
    error?: string | null;
    started_at?: string;
    finished_at?: string | null;
    sources?: number;
    pages?: number;
    documents?: number;
    new_documents?: number;
    incomplete?: number;
    errors?: number;
    analysis_errors?: FailureGroup[];
  };
  signals: {
    never_miss: number;
    other: number;
    set_aside: number;
    stale_pages: number;
    recheck: (Job & { found: number; other: number; set_aside: number;
      failed_reasons: Record<string, number> }) | null;
  };
  technologies: { count: number; resolve_status: string | null; resolved_at: string | null };
  assess: {
    status: string; // none | running | terminating | completed | failed | terminated
    techs_with_new_evidence: number;
    scoring_run_id?: string;
    started_at?: string;
    finished_at?: string | null;
    techs_done?: number;
    techs_total?: number;
    skipped?: number;
  };
  pov: { composed: number; pending: number; job: (Job & { failed: number }) | null };
  problems: number;
  for_analyst: AnalystItem[];
};

export const STAGE_WORDS: Record<string, string> = {
  starting: "Starting",
  orchestrating: "Planning",
  crawling: "Collecting",
  resolving: "Organizing technologies",
  done: "Done",
  preparing: "Preparing",
  scoring: "Assessing",
};

export const stageWord = (stage?: string | null) =>
  stage ? (STAGE_WORDS[stage] ?? stage) : "";

export const isLive = (status?: string | null) => status === "running" || status === "terminating";

/** Anything running right now, in any step. */
export const anyLive = (p: Pipeline | null) =>
  !!p && (isLive(p.collect.status) || p.signals.recheck?.status === "running" ||
    isLive(p.assess.status) || p.pov.job?.status === "running" ||
    p.technologies.resolve_status === "running");

let current: Pipeline | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

/** Fetch now, tell every reader, and schedule the next poll. */
export function refreshPipeline(): Promise<void> {
  clearTimeout(timer);
  return fetchJson<Pipeline>("/api/pipeline")
    .then((p) => { current = p; })
    .catch(() => {}) // keep the last good state; the next poll retries
    .finally(() => {
      listeners.forEach((listener) => listener());
      if (listeners.size) timer = setTimeout(refreshPipeline, anyLive(current) ? 5000 : 30000);
    });
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (listeners.size === 1) {
    window.addEventListener("focus", refreshPipeline);
    refreshPipeline();
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      clearTimeout(timer);
      window.removeEventListener("focus", refreshPipeline);
    }
  };
}

/** The pipeline, shared by every reader on the page; null until it loads. */
export function usePipeline(): Pipeline | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Why a job can't start now, mirroring the backend's 409 rules, or null. */
export function blockedReason(p: Pipeline | null, job: "collect" | "recheck" | "assess"): string | null {
  if (!p) return null;
  const checking = p.signals.recheck?.status === "running";
  if (job === "collect") {
    if (isLive(p.collect.status)) return "A collection run is in progress.";
    if (checking) return "A check of stored pages is in progress.";
  }
  if (job === "recheck") {
    if (isLive(p.collect.status)) return "A collection run is in progress.";
    if (isLive(p.assess.status)) return "An assessment run is in progress.";
    if (checking) return "A check of stored pages is in progress.";
    if (p.signals.stale_pages === 0) return "Nothing to check again.";
  }
  if (job === "assess") {
    if (isLive(p.assess.status)) return "An assessment run is in progress.";
    if (checking) return "A check of stored pages is in progress.";
  }
  return null;
}
