// Signals: never-miss signals add emphasis to a page's summary; Can ignore
// rules set qualifying pages aside (kept, but not used for technologies or assessments).
// A finding is one development found on a page; its type is a never-miss
// signal from the list, or Other.

export type Mode = "never_miss" | "can_ignore";

export const MODE_LABELS: Record<Mode, string> = {
  never_miss: "Never miss",
  can_ignore: "Can ignore",
};

export type SignalRow = {
  _id: string;
  signal_id: string;
  name: string;
  look_for: string;
  mode: Mode;
  enabled: boolean;
  order?: number; // the list's order: the order the Briefing lists findings in
  hits_total: number;
  hits_last_run: number;
  updated_at?: string;
};

export type RecheckJob = {
  _id: string;
  status: string; // running | completed | interrupted | failed
  stage?: string;
  total: number;
  done: number;
  failed: number;
  started_at: string;
  finished_at?: string | null;
};

export type SignalsResponse = {
  signals: SignalRow[];
  current_hash: string;
  stale_pages: number;
  checkable_pages: number; // what any change to the list marks as not yet checked
  recheck: RecheckJob | null;
};

/** One signal found on a page (documents.signals). */
export type Hit = {
  signal_id: string;
  name: string;
  label: string | null;
  headline?: string | null; // short, from summaries written since 4 Oct
  what: string | null;
  who: string | null;
  when: string | null;
  quote: string;
  implication: string | null;
};

export type FoundHit = Hit & {
  doc_id: string;
  n: number; // the hit's place on its page; the side panel's address is ?signal=<doc_id>:<n>
  url: string;
  title: string | null;
  source_id: string;
  run_id: string;
  scraped_at: string;
  published_date: string | null; // "2026-10-01"
  older: boolean; // its page was published more than 30 days before it was collected
  technologies: string[]; // the finding's own when it has them, otherwise its page's
  technology_ids: (string | null)[]; // aligned with technologies; null when not in the register
  also?: { source: string; url: string }[]; // the same story on other pages (the Briefing's order groups copies)
};

/** GET /api/signals/found */
export type FoundResponse = { hits: FoundHit[]; total: number };

/** GET /api/briefing: the scope, its counts and the signal types found, in the list's order. */
export type BriefingSummary = {
  scope: { days: string; from: string | null; to: string }
    | { run_id: string; started_at: string; finished_at: string | null; status: string; error: string | null };
  counts: { findings: number; pages: number; older: number };
  types: { signal_id: string; name: string; count: number; older: number }[];
  freshness: { run_id: string; finished_at: string; sources: number; new_pages: number } | null;
  updating_days?: number; // earlier days a Check again changed, still being brought up to date in the background
};

/** Why a page couldn't be analysed, wholly or in part (documents.analysis_error). */
export type AnalysisError = {
  reason: string; // "model call failed" | "reply not in the expected format" | "some parts failed" | "unexpected error"
  detail: string;
  at: string;
};

export type OtherGroup = {
  label: string;
  count: number;
  examples: { what: string | null; url: string; doc_id: string; scraped_at: string }[];
};

export type SetAsidePage = {
  doc_id: string;
  url: string;
  title: string | null;
  source_id: string;
  run_id: string;
  ignored_by: string;
  rule_name: string;
  summary_text: string | null;
  scraped_at: string;
};

/** The chip text: a row's name, or "Other" with the label the model gave it. */
export const hitName = (h: Hit) => (h.signal_id === "other" ? `Other · ${h.label ?? ""}` : h.name);

/** Never-miss chips are filled navy; Other chips have a dashed outline. */
export const chipStyle = (h: Pick<Hit, "signal_id">) =>
  `inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
    h.signal_id === "other" ? "border border-dashed border-navy text-navy" : "bg-navy text-white"}`;

/** The headline a row shows: the short one when the summary wrote it. */
export const headlineOf = (h: FoundHit) => h.headline || h.what || h.title || h.url;

/** "Who: Aleph Alpha · When: 2026-10-03", leaving out what isn't known. */
export const whoWhen = (h: Hit) =>
  [h.who && `Who: ${h.who}`, h.when && `When: ${h.when}`].filter(Boolean).join(" · ");

/** "Add to signal list": the Signal list's add form, filled in from an Other finding. */
export const makeSignalHref = (label: string | null, what: string | null) =>
  `/admin/signals/list?${new URLSearchParams({ name: label ?? "", look_for: what ?? "" })}`;

/** A page's address without the scheme or "www.", as "aleph-alpha.com". */
export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
