"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { useHood } from "@/lib/hood";

// When each run started and what it was, by id (GET /api/runs/named): a
// collection, or the reading of a Find evidence job. Kept for the page load and
// shared by every evidence line on it; only ids not asked yet are fetched.
type Named = { at: string | null; tz: string | null; kind: "collection" | "find_evidence" };
const known: Record<string, Named> = {};
const named = async (ids: string[]) => {
  const missing = ids.filter((i) => !(i in known));
  if (missing.length) {
    const d = await fetchJson<{ runs: Record<string, Named> }>(`/api/runs/named?ids=${missing.join(",")}`).catch(() => ({ runs: {} }));
    Object.assign(known, d.runs);
  }
  return { ...known };
};

/** Recorded fact: the collections (and Find evidence readings) whose pages
 * were in the evidence the scorer read (each assessment's evidence_runs),
 * named by the day each started; ids only under Technical details. Older assessments didn't
 * record them, and then there's nothing to say. */
export default function EvidenceLine({ assessments }: { assessments: { evidence_runs?: string[] }[] }) {
  const hood = useHood();
  const [runsById, setRunsById] = useState<Record<string, Named>>({});
  const recorded = assessments.some((a) => a.evidence_runs !== undefined);
  const runs = [...new Set(assessments.flatMap((a) => a.evidence_runs ?? []))]
    .sort((x, y) => (runsById[x]?.at ?? x).localeCompare(runsById[y]?.at ?? y));
  const ids = runs.join(",");

  useEffect(() => {
    if (ids) named(ids.split(",")).then(setRunsById);
  }, [ids]);

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
            {!runsById[r] ? "a collection"
              : runsById[r].kind === "find_evidence" ? `pages found or added for it on ${formatDay(runsById[r].at, runsById[r].tz)}`
              : `the ${formatDay(runsById[r].at, runsById[r].tz)} collection`}
            {hood && <span className="ml-1.5 font-mono text-xs text-neutral-500">{r}</span>}
          </Link>
        ))
      )}
    </p>
  );
}
