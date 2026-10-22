"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConfirmAction from "@/components/ConfirmAction";
import Hood from "@/components/Hood";
import ModelUse from "@/components/ModelUse";
import OperationsTabs from "@/components/OperationsTabs";
import PageHeader from "@/components/PageHeader";
import ProcessBoard from "@/components/ProcessBoard";
import ServiceHealth from "@/components/ServiceHealth";
import StatusChip from "@/components/StatusChip";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import { calls, resumeAssessment, startCheck, writePovs } from "@/lib/actions";
import { fetchJson } from "@/lib/api";
import { formatAt, formatClock, formatDay, plural } from "@/lib/format";
import { blockedReason, usePipeline } from "@/lib/pipeline";
import { addTokens, beforeRecording, RUN_KIND, type RunUsage, tokenLine } from "@/lib/usage";

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
          <Link href="/admin/sources/settings" className={`${fixLink} shrink-0`}>Raise it in Settings</Link>
        </div>
      )}
    </section>
  );
}

type HistoryRow = { key: string; at: string; tz?: string | null; kind: string; facts: string[]; status: string | null;
  href: string | null; id: string; ids: string[]; usageKind?: string; used: boolean;
  count?: number; until?: string }; // a group of single Points of View: how many, and when the last was written
type RunRow = { id: string; status: string; run_start_date_time: string; incomplete?: number; resolve_id?: string;
  totals?: { new_documents?: number; signals?: number; other_signals?: number } };
type ScoringRow = { _id: string; status: string; started_at: string;
  progress?: { techs_total?: number; llm_calls?: number } };
type About = { status?: string; tz?: string; total?: number; trigger?: string; file?: string; summary?: string;
  technology?: string | null; gap?: { tech_id?: string }; assessment?: { id: string; started_at: string } };

/** The facts a run's own record gives, by kind. */
function aboutFacts(kind: string, a: About): string[] {
  const n = a.total ?? 0;
  if (kind === "classify")
    return [plural(n, "technology", "technologies"),
      a.trigger?.startsWith("after collection") ? "after a collection" : "started by hand"];
  if (kind === "recheck") return [`${plural(n, "page")} checked again`];
  if (kind === "find_evidence") return [a.technology ?? "", short(a.summary ?? "", 120)].filter(Boolean);
  if (kind === "import") return a.file ? [a.file] : [];
  if (kind === "pov")
    return a.assessment ? [`written from the assessment run of ${formatDay(a.assessment.started_at)}`]
      : n ? [plural(n, "technology", "technologies")] : [];
  return [];
}

/** Where a run's own page is, when it has one. */
function aboutHref(kind: string, id: string, a: About): string | null {
  if (kind === "find_evidence" && a.gap?.tech_id) return `/admin/technologies/${a.gap.tech_id}`;
  if (kind === "import") return `/admin/import?id=${encodeURIComponent(id)}`;
  if (kind === "pov") return "/admin/scoring/pov";
  if (kind === "resolve") return "/admin/technologies";
  return null;
}

/** One Point of View written on its own after another within the hour joins
 *  its row: "22 Points of View written · 10:14–10:24 AM · 22 model calls". */
function grouped(rows: HistoryRow[], r: HistoryRow): HistoryRow[] {
  const prev = rows[rows.length - 1];
  const one = (x: HistoryRow) => x.kind === RUN_KIND.pov && x.facts.includes("1 model call");
  if (prev && one(r) && (prev.count || one(prev)) && Date.parse(prev.at) - Date.parse(r.at) < 3600_000) {
    const n = (prev.count ?? 1) + 1;
    rows[rows.length - 1] = { ...prev, count: n, at: r.at, until: prev.until ?? prev.at, ids: [...prev.ids, ...r.ids],
      facts: [`${n} written`, plural(n, "model call")] };
    return rows;
  }
  return [...rows, r];
}

/** Every run that used the model, newest first: collections (with the
 *  organize that ended them), assessment runs, and the runs with no list of
 *  their own (Classify, Points of View, Find evidence, import matching,
 *  checks of stored pages), each with its tokens in, out and reused. */
function History() {
  const p = usePipeline();
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [shown, setShown] = useState(20);
  const [open, setOpen] = useState<string | null>(null);
  const done = [p?.collect.status, p?.assess.status, p?.classify?.status, p?.pov.job?.status].join(":");
  useEffect(() => {
    Promise.all([fetchJson<{ runs: RunRow[] }>("/api/runs"),
      fetchJson<{ scoring_runs: ScoringRow[] }>("/api/scoring/runs?limit=200"),
      fetchJson<{ runs: RunUsage[]; recorded_since: string | null }>("/api/usage/recent?limit=300")
        .catch(() => ({ runs: [] as RunUsage[], recorded_since: null }))])
      .then(([collections, assessments, usage]) => {
        const own = new Map(usage.runs.map((u) => [`${u.run_id}:${u.run_kind}`, u]));
        const partsOf = (kind: string, id: string) => usage.runs.filter((u) => u.part_of?.kind === kind && u.part_of.id === id);
        // a find-evidence job's page reading is filed as a run, but it isn't a collection
        const reading = new Set(usage.runs.filter((u) => u.part_of?.kind === "find_evidence").map((u) => u.run_id));
        // tokens, or why there are none; runs from before recording have none, or only some
        const tokens = (us: (RunUsage | undefined)[], at: string) => {
          const got = us.filter((u): u is RunUsage => !!u);
          const old = beforeRecording(at, usage.recorded_since);
          if (got.length === 0) return old ? ["tokens not recorded"] : [];
          return [`${tokenLine(addTokens(got))}${old ? " (recorded for part of the run only)" : ""}`];
        };
        const listed = new Set([
          ...collections.runs.filter((r) => !reading.has(r.id)).map((r) => `${r.id}:collection`),
          ...assessments.scoring_runs.map((r) => `${r._id}:scoring`)]);
        const parentShown = (u: RunUsage) => !!u.part_of && (listed.has(`${u.part_of.id}:collection`)
          || own.has(`${u.part_of.id}:${u.part_of.kind}`));
        const others = usage.runs.filter((u) => !listed.has(`${u.run_id}:${u.run_kind}`) && !parentShown(u)
          && !(u.run_kind === "collection" && !reading.has(u.run_id)));
        setRows([
          ...collections.runs.filter((r) => !reading.has(r.id)).map((r) => {
            const parts = partsOf("collection", r.id);
            return {
              key: `c${r.id}`, id: r.id, at: r.run_start_date_time, kind: "Collection", status: r.status,
              href: `/admin/runs/${r.id}`, ids: [r.id, ...parts.map((u) => u.run_id)],
              used: !!own.get(`${r.id}:collection`) || parts.length > 0,
              facts: [plural(r.totals?.new_documents ?? 0, "new page"),
                plural((r.totals?.signals ?? 0) + (r.totals?.other_signals ?? 0), "finding"),
                ...(r.incomplete ? [`${plural(r.incomplete, "website")} reached the page limit`] : []),
                ...tokens([own.get(`${r.id}:collection`), ...parts], r.run_start_date_time)],
            };
          }),
          ...assessments.scoring_runs.map((r) => ({
            key: `a${r._id}`, id: r._id, at: r.started_at, kind: "Assessment", status: r.status,
            href: `/admin/scoring/assessments/${r._id}`, ids: [r._id], usageKind: "scoring",
            used: own.has(`${r._id}:scoring`),
            facts: [plural(r.progress?.techs_total ?? 0, "technology", "technologies"),
              plural(r.progress?.llm_calls ?? 0, "model call"), ...tokens([own.get(`${r._id}:scoring`)], r.started_at)],
          })),
          ...others.map((u) => {
            const kind = u.run_kind ?? "";
            const a = (u.about ?? {}) as About;
            const parts = partsOf(kind, u.run_id);
            return {
              key: `${kind}${u.run_id}`, id: u.run_id, at: u.first_at, tz: a.tz, kind: RUN_KIND[kind] ?? (kind || "Other"),
              status: a.status ?? null, href: aboutHref(kind, u.run_id, a),
              // only an assessment run's id also carries another kind (Points of View once written under it)
              ids: [u.run_id, ...parts.map((x) => x.run_id)], usageKind: kind === "pov" ? kind : undefined, used: true,
              facts: [...aboutFacts(kind, a), plural(u.calls + parts.reduce((n, x) => n + x.calls, 0), "model call"),
                ...tokens([u, ...parts], u.first_at)],
            };
          }),
        ].sort((a, b) => b.at.localeCompare(a.at)).reduce(grouped, [] as HistoryRow[]));
      })
      .catch(() => {});
  }, [done]);
  if (!rows) return null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline gap-4">
        <h2 className="text-lg font-semibold">History</h2>
        <Link href="/admin/runs" className="text-sm text-link hover:underline">All collections →</Link>
        <Link href="/admin/scoring/assessments" className="text-sm text-link hover:underline">All assessment runs →</Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing has run yet. Start a collection above.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100 rounded-card border border-line bg-white">
          {rows.slice(0, shown).map((r) => {
            const main = (
              <>
                <span className="w-48 shrink-0 text-xs text-muted">
                  {formatAt(r.at, r.tz)}{r.until && r.count ? `–${formatClock(r.until, r.tz)}` : ""}
                </span>
                <span className="w-32 shrink-0 font-medium">{r.kind}</span>
                <span className="min-w-0 flex-1 text-muted">{r.facts.join(" · ")}</span>
              </>
            );
            return (
              <li key={r.key}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm hover:bg-ground">
                  {r.href ? (
                    <Link href={r.href} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      {main}
                    </Link>
                  ) : (
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">{main}</span>
                  )}
                  <Hood><span className="font-mono text-[11px] text-neutral-400">{r.ids.join(" + ")}</span></Hood>
                  {r.status && <StatusChip status={r.status} />}
                  {r.used && (
                    <button type="button" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}
                      className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs hover:bg-ground">
                      {open === r.key ? "Hide" : "Cost by skill"}
                    </button>
                  )}
                  {r.href && <Link href={r.href} className="text-link" aria-label={`Open the ${r.kind.toLowerCase()}`}>→</Link>}
                </div>
                {open === r.key && (
                  <div className="px-5 pb-3"><ModelUse runIds={r.ids} kind={r.usageKind} table /></div>
                )}
              </li>
            );
          })}
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
      <OperationsTabs />
      <PageHeader title="Operations" right={<TechnicalDetailsSwitch />}
        intro="How the radar's work is going: what runs on its own, what's waiting for you, anything that needs fixing, and every past run."
        help={<>
          <li>The cards are the process, numbered in order; each says who moves it on. You start a collection; it picks out the findings on
            each new page, then organizes and classifies the technologies by itself. Assessing technologies and
            writing Points of View wait for you: a highlighted card has work, and its button shows the model-call
            cost before anything starts.</li>
          <li>Each card says what it&apos;s doing now, when it last ran and what that run did (in your own time zone),
            and in grey what the step does. A button you click says Started, or why it didn&apos;t start; the card
            then shows the run&apos;s progress.</li>
          <li>Signals: when you change the signal list, older pages aren&apos;t checked against it until you choose
            Check again. That&apos;s optional; new pages are always checked. Organize now runs the organizing at once
            instead of waiting for the next collection.</li>
          <li>Problems lists real failures only, each with its fix beside it. Coverage notes websites that reached
            their page limit, so some of their pages weren&apos;t visited.</li>
          <li>History lists every run that used the model, newest first: collections (with the organizing that
            ended them), Classify, assessment runs, Points of View, Find evidence, import matching and checks of
            stored pages. Each shows its tokens: in (everything sent), how many of those were reused at a fraction
            of the price, and out (what the model wrote). Cost by skill opens the breakdown; a row with a page opens
            it. Runs from before tokens were recorded say so.</li>
          <li>The Technical details switch adds each run&apos;s id, and whether the API and the database are
            answering; if either is down, that shows here whatever the switch says.</li>
        </>} />
      <div className="mt-7"><ProcessBoard /></div>
      <Problems />
      <History />
      <ServiceHealth />
    </div>
  );
}
