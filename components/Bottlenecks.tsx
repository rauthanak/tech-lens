"use client";

import { useState } from "react";
import DecisionNote from "@/components/DecisionNote";
import PageRefs from "@/components/PageRefs";
import { errorText } from "@/lib/api";
import { decide } from "@/lib/decisions";
import type { Finance, Pages, SuggestedBlocker } from "@/lib/value";

/** What could stop a technology scaling in a fabric: people tick the ones
 *  that apply from the fabric's list of blockers (Setup › Fabrics), and may
 *  write another. A blocker the model read on a page says so under it, with
 *  why, the words and the page; it is only picked when a person ticks it.
 *  Read-only on the Point of View: the picked ones. */
export default function Bottlenecks({ picked, options, suggested = [], pages, techId, fabricId, onChanged, readOnly }: {
  picked: Finance["bottlenecks"];
  options?: string[]; // the fabric's list; undefined while it loads
  suggested?: SuggestedBlocker[];
  pages?: Pages;
  techId: string;
  fabricId: string;
  onChanged?: () => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [ticked, setTicked] = useState<string[]>(picked?.picked ?? []);
  const [other, setOther] = useState(picked?.other ?? "");
  const [error, setError] = useState<string | null>(null);
  const chosen = [...(picked?.picked ?? []), ...(picked?.other ? [picked.other] : [])];

  if (readOnly) return chosen.length
    ? <ul className="list-disc space-y-0.5 pl-5 text-[13px]">{chosen.map((b) => <li key={b}>{b}</li>)}</ul>
    : <p className="text-[13px] text-muted">Not picked yet: Tata picks them on the technology&apos;s page.</p>;
  const hint = (b: string) => suggested.find((s) => s.name === b);

  if (picked && !editing) return (
    <div>
      <ul className="list-disc space-y-0.5 pl-5 text-[13px]">{chosen.map((b) => <li key={b}>{b}</li>)}</ul>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <DecisionNote what="Picked" decision={picked.decision} onUndone={() => onChanged?.()} />
        <button type="button" className="text-[12.5px] text-link hover:underline" onClick={() => setEditing(true)}>Change</button>
      </div>
    </div>
  );
  if (!options) return null;
  if (!options.length) return <p className="text-[13px] text-muted">This fabric has no blockers listed yet: add them in Setup › Fabrics.</p>;
  return (
    <form className="space-y-1.5 text-[13px]" onSubmit={async (e) => {
      e.preventDefault();
      setError(null);
      try {
        await decide({ kind: "bottlenecks", tech_id: techId, fabric_id: fabricId, value: { picked: ticked, other } });
        setEditing(false);
        onChanged?.();
      } catch (err) { setError(errorText(err)); }
    }}>
      {options.map((b) => {
        const s = hint(b);
        return (
          <label key={b} className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={ticked.includes(b)}
              onChange={(e) => setTicked(e.target.checked ? [...ticked, b] : ticked.filter((x) => x !== b))} />
            <span>
              {b}
              {s && (
                <span className="mt-0.5 block text-[12.5px] text-neutral-700">
                  <span className="rounded bg-azure/15 px-1.5 text-[11.5px] text-navy">Suggested from the pages</span>{" "}
                  {s.why} <i>&ldquo;{s.quote}&rdquo;</i> <PageRefs ids={[s.page]} pages={pages} />
                </span>
              )}
            </span>
          </label>
        );
      })}
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-muted">Other</span>
        <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="a blocker not on the list"
          className="min-w-0 flex-1 basis-60 rounded border border-neutral-300 bg-white px-2 py-1 text-sm" />
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!ticked.length && !other.trim()}
          className="rounded-full bg-navy px-3.5 py-1 text-sm text-white hover:bg-navy-strong disabled:opacity-50">Save</button>
        {editing && <button type="button" className="text-muted hover:text-ink" onClick={() => setEditing(false)}>Cancel</button>}
        {!ticked.length && !other.trim() && <span className="text-[12.5px] text-muted">Tick one or more, or write your own, to save.</span>}
      </div>
      {error && <p className="text-[12.5px] text-failed">Not saved: {error}</p>}
    </form>
  );
}
