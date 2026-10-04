import Link from "next/link";

/** Recorded fact: the collection runs whose pages were in the evidence the
 * scorer read (each assessment's evidence_runs). Older assessments didn't
 * record them, and then there's nothing to say. */
export default function EvidenceLine({ assessments }: { assessments: { evidence_runs?: string[] }[] }) {
  const recorded = assessments.some((a) => a.evidence_runs !== undefined);
  const runs = [...new Set(assessments.flatMap((a) => a.evidence_runs ?? []))].sort();
  if (!recorded) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-neutral-600">
      <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
        Evidence from collections:
      </span>
      {runs.length === 0 ? (
        <span className="text-neutral-500">none</span>
      ) : (
        runs.map((r) => (
          <Link key={r} href={`/admin/runs/${r}`} className="font-mono text-xs text-link underline underline-offset-4">
            {r}
          </Link>
        ))
      )}
    </p>
  );
}
