"use client";

import Link from "next/link";
import { useState } from "react";
import DecisionNote from "@/components/DecisionNote";
import { errorText } from "@/lib/api";
import { decide } from "@/lib/decisions";
import { type Brief, type Finance, FINANCE_SHOWN, type Need, NOTES, type PathStep, storedFinance } from "@/lib/value";

// where each need is met, as a link to that part of the fabric tab
const WHERE = { finance: ["enter it under Finance", "finance"], figures: ["worked out under Finance", "finance"],
  assessment: ["from the use cases", "use-cases"] } as const;
type Who = { finance?: Finance; techId: string; fabricId: string; onChanged?: () => void };

/** A rung's evidence a person records (a measured cost per outcome, a named
 *  buyer, a budget, a price, the exposed contracts), entered in place: what
 *  it holds, or a box to fill. Kept with the finance choice, the rest of it
 *  unchanged. */
function NeedInput({ need, finance, techId, fabricId, onChanged }: Who & { need: Need }) {
  const key = need.key as (typeof NOTES)[number] | "price";
  const held = finance ? (key === "price" ? finance.price?.value : finance.notes[key]?.value) : undefined;
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!finance) return null;
  if (held != null && !editing) return (
    <span className="text-ink">: {key === "price" ? `$${held} a unit` : String(held)} <button type="button" className="text-link hover:underline"
      onClick={() => { setV(String(held)); setEditing(true); }}>Change</button></span>
  );
  if (!editing) return (
    <> <button type="button" onClick={() => { setV(""); setEditing(true); }}
      className="ml-1 rounded-full border border-line bg-white px-2.5 py-0.5 text-[12.5px] text-ink hover:bg-ground">Enter…</button></>
  );
  return (
    <form className="mt-1 flex flex-wrap items-center gap-2" onSubmit={async (e) => {
      e.preventDefault();
      setError(null);
      try {
        await decide({ kind: "finance", tech_id: techId, fabric_id: fabricId,
          value: { ...storedFinance(finance), [key]: key === "price" ? Number(v) : v.trim() } });
        setEditing(false);
        onChanged?.();
      } catch (err) { setError(errorText(err)); }
    }}>
      <input autoFocus type={key === "price" ? "number" : "text"} min={0} step="any" value={v} onChange={(e) => setV(e.target.value)}
        placeholder={key === "price" ? "a unit, in dollars" : "what Tata has, and where it comes from"} maxLength={1000}
        className="min-w-0 flex-1 basis-64 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-ink" />
      <button type="submit" disabled={!v.trim()} className="rounded-full bg-navy px-3 py-1 text-sm text-white hover:bg-navy-strong disabled:opacity-50">Save</button>
      <button type="button" className="text-muted hover:text-ink" onClick={() => setEditing(false)}>Cancel</button>
      {error && <span className="text-failed">Not saved: {error}</span>}
    </form>
  );
}

/** A step whose proof Tata hasn't written yet (Setup › Path to scale). */
const unwritten = (s: PathStep) => !s.evidence_needed.trim() || /^for tata to define/i.test(s.evidence_needed);

/** What the next step needs, ticked off: "Proof for Proof of concept is in
 *  hand" (act when the proof for the next step is in hand), or what's still
 *  missing and where it goes: entered right here while finance is set aside
 *  (NeedInput), else under Finance. */
function NextRung({ next, readOnly, ...who }: Partial<Who> & { next: NonNullable<Finance["next_step"]>; readOnly?: boolean }) {
  if (!next.needs.length) return null;
  if (next.in_hand && readOnly) return (
    <p className="mt-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[12.5px] text-emerald-900">
      <b>Proof for {next.name} is in hand:</b> {next.needs.map((n) => n.label).join("; ")}.
    </p>
  );
  return (
    <ul className="mt-1.5 space-y-1 text-[12.5px]">
      {next.in_hand
        ? <li className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-900">
            <b>Proof for {next.name} is in hand.</b> Change the step when Tata commits.</li>
        : <li>Next, <b>{next.name}</b>, needs:</li>}
      {next.needs.map((n) => (
        <li key={n.key} className={n.have ? "text-emerald-800" : "text-amber-900"}>
          {n.have ? "✓" : "○"} {n.label}
          {!readOnly && (n.where === "finance" && !FINANCE_SHOWN && who.techId && who.fabricId
            ? <NeedInput need={n} finance={who.finance} techId={who.techId} fabricId={who.fabricId} onChanged={who.onChanged} />
            : n.have ? null
            : n.where === "figures" && !FINANCE_SHOWN ? <span className="text-muted"> · comes with the business case, set aside for now</span>
            : <span className="text-muted"> · <a href={`#${WHERE[n.where][1]}`} className="text-link hover:underline">{WHERE[n.where][0]}</a></span>)}
        </li>
      ))}
    </ul>
  );
}

/** Tata's process as one progress track: a dot per step joined by a line,
 *  filled up to the step reached, the next one ringed. Across on a wide
 *  screen; down, one step a line, on a phone. */
function Track({ steps, at, next }: { steps: PathStep[]; at: number; next?: string }) {
  return (
    <ol aria-label="Tata's path to scale" className="flex flex-col pb-1 sm:flex-row">
      {steps.map((s, i) => {
        const done = s.order <= at;
        const line = done ? "bg-navy" : "bg-line";
        return (
          <li key={s._id} aria-current={s.order === at ? "step" : undefined}
            className="relative flex items-center gap-2 py-1 sm:flex-1 sm:flex-col sm:gap-0 sm:py-0 sm:text-center">
            {i > 0 && <span aria-hidden className={`absolute bottom-1/2 left-[9px] h-full w-0.5 sm:hidden ${line}`} />}
            {i > 0 && <span aria-hidden className={`absolute right-1/2 top-[9px] hidden h-0.5 w-full sm:block ${line}`} />}
            <span aria-hidden className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
              done ? "bg-navy text-white" : s._id === next ? "border-2 border-azure bg-white" : "border-2 border-line bg-white"}`}>
              {done ? "✓" : ""}</span>
            <span className={`text-[12px] leading-tight sm:mt-1 sm:px-1 sm:text-[11.5px] ${
              s.order === at ? "font-semibold text-ink" : s._id === next ? "text-navy" : "text-muted"}`}>
              {s.name}{s.order === at && <span className="sr-only"> (reached)</span>}
              {s._id === next && <span className="ml-1.5 text-[10.5px] text-azure sm:ml-0 sm:block">next</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** How far Tata has got with a technology in a fabric, on its seven steps.
 *  On the fabric tab: the steps as one progress track, the step reached and
 *  who set it, what the next step still needs; every step's proof and the
 *  decision it allows one click away; "Change step" lists them all as a
 *  choice, saved by a person only.
 *  Steps whose proof isn't written yet share one line. Read-only (the Point
 *  of View): a bar that shows the step reached, or "Not set". */
export default function PathToScale({ steps, current, next, decision, techId, fabricId, onChanged, readOnly, finance }: {
  finance?: Finance; // what's held for the next step's evidence, entered here while finance is set aside
  steps: PathStep[];
  current: Finance["step"];
  next: Finance["next_step"];
  decision?: Brief | null;
  techId: string;
  fabricId: string;
  onChanged?: () => void;
  readOnly?: boolean;
}) {
  const [changing, setChanging] = useState(false);
  const [every, setEvery] = useState(false);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const at = current?.order ?? 0;
  if (readOnly) return (
    <div>
      <ol className="flex flex-wrap gap-1" aria-label="Path to scale">
        {!current && <li className="rounded-full border border-dashed border-neutral-400 px-2.5 py-0.5 text-[12px] text-muted">Not set</li>}
        {steps.map((s) => (
          <li key={s._id} aria-current={s.order === at ? "step" : undefined} title={`${s.name}. Proof needed to reach it: ${s.evidence_needed}`}
            className={`rounded-full px-2.5 py-1 text-[12px] ${s.order === at ? "bg-navy text-white" : s.order < at ? "bg-navy/15 text-navy" : "bg-neutral-100 text-muted"}`}>
            {s.name}
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[12.5px] text-muted">
        {current ? <>Reached: <b className="text-ink">{current.name}</b>, recorded by Tata.</>
          : "Not set yet: Tata records the step it has reached on the technology's page."}
      </p>
      {next && next.in_hand && <NextRung next={next} readOnly />}
    </div>
  );

  const start = () => { setPick(current?.id ?? ""); setError(null); setChanging(true); };
  const later = steps.filter(unwritten);
  const badge = (s: PathStep) => (
    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${
      s.order === at ? "bg-navy text-white" : s.order < at ? "bg-navy/15 text-navy" : "bg-neutral-100 text-muted"}`}>{s.order}</span>
  );
  const radio = (s: PathStep) => (
    <input type="radio" name={`step-${fabricId}`} className="mt-1 shrink-0" checked={pick === s._id} onChange={() => setPick(s._id)} />
  );
  const chips = (s: PathStep) => <>
    {s.order === at && <span className="rounded-full bg-navy px-2 text-[11px] text-white">Reached</span>}
    {next?.id === s._id && <span className="rounded-full bg-azure/15 px-2 text-[11px] text-navy">Next</span>}
  </>;
  const Row = changing ? "label" : "div";
  const all = changing || every;
  const shown = steps.filter((s) => !unwritten(s));

  return (
    <div className="text-[13px]">
      {!changing && <Track steps={steps} at={at} next={next?.id} />}
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
        {current ? <span>Reached <b>{current.name}</b>, step {current.order} of {steps.length}.</span>
          : <span><b>Not recorded yet:</b> nobody has said how far Tata has got with it here.</span>}
        {!changing && (
          <button type="button" onClick={start} className="rounded-full border border-line bg-white px-3 py-0.5 text-[12.5px] hover:bg-ground">
            {current ? "Change step" : "Record the step"}
          </button>
        )}
      </p>
      {decision && current && !changing && <DecisionNote what={`Set at ${current.name}`} decision={decision} onUndone={() => onChanged?.()} />}
      {!changing && next && <NextRung next={next} finance={finance} techId={techId} fabricId={fabricId} onChanged={onChanged} />}
      {changing && (
        <p className="mt-2 text-[12.5px] text-navy">
          Pick the step Tata has actually reached, then Save. Only a person sets this; the leaders&apos; view and the Point of View show it.
        </p>
      )}
      {!changing && (
        <button type="button" aria-expanded={every} onClick={() => setEvery(!every)} className="mt-1.5 text-[12.5px] text-link hover:underline">
          {every ? "Hide every step's proof" : "Show every step's proof"}
        </button>
      )}

      {all && (
      <ol className="mt-2 divide-y divide-neutral-100 rounded-lg border border-line" aria-label="Path to scale">
        {shown.map((s) => (
          <li key={s._id} aria-current={s.order === at ? "step" : undefined} className={s.order === at ? "bg-navy/[0.04]" : ""}>
            <Row className={`flex items-start gap-3 px-3 py-2 ${changing ? "cursor-pointer hover:bg-ground/60" : ""}`}>
              {changing ? radio(s) : badge(s)}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2"><span className="font-medium">{s.name}</span>{chips(s)}</div>
                <p className="text-[12.5px] text-neutral-700">Proof needed to reach it: {s.evidence_needed}</p>
                <p className="text-[12.5px] text-muted">What it lets Tata decide: {s.decision}</p>
              </div>
            </Row>
          </li>
        ))}
        {all && later.length > 0 && (changing ? later.map((s) => (
          <li key={s._id}>
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-ground/60">
              {radio(s)}
              <span><span className="font-medium">{s.name}</span> <span className="text-muted">· its proof isn&apos;t written yet</span></span>
            </label>
          </li>
        )) : (
          <li className="flex flex-wrap items-baseline gap-2 px-3 py-2 text-[12.5px] text-muted">
            {later.map((s) => <span key={s._id} className="flex items-center gap-1.5">{badge(s)}<span className="text-ink">{s.name}</span>{chips(s)}</span>)}
            <span>: the proof these need isn&apos;t written yet (<Link href="/admin/path" className="text-link hover:underline">Setup › Path to scale</Link>).</span>
          </li>
        ))}
      </ol>
      )}

      {changing && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button type="button" disabled={!pick || pick === current?.id}
            className="rounded-full bg-navy px-3.5 py-1 text-sm text-white hover:bg-navy-strong disabled:opacity-50"
            onClick={async () => {
              setError(null);
              try {
                await decide({ kind: "path_step", tech_id: techId, fabric_id: fabricId, value: pick });
                setChanging(false);
                onChanged?.();
              } catch (err) { setError(errorText(err)); }
            }}>Save</button>
          <button type="button" className="text-muted hover:text-ink" onClick={() => setChanging(false)}>Cancel</button>
          {(!pick || pick === current?.id) && <span className="text-[12.5px] text-muted">Pick a different step to save.</span>}
          {error && <span className="text-[12.5px] text-failed">Not saved: {error}</span>}
        </div>
      )}
    </div>
  );
}
