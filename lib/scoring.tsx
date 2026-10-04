export type Fabric = {
  _id: string;
  name: string;
  definition: string;
  tcl_today?: string | null; // what TCL runs in it, from its website
  enabled: boolean;
  open_question: string | null;
  version: number;
};

export type Measure = {
  _id: string;
  code: string;
  name: string;
  axis: "market_potential" | "strategic_fit" | "adoption_readiness" | "extra";
  weight: number | null;
  definition: string;
  anchors: { low: string; mid: string; high: string };
  required_evidence: string;
  open_question: string | null;
  version: number;
};

export const AXIS_LABELS: Record<string, string> = {
  market_potential: "Market Potential",
  strategic_fit: "Strategic Fit",
  adoption_readiness: "Adoption Readiness",
  extra: "Outside TORA (scored alongside)",
};

export const AXIS_ORDER = [
  "market_potential",
  "strategic_fit",
  "adoption_readiness",
  "extra",
] as const;

/** One of a fabric's three headline scores, as the assessment stores it:
 *  `scored` of its `of` measures had enough evidence to score. */
export type Axis = { score: number | null; scored?: number; of?: number; partial?: boolean };

/** Where a fabric lands, and the two things it's worked out from: how soon
 *  the technology arrives (which also sets the horizon) and how big the prize is. */
export type Placement = {
  priority: string | null;
  horizon: string | null;
  timeline?: { score: number | null; band?: string | null; scored?: number; of?: number; partial?: boolean };
  potential?: { score: number | null; band?: string | null; scored?: number; of?: number; partial?: boolean };
};

/** A 0–10 score with at most one decimal: 7.29 → "7.3", 8 → "8". */
export const formatScore = (n: number) => String(Math.round(n * 10) / 10);

/** What a score rests on, in words: nothing when every measure was scored,
 *  "1 of 3 measures" when only some were, "not enough evidence (0 of 3)"
 *  when none were (no score at all, which isn't a zero). */
export function scoreNote(axis: Axis | null | undefined): string {
  if (!axis) return "";
  if (axis.score == null) return axis.of ? `not enough evidence (0 of ${axis.of})` : "not enough evidence";
  return axis.of && (axis.scored ?? axis.of) < axis.of ? `${axis.scored} of ${axis.of} measures` : "";
}

/** Why a fabric has no priority, or null when it has one (or the reason
 *  isn't recorded). How soon also sets the horizon, so it's missing too. */
export function noPriorityReason(p: Placement | null | undefined): string | null {
  if (!p || p.priority || (!p.timeline && !p.potential)) return null;
  const soon = p.timeline?.score == null, big = p.potential?.score == null;
  if (soon) return `No priority or horizon yet: not enough evidence on how soon it arrives${big ? " or how big the prize is" : ""}.`;
  return big ? "No priority yet: not enough evidence on how big the prize is." : "No priority yet.";
}

export function OpenQuestionBadge({ question }: { question: string | null }) {
  if (!question?.trim()) return null;
  return (
    <span className="bg-neutral-100 px-2 py-0.5 font-mono text-[11px] uppercase text-ink">
      ? open
    </span>
  );
}
