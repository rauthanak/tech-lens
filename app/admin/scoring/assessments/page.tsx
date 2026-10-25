"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import ConfirmAction from "@/components/ConfirmAction";
import OperationsTabs from "@/components/OperationsTabs";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { assessQuestion, assessSet, calls, runCalls } from "@/lib/actions";
import { errorText, fetchJson } from "@/lib/api";
import { formatAt, plural } from "@/lib/format";
import type { GateItem } from "@/lib/gates";
import { blockedReason, type Offer, stageWord, usePipeline } from "@/lib/pipeline";
import { useTechLabel } from "@/lib/tech-labels";

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

/** Gate 1's "ready to assess": the evidence verdict decides it, and the page
 *  floor only for technologies not classified yet (services/radar_status). */
type Ready = Offer;

export default function AssessmentsPage() {
  const p = usePipeline();
  const label = useTechLabel();
  const [runs, setRuns] = useState<ScoringRun[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [ready, setReady] = useState<Ready | null>(null);
  const [readyError, setReadyError] = useState<string | null>(null);
  const [floor, setFloor] = useState<number | null>(null);

  // the list, and what's ready, reload when the latest assessment run or a classification moves on
  const latest = p ? `${p.assess.scoring_run_id}:${p.assess.status}:${p.assess.techs_done}:${p.classify?.status}` : "";
  useEffect(() => {
    fetchJson<{ scoring_runs: ScoringRun[] }>("/api/scoring/runs")
      .then((d) => setRuns(d.scoring_runs))
      .catch(setError);
    fetchJson<{ gate1: GateItem[] }>("/api/gates")
      .then((g) => {
        const item = g.gate1.find((i) => i.kind === "ready_to_assess") as (GateItem & Offer) | undefined;
        setReady(item ?? { count: 0, calls: 0 });
        setReadyError(null);
      })
      .catch((e) => setReadyError(errorText(e)));
  }, [latest]);
  useEffect(() => {
    fetchJson<{ evidence_floor: number }>("/api/settings/radar").then((r) => setFloor(r.evidence_floor)).catch(() => {});
  }, []);

  const blocked = blockedReason(p, "assess");
  const toAssess = p?.for_analyst.find((i) => i.kind === "assess");

  return (
    <div>
      <OperationsTabs />
      <PageHeader title="Assessment runs"
        intro="Every assessment run: a batch of technologies scored together. Start one here."
        help={<>
          <li>An assessment scores a technology in each fabric it touches, on twelve measures from 0 to 10, using
            every page linked to it. It makes one model call for the technology and one for each fabric it touches
            (combined calls, set in Setup › Weights &amp; Grid); each button shows its estimate and asks before
            starting.</li>
          <li>Run one for the technologies ready to assess, or for those with new pages since their last assessment.
            Ready means its evidence was judged good enough, or a person confirmed it as possibly nascent (too new
            to have much evidence); a technology not judged yet is ready once it has enough pages (Setup ›
            Settings). Any one technology can also be assessed from its own page, or several from the Technologies
            list.</li>
          <li>A run uses the scoring method as it stands when it starts; edits made during a run wait for the next
            one.</li>
          <li>Each row shows the run&apos;s status, some of its technologies, how many are done and the model calls
            used. Click one for its results.</li>
        </>} />

      {error != null && <BackendError error={error} />}

      {toAssess && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-azure/30 bg-azure/5 px-5 py-3 text-sm">
          <span>{plural(toAssess.count, "technology has", "technologies have")} new pages since their assessment.</span>
          <ConfirmAction label="Assess them again" cost={calls(runCalls(toAssess))}
            question={assessQuestion(toAssess, "with new pages")}
            disabled={blocked} onConfirm={() => assessSet("new_evidence")} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-white px-5 py-4 text-sm">
        <div className="min-w-0 flex-1 basis-96">
          {readyError ? <p className="text-failed">What&apos;s ready to assess didn&apos;t load: {readyError}</p> : ready && (
            ready.count > 0 ? (
              <p>
                <Link href="/admin/technologies?view=not_assessed&status=ready" className="hover:underline">
                  {plural(ready.count, "technology is", "technologies are")} ready to assess →</Link>
              </p>
            ) : (
              <p>Nothing is ready to assess. The next collection may add some, or confirm possibly nascent ones on the
                Briefing.</p>
            )
          )}
          <p className="mt-0.5 text-xs text-muted">
            Ready means its evidence was judged good enough, or a person confirmed it as possibly nascent. A
            technology not judged yet is ready once it has {floor ? plural(floor, "page") : "enough pages"} (
            <Link href="/admin/sources/settings" className="text-link hover:underline">Settings</Link>).
          </p>
        </div>
        <ConfirmAction label={ready?.count === 1 ? "Assess it" : "Assess them"} cost={ready ? calls(runCalls(ready)) : undefined}
          question={assessQuestion(ready ?? { count: 0, calls: 0 }, "ready to assess", ": one for each technology and one for each fabric it touches")}
          disabled={blocked ?? (!ready?.count ? "Nothing is ready to assess." : null)}
          onConfirm={() => assessSet("ready")} />
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
              {/* named the same way as its own page: when, and how many */}
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{formatAt(r.started_at)} · {plural(r.progress.techs_total, "technology", "technologies")}</span>
                <span className="text-muted">{" "}({r.technologies.length <= 3
                  ? r.technologies.map((t) => label(t.name)).join(", ")
                  : `${r.technologies.slice(0, 3).map((t) => label(t.name)).join(", ")} and ${(r.technologies.length - 3).toLocaleString()} more`})</span>
              </span>
              <span className="text-xs tabular-nums text-neutral-600">
                {r.progress.techs_done} done · {plural(r.progress.llm_calls, "model call")}
                {r.finished_at ? ` · finished ${formatAt(r.finished_at)}` : ""}
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
