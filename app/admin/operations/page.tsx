"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConfirmAction from "@/components/ConfirmAction";
import Hood from "@/components/Hood";
import PageHeader from "@/components/PageHeader";
import ProcessBoard from "@/components/ProcessBoard";
import ServiceHealth from "@/components/ServiceHealth";
import StatusChip from "@/components/StatusChip";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import { calls, resumeAssessment, startCheck, writePovs } from "@/lib/actions";
import { fetchJson } from "@/lib/api";
import { formatTime, plural } from "@/lib/format";
import { blockedReason, usePipeline } from "@/lib/pipeline";

type Problem = {
  kind: "didnt_finish" | "too_broad" | "not_configured" | "source_error" | "failed_pages" | "job_failed"; // didnt_finish: coverage
  source_id?: string;
  source_name?: string;
  run_id?: string;
  note?: string;
  error?: string | null;
  keys?: string[];
  count?: number;
  reasons?: { reason: string; detail: string; pages: number }[];
  pages?: { doc_id: string; title: string | null; url: string; source_id: string; reason: string; detail: string }[];
  job?: "collection" | "check" | "assessment" | "pov";
  id?: string;
  status?: string;
};

const JOB_WORDS = { collection: "collection", check: "check of stored pages", assessment: "assessment run",
  pov: "Point of View job" };
const fixLink = "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-ground";
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s);
// old collections said "page budget reached: 120 links not visited"; new ones "didn't finish: 120 links left"
const linksLeft = (note = "") => note.match(/\d[\d,]*/)?.[0] ?? "some";

function Row({ children, fix }: { children: React.ReactNode; fix?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 text-sm text-ink">{children}</div>
      {fix && <div className="shrink-0">{fix}</div>}
    </li>
  );
}

/** What went wrong in the latest work, each with the fix, then coverage:
 *  websites that reached their page limit, which isn't a problem (GET /api/problems). */
function Problems() {
  const p = usePipeline();
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [coverage, setCoverage] = useState<Problem[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    fetchJson<{ problems: Problem[]; coverage: Problem[] }>("/api/problems")
      .then((d) => { setProblems(d.problems); setCoverage(d.coverage); }).catch(() => {});
  }, [p]);
  if (!problems) return null;
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const resume = p?.for_analyst.find((i) => i.kind === "resume");

  return (
    <section id="problems" className="mt-10 scroll-mt-20">
      <h2 className="text-lg font-semibold">Problems</h2>
      {problems.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No problems in the latest work.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100 rounded-card border border-line bg-white">
          {problems.map((x, i) => {
            const key = `${x.kind}-${x.source_id ?? x.job ?? i}`;
            if (x.kind === "too_broad")
              return (
                <Row key={key} fix={<Link href={`/admin/sources/${x.source_id}`} className={fixLink}>Open source</Link>}>
                  {x.source_name}: a saved search is too broad.
                </Row>
              );
            if (x.kind === "not_configured")
              return (
                <Row key={key} fix={<button type="button" onClick={() => toggle(key)} className={fixLink}>How</button>}>
                  {x.source_name} isn&apos;t configured.
                  {open[key] && (
                    <div className="mt-1 text-xs text-muted">
                      Add {x.keys?.join(" and ")} to .env, then restart tech-atlas.
                    </div>
                  )}
                </Row>
              );
            if (x.kind === "source_error")
              return (
                <Row key={key} fix={<Link href={`/admin/runs/${x.run_id}`} className={fixLink}>Open collection</Link>}>
                  {x.source_name} failed: {x.error}
                </Row>
              );
            if (x.kind === "failed_pages")
              return (
                <Row key={key} fix={
                  <ConfirmAction label="Check again" secondary
                    question="Check the pages that aren't up to date again? Each uses about one model call."
                    disabled={blockedReason(p, "recheck")} onConfirm={startCheck} />}>
                  {plural(x.count ?? 0, "page")} couldn&apos;t be analysed:{" "}
                  {x.reasons?.map((r) => `${r.pages} × ${r.reason}${r.detail ? ` (${short(r.detail, 60)})` : ""}`).join(", ")}.{" "}
                  <button type="button" onClick={() => toggle(key)} className="text-link hover:underline">
                    {open[key] ? "Hide pages" : "Show pages"}
                  </button>
                  {open[key] && (
                    <ul className="mt-2 space-y-1 text-xs">
                      {x.pages?.map((pg) => (
                        <li key={pg.doc_id}>
                          <a href={pg.url} target="_blank" rel="noreferrer" className="text-link hover:underline">
                            {pg.title || pg.url}
                          </a>{" "}
                          <span className="text-muted">— {pg.reason}{pg.detail ? ` (${short(pg.detail)})` : ""}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Row>
              );
            const job = x.job ?? "collection";
            const fix = job === "check" ? (
              <ConfirmAction label="Check again" secondary question="Check the remaining pages again? Each uses about one model call."
                disabled={blockedReason(p, "recheck")} onConfirm={startCheck} />
            ) : job === "assessment" ? (
              <ConfirmAction label="Resume" secondary
                cost={resume && resume.scoring_run_id === x.id ? calls(resume.calls) : undefined}
                question="Resume the assessment run? Only the work it didn't finish runs again."
                disabled={blockedReason(p, "assess")} onConfirm={() => resumeAssessment(x.id!)} />
            ) : job === "pov" ? (
              <ConfirmAction label="Write again" secondary cost={calls(p?.pov.pending ?? 0)}
                question={`Write the ${plural(p?.pov.pending ?? 0, "waiting Point of View", "waiting Points of View")}? About ${plural(p?.pov.pending ?? 0, "model call")}.`}
                onConfirm={() => writePovs(false)} />
            ) : (
              <Link href={`/admin/runs/${x.id}`} className={fixLink}>Open</Link>
            );
            return (
              <Row key={key} fix={fix}>
                The {JOB_WORDS[job]} stopped{x.error ? `: ${x.error}` : "."}
              </Row>
            );
          })}
        </ul>
      )}
      {coverage.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 rounded-card border border-line bg-white px-5 py-3.5 text-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="font-medium">Coverage: </span>
            {plural(coverage.length, "website")} reached the page limit in the latest collection, so some of their pages
            weren&apos;t visited.
            <button type="button" onClick={() => toggle("coverage")} className="ml-2 text-link hover:underline">
              {open.coverage ? "Hide" : "Which websites?"}
            </button>
            {open.coverage && (
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                {coverage.map((x) => (
                  <li key={x.source_id}>{x.source_name}: {linksLeft(x.note)} links left</li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/admin/sources/settings" className={`${fixLink} shrink-0`}>Raise it in Crawl settings</Link>
        </div>
      )}
    </section>
  );
}

type HistoryRow = { key: string; at: string; kind: string; facts: string[]; status: string; href: string; id: string };
type RunRow = { id: string; status: string; run_start_date_time: string; incomplete?: number;
  totals?: { new_documents?: number; signals?: number; other_signals?: number } };
type ScoringRow = { _id: string; status: string; started_at: string;
  progress?: { techs_total?: number; llm_calls?: number } };

/** Collections and assessment runs together, newest first. */
function History() {
  const p = usePipeline();
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [shown, setShown] = useState(20);
  const collectStatus = p?.collect.status;
  const assessStatus = p?.assess.status;
  useEffect(() => {
    Promise.all([fetchJson<{ runs: RunRow[] }>("/api/runs"),
      fetchJson<{ scoring_runs: ScoringRow[] }>("/api/scoring/runs?limit=200")])
      .then(([collections, assessments]) => setRows([
        ...collections.runs.map((r) => ({
          key: `c${r.id}`, id: r.id, at: r.run_start_date_time, kind: "Collection", status: r.status,
          href: `/admin/runs/${r.id}`,
          facts: [plural(r.totals?.new_documents ?? 0, "new page"),
            plural((r.totals?.signals ?? 0) + (r.totals?.other_signals ?? 0), "finding"),
            ...(r.incomplete ? [`${plural(r.incomplete, "website")} reached the page limit`] : [])],
        })),
        ...assessments.scoring_runs.map((r) => ({
          key: `a${r._id}`, id: r._id, at: r.started_at, kind: "Assessment", status: r.status,
          href: `/admin/scoring/assessments/${r._id}`,
          facts: [plural(r.progress?.techs_total ?? 0, "technology", "technologies"),
            plural(r.progress?.llm_calls ?? 0, "model call")],
        })),
      ].sort((a, b) => b.at.localeCompare(a.at))))
      .catch(() => {});
  }, [collectStatus, assessStatus]);
  if (!rows) return null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline gap-4">
        <h2 className="text-lg font-semibold">History</h2>
        <Link href="/admin/runs" className="text-sm text-link hover:underline">All collections →</Link>
        <Link href="/admin/scoring/assessments" className="text-sm text-link hover:underline">All assessment runs →</Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing has run yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100 rounded-card border border-line bg-white">
          {rows.slice(0, shown).map((r) => (
            <li key={r.key}>
              <Link href={r.href} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm hover:bg-ground">
                <span className="w-36 shrink-0 font-mono text-xs text-muted">{formatTime(r.at)}</span>
                <span className="w-24 shrink-0 font-medium">{r.kind}</span>
                <span className="min-w-0 flex-1 text-muted">{r.facts.join(" · ")}</span>
                <Hood><span className="font-mono text-[11px] text-neutral-400">{r.id}</span></Hood>
                <StatusChip status={r.status} />
                <span className="text-link">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rows.length > shown && (
        <button type="button" onClick={() => setShown(shown + 20)}
          className="mt-3 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-ground">
          Show more ({shown} of {rows.length})
        </button>
      )}
    </section>
  );
}

export default function OperationsPage() {
  return (
    <div>
      <PageHeader title="Operations" right={<TechnicalDetailsSwitch />}
        intro="How the radar's work is going: what runs on its own, what's waiting for you, anything that needs fixing, and every past run."
        help={<>
          <li>The cards follow the process from left to right. You start a collection; it finds the signals on each
            new page and organizes the technologies by itself. Assessing technologies and writing Points of View
            wait for you: a highlighted card has work, and its button shows the model-call cost before anything
            starts.</li>
          <li>Signals: when you change the signal list, older pages aren&apos;t checked against it until you choose
            Check again. That&apos;s optional; new pages are always checked. Organize now redoes the organizing
            by hand.</li>
          <li>Problems lists real failures only, each with its fix beside it. Coverage notes websites that reached
            their page limit, so some of their pages weren&apos;t visited.</li>
          <li>History lists every collection and assessment run, newest first; click one for its detail.</li>
          <li>Service health shows whether the API and the database are answering. The Technical details switch
            adds each run&apos;s id.</li>
        </>} />
      <div className="mt-7"><ProcessBoard /></div>
      <Problems />
      <History />
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Service health</h2>
        <div className="mt-3"><ServiceHealth /></div>
      </section>
    </div>
  );
}
