// A technology's classification as the radar uses it (services/
// classify_effective): each answer with where it came from, its reason and
// the pages it rests on; and where the technology stands (radar_status).

export type Source = "person" | "assessment" | "pages" | "none";
export const SOURCE_WORDS: Record<Source, string> = {
  person: "set by a person", assessment: "from its assessment", pages: "from its pages", none: "not known yet",
};

type Answer = { source: Source; reason: string | null; pages: string[]; at: string | null; tz?: string | null;
  decision_id?: string | null;
  imported?: string | null; // under a move: the catalog file it came from; none for a person's own move
};

/** Where an answer came from, in words: the catalog for an imported value. */
export const sourceWords = (a: Pick<Answer, "source" | "imported">) => a.imported ? "from the catalog" : SOURCE_WORDS[a.source];

/** In Tata's catalog (its own list of emerging technologies) or not: from an
 *  import, unless a person added it or took it out (decision_id, for Undo). */
export type Catalog = { in: boolean; decision_id: string | null; at?: string; tz?: string | null };

export type Classification = {
  availability: Answer & { id: string; name: string; emerging: boolean };
  domain: Answer & { id: string; name: string; subdomain_id: string | null; subdomain: string | null; subdomain_new: boolean };
  trl: Answer & { level: number | null; name: string | null; missing?: string | null };
  evidence: { verdict: Verdict; reason: string | null; pages: string[]; read: number; of: number; sources: number; at: string } | null;
  nascent: { flag: { reason: string; quote: string; page: string } | null; decision: "yes" | "no" | null;
    decision_id: string | null; at: string | null; tz: string | null };
  classified_at: string | null;
};

export type Verdict = "strong" | "enough" | "thin" | "not_credible";
export const VERDICT_WORDS: Record<Verdict, string> = {
  strong: "Strong", enough: "Enough to assess", thin: "Thin", not_credible: "Not credible",
};
export const VERDICT_STYLE: Record<Verdict, string> = {
  strong: "bg-emerald-50 text-emerald-800", enough: "bg-navy/[0.07] text-navy",
  thin: "bg-amber-50 text-amber-900", not_credible: "bg-red-50 text-red-800",
};

export type Status = "placed" | "held" | "ready" | "thin" | "no_evidence" | "off";
export const STATUS_LABELS: Record<Status, string> = {
  placed: "Assessed", held: "Assessed, not placed", ready: "Ready to assess", thin: "Thin evidence",
  no_evidence: "No evidence yet", off: "Switched off",
};
export const STATUS_MEANING: Record<Status, string> = {
  placed: "Assessed, and placed on the grid in at least one fabric (computed, or set by a person).",
  held: "Assessed, but not placed on the grid: the evidence couldn't score how soon or how big in any fabric.",
  ready: "Not assessed yet, and its evidence was judged enough (or strong), or a person confirmed it as possibly nascent.",
  thin: "Not assessed: its evidence was judged thin or not credible; or, before its evidence is judged, it has fewer pages than Setup › Settings asks for.",
  no_evidence: "No pages about it yet, such as an imported or hand-added technology.",
  off: "Left out of assessments and Points of View, while its pages are still collected.",
};
export const STATUS_STYLE: Record<Status, string> = {
  placed: "bg-navy/[0.07] text-navy", held: "bg-amber-50 text-amber-900", ready: "bg-azure/15 text-navy",
  thin: "bg-neutral-100 text-muted", no_evidence: "bg-neutral-100 text-neutral-400", off: "bg-neutral-100 text-neutral-400",
};

export type View = "tracked" | "not_assessed" | "emerging" | "emerging_new" | "mature" | "mature_not_on_tata" | "nascent"
  | "imported_thin" | "off";
export const VIEW_LABELS: Record<View, string> = {
  tracked: "Assessed", not_assessed: "Not assessed", emerging: "Emerging", emerging_new: "New to Tata",
  mature: "Mature", mature_not_on_tata: "Blind spots", nascent: "Possibly nascent",
  imported_thin: "In catalog, thin evidence", off: "Switched off",
};
// {emerging}: the commercial availability values that count as emerging (Setup › Classification)
export const VIEW_MEANING: Record<View, string> = {
  tracked: "Assessed: it has scores, and usually a Point of View.",
  not_assessed: "Not assessed yet; each row says why: ready, thin evidence, or no pages.",
  emerging: "Its commercial availability is {emerging}, or it's in the catalog with no value yet. Least mature first: by availability, then TRL.",
  emerging_new: "New to Tata: emerging, and not in the catalog. Least mature first: by availability, then TRL.",
  mature: "Its commercial availability is Mature. Lowest TRL first.",
  mature_not_on_tata: "Blind spots: mature, and not in the catalog. Lowest TRL first.",
  nascent: "Flagged as possibly nascent: new, with a strong early sign. Yes lets it be assessed despite thin evidence and moves it to Research or Pilot; No sets it aside until a new page flags it again.",
  imported_thin: "In the catalog, with thin evidence or no pages yet: candidates for Find evidence. One leaves this group once Find evidence finds enough pages.",
  off: "Switched off: left out of assessments, pages still collected.",
};
export const VIEW_ORDER: View[] = ["tracked", "not_assessed", "emerging", "emerging_new", "mature", "mature_not_on_tata",
  "nascent", "imported_thin", "off"];

/** How many rows each filter value holds (the API's `facets`): each counted
 *  over the view and every other filter, so it's what choosing it shows. */
export type Facets = {
  availability: Record<string, number>;
  domain: Record<string, number>;
  subdomain?: { id: string; name: string; n: number }[]; // within the chosen domain
  trl: Record<string, number>; // "1"–"9", "none"
  evidence: Record<string, number>; // a verdict, or "none"
  fabric: Record<string, number>;
  catalog: Record<"yes" | "no", number>;
};

export type CitedPage = { title: string | null; url: string; source: string; date: string };
export type ListItem = { _id: string; name: string; definition?: string; level?: number; domain_id?: string;
  status?: string; order?: number; emerging?: boolean; catch_all?: boolean; technologies?: number;
  date?: string }; // an assumption's: the day it was stated
