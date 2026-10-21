"use client";

import Link from "next/link";
import FabricLabel from "@/components/FabricLabel";
import {
  HORIZON_WORDS, type Item, type Lens, LENS_WORDS, leaderName, leaderText, measuresNote, moveReason, moveText, overrideNote,
  povHref,
} from "@/components/frontier/items";
import { formatScore, PRIORITY_LEGEND } from "@/lib/scoring";
import { PRIORITY } from "@/lib/theme";

function Score({ value, scored }: { value: number | null; scored: Item["soon_scored"] }) {
  return (
    <>
      <span className="font-mono tabular-nums">{value == null ? "no score" : formatScore(value)}</span>
      {measuresNote(scored) && <span className="block text-[11px] text-muted">{measuresNote(scored)}</span>}
    </>
  );
}

/** The grid's placed items as a list, in the same order: most urgent first,
 *  each saying whether it's a best bet now, how its priority moved since the
 *  edition before, and what a leader has recorded. */
export default function Table({ items, from, lens, frontier, since }: {
  items: Item[];
  from: string;
  lens: Lens;
  frontier: { on: Set<Item>; near: Set<Item> };
  since?: string;
}) {
  const th = "px-3 py-2 font-normal";
  return (
    // relative: keeps the table's scroll inside its box, not widening the page
    <div className="relative overflow-x-auto rounded-card border border-line bg-white">
      <table className="w-full min-w-[78rem] text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            <th className={th}>Technology</th>
            <th className={th}>Fabric</th>
            <th className={th}>Stage</th>
            <th className={th}>Priority</th>
            <th className={`${th} text-right`}>How soon</th>
            <th className={`${th} text-right`}>{LENS_WORDS[lens].up}</th>
            <th className={th}>Horizon</th>
            <th className={th}>Tata&apos;s step</th>
            <th className={th}>What Tata records</th>
            <th className={th}>Point of View</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {items.map((item, i) => {
            const href = povHref(item, from);
            return (
              <tr key={`${item.tech_id}:${item.fabric_id}:${i}`} className="align-top">
                <td className="px-3 py-2.5 font-medium text-ink">
                  {item.name}
                  {(frontier.on.has(item) || frontier.near.has(item)) && (
                    <span className="mt-0.5 block text-[11px] font-normal text-navy">
                      {frontier.on.has(item) ? "Best bet now" : "Close behind"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5"><FabricLabel id={item.fabric_id} name={item.fabric} /></td>
                <td className="px-3 py-2.5">
                  {item.stage.known ? item.stage.name : <span className="text-muted">not judged yet</span>}
                </td>
                <td className="px-3 py-2.5">
                  {item.priority && (
                    <span className={`px-1.5 py-0.5 font-mono text-xs ${PRIORITY[item.priority] ?? "bg-neutral-100"}`}>
                      {item.priority}
                    </span>
                  )}
                  {item.override && (
                    <span className="mt-1 block max-w-60 text-[11px] leading-snug text-muted">
                      <span className="text-ink">✎ set by a person</span>{overrideNote(item)}
                    </span>
                  )}
                  {item.moved && (
                    <span className="mt-1 block max-w-60 text-[11px] leading-snug text-muted">
                      <span className="text-ink">{moveText(item, since)}</span>: {moveReason(item.moved, item.override)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right"><Score value={item.how_soon} scored={item.soon_scored} /></td>
                <td className="px-3 py-2.5 text-right">
                  {lens === "defence" ? <Score value={item.threat} scored={[null, null]} />
                    : <Score value={item.how_big} scored={item.big_scored} />}
                </td>
                <td className="px-3 py-2.5">
                  {item.horizon ? HORIZON_WORDS[item.horizon] ?? item.horizon : <span className="text-muted">not set</span>}
                </td>
                <td className="px-3 py-2.5">{item.path_step ?? <span className="text-muted">not recorded</span>}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${leaderName(item.leader).chip}`}>
                    {leaderName(item.leader).name}
                  </span>
                  {item.leader.owner && (
                    <span className="mt-1 block max-w-64 text-[11px] leading-snug text-muted">{leaderText(item.leader)}</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {href ? (
                    <Link href={href} title={item.pov?.headline ?? undefined}
                      className="whitespace-nowrap text-link hover:underline">Read →</Link>
                  ) : <span className="text-muted">not written yet</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-neutral-100 px-3 py-2 text-xs text-muted">{PRIORITY_LEGEND}.</p>
    </div>
  );
}
