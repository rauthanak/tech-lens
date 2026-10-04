"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import ConfirmAction from "@/components/ConfirmAction";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { calls, startAssessment } from "@/lib/actions";
import { fetchJson, sendJson } from "@/lib/api";
import { formatTime, plural } from "@/lib/format";
import { blockedReason, refreshPipeline, stageWord, usePipeline } from "@/lib/pipeline";

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

type Preview = { technologies: number; calls: number; calls_max: number };

export default function AssessmentsPage() {
  const p = usePipeline();
  const [runs, setRuns] = useState<ScoringRun[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [minDocs, setMinDocs] = useState("3");
  const [preview, setPreview] = useState<Preview | null>(null);
  const floor = Math.max(1, Number(minDocs) || 1);

  // live preview: how many technologies clear the floor, and about what it costs
  useEffect(() => {
    const t = setTimeout(() => {
      fetchJson<Preview>(`/api/scoring/preview?min_docs=${floor}`).then(setPreview).catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(t);
  }, [floor]);

  // the list reloads when the latest assessment run moves on
  const latest = p ? `${p.assess.scoring_run_id}:${p.assess.status}:${p.assess.techs_done}` : "";
  useEffect(() => {
    fetchJson<{ scoring_runs: ScoringRun[] }>("/api/scoring/runs")
      .then((d) => setRuns(d.scoring_runs))
      .catch(setError);
  }, [latest]);

  async function start() {
    await sendJson("/api/scoring/runs", "POST", { min_docs: floor });
    await refreshPipeline();
  }

  const blocked = blockedReason(p, "assess");
  const toAssess = p?.for_analyst.find((i) => i.kind === "assess");

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Assessment runs"
        intro="Every assessment run: a batch of technologies scored together. Start one here."
        help={<>
          <li>An assessment scores a technology in each fabric it touches, on twelve measures from 0 to 10, using
            every page linked to it. It costs about 14 to 50 model calls per technology, depending on how many
            fabrics it touches; each button shows its estimate and asks before starting.</li>
          <li>Run one for every technology with at least a given number of pages, or assess the technologies that
            have new pages since their last assessment. One technology can also be assessed from its own
            page.</li>
          <li>A run uses the scoring method as it stands when it starts; edits made during a run wait for the next
            one.</li>
          <li>Each row shows the run&apos;s status, some of its technologies, how many are done and the model calls
            used. Click one for its results.</li>
        </>} />

      {error != null && <BackendError error={error} />}

      {toAssess && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-azure/30 bg-azure/5 px-5 py-3 text-sm">
          <span>{plural(toAssess.count, "technology has", "technologies have")} new pages since their assessment.</span>
          <ConfirmAction label="Assess them" cost={calls(toAssess.calls)}
            question={`Assess ${plural(toAssess.count, "technology", "technologies")} with new pages? About ${plural(toAssess.calls, "model call")} (up to ${toAssess.calls_max}).`}
            disabled={blocked} onConfirm={() => startAssessment(toAssess.tech_ids)} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-end gap-4 rounded-card border border-line bg-white px-5 py-4">
        <label className="text-sm">
          Pages per technology, at least
          <span className="ml-2 text-xs text-neutral-500">every technology with that many is assessed</span>
          <input
            className="mt-1 block w-28 rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
            type="number" min="1" value={minDocs} onChange={(e) => setMinDocs(e.target.value)} />
        </label>
        <ConfirmAction label="Run assessment" cost={preview ? calls(preview.calls) : undefined}
          question={preview
            ? `Assess ${plural(preview.technologies, "technology", "technologies")} with at least ${plural(floor, "page")}? About ${plural(preview.calls, "model call")} (up to ${preview.calls_max}).`
            : "Start an assessment run?"}
          disabled={blocked ?? (preview?.technologies === 0 ? "No technology has that many pages." : null)}
          onConfirm={start} />
        {preview && (
          <span className="pb-2 text-xs text-neutral-600">
            {plural(preview.technologies, "technology qualifies", "technologies qualify")} · {calls(preview.calls)} (up to {preview.calls_max})
          </span>
        )}
      </div>

      {runs && (
        <div className="mt-5 divide-y divide-neutral-100 overflow-hidden rounded-card border border-line bg-white">
          {runs.map((r) => (
            <Link
              key={r._id}
              href={`/admin/scoring/assessments/${r._id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-neutral-50"
            >
              <StatusChip status={r.status} />
              {(r.status === "running" || r.status === "terminating") && r.stage && (
                <span className="font-mono text-[11px]">{stageWord(r.stage)}</span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm">
                {r.technologies.length <= 3
                  ? r.technologies.map((t) => t.name).join(", ")
                  : `${r.technologies.slice(0, 3).map((t) => t.name).join(", ")} +${r.technologies.length - 3} more`}
              </span>
              <span className="text-xs tabular-nums text-neutral-600">
                {r.progress.techs_done} of {plural(r.progress.techs_total, "technology", "technologies")} ·{" "}
                {plural(r.progress.llm_calls, "model call")}
                {r.finished_at ? ` · finished ${formatTime(r.finished_at)}` : ` · started ${formatTime(r.started_at)}`}
              </span>
            </Link>
          ))}
          {runs.length === 0 && (
            <p className="px-5 py-6 text-sm text-neutral-500">No assessment runs yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
