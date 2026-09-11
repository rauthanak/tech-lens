"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { formatTime } from "@/lib/format";

type PovRow = {
  _id: string;
  scoring_run_id: string;
  tech_id: string;
  technology: string;
  version: number;
  composed_at: string;
  sections?: { headline?: string };
};

type Uncomposed = {
  scoring_run_id: string;
  tech_id: string;
  technology: string;
  run_started_at: string;
};

type Job = {
  _id: string;
  status: "running" | "completed" | "failed" | "interrupted";
  recompose?: boolean;
  total: number;
  done: number;
  current: string[];
  failed: { tech_id: string; scoring_run_id: string; error: string }[];
  started_at: string;
  finished_at?: string;
} | null;

export default function PovListPage() {
  const [povs, setPovs] = useState<PovRow[] | null>(null);
  const [uncomposed, setUncomposed] = useState<Uncomposed[]>([]);
  const [job, setJob] = useState<Job>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // tech_ids being composed by a click on this page (separate from the job)
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    () =>
      fetchJson<{ povs: PovRow[]; uncomposed: Uncomposed[]; job: Job }>("/api/scoring/povs")
        .then((d) => {
          setPovs(d.povs);
          setUncomposed(d.uncomposed);
          setJob(d.job);
          setError(null);
        })
        .catch(setError),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  // keep refreshing while a compose-all job runs or a row compose is in flight
  const jobRunning = job?.status === "running";
  const busy = jobRunning || inFlight.size > 0;
  useEffect(() => {
    if (busy && !timer.current) timer.current = setInterval(load, 5000);
    if (!busy && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [busy, load]);

  async function composeOne(u: Uncomposed) {
    setNotice(null);
    setInFlight((prev) => new Set(prev).add(u.tech_id));
    try {
      await sendJson(`/api/scoring/runs/${u.scoring_run_id}/pov/${u.tech_id}`, "POST", {});
      await load();
    } catch (e) {
      setNotice(
        `${u.technology}: ${e instanceof ApiError ? (e.detail ?? e.message) : "compose failed"}`,
      );
    } finally {
      setInFlight((prev) => {
        const next = new Set(prev);
        next.delete(u.tech_id);
        return next;
      });
    }
  }

  async function composeAll(recompose: boolean) {
    setNotice(null);
    if (recompose) {
      const n = (povs?.length ?? 0) + uncomposed.length;
      if (!window.confirm(`Recompose all ${n} PoVs? One LLM call each — existing documents are replaced (version bumps).`))
        return;
    }
    try {
      await sendJson("/api/scoring/povs/compose_all", "POST", { recompose });
      await load();
    } catch (e) {
      setNotice(e instanceof ApiError ? (e.detail ?? e.message) : "failed to start");
    }
  }

  const failedIds = new Set((job?.failed ?? []).map((f) => f.tech_id));

  function rowState(u: Uncomposed): "composing" | "queued" | "failed" | "idle" {
    if (inFlight.has(u.tech_id) || (jobRunning && job!.current.includes(u.tech_id)))
      return "composing";
    if (jobRunning) return failedIds.has(u.tech_id) ? "failed" : "queued";
    return failedIds.has(u.tech_id) ? "failed" : "idle";
  }

  return (
    <div className="max-w-4xl">
      <p className="text-sm text-neutral-600">
        The deliverable — one Point of View per technology, in the client&apos;s
        house format, every number traceable back to its assessment and its
        source documents. Composed on demand; the scores never move.
      </p>

      {error != null && <BackendError error={error} />}
      {notice && <p className="mt-3 font-mono text-xs text-red-800">{notice}</p>}

      {job && (jobRunning || (job.failed?.length ?? 0) > 0 || job.status === "interrupted") && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border border-neutral-200 bg-white px-5 py-3">
          {jobRunning ? (
            <span className="animate-pulse bg-amber-100 px-2 py-0.5 font-mono text-[11px] uppercase text-amber-900">
              composing
            </span>
          ) : (
            <span className="bg-neutral-200 px-2 py-0.5 font-mono text-[11px] uppercase text-neutral-700">
              {job.status}
            </span>
          )}
          <span className="font-mono text-xs tabular-nums text-neutral-600">
            {job.done}/{job.total} PoVs
            {(job.failed?.length ?? 0) > 0 && (
              <span className="text-red-800"> · {job.failed.length} failed</span>
            )}
          </span>
          {jobRunning && job.current.length > 0 && (
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#7a3c1e]">
              {job.current.join(", ")}
            </span>
          )}
        </div>
      )}

      {(uncomposed.length > 0 || (povs?.length ?? 0) > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {uncomposed.length > 0 && (
            <button
              onClick={() => composeAll(false)}
              disabled={jobRunning}
              className="bg-[#171513] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
            >
              {jobRunning ? "Composing…" : `Compose pending (${uncomposed.length})`}
            </button>
          )}
          {(povs?.length ?? 0) > 0 && (
            <button
              onClick={() => composeAll(true)}
              disabled={jobRunning}
              className="border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50"
            >
              Recompose all ({(povs?.length ?? 0) + uncomposed.length})
            </button>
          )}
        </div>
      )}

      {povs && (
        <div className="mt-5 space-y-3">
          {povs.map((p) => (
            <Link
              key={p._id}
              href={`/admin/scoring/pov/${p.scoring_run_id}/${p.tech_id}`}
              className="block border border-neutral-200 bg-white px-5 py-4 hover:border-neutral-400"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-[17px] font-semibold">{p.technology}</span>
                <span className="font-mono text-xs text-neutral-500">
                  v{p.version} · composed {formatTime(p.composed_at)} · run {p.scoring_run_id}
                </span>
                {jobRunning && job!.current.includes(p.tech_id) ? (
                  <span className="ml-auto animate-pulse bg-amber-100 px-2 py-0.5 font-mono text-[11px] uppercase text-amber-900">
                    recomposing…
                  </span>
                ) : failedIds.has(p.tech_id) ? (
                  <span className="ml-auto font-mono text-xs text-red-800">recompose failed</span>
                ) : jobRunning && job!.recompose && p.composed_at < job!.started_at ? (
                  <span className="ml-auto bg-neutral-100 px-2 py-0.5 font-mono text-[11px] uppercase text-neutral-500">
                    queued
                  </span>
                ) : (
                  <span className="ml-auto font-mono text-xs text-emerald-700">✓ composed</span>
                )}
              </div>
              {p.sections?.headline && (
                <p className="mt-1.5 border-l-2 border-[#8a4b2d]/40 pl-3 text-sm leading-relaxed text-neutral-700">
                  {p.sections.headline}
                </p>
              )}
            </Link>
          ))}
          {povs.length === 0 && (
            <p className="border border-neutral-200 bg-white px-5 py-6 text-sm text-neutral-500">
              No PoVs composed yet.
            </p>
          )}
        </div>
      )}

      {uncomposed.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-semibold">Assessed, not yet composed</h2>
          <p className="mt-1 text-sm text-neutral-600">
            These technologies have scored assessments — compose them one at a
            time, or use Compose pending above ({uncomposed.length} LLM calls).
          </p>
          <div className="mt-3 divide-y divide-neutral-100 border border-neutral-200 bg-white">
            {uncomposed.map((u) => {
              const state = rowState(u);
              return (
                <div
                  key={`${u.scoring_run_id}-${u.tech_id}`}
                  className="flex items-baseline gap-3 px-5 py-3"
                >
                  <span className="font-medium">{u.technology}</span>
                  <span className="font-mono text-xs text-neutral-500">
                    run {u.scoring_run_id} · {formatTime(u.run_started_at)}
                  </span>
                  <span className="ml-auto">
                    {state === "composing" && (
                      <span className="animate-pulse bg-amber-100 px-2 py-0.5 font-mono text-[11px] uppercase text-amber-900">
                        composing…
                      </span>
                    )}
                    {state === "queued" && (
                      <span className="bg-neutral-100 px-2 py-0.5 font-mono text-[11px] uppercase text-neutral-500">
                        queued
                      </span>
                    )}
                    {(state === "idle" || state === "failed") && (
                      <button
                        onClick={() => composeOne(u)}
                        className={`font-mono text-xs hover:underline ${
                          state === "failed" ? "text-red-800" : "text-[var(--accent)]"
                        }`}
                      >
                        {state === "failed" ? "failed — retry →" : "compose →"}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
