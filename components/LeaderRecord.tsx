"use client";

import { useCallback, useEffect, useState } from "react";
import DecisionNote from "@/components/DecisionNote";
import type { Leader } from "@/components/frontier/items";
import { errorText, fetchJson } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { decide } from "@/lib/decisions";
import type { Brief } from "@/lib/value";

type Record_ = Leader & { decision: Brief | null };
type Field = "owner" | "next_action" | "due" | "people" | "budget" | "poc";
const FIELDS: { key: Field; label: string; placeholder: string; required?: boolean; date?: boolean }[] = [
  { key: "owner", label: "Owner", placeholder: "who answers for it", required: true },
  { key: "next_action", label: "Next action", placeholder: "e.g. a pilot with one bank", required: true },
  { key: "due", label: "By", placeholder: "", required: true, date: true },
  { key: "people", label: "People committed", placeholder: "e.g. 2 engineers from the IoT team" },
  { key: "budget", label: "Budget committed", placeholder: "e.g. $250k in FY27" },
  { key: "poc", label: "Proof of concept", placeholder: "e.g. with a Mumbai port operator, Q4" },
];
const input = "mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-ink";

/** Who owns a technology at Tata in a fabric, and what's next (deck p.13):
 *  the owner, the next action and its date, and what's committed. Entered by
 *  people, never by the model; a score never changes because of it. One row
 *  of the fabric tab's "What's recorded": the commitment it sets (No owner
 *  yet, Defined, Aligned, Integrated) is said in the plan's title, and the
 *  leaders' view shows it. People, budget or a trial show once recorded. */
export default function LeaderRecord({ techId, fabricId, onChanged }: {
  techId: string;
  fabricId: string;
  onChanged?: () => void;
}) {
  const [rec, setRec] = useState<Record_ | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Record<Field, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const load = useCallback(() =>
    fetchJson<Record_>(`/api/decisions/leader?tech_id=${encodeURIComponent(techId)}&fabric_id=${encodeURIComponent(fabricId)}`)
      .then((r) => { setRec(r); setError(null); })
      .catch((e) => setError(errorText(e))), [techId, fabricId]);
  useEffect(() => { load(); }, [load]);
  const changed = async () => { setEditing(false); await load(); onChanged?.(); };

  if (error) return <p className="text-[13px] text-failed">What a leader recorded didn&apos;t load: {error}</p>;
  if (!rec) return null;
  const open = () => { setForm(Object.fromEntries(FIELDS.map((f) => [f.key, rec[f.key] ?? ""]))); setSaveError(null); setEditing(true); };

  return (
    <div className="text-[13px]">
      {rec.decision && !editing && (
        <div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5">
            {FIELDS.filter((f) => f.key !== "due" && (f.required || rec[f.key])).map((f) => (
              <div key={f.key} className="contents">
                <dt className="text-muted">{f.label}</dt>
                <dd>{f.key === "next_action" ? `${rec.next_action?.replace(/[.\s]+$/, "")}${rec.due ? `, by ${formatDate(rec.due, true)}` : ""}` : rec[f.key]
                  ?? <span className="text-muted">not recorded</span>}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <DecisionNote what="Recorded" decision={rec.decision} onUndone={changed} />
            <button type="button" className="text-[12.5px] text-link hover:underline" onClick={open}>Change</button>
          </div>
        </div>
      )}
      {!rec.decision && !editing && (
        <button type="button" onClick={open}
          className="rounded-full border border-line bg-white px-3 py-1 text-[13px] hover:bg-ground">Record owner and next action…</button>
      )}

      {editing && (
        <form className="mt-2 grid grid-cols-1 gap-2 rounded-lg border border-line bg-ground/60 p-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaveError(null);
            try {
              await decide({ kind: "commitment", tech_id: techId, fabric_id: fabricId, value: form });
              await changed();
            } catch (err) { setSaveError(errorText(err)); }
          }}>
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col text-xs text-muted">
              {f.label}{f.required ? " (required)" : " (optional)"}
              <input type={f.date ? "date" : "text"} value={form[f.key] ?? ""} placeholder={f.placeholder} maxLength={500}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className={input} />
            </label>
          ))}
          <p className="text-[12px] text-muted sm:col-span-2">
            Any one of people, budget or a proof of concept makes it Integrated, once the step reached and the blockers
            are recorded too.
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button type="submit" disabled={!FIELDS.every((f) => !f.required || (form[f.key] ?? "").trim())}
              className="rounded-full bg-navy px-3.5 py-1 text-sm text-white hover:bg-navy-strong disabled:opacity-50">Save</button>
            <button type="button" className="text-muted hover:text-ink" onClick={() => setEditing(false)}>Cancel</button>
            {saveError && <span className="text-[12.5px] text-failed">Not saved: {saveError}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
