"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import FabricLabel from "@/components/FabricLabel";
import PovValue, { type Fab } from "@/components/PovValue";
import WatchMetrics, { type WatchMetric } from "@/components/WatchMetrics";
import { ApiError, fetchJson } from "@/lib/api";
import { renderCitations, renderRefs, SourceNumbers, sourceNumbers } from "@/lib/citations";
import { type Classification, type Source as ClassSource, SOURCE_WORDS, sourceWords, VERDICT_WORDS } from "@/lib/classification";
import { formatDate, formatDay, plural } from "@/lib/format";
import { useHere, withFrom } from "@/lib/here";
import { type Axis, AXIS_MEANING, formatScore, HORIZON_TERM, LEGEND, PRIORITY_LEGEND, weightShare } from "@/lib/scoring";
import { scoreShade } from "@/lib/theme";
import { type Finance, figureText } from "@/lib/value";

// A Point of View as the analysts' page and the leaders' Frontier both show
// it, the same apart from the admins' controls (PovBody): the verdict, the four
// answers, the recommendation and the use cases, fabric by fabric, first; the
// rest folded, each fold saying what it holds. Every "[n]" on the page, in
// the text and beside it, is a number in its one list of sources, which the
// backend builds.

export type Source = { n: number; url: string; source: string; date: string; title: string; doc_id?: string };

type Refs = { refs?: number[] };
/** Beside a value from the catalog: what the radar itself judged (name null: it couldn't tell). */
type Radar = { radar?: (Refs & { name: string | null; same: boolean; source: ClassSource; reason: string | null }) | null };

/** A measure as the Point of View's assessment left it, people's choices applied. */
export type PovMeasure = Refs & {
  score: number | null;
  state?: "scored" | "scored_by_person" | "gap_accepted" | "waiting_for_tata" | "unscored";
  justification?: string | null;
  counter_case?: string | null;
  missing?: string | null;
  model_score?: number | null;
  reason?: string | null; // a person's, for a hand score or an accepted gap
};

/** One fabric of the assessment the Point of View was written from. */
export type PovFabric = {
  assessment_id: string;
  fabric_id: string;
  fabric: string;
  doc_count?: number;
  created_at?: string;
  tora: Record<string, Axis>;
  priority: string | null;
  computed_priority: string | null;
  horizon: string | null;
  override: { reason: string | null; at: string; tz?: string | null } | null;
  override_moved?: boolean;
  measures: Record<string, PovMeasure>;
  use_cases: (Refs & { title: string; levers: string[]; capital: string | null; capital_why?: string | null })[];
  suggested: string[]; // suggested by the model and accepted by a person
  no_use_case: { reason: string; evidence_needed: string } | null;
  path_step: string | null;
  path_step_order?: number | null; // the step's number, of path_steps
  path_steps?: number;
  figures_from?: { name: string | null; order: number | null }; // the step from which finance figures are asked
  finance: Pick<Finance, "needed" | "contribution" | "payback" | "break_even" | "missing">
    & { bottlenecks?: Finance["bottlenecks"]; next_step?: Finance["next_step"] };
};

export type MeasureMeta = { _id: string; code: string; name: string; axis: string; weight?: number };

export type Pov = {
  scoring_run_id: string;
  tech_id: string;
  technology: string;
  version: number;
  composed_at: string;
  composed_tz?: string | null;
  not_assessed_in?: string[]; // fabrics judged not relevant before scoring
  sections: {
    headline?: string | null;
    summary?: string | null;
    tora_analysis?: Record<string, string | null | undefined> | null; // by axis (AXIS_LABELS)
    other_measures?: string | null;
    placement_rationale?: string | null;
    evidence_gaps?: string | { fabric: string; missing: string[] }[] | null;
    recommendation?: string | null;
    // written before version 4 of the skill, retelling the scores' measures
    maturity?: string | null;
    market_view?: string | null;
    capability_gap?: string | null;
    value?: string | null;
  };
  sources?: Source[];
  citation_problems?: string;
  // what the page shows beside the text (GET .../pov/{tech})
  classification?: {
    availability: Classification["availability"] & Refs & Radar;
    domain: Classification["domain"] & Refs & Radar;
    trl: Classification["trl"] & Refs & Radar;
    evidence: (NonNullable<Classification["evidence"]> & Refs) | null;
  };
  fabrics?: PovFabric[];
  measures?: MeasureMeta[]; // the run's own, for their names
  watch_metrics?: WatchMetric[];
  latest_assessment?: { scoring_run_id: string; fabric_ids: string[]; assessed_at: string } | null; // what PovValue shows
  value?: Fab[]; // an edition's frozen copy of where the value lands (the leaders' view); else PovValue fetches it
};

export const AXIS_LABELS: Record<string, string> = {
  market_potential: "Market Potential",
  strategic_fit: "Strategic Fit",
  adoption_readiness: "Adoption Readiness",
};

export const heading = "font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500";

/** A run's Point of View of a technology, or null when none is written yet. */
export const fetchPov = (run: string, tech: string) =>
  fetchJson<Pov>(`/api/scoring/runs/${run}/pov/${tech}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });

/** One section of the narrative; `covers` names the measures it explains. */
export function Section({ title, covers, text, sources = [] }: {
  title: string; covers?: string; text?: string | null; sources?: Source[];
}) {
  if (!text) return null;
  return (
    <section>
      <div className="break-inside-avoid break-after-avoid">
        <h2 className={heading}>{title}</h2>
        {covers && <p className="mt-1 text-xs text-neutral-500">{covers}</p>}
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-800">{renderCitations(text, sources)}</p>
    </section>
  );
}

/** What the evidence doesn't show yet, fabric by fabric (`fabricIds`: name →
 *  id, for its colour). On paper, one fabric under another, full width and
 *  unboxed, so they fit the page. */
export function EvidenceGaps({ gaps, sources = [], fabricIds = {} }: {
  gaps: Pov["sections"]["evidence_gaps"]; sources?: Source[]; fabricIds?: Record<string, string>;
}) {
  if (typeof gaps === "string") return <Section title="Evidence gaps" text={gaps} sources={sources} />;
  const shown = (gaps ?? []).filter((g) => g.missing?.length);
  if (shown.length === 0) return null;
  return (
    <section>
      <h2 className={heading}>Evidence gaps</h2>
      <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3 print:block print:space-y-3">
        {shown.map((g) => (
          <div key={g.fabric} className="break-inside-avoid rounded-card border border-line bg-white px-4 py-3 print:rounded-none print:border-0 print:p-0">
            <FabricLabel id={fabricIds[g.fabric]} name={g.fabric} />
            <ul className="mt-2 space-y-1.5">
              {g.missing.map((m, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-neutral-700">
                  <span className="text-navy">·</span>
                  <span>{renderCitations(m, sources)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The numbered sources: each page's title, linked, then where and when it was published. */
export function SourceList({ sources = [] }: { sources?: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <ol className="space-y-1.5 text-[13px] leading-snug">
      {sources.map((src) => (
        <li key={src.n} id={`source-${src.n}`} className="flex gap-2">
          <span className="w-7 shrink-0 text-right text-muted">[{src.n}]</span>
          <span className="min-w-0 break-words">
            {src.url ? (
              <a href={src.url} target="_blank" rel="noreferrer" className="text-link hover:underline">
                {src.title || src.url}
              </a>
            ) : src.title}
            <span className="text-muted">
              {[src.source, /^\d{4}-\d{2}-\d{2}/.test(src.date ?? "") ? formatDate(src.date, true) : src.date]
                .filter(Boolean).map((part) => ` · ${part}`).join("")}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A folded part of the page, its label saying what it holds. On paper it
 *  prints open (PovBody), and a fold left closed prints nothing. */
function Fold({ title, hint, className = "", children }: {
  title: string; hint?: string; className?: string; children: ReactNode;
}) {
  return (
    <details className={`pov-fold group/fold rounded-card border border-line bg-white print:rounded-none print:border-0 print:[&:not([open])]:hidden ${className}`}>
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 px-4 py-2.5 hover:bg-ground [&::-webkit-details-marker]:hidden print:px-0">
        <span aria-hidden className="inline-block text-[9px] text-muted transition-transform group-open/fold:rotate-90 print:hidden">▶</span>
        <span className="text-sm font-medium text-ink">{title}</span>
        {hint && <span className="text-xs text-muted print:hidden">{hint}</span>}
      </summary>
      <div className="space-y-6 border-t border-line px-4 py-4 print:border-0 print:px-0">{children}</div>
    </details>
  );
}

function Card({ title, value, children }: { title: string; value?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-white px-4 py-3">
      <div className={heading}>{title}</div>
      {value != null && <div className="mt-1 text-sm font-semibold">{value}</div>}
      <div className="mt-1 space-y-1 text-[12.5px] leading-snug text-neutral-600">{children}</div>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Answered = Refs & Radar & { source: ClassSource; imported?: string | null; reason: string | null; at: string | null };

/** Where an answer came from, with its reason and pages. A value from Tata's
 *  list names the file, and what the radar judged when that differs. */
function From({ a, sources }: { a: Answered; sources: Source[] }) {
  const r = a.radar;
  if (a.imported) return (
    <>
      <p className="text-muted">From the catalog ({a.imported})</p>
      {r?.name && !r.same && (
        <p>The radar judged {r.name}, {SOURCE_WORDS[r.source]}{r.reason ? `: ${r.reason}` : ""} {renderRefs(r.refs, sources)}</p>
      )}
    </>
  );
  return (
    <>
      {a.reason && <p>Why: {a.reason} {renderRefs(a.refs, sources)}</p>}
      <p className="text-muted">{cap(sourceWords(a))}{a.source === "person" && a.at ? `, ${formatDay(a.at)}` : ""}</p>
    </>
  );
}

/** The four answers a reader wants first: the priority (a person's, with
 *  their reason, in words), maturity, commercial availability and evidence,
 *  each with where it came from, why, and its pages. */
function Answers({ pov }: { pov: Pov }) {
  const src = pov.sources ?? [];
  const { trl, availability: av, evidence: ev } = pov.classification ?? {};
  // fabrics with the same priority and horizon share a line; a person's priority has its own, with their reason
  const lines = new Map<string, PovFabric[]>();
  for (const f of pov.fabrics ?? []) {
    const key = f.override ? `person:${f.fabric_id}` : `${f.priority}|${f.horizon}`;
    lines.set(key, [...(lines.get(key) ?? []), f]);
  }
  return (
    <div className="mt-6 grid break-inside-avoid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card title="Priority">
        {lines.size === 0 && <p>Not set: the assessment it was written from is no longer stored.</p>}
        <ul className="space-y-1.5">
          {[...lines.values()].map((fs) => {
            const f = fs[0];
            return (
              <li key={f.fabric_id}>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-sm font-semibold text-ink">{f.priority ? `${f.priority} of 6` : "No priority yet"}</span>
                  {f.priority && f.horizon && <span>· arrives {HORIZON_TERM[f.horizon] ?? f.horizon} ·</span>}
                  {fs.map((x) => <FabricLabel key={x.fabric_id} id={x.fabric_id} name={x.fabric} />)}
                </div>
                {f.override && (
                  <p className="mt-0.5 text-amber-900">
                    Set by a person{f.computed_priority !== f.priority ? `; the scores give ${f.computed_priority ?? "no priority"}` : ""}
                    {f.override_moved ? ", which has moved since it was set" : ""}. Their reason: {f.override.reason ?? "none recorded"}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {lines.size > 0 && <p className="text-muted">{PRIORITY_LEGEND}.</p>}
      </Card>
      <Card title="Maturity" value={trl?.level ? `TRL ${trl.level} of 9` : "Not known yet"}>
        {trl?.level ? (
          <>
            {trl.name && <p className="text-ink">{trl.name}</p>}
            <From a={trl} sources={src} />
          </>
        ) : (
          <p>What&apos;s missing: {trl?.missing || "no page shows how far it has got. A dated trial, pilot or production deployment would."}</p>
        )}
      </Card>
      <Card title="Commercial availability" value={av?.name ?? "Not known yet"}>
        {av && <From a={av} sources={src} />}
      </Card>
      <Card title="Evidence" value={ev ? VERDICT_WORDS[ev.verdict] : "Not judged yet"}>
        {ev ? (
          <>
            {ev.reason && <p>{ev.reason} {renderRefs(ev.refs, src)}</p>}
            {ev.of > 0 && <p className="text-muted">Evidence judged on {plural(ev.of, "page")} from {plural(ev.sources, "source")}</p>}
          </>
        ) : <p>The radar hasn&apos;t rated how solid its pages are yet.</p>}
      </Card>
    </div>
  );
}

const FIGURES = [["contribution", "Contribution", " a year"], ["payback", "Payback", ""],
  ["break_even", "Break-even revenue", " a year"]] as const;

/** A capital reason's first sentence, without a leading "Light:" that repeats the level. */
const firstSentence = (why: string, level: string) => {
  const s = why.replace(new RegExp(`^${level}\\s*[:—-]\\s*`, "i"), "").split(/(?<=\.)\s/)[0];
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Up to three source numbers, then "+n" to show the rest. */
function FewRefs({ refs, sources }: { refs: number[] | undefined; sources: Source[] }) {
  const [all, setAll] = useState(false);
  const n = refs?.length ?? 0;
  return (
    <>
      {renderRefs(all ? refs : refs?.slice(0, 3), sources)}
      {!all && n > 3 && (
        <button type="button" onClick={() => setAll(true)} title="Show the other sources"
          className="ml-1 text-[12px] text-link hover:underline print:hidden">+{n - 3}</button>
      )}
    </>
  );
}

/** The use cases as a table: per fabric, each use case with its sources and
 *  the investment it needs (with why); then, for the fabric, how far Tata has
 *  got on its path to scale and whether it pays, from Tata's own figures. A
 *  note under it says what those two mean and where they're entered
 *  (`financeHref`: the admins' link to the finance card). How each one makes
 *  money is in a fold below. */
function ValueSummary({ pov, financeHref }: { pov: Pov; financeHref?: (fabricId: string) => string }) {
  const src = pov.sources ?? [];
  const fabrics = pov.fabrics ?? [];
  if (fabrics.length === 0) return null;
  const steps = fabrics[0].path_steps;
  const from = fabrics[0].figures_from?.name ? fabrics[0].figures_from : { name: "Proof of concept", order: null };
  const cell = "px-3 py-2.5 align-top";
  type Row = { title?: string; refs?: number[]; capital?: string | null; why?: string | null; note?: string };
  const rowsOf = (f: PovFabric) => {
    const rows: Row[] = [
      ...f.use_cases.map((uc) => ({ title: uc.title, refs: uc.refs, capital: uc.capital, why: uc.capital_why })),
      ...f.suggested.map((t) => ({ title: t, note: "Suggested by the model, not from the pages; accepted by a person." })),
    ];
    return rows.length ? rows : [{ note: f.no_use_case ? `No use case in the pages yet. ${f.no_use_case.reason}`
      : "No use cases yet: the next assessment looks for them." }];
  };
  const caseCell = (r: Row, i: number, n: number) => <>
    {r.title && <>{n > 1 ? `${i + 1}. ` : ""}{r.title} <FewRefs refs={r.refs} sources={src} /></>}
    {r.note && <span className={`block text-[12.5px] ${r.title ? "text-muted" : "text-neutral-600"}`}>{r.note}</span>}
  </>;
  const investment = (r: Row) => r.capital ? <><span className="capitalize">{r.capital}</span>
    {r.why && <span className="block text-[12.5px] text-muted" title={r.why}>{firstSentence(r.why, r.capital)}</span>}</>
    : <span className="text-muted">—</span>;

  const howFar = (f: PovFabric) => {
    const b = f.finance.bottlenecks;
    const blockers = [...(b?.picked ?? []), ...(b?.other ? [b.other] : [])];
    const next = f.finance.next_step;
    return (
      <>
        {f.path_step ? (
          <>
            <b className="font-medium">{f.path_step}</b>
            {f.path_step_order && steps ? `, step ${f.path_step_order} of ${steps}` : ""}
            {next && <span className="block text-[12.5px] text-muted">Next: {next.name}{next.in_hand && ", its proof in hand"}</span>}
          </>
        ) : <span className="text-muted">Not recorded yet</span>}
        {blockers.length > 0 && <span className="block text-[12.5px] text-muted">Could stop it scaling: {blockers.join("; ")}</span>}
      </>
    );
  };
  const pays = (f: PovFabric) => {
    const figures = FIGURES.filter(([k]) => f.finance[k]?.value != null);
    if (figures.length > 0) return figures.map(([k, label, per]) => (
      <span key={k} className="block">{label}: {figureText(f.finance[k]!.value!, f.finance[k]!.unit)}{per}</span>
    ));
    const missing = [...new Set(Object.values(f.finance.missing ?? {}).flat())];
    return (
      <>
        <span className="text-muted">Not known yet</span>
        <span className="block text-[12.5px] text-muted">
          {f.finance.needed ? (missing.length ? `Needs Tata's ${missing.join(", ")}.` : "Needs Tata's figures.")
            : `Asked for from ${from.name}`}
        </span>
        {financeHref && (
          <Link href={financeHref(f.fabric_id)} className="text-[12.5px] text-link hover:underline print:hidden">Enter figures →</Link>
        )}
      </>
    );
  };

  return (
    <section>
      <h2 className={heading}>Use cases, fabric by fabric</h2>
      <p className="mt-1 text-[13px] text-neutral-600">
        Each use case is a way Tata could earn or save money with this technology in one of its business areas (fabrics).
      </p>
      {/* phones: a card per fabric, each line labelled */}
      <div className="mt-2 space-y-3 md:hidden print:hidden">
        {fabrics.map((f) => {
          const rows = rowsOf(f);
          return (
            <div key={f.fabric_id} className="rounded-card border border-line bg-white px-4 py-3 text-sm">
              <FabricLabel id={f.fabric_id} name={f.fabric} />
              {rows.map((r, i) => (
                <div key={i} className="mt-2 leading-snug">
                  {caseCell(r, i, rows.length)}
                  {r.capital && <div className="mt-1 text-[13px]"><span className="text-muted">Investment needed: </span>{investment(r)}</div>}
                </div>
              ))}
              <dl className="mt-3 space-y-1.5 border-t border-neutral-100 pt-2 text-[13px] leading-snug">
                <div><dt className="text-muted">How far Tata has got</dt><dd>{howFar(f)}</dd></div>
                <div><dt className="text-muted">Does it pay?</dt><dd>{pays(f)}</dd></div>
              </dl>
            </div>
          );
        })}
      </div>
      <div className="mt-2 hidden overflow-x-auto rounded-card border border-line bg-white md:block print:block">
        <table className="w-full min-w-[760px] table-fixed text-sm">
          <colgroup><col className="w-[13%]" /><col className="w-[33%]" /><col className="w-[22%]" /><col className="w-[16%]" /><col className="w-[16%]" /></colgroup>
          <thead>
            <tr className="border-b border-neutral-200 text-left font-mono text-[11px] uppercase tracking-wider text-neutral-500">
              <th className="px-3 py-2 font-normal">Fabric</th>
              <th className="px-3 py-2 font-normal">Use case</th>
              <th className="px-3 py-2 font-normal">Investment needed</th>
              <th className="px-3 py-2 font-normal">How far Tata has got</th>
              <th className="px-3 py-2 font-normal">Does it pay?</th>
            </tr>
          </thead>
          {fabrics.map((f) => {
            const rows = rowsOf(f);
            return (
              <tbody key={f.fabric_id} className="break-inside-avoid border-t border-neutral-100 first-of-type:border-t-0">
                {rows.map((r, i) => (
                  <tr key={i} className={i > 0 ? "border-t border-neutral-50" : ""}>
                    {i === 0 && <td rowSpan={rows.length} className={cell}><FabricLabel id={f.fabric_id} name={f.fabric} /></td>}
                    <td className={`${cell} leading-snug`}>{caseCell(r, i, rows.length)}</td>
                    <td className={`${cell} leading-snug`}>{investment(r)}</td>
                    {i === 0 && <td rowSpan={rows.length} className={`${cell} leading-snug`}>{howFar(f)}</td>}
                    {i === 0 && <td rowSpan={rows.length} className={`${cell} leading-snug`}>{pays(f)}</td>}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12.5px] text-neutral-600">
        <li><b className="font-medium">How far Tata has got:</b> the step Tata has reached on its path to scale
          ({steps ? `${steps} steps, ` : ""}from first evaluating it to investing in it). Tata&apos;s team records it on the
          technology&apos;s page; the radar never sets it.</li>
        <li><b className="font-medium">Does it pay?</b> Contribution, payback and break-even, worked out from Tata&apos;s
          own figures (margin, revenue, costs) entered under Finance on the technology&apos;s page. They&apos;re asked for
          from {from.name}{from.order ? ` (step ${from.order})` : ""}; before that, nothing is missing.</li>
        <li>Numbers in brackets are sources; +n shows the rest.</li>
      </ul>
    </section>
  );
}

/** Why a fabric's scores are what they are, in a panel on the right: each
 *  measure behind them, open. On wide screens the page moves left to make
 *  room (body.side-panel); narrower, it covers the page over a dimmed
 *  backdrop. Esc, ×, or the backdrop closes it, and the page is as it was. */
function WhyPanel({ f, meta, sources, changeHref, onClose }: {
  f: PovFabric; meta: MeasureMeta[]; sources: Source[]; changeHref?: (fabricId: string) => string; onClose: () => void;
}) {
  useEffect(() => {
    document.body.classList.add("side-panel"); // globals.css: the page's content moves left
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => { document.body.classList.remove("side-panel"); window.removeEventListener("keydown", esc); };
  }, [onClose]);
  return (
    <>
      <div aria-hidden onClick={onClose} className="fixed inset-0 z-30 bg-ink/20 xl:hidden print:hidden" />
      <aside role="dialog" aria-label={`Why ${f.fabric}'s scores`}
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-white shadow-xl sm:w-[28rem] xl:w-[min(34rem,40vw)] print:hidden">
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
          <span className="text-sm font-medium">Why these scores</span>
          <FabricLabel id={f.fabric_id} name={f.fabric} />
          <button type="button" onClick={onClose} autoFocus aria-label="Close"
            className="ml-auto rounded-full px-2 text-xl leading-none text-muted hover:bg-ground hover:text-ink">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <p className="px-4 pb-1 text-[12.5px] text-neutral-600">
            Each score is the weighted mean of the measures under it that had enough evidence; the share beside a
            measure is its weight. Each measure gives its reasoning, its pages and what argues against it.
          </p>
          <Derivation f={f} meta={meta} sources={sources} bare />
          {changeHref && (
            <Link href={changeHref(f.fabric_id)} className="mx-4 mb-2 inline-block text-[12.5px] text-link hover:underline">
              Change a score or the priority, on the technology&apos;s page →
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}

/** The three scores per fabric, out of 10, each with how many of its
 *  measures had evidence, and the priority and horizon (and whether a person
 *  set it). Why opens the measures each score was worked out from in a panel
 *  on the right; the note says what each score asks. On a phone each fabric
 *  stacks, its cells labelled. `changeHref`: the admins' link to change a
 *  score or the priority on the technology's page. */
function Scores({ pov, changeHref }: { pov: Pov; changeHref?: (fabricId: string) => string }) {
  const notIn = pov.not_assessed_in ?? [];
  const meta = pov.measures ?? [];
  const [why, setWhy] = useState<string | null>(null);
  const before = useRef(0); // where the page was before the panel opened, to go back to on close
  const open = (id: string) => { if (!why) before.current = window.scrollY; setWhy(id); };
  const close = useCallback(() => {
    setWhy(null);
    requestAnimationFrame(() => window.scrollTo(0, before.current));
  }, []);
  // the page narrows while the panel is open, and the scores may move: keep the chosen row in view
  useEffect(() => {
    if (why) document.querySelector(`[data-why="${why}"]`)?.scrollIntoView({ block: "nearest" });
  }, [why]);
  const shown = (pov.fabrics ?? []).find((f) => f.fabric_id === why);
  const axes = Object.keys(AXIS_MEANING);
  const grid = "grid grid-cols-3 gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))_minmax(0,1.1fr)_3.5rem] sm:items-start";
  const label = "block text-[11px] text-muted sm:hidden";
  return (
    <section className="break-inside-avoid">
      <h2 className={heading}>Scores</h2>
      <div className="mt-2 rounded-card border border-line bg-white text-sm">
        <div className={`${grid} hidden border-b border-neutral-200 px-3 py-2 font-mono text-[10.5px] uppercase tracking-wider text-neutral-500 sm:grid`}>
          <span>Fabric</span>
          {axes.map((k) => <span key={k} className="text-right">{AXIS_LABELS[k]}</span>)}
          <span className="text-right">Priority</span>
          <span />
        </div>
        {(pov.fabrics ?? []).map((f) => (
          <div key={f.fabric_id} className="score-row border-b border-neutral-100 last:border-b-0">
            <button type="button" data-why={f.fabric_id} onClick={() => (why === f.fabric_id ? close() : open(f.fabric_id))}
              aria-pressed={why === f.fabric_id}
              className={`${grid} w-full px-3 py-2.5 text-left hover:bg-ground/60 ${why === f.fabric_id ? "bg-azure/10" : ""}`}
              title={`Why ${f.fabric}'s scores: the measures behind them`}>
              <span className="col-span-2 sm:col-span-1"><FabricLabel id={f.fabric_id} name={f.fabric} /></span>
              <span className="whitespace-nowrap text-right text-[12.5px] text-link sm:order-last print:hidden">
                {why === f.fabric_id ? "Open ›" : "Why ›"}
              </span>
              {axes.map((k) => {
                const ax = f.tora?.[k];
                return (
                  <span key={k} className="sm:text-right">
                    <span className={label}>{AXIS_LABELS[k]}</span>
                    {ax?.score != null ? (
                      <span className={`inline-block min-w-9 px-1.5 py-0.5 text-center font-mono text-xs tabular-nums ${scoreShade(ax.score)}`}>
                        {formatScore(ax.score)}
                      </span>
                    ) : <span className="text-xs text-muted">no score</span>}
                    {ax?.of ? <span className="mt-0.5 block text-[11px] text-muted">{ax.scored ?? 0} of {ax.of}</span> : null}
                  </span>
                );
              })}
              <span className="col-span-3 sm:col-span-1 sm:text-right">
                <span className={label}>Priority</span>
                <span className="font-mono text-xs">{f.priority ?? <span className="font-sans text-muted">not set</span>}</span>
                {f.horizon && <span className="block text-[11px] text-muted">{f.horizon}, {HORIZON_TERM[f.horizon] ?? ""}</span>}
                {f.override && <span className="block text-[11px] text-amber-900">set by a person</span>}
              </span>
            </button>
          </div>
        ))}
      </div>
      {shown && <WhyPanel f={shown} meta={meta} sources={pov.sources ?? []} changeHref={changeHref} onClose={close} />}
      {notIn.length > 0 && (
        <p className="mt-1.5 text-xs text-neutral-600">
          Not assessed in {notIn.join(", ")}: judged not relevant to this technology before scoring.
        </p>
      )}
      <ul className="mt-1.5 space-y-0.5 text-xs text-neutral-600">
        {axes.map((k) => {
          const names = meta.filter((m) => m.axis === k).sort((x, y) => x.code.localeCompare(y.code)).map((m) => m.name);
          return <li key={k}><b className="font-medium">{AXIS_LABELS[k]}</b>: {AXIS_MEANING[k]}{names.length > 0 && `, from ${names.join(", ")}`}.</li>;
        })}
        <li>Each out of 10, darker when higher; &ldquo;2 of 3&rdquo; means two of its three measures had enough evidence
          (with none there&apos;s no score, which isn&apos;t a zero). Why opens the measures behind a fabric&apos;s scores, on the right.
          {" "}{LEGEND}</li>
      </ul>
    </section>
  );
}

/** Why a measure has the score it has, in words: the assessor's
 *  justification with its pages, or a person's score or accepted gap with
 *  their reason, or what evidence would settle it. */
function MeasureWhy({ m, sources }: { m: PovMeasure; sources: Source[] }) {
  switch (m.state) {
    case "scored_by_person":
      return <>Scored by a person{m.model_score != null ? ` (the model gave ${formatScore(m.model_score)})` : ""}. Their reason: {m.reason ?? "none recorded"}</>;
    case "gap_accepted":
      return <>Couldn&apos;t be assessed from the evidence, and a person accepted the gap. Would need: {m.missing ?? "not recorded"}</>;
    case "waiting_for_tata":
      return <>Waiting for Tata: Tata Communications enters this measure; it isn&apos;t scored from the pages.</>;
    case "unscored":
      return <><span className="italic text-neutral-500">Not enough evidence. Would need: </span>{m.missing ?? "not recorded"}</>;
    default:
      return <>{m.justification} {renderRefs(m.refs, sources)}</>;
  }
}

/** One fabric's scores worked out: each score with the measures it was
 *  computed from, each measure's reasoning and the pages behind it. `bare`:
 *  inside a Scores row, without its own card, every measure's reason open. */
function Derivation({ f, meta, sources, bare = false }: { f: PovFabric; meta: MeasureMeta[]; sources: Source[]; bare?: boolean }) {
  const axes = [...Object.keys(AXIS_LABELS), ...meta.map((m) => m.axis)].filter((ax, i, all) => all.indexOf(ax) === i);
  return (
    <div className={bare ? "" : "rounded-card border border-line bg-white print:rounded-none print:border-0"}>
      {!bare && <div className="break-after-avoid border-b border-neutral-200 px-4 py-2"><FabricLabel id={f.fabric_id} name={f.fabric} /></div>}
      {axes.map((axis) => {
        const measures = meta.filter((m) => m.axis === axis && f.measures[m._id]).sort((x, y) => x.code.localeCompare(y.code));
        if (measures.length === 0) return null;
        const roll = f.tora?.[axis];
        return (
          <div key={axis} className="border-b border-neutral-100 px-4 py-3 last:border-b-0">
            <div className="flex break-after-avoid items-baseline gap-2">
              <span className="text-sm font-medium">{AXIS_LABELS[axis] ?? "Other measures"}</span>
              {roll && (
                <>
                  <span className={`px-1.5 py-0.5 font-mono text-xs tabular-nums ${scoreShade(roll.score)}`}>
                    {roll.score != null ? formatScore(roll.score) : "no score"}
                  </span>
                  <span className="font-mono text-[11px] text-neutral-500">weighted mean · {roll.scored} of {roll.of} measures scored</span>
                </>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {measures.map((m) => {
                const r = f.measures[m._id];
                return (
                  <details key={m._id} className="group" open={bare}>
                    <summary className="flex cursor-pointer list-none items-baseline gap-2 py-0.5 text-sm hover:text-black">
                      <span className="text-neutral-400 transition-transform group-open:rotate-90">›</span>
                      <span className="min-w-0 flex-1 truncate text-neutral-700">{m.name}</span>
                      {(m.weight ?? 0) > 0 && <span className="font-mono text-[11px] text-neutral-400">{weightShare(m.weight)}</span>}
                      <span className={`px-1.5 py-0.5 font-mono text-xs tabular-nums ${scoreShade(r.score)}`}>
                        {r.score != null ? formatScore(r.score) : "no score"}
                      </span>
                    </summary>
                    <div className="mb-2 ml-4 border-l-2 border-neutral-200 pl-3 text-sm leading-relaxed text-neutral-600">
                      <MeasureWhy m={r} sources={sources} />
                      {r.counter_case && <p className="mt-1 italic text-neutral-500">What argues against it: {r.counter_case}</p>}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** "How to read this page", the same on both addresses; `admin` adds the
 *  admins' links and Rewrite. */
export function PovHelp({ admin = false }: { admin?: boolean }) {
  return (
    <>
      <li>First, the verdict and four answers: the priority in each fabric (P1 act now to P6 just watch, with the
        horizon, near to far), the maturity (TRL, 1 to 9), the commercial availability and how solid the evidence is.
        A priority a person set says so, with their reason and the priority the scores give.</li>
      <li>Then the recommendation, and the use cases in a table: per fabric, each use case with the investment it
        needs and why, how far Tata has got on its path to scale, and whether it pays, from Tata&apos;s own figures. The
        note under the table says what those mean and where they&apos;re entered.</li>
      <li>The rest is folded, each fold saying what it holds: the summary, how each use case makes money, what&apos;s
        missing, the score detail in words, and the sources.</li>
      <li>A number in brackets, like [3], is a source: click it to open the page. It&apos;s the same number everywhere
        on the page, and Sources lists them all.</li>
      <li>Scores: per fabric, Market Potential, Strategic Fit and Adoption Readiness, each out of 10 (darker is
        higher), with how many of its measures had enough evidence (2 of 3). Why, on a fabric&apos;s row, opens a panel
        on the right with the measures behind its scores: each measure&apos;s score, the reasoning and its pages. Close it
        (×, or Esc) and the page is as it was.{admin && " In the panel, a link changes a score or the priority on the technology's page."}</li>
      <li>Written is when this Point of View was written, in the writer&apos;s time zone.{admin && " Assessed is when the assessment it explains was made. Rewriting writes it again from the same assessment: the scores don't change."}</li>
      <li>Print / Save as PDF prints it with every fold open, except the score detail, which prints only when you open
        it first.</li>
    </>
  );
}

/** A Point of View's page below its header, the same for the admins and
 *  the leaders: `admin` adds only their links (each fabric's assessment, the
 *  finance card) and their notes (a citation to check, a rewrite to bring
 *  the text up to date). Printing opens every fold but the score detail,
 *  which prints, every measure open, when it's open. */
export function PovBody({ pov, admin = false }: { pov: Pov; admin?: boolean }) {
  const here = useHere();
  const s = pov.sections ?? {};
  const src = pov.sources ?? [];
  const fabrics = pov.fabrics ?? [];
  const meta = pov.measures ?? [];
  const watch = pov.watch_metrics ?? [];
  const tab = (fabricId: string) => withFrom(`/admin/technologies/${pov.tech_id}?fabric=${encodeURIComponent(fabricId)}`, here);
  const gaps = Array.isArray(s.evidence_gaps) ? s.evidence_gaps.reduce((n, g) => n + (g.missing?.length ?? 0), 0) : s.evidence_gaps ? 1 : 0;
  const newer = pov.latest_assessment && pov.latest_assessment.scoring_run_id !== pov.scoring_run_id ? pov.latest_assessment : null;
  const named = (keep: (m: MeasureMeta) => boolean) =>
    meta.filter(keep).sort((x, y) => x.code.localeCompare(y.code)).map((m) => m.name).join(" · ");
  const others = named((m) => !(m.axis in AXIS_LABELS));

  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      opened = [...document.querySelectorAll<HTMLDetailsElement>(
        "details.pov-fold:not(.score-detail):not([open]), details.score-detail[open] details:not([open])")];
      opened.forEach((d) => (d.open = true));
    };
    const after = () => {
      opened.forEach((d) => (d.open = false));
      opened = [];
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  return (
    <SourceNumbers.Provider value={sourceNumbers(src)}>
      {s.headline && (
        <p className="mt-7 break-inside-avoid border-l-[3px] border-navy pl-4 font-display text-[22px] leading-snug">
          {renderCitations(s.headline, src)}
        </p>
      )}
      {admin && pov.citation_problems && (
        <p className="mt-3 text-sm text-amber-900 print:hidden">Check before sharing: it {pov.citation_problems}. Rewriting usually fixes it.</p>
      )}

      <Answers pov={pov} />

      {/* the recommendation and the scores side by side when their space is wide enough (it narrows while the
          Why panel is open); one column otherwise and in print */}
      <div className="@container">
        <div className={fabrics.length > 0 ? "mt-8 grid grid-cols-1 items-start gap-x-10 gap-y-6 @5xl:grid-cols-2 print:block print:space-y-6" : "mt-8"}>
          <div className="min-w-0"><Section title="Recommendation" text={s.recommendation} sources={src} /></div>
          {fabrics.length > 0 && <div className="min-w-0"><Scores pov={pov} changeHref={admin ? tab : undefined} /></div>}
        </div>
      </div>
      <div className="mt-8 space-y-6">
        <ValueSummary pov={pov} financeHref={admin ? (fabricId) => `${tab(fabricId)}#finance` : undefined} />

        <div className="space-y-2 print:space-y-6">
          {(s.summary || s.maturity) && (
            <Fold title="Summary and maturity, in words" hint="what it is, where the evidence comes from, how far it has got">
              <Section title="Summary" text={s.summary} sources={src} />
              <Section title="Maturity" text={s.maturity} sources={src} />
            </Fold>
          )}
          {(pov.latest_assessment?.fabric_ids.length ?? 0) > 0 && (
            <Fold title="How each use case makes money, in full" hint={plural(pov.latest_assessment?.fabric_ids.length ?? 0, "fabric")}>
              <Section title="Use cases, in words" text={s.value} sources={src} />
              {newer && (
                <p className="text-[13px] text-muted">
                  Below, from the latest assessment ({formatDay(newer.assessed_at)}), which is newer than this Point of
                  View&apos;s.{admin && " Rewriting brings the text up to date."}
                </p>
              )}
              <PovValue techId={pov.tech_id} fabricIds={pov.latest_assessment?.fabric_ids ?? []} admin={admin} frozen={pov.value} />
            </Fold>
          )}
          {(gaps > 0 || watch.length > 0) && (
            <Fold title="What's missing, and what would change the verdict"
              hint={[gaps && plural(gaps, "evidence gap"), watch.length && plural(watch.length, "sign to watch", "signs to watch")].filter(Boolean).join(" · ")}>
              <EvidenceGaps gaps={s.evidence_gaps} sources={src}
                fabricIds={Object.fromEntries(fabrics.map((f) => [f.fabric, f.fabric_id]))} />
              {watch.length > 0 && (
                <section>
                  <div className="break-inside-avoid break-after-avoid">
                    <h2 className={heading}>Metrics to watch</h2>
                    <p className="mt-1 text-xs text-neutral-500">
                      What would change the verdict, suggested by the assessment. Nothing tracks them automatically: the
                      next assessment checks them.
                    </p>
                  </div>
                  <div className="mt-2"><WatchMetrics metrics={watch} /></div>
                </section>
              )}
            </Fold>
          )}
          <Fold title="Score detail, in words: what each score rests on" className="score-detail print:break-before-page"
            hint="the measures themselves open under Why in Scores · prints only when open">
            {Object.entries(AXIS_LABELS).map(([axis, name]) => {
              const covers = named((m) => m.axis === axis);
              return <Section key={axis} title={name} covers={covers && `Measures: ${covers}`} text={s.tora_analysis?.[axis]} sources={src} />;
            })}
            <Section title="Other measures" covers={others && `Not part of the three scores: ${others}`} text={s.other_measures} sources={src} />
            <Section title="Priority and horizon" text={s.placement_rationale} sources={src} />
            <Section title="Market view" text={s.market_view} sources={src} />
            <Section title="Capability gap" text={s.capability_gap} sources={src} />
            {/* on screen the measures open under Why in Scores; in print they follow here */}
            {fabrics.length > 0 && meta.length > 0 && (
              <section className="hidden space-y-3 print:block">
                <h2 className={heading}>Measure by measure</h2>
                {fabrics.map((f) => <Derivation key={f.fabric_id} f={f} meta={meta} sources={src} />)}
              </section>
            )}
          </Fold>
          {src.length > 0 && (
            <Fold title="Sources" hint={`the ${plural(src.length, "page")} this Point of View cites, numbered as on the page`}>
              <SourceList sources={src} />
            </Fold>
          )}
        </div>
      </div>
    </SourceNumbers.Provider>
  );
}
