// A technology's one state (services/evidence on the backend), in words.
// The Technologies list filters by it; the technology page leads with it.

export type TechState = "new_evidence" | "no_pov" | "not_assessed" | "stopped_partway" | "assessing" | "current" | "off";

export const STATE_LABELS: Record<TechState, string> = {
  new_evidence: "New evidence",
  no_pov: "Ready for a Point of View",
  not_assessed: "Not assessed",
  stopped_partway: "Stopped partway",
  assessing: "Being assessed",
  current: "Up to date",
  off: "Switched off",
};

/** What each state means and what to do about it, for someone new to the
 *  radar: the Technologies list shows it under its filter. */
export const STATE_MEANING: Record<TechState, string> = {
  new_evidence: "Assessed before, and new pages about it have arrived since. Assess again to include them.",
  no_pov: "Assessed, but its Point of View isn't written yet.",
  stopped_partway: "Its assessment stopped before finishing. Resume the run to finish it.",
  assessing: "An assessment is running for it now.",
  not_assessed: "Never assessed. Assessments cost model calls, so they run only on the technologies you choose.",
  current: "Its Point of View uses its latest assessment, and no new pages have arrived since. That doesn't mean the evidence is complete: its Point of View lists what's missing.",
  off: "Kept, but left out of assessments. Switch it back on from its page.",
};

/** The filter's order: what needs you first. */
export const STATE_ORDER: TechState[] = ["new_evidence", "no_pov", "stopped_partway", "assessing", "not_assessed",
  "current", "off"];

/** Pill colours: what needs you in azure, finished in quiet grey. */
export const STATE_STYLE: Record<TechState, string> = {
  new_evidence: "bg-azure/15 text-navy",
  no_pov: "bg-azure/15 text-navy",
  stopped_partway: "bg-amber-100 text-amber-900",
  assessing: "bg-azure/15 text-navy",
  not_assessed: "bg-neutral-100 text-muted",
  current: "bg-emerald-50 text-emerald-800",
  off: "bg-neutral-100 text-neutral-400",
};
