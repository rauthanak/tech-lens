"use client";

import { useState } from "react";
import { errorText } from "@/lib/api";
import { decide } from "@/lib/decisions";
import { figureText, type Figure, type Finance, type Input, money, percent, sourceText } from "@/lib/value";

const field = "mt-1 block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-ink";
const AMOUNTS = ["revenue", "volume", "price", "displaced", "upfront", "running"] as const;
const SHARES = ["margin", "loss_without", "loss_with"] as const;
const NOTES = ["buyer", "budget", "exposed_contracts", "cost_per_outcome"] as const;
type Key = (typeof AMOUNTS)[number] | (typeof SHARES)[number] | (typeof NOTES)[number] | "mechanism";

/** The payback line: cumulative cash, from minus the upfront investment,
 *  rising by the yearly contribution net of running costs, crossing zero at
 *  payback. Point at it for the cash at any month. */
function PaybackLine({ upfront, net, months }: { upfront: number; net: number; months: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const span = Math.max(24, Math.ceil((months * 1.6) / 12) * 12);     // whole years, past the crossing
  const W = 320, H = 132, L = 8, R = 8, T = 14, B = 22;
  const end = -upfront + (net * span) / 12;
  const lo = Math.min(-upfront, 0), hi = Math.max(end, 0);
  const x = (m: number) => L + ((W - L - R) * m) / span;
  const y = (v: number) => T + ((H - T - B) * (hi - v)) / (hi - lo || 1);
  const cash = (m: number) => -upfront + (net * m) / 12;
  const every = Math.ceil(span / 12 / 6);                             // at most about 7 year marks
  const years = Array.from({ length: Math.floor(span / 12 / every) + 1 }, (_, i) => i * every);
  return (
    <figure className="mt-2 max-w-sm">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`Cumulative cash: minus ${money(upfront)} at the start, crossing zero at about ${months} months`}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const m = Math.round((((e.clientX - box.left) / box.width) * W - L) / (W - L - R) * span);
          setHover(Math.min(span, Math.max(0, m)));
        }} onMouseLeave={() => setHover(null)}>
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--color-line)" />
        {years.map((yr) => (
          <text key={yr} x={x(yr * 12)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-muted)">{yr === 0 ? "now" : `${yr}y`}</text>
        ))}
        <polyline points={`${x(0)},${y(-upfront)} ${x(span)},${y(end)}`} fill="none" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" />
        <circle cx={x(months)} cy={y(0)} r="4" fill="var(--color-navy)" stroke="white" strokeWidth="2" />
        <text x={x(months)} y={y(0) - 7} textAnchor={months / span > 0.7 ? "end" : "start"} fontSize="10.5" fill="var(--color-ink)">
          pays back at about {months} months
        </text>
        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--color-faint)" strokeDasharray="2 2" />
            <circle cx={x(hover)} cy={y(cash(hover))} r="3" fill="var(--color-navy)" />
            <text x={x(hover) + (hover / span > 0.6 ? -4 : 4)} y={T - 2} textAnchor={hover / span > 0.6 ? "end" : "start"} fontSize="10" fill="var(--color-ink)">
              month {hover}: {cash(hover) < 0 ? "−" : ""}{money(Math.abs(cash(hover)))}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="text-[11.5px] text-muted">Cumulative cash: minus the upfront investment, then contribution less running cost each year.</figcaption>
    </figure>
  );
}

/** The finance screen for a technology in a fabric: the three figures
 *  (contribution, or contribution protected; payback; break-even) worked out
 *  by code from inputs people enter, each input with where it came from and
 *  when, what's missing, and the payback line. Folded until the card asks
 *  for something (Proof of concept on, or a next step that needs it); the
 *  form opens on "Enter the figures". */
export default function FinanceCard({ f, techId, fabricId, onChanged, readOnly }: {
  f: Finance; techId: string; fabricId: string; onChanged?: () => void; readOnly?: boolean;
}) {
  const own = (x: { at?: string } | null) => Boolean(x?.at);     // set for this technology, not a default
  const start = () => ({
    ...Object.fromEntries(AMOUNTS.map((k) => [k, f[k] && own(f[k]) && !f[k]!.source.startsWith("volume") ? String(f[k]!.value) : ""])),
    ...Object.fromEntries(SHARES.map((k) => [k, f[k] && own(f[k]) ? String(Math.round(f[k]!.value * 1000) / 10) : ""])),
    ...Object.fromEntries(NOTES.map((k) => [k, f.notes[k]?.value ?? ""])),
    mechanism: own(f.mechanism) ? f.mechanism.value : "",
  }) as Record<Key, string>;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(start);
  const [error, setError] = useState<string | null>(null);
  const protect = (form.mechanism || f.mechanism.value) === "protect";

  const figure = (fallback: string, x?: Figure, missing?: string[]) => (
    <div className="rounded-lg bg-ground/50 px-3 py-2">
      <div className="font-mono text-[10.5px] uppercase tracking-wider text-neutral-500">{x?.label ?? fallback}</div>
      {x?.value != null ? (
        <>
          <div className="text-[17px] font-semibold tabular-nums">{figureText(x.value, x.unit)}
            {x.months != null && <span className="text-[13px] font-normal text-muted"> · about {x.months} months</span>}</div>
          {x.volume != null && <div className="text-[12px] text-muted">or {money(x.volume)} units a year at the price</div>}
          <div className="text-[11.5px] text-muted">{x.formula}</div>
        </>
      ) : x?.note ? <div className="text-[12.5px] text-amber-900">{x.note}</div>
        : <div className="text-[12.5px] text-muted">{readOnly ? "For Tata to fill in: " : "Needs: "}{(missing ?? []).join(", ")}</div>}
    </div>
  );
  const shown = (label: string, x: Input | null, pct = false) =>
    x && <li key={label}>{label} {pct ? percent(x.value) : money(x.value)} <span className="text-faint">({sourceText(x)})</span></li>;

  if (!f.asks && !f.entered && !open) return (
    <p className="text-[13px] text-muted">
      Not needed yet: finance figures are asked for from Proof of concept on, where a buyer, a budget and a price first
      exist, or once its path to scale is set and the next step needs them.{" "}
      {!readOnly && <button type="button" onClick={() => { setOpen(true); setEditing(true); }} className="text-link hover:underline">Enter figures anyway</button>}
    </p>
  );
  const num = (k: Key) => (form[k] === "" ? undefined : (SHARES as readonly string[]).includes(k) ? Number(form[k]) / 100 : Number(form[k]));
  const input = (k: Key, label: string, opts: { pct?: boolean; text?: boolean; hint?: string } = {}) => (
    <label key={k} className="text-[12px] text-muted">{label}
      <input className={field} type={opts.text ? "text" : "number"} min={0} max={opts.pct ? 100 : undefined} step="any"
        placeholder={opts.hint} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </label>
  );
  const group = (title: string, children: React.ReactNode) => (
    <fieldset className="col-span-full grid grid-cols-2 gap-2 sm:grid-cols-4">
      <legend className="col-span-full mb-0.5 font-mono text-[10.5px] uppercase tracking-wider text-neutral-500">{title}</legend>
      {children}
    </fieldset>
  );
  const fabricDefault = (x: Input | null) => (x && !own(x) ? `${percent(x.value)}, fabric default` : "blank: fabric default");
  const notes = NOTES.filter((k) => f.notes[k]);

  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {figure("Contribution, a year", f.contribution, f.missing.contribution)}
        {figure("Payback", f.payback, f.missing.payback)}
        {figure("Break-even revenue, a year", f.break_even, f.missing.break_even)}
      </div>
      {f.payback?.value != null && f.payback.months != null && f.upfront && f.running && f.contribution?.value != null && (
        <PaybackLine upfront={f.upfront.value} net={f.contribution.value - f.running.value} months={f.payback.months} />
      )}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-muted">
        <li>Counts as {f.mechanism.value === "protect" ? "contribution protected" : "new contribution"}{" "}
          <span className="text-faint">({sourceText(f.mechanism)})</span></li>
        {f.margin ? shown("Margin", f.margin, true) : <li>Margin: none yet{readOnly ? "" : " (set the fabric's default in Setup › Fabrics, or one here)"}</li>}
        {f.mechanism.value === "protect" && shown("Loss rate without it", f.loss_without, true)}
        {f.mechanism.value === "protect" && shown("with it", f.loss_with, true)}
        {shown(f.mechanism.value === "protect" ? "Revenue at stake, a year" : "Revenue, a year", f.revenue)}
        {shown("Revenue it displaces, a year", f.displaced)}
        {shown("Upfront", f.upfront)}
        {shown("Running, a year", f.running)}
        {notes.map((k) => <li key={k}>{{ buyer: "Named buyer", budget: "Budget or willingness to pay", exposed_contracts: "Exposed contracts",
          cost_per_outcome: "Measured cost per outcome" }[k]}: <span className="text-ink">{f.notes[k]!.value}</span></li>)}
      </ul>
      <p className="mt-1 text-[11.5px] text-faint">Worked out by code from figures people enter; the model never writes one.</p>
      {!readOnly && !editing && (
        <button type="button" onClick={() => { setForm(start()); setEditing(true); }} className="mt-2 text-[13px] text-link hover:underline">
          {f.entered ? "Change the figures" : "Enter the figures"}
        </button>
      )}
      {!readOnly && editing && (
        <form className="mt-3 grid grid-cols-2 gap-x-2 gap-y-3 rounded-lg border border-line bg-ground/40 p-3 sm:grid-cols-4" onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await decide({ kind: "finance", tech_id: techId, fabric_id: fabricId, value: {
              ...Object.fromEntries([...AMOUNTS, ...SHARES].map((k) => [k, num(k)])),
              ...Object.fromEntries(NOTES.map((k) => [k, form[k].trim() || undefined])),
              mechanism: form.mechanism || undefined } });
            setEditing(false);
            onChanged?.();
          } catch (err) { setError(errorText(err)); }
        }}>
          {group("How the revenue counts", (
            <label className="col-span-2 text-[12px] text-muted">Mechanism
              <select className={field} value={form.mechanism} onChange={(e) => setForm({ ...form, mechanism: e.target.value })}>
                <option value="">As the fabric&apos;s contribution lever{own(f.mechanism) ? "" : ` (${f.mechanism.value})`}</option>
                <option value="protect">Protect: revenue at stake that it keeps</option>
                <option value="earn">Earn: new revenue it brings</option>
              </select>
            </label>
          ))}
          {group("Revenue, a year", <>
            {input("revenue", protect ? "Revenue at stake" : "Revenue", { hint: "or volume × price" })}
            {input("volume", "or volume, units")}
            {input("price", "× indicative price, a unit")}
            {!protect && input("displaced", "Revenue it displaces")}
          </>)}
          {group("Costs", <>{input("upfront", "Upfront investment")}{input("running", "Running cost, a year")}</>)}
          {group("Rates, %", <>
            {input("margin", "Margin", { pct: true, hint: fabricDefault(f.margin) })}
            {protect && input("loss_without", "Loss rate without it", { pct: true, hint: fabricDefault(f.loss_without) })}
            {protect && input("loss_with", "Loss rate with it", { pct: true, hint: fabricDefault(f.loss_with) })}
          </>)}
          {group("Evidence for the next step", <>
            {input("buyer", "Named buyer", { text: true })}
            {input("budget", "Budget or willingness to pay", { text: true })}
            {protect && input("exposed_contracts", "Exposed contracts, renewal dates", { text: true })}
            {input("cost_per_outcome", "Measured cost per outcome", { text: true, hint: "against the current process" })}
          </>)}
          <div className="col-span-full flex flex-wrap items-center gap-3">
            <button type="submit" className="rounded-full bg-navy px-3.5 py-1.5 text-sm text-white hover:bg-navy-strong">Save</button>
            {(form.margin !== "" || form.loss_without !== "" || form.loss_with !== "" || form.mechanism !== "") && (
              <button type="button" className="text-[12.5px] text-link hover:underline"
                onClick={() => setForm({ ...form, margin: "", loss_without: "", loss_with: "", mechanism: "" })}>Reset to fabric default</button>
            )}
            {f.entered && <button type="button" className="text-[12.5px] text-muted hover:text-ink" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
          {error && <p className="col-span-full text-[12.5px] text-failed">Not saved: {error}</p>}
        </form>
      )}
    </div>
  );
}
