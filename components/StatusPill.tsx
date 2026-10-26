"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatClock, formatDay, plural } from "@/lib/format";
import { isLive, type Pipeline, usePipeline, usePipelineFailure } from "@/lib/pipeline";
import { LIVE_DOT } from "@/lib/theme";
import { itemHref, itemSentence } from "@/lib/waiting";

/** Everything running right now, with its progress, in process order. */
function running(p: Pipeline): string[] {
  const out: string[] = [];
  const { collect, assess } = p;
  const check = p.signals.recheck;
  const writing = p.pov.job;
  const organizing = "Organizing technologies";
  if (isLive(collect.status))
    out.push(collect.stage === "resolving" ? organizing : `Collecting · ${plural(collect.pages ?? 0, "page")} so far`);
  if (check?.status === "running")
    out.push(check.stage === "organizing technologies" ? organizing : `Checking pages · ${check.done} of ${check.total}`);
  if (p.technologies.resolve_status === "running" && !out.includes(organizing)) out.push(organizing);
  if (p.linking?.status === "running")
    out.push(p.linking.stage === "checking" ? `Linking known names · ${p.linking.done ?? 0} of ${plural(p.linking.total ?? 0, "technology", "technologies")}`
      : "Linking known names");
  if (p.classify?.status === "running")
    out.push(`Classifying · ${p.classify.done ?? 0} of ${plural(p.classify.total ?? 0, "technology", "technologies")}`);
  if (isLive(assess.status))
    out.push(`Assessing · ${assess.techs_done ?? 0} of ${plural(assess.techs_total ?? 0, "technology", "technologies")}`);
  if (writing?.status === "running") out.push(`Writing Points of View · ${writing.done} of ${writing.total}`);
  return out;
}

const clock = (ms: number) => formatClock(new Date(ms).toISOString());
const GREY_DOT = "h-1.5 w-1.5 shrink-0 rounded-full bg-white/50";
const PILL = "flex min-w-0 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12.5px] text-white hover:bg-white/15";
const PANEL = "absolute right-0 top-full z-30 mt-2 w-80 space-y-3 rounded-card border border-line bg-white p-4 text-sm text-ink shadow-lg";

/** The top bar's one-line answer to "what's happening?", with a panel of
 *  everything running, what waits for the analyst, and problems. When a check
 *  fails it says so, and since when what it shows is unchanged. */
export default function StatusPill() {
  const p = usePipeline();
  const failure = usePipelineFailure();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const link = "block text-link hover:underline";
  const operations = <Link href="/admin/operations" className={link}>Operations →</Link>;
  if (!p) {
    if (!failure) return null;
    // no answer yet: nothing to show but why
    return (
      <div ref={box} className="relative">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={PILL}>
          <span className={GREY_DOT} />
          <span role="status" className="truncate">Status unavailable</span>
        </button>
        {open && (
          <div className={PANEL}>
            <p className="text-amber-900">The status couldn&apos;t be checked at {clock(failure.at)}: {failure.why}. It asks again by itself.</p>
            <div className="border-t border-line pt-3" onClick={() => setOpen(false)}>{operations}</div>
          </div>
        )}
      </div>
    );
  }
  const jobs = running(p);
  const failed = p.collect.status === "failed" ||
    (p.collect.status === "terminated" && !!p.collect.error && p.collect.error !== "terminated by user");
  const stale = failure?.since ? clock(failure.since) : null; // the last check failed: what's shown is from then
  const text = stale ? `Not updated since ${stale}` : jobs[0] ??
    (p.collect.status === "none" ? "Not collected yet" : `Last collected ${formatDay(p.collect.finished_at)}`);

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={PILL}>
        <span className={stale ? GREY_DOT : jobs.length ? LIVE_DOT : `h-1.5 w-1.5 shrink-0 rounded-full ${failed ? "bg-failed-dot" : "bg-white/50"}`} />
        <span role="status" className="flex min-w-0 items-center xl:max-w-none">
          {/* on a narrow screen the problems count is kept and the rest gives way */}
          <span className={`truncate ${p.problems > 0 ? "hidden max-w-[10.5rem] sm:inline xl:max-w-none" : "max-w-[10.5rem] xl:max-w-none"}`}>{text}</span>
          {p.problems > 0 && <span className="whitespace-nowrap"><span className="hidden sm:inline"> · </span>{plural(p.problems, "problem")}</span>}
        </span>
      </button>
      {open && (
        <div className={PANEL}>
          {failure && stale && (
            <p className="text-amber-900">The status couldn&apos;t be checked at {clock(failure.at)}: {failure.why}.
              Below is what it was at {stale}; it asks again by itself.</p>
          )}
          {jobs.length ? (
            <div className="space-y-1.5">
              {jobs.map((job) => (
                <div key={job} className="flex items-center gap-2"><span className={LIVE_DOT} />{job}</div>
              ))}
            </div>
          ) : (
            <div className="text-muted">
              Nothing is running.
              {p.collect.status !== "none" &&
                ` Last collected ${formatDay(p.collect.finished_at)} from ${plural(p.collect.sources ?? 0, "source")}.`}
            </div>
          )}
          <div className="space-y-1 border-t border-line pt-3" onClick={() => setOpen(false)}>
            {p.for_analyst.map((item) => (
              <Link key={item.kind} href={itemHref(item)} className={link}>{itemSentence(item)} →</Link>
            ))}
            {p.problems > 0 && (
              <Link href="/admin/operations#problems" className={link}>
                {plural(p.problems, "problem")} → Operations
              </Link>
            )}
            {p.collect.run_id && (
              <Link href={`/admin/runs/${p.collect.run_id}`} className={link}>The latest collection, step by step →</Link>
            )}
            {operations}
          </div>
        </div>
      )}
    </div>
  );
}
