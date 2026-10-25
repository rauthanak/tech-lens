"use client";

// Find evidence (the API's find-evidence jobs): start one for a gap, follow
// it until it says what came of it, and read a technology's past jobs.

import { useEffect, useState } from "react";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { whenVisible } from "@/lib/visible";

export type Gap = {
  kind: "technology" | "measure" | "use_case" | "link" | "links";
  tech_id: string;
  fabric_id?: string | null;
  measure_id?: string | null;
  url?: string;
  target?: "technology" | "measure" | "use_case";
  urls?: string[]; // Add evidence: the links a person gave
  through?: "judge" | "pov"; // Add evidence: stop once its evidence is judged, or go on to the Point of View
  assess_anyway?: boolean;
};

/** One address a job found: filed under the technology, already collected,
 *  set aside by a Can ignore rule (`rule`, and what it sets aside in
 *  `reason`), or not read (`reason` says why); "new" while it's being read. */
export type JobResult = { url: string; title: string | null; status: "new" | "already" | "filed" | "set_aside" | "failed";
  rule?: string; reason?: string | null };

export type Job = {
  _id: string;
  gap: Gap;
  at: string;
  tz?: string | null;
  status: "running" | "completed" | "failed";
  stage?: string;
  query?: string | null;
  searched?: boolean;
  summary?: string;
  error?: string;
  results: JobResult[];
};

export type Preview = { configured: boolean; query: string | null; searches: number; page_reads: number; reruns: number;
  budget: { used: number; limit: number }; why_not: string | null };

const STAGES: Record<string, string> = { reading: "Reading the pages found…", "re-running": "Running the gap's call again…",
  assessing: "Assessing it…", writing: "Writing its Point of View…" };
export const stageWords = (j: Job | null) =>
  (j?.stage && STAGES[j.stage]) || (j?.searched === false ? "Reading the page…" : "Searching…");

export const startJob = (gap: Gap) => sendJson<{ job_id: string }>("/api/find-evidence", "POST", { gap });

/** A job, polled every 3 seconds until it ends; `onDone` runs once when it does. */
export function useJob(jobId: string | null, onDone?: () => void): Job | null {
  const [job, setJob] = useState<Job | null>(null);
  useEffect(() => {
    if (!jobId) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopWait = () => {}; // a hidden tab waits to be shown before it asks again
    const tick = () => fetchJson<Job>(`/api/find-evidence/${jobId}`).then((j) => {
      if (!live) return;
      setJob(j);
      if (j.status === "running") timer = setTimeout(() => { stopWait = whenVisible(tick); }, 3000);
      else {
        onDone?.();
        window.dispatchEvent(new CustomEvent(ENDED, { detail: j.gap.tech_id }));
      }
    }).catch(() => { if (live) timer = setTimeout(() => { stopWait = whenVisible(tick); }, 5000); });
    tick();
    return () => { live = false; clearTimeout(timer); stopWait(); }; // no fetch after leaving the page
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps
  return job;
}

const ENDED = "find-evidence-ended"; // a job ended: the technology's past jobs are read again
const inFlight = new Map<string, Promise<Job[]>>(); // one request per technology, however many gaps show

/** A technology's past jobs, newest first, each as it reads now (GET
 *  /find-evidence?tech_id); read again whenever one of its jobs ends. */
export function usePastJobs(techId: string): { jobs: Job[] | null; error: string | null } {
  const [state, setState] = useState<{ jobs: Job[] | null; error: string | null }>({ jobs: null, error: null });
  useEffect(() => {
    let live = true;
    const load = () => {
      let p = inFlight.get(techId);
      if (!p) {
        p = fetchJson<{ jobs: Job[] }>(`/api/find-evidence?tech_id=${encodeURIComponent(techId)}`)
          .then((r) => r.jobs).finally(() => inFlight.delete(techId));
        inFlight.set(techId, p);
      }
      p.then((jobs) => { if (live) setState({ jobs, error: null }); })
        .catch((e) => { if (live) setState((s) => ({ ...s, error: errorText(e) })); });
    };
    const ended = (e: Event) => { if ((e as CustomEvent<string>).detail === techId) load(); };
    load();
    window.addEventListener(ENDED, ended);
    return () => { live = false; window.removeEventListener(ENDED, ended); };
  }, [techId]);
  return state;
}

/** Whether a past job was for this gap: on the technology itself, every one
 *  of its jobs; on a measure or a fabric's use cases, those for it alone
 *  (a pasted link included). */
export function forGap(job: Job, gap: Omit<Gap, "url">): boolean {
  if (gap.kind === "technology") return true;
  const g = job.gap;
  if ((g.fabric_id ?? null) !== (gap.fabric_id ?? null)) return false;
  if (gap.kind === "measure") return g.measure_id === gap.measure_id;
  return !g.measure_id && (g.kind === "use_case" || g.target === "use_case");
}
