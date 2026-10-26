"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import FabricLabel from "@/components/FabricLabel";
import type { MeasureMeta, Pov, PovFabric, PovMeasure, Source } from "@/components/PovText";
import { renderRefs } from "@/lib/citations";
import { plural } from "@/lib/format";
import { AXIS_MEANING, formatScore, HORIZON_TERM, SCORE_NAMES, weightShare } from "@/lib/scoring";
import { heading, scoreShade } from "@/lib/theme";

// A Point of View's scores: the table by fabric, why each priority, and the Why panel with each
// score's measures (the same for the admins and the leaders).

const AXIS_LABELS = SCORE_NAMES;

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
const PRIZE: Record<string, string> = { high: "big", mid: "moderate", low: "small" };

/** Why a fabric's priority, as the grid gives it: "P2 because it arrives
 *  mid-term (how soon 6.5) and the prize is big (how big 8)". */
function priorityBecause(f: PovFabric): string {
  const p = f.placement!;
  const when = f.horizon ? HORIZON_TERM[f.horizon] ?? f.horizon : "";
  const scores = `it arrives ${when} (how soon ${formatScore(p.how_soon!)}) and the prize is `
    + `${PRIZE[p.big_band ?? ""] ?? p.big_band ?? ""} (how big ${formatScore(p.how_big!)})`;
  return f.override ? `${f.priority}, set by a person; the scores give ${f.computed_priority ?? "no priority"}: ${scores}`
    : `${f.priority} because ${scores}`;
}

export function Scores({ pov, changeHref }: { pov: Pov; changeHref?: (fabricId: string) => string }) {
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
  const placed = (pov.fabrics ?? []).filter((f) => f.priority && f.placement?.how_soon != null && f.placement.how_big != null);
  const axes = Object.keys(AXIS_MEANING);
  const grid = "grid grid-cols-3 gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))_minmax(0,1.1fr)_3.5rem] sm:items-start";
  const label = "block text-[11px] text-muted sm:hidden";
  return (
    <section>
      <h2 className={heading}>Scores</h2>
      <div className="mt-2 rounded-card border border-line bg-white text-sm">
        <div className={`${grid} hidden border-b border-neutral-200 px-3 py-2 font-mono text-[10.5px] uppercase tracking-wider text-neutral-500 sm:grid`}>
          <span>Fabric</span>
          {axes.map((k) => <span key={k} className="text-right">{AXIS_LABELS[k]}</span>)}
          <span className="text-right">Priority</span>
          <span />
        </div>
        {(pov.fabrics ?? []).map((f) => (
          <div key={f.fabric_id} className="score-row break-inside-avoid border-b border-neutral-100 last:border-b-0">
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
                    {ax?.of ? <span className="mt-0.5 block text-[11px] text-muted">{ax.scored ?? 0} of {plural(ax.of, "measure")}</span> : null}
                  </span>
                );
              })}
              <span className="col-span-3 sm:col-span-1 sm:text-right">
                <span className={label}>Priority</span>
                <span className="font-mono text-xs">{f.priority ?? <span className="font-sans text-muted">not set</span>}</span>
                {f.horizon && <span className="block text-[11px] text-muted">{changeHref ? `${f.horizon}, ` : ""}{HORIZON_TERM[f.horizon] ?? ""}</span>}
                {f.override && <span className="block text-[11px] text-amber-900">set by a person</span>}
              </span>
            </button>
          </div>
        ))}
      </div>
      {shown && <WhyPanel f={shown} meta={meta} sources={pov.sources ?? []} changeHref={changeHref} onClose={close} />}
      {notIn.length > 0 && (
        <p className="mt-1.5 text-xs text-neutral-600">
          Not assessed in {notIn.join(", ")}: judged not relevant to this technology before assessing.
        </p>
      )}
      <ul className="mt-1.5 space-y-0.5 text-xs text-neutral-600">
        {axes.map((k) => {
          const names = meta.filter((m) => m.axis === k).sort((x, y) => x.code.localeCompare(y.code)).map((m) => m.name);
          return <li key={k}><b className="font-medium">{AXIS_LABELS[k]}</b>: {AXIS_MEANING[k]}{names.length > 0 && `, from ${names.join(", ")}`}.</li>;
        })}
        <li>Each out of 10, darker when higher; &ldquo;2 of 3 measures&rdquo;: measures with enough evidence. Why opens them.</li>
        <li>Priority comes from how soon it arrives × how big the prize is; the three scores describe the case and feed this
          Point of View.</li>
      </ul>
      {placed.length > 0 && (
        <ul aria-label="Why each priority" className="mt-2 space-y-0.5 text-[13px] text-neutral-800">
          {placed.map((f) => <li key={f.fabric_id}><b className="font-medium">{f.fabric}</b>: {priorityBecause(f)}.</li>)}
        </ul>
      )}
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
export function Derivation({ f, meta, sources, bare = false }: { f: PovFabric; meta: MeasureMeta[]; sources: Source[]; bare?: boolean }) {
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
