export type Fabric = {
  _id: string;
  name: string;
  definition: string;
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

export function OpenQuestionBadge({ question }: { question: string | null }) {
  if (!question?.trim()) return null;
  return (
    <span className="bg-amber-100 px-2 py-0.5 font-mono text-[11px] uppercase text-amber-900">
      open
    </span>
  );
}
