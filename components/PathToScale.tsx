"use client";

import { useState } from "react";
import DecisionNote from "@/components/DecisionNote";
import { errorText } from "@/lib/api";
import { decide } from "@/lib/decisions";
import type { Brief, Finance, PathStep } from "@/lib/value";

const WHERE = { finance: "enter it under Finance below", figures: "worked out under Finance below", assessment: "from the use cases above" };

/** A step whose proof Tata hasn't written yet (Setup › Path to scale). */
const unwritten = (s: PathStep) => !s.evidence_needed.trim() || /^for tata to define/i.test(s.evidence_needed);

/** What the next step needs, ticked off: "Proof for Proof of concept is in
 *  hand" (act when the proof for the next step is in hand), or what's still
 *  missing and where it goes. */
function NextRung({ next, readOnly }: { next: NonNullable<Finance["next_step"]>; readOnly?: boolean }) {
  if (!next.needs.length) return null;
  return next.in_hand ? (
    <p className="mt-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[12.5px] text-emerald-900">
      <b>Proof for {next.name} is in hand:</b> {next.needs.map((n) => n.label).join("; ")}.
      {!readOnly && " Change the step when Tata commits."}
    </p>
  ) : (
    <ul className="mt-1.5 space-y-0.5 text-[12.5px]">
      <li>Next step, <b>{next.name}</b>. Still missing:</li>
      {next.needs.map((n) => (
        <li key={n.key} className={n.have ? "text-emerald-800" : "text-amber-900"}>
          {n.have ? "✓" : "○"} {n.label}{!n.have && !readOnly && <span className="text-muted"> · {WHERE[n.where]}</span>}
        </li>
      ))}
    </ul>
  );
}

/** How far Tata has got with a technology in a fabric, on its seven steps.
 *  On the fabric tab: the step reached and who set it, what the next step
 *  still needs, and the steps with the proof each needs and the decision it
 *  allows; "Change step" turns them into a choice, saved by a person only.
 *  Steps whose proof isn't written yet share one line. Read-only (the Point
 *  of View): a bar that shows the step reached, or "Not set". */
export default function PathToScale({ steps, current, next, decision, techId, fabricId, onChanged, readOnly }: {
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

  return (
    <div className="text-[13px]">
      <p className="flex flex-wrap items-baseline gap-x-2">
        {current ? <span>Tata has reached <b>{current.name}</b>, step {current.order} of {steps.length}.</span>
          : <span><b>Not recorded yet:</b> nobody has said how far Tata has got with it here.</span>}
        {!changing && (
          <button type="button" onClick={start} className="rounded-full border border-line bg-white px-3 py-0.5 text-[12.5px] hover:bg-ground">
            {current ? "Change step" : "Record the step"}
          </button>
        )}
      </p>
      {decision && current && !changing && <DecisionNote what={`Set at ${current.name}`} decision={decision} onUndone={() => onChanged?.()} />}
      {!changing && next && <NextRung next={next} />}
      {changing && (
        <p className="mt-2 text-[12.5px] text-navy">
          Pick the step Tata has actually reached, then Save. Only a person sets this; the leaders&apos; view and the Point of View show it.
        </p>
      )}

      <ol className="mt-2 divide-y divide-neutral-100 rounded-lg border border-line" aria-label="Path to scale">
        {steps.filter((s) => !unwritten(s)).map((s) => (
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
        {later.length > 0 && (changing ? later.map((s) => (
          <li key={s._id}>
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-ground/60">
              {radio(s)}
              <span><span className="font-medium">{s.name}</span> <span className="text-muted">· its proof isn&apos;t written yet</span></span>
            </label>
          </li>
        )) : (
          <li className="flex flex-wrap items-baseline gap-2 px-3 py-2 text-[12.5px] text-muted">
            {later.map((s) => <span key={s._id} className="flex items-center gap-1.5">{badge(s)}<span className="text-ink">{s.name}</span>{chips(s)}</span>)}
            <span>: the proof these need isn&apos;t written yet (Setup › Path to scale).</span>
          </li>
        ))}
      </ol>

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
