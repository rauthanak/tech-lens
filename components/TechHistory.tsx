"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ActButton from "@/components/ActButton";
import EvidenceLine from "@/components/EvidenceLine";
import { errorText, fetchJson } from "@/lib/api";
import { undo } from "@/lib/decisions";
import { formatAt, formatDay, plural } from "@/lib/format";

type Choice = { _id: string; what: string; from_file: string | null; reason: string | null; at: string; tz: string | null;
  active: boolean; undone_at?: string; undone_tz?: string | null };

/** A technology's History tab: where its results came from (its latest
 *  assessment, the pages and collections it read, its Point of View), then
 *  every choice people made about it, newest first, each with who, when and
 *  why, and Undo while it's in force; replaced and undone ones on request. */
export default function TechHistory({ techId, assessment, pages, newPages, pov, classifiedAt, onChanged }: {
  techId: string;
  assessment: { scoring_run_id: string; assessed_at: string; pages_read: number; evidence_runs: string[] | null;
    not_assessed_in?: string[] } | null;
  pages: number;
  newPages: number;
  pov: { composed_at: string; composed_tz: string | null; version: number; from_latest_assessment: boolean } | null;
  classifiedAt?: string | null;
  onChanged: () => void;
}) {
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undone, setUndone] = useState(false);
  const load = useCallback(() =>
    fetchJson<{ decisions: Choice[] }>(`/api/decisions?tech_id=${encodeURIComponent(techId)}&include_inactive=true`)
      .then((d) => { setChoices(d.decisions); setError(null); })
      .catch((e) => setError(errorText(e))), [techId]);
  useEffect(() => { load(); }, [load]);
  const changed = () => { load(); onChanged(); };

  const shown = (choices ?? []).filter((c) => undone || c.active);
  const hidden = (choices ?? []).length - (choices ?? []).filter((c) => c.active).length;
  return (
    <div className="mt-4 space-y-6">
      <section>
        <h3 className="font-semibold">Where its results came from</h3>
        <ul className="mt-2 space-y-1.5 rounded-card border border-line bg-white px-5 py-4 text-sm">
          {assessment ? (
            <li className="flex flex-wrap items-baseline gap-x-3">
              <span>
                Latest assessment {formatDay(assessment.assessed_at)}: read {assessment.pages_read.toLocaleString()} of
                its {plural(pages, "page")}{newPages > 0 && ` (${plural(newPages, "page")} arrived after)`}.
              </span>
              <EvidenceLine assessments={[{ evidence_runs: assessment.evidence_runs ?? undefined }]} />
              <Link href={`/admin/scoring/assessments/${assessment.scoring_run_id}`} className="text-link hover:underline">
                Its assessment run →
              </Link>
            </li>
          ) : <li className="text-muted">Not assessed yet.</li>}
          {pov && (
            <li>
              Point of View version {pov.version}, written {formatAt(pov.composed_at, pov.composed_tz)}
              {pov.from_latest_assessment ? ", from the latest assessment." : ", from an earlier assessment."}
            </li>
          )}
          {classifiedAt && <li>Classified {formatDay(classifiedAt)} from its pages.</li>}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold">What people decided</h3>
        <p className="mt-1 text-[13px] text-muted">
          People&apos;s choices are kept apart from what the model writes: no later run overwrites them. Undo puts back
          what the radar judged.
        </p>
        {error && <p className="mt-2 text-sm text-failed">The choices didn&apos;t load: {error}</p>}
        {choices && (
          <ul className="mt-2 divide-y divide-neutral-100 rounded-card border border-line bg-white text-sm">
            {shown.map((c) => (
              <li key={c._id} className={`px-5 py-2.5 ${c.active ? "" : "text-muted"}`}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className={c.active ? "font-medium text-ink" : "line-through"}>{c.what}</span>
                  {c.active && <ActButton label="Undo" run={() => undo(c._id)} onDone={changed} />}
                </div>
                <p className="text-[12.5px] text-muted">
                  {c.from_file ? `From the catalog file ${c.from_file}, ` : "By a person, "}{formatAt(c.at, c.tz)}
                  {c.reason && !c.from_file && <>: <span className="text-ink">{c.reason}</span></>}
                  {!c.active && (c.undone_at ? ` · undone ${formatAt(c.undone_at, c.undone_tz)}` : " · replaced by a later choice")}
                </p>
              </li>
            ))}
            {shown.length === 0 && <li className="px-5 py-3 text-muted">Nobody has changed anything about it yet.</li>}
          </ul>
        )}
        {hidden > 0 && (
          <button type="button" onClick={() => setUndone(!undone)} className="mt-2 text-sm text-link hover:underline">
            {undone ? "Hide earlier and undone choices" : `Show earlier and undone choices too (${hidden})`}
          </button>
        )}
      </section>
    </div>
  );
}
