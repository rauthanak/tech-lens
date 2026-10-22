"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import FinanceCard from "@/components/FinanceCard";
import PageHeader from "@/components/PageHeader";
import { fetchJson } from "@/lib/api";
import { figureText, type Figure, type Finance, FINANCE_SHOWN, money, percent, sourceText } from "@/lib/value";

type Row = Finance & { tech_id: string; name: string; fabric_id: string; fabric: string };
const HEADS = ["Technology", "Tata's step", "Margin", "Revenue, a year", "Upfront", "Running, a year", "Contribution, a year",
  "Payback", "Break-even", ""];

/** Every technology and fabric whose finance card asks for something (from
 *  Proof of concept on, or a next step that needs it) or has inputs;
 *  "Missing inputs" narrows it to those with a figure or the next step's
 *  proof still waiting. "Enter figures" opens the row's finance card in place. */

// the three worked-out figures, in the order of their columns
const FIGURES = [["contribution", "contribution"], ["payback", "payback"], ["break_even", "break-even"]] as const;
const andList = (items: string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
function FinanceTable() {
  const router = useRouter();
  const params = useSearchParams();
  const missing = params.get("missing") === "true";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => fetchJson<{ rows: Row[] }>(`/api/finance?missing=${missing}`).then((d) => setRows(d.rows)).catch(setError),
    [missing]);
  useEffect(() => { load(); }, [load]);
  // a worked-out figure, its note, or "—" (what it needs is said once, under the row)
  const cell = (x?: Figure) =>
    x?.value != null ? <>{figureText(x.value, x.unit)}{x.label?.includes("protected") && <span className="block text-xs text-muted">protected</span>}</>
      : x?.note ? <span className="text-amber-900">{x.note}</span> : <span className="text-muted">—</span>;
  // which figures can't be worked out yet, and every input they wait for, once each
  const waiting = (r: Row) => {
    const figs = FIGURES.filter(([k]) => r[k]?.value == null && !r[k]?.note);
    const inputs = [...new Set(figs.flatMap(([k]) => r.missing[k] ?? []))];
    return figs.length && inputs.length ? `To work out ${andList(figs.map(([, name]) => name))}: ${inputs.join(", ")}.` : null;
  };
  return (
    <div>
      <PageHeader title="Finance"
        intro="The finance screen for every technology Tata is moving forward: figures people enter; contribution, payback and break-even are worked out from them, never by the model."
        help={<>
          <li>One row per technology and fabric with finance inputs, or whose step Tata has reached is recorded and whose next
            step needs a figure or note: from Proof of concept on, or earlier when the next step asks for one.</li>
          <li>Contribution is (revenue − revenue it displaces) × margin. For a lever that protects contribution, only the difference
            in loss rates counts: revenue at stake × margin × (loss rate without − loss rate with). Payback is upfront ÷ (contribution
            − running cost); break-even is the yearly revenue that covers the running cost. The model never writes a figure.</li>
          <li>Enter figures opens a row&apos;s finance card here; the same card is on the technology&apos;s fabric tab. A fabric&apos;s
            default margin and loss rates are set in Setup › Fabrics.</li>
        </>} />
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={missing} onChange={(e) => router.replace(e.target.checked ? "/admin/finance?missing=true" : "/admin/finance", { scroll: false })} />
        Only those with missing inputs
      </label>
      {error != null && <BackendError error={error} />}
      {rows && (
        <div className="mt-3 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                {HEADS.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => {
                const id = `${r.tech_id}:${r.fabric_id}`;
                const next = r.next_step;
                const needs = waiting(r);
                return (
                  <Fragment key={id}>
                    <tr className={open === id ? "bg-ground/60" : ""}>
                      <td className="px-3 py-2"><Link href={`/admin/technologies/${r.tech_id}?fabric=${r.fabric_id}#finance`} className="font-medium hover:underline">{r.name}</Link>
                        <span className="block text-xs text-muted">{r.fabric}</span></td>
                      <td className="px-3 py-2">{r.step?.name ?? <span className="text-muted">not recorded</span>}
                        {next && next.needs.length > 0 && (
                          <span className={`block text-xs ${next.in_hand ? "text-emerald-800" : "text-muted"}`}>
                            {next.in_hand ? `Next step, ${next.name}: proof in hand` : `Next step, ${next.name}, needs: ${next.needs.filter((n) => !n.have).map((n) => n.label).join(", ")}`}
                          </span>
                        )}</td>
                      <td className="px-3 py-2">{r.margin ? <>{percent(r.margin.value)}<span className="block text-xs text-muted">{sourceText(r.margin)}</span></> : <span className="text-muted">not entered</span>}</td>
                      <td className="px-3 py-2 tabular-nums">{r.revenue ? <>{money(r.revenue.value)}
                        <span className="block text-xs text-muted">{r.mechanism.value === "protect" ? "at stake" : "new"}{r.displaced ? `, less ${money(r.displaced.value)} displaced` : ""}</span></>
                        : <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-2 tabular-nums">{r.upfront ? money(r.upfront.value) : <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-2 tabular-nums">{r.running ? money(r.running.value) : <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-2 tabular-nums">{cell(r.contribution)}</td>
                      <td className="px-3 py-2 tabular-nums">{cell(r.payback)}</td>
                      <td className="px-3 py-2 tabular-nums">{cell(r.break_even)}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" className="whitespace-nowrap text-link hover:underline" onClick={() => setOpen(open === id ? null : id)}>
                          {open === id ? "Close" : "Enter figures"}
                        </button>
                      </td>
                    </tr>
                    {needs && (
                      // one line under the row, joined to it (no divider)
                      <tr className={open === id ? "bg-ground/60" : ""} style={{ borderTopWidth: 0 }}>
                        <td colSpan={HEADS.length} className="px-3 pb-2 pt-0 text-xs text-muted">{needs}</td>
                      </tr>
                    )}
                    {open === id && (
                      <tr className="bg-ground/60">
                        <td colSpan={HEADS.length} className="px-3 pb-3">
                          <FinanceCard key={r.entered?._id ?? id} f={r} techId={r.tech_id} fabricId={r.fabric_id} onChanged={load} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-5 py-6 text-sm text-muted">
            {missing ? "Nothing is missing." : "No technology has finance inputs yet, or a recorded step whose next step asks for them. Record the step Tata has reached on its fabric tab."}</p>}
        </div>
      )}
    </div>
  );
}

export default function FinancePage() {
  if (!FINANCE_SHOWN) return (
    <div>
      <PageHeader title="Finance" intro="Set aside for now." />
      <p className="mt-4 max-w-2xl rounded-card border border-line bg-white px-5 py-4 text-sm text-neutral-700">
        Contribution, payback and break-even are set aside until Tata has discussed how it wants to judge an emerging
        technology&apos;s business case. Nothing asks for them or shows them meanwhile; any figures already entered are kept.
        The proof each step on the path to scale needs (a measured cost per outcome, a named buyer, a price) is entered on
        the technology&apos;s fabric tab, under Tata&apos;s plan.
      </p>
    </div>
  );
  return <Suspense fallback={null}><FinanceTable /></Suspense>;
}
