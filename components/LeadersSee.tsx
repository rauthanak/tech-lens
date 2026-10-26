"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Edition } from "@/components/frontier/items";
import { openTodo } from "@/components/GateList";
import { editionName } from "@/components/PublishEdition";
import { fetchJson } from "@/lib/api";
import { formatAt, plural } from "@/lib/format";

/** The Briefing's To do, its Publish column open. */
export function PublishLink({ children }: { children: React.ReactNode }) {
  return <Link href="/admin" onClick={() => openTodo("publish")} className="text-link hover:underline">{children}</Link>;
}

type Leader = { name: string; opened: number; printed: number; last_opened: string | null };
type Seen = { edition: Edition | null; composed_at: string | null; composed_tz: string | null;
  views?: { opened: number; printed: number; last_opened: string | null; leaders: Leader[] } | null };

/** On a Point of View's page: which version leaders see, the one on screen or
 *  an earlier one in the latest edition, and where to publish this one. */
export default function LeadersSee({ tech, composedAt }: { tech: string; composedAt: string }) {
  const [seen, setSeen] = useState<Seen | null>(null);
  useEffect(() => {
    fetchJson<Seen>(`/api/editions/pov/${encodeURIComponent(tech)}`)
      .then(setSeen).catch(() => setSeen(null));
  }, [tech, composedAt]);
  if (!seen) return null;
  const e = seen.edition;
  const current = seen.composed_at === composedAt;
  return (
    <div className={`mt-2 rounded px-3 py-1.5 text-[13px] print:hidden ${current ? "bg-ground text-neutral-700"
      : "border border-amber-200 bg-amber-50 text-amber-900"}`}>
      {!e ? <>Nothing is published yet: leaders see no Point of View until the first edition.{" "}
        <PublishLink>Publish on the Briefing →</PublishLink></>
        : current ? <>Leaders see this version, in {editionName(e)}.</>
        : <>Leaders see {seen.composed_at ? `the version written ${formatAt(seen.composed_at, seen.composed_tz)}` : "no Point of View of it"},
          in {editionName(e)}: this one was written after it.{" "}
          <PublishLink>Publish on the Briefing to send it →</PublishLink></>}
      {e && (
        <span className="block text-neutral-600">
          {seen.views?.opened
            ? `Opened ${plural(seen.views.opened, "time")} by ${plural(seen.views.leaders.length, "leader")},`
              + ` last ${formatAt(seen.views.last_opened!, null)}`
              + (seen.views.printed ? `; printed or saved as PDF ${plural(seen.views.printed, "time")}` : "") + "."
            : "Leaders haven't opened it yet."}{" "}
          Admins&apos; visits aren&apos;t counted.
        </span>
      )}
      {e && !!seen.views?.leaders.length && <WhoOpened leaders={seen.views.leaders} />}
    </div>
  );
}

/** Each leader who opened it, the latest first (as the API sorts them): closed
 *  until asked for, so the line above stays one line however many leaders read it. */
function WhoOpened({ leaders }: { leaders: Leader[] }) {
  return (
    <details className="group mt-1">
      <summary className="group/summary -mx-1 inline-flex cursor-pointer list-none items-center gap-1.5 rounded px-1 text-link focus:outline-none focus-visible:ring-2 focus-visible:ring-azure/40 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block text-[9px] transition-transform group-open:rotate-90">▶</span>
        <span className="group-hover/summary:underline">Who opened it ({leaders.length})</span>
      </summary>
      <div className="mt-1.5 overflow-x-auto">
        <table className="w-full max-w-2xl text-left text-neutral-700">
          <thead className="text-[11px] uppercase tracking-wide text-neutral-500">
            <tr><th className="py-1 pr-4 font-medium">Leader</th><th className="py-1 pr-4 text-right font-medium">Opened</th>
              <th className="py-1 pr-4 text-right font-medium">Printed</th><th className="py-1 font-medium">Last opened</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leaders.map((l, i) => (
              <tr key={i}>
                <td className="py-1 pr-4">{l.name}</td>
                <td className="py-1 pr-4 text-right tabular-nums">{l.opened}</td>
                <td className="py-1 pr-4 text-right tabular-nums">{l.printed || "–"}</td>
                <td className="whitespace-nowrap py-1">{l.last_opened ? formatAt(l.last_opened, null) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
