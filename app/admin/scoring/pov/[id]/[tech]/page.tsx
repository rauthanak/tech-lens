"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import BackLink from "@/components/BackLink";
import ConfirmAction from "@/components/ConfirmAction";
import PageHeader from "@/components/PageHeader";
import { fetchPov, type Pov, PovBody, PovHelp } from "@/components/PovText";
import { sendJson } from "@/lib/api";
import { formatAt, formatDay, plural } from "@/lib/format";
import { useTechLabel } from "@/lib/tech-labels";

function PointOfView() {
  const { id, tech } = useParams<{ id: string; tech: string }>();
  const label = useTechLabel();
  const [pov, setPov] = useState<Pov | null>(null);
  const [missing, setMissing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    fetchPov(id, tech).then((p) => { setPov(p); setMissing(!p); setError(null); }).catch(setError);
  }, [id, tech]);

  useEffect(() => {
    load();
  }, [load]);

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
          <Link href={`/admin/technologies/${tech}`} className="text-link hover:underline">Technology →</Link>
          <Link href="/admin/scoring/pov" className="text-link hover:underline">All Points of View →</Link>
          <Link href={`/admin/scoring/assessments/${id}`} className="text-link hover:underline">Assessment run →</Link>
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
