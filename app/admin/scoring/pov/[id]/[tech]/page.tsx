"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import BackLink from "@/components/BackLink";
import ConfirmAction from "@/components/ConfirmAction";
import LeadersSee from "@/components/LeadersSee";
import PageHeader from "@/components/PageHeader";
import { fetchPov, type Pov, PovBody, PovHelp } from "@/components/PovText";
import { fetchJson, sendJson } from "@/lib/api";
import { formatAt, formatDay, plural } from "@/lib/format";
import { safeFrom } from "@/lib/here";
import { useHood } from "@/lib/hood";
import { useTechLabel } from "@/lib/tech-labels";

/** From the technology's summary: pages that arrived after this Point of
 *  View was written, and whether a newer assessment exists. */
type Fresh = { since_pov: number | null; from_latest: boolean; this_run: boolean };

function PointOfView() {
  const { id, tech } = useParams<{ id: string; tech: string }>();
  const label = useTechLabel();
  const [pov, setPov] = useState<Pov | null>(null);
  const [missing, setMissing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const hood = useHood();
  const from = safeFrom(useSearchParams().get("from"));

  const load = useCallback(() => {
    fetchPov(id, tech).then((p) => { setPov(p); setMissing(!p); setError(null); }).catch(setError);
  }, [id, tech]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    fetchJson<{ new_pages: { since_pov: number | null }; pov: { scoring_run_id: string; from_latest_assessment: boolean } | null }>(
      `/api/technologies/${tech}/summary`)
      .then((d) => setFresh({ since_pov: d.new_pages.since_pov, from_latest: !!d.pov?.from_latest_assessment,
        this_run: d.pov?.scoring_run_id === id }))
      .catch(() => setFresh(null));
  }, [id, tech, pov?.composed_at]);

  async function compose() {
    setComposing(true);
    try {
      await sendJson(`/api/scoring/runs/${id}/pov/${tech}`, "POST", {});
      load();
    } finally {
      setComposing(false);
    }
  }

  const fabrics = pov?.fabrics ?? [];
  const docCount = fabrics[0]?.doc_count ?? 0;
  // the assessment it explains: its earliest fabric, as the backend dates it
  const assessedAt = fabrics.map((f) => f.created_at).filter(Boolean).sort()[0];
  const basis = pov && [`Written ${formatAt(pov.composed_at, pov.composed_tz)}`,
    assessedAt && `assessed ${formatDay(assessedAt)}${docCount ? ` from ${plural(docCount, "page")}` : ""}`,
  ].filter(Boolean).join(" · ");
  const title = label(pov?.technology ?? tech.replace(/-/g, " "));

  return (
    <div>
      <BackLink fallback={`/admin/technologies/${tech}`} fallbackLabel={title} />
      <PageHeader eyebrow="Point of View" title={title}
        intro="The radar's conclusion on this technology: what Tata Communications should do, why, and what's still missing."
        help={<PovHelp admin />}>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600 print:hidden">
          {/* the way back is the back link; the technology is offered when that isn't where it goes */}
          {from?.split("?")[0] !== `/admin/technologies/${tech}` && (
            <Link href={`/admin/technologies/${tech}`} className="text-link hover:underline">Open the technology →</Link>
          )}
          {hood && <Link href={`/admin/scoring/assessments/${id}`} className="text-link hover:underline">Assessment run →</Link>}
          {basis && <span className="text-xs text-neutral-500">{basis}</span>}
          <ConfirmAction label={pov ? "Rewrite" : "Write Point of View"} cost="about 1 model call" secondary
            question={`${pov ? "Rewrite" : "Write"} the Point of View from the same assessment? About 1 model call; the scores don't change.${pov ? " The current version is replaced." : ""}`}
            confirmLabel={pov ? "Rewrite" : "Write"} onConfirm={compose} />
          {pov && (
            <button type="button" onClick={() => window.print()}
              className="rounded-full border border-line bg-white px-2.5 py-1 text-xs hover:bg-neutral-100">
              Print / Save as PDF
            </button>
          )}
        </p>
        {fresh && (!fresh.this_run || !fresh.from_latest
          ? <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[13px] text-amber-900 print:hidden">
              A newer assessment exists: this Point of View explains an earlier one.{" "}
              <Link href={`/admin/technologies/${tech}`} className="text-link hover:underline">Write it from the latest, on the technology&apos;s page →</Link>
            </p>
          : (fresh.since_pov ?? 0) > 0 && (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[13px] text-amber-900 print:hidden">
              {plural(fresh.since_pov!, "page")} arrived after this was written. A Point of View explains its assessment, so
              assess the technology again to take {fresh.since_pov === 1 ? "it" : "them"} in, then write it again.{" "}
              <Link href={`/admin/technologies/${tech}`} className="text-link hover:underline">Its next step →</Link>
            </p>
          ))}
        {pov && <LeadersSee tech={tech} composedAt={pov.composed_at} />}
        {basis && (
          <p className="mt-1 hidden font-mono text-[11px] text-neutral-500 print:block">Tech Lens · Point of View · {basis}</p>
        )}
      </PageHeader>

      {error != null && <BackendError error={error} />}
      {missing && !composing && (
        <p className="mt-6 text-sm text-neutral-600">
          No Point of View written yet for this technology. Writing it from the stored assessment
          takes about 1 model call; the scores never change.
        </p>
      )}

      {pov && <PovBody pov={pov} admin />}
    </div>
  );
}

export default function PovPage() {
  return (
    <Suspense fallback={null}>
      <PointOfView />
    </Suspense>
  );
}
