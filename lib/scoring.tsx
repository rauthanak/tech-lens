export type Fabric = {
  _id: string;
  name: string;
  definition: string;
  tcl_today?: string | null; // what TCL runs in it, from its website
  enabled: boolean;
  open_question: string | null;
  version: number;
  // where the value lands (Nick's note, corrected by Tata)
  levers?: { lever_id: string; name: string; mechanism_id: string; text: string }[];
  key_metrics?: string;
  bottlenecks?: string[];
  cautions?: string;
  finance_defaults?: { margin_low: number | null; margin_high: number | null; loss_without: number | null; loss_with: number | null };
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
  scope?: MeasureScope;
};

/** How a measure is scored: once for the technology as a whole, in each
 *  fabric, or entered by Tata Communications (never asked of the model). */
export type MeasureScope = "technology" | "fabric" | "tata";
export const SCOPE_LABELS: Record<MeasureScope, string> = {
  technology: "Scored per technology",
  fabric: "Scored per fabric",
  tata: "Entered by Tata",
};
export const SCOPE_MEANING: Record<MeasureScope, string> = {
  technology: "Judged once for the technology as a whole, in its technology call, and the same score is used in every fabric.",
  fabric: "Judged separately in each fabric the technology touches, in that fabric's call.",
  tata: "Not asked of the model: Tata Communications enters it on the technology's page. Until then it waits, and the Before publishing list shows it.",
};

/** The three scores, in order: every screen names them from here. */
export const SCORE_NAMES: Record<string, string> = {
  market_potential: "Market potential",
  strategic_fit: "Strategic fit",
  adoption_readiness: "Adoption readiness",
};
/** A measure's axis: one of the three scores, or scored alongside them. */
export const AXIS_LABELS: Record<string, string> = { ...SCORE_NAMES, extra: "Also scored, not part of the three scores" };
/** What each of the three scores asks, in a few words. */
export const AXIS_MEANING: Record<string, string> = {
  market_potential: "how big the prize could be",
  strategic_fit: "how well it fits Tata",
  adoption_readiness: "how ready it is to adopt now",
};

/** A measure's weight as its share of its score: 0.4 → "40%". */
/** A measure's real share of its score. Scoring divides each weight by the
 *  sum of its score's weights (agent/analyzer/engine.rollup_tora), so 0.4
 *  among weights adding to 1.2 is 33%, not 40%. */
export const weightShare = (w: number | null | undefined, total = 1) =>
  w == null ? "—" : `${Math.round((total > 0 ? w / total : 0) * 100)}%`;

/** Each score's weights added up, by axis: what weightShare divides by. */
export const axisTotals = (measures: Measure[]) =>
  measures.reduce<Record<string, number>>((t, m) => ({ ...t, [m.axis]: (t[m.axis] ?? 0) + (m.weight ?? 0) }), {});

/** The priority and horizon codes in words, for one legend line per list. */
export const PRIORITY_LEGEND = "Priority P1 (act now) to P6 (just watch)";
export const LEGEND = `${PRIORITY_LEGEND}; horizon H1 (near) to H3 (far).`;

/** A horizon as how soon it arrives: "H2" → "mid-term". */
export const HORIZON_TERM: Record<string, string> = { H1: "near-term", H2: "mid-term", H3: "long-term" };

/** The setup settings (scoring_config) by name, for lists that name them. */
export const CONFIG_LABELS: Record<string, string> = {
  tora: "The three scores",
  priority_grid: "Priority grid",
  horizons: "Horizons (near, mid, far)",
  evidence: "Most evidence sent per technology",
  engine: "How an assessment calls the model",
};

/** What each kind of open question is about. */
export const KIND_LABELS: Record<string, string> = { fabric: "Fabric", measure: "Measure", config: "Setting" };

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
  disruptiveness?: { score: number | null; band?: string | null };
  priority_by_disruptiveness?: string | null;
};

/** A 0–10 score with at most one decimal: 7.29 → "7.3", 8 → "8". */
export const formatScore = (n: number) => String(Math.round(n * 10) / 10);

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
    <span className="shrink-0 bg-neutral-100 px-2 py-0.5 text-xs text-ink">
      Open question
    </span>
  );
}
