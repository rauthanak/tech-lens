"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sign, SIGNS_EXPLAINED, type WatchMetric } from "@/components/WatchMetrics";
import { fetchJson } from "@/lib/api";
import { formatDay, plural } from "@/lib/format";
import { useTechLabel } from "@/lib/tech-labels";

type Crossing = WatchMetric & { tech_id: string; technology: string; assessed_at: string };

const FIRST = 3; // the newest shown; the rest one click away, on this page

/** On the Briefing: signs to watch that crossed their threshold, as each
 *  technology's latest assessment found them (people's "not crossed"
 *  applied), one closed line each that opens to the sign. Shown only when
 *  there are some: each is a reason to read its Point of View again. */
export default function CrossedSigns() {
  const [rows, setRows] = useState<Crossing[] | null>(null);
  const [all, setAll] = useState(false);
  const label = useTechLabel();
  useEffect(() => {
    fetchJson<{ crossed: Crossing[] }>("/api/scoring/crossed").then((d) => setRows(d.crossed)).catch(() => setRows(null));
  }, []);
  if (!rows?.length) return null;
  const shown = all ? rows : rows.slice(0, FIRST);
  return (
    <section aria-label="Signs that crossed" className="mt-8">
      <h2 className="text-lg font-semibold">Signs that crossed their threshold <span className="font-normal text-muted">· {rows.length}</span></h2>
      <p className="text-[13px] text-muted">{SIGNS_EXPLAINED} Each below crossed at its latest assessment, from a page it
        read: read the technology&apos;s Point of View again, the verdict may need to change.</p>
      <ul className="mt-2 divide-y divide-neutral-100 rounded-card border border-line bg-white text-sm">
        {shown.map((r) => (
          <li key={`${r.tech_id}:${r.key ?? r.metric}`}>
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 px-5 py-2.5 [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="inline-block text-[9px] text-muted transition-transform group-open:rotate-90">▶</span>
                <span className="font-medium">{label(r.technology)}</span>
                <span className="min-w-0 flex-1 text-neutral-700">{r.metric}</span>
                <span className="text-xs text-muted">assessed {formatDay(r.assessed_at)}</span>
              </summary>
              <div className="pb-2">
                <Sign m={r} />
                <p className="px-5 text-[13px]">
                  <Link href={`/admin/technologies/${r.tech_id}`} className="text-link hover:underline">Open {label(r.technology)} →</Link>
                </p>
              </div>
            </details>
          </li>
        ))}
      </ul>
      {rows.length > FIRST && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 text-[13px] text-link hover:underline">
          {all ? `Only the newest ${FIRST}` : `All ${plural(rows.length, "sign")}`}
        </button>
      )}
    </section>
  );
}
