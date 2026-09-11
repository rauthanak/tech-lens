"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { formatTime } from "@/lib/format";

type ScoringRun = {
  _id: string;
  status: string;
  stage?: string;
  params: { top?: number; min_docs?: number; technologies?: string[] };
  technologies: { tech_id: string; name: string; doc_count: number }[];
  progress: { techs_total: number; techs_done: number; llm_calls: number };
  started_at: string;
  finished_at?: string;
  error?: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  running: "bg-amber-100 text-amber-900",
  terminating: "bg-amber-100 text-amber-900",
  completed: "bg-emerald-100 text-emerald-900",
  terminated: "bg-neutral-200 text-neutral-700",
  failed: "bg-red-100 text-red-900",
};

export default function AssessmentsPage() {
  const [runs, setRuns] = useState<ScoringRun[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [minDocs, setMinDocs] = useState("3");
  const [qualifying, setQualifying] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // live preview: how many technologies clear the evidence floor
  useEffect(() => {
    const n = Math.max(1, Number(minDocs) || 1);
    const t = setTimeout(() => {
      fetchJson<{ technologies: number }>(`/api/scoring/preview?min_docs=${n}`)
        .then((d) => setQualifying(d.technologies))
        .catch(() => setQualifying(null));
    }, 300);
    return () => clearTimeout(t);
  }, [minDocs]);

  const load = useCallback(
    () =>
      fetchJson<{ scoring_runs: ScoringRun[] }>("/api/scoring/runs")
        .then((d) => setRuns(d.scoring_runs))
        .catch(setError),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const running = runs?.some((r) => r.status === "running" || r.status === "terminating");
  useEffect(() => {
    if (running && !timer.current) timer.current = setInterval(load, 5000);
    if (!running && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [running, load]);

  async function start() {
    setNotice(null);
    try {
      await sendJson("/api/scoring/runs", "POST", {
        min_docs: Math.max(1, Number(minDocs) || 1),
      });
      setNotice("scoring run started");
      load();
    } catch (e) {
      setNotice(e instanceof ApiError ? (e.detail ?? e.message) : "failed to start");
    }
  }

  return (
    <div className="max-w-4xl">
      <p className="text-sm text-neutral-600">
        A scoring run assesses technologies from the register against the twelve
        measures, per relevant fabric, under a config snapshot frozen at start —
        edits made mid-run wait for the next run. Decoupled from scout runs:
        score whenever, on whatever the latest resolve produced.
      </p>

      {error != null && <BackendError error={error} />}

      <div className="mt-5 flex flex-wrap items-end gap-4 border border-neutral-200 bg-white px-5 py-4">
        <label className="text-sm">
          Min docs per tech
          <span className="ml-2 text-xs text-neutral-500">the evidence floor — every qualifying technology is scored</span>
          <input
            className="mt-1 block w-28 rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
            type="number" min="1" value={minDocs} onChange={(e) => setMinDocs(e.target.value)} />
        </label>
        <button
          onClick={start}
          disabled={running}
          className="bg-[#171513] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
        >
          {running ? "Run in progress…" : "Run scoring"}
        </button>
        {qualifying !== null && (
          <span className="pb-2 font-mono text-xs text-neutral-600">
            {qualifying} technolog{qualifying === 1 ? "y" : "ies"} qualify · ≈{(qualifying * 26).toLocaleString()} LLM calls (rough)
          </span>
        )}
        {notice && <span className="pb-2 font-mono text-xs text-[#7a3c1e]">{notice}</span>}
      </div>

      {runs && (
        <div className="mt-5 divide-y divide-neutral-100 border border-neutral-200 bg-white">
          {runs.map((r) => (
            <Link
              key={r._id}
              href={`/admin/scoring/assessments/${r._id}`}
              className="flex items-center gap-4 px-5 py-3 hover:bg-neutral-50"
            >
              <span className={`px-2 py-0.5 font-mono text-[11px] uppercase ${STATUS_STYLE[r.status] ?? "bg-neutral-100"}`}>
                {r.status}
              </span>
              {(r.status === "running" || r.status === "terminating") && r.stage && (
                <span className="font-mono text-[11px] text-[#7a3c1e]">{r.stage}</span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm">
                {r.technologies.length <= 3
                  ? r.technologies.map((t) => t.name).join(", ")
                  : `${r.technologies.slice(0, 3).map((t) => t.name).join(", ")} +${r.technologies.length - 3} more`}
              </span>
              <span className="font-mono text-xs tabular-nums text-neutral-600">
                {r.progress.techs_done}/{r.progress.techs_total} techs · {r.progress.llm_calls} calls
              </span>
              <span className="font-mono text-xs text-neutral-500">{formatTime(r.started_at)}</span>
            </Link>
          ))}
          {runs.length === 0 && (
            <p className="px-5 py-6 text-sm text-neutral-500">No scoring runs yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
