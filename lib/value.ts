"use client";

// Where the value lands (use cases and their lever chains), the path to
// scale, the blockers and the finance screen, as the API gives them; and the fabrics' lists (levers, key metrics, blockers) and the
// mechanisms' names, read from Setup.

import { useEffect, useState } from "react";
import { errorText, fetchJson } from "@/lib/api";
import type { CitedPage } from "@/lib/classification";
import { formatDay } from "@/lib/format";

export type Lever = { lever_id: string; order?: number; mechanism_id: string; operating_change: string; metric: string;
  financial_effect: string; evidence_needed: string; next_step_when: string; pages: string[]; evidence?: "cited" | "needed" };
export type UseCase = { key: string; title: string; rank: number; cited: boolean; suggested: boolean; pages?: string[];
  levers?: Lever[]; capital?: { direction: "light" | "moderate" | "heavy" | null; why: string }; why?: string };
export type PathStep = { _id: string; name: string; order: number; evidence_needed: string; decision: string; needs?: string[] };
/** Where an input came from: "fabric default", or "set for this technology" with when. */
export type Source = { source: string; at?: string; tz?: string | null };
export type Input = Source & { value: number };
export type Figure = { value: number | null; label?: string; formula?: string; unit?: string; months?: number; volume?: number; note?: string };
export type Need = { key: string; label: string; where: "assessment" | "finance" | "figures"; have: boolean };
export type Brief = { _id: string; at: string; tz: string | null; reason: string | null };
export type Finance = {
  step: { id: string; name: string; order: number } | null;
  step_decision: Brief | null;
  next_step: { id: string; name: string; order: number; needs: Need[]; in_hand: boolean } | null;
  needed: boolean;
  asks: boolean;
  entered: Brief | null;
  mechanism: Source & { value: "protect" | "earn" };
  margin: Input | null; revenue: Input | null; displaced: Input | null;
  upfront: Input | null; running: Input | null; volume: Input | null; price: Input | null;
  loss_without: Input | null; loss_with: Input | null;
  notes: Record<"buyer" | "budget" | "exposed_contracts" | "cost_per_outcome", (Source & { value: string }) | null>;
  contribution?: Figure; payback?: Figure; break_even?: Figure;
  missing: Partial<Record<"contribution" | "payback" | "break_even", string[]>>;
  bottlenecks: { picked: string[]; other: string; decision: Brief } | null;
};
export type Pages = Record<string, CitedPage>;
/** A blocker from the fabric's list that the model read on a page: why, the words, and the page. */
export type SuggestedBlocker = { name: string; why: string; quote: string; page: string };

export const CHAIN: [keyof Lever, string][] = [["operating_change", "Operating change"], ["metric", "Metric"],
  ["financial_effect", "Financial effect"], ["evidence_needed", "Evidence needed"], ["next_step_when", "Next step when"]];
export const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
export const percent = (share: number) => `${Math.round(share * 1000) / 10}%`;

/** A worked-out figure: money to the whole unit, or a number in its own unit ("2.35 years"). */
export const figureText = (value: number, unit?: string) =>
  unit ? `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}` : money(value);

/** "fabric default", or "set for this technology on Oct 21". */
export const sourceText = (s: Source) => (s.at ? `${s.source} on ${formatDay(s.at)}` : s.source);

/** Whether any of the three figures is worked out yet. */
export const hasFigures = (f: Finance) => [f.contribution, f.payback, f.break_even].some((x) => x?.value != null);

export type FabricValue = { name: string; key_metrics?: string; bottlenecks?: string[];
  levers?: { lever_id: string; name: string; mechanism_id: string }[] };
export type ValueLists = {
  fabrics: Record<string, FabricValue>;
  levers: Record<string, { name: string; order: number }>;
  mechanisms: Record<string, string>;
  error: string | null;
};

/** Every fabric's levers, key metrics and blockers, and the mechanisms' names,
 *  from Setup. Until they load (or if they can't), chains show ids. */
export function useValueLists(): ValueLists {
  const [lists, setLists] = useState<ValueLists>({ fabrics: {}, levers: {}, mechanisms: {}, error: null });
  useEffect(() => {
    Promise.all([
      fetchJson<{ fabrics: (FabricValue & { _id: string })[] }>("/api/scoring/fabrics"),
      fetchJson<{ items: { _id: string; name: string }[] }>("/api/lists/mechanisms"),
    ]).then(([f, m]) => setLists({
      fabrics: Object.fromEntries(f.fabrics.map((x) => [x._id, x])),
      levers: Object.fromEntries(f.fabrics.flatMap((x) => (x.levers ?? []).map((l, i) => [l.lever_id, { name: l.name, order: i + 1 }]))),
      mechanisms: Object.fromEntries(m.items.map((x) => [x._id, x.name])),
      error: null,
    })).catch((e) => setLists((l) => ({ ...l, error: errorText(e) })));
  }, []);
  return lists;
}
