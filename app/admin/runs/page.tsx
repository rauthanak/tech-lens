"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { duration, formatTime, STATUS_STYLES } from "@/lib/format";

type RunRow = {
  id: string;
  status: string;
  stage?: string;
  run_start_date_time: string;
  run_end_date_time: string | null;
  error: string | null;
  totals: { sources: number; pages_visited: number; documents: number; new_documents: number };
};

const REFRESH_MS = 10000; // silent lazy refresh, table only

export default function RunsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const load = useCallback((silent = false) => {
    fetchJson<{ runs: RunRow[] }>("/api/runs")
      .then((d) => {
        setRuns(d.runs);
        setError(null);
        setRefreshedAt(new Date());
      })
      .catch((e) => {
        if (!silent) setError(e);
      });
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // one run at a time — mirror the backend's 409 guard in the UI
  const active = runs?.some((r) => r.status === "running" || r.status === "terminating") ?? false;

  async function startRun() {
    setStarting(true);
    setStartError(null);
    try {
      await sendJson("/api/runs", "POST", {});
      load(true);
    } catch (e) {
      setStartError(e instanceof ApiError ? (e.detail ?? e.message) : "failed to start");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Runs"
        title="Radar runs"
        right={
          <button
            onClick={startRun}
            disabled={starting || active}
            title={active ? "a run is already in progress" : undefined}
            className="bg-[#171513] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {active ? "Run in progress…" : starting ? "Starting…" : "Start run"}
          </button>
        }
      >
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          Each run sends supervisors and scouts across the source register.
          Click a run for its per-source detail.
        </p>
      </PageHeader>

      {error != null && <BackendError error={error} />}
      {startError && (
        <p className="mt-4 text-sm text-[#7a3c1e]">Could not start: {startError}</p>
      )}

      {runs && (
        <>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => load()}
              title="Refresh"
              className="border border-neutral-300 bg-white px-2.5 py-1.5 text-sm hover:bg-neutral-100"
            >
              ⟳
            </button>
            <span className="font-mono text-xs text-neutral-500">
              last refreshed {refreshedAt ? formatTime(refreshedAt.toISOString()) : "—"}
            </span>
          </div>

          <div className="mt-3 overflow-x-auto border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-2.5 font-medium">Run</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Started</th>
                  <th className="px-4 py-2.5 font-medium">Ended</th>
                  <th className="px-4 py-2.5 font-medium">Duration</th>
                  <th className="px-4 py-2.5 font-medium">Sources</th>
                  <th className="px-4 py-2.5 font-medium">Docs (new)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-neutral-500">
                      No runs yet — start one.
                    </td>
                  </tr>
                )}
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/admin/runs/${r.id}`)}
                    className="cursor-pointer hover:bg-neutral-50"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">{r.id}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 font-mono text-[11px] uppercase ${STATUS_STYLES[r.status] ?? "bg-neutral-100"}`}
                      >
                        {r.status}
                      </span>
                      {(r.status === "running" || r.status === "terminating") && r.stage && (
                        <span className="ml-2 font-mono text-[11px] text-[#7a3c1e]">{r.stage}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{formatTime(r.run_start_date_time)}</td>
                    <td className="px-4 py-2.5">{formatTime(r.run_end_date_time)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {duration(r.run_start_date_time, r.run_end_date_time)}
                    </td>
                    <td className="px-4 py-2.5">{r.totals?.sources ?? 0}</td>
                    <td className="px-4 py-2.5">
                      {r.totals?.documents ?? 0}
                      <span className="text-neutral-500"> ({r.totals?.new_documents ?? 0})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
