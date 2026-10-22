"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CollectButton from "@/components/CollectButton";
import ConfirmAction from "@/components/ConfirmAction";
import { PublishLink } from "@/components/LeadersSee";
import { calls, organizeTechnologies, resumeAssessment, startAssessment, startCheck, startClassify, writePovs } from "@/lib/actions";
import { fetchJson } from "@/lib/api";
import { formatAt, plural } from "@/lib/format";
import { blockedReason, isLive, usePipeline } from "@/lib/pipeline";
import { LIVE_DOT } from "@/lib/theme";

type Column = {
  title: string;
  state: React.ReactNode;
  last?: React.ReactNode; // when it last ran, and what it did
  detail: React.ReactNode; // what the step does, in plain words
  live?: boolean;
  needsYou?: boolean;
  who: "You start it" | "Runs by itself" | "Waits for you"; // who moves this step on
  action?: React.ReactNode;
  href: string;
  link: string;
};

const Progress = ({ children }: { children: React.ReactNode }) => (
  <span className="flex items-center gap-2 text-sm text-ink"><span className={LIVE_DOT} />{children}</span>
);

/** Why technologies failed in a Classify run, from its record: each reason once. */
function useClassifyFailures(runId?: string, failed = 0): string | null {
  const [why, setWhy] = useState<{ runId: string; text: string } | null>(null);
  useEffect(() => {
    if (!runId || !failed) return;
    fetchJson<{ runs: { _id: string; failed?: { reason: string }[] }[] }>("/api/classify/runs?limit=1")
      .then((d) => {
        const run = d.runs.find((r) => r._id === runId);
        const reasons = [...new Set((run?.failed ?? []).map((f) => f.reason.slice(0, 120)))];
        if (reasons.length) setWhy({ runId, text: reasons.join("; ") });
      })
      .catch(() => {});
  }, [runId, failed]);
  return why && why.runId === runId ? why.text : null;
}

/** Collect → Signals → Organize → Classify → Assess → Points of View, numbered
 *  in order, each saying who moves it on (you start it, it runs by itself, or
 *  it waits for you): each step's state, when it last ran and what it did, what it does, and its one
 *  action; while a step runs, its progress replaces the action. A collection
 *  does the next three itself, so only assessing and writing ever wait for
 *  you (`needsYou`), and classifying when a run left some; re-checking older
 *  pages is optional. Times are in the viewer's own zone, to the minute. */
export default function ProcessBoard() {
  const p = usePipeline();
  const c = p?.classify;
  const whyFailed = useClassifyFailures(c?.run_id, c?.failed);
  const [since, setSince] = useState<{ povs_written: number } | null>(null); // since the edition leaders see
  const composed = p?.pov.composed;
  useEffect(() => {
    fetchJson<{ since: { povs_written: number } | null }>("/api/editions/since").then((d) => setSince(d.since)).catch(() => {});
  }, [composed]);
  if (!p) return null;
  const { collect, signals, technologies, assess, pov } = p;
  const check = signals.recheck?.status === "running" ? signals.recheck : null;
  const resume = p.for_analyst.find((i) => i.kind === "resume");
  const toAssess = p.for_analyst.find((i) => i.kind === "assess");
  const writing = pov.job?.status === "running" ? pov.job : null;
  const organizing = technologies.resolve_status === "running" || collect.stage === "resolving" ||
    signals.recheck?.stage === "organizing technologies";
  const classifying = isLive(c?.status);
  const newNames = technologies.new_names;

  // the last Classify run: what it updated, what had nothing new, what failed and why
  const failed = c?.failed ? `, ${c.failed} failed${whyFailed ? ` (${whyFailed})` : ""}` : "";
  const classified = !c?.finished_at || classifying ? undefined
    : c.status === "failed" ? `Failed ${formatAt(c.finished_at)}: ${c.error ?? "no reason was recorded"}`
    : [`Classified ${formatAt(c.finished_at)}`,
      `${c.unchanged == null ? `${plural(c.done ?? 0, "technology", "technologies")} looked at`
        : `${(c.done ?? 0) - c.unchanged - (c.failed ?? 0)} updated, ${c.unchanged} had nothing new`}${failed}`,
      ...(c.stopped_reason ? [c.stopped_reason] : c.status === "terminated" ? ["stopped by you"] : [])].join(" · ");

  const columns: Column[] = [
    {
      title: "Collect",
      state: isLive(collect.status) ? `Collecting · ${plural(collect.pages ?? 0, "page")} so far`
        : collect.status === "none" ? "Not collected yet"
        : <>Last collected {formatAt(collect.finished_at)} · {plural(collect.new_documents ?? 0, "new page")}
          {(collect.incomplete ?? 0) > 0 && <> · {plural(collect.incomplete ?? 0, "website")} reached the page limit</>}</>,
      detail: "Visits the websites and data sources the radar watches and keeps the pages that are new or changed. Then, by itself, it picks out the findings on them and organizes and classifies technologies.",
      live: isLive(collect.status), who: "You start it",
      action: <CollectButton />,
      href: "/admin/runs", link: "Collections",
    },
    {
      title: "Signals",
      state: check ? `Checking ${check.done} of ${plural(check.total, "page")}`
        : signals.stale_pages > 0 ? `${plural(signals.stale_pages, "older page")} not checked against the current signal list`
        : "Every page checked against the current signal list",
      last: collect.status !== "none" && <>In the last collection: {plural(signals.never_miss + signals.other, "finding")}
        {signals.other > 0 && ` (${signals.other} not on your signal list)`} · {plural(signals.set_aside, "page")} set aside by
        a Can ignore rule</>,
      detail: "Reads each new page for the events on your signal list, such as a funding round or a launch, and keeps each one as a finding. Runs by itself on every new page; older pages are checked again only when you ask.",
      live: !!check, who: "Runs by itself",
      action: signals.stale_pages > 0 && (
        <ConfirmAction label="Check again" cost={calls(signals.stale_pages)} secondary
          question={`Check the ${plural(signals.stale_pages, "older page")} against the current signal list? About ${plural(signals.stale_pages, "model call")}. Optional: new pages are checked as they're collected.`}
          disabled={blockedReason(p, "recheck")} onConfirm={startCheck} />
      ),
      href: "/admin", link: "Briefing",
    },
    {
      title: "Organize",
      state: organizing ? "Organizing technologies"
        : technologies.resolved_at ? <>Last organized {formatAt(technologies.resolved_at)}
          {newNames != null && ` · ${newNames ? `${plural(newNames, "new name")} looked at` : "no new names"}`}</>
        : "Not organized yet",
      detail: "Merges names that mean the same technology (say “GenAI” and “Generative AI”) and adds new ones. Runs by itself after each collection.",
      live: organizing, who: "Runs by itself",
      action: (
        <ConfirmAction label="Organize now" cost="a few model calls" secondary
          question="Organize technologies now? It merges names that mean the same technology and adds new ones, with a few model calls for names it hasn't seen before."
          disabled={organizing ? "Technologies are being organized." : isLive(collect.status) ? "A collection run is in progress." : null}
          onConfirm={organizeTechnologies} />
      ),
      href: "/admin/technologies", link: plural(technologies.count, "technology", "technologies"),
    },
    {
      title: "Classify",
      state: classifying ? `Classifying ${c?.done ?? 0} of ${plural(c?.total ?? 0, "technology", "technologies")}`
        : (c?.pending ?? 0) > 0 ? `${plural(c!.pending, "technology has", "technologies have")} new pages to classify`
        : c?.finished_at ? "Up to date" : "Nothing classified yet",
      last: classified,
      detail: "Files each technology under a domain, says whether it's on sale yet and how mature it is (TRL), and how solid its evidence is. Runs by itself after each collection.",
      live: classifying, who: "Runs by itself",
      needsYou: !classifying && (c?.pending ?? 0) > 0,
      action: (c?.pending ?? 0) > 0 && (
        <ConfirmAction label={`Classify ${c!.pending}`} cost={calls(c!.pending)} secondary
          question={`Classify ${plural(c!.pending, "technology", "technologies")} with new pages? One model call each, within the run's token budget (Setup › Settings).`}
          disabled={classifying ? "Technologies are being classified." : null}
          onConfirm={() => startClassify(null)} />
      ),
      href: "/admin/technologies?view=not_assessed", link: "Technologies",
    },
    {
      title: "Assess",
      state: isLive(assess.status) ? `Assessing ${assess.techs_done ?? 0} of ${plural(assess.techs_total ?? 0, "technology", "technologies")}`
        : resume ? `The run of ${formatAt(resume.started_at)} stopped with ${plural(resume.count, "technology", "technologies")} left`
        : assess.techs_with_new_evidence > 0 ? `${plural(assess.techs_with_new_evidence, "technology has", "technologies have")} new pages`
        : assess.status === "none" ? "Not assessed yet" : "Up to date",
      last: assess.status === "completed" && assess.finished_at &&
        `Last assessed ${formatAt(assess.finished_at)} · ${plural(assess.techs_done ?? 0, "technology", "technologies")}`,
      detail: "Scores each technology in every fabric it touches, from its pages, which sets its priority, and writes its use cases. It costs model calls, so it waits for you.",
      live: isLive(assess.status), who: "Waits for you",
      needsYou: !isLive(assess.status) && (!!resume || !!toAssess),
      action: resume ? (
        <ConfirmAction label="Resume" cost={calls(resume.calls)}
          question={`Resume the assessment run? About ${plural(resume.calls, "model call")} for the ${plural(resume.count, "technology", "technologies")} left.`}
          disabled={blockedReason(p, "assess")} onConfirm={() => resumeAssessment(resume.scoring_run_id)} />
      ) : toAssess && (
        <ConfirmAction label="Assess them again" cost={calls(toAssess.calls)}
          question={`Assess ${plural(toAssess.count, "technology", "technologies")} with new pages? About ${plural(toAssess.calls, "model call")} (up to ${toAssess.calls_max}).`}
          disabled={blockedReason(p, "assess")} onConfirm={() => startAssessment(toAssess.tech_ids)} />
      ),
      href: "/admin/scoring/assessments", link: "Assessment runs",
    },
    {
      title: "Points of View",
      state: writing ? `Writing ${writing.done} of ${writing.total}`
        : pov.pending > 0 ? `${pov.pending} to write · ${pov.composed} written` : `${pov.composed} written`,
      detail: "The radar's conclusion on each technology, for leaders, written from its latest assessment. One model call each, so it waits for you.",
      last: since?.povs_written ? <>{plural(since.povs_written, "Point of View", "Points of View")} written since the
        edition leaders see. <PublishLink>Publish on the Briefing →</PublishLink></> : undefined,
      live: !!writing, who: "Waits for you",
      needsYou: !writing && pov.pending > 0,
      action: pov.pending > 0 && (
        <ConfirmAction label="Write" cost={calls(pov.pending)}
          question={`Write ${plural(pov.pending, "Point of View", "Points of View")}? About ${plural(pov.pending, "model call")}.`}
          onConfirm={() => writePovs(false)} />
      ),
      href: "/admin/scoring/pov", link: "Points of View",
    },
  ];

  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {columns.map((col, i) => (
        <li key={col.title} className={`flex flex-col rounded-card border bg-white px-4 py-3 ${
          col.needsYou ? "border-azure ring-1 ring-azure" : "border-line"}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">{i + 1} · {col.title}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${col.who === "Waits for you" ? "bg-amber-50 text-amber-900"
              : col.who === "You start it" ? "bg-navy/[0.06] text-ink" : "bg-ground text-muted"}`}>{col.who}</span>
          </div>
          <div className="mt-1.5 text-sm font-medium text-ink">
            {col.live ? <Progress>{col.state}</Progress> : col.state}
          </div>
          {col.last && <div className="mt-1 text-[13px] text-ink">{col.last}</div>}
          <div className="mt-1 text-xs text-muted">{col.detail}</div>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
            {!col.live && col.action}
            <Link href={col.href} className="text-xs text-link hover:underline">{col.link} →</Link>
          </div>
        </li>
      ))}
    </ol>
  );
}
