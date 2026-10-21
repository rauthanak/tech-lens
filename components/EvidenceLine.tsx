"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { useHood } from "@/lib/hood";

// When each collection started, to name it by its day: fetched once per page
// load and shared by every evidence line on the page.
let started: Promise<Record<string, string>> | null = null;
const collectionDays = () =>
  (started ??= fetchJson<{ runs: { id: string; run_start_date_time: string }[] }>("/api/runs")
    .then((d) => Object.fromEntries(d.runs.map((r) => [r.id, r.run_start_date_time])))
    .catch(() => { started = null; return {}; }));

/** Recorded fact: the collection runs whose pages were in the evidence the
 * scorer read (each assessment's evidence_runs), named by the day each
 * started; ids only under Technical details. Older assessments didn't
 * record them, and then there's nothing to say. */
export default function EvidenceLine({ assessments }: { assessments: { evidence_runs?: string[] }[] }) {
  const hood = useHood();
  const [days, setDays] = useState<Record<string, string>>({});
  const recorded = assessments.some((a) => a.evidence_runs !== undefined);
  const runs = [...new Set(assessments.flatMap((a) => a.evidence_runs ?? []))]
    .sort((x, y) => (days[x] ?? x).localeCompare(days[y] ?? y));

  useEffect(() => {
    if (recorded) collectionDays().then(setDays);
  }, [recorded]);

  if (!recorded) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 text-sm text-neutral-600">
      <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
        Evidence from
      </span>
      {runs.length === 0 ? (
        <span className="text-neutral-500">no collection recorded</span>
      ) : (
        runs.map((r) => (
          <Link key={r} href={`/admin/runs/${r}`} className="text-link underline underline-offset-4">
            {days[r] ? `the ${formatDay(days[r])} collection` : "a collection"}
            {hood && <span className="ml-1.5 font-mono text-xs text-neutral-500">{r}</span>}
          </Link>
        ))
      )}
    </p>
  );
}
