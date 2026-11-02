"use client";

// Where the value lands (use cases and their lever chains), the path to
// scale and the blockers, as the API gives them; and the fabrics' lists (levers, key metrics, blockers) and the
// mechanisms' names, read from Setup.

import { useEffect, useState } from "react";
import { errorText, fetchJson } from "@/lib/api";
import type { CitedPage } from "@/lib/classification";

export type Lever = { lever_id: string; order?: number; mechanism_id: string; operating_change: string; metric: string;
  financial_effect: string; evidence_needed: string; next_step_when: string; pages: string[]; evidence?: "cited" | "needed" };
/** A use case's ballpark size (28 Oct review): from a page, from a comparable market's page, or none with why;
 *  `words` and `band` are worked out by the server. */
export type Size = { basis: "evidence" | "comparable" | "none"; words: string; band?: string | null; page?: string;
  comparable?: string | null; why_comparable?: string | null; reason?: string | null; evidence_needed?: string | null;
  refs?: number[] };
export type UseCase = { key: string; title: string; rank: number; cited: boolean; suggested: boolean; pages?: string[];
  levers?: Lever[]; capital?: { direction: "light" | "moderate" | "heavy" | null; why: string }; why?: string; size?: Size | null };
export type PathStep = { _id: string; name: string; order: number; evidence_needed: string; decision: string; needs?: string[] };
/** Where a held note came from: "set for this technology" with when. */
export type Source = { source: string; at?: string; tz?: string | null };
export type Need = { key: string; label: string; where: "assessment" | "finance" | "figures"; have: boolean };
export type Brief = { _id: string; at: string; tz: string | null; reason: string | null };
/** A technology in a fabric's path to scale, as the API gives it under `finance` (the stored name): the step
 *  reached, the next step and what it still needs, the notes and price held for it, and the blockers picked. */
export type Finance = {
  step: { id: string; name: string; order: number } | null;
  step_decision: Brief | null;
  next_step: { id: string; name: string; order: number; needs: Need[]; in_hand: boolean } | null;
  entered: Brief | null;
  price: (Source & { value: number }) | null;
  notes: Record<"buyer" | "budget" | "exposed_contracts" | "cost_per_outcome", (Source & { value: string }) | null>;
  bottlenecks: { picked: string[]; other: string; decision: Brief } | null;
};
export type Pages = Record<string, CitedPage>;
/** A blocker from the fabric's list that the model read on a page: why, the words, and the page. */
export type SuggestedBlocker = { name: string; why: string; quote: string; page: string };

export const CHAIN: [keyof Lever, string][] = [["operating_change", "Operating change"], ["metric", "Metric"],
  ["financial_effect", "Financial effect"], ["evidence_needed", "Evidence needed"], ["next_step_when", "Next step when"]];
export const NOTES = ["buyer", "budget", "exposed_contracts", "cost_per_outcome"] as const;

/** What's held for the next step now (the notes and price), so a new choice changes one and keeps the rest. */
export function storedFinance(f: Finance): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const k of NOTES) if (f.notes[k]) out[k] = f.notes[k]!.value;
  if (f.price) out.price = f.price.value;
  return out;
}

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
