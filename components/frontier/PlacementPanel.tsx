"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ChoiceForm from "@/components/ChoiceForm";
import FabricLabel from "@/components/FabricLabel";
import { MeasureWhy } from "@/components/PovScores";
import { type EditionPov, fetchEditionPov, type Item, type Lens, povHref } from "@/components/frontier/items";
import { errorText } from "@/lib/api";
import { decide } from "@/lib/decisions";
import { type Cutpoints, quadrantOf } from "@/lib/grid";
import { formatScore } from "@/lib/scoring";
import { PRIORITY, scoreShade } from "@/lib/theme";

/** What placed a dot: the measures behind its how soon and how big, as the
 *  edition's Point of View holds them. An admin can change one (a hand score,
 *  the same choice as on the Assessment tab): it applies there now, and here
 *  from the next edition. */
export default function PlacementPanel({ item, gridFrom, cutpoints, lens, admin, from, onClose }: {
  item: Item;
  gridFrom: { how_soon: string[]; how_big: string[] } | null | undefined;
  cutpoints: Cutpoints;
  lens: Lens;
  admin: boolean;
  from: string;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<{ pov: EditionPov | null; missing: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, number | string>>({}); // this visit's hand scores
  const heading = useRef<HTMLHeadingElement>(null);

  // focus moves to the panel (a keyboard user is there, a screen reader says so), and on a
  // narrower screen, where it sits below the grid, this brings it into view
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  // one panel per dot (the page keys it), so its form and notes start afresh
  useEffect(() => {
    let live = true;
    fetchEditionPov(item.tech_id)
      .then((r) => { if (live) setLoaded(r); })
      .catch((e) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [item.tech_id]);

  useEffect(() => {
    // Esc closes the panel, but not while a score is being typed: there it only leaves the box
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLElement && e.target.closest("input, textarea, select"))) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pov = loaded?.pov ?? null;
  const fabric = pov?.fabrics?.find((f) => f.fabric_id === item.fabric_id);
  const meta = pov?.measures ?? [];
  const groups: [string, number | null, string[]][] = gridFrom
    ? [["How soon", item.how_soon, gridFrom.how_soon],
      [lens === "defence" ? "How big (not used in this view: across is the Disruption threat)" : "How big", item.how_big, gridFrom.how_big]]
    : [["Measures", null, meta.map((m) => m._id)]]; // an edition from before it recorded them
  const quadrant = quadrantOf(item.how_soon, lens === "defence" ? item.threat : item.how_big, cutpoints);
  // a priority a person set can sit in another corner than the scores put it
  const corner = quadrant && item.override ? `Priority set by a person; the scores alone put it in ${quadrant}.` : null;
  const href = povHref(item, from);

  return (
    <aside aria-label={`What placed ${item.name}`}
      className="scroll-mt-4 rounded-card border border-line bg-white px-4 pb-4 text-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      {/* the name, its chips, the Point of View link and × stay in view while the measures scroll */}
      <div className="sticky top-0 z-10 -mx-4 flex items-start justify-between gap-3 border-b border-line bg-white px-4 pb-3 pt-4">
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-base font-semibold text-ink outline-none">{item.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <FabricLabel id={item.fabric_id} name={item.fabric} />
            {item.priority && <span className={`px-1 py-0.5 font-mono text-[11px] ${PRIORITY[item.priority] ?? ""}`}>{item.priority}</span>}
            {quadrant && <span className="font-semibold uppercase tracking-wider text-navy">{quadrant}</span>}
            {item.evidence && <span>evidence {item.evidence}</span>}
          </div>
          {corner && <p className="mt-1 text-xs text-muted">{corner}</p>}
          {href
            ? <Link href={href} className="mt-2 inline-block text-link hover:underline">Open the Point of View →</Link>
            : <p className="mt-2 text-xs text-muted">No Point of View written yet.</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-lg leading-none text-muted hover:text-ink">×</button>
      </div>

      {error && <p className="mt-3 text-failed">{error}</p>}
      {loaded && !pov && <p className="mt-3 text-muted">No Point of View in this edition, so its measures aren&apos;t shown. {loaded.missing}</p>}
      {!loaded && !error && <p className="mt-3 text-muted">Loading…</p>}
      {lens === "defence" && (
        <p className="mt-3">Disruption threat: {item.threat != null ? `${formatScore(item.threat)}, entered by Tata` : item.threat_missing}</p>
      )}

      {pov && !fabric && <p className="mt-3 text-muted">This edition&apos;s Point of View has no measures for {item.fabric}, so none are shown.</p>}
      {fabric && groups.map(([label, value, ids]) => (
        <section key={label} className="mt-4">
          <h3 className="flex items-baseline gap-2 font-medium text-ink">
            {label}
            {value != null && <span className={`px-1.5 py-0.5 font-mono text-xs tabular-nums ${scoreShade(value)}`}>{formatScore(value)}</span>}
            {value != null && <span className="text-xs font-normal text-muted">the average of the scored measures below</span>}
          </h3>
          <ul className="mt-1 divide-y divide-neutral-100">
            {ids.filter((id) => fabric.measures[id]).map((id) => {
              const m = fabric.measures[id];
              const def = meta.find((x) => x._id === id);
              return (
                <li key={id} className="py-2">
                  <div className="flex items-baseline gap-2">
                    <span className={`w-9 shrink-0 px-1 py-0.5 text-center font-mono text-xs tabular-nums ${scoreShade(m.score)}`}>
                      {m.score != null ? formatScore(m.score) : "—"}
                    </span>
                    <span className="min-w-0 flex-1 font-medium text-neutral-800">{def?.name ?? id}</span>
                    {admin && form !== id && m.state !== "waiting_for_tata" && (
                      <button type="button" onClick={() => setForm(id)}
                        className="rounded-full border border-line px-2 py-0.5 text-xs hover:bg-ground">Change</button>
                    )}
                    {admin && m.state === "waiting_for_tata" && (
                      <span className="text-xs text-muted" title="Tata enters this figure on the technology's Assessment tab">Tata&apos;s entry</span>
                    )}
                  </div>
                  <details className="ml-11 mt-0.5 text-[13px] leading-relaxed text-neutral-600">
                    <summary className="cursor-pointer list-none hover:text-ink">
                      {m.state === "scored" && m.justification ? m.justification.split(/(?<=[.!?])\s/)[0] : <MeasureWhy m={m} sources={pov?.sources ?? []} />}{" "}
                      <span className="text-link">more</span>
                    </summary>
                    <div className="mt-1"><MeasureWhy m={m} sources={pov?.sources ?? []} /></div>
                    {m.counter_case && <p className="mt-1 italic text-neutral-500">What argues against it: {m.counter_case}</p>}
                  </details>
                  {form === id && (
                    <ChoiceForm label={def?.scope === "technology" ? "Your score, 0–10 (applies in every fabric)" : "Your score, 0–10"}
                      value={String(saved[id] ?? m.score ?? "")} reasonRequired placeholder="why it should differ"
                      onSubmit={(value, reason) => decide({ kind: "hand_score", tech_id: item.tech_id,
                        fabric_id: item.fabric_id, measure_id: id, value, reason })
                        .then(() => { setForm(null); setSaved((v) => ({ ...v, [id]: value })); })}
                      onCancel={() => setForm(null)} />
                  )}
                  {id in saved && (
                    <p role="status" className="ml-11 mt-1 rounded bg-emerald-50 px-2 py-1 text-[12.5px] text-emerald-900">
                      Your score {saved[id]} is saved. The dot moves in the next edition; on the{" "}
                      <Link className="text-link hover:underline"
                        href={`/admin/technologies/${encodeURIComponent(item.tech_id)}?tab=fabrics&fabric=${encodeURIComponent(item.fabric_id)}`}>
                        technology&apos;s Assessment tab</Link>{" "}it applies now.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

    </aside>
  );
}
