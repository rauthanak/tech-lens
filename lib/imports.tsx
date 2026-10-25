import type { Target } from "@/components/AddTechnology";
import { formatAt, formatDay, plural } from "@/lib/format";

// What the Import page and its review share: the import as the API serves it
// (tech-atlas services/imports), its words and the styles its cards use.

export type Field = "availability" | "domain" | "subdomain" | "trl";
export type Status = "reviewing" | "ready" | "confirmed" | "discarded";
export type Decision = "accept" | "reject" | null;
export type Item = {
  row: number;
  name: string;
  values: Partial<Record<Field | "description", string>>;
  group: "matched" | "unmatched" | "proposed" | "new";
  target_tech_id: string | null;
  target_name: string | null;
  decision: Decision;
  repeats?: number[];
  why?: string | null; // a match proposed by code, not the model: why
  kept_apart?: { tech_id: string; name: string }; // the skill folded it in; code kept it apart as narrower
};
export type Unknown = { field: Field; value: string; count: number; map_to: string | number | null; keep?: boolean | null;
  domain_id?: string };
export type Counts = { matched: number; proposed: number; new: number; unmatched: number; accepted: number; rejected: number;
  values_to_map: number; values_waiting?: number }; // values_waiting: not on imports made before 21 Oct
export type Result = { joined: number; added: number; shared?: number };
export type Reopened = { at: string; tz: string; rows: number[]; withdrawn: number };
export type Summary = { _id: string; file: string; sheet: string; at: string; tz: string | null; status: Status; rows: number;
  counts: Counts; result?: Result;
  confirmed_at?: string | null; reopened?: Reopened[]; // a confirmed import whose matches came back for review
  waiting?: number; // proposed matches waiting for a decision (the list's own count)
  // a newer import of the same file, confirmed after this one: it settled this one's rows
  replaced_by?: { id: string; at: string; tz: string | null; confirmed_at: string | null; confirmed_tz: string | null } | null };
export type Import = Summary & { columns: string[]; items: Item[]; unknown_values: Unknown[]; calls: number;
  targets: Record<string, Target> };

export const COLUMNS = ["Technology Name", "Domain", "Sub-domain", "Description", "TRL", "Commercial Availability"];
export const FIELD_WORDS: Record<Field, string> = {
  availability: "Commercial availability", domain: "Domain", subdomain: "Sub-domain", trl: "TRL",
};
export const CARD = "mt-5 rounded-card border border-line bg-white px-5 py-4";
export const SMALL_PRIMARY = "rounded-full bg-navy px-2.5 py-0.5 text-xs text-white hover:bg-navy-strong disabled:opacity-50";
export const SMALL_SECONDARY = "rounded-full border border-line bg-white px-2.5 py-0.5 text-xs text-ink hover:bg-ground disabled:opacity-50";
export const SECONDARY = "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-ink hover:bg-ground disabled:opacity-50";
export const TH = "border-b border-neutral-100 text-left text-[11px] uppercase tracking-wider text-neutral-500";
export const KEEP = "__keep"; // the select's "Keep as written" choice for a sub-domain
export const LEAVE = "__leave"; // its "Leave it out" choice ("" is a sub-domain still waiting for one)

export const editableStatus = (s: Status) => s === "reviewing" || s === "ready";
/** Confirmed once, then matches reopened for review: what it last did, and what came back. */
export const reopenedOf = (s: Summary) =>
  editableStatus(s.status) && s.confirmed_at && s.result && s.reopened?.length ? s.reopened[s.reopened.length - 1] : null;
/** "Confirmed Oct 20 · 115 joined, 885 added". */
export const confirmedWords = (s: Summary) => s.result
  ? `Confirmed ${formatDay(s.confirmed_at)} · ${s.result.joined.toLocaleString()} joined, ${s.result.added.toLocaleString()} added`
  : "Confirmed";
export const waitingOf = (c: Counts) => Math.max(0, c.proposed - c.accepted - c.rejected);
export const isOrAre = (n: number) => (n === 1 ? "is" : "are");
export const waitsOrWait = (n: number) => (n === 1 ? "waits" : "wait");

/** The rows that would join each technology another row also joins: exact
 *  matches and proposed ones not rejected. Confirm sets none of their values. */
export function sharedTargets(items: Item[]): Map<string, Item[]> {
  const by = new Map<string, Item[]>();
  for (const it of items)
    if (it.target_tech_id && (it.group === "matched" || (it.group === "proposed" && it.decision !== "reject")))
      by.set(it.target_tech_id, [...(by.get(it.target_tech_id) ?? []), it]);
  return new Map([...by].filter(([, rows]) => rows.length > 1));
}

/** "Early Commercial · Cloud › Edge-Cloud Convergence · TRL 6", from the file's words. */
export function fileValues(v: Item["values"]): string {
  const where = [v.domain, v.subdomain].filter(Boolean).join(" › ");
  return [v.availability, where, v.trl && `TRL ${v.trl}`].filter(Boolean).join(" · ") || "No values in the file";
}

export function statusWords(s: Summary): { text: string; style: string } {
  if (s.status === "confirmed") return { text: "Confirmed", style: "bg-emerald-50 text-emerald-800" };
  if (s.replaced_by) return { text: "Replaced by a newer import", style: "bg-neutral-100 text-muted" };
  const decide = s.waiting ?? waitingOf(s.counts);
  if (decide) return { text: `${plural(decide, "match", "matches")} ${waitsOrWait(decide)} for your decision`,
    style: "bg-amber-50 text-amber-900" };
  if (reopenedOf(s)) return waitingOf(s.counts) || s.counts.values_waiting
    ? { text: "Reopened for review", style: "bg-amber-50 text-amber-900" }
    : { text: "Reopened, ready to confirm again", style: "bg-azure/15 text-navy" };
  if (s.status === "discarded") return { text: "Discarded", style: "bg-neutral-100 text-muted" };
  if (s.counts.unmatched) return { text: "Waiting to be matched", style: "bg-amber-50 text-amber-900" };
  return waitingOf(s.counts) || s.counts.values_waiting ? { text: "Waiting for your review", style: "bg-amber-50 text-amber-900" }
    : { text: "Ready to confirm", style: "bg-azure/15 text-navy" };
}

export function countsLine(s: Summary): string {
  if (s.replaced_by)
    return `The ${formatAt(s.replaced_by.at, s.replaced_by.tz)} import of the same file was confirmed after it and settled its rows`;
  if (s.status === "confirmed" && s.result)
    return `${s.result.joined.toLocaleString()} joined · ${s.result.added.toLocaleString()} added` +
      (s.result.shared ? ` · ${plural(s.result.shared, "row")} sharing a technology` : "");
  const back = reopenedOf(s);
  if (back) return `${confirmedWords(s)} · ${plural(back.rows.length, "match", "matches")} reopened ${formatDay(back.at)} for review`;
  const c = s.counts;
  return [`${c.matched.toLocaleString()} matched exactly`, `${c.proposed.toLocaleString()} proposed`,
    `${c.new.toLocaleString()} new`, ...(c.unmatched ? [`${c.unmatched.toLocaleString()} not matched yet`] : [])].join(" · ");
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-card border border-line bg-white px-5 py-4 text-sm text-muted">{children}</p>;
}
