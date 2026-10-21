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
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = () => fetchJson<{ items: ListItem[] }>(`/api/lists/${list}`)
      .then((d) => { setItems(d.items); setError(null); }).catch((e) => setError(errorText(e)));
    load();
    window.addEventListener(CONFIG_CHANGED, load);
    return () => window.removeEventListener(CONFIG_CHANGED, load);
  }, [list]);
  if (error) return <p className="mt-4 text-sm text-failed">The counts didn&apos;t load: {error}</p>;
  if (!items) return null;
  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <span className="text-muted">Technologies in each, as the Technologies list counts them (click to open):</span>
      {items.map((i) => (
        <Link key={i._id} href={HREF[list](i)} className="whitespace-nowrap text-link hover:underline">
          {i.level != null ? `TRL ${i.level}` : i.name} <span className="tabular-nums">{(i.technologies ?? 0).toLocaleString()}</span>
        </Link>
      ))}
    </p>
  );
}
