"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDay, plural } from "@/lib/format";
import { isLive, type Pipeline, usePipeline } from "@/lib/pipeline";
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
  if (isLive(assess.status))
    out.push(`Assessing · ${assess.techs_done ?? 0} of ${plural(assess.techs_total ?? 0, "technology", "technologies")}`);
  if (writing?.status === "running") out.push(`Writing Points of View · ${writing.done} of ${writing.total}`);
  return out;
}

/** The top bar's one-line answer to "what's happening?", with a panel of
 *  everything running, what waits for the analyst, and problems. */
export default function StatusPill() {
  const p = usePipeline();
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

  if (!p) return null;
  const jobs = running(p);
  const failed = p.collect.status === "failed" ||
    (p.collect.status === "terminated" && !!p.collect.error && p.collect.error !== "terminated by user");
  const text = jobs[0] ??
    (p.collect.status === "none" ? "Not collected yet" : `Last collected ${formatDay(p.collect.finished_at)}`);
  const link = "block text-link hover:underline";

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex min-w-0 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12.5px] text-white hover:bg-white/15">
        <span className={jobs.length ? LIVE_DOT : `h-1.5 w-1.5 shrink-0 rounded-full ${failed ? "bg-failed-dot" : "bg-white/50"}`} />
        <span role="status" className="max-w-[10.5rem] truncate xl:max-w-none">
          {text}
          {p.problems > 0 && ` · ${plural(p.problems, "problem")}`}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 space-y-3 rounded-card border border-line bg-white p-4 text-sm text-ink shadow-lg">
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
            <Link href="/admin/operations" className={link}>Operations →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
