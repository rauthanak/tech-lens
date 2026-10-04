"use client";

import Link from "next/link";
import CollectButton from "@/components/CollectButton";
import ConfirmAction from "@/components/ConfirmAction";
import { calls, organizeTechnologies, resumeAssessment, startAssessment, startCheck, writePovs } from "@/lib/actions";
import { formatDay, plural } from "@/lib/format";
import { blockedReason, isLive, usePipeline } from "@/lib/pipeline";
import { LIVE_DOT } from "@/lib/theme";

type Column = {
  title: string;
  state: React.ReactNode;
  detail?: React.ReactNode;
  live?: boolean;
  needsYou?: boolean;
  action?: React.ReactNode;
  href: string;
  link: string;
};

const Progress = ({ children }: { children: React.ReactNode }) => (
  <span className="flex items-center gap-2 text-sm text-ink"><span className={LIVE_DOT} />{children}</span>
);

/** Collect → Signals → Organize → Assess → Points of View: each step's
 *  state and its one action; while a step runs, its progress replaces the
 *  action. A collection does the next two itself, so only assessing and
 *  writing ever wait for you (`needsYou`); re-checking older pages is
 *  optional. */
export default function ProcessBoard() {
  const p = usePipeline();
  if (!p) return null;
  const { collect, signals, technologies, assess, pov } = p;
  const check = signals.recheck?.status === "running" ? signals.recheck : null;
  const resume = p.for_analyst.find((i) => i.kind === "resume");
  const toAssess = p.for_analyst.find((i) => i.kind === "assess");
  const writing = pov.job?.status === "running" ? pov.job : null;
  const organizing = technologies.resolve_status === "running" || collect.stage === "resolving" ||
    signals.recheck?.stage === "organizing technologies";

  const columns: Column[] = [
    {
      title: "Collect",
      state: isLive(collect.status) ? `Collecting · ${plural(collect.pages ?? 0, "page")} so far`
        : collect.status === "none" ? "Not collected yet"
        : <>Last collected {formatDay(collect.finished_at)} · {plural(collect.new_documents ?? 0, "new page")}
          {(collect.incomplete ?? 0) > 0 && <> · {plural(collect.incomplete ?? 0, "website")} reached the page limit</>}</>,
      detail: "Each collection also finds the signals on new pages and organizes technologies.",
      live: isLive(collect.status),
      action: <CollectButton />,
      href: "/admin/runs", link: "Collections",
    },
    {
      title: "Signals",
      state: check ? `Checking ${check.done} of ${plural(check.total, "page")}`
        : signals.stale_pages > 0 ? `Automatic for new pages · ${plural(signals.stale_pages, "older page")} not checked against the current list`
        : "Automatic for new pages · every page checked against the signal list",
      detail: collect.status !== "none" &&
        `${plural(signals.never_miss + signals.other, "finding")} (${signals.other} other) · ${signals.set_aside} set aside, in the last collection`,
      live: !!check,
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
        : `Automatic after each collection · last ${formatDay(technologies.resolved_at)}`,
      detail: plural(technologies.count, "technology", "technologies"),
      live: organizing,
      action: (
        <ConfirmAction label="Organize now" cost="a few model calls" secondary
          question="Organize technologies now? It uses a few model calls for names it hasn't seen, and gives new technologies their usual capitals."
          disabled={organizing ? "Technologies are being organized." : isLive(collect.status) ? "A collection run is in progress." : null}
          onConfirm={organizeTechnologies} />
      ),
      href: "/admin/technologies", link: "Technologies",
    },
    {
      title: "Assess",
      state: isLive(assess.status) ? `Assessing ${assess.techs_done ?? 0} of ${plural(assess.techs_total ?? 0, "technology", "technologies")}`
        : resume ? `The run of ${formatDay(resume.started_at)} stopped with ${plural(resume.count, "technology", "technologies")} left`
        : assess.techs_with_new_evidence > 0 ? `${plural(assess.techs_with_new_evidence, "technology has", "technologies have")} new pages`
        : assess.status === "none" ? "Not assessed yet" : `Last run ${formatDay(assess.finished_at)}`,
      live: isLive(assess.status),
      needsYou: !isLive(assess.status) && (!!resume || !!toAssess),
      action: resume ? (
        <ConfirmAction label="Resume" cost={calls(resume.calls)}
          question={`Resume the assessment run? About ${plural(resume.calls, "model call")} for the ${plural(resume.count, "technology", "technologies")} left.`}
          disabled={blockedReason(p, "assess")} onConfirm={() => resumeAssessment(resume.scoring_run_id)} />
      ) : toAssess && (
        <ConfirmAction label="Assess" cost={calls(toAssess.calls)}
          question={`Assess ${plural(toAssess.count, "technology", "technologies")} with new pages? About ${plural(toAssess.calls, "model call")} (up to ${toAssess.calls_max}).`}
          disabled={blockedReason(p, "assess")} onConfirm={() => startAssessment(toAssess.tech_ids)} />
      ),
      href: "/admin/scoring/assessments", link: "Assessment runs",
    },
    {
      title: "Points of View",
      state: writing ? `Writing ${writing.done} of ${writing.total}`
        : pov.pending > 0 ? `${pov.pending} to write` : `${pov.composed} written`,
      detail: pov.pending > 0 && !writing ? `${pov.composed} written` : undefined,
      live: !!writing,
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
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {columns.map((c) => (
        <li key={c.title} className={`flex flex-col rounded-card border bg-white px-4 py-3 ${
          c.needsYou ? "border-azure ring-1 ring-azure" : "border-line"}`}>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            {c.title}
          </div>
          <div className="mt-1.5 text-sm font-medium text-ink">
            {c.live ? <Progress>{c.state}</Progress> : c.state}
          </div>
          {c.detail && <div className="mt-1 text-xs text-muted">{c.detail}</div>}
          <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
            {!c.live && c.action}
            <Link href={c.href} className="text-xs text-link hover:underline">{c.link} →</Link>
          </div>
        </li>
      ))}
    </ol>
  );
}
