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
import { calls, startAssessment } from "@/lib/actions";
import { useHood } from "@/lib/hood";
import { blockedReason, usePipeline } from "@/lib/pipeline";
import { useTechLabel } from "@/lib/tech-labels";

/** From the technology's summary: pages that arrived after this Point of
 *  View was written, and whether a newer assessment exists. */
type Fresh = { since_pov: number | null; from_latest: boolean; this_run: boolean; assess_calls: number; assess_calls_max: number };

function PointOfView() {
  const { id, tech } = useParams<{ id: string; tech: string }>();
  const label = useTechLabel();
  const [pov, setPov] = useState<Pov | null>(null);
  const [missing, setMissing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const hood = useHood();
  const p = usePipeline();
  const from = safeFrom(useSearchParams().get("from"));

  const load = useCallback(() => {
    return fetchPov(id, tech).then((p) => { setPov(p); setMissing(!p); setError(null); }).catch(setError);
  }, [id, tech]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    fetchJson<{ new_pages: { since_pov: number | null }; pov: { scoring_run_id: string; from_latest_assessment: boolean } | null;
      estimate: { assess_calls: number; assess_calls_max: number } }>(`/api/technologies/${tech}/summary`)
      .then((d) => setFresh({ since_pov: d.new_pages.since_pov, from_latest: !!d.pov?.from_latest_assessment,
        this_run: d.pov?.scoring_run_id === id, ...d.estimate }))
      .catch(() => setFresh(null));
  }, [id, tech, pov?.composed_at]);

  async function compose() {
    setComposing(true);
    try {
      await sendJson(`/api/scoring/runs/${id}/pov/${tech}`, "POST", {});
      await load();
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
  const newer = fresh?.this_run && fresh.from_latest ? fresh.since_pov ?? 0 : 0;

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
            question={`${pov ? "Rewrite" : "Write"} the Point of View from the same assessment? About 1 model call; the scores don't change.${pov ? " The current version is replaced." : ""}${
              newer ? ` The ${plural(newer, "newer page")} won't be included: Assess again takes them in.` : ""}`}
            confirmLabel={pov ? "Rewrite" : "Write"} busyLabel="Writing… about a minute"
            doneLabel={pov ? "Rewritten: the page shows the new version" : "Written"} onConfirm={compose} />
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
          : newer > 0 && (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[13px] text-amber-900 print:hidden">
              {plural(newer, "page")} arrived after this was written. A Point of View explains its assessment, so Rewrite
              won&apos;t take {newer === 1 ? "it" : "them"} in: assess the technology again, then write it again.
              <span className="mt-1.5 block">
                <ConfirmAction label="Assess again" cost={calls(fresh.assess_calls)} secondary disabled={blockedReason(p, "assess")}
                  question={`Assess ${title} again with its ${plural(newer, "newer page")}? About ${plural(fresh.assess_calls, "model call")} (up to ${fresh.assess_calls_max}). When it's done, the technology's page offers Write Point of View, about 1 more.`}
                  onConfirm={() => startAssessment([tech])} />
              </span>
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
