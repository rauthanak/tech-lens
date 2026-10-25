"use client";

import { useSyncExternalStore } from "react";
import { fetchJson } from "@/lib/api";
import { hidden } from "@/lib/visible";

// GET /api/pipeline, polled once for every reader: every 5 s while anything
// runs, every 30 s otherwise, and again when the window regains focus. After
// any action, call refreshPipeline(). Also the plain-words names the portal
// shows for backend stage values: backend values never change; this one
// table maps them.

export type Job = { id: string; status: string; done: number; total: number; stage?: string };

/** Pages that couldn't be analysed, grouped by reason. */
export type FailureGroup = { reason: string; detail: string; pages: number; sources: string[] };

/** A set the radar offers to assess (services/tech_status.offer): its size and cost, never its ids, which grow
 *  with the radar. `run`: more than one run takes, so this is what the first run takes. */
export type Offer = { count: number; calls: number; calls_max?: number; run?: { count: number; calls: number } };

/** What is waiting for the analyst, in process order (at most three). */
export type AnalystItem =
  | { kind: "check"; count: number; calls: number }
  | { kind: "resume"; scoring_run_id: string; started_at: string; count: number; calls: number }
  | ({ kind: "assess" } & Offer)
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
  technologies: { count: number; resolve_status: string | null; resolved_at: string | null;
    new_names?: number | null }; // how many new names the last Organize looked at
  classify?: { status: string; pending: number; run_id?: string; done?: number; total?: number; finished_at?: string | null;
    stopped_reason?: string | null; failed?: number; error?: string | null;
    unchanged?: number }; // of `done`, how many the last run found nothing new for
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
  linking?: { status: string; stage?: string; done?: number; total?: number }; // Link known names, the latest run
  problems: number;
  for_analyst: AnalystItem[];
};

export const STAGE_WORDS: Record<string, string> = {
  starting: "Starting",
  orchestrating: "Planning",
  crawling: "Collecting",
  resolving: "Organizing technologies",
  linking: "Linking known names",
  classifying: "Classifying technologies",
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
    p.technologies.resolve_status === "running" || p.linking?.status === "running");

let current: Pipeline | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let last = 0;                  // when it was last asked
let inFlight: Promise<void> | null = null;
const SOON_MS = 5000;          // a focus or a return to the tab within this of the last ask doesn't ask again

/** Fetch now, tell every reader, and schedule the next poll. A tab in the
 *  background schedules nothing; it asks again when it's shown. */
export function refreshPipeline(): Promise<void> {
  clearTimeout(timer);
  if (inFlight) return inFlight; // one request at a time, shared by every caller
  last = Date.now();
  inFlight = fetchJson<Pipeline>("/api/pipeline")
    .then((p) => { current = p; })
    .catch(() => {}) // keep the last good state; the next poll retries
    .finally(() => {
      inFlight = null;
      listeners.forEach((listener) => listener());
      timer = listeners.size && !hidden() ? setTimeout(poll, anyLive(current) ? 5000 : 30000) : undefined;
    });
  return inFlight;
}

/** The scheduled poll: a tab hidden since it was scheduled asks nothing (it asks when shown). */
function poll() {
  if (hidden()) { timer = undefined; return; }
  refreshPipeline();
}

/** Back on the page (focus, or the tab shown again): ask, unless it just did. */
function back() {
  if (!hidden() && Date.now() - last > SOON_MS) refreshPipeline();
  else if (!hidden() && !timer) refreshPipeline();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (listeners.size === 1) {
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", back);
    refreshPipeline();
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      clearTimeout(timer);
      timer = undefined;
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", back);
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
