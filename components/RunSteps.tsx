"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConfirmAction from "@/components/ConfirmAction";
import { PublishLink } from "@/components/LeadersSee";
import { editionName } from "@/components/PublishEdition";
import { assessQuestion, assessSet, calls, organizeTechnologies, resumeAssessment, runCalls, startCheck, startClassify, writePovs } from "@/lib/actions";
import { fetchJson, sendJson } from "@/lib/api";
import { formatAt, plural } from "@/lib/format";
import { blockedReason, isLive, type Pipeline, refreshPipeline, usePipeline } from "@/lib/pipeline";
import { LIVE_DOT } from "@/lib/theme";

/* ── data ──────────────────────────────────────────────────────────── */

export type UsedIn = { scoring_run_id: string; status: string | null; started_at: string | null; technologies: number; povs: number };

type Edition = { id: string; name: string | null; published_at: string; tz: string | null };

/** What happened from a collection's start until the next one's (GET /api/runs/{id} → after). */
type After = {
  next_collection: { id: string; started_at: string } | null;
  assessments: { id: string; status: string; started_at: string; finished_at: string | null; techs_done: number; techs_total: number }[];
  povs_written: number;
  published: Edition[];
  leaders_see: Edition | null;
};

/** The parts of a collection's record the steps read. */
export type RunRecord = {
  id: string;
  status: string;
  stage?: string;
  tz?: string | null;
  run_start_date_time: string;
  run_end_date_time: string | null;
  error: string | null;
  totals: { sources: number; pages_visited: number; documents: number; new_documents: number;
    signals?: number; other_signals?: number; set_aside?: number };
  sources: { source_end_date_time: string | null; error: string | null }[];
  resolve?: { status: string; error?: string } & Record<string, unknown>;
  link?: Link | null; // Organize's second part: known technologies named on its pages
  classify?: { id: string; status: string; total: number; done: number; failed: number; failed_why?: string[];
    stopped_reason?: string | null; error?: string | null;
    finished_by?: { id: string; done: number; at: string | null; tz: string | null } | null } | null;
  analysis_errors?: { pages: number }[];
  used_in?: UsedIn[];
  after?: After | null;
};

/** A run of Link known names (GET /api/runs/{id} → link, GET /api/tagging → latest). */
type Link = { id: string; status: string; stage?: string; techs_named?: number; named_on?: number; done?: number;
  pages_about?: number; pages_mention?: number; pages_other?: number; linked?: number; linked_techs?: string[];
  failed: string[]; error?: string | null; trigger?: string };
type Tagging = { latest: Link | null; technologies: number; without_names: number; naming_calls: number };

type Since = { moved: number; placed_new: number; placed_gone: number; povs_written: number } | null;

/** Changes whenever any step moves on, so a page holding a run record knows to reload it. */
export const pipelineKey = (p: Pipeline | null) => !p ? "" : [p.collect.run_id, p.collect.status, p.collect.stage,
  p.collect.pages, p.technologies.resolve_status, p.classify?.status, p.classify?.done, p.assess.status,
  p.assess.techs_done, p.pov.composed, p.pov.job?.status, p.pov.job?.done, p.linking?.status, p.linking?.done].join(":");

/** The latest collection's record, reloaded as the pipeline moves; `none` before the first collection. */
export function useLatestRun(): { run: RunRecord | null; none: boolean } {
  const p = usePipeline();
  const id = p?.collect.run_id;
  const key = pipelineKey(p);
  const [run, setRun] = useState<RunRecord | null>(null);
  useEffect(() => {
    if (id) fetchJson<RunRecord>(`/api/runs/${id}`).then(setRun).catch(() => {});
  }, [id, key]);
  return { run: run && run.id === id ? run : null, none: p?.collect.status === "none" };
}

/* ── the six steps ─────────────────────────────────────────────────── */

type State = "done" | "active" | "waits" | "stopped" | "failed" | "next" | "skipped" | "none" | "missed";

const WORDS: Record<State, string> = { done: "Done", active: "In progress", waits: "Waits for you", stopped: "Stopped",
  failed: "Failed", next: "Not started", skipped: "Didn't run", none: "Nothing to do", missed: "Not done" };
const CHIP: Record<State, string> = { done: "bg-neutral-100 text-muted", active: "bg-azure/10 text-ink",
  waits: "bg-amber-50 text-amber-900", stopped: "bg-amber-50 text-amber-900", failed: "bg-failed/10 text-failed",
  next: "bg-ground text-muted", skipped: "bg-ground text-muted", none: "bg-ground text-muted", missed: "bg-ground text-muted" };
const MARK: Record<State, string> = { done: "border-navy bg-navy text-white", active: "border-azure bg-azure/10 text-ink",
  waits: "border-amber-400 bg-amber-50 text-amber-900", stopped: "border-amber-400 bg-amber-50 text-amber-900",
  failed: "border-failed bg-failed/10 text-failed", next: "border-line bg-white text-muted",
  skipped: "border-line bg-white text-muted", none: "border-line bg-white text-muted", missed: "border-line bg-white text-muted" };
// what a step ends in once it's over: nothing more to do on it
const SETTLED: State[] = ["done", "none", "skipped", "missed"];

type Step = {
  title: string;
  does: string; // what the step does, in plain words
  who: "You start it" | "Runs by itself" | "You publish it";
  state: State;
  brief?: string; // where it stands, for the Now line
  lines: React.ReactNode[];
  action?: React.ReactNode;
  link?: { href: string; label: string };
};

// a collection's own stages: collecting (and reading), merging names, judging evidence
const STEP_OF: Record<string, number> = { starting: 0, orchestrating: 0, crawling: 0, resolving: 1, linking: 1,
  classifying: 2, done: 3 };

function Progress({ done, of, what }: { done: number; of: number; what: string }) {
  return (
    <div className="max-w-md">
      <p>{done.toLocaleString()} of {plural(of, what)} done</p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full bg-azure" style={{ width: `${of ? Math.min(100, (100 * done) / of) : 0}%` }} />
      </div>
    </div>
  );
}

const Note = ({ tone = "muted", children }: { tone?: "muted" | "warn" | "failed"; children: React.ReactNode }) => (
  <p className={tone === "warn" ? "text-amber-900" : tone === "failed" ? "text-failed" : "text-neutral-600"}>{children}</p>
);
const Live = ({ children }: { children: React.ReactNode }) => (
  <p className="flex items-center gap-2"><span className={LIVE_DOT} />{children}</p>
);

/** The latest Link known names run and what a catch-up would cost; only the latest run asks. */
function useTagging(ask: boolean, key: string): Tagging | null {
  const [t, setT] = useState<Tagging | null>(null);
  useEffect(() => {
    if (ask) fetchJson<Tagging>("/api/tagging").then(setT).catch(() => {});
  }, [ask, key]);
  return ask ? t : null;
}

/** What a Link known names run found, in words. */
function linkLines(l: Link): React.ReactNode[] {
  if (l.status === "running")
    return [<Live key="l">Linking known names: {l.stage === "checking"
      ? `checking ${l.done ?? 0} of ${plural(l.techs_named ?? 0, "technology", "technologies")} named on pages`
      : l.stage === "matching" ? "finding them on pages" : "giving known technologies their names"}</Live>];
  if (l.status === "failed") return [<Note key="l" tone="failed">Linking known names failed: {l.error ?? "no reason was recorded"}.</Note>];
  return [
    <p key="l">
      {(l.pages_about ?? 0) > 0
        ? `Linked ${plural(l.pages_about ?? 0, "page")} to ${plural(l.linked ?? l.linked_techs?.length ?? 0, "catalog technology", "catalog technologies")} by name`
        : "No more pages about a catalog technology were found by name"}
      {(l.pages_mention ?? 0) > 0 ? `; ${plural(l.pages_mention ?? 0, "page")} name one in passing (counted apart, not evidence)` : ""}.
    </p>,
    l.failed.length > 0 && <Note key="f" tone="warn">Not checked, tried again next time: {l.failed.slice(0, 2).join("; ")}
      {l.failed.length > 2 ? ` and ${l.failed.length - 2} more` : ""}.</Note>,
  ];
}

/** What changed since the edition leaders see; only the latest run asks. */
function useSince(ask: boolean, composed?: number): Since {
  const [since, setSince] = useState<Since>(null);
  useEffect(() => {
    if (ask) fetchJson<{ since: Since }>("/api/editions/since").then((d) => setSince(d.since)).catch(() => {});
  }, [ask, composed]);
  return ask ? since : null;
}

/** A run's six steps, from the collection to publishing, each with where it
 *  stands, what it did, and its one action. Steps 4 to 6 count what was
 *  done from this collection's start until the next collection's. Only the
 *  latest run reads what waits now (the pipeline) and offers actions. */
function useSteps(run: RunRecord): { steps: Step[]; latest: boolean } {
  const pipeline = usePipeline();
  const after = run.after;
  const latest = !after?.next_collection;
  const p = latest ? pipeline : null;
  const since = useSince(latest, pipeline?.pov.composed);
  const tagging = useTagging(latest, pipelineKey(pipeline));
  const t = run.totals;
  const at = STEP_OF[run.stage ?? "crawling"] ?? 0;
  const runLive = isLive(run.status);
  const ended = (i: number): State => (i < at || run.status === "completed" ? "done"
    : i === at ? (runLive ? "active" : run.status === "failed" ? "failed" : "stopped") : runLive ? "next" : "skipped");
  const nextDay = after?.next_collection ? formatAt(after.next_collection.started_at, run.tz) : "";

  // 1 · collect and read pages
  const s1 = ended(0);
  const read = run.sources.filter((s) => s.source_end_date_time).length;
  const of = Math.max(run.sources.length, t.sources);
  const broken = run.sources.filter((s) => s.error).length;
  const unread = (run.analysis_errors ?? []).reduce((n, e) => n + e.pages, 0);
  const check = p?.signals.recheck?.status === "running" ? p.signals.recheck : null;
  const stale = p?.signals.stale_pages ?? 0;
  const collect: Step = {
    title: "Collect: read pages", who: "You start it", state: s1,
    does: "Visits the switched-on sources, keeps the pages that are new or changed, and reads each one for its summary, the technologies it names and its findings.",
    brief: s1 === "active" ? `collecting, ${read} of ${plural(of, "source")} read`
      : s1 === "failed" ? `failed: ${run.error ?? "no reason was recorded"}` : s1 === "stopped" ? "stopped" : undefined,
    lines: [
      s1 === "active" && <Progress done={read} of={of} what="source" />,
      <p key="c">{plural(t.sources, "source")} · {plural(t.documents, "page")} saved, {t.new_documents.toLocaleString()} new or changed</p>,
      t.signals !== undefined && (
        <p key="f">{plural(t.signals + (t.other_signals ?? 0), "finding")} · {plural(t.set_aside ?? 0, "page")} set aside by a Can ignore rule</p>
      ),
      s1 === "stopped" && <Note key="s" tone="warn">
        {run.error && run.error !== "terminated by user" ? `Stopped: ${run.error}.` : "Stopped by you."} The pages saved so far are kept.</Note>,
      s1 === "failed" && <Note key="x" tone="failed">Failed: {run.error ?? "no reason was recorded"}.</Note>,
      (broken > 0 || unread > 0) && (
        <Note key="p" tone="warn">
          {[broken > 0 && `${plural(broken, "source")} couldn't finish`, unread > 0 && `${plural(unread, "page")} couldn't be read`]
            .filter(Boolean).join(" and ")}: <a href="#problems" className="text-link hover:underline">see Problems</a>.
        </Note>
      ),
      check ? <Live key="k">Checking older pages against the signal list: {check.done} of {check.total}</Live>
        : stale > 0 && <Note key="k">{plural(stale, "older page")} not checked against the current signal list (optional).</Note>,
    ],
    action: !check && stale > 0 && (
      <ConfirmAction label="Check again" cost={calls(stale)} secondary
        question={`Check the ${plural(stale, "older page")} against the current signal list? About ${plural(stale, "model call")}. Optional: new pages are checked as they're collected.`}
        disabled={blockedReason(p, "recheck")} onConfirm={startCheck} />
    ),
    link: { href: `/admin?run=${run.id}`, label: "Its findings on the Briefing" },
  };

  // 2 · organize: merge names
  const r = run.resolve;
  const organizingNow = !!p && p.technologies.resolve_status === "running" && !runLive;
  const catchUp = tagging?.latest?.trigger === "on demand" ? tagging.latest : null; // a catch-up a person started
  const linkingNow = catchUp?.status === "running" && !runLive;
  const s2: State = organizingNow || linkingNow ? "active" : r?.status === "failed" ? "failed"
    : r?.status === "completed" && (run.link?.status !== "running") ? "done" : ended(1);
  const organize: Step = {
    title: "Organize: merge and link names", who: "Runs by itself", state: s2,
    does: "Merges different spellings of the same technology into one name (say “GenAI” and “Generative AI”), and adds new ones. Then finds pages that name a catalog technology, and files those about it as its evidence.",
    brief: s2 === "active" ? (run.stage === "linking" || linkingNow ? "linking known names" : "merging names")
      : s2 === "failed" ? `failed: ${r?.error ?? "no reason was recorded"}` : undefined,
    lines: [
      organizingNow ? <Live key="o">Organizing again now (Organize now).</Live>
        : s2 === "active" && <Live key="o">Merging the names on the new pages…</Live>,
      r?.status === "completed" && (
        <p key="d">Merged {Number(r.raw_strings ?? 0).toLocaleString()} names from every page collected so far; the radar then
          knew {plural(Number(r.technologies ?? 0), "technology", "technologies")}.</p>
      ),
      s2 === "failed" && <Note key="x" tone="failed">Didn&apos;t finish: {r?.error ?? "no reason was recorded"}.</Note>,
      s2 === "next" && <Note key="n">Runs once collecting finishes.</Note>,
      s2 === "skipped" && <Note key="n">Didn&apos;t run{run.status === "completed" ? ": another merge of names was running" : ""}.</Note>,
      ...(run.link ? linkLines(run.link) : []),
      ...(catchUp && latest ? [<p key="c" className="text-neutral-600">Catch-up over every stored page:</p>, ...linkLines(catchUp)] : []),
    ],
    action: latest && p && !runLive && !organizingNow && (
      <>
        <ConfirmAction label="Organize now" cost="a few model calls" secondary
          question="Organize technologies now? It merges names that mean the same technology and adds new ones, with a few model calls for names it hasn't seen before."
          disabled={isLive(p.collect.status) ? "A collection run is in progress." : null} onConfirm={organizeTechnologies} />
        {tagging && !linkingNow && (
          <ConfirmAction label="Link known names on all pages" secondary
            cost={tagging.naming_calls ? `${calls(tagging.naming_calls)} for names, then 1 per 10 pages found` : "1 model call per 10 pages found"}
            question={`Look for the ${plural(tagging.technologies, "catalog technology", "catalog technologies")} on every stored page? ${tagging.without_names ? `${plural(tagging.without_names, "technology needs", "technologies need")} names first (${calls(tagging.naming_calls)}). ` : ""}Finding them costs nothing; then about one model call per 10 pages found checks whether each page is about it. Pages already checked aren't checked again.`}
            onConfirm={() => sendJson("/api/tagging", "POST").then(() => refreshPipeline())} />
        )}
      </>
    ),
    link: { href: "/admin/technologies", label: "Technologies" },
  };

  // 3 · classify: judge evidence (a later on-demand run shows here too, for the latest run)
  const c = run.classify;
  const pc = p?.classify;
  const classifyingNow = !!p && isLive(pc?.status) && pc?.run_id !== c?.id;
  const pending = pc?.pending ?? 0;
  // stopped part-way and a later Classify judged the rest: done, in two parts (its own record says so)
  const rest = c?.finished_by;
  const s3: State = classifyingNow ? "active" : !c ? ended(2) : c.status === "running" ? "active"
    : c.status === "completed" || rest ? "done" : c.status === "failed" ? "failed" : "stopped";
  const left = c ? Math.max(c.total - c.done, 0) : 0; // what this run itself left, never today's backlog
  const judging = classifyingNow ? { done: pc?.done ?? 0, total: pc?.total ?? 0 } : c;
  const classify: Step = {
    title: "Classify: judge evidence", who: "Runs by itself", state: s3,
    does: "Judges how solid each technology's pages are, and sets its domain, commercial availability and maturity (TRL).",
    brief: s3 === "active" ? `judging evidence, ${judging?.done ?? 0} of ${(judging?.total ?? 0).toLocaleString()}`
      : s3 === "stopped" ? `stopped before the end, with ${plural(left, "technology", "technologies")} left to judge`
      : s3 === "failed" ? `failed: ${c?.error ?? "no reason was recorded"}` : undefined,
    lines: [
      s3 === "active" && judging && <Progress done={judging.done} of={judging.total} what="technology with new pages" />,
      !c && classifyingNow && runLive && (
        <Note key="w">Waiting for the Classify run already going to finish; then it judges what that one left.</Note>
      ),
      c && s3 !== "active" && (rest ? (
        <p key="j">All {plural(c.total, "technology with new pages", "technologies with new pages")} judged: {c.done.toLocaleString()} during
          this collection, the rest by a later Classify that finished {formatAt(rest.at, rest.tz)}.</p>
      ) : (
        <p key="j">Judged {c.done.toLocaleString()} of {plural(c.total, "technology with new pages", "technologies with new pages")}.</p>
      )),
      c && (c.stopped_reason || c.status === "terminated") && (
        <Note key="s" tone={s3 === "stopped" ? "warn" : "muted"}>
          {rest ? "The first part " : "It "}
          {c.stopped_reason ? "stopped at a spending limit that was removed on Oct 22."
            : c.error ? `stopped: ${c.error}.` : "was stopped by a person."}{" "}
          {s3 === "stopped" && latest
            && `${plural(pending, "technology waits", "technologies wait")} now: classify them, or the next collection does.`}
        </Note>
      ),
      (c?.failed ?? 0) > 0 && (
        <Note key="f" tone="warn">
          {plural(c!.failed, "technology", "technologies")} couldn&apos;t be judged
          {c!.failed_why?.length ? `: ${c!.failed_why.join("; ")}` : ""}. The next collection tries again.
        </Note>
      ),
      c?.error && c.status === "failed" && <Note key="e" tone="failed">Didn&apos;t finish: {c.error}.</Note>,
      !c && s3 === "next" && <Note key="n">Runs once names are merged.</Note>,
      !c && s3 === "skipped" && <Note key="n">Didn&apos;t run.</Note>,
      !c && s3 === "done" && <Note key="n">Not recorded for this collection: it ran before this step was part of a collection.</Note>,
      latest && s3 === "done" && pending > 0 && (
        <Note key="p">{plural(pending, "technology has", "technologies have")} new pages to classify.</Note>
      ),
    ],
    action: latest && pending > 0 && s3 !== "active" && (
      <ConfirmAction label={`Classify ${pending.toLocaleString()}`} cost={calls(pending)} secondary
        question={`Classify ${plural(pending, "technology", "technologies")} with new pages? One model call each, catalog technologies first.`}
        onConfirm={() => startClassify(null)} />
    ),
    link: { href: "/admin/technologies?view=not_assessed", label: "Technologies" },
  };

  // 4 · assess
  const runs = after?.assessments ?? [];
  const assessed = runs.reduce((n, a) => n + (a.techs_done || 0), 0);
  const lastRun = runs[runs.length - 1];
  const resume = p?.for_analyst.find((i) => i.kind === "resume");
  const toAssess = p?.for_analyst.find((i) => i.kind === "assess");
  const assessingNow = !!p && isLive(p.assess.status);
  const s4: State = assessingNow ? "active" : resume ? "stopped" : toAssess ? "waits" : runs.length ? "done" : latest ? "none" : "missed";
  const used = run.used_in ?? [];
  const assess: Step = {
    title: "Assess", who: "You start it", state: s4,
    does: "Scores each technology in every fabric it touches, from its pages, which sets its priority, and writes its use cases. It costs model calls, so it waits for you.",
    brief: s4 === "active" ? `assessing, ${p!.assess.techs_done ?? 0} of ${p!.assess.techs_total ?? 0}`
      : resume?.kind === "resume" ? `an assessment run stopped with ${plural(resume.count, "technology", "technologies")} left`
      : toAssess ? `${plural(toAssess.count, "technology is", "technologies are")} ready to assess` : undefined,
    lines: [
      s4 === "active" && <Progress done={p!.assess.techs_done ?? 0} of={p!.assess.techs_total ?? 0} what="technology" />,
      resume?.kind === "resume" && (
        <Note key="r" tone="warn">The assessment run of {formatAt(resume.started_at)} stopped with {plural(resume.count, "technology", "technologies")} left.</Note>
      ),
      toAssess && <p key="w">{plural(toAssess.count, "technology has", "technologies have")} new pages and can be assessed.</p>,
      lastRun && (
        <p key="d">Assessed {plural(assessed, "technology", "technologies")} in {plural(runs.length, "run")} since this collection; the
          latest <Link href={`/admin/scoring/assessments/${lastRun.id}`} className="text-link hover:underline">started {formatAt(lastRun.started_at, run.tz)}</Link>.</p>
      ),
      !lastRun && !toAssess && !resume && s4 !== "active" && (
        <Note key="n">{latest ? "No technology has new pages to assess." : `No assessment ran before the next collection (${nextDay}).`}</Note>
      ),
      used.length > 0 && (
        <details key="u" className="text-neutral-600">
          <summary className="cursor-pointer">
            Its pages were read in {plural(used.length, "assessment run")}
            {" "}({plural(used.reduce((n, u) => n + u.technologies, 0), "technology", "technologies")}
            {used.some((u) => u.povs) ? `, ${plural(used.reduce((n, u) => n + u.povs, 0), "Point of View", "Points of View")} built from them` : ""})
          </summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {used.map((u) => (
              <li key={u.scoring_run_id}>
                <Link href={`/admin/scoring/assessments/${u.scoring_run_id}`} className="text-link hover:underline">
                  {formatAt(u.started_at)}</Link>: {plural(u.technologies, "technology", "technologies")}
                {u.povs > 0 ? `, ${plural(u.povs, "Point of View", "Points of View")}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ),
    ],
    action: resume?.kind === "resume" ? (
      <ConfirmAction label="Resume" cost={calls(resume.calls)}
        question={`Resume the assessment run? About ${plural(resume.calls, "model call")} for the ${plural(resume.count, "technology", "technologies")} left.`}
        disabled={blockedReason(p, "assess")} onConfirm={() => resumeAssessment(resume.scoring_run_id)} />
    ) : toAssess?.kind === "assess" && !assessingNow && (
      <ConfirmAction label="Assess them" cost={calls(runCalls(toAssess))}
        question={assessQuestion(toAssess, "with new pages")}
        disabled={blockedReason(p, "assess")} onConfirm={() => assessSet("new_evidence")} />
    ),
    link: { href: "/admin/scoring/assessments", label: "Assessment runs" },
  };

  // 5 · write Points of View
  const writing = p?.pov.job?.status === "running" ? p.pov.job : null;
  const toWrite = p?.pov.pending ?? 0;
  const wrote = after?.povs_written ?? 0;
  const s5: State = writing ? "active" : toWrite > 0 ? "waits" : wrote ? "done" : latest ? "none" : "missed";
  const write: Step = {
    title: "Write Points of View", who: "You start it", state: s5,
    does: "The radar's conclusion on each technology, for leaders, written from its latest assessment. One model call each.",
    brief: writing ? `writing, ${writing.done} of ${writing.total}`
      : toWrite > 0 ? `${plural(toWrite, "Point of View", "Points of View")} to write` : undefined,
    lines: [
      writing && <Progress done={writing.done} of={writing.total} what="Point of View" />,
      !writing && toWrite > 0 && <p key="w">{plural(toWrite, "Point of View waits", "Points of View wait")} to be written from new assessments.</p>,
      wrote > 0 && <p key="d">{plural(wrote, "Point of View", "Points of View")} written since this collection.</p>,
      !writing && !toWrite && !wrote && (
        <Note key="n">{latest ? "Nothing to write: each assessed technology has its Point of View." : "None written before the next collection."}</Note>
      ),
    ],
    action: !writing && toWrite > 0 && (
      <ConfirmAction label="Write them" cost={calls(toWrite)}
        question={`Write ${plural(toWrite, "Point of View", "Points of View")}? About ${plural(toWrite, "model call")}.`}
        onConfirm={() => writePovs(false)} />
    ),
    link: { href: "/admin/scoring/pov", label: "Points of View" },
  };

  // 6 · publish to leaders
  const published = after?.published ?? [];
  const lastEdition = published[published.length - 1];
  const changes = since ? [since.povs_written > 0 && plural(since.povs_written, "Point of View", "Points of View") + " written",
    since.moved > 0 && plural(since.moved, "priority", "priorities") + " moved",
    since.placed_new > 0 && plural(since.placed_new, "new placement"),
    since.placed_gone > 0 && plural(since.placed_gone, "placement") + " gone"].filter(Boolean) : [];
  const s6: State = latest && changes.length ? "waits" : lastEdition ? "done" : latest ? "none" : "missed";
  const seen = after?.leaders_see;
  const publish: Step = {
    title: "Publish to leaders", who: "You publish it", state: s6,
    does: "Freezes what leaders see: every Point of View and placement as they stand. No model calls.",
    brief: s6 === "waits" ? `changes since ${seen ? editionName(seen) : "the last edition"} are ready to publish` : undefined,
    lines: [
      lastEdition && (
        <p key="d">{published.length > 1 ? `Published ${published.length} editions since this collection; the latest is ` : "Published "}
          {editionName(lastEdition)}, {formatAt(lastEdition.published_at, lastEdition.tz)}.</p>
      ),
      s6 === "waits" && <p key="w">Since {seen ? editionName(seen) : "the edition"} leaders see: {changes.join(", ")}.</p>,
      s6 === "none" && (
        <Note key="n">{seen ? `Nothing new to publish: leaders see ${editionName(seen)}, published ${formatAt(seen.published_at, seen.tz)}.`
          : "Nothing published yet."}</Note>
      ),
      s6 === "missed" && <Note key="n">No edition was published before the next collection.</Note>,
    ],
    action: s6 === "waits" && <span className="text-sm"><PublishLink>Publish on the Briefing →</PublishLink></span>,
  };

  return { steps: [collect, organize, classify, assess, write, publish], latest };
}

/** Where the collection stands: the first step not settled, and the next one in order after it. */
function nowAndNext(steps: Step[]): { now: number; next: number } {
  const open = (s: Step) => !SETTLED.includes(s.state);
  const now = steps.findIndex((s) => s.state === "active");
  const first = now >= 0 ? now : steps.findIndex(open);
  const next = first < 0 ? -1 : steps.findIndex((s, i) => i > first && open(s));
  return { now: first, next };
}

const stepName = (steps: Step[], i: number) => `step ${i + 1} of ${steps.length}, ${steps[i].title}`;
const sentence = (t: string) => `${t.charAt(0).toUpperCase()}${t.slice(1)}.`;
/** Where a step stands, as a sentence: its brief, else its state. */
const standing = (s: Step) => sentence(s.brief ?? WORDS[s.state].toLowerCase());

/** One sentence: where the run stands and what comes next. */
function NowLine({ steps, latest, nextAt }: { steps: Step[]; latest: boolean; nextAt?: string }) {
  const { now, next } = nowAndNext(steps);
  if (!latest)
    return <p className="text-[15px]">A newer collection started {nextAt}. Below is what happened from this one until then.</p>;
  if (now < 0)
    return <p className="text-[15px]"><b className="font-semibold">Every step is done.</b> Nothing waits for you on this collection.</p>;
  const s = steps[now];
  return (
    <div className="text-[15px]">
      <p>
        <span className="font-semibold">Now: {stepName(steps, now)}.</span> {standing(s)}
      </p>
      {next >= 0 && (
        <p className="mt-0.5 text-neutral-600">Next: {stepName(steps, next)}. {standing(steps[next])}</p>
      )}
    </div>
  );
}

/** A run from start to finish: a Now line, then its six steps in order. */
export default function RunSteps({ run }: { run: RunRecord }) {
  const { steps, latest } = useSteps(run);
  const { now } = nowAndNext(steps);
  return (
    <section aria-label="Steps of this run">
      <NowLine steps={steps} latest={latest}
        nextAt={run.after?.next_collection ? formatAt(run.after.next_collection.started_at, run.tz) : undefined} />
      {!latest && run.after?.next_collection && (
        <Link href={`/admin/runs/${run.after.next_collection.id}`} className="text-sm text-link hover:underline">
          Open the newer run →</Link>
      )}
      <ol className="mt-3 overflow-hidden rounded-card border border-line bg-white">
        {steps.map((s, i) => {
          const lines = s.lines.filter(Boolean);
          return (
            <li key={s.title} aria-current={latest && i === now ? "step" : undefined}
              className={`flex gap-4 px-4 py-4 sm:px-5 ${i ? "border-t border-neutral-100" : ""} ${
                latest && i === now ? "bg-azure/[0.05] shadow-[inset_3px_0_0_var(--color-azure)]" : ""}`}>
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${MARK[s.state]}`}>
                {s.state === "done" ? "✓" : i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <h3 className="text-[15px] font-semibold leading-tight">{s.title}</h3>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${CHIP[s.state]}`}>
                      {s.state === "active" && <span className={LIVE_DOT} />}{WORDS[s.state]}
                    </span>
                    <span className="text-xs text-muted">{s.who}</span>
                  </div>
                  <p className="mt-0.5 max-w-3xl text-xs text-muted">{s.does}</p>
                  {lines.length > 0 && <div className="mt-2 space-y-1 text-sm">{lines}</div>}
                </div>
                {(s.action || s.link) && (
                  <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end">
                    {s.action}
                    {s.link && <Link href={s.link.href} className="text-xs text-link hover:underline">{s.link.label} →</Link>}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The Briefing's one line: where the latest run stands, with a link to its steps. */
export function RunNowLine() {
  const { run } = useLatestRun();
  if (!run) return null;
  return <RunNowSentence run={run} />;
}

function RunNowSentence({ run }: { run: RunRecord }) {
  const { steps } = useSteps(run);
  const { now } = nowAndNext(steps);
  const s = now >= 0 ? steps[now] : null;
  return (
    <p className="mt-3 flex flex-wrap items-baseline gap-x-2 rounded-card border border-line bg-white px-4 py-2.5 text-sm">
      {s?.state === "active" && <span className={`${LIVE_DOT} self-center`} />}
      <span>
        <span className="text-muted">Latest collection, started {formatAt(run.run_start_date_time, run.tz)}:</span>{" "}
        {s ? <>{stepName(steps, now)}. {standing(s)}</> : "every step is done."}
      </span>
      <Link href={`/admin/runs/${run.id}`} className="text-link hover:underline">See every step →</Link>
    </p>
  );
}
