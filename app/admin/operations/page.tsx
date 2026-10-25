"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CollectButton from "@/components/CollectButton";
import ConfirmAction from "@/components/ConfirmAction";
import Hood from "@/components/Hood";
import OperationsTabs from "@/components/OperationsTabs";
import PageHeader from "@/components/PageHeader";
import RunSteps, { useLatestRun } from "@/components/RunSteps";
import ServiceHealth from "@/components/ServiceHealth";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import { calls, resumeAssessment, startCheck, writePovs } from "@/lib/actions";
import { fetchJson } from "@/lib/api";
import { formatAt, plural } from "@/lib/format";
import { blockedReason, usePipeline } from "@/lib/pipeline";
import { sourceProblem } from "@/lib/problems";

type Problem = {
  kind: "didnt_finish" | "too_broad" | "not_configured" | "source_error" | "failed_pages" | "job_failed"; // didnt_finish: coverage
  source_id?: string;
  source_name?: string;
  run_id?: string;
  note?: string;
  limit?: "pages" | "depth"; // coverage: which limit stopped the website
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
                <Row key={key} fix={<Link href={`/admin/sources/${x.source_id}`} className={fixLink}>Open source</Link>}>
                  {x.source_name} can&apos;t run: it needs {x.keys?.join(" and ")}.
                  <span className="block text-xs text-muted">
                    Ask whoever runs the server to add {x.keys?.length === 1 ? "it" : "them"} to its settings file (.env) and
                    restart tech-atlas; or switch the source off.
                  </span>
                </Row>
              );
            if (x.kind === "source_error")
              return (
                <Row key={key} fix={sourceProblem(x.error ?? "").nothingToDo ? undefined
                  : <Link href={`/admin/sources/${x.source_id}`} className={fixLink}>Open source</Link>}>
                  {x.source_name} couldn&apos;t finish: {sourceProblem(x.error ?? "").why}.
                  {sourceProblem(x.error ?? "").fix && <span className="block text-xs text-muted">{sourceProblem(x.error ?? "").fix}</span>}
                  <Link href={`/admin/runs/${x.run_id}`} className="text-xs text-link hover:underline">In the latest collection →</Link>
                  <Hood><span className="block break-all font-mono text-xs text-neutral-500">{x.error}</span></Hood>
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
            {plural(coverage.length, "website")} weren&apos;t read to the end in the latest collection
            ({coverage.filter((x) => x.limit === "pages").length.toLocaleString()} reached the page limit, the rest the link
            depth), so some of their pages weren&apos;t visited.
            <button type="button" onClick={() => toggle("coverage")} className="ml-2 text-link hover:underline">
              {open.coverage ? "Hide" : "Which websites?"}
            </button>
            {open.coverage && (
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                {coverage.map((x) => (
                  <li key={x.source_id}>{x.source_name}: {linksLeft(x.note)} links left, at the {x.limit === "pages" ? "page limit" : "link depth"}</li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/admin/sources/settings" className={`${fixLink} shrink-0`}>Raise it in Settings</Link>
        </div>
      )}
    </section>
  );
}

/** One line where History used to be: it has its own tab. */
function HistoryLine() {
  return (
    <p className="mt-10 text-sm text-muted">
      Every past run, with what each used of the model: <Link href="/admin/operations/history" className="text-link hover:underline">History →</Link>
    </p>
  );
}

/** The latest run, step by step, with what waits for you and its buttons. */
function LatestRun() {
  const { run, none } = useLatestRun();
  return (
    <section className="mt-7" aria-labelledby="latest-run">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="latest-run" className="text-lg font-semibold">
          Latest collection{run && <span className="font-normal text-muted">, started {formatAt(run.run_start_date_time, run.tz)}</span>}
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          {run && <Link href={`/admin/runs/${run.id}`} className="text-sm text-link hover:underline">Open the collection →</Link>}
          <CollectButton label="Start a collection" />
        </div>
      </div>
      {none ? <p className="text-sm text-muted">Nothing collected yet. Start a collection: the steps show here as it runs.</p>
        : run ? <RunSteps run={run} /> : <p className="text-sm text-muted">Loading the latest collection…</p>}
    </section>
  );
}

export default function OperationsPage() {
  return (
    <div>
      <OperationsTabs />
      <PageHeader title="Operations" right={<TechnicalDetailsSwitch />}
        intro="How the radar's work is going: what runs on its own, what's waiting for you, and anything that needs fixing. Every past run is under History."
        help={<>
          <li>Latest collection: its six steps, from collecting pages to publishing to leaders.
            The Now line says which step it&apos;s on and what comes next. You start a collection; collecting,
            organizing and classifying then run by themselves. Assessing, writing Points of View and publishing wait for
            you: the step that waits is marked, and its button shows the model-call cost before anything starts. Open
            the collection for its sources and pages.</li>
          <li>Each step says where it stands, what it did (times in the zone of the person who started it), and in
            grey what the step does. A button you click says Started, or why it didn&apos;t start; the step then shows
            its progress.</li>
          <li>Under Collect: when you change the signal list, older pages aren&apos;t checked against it until you choose
            Check again. That&apos;s optional; new pages are always checked. Organize now runs the organizing at once
            instead of waiting for the next collection.</li>
          <li>Problems lists real failures only, each with its fix beside it. Coverage notes websites that reached
            their page limit, so some of their pages weren&apos;t visited.</li>
          <li>History, its own tab, lists every run that used the model, newest first, with its tokens and Cost by
            skill.</li>
          <li>The Technical details switch adds each run&apos;s id, and whether the API and the database are
            answering; if either is down, that shows here whatever the switch says.</li>
        </>} />
      <LatestRun />
      <Problems />
      <HistoryLine />
      <ServiceHealth />
    </div>
  );
}
