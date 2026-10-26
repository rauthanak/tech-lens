"use client";

import Link from "next/link";
import { useState } from "react";
import {
  biggestMoves, type Held, type Item, LEADER_STATES, type Lens, moveReason, moveText, povHref, type Published, upOf,
} from "@/components/frontier/items";
import { VERDICT_STYLE, VERDICT_WORDS } from "@/lib/classification";
import { formatAt, formatDate, plural } from "@/lib/format";
import { formatScore } from "@/lib/scoring";
import { PRIORITY } from "@/lib/theme";

// The leaders' view's sections, shared by the view itself (app/frontier) and the edition pack (app/frontier/pack).

export const pill = (on: boolean) =>
  `rounded-full border px-3 py-1 text-sm ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:bg-ground"}`;
export const card = "rounded-card border border-line bg-white px-5 py-4";

/** A technology's name, linked to its Point of View when the edition has one. */
function Name({ item, from, withFabric }: { item: Item; from: string; withFabric: boolean }) {
  const href = povHref(item, from);
  return (
    <>
      {href ? <Link href={href} className="text-link hover:underline">{item.name}</Link> : item.name}
      {withFabric && <span className="text-muted"> · {item.fabric}</span>}
    </>
  );
}

function Chip({ priority }: { priority: string | null }) {
  return priority ? <span className={`px-1 py-px font-mono text-[11px] ${PRIORITY[priority] ?? "bg-neutral-100"}`}>{priority}</span> : null;
}

/** What couldn't be placed, grouped by why; each technology once per
 *  reason, with the fabrics it's held in. */
export function NotPlaced({ held, from, withFabric, lens }: { held: Held[]; from: string; withFabric: boolean; lens: Lens }) {
  const groups = new Map<string, Map<string, { name: string; fabrics: string[]; href: string | null }>>();
  for (const h of held) {
    const techs = groups.get(h.reason) ?? new Map();
    groups.set(h.reason, techs);
    const tech = techs.get(h.tech_id) ?? { name: h.name, fabrics: [], href: povHref(h, from) };
    techs.set(h.tech_id, tech);
    tech.fabrics.push(h.fabric);
  }
  const open = held.length <= 12; // a short list shows at once; a long one opens by reason
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">
        Not placed yet <span className="font-normal text-muted">· {held.length}</span>
      </h2>
      <p className="mt-1 max-w-4xl text-sm text-neutral-600">
        Assessed, but the evidence couldn&apos;t yet say how soon they arrive or how big the prize is
        {lens === "defence" && ", or Tata hasn't entered the Disruption threat"}, so they have no place on the grid. A
        later assessment, with more evidence, can place them.
      </p>
      {held.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing: every assessed technology is placed.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {[...groups].sort((a, b) => b[1].size - a[1].size).map(([reason, techs]) => (
            <details key={reason} open={open} className="group rounded-card border border-line bg-white">
              <summary className="flex cursor-pointer list-none items-baseline gap-2 px-4 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="inline-block text-[10px] text-muted transition-transform group-open:rotate-90">▶</span>
                <span className="text-ink">
                  {reason}{" "}
                  <span className="whitespace-nowrap text-muted">· {plural(techs.size, "technology", "technologies")}</span>
                </span>
              </summary>
              <ul className="gap-8 px-4 pb-3 pl-9 text-sm sm:columns-2 xl:columns-3">
                {[...techs].map(([id, t]) => (
                  <li key={id} className="break-inside-avoid py-0.5">
                    {t.href ? <Link href={t.href} className="text-link hover:underline">{t.name}</Link> : t.name}
                    {withFabric && <span className="text-muted"> · {t.fabrics.join(", ")}</span>}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

/** One technology on the shortlists: its priority, name and scores, then what
 *  the radar concludes (its Point of View's headline) and how solid the
 *  evidence is, so a leader needn't open it to know what it says. */
function Pick({ item: i, lens, from, withFabric, headline = true }: {
  item: Item; lens: Lens; from: string; withFabric: boolean; headline?: boolean; // once per technology: its other fabrics skip it
}) {
  return (
    <li>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <Chip priority={i.priority} />
        <span className="min-w-0"><Name item={i} from={from} withFabric={withFabric} /></span>
        <span className="text-[12px] tabular-nums text-muted">
          soon {formatScore(i.how_soon ?? 0)} · {lens === "defence" ? "threat" : "big"} {formatScore(upOf(i, lens) ?? 0)}
        </span>
        {i.evidence && (
          <span className={`rounded px-1.5 py-px text-[11px] ${VERDICT_STYLE[i.evidence]}`} title="How solid its evidence is">
            Evidence: {VERDICT_WORDS[i.evidence]}
          </span>
        )}
      </span>
      {headline && i.pov?.headline && <span className="mt-0.5 line-clamp-2 block text-[13px] text-neutral-700">{i.pov.headline}</span>}
    </li>
  );
}

/** The top priority: the Act corner of the grid, sooner first. */
export function ActNow({ items, lens, from, withFabric }: { items: Item[]; lens: Lens; from: string; withFabric: boolean }) {
  const sorted = [...items].sort((a, b) => (b.how_soon ?? 0) - (a.how_soon ?? 0));
  return (
    <section className={card} aria-label="Act now: P1">
      <h2 className="font-semibold">Act now: P1 <span className="font-normal text-muted">· {items.length}</span></h2>
      <p className="mt-0.5 text-[12.5px] text-muted">The Act corner of the grid: sooner and {lens === "defence" ? "more of a threat" : "bigger"} than both solid lines, sooner first.</p>
      {sorted.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing is at P1 here.</p> : (
        <ul className="mt-2 space-y-2.5 text-sm">
          {sorted.map((i, n) => <Pick key={`${i.tech_id}:${i.fabric_id}`} item={i} lens={lens} from={from} withFabric={withFabric}
            headline={sorted.findIndex((x) => x.tech_id === i.tech_id) === n} />)}
        </ul>
      )}
    </section>
  );
}

/** The shortlist the frontier picks: nothing shown is both sooner and higher up. */
export function OnTheFrontier({ on, near, lens, from, withFabric }: {
  on: Item[]; near: Item[]; lens: Lens; from: string; withFabric: boolean;
}) {
  return (
    <section className={card} aria-label="Best bets now: on the frontier">
      <h2 className="font-semibold">Best bets now: on the frontier <span className="font-normal text-muted">· {on.length}</span></h2>
      <p className="mt-0.5 text-[12.5px] text-muted">
        Nothing else here is both sooner and {lens === "defence" ? "more of a threat" : "bigger"} (the blue line on the
        grid), sooner first.
      </p>
      {on.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing is placed here.</p> : (
        <ul className="mt-2 space-y-2.5 text-sm">
          {on.map((i, n) => <Pick key={`${i.tech_id}:${i.fabric_id}`} item={i} lens={lens} from={from} withFabric={withFabric}
            headline={on.findIndex((x) => x.tech_id === i.tech_id) === n} />)}
        </ul>
      )}
      {near.length > 0 && (
        <p className="mt-2 text-[12.5px] text-neutral-700">
          <span className="text-muted">Close behind: </span>
          {near.slice(0, 8).map((i) => (withFabric ? `${i.name} (${i.fabric})` : i.name)).join(", ")}
          {near.length > 8 && ` and ${near.length - 8} more`}.
        </p>
      )}
    </section>
  );
}

/** Each placement whose priority moved since the edition before, and why. */
const FIRST_MOVES = 8; // the biggest moves shown first; the rest one click away

export function MovedSince({ moved, previous, from, withFabric }: {
  moved: Item[]; previous: Published["edition"]["previous"]; from: string; withFabric: boolean;
}) {
  const [all, setAll] = useState(false);
  const ranked = biggestMoves(moved);
  return (
    <section className={card} aria-label="Moved since the last edition">
      <h2 className="font-semibold">
        {previous ? `Moved since ${previous.label}` : "Moved since the last edition"}
        {previous && <span className="font-normal text-muted"> · {moved.length}</span>}
      </h2>
      {previous && (
        <p className="mt-0.5 text-[12.5px] text-muted">
          Priorities that changed since the edition published {formatAt(previous.published_at, previous.tz)}, those into
          P1 or P2 and the biggest jumps first, each with the score that moved; on the grid, an arrow beside the dot.
        </p>
      )}
      {!previous ? (
        <p className="mt-2 text-sm text-muted">This is the first edition: there&apos;s nothing earlier to compare with.</p>
      ) : moved.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing shown here moved.</p>
      ) : (
        <>
          <ul className="mt-2 space-y-1.5 text-sm">
            {(all ? ranked : ranked.slice(0, FIRST_MOVES)).map((i) => (
              <li key={`${i.tech_id}:${i.fabric_id}`}>
                <Name item={i} from={from} withFabric={withFabric} />{" "}
                <span className="whitespace-nowrap font-mono text-[12px]">{moveText(i, undefined)}</span>
                <span className="block text-[12.5px] text-muted">{i.moved && moveReason(i.moved)}</span>
              </li>
            ))}
          </ul>
          {ranked.length > FIRST_MOVES && (
            <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="mt-2 text-sm text-link hover:underline">
              {all ? `Show the ${FIRST_MOVES} biggest only` : `Show all ${ranked.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** How far Tata's commitment has got, counted over the placements shown. */
export function Committed({ items }: { items: Item[] }) {
  return (
    <section className={card} aria-label="What Tata has committed">
      <h2 className="font-semibold">What Tata has committed</h2>
      <p className="mt-0.5 text-[12.5px] text-muted">
        Per dot shown, from what Tata&apos;s team records on each technology&apos;s fabric. A record never changes a score.
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {LEADER_STATES.map((s) => (
          <li key={s.id} className="flex items-baseline gap-2">
            <span className="w-10 shrink-0 text-right font-semibold tabular-nums">
              {items.filter((i) => i.leader.state === s.id).length.toLocaleString()}
            </span>
            <span className={`rounded px-1.5 py-px text-[11px] ${s.chip}`}>{s.name}</span>
            <span className="text-[12.5px] text-muted">{s.means}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Assumptions({ items }: { items: Published["assumptions"] }) {
  return (
    <section className={card} aria-label="Assumptions in force">
      <h2 className="font-semibold">Assumptions in force</h2>
      <p className="mt-0.5 text-[12.5px] text-muted">
        There&apos;s no economic model behind the grid: these are the stated assumptions it rests on, as they stood when
        this edition was published: scenarios, not forecasts.
      </p>
      {items.length === 0 ? <p className="mt-2 text-sm text-muted">None stated in this edition.</p> : (
        <ul className="mt-2 space-y-1.5 text-sm">
          {items.map((a) => (
            <li key={a.statement}>
              {a.date && <span className="mr-1.5 whitespace-nowrap font-mono text-[12px] text-muted">{formatDate(a.date, true)}</span>}
              {a.statement}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EvidenceThisEdition({ ev, assessed }: { ev: Published["evidence"]; assessed: number }) {
  const types = [...ev.by_signal_type].sort((a, b) => b.count - a.count);
  const figures = [["Sources watched", ev.sources_on], ["Pages read", ev.pages_read], ["Findings", ev.signals_found],
    ["Technologies found", ev.technologies]] as const;
  return (
    <section className={card} aria-label="Evidence this edition">
      <h2 className="font-semibold">Evidence this edition</h2>
      <p className="mt-0.5 text-[12.5px] text-muted">
        How much reading stands behind the screen: every collection up to this edition. {plural(assessed, "technology was", "technologies were")} assessed
        for it.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {figures.map(([label, n]) => (
          <div key={label}>
            <dd className="text-xl font-semibold tabular-nums">{n.toLocaleString()}</dd>
            <dt className="text-[12px] text-muted">{label}</dt>
          </div>
        ))}
      </dl>
      {types.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-[13px] text-link">Findings, by type · {types.length}</summary>
          <ul className="mt-2 gap-6 sm:columns-2">
            {types.map((t) => (
              <li key={t.signal_id} className="flex break-inside-avoid justify-between gap-3 py-0.5 text-[13px]">
                <span>{t.name}</span><span className="tabular-nums text-muted">{t.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
