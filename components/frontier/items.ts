import type { Pov, PovFabric } from "@/components/PovText";
import { ApiError, fetchJson } from "@/lib/api";
import type { Verdict } from "@/lib/classification";
import { formatDate } from "@/lib/format";
import { withFrom } from "@/lib/here";
import { PRIORITY } from "@/lib/theme";

/** A stage in Tata's buckets (the effective commercial availability):
 *  known is false for the catch-all, "not judged yet". */
export type Stage = { id: string; name: string; emerging: boolean; known: boolean };

/** What a leader has recorded for a technology in a fabric (deck p.13), and
 *  the state it follows; `needs` is what the next state still needs. */
export type Leader = {
  state: LeaderState;
  needs: string | null;
  owner: string | null;
  next_action: string | null;
  due: string | null; // a day, "2026-11-15"
  people: string | null;
  budget: string | null;
  poc: string | null;
};

export type LeaderState = "undefined" | "defined" | "aligned" | "integrated";

/** The states in order, each with what it means. */
export const LEADER_STATES: { id: LeaderState; name: string; means: string; chip: string }[] = [
  { id: "undefined", name: "No owner yet", means: "nobody answers for it yet", chip: "bg-neutral-100 text-muted" },
  { id: "defined", name: "Defined", means: "an owner and a next action", chip: "bg-azure/15 text-navy" },
  { id: "aligned", name: "Aligned", means: "the step reached and its blockers recorded too", chip: "bg-navy/15 text-navy" },
  { id: "integrated", name: "Integrated", means: "people, budget or a trial committed too", chip: "bg-emerald-100 text-emerald-900" },
];

/** A placement whose priority moved since the edition before: from what, and why. */
export type Move = { from: string | null; reason: string; by_person: boolean;
  why?: string | null }; // the score that moved: "how big 5 → 7 after 40 new pages"

/** One technology in one fabric, as an edition holds it (GET /api/frontier). */
export type Item = {
  tech_id: string;
  name: string;
  fabric_id: string;
  fabric: string;
  stage: Stage;
  priority: string | null;
  computed_priority: string | null;
  override: boolean;
  override_reason: string | null;
  horizon: string | null;
  how_soon: number | null;
  how_big: number | null;
  soon_scored: [number | null, number | null]; // [measures scored, of]
  big_scored: [number | null, number | null];
  path_step: string | null;
  pov: { scoring_run_id: string; composed_at: string; composed_tz: string | null; headline: string | null } | null;
  threat: number | null; // Disruption threat, the Defence lens's height
  threat_missing: string | null; // why there's none
  leader: Leader;
  moved?: Move;
  evidence?: Verdict | null; // how solid its evidence is (editions from 24 Oct on)
  pages?: number | null;     // the pages its assessment read
};

export type Held = Item & { reason: string };

/** A published edition, without its placements. */
export type Edition = {
  _id: string;
  name: string | null;
  label: string; // its name, else the day it was published
  published_at: string;
  tz: string | null;
  previous: { _id: string; name: string | null; label: string; published_at: string; tz: string | null } | null;
  counts: { placements: number; held: number; povs: number; moved: number; technologies: number };
};

export type Evidence = {
  sources_on: number;
  pages_read: number;
  signals_found: number;
  technologies: number;
  by_signal_type: { signal_id: string; name: string; count: number }[];
};

export type Published = {
  edition: Edition;
  placed: Item[];
  held: Held[];
  fabrics: { id: string; name: string }[];
  stages: Stage[];
  cutpoints: { how_soon: [number, number]; how_big: [number, number] };
  near_band: number;
  assumptions: { statement: string; date: string | null }[];
  evidence: Evidence;
};

/** GET /api/frontier: the latest edition, or none published yet. */
export type Frontier = Published | { edition: null };

/** Growth reads up as how big the prize is; Defence as the Disruption threat.
 *  `name`: the choice as the reader sees it ("View by"). */
export type Lens = "growth" | "defence";
export const LENS_WORDS: Record<Lens, { name: string; up: string; more: string; less: string }> = {
  growth: { name: "Size of prize (Growth)", up: "How big", more: "Bigger", less: "Smaller" },
  defence: { name: "Threat to today's revenue (Defence)", up: "Disruption threat", more: "More threat", less: "Less threat" },
};
export const upOf = (item: Item, lens: Lens) => (lens === "defence" ? item.threat : item.how_big);

/** The frontier: the placements no other beats on both axes (none is both
 *  sooner and higher up), and those near it, within `band` on both. */
export function frontierOf(items: Item[], lens: Lens, band: number): { on: Set<Item>; near: Set<Item> } {
  const pts = items.filter((i) => i.how_soon != null && upOf(i, lens) != null);
  const x = (i: Item) => i.how_soon as number, y = (i: Item) => upOf(i, lens) as number;
  const on = new Set(pts.filter((p) => !pts.some((q) => x(q) >= x(p) && y(q) >= y(p) && (x(q) > x(p) || y(q) > y(p)))));
  const near = new Set(pts.filter((p) => !on.has(p) && !pts.some((q) => x(q) >= x(p) + band && y(q) >= y(p) + band)));
  return { on, near };
}

/** "P3 → P2 since FY27 Q2". */
export const moveText = (item: Item, since: string | undefined) =>
  item.moved ? `${item.moved.from ?? "no priority"} → ${item.priority}${since ? ` since ${since}` : ""}` : "";

/** Why it moved, in words: the person's reason, or the score that moved ("new
 *  scores" when neither score changed: the edges did). `short` where the
 *  override's reason is already beside it. */
export const moveReason = (m: Move, short = false) =>
  (m.by_person ? (short ? "set by a person, as above" : `set by a person: ${m.reason}`) : m.why ?? m.reason);

const rank = (p: string | null) => (p ? Number(p.slice(1)) : 7);
/** The moves that matter most first: into P1 or P2, then the biggest jumps. */
export const biggestMoves = (items: Item[]) => [...items].sort((a, b) =>
  Number(rank(b.priority) <= 2) - Number(rank(a.priority) <= 2)
  || Math.abs(rank(b.moved?.from ?? null) - rank(b.priority)) - Math.abs(rank(a.moved?.from ?? null) - rank(a.priority))
  || a.name.localeCompare(b.name));

/** What a leader recorded, in a line: "A. Nimbhorkar owns it; next: Pilot with a bank, by Nov 15, 2026". */
export function leaderText(l: Leader): string {
  if (!l.owner) return "No owner yet";
  const resources = ([["people", l.people], ["budget", l.budget], ["proof of concept", l.poc]] as const)
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  const next = (l.next_action ?? "").trim().replace(/\.$/, "");
  return `${l.owner} owns it${next ? `; next: ${next}` : ""}${l.due ? `, by ${formatDate(l.due, true)}` : ""}${resources.length ? `. Committed: ${resources.join("; ")}` : ""}`;
}

export const leaderName = (l: Leader) => LEADER_STATES.find((s) => s.id === l.state) ?? LEADER_STATES[0];

/** Known to be past emerging (Mature, or any later bucket): left off the
 *  default view. One not classified yet stays on it. */
export const pastEmerging = (item: Item) => item.stage.known && !item.stage.emerging;

/** The horizon in words. */
export const HORIZON_WORDS: Record<string, string> = { H1: "Near", H2: "Mid", H3: "Far" };

/** A priority's colour for SVG, from the same P1–P6 ramp as its chips
 *  (lib/theme.ts): "bg-[#1d3b73]" gives the hex, "bg-navy" the theme colour. */
export function priorityFill(priority: string | null): string {
  const bg = (priority && PRIORITY[priority]?.split(" ")[0]) || "";
  const hex = bg.match(/^bg-\[(#[0-9a-fA-F]{3,8})\]$/)?.[1];
  if (hex) return hex;
  return bg.startsWith("bg-") ? `var(--color-${bg.slice(3)})` : "#e5e7eb";
}

/** The pale end of the ramp (dark text on its chip): its dots need an edge on white. */
export const isPale = (priority: string | null) => !!priority && !!PRIORITY[priority]?.includes("text-ink");

/** "2 of 4 measures": how many of a score's measures had enough evidence. */
export function measuresNote([scored, of]: [number | null, number | null]): string {
  return of ? `${scored ?? 0} of ${of} measure${of === 1 ? "" : "s"}` : "";
}

/** What follows "set by a person" for an overridden priority: what the
 *  scores give, when that differs, and the person's reason. */
export function overrideNote(item: Item): string {
  const computed = item.computed_priority && item.computed_priority !== item.priority
    ? ` (the scores give ${item.computed_priority})` : "";
  return `${computed}${item.override_reason ? `: ${item.override_reason}` : "; no reason recorded"}`;
}

/** Where an item's Point of View opens, coming back to `from`; null when none is written. The page
 *  shows the edition's copy, as it stood when the edition was published. */
export function povHref(item: Item, from: string): string | null {
  return item.pov ? withFrom(`/frontier/pov/${item.pov.scoring_run_id}/${item.tech_id}`, from) : null;
}

/** A Point of View as the latest edition holds it: as it stood when the
 *  edition was published, with what a leader had recorded per fabric. */
export type EditionPov = Omit<Pov, "fabrics"> & { edition: Edition; fabrics?: (PovFabric & { leader?: Leader | null })[] };

/** The latest edition's Point of View of a technology, or why there's none (the API's words). */
export const fetchEditionPov = (tech: string): Promise<{ pov: EditionPov | null; missing: string | null }> =>
  fetchJson<EditionPov>(`/api/frontier/pov/${encodeURIComponent(tech)}`)
    .then((pov) => ({ pov, missing: null }))
    .catch((e) => {
      if (e instanceof ApiError && e.status === 404) return { pov: null, missing: e.detail ?? "This edition has no Point of View of it." };
      throw e;
    });
