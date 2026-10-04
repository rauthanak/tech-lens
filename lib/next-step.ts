import { plural } from "@/lib/format";
import { type AnalystItem, type FailureGroup, isLive, type Pipeline } from "@/lib/pipeline";

// The prompt after a job finishes while the portal is open: what it did, in
// one sentence, and the next step — the first waiting item that comes after
// it in the process — or a link to its results. Re-checking older pages is
// optional upkeep, never offered as the next step. Work that finished while
// you were away shows under "For the analyst" instead.

export type Step = "collect" | "check" | "assess" | "write";

export type Finished = {
  key: string; // one per finished job, so "Later" hides just that one
  step: Step;
  message: string;
  next: AnalystItem | null;
  results: { href: string; label: string };
};

const ORDER: AnalystItem["kind"][] = ["check", "resume", "assess", "write"];
const AFTER: Record<Step, number> = { collect: -1, check: 0, assess: 2, write: 3 };

const fromGroups = (groups: FailureGroup[] = []) => {
  const pages = groups.reduce((n, g) => n + g.pages, 0);
  return pages ? `${pages} couldn't be analysed: ${groups.map((g) => g.reason).join(", ")}` : "";
};

const fromCounts = (reasons: Record<string, number> = {}) => {
  const pages = Object.values(reasons).reduce((n, c) => n + c, 0);
  return pages ? `${pages} couldn't be analysed: ${Object.keys(reasons).join(", ")}` : "";
};

/** The job that went from running to completed between two polls, if any. */
export function finished(before: Pipeline, now: Pipeline): Finished | null {
  const done = (step: Step, key: string, message: string, results: Finished["results"]): Finished => ({
    key, step, message, results,
    next: now.for_analyst.find((item) => item.kind !== "check" && ORDER.indexOf(item.kind) > AFTER[step]) ?? null,
  });

  const c = now.collect;
  if (isLive(before.collect.status) && c.run_id === before.collect.run_id && c.status === "completed") {
    const notes = [(c.incomplete ?? 0) > 0 && `${plural(c.incomplete ?? 0, "website")} reached the page limit`,
      fromGroups(c.analysis_errors)]
      .filter(Boolean).join("; ");
    return done("collect", `collect:${c.run_id}`,
      `✓ Collected ${plural(c.new_documents ?? 0, "new page")} from ${plural(c.sources ?? 0, "source")}${notes ? ` (${notes})` : ""}.`,
      { href: `/admin?run=${c.run_id}`, label: "See its findings" });
  }

  const check = now.signals.recheck;
  if (before.signals.recheck?.status === "running" && check?.id === before.signals.recheck.id &&
      check.status === "completed") {
    const failed = fromCounts(check.failed_reasons);
    return done("check", `check:${check.id}`,
      `✓ Checked ${plural(check.done, "page")}: ${plural(check.found + check.other, "finding")}, ${check.set_aside} set aside.${failed ? ` ${failed}.` : ""}`,
      { href: "/admin", label: "See the findings" });
  }

  const a = now.assess;
  if (isLive(before.assess.status) && a.scoring_run_id === before.assess.scoring_run_id && a.status === "completed") {
    const skipped = a.skipped ?? 0;
    return done("assess", `assess:${a.scoring_run_id}`,
      `✓ Assessed ${plural((a.techs_done ?? 0) - skipped, "technology", "technologies")}${skipped ? ` (${skipped} skipped)` : ""}.`,
      { href: `/admin/scoring/assessments/${a.scoring_run_id}`, label: "Open the assessment run" });
  }

  const job = now.pov.job;
  if (before.pov.job?.status === "running" && job?.id === before.pov.job.id && job.status === "completed") {
    return done("write", `write:${job.id}`,
      `✓ Wrote ${plural(job.done - job.failed, "Point of View", "Points of View")}${job.failed ? ` (${job.failed} failed)` : ""}.`,
      { href: "/admin/scoring/pov", label: "Open Points of View" });
  }
  return null;
}
