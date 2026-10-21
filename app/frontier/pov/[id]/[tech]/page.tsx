"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { type EditionPov, fetchEditionPov } from "@/components/frontier/items";
import PovLeader from "@/components/frontier/PovLeader";
import { type Pov, PovBody, PovHelp } from "@/components/PovText";
import { formatAt } from "@/lib/format";
import { useTechLabel } from "@/lib/tech-labels";

/** Only the executive view's own addresses are followed back. */
const backTo = (from: string | null) => (from && /^\/(frontier)?(\?|$)/.test(from) ? from : "/frontier");

/** A Point of View for the leaders: what the admins see, read-only, as the
 *  latest published edition holds it (never the live text). */
function PointOfView() {
  const { tech } = useParams<{ id: string; tech: string }>();
  const back = backTo(useSearchParams().get("from"));
  const label = useTechLabel();
  const [pov, setPov] = useState<EditionPov | null>(null);
  const [missing, setMissing] = useState<string | null>(null); // why the edition has none
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    fetchEditionPov(tech).then((r) => { setPov(r.pov); setMissing(r.missing); setError(null); }).catch(setError);
  }, [tech]);

  const title = label(pov?.technology ?? tech.replace(/-/g, " "));

  return (
    <div>
      <Link href={back} className="text-sm text-link hover:underline print:hidden">← Leaders&apos; view</Link>
      <PageHeader eyebrow="Point of View" title={title}
        intro="The radar's conclusion on this technology: what Tata Communications should do, why, and what's still missing."
        help={<PovHelp />}>
        {pov && (
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
            Written {formatAt(pov.composed_at, pov.composed_tz)} · in the edition{pov.edition.name ? ` ${pov.edition.name}` : ""}{" "}
            published {formatAt(pov.edition.published_at, pov.edition.tz)}
            <button type="button" onClick={() => window.print()}
              className="rounded-full border border-line bg-white px-2.5 py-1 text-xs hover:bg-neutral-100 print:hidden">
              Print / Save as PDF
            </button>
          </p>
        )}
      </PageHeader>

      {error != null && <BackendError error={error} />}
      {missing && (
        <p className="mt-6 rounded-card border border-line bg-white px-5 py-6 text-sm text-neutral-600">
          {missing}
        </p>
      )}
      {!pov && !missing && error == null && <p className="mt-6 text-sm text-muted">Loading…</p>}

      {pov && <PovLeader fabrics={pov.fabrics ?? []} />}
      {pov && <PovBody pov={pov as Pov} />}
    </div>
  );
}

export default function FrontierPovPage() {
  return (
    <Suspense fallback={null}>
      <PointOfView />
    </Suspense>
  );
}
