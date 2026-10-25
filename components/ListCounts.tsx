"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONFIG_CHANGED, errorText, fetchJson } from "@/lib/api";
import type { ListItem } from "@/lib/classification";

// each value's Technologies list, filtered to it
const HREF = {
  availability: (i: ListItem) => `/admin/technologies?availability=${encodeURIComponent(i._id)}`,
  domains: (i: ListItem) => `/admin/technologies?domain=${encodeURIComponent(i._id)}`,
  trl_levels: (i: ListItem) => `/admin/technologies?trl_min=${i.level}&trl_max=${i.level}`,
};

/** How many technologies each value of a classification list holds, counted
 *  as the Technologies list counts them (a person's or an import's choice,
 *  else the assessment, else Classify's reading of the pages); each count
 *  opens that list filtered to it. Recounts after a list edit. */
export default function ListCounts({ list }: { list: keyof typeof HREF }) {
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [unset, setUnset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = () => fetchJson<{ items: ListItem[]; unset?: number }>(`/api/lists/${list}`)
      .then((d) => { setItems(d.items); setUnset(d.unset ?? 0); setError(null); }).catch((e) => setError(errorText(e)));
    load();
    window.addEventListener(CONFIG_CHANGED, load);
    return () => window.removeEventListener(CONFIG_CHANGED, load);
  }, [list]);
  if (error) return <p className="mt-4 text-sm text-failed">The counts didn&apos;t load: {error}</p>;
  if (!items) return null;
  // each count on its own row, the number apart from the name: "TRL 3 1,212" read as "TRL 31,212"
  return (
    <div className="mt-4 text-sm">
      <p className="text-muted">Technologies in each, as the Technologies list counts them (click to open):</p>
      <ul className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-x-6 gap-y-1">
        {items.map((i) => (
          <li key={i._id}>
            <Link href={HREF[list](i)} className="flex justify-between gap-3 text-link hover:underline">
              <span className="truncate">{i.level != null ? `TRL ${i.level}` : i.name}</span>
              <span className="tabular-nums">{(i.technologies ?? 0).toLocaleString()}</span>
            </Link>
          </li>
        ))}
        {unset > 0 && (
          <li className="flex justify-between gap-3 text-muted" title="Not judged yet: Classify gives each its value">
            <span>{list === "trl_levels" ? "No level yet" : "None yet"}</span>
            <span className="tabular-nums">{unset.toLocaleString()}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
