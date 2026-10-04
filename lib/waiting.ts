import { formatDay, plural } from "@/lib/format";
import type { AnalystItem } from "@/lib/pipeline";

// What waits for the analyst (pipeline.for_analyst), in words, and where
// each item is handled: its technologies on the Technologies list (filtered
// by state, with the batch button), its run, or Operations. The
// Briefing, the status pill and the next-step banner all link here rather
// than spending model calls in place.

const techs = (n: number) => plural(n, "technology", "technologies");

/** One waiting item in one sentence. */
export function itemSentence(item: AnalystItem): string {
  switch (item.kind) {
    case "check": return `${plural(item.count, "older page")} not yet checked against the signal list`;
    case "resume": return `The assessment run of ${formatDay(item.started_at)} stopped with ${techs(item.count)} left`;
    case "assess": return `${plural(item.count, "technology has", "technologies have")} new pages since their assessment`;
    case "write": return `${techs(item.count)} ${item.count === 1 ? "is" : "are"} ready for a Point of View`;
  }
}

/** Where the item is handled. */
export function itemHref(item: AnalystItem): string {
  switch (item.kind) {
    case "check": return "/admin/operations";
    case "resume": return `/admin/scoring/assessments/${item.scoring_run_id}`;
    case "assess": return "/admin/technologies?state=new_evidence";
    case "write": return "/admin/technologies?state=no_pov";
  }
}
