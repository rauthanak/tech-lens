"use client";

import { useEffect, useMemo, useState } from "react";
import BackendError from "@/components/BackendError";
import Grid from "@/components/frontier/Grid";
import { type EditionPov, fetchEditionPov, type Frontier, frontierOf, pastEmerging, type Published } from "@/components/frontier/items";
import PovLeader from "@/components/frontier/PovLeader";
import { ActNow, Assumptions, Committed, MovedSince } from "@/components/frontier/Sections";
import { type Pov, PovBody } from "@/components/PovText";
import { fetchJson } from "@/lib/api";
import { formatAt, plural } from "@/lib/format";
import { useMe } from "@/lib/me";
import { useTechLabel } from "@/lib/tech-labels";

/** The edition pack: the latest edition's summary (the grid, Act now, what moved, what Tata committed, the
 *  assumptions) and the Point of View of each Act now technology, one per page, for Print / Save as PDF.
 *  Published data only, as the leaders' view. A leader saving or printing it counts as printing each Point
 *  of View in it (the API counts leaders only). */
export default function EditionPackPage() {
  const label = useTechLabel();
  const me = useMe();
  const [data, setData] = useState<Published | null>(null);
  const [unpublished, setUnpublished] = useState(false);
  const [povs, setPovs] = useState<EditionPov[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    fetchJson<Frontier>("/api/frontier")
      .then((d) => { if (d.edition) setData(d as Published); else setUnpublished(true); })
      .catch(setError);
  }, []);

  // as the leaders' view opens: every fabric, emerging technologies, the growth lens
  const placed = useMemo(() => (data?.placed ?? []).filter((i) => !pastEmerging(i)), [data]);
  const band = data?.near_band ?? 0.5;
  const frontier = useMemo(() => frontierOf(placed, "growth", band), [placed, band]);
  const actNow = useMemo(() => placed.filter((i) => i.priority === "P1"), [placed]);
  // each Act now technology once, sooner first (as the Act now list)
  const techs = useMemo(() => [...new Set([...actNow].sort((a, b) => (b.how_soon ?? 0) - (a.how_soon ?? 0))
    .map((i) => i.tech_id))], [actNow]);

  useEffect(() => {
    if (!data) return;
    Promise.all(techs.map((t) => fetchEditionPov(t)))
      .then((rs) => setPovs(rs.map((r) => r.pov).filter((p): p is EditionPov => !!p)))
      .catch(setError);
  }, [data, techs]);

  // saving or printing the pack counts as printing each Point of View in it
  useEffect(() => {
    const printed = () => techs.forEach((t) =>
      fetch(`/api/frontier/pov/${encodeURIComponent(t)}/seen`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "printed" }) }).catch(() => {}));
    window.addEventListener("beforeprint", printed);
    return () => window.removeEventListener("beforeprint", printed);
  }, [techs]);

  if (error != null) return <BackendError error={error} />;
  if (unpublished) return <p className="text-sm text-neutral-700">Nothing is published yet: the pack is made from an edition.</p>;
  if (!data) return <p className="text-sm text-muted">Loading…</p>;
  const e = data.edition;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-azure/30 bg-azure/5 px-4 py-3 text-sm print:hidden">
        <span className="flex-1">
          The edition pack: this edition&apos;s summary, then the Point of View of each Act now technology, one per page.
          {me?.role === "admin" && " You're viewing as an admin: your printing isn't counted."}
        </span>
        <button type="button" onClick={() => window.print()} disabled={!povs}
          className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong disabled:opacity-50">
          {povs ? "Print / Save as PDF" : "Loading the Points of View…"}
        </button>
      </div>

      <header className="mt-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-500">Edition pack</div>
        <h1 className="mt-1 font-display text-3xl text-ink">Technology priorities</h1>
        <p className="mt-2 text-sm text-ink">
          {e.name ? <><b className="font-semibold">Edition {e.name}</b> · published </> : "Published "}{formatAt(e.published_at, e.tz)}
          {" · "}Prepared for Tata Communications
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          {plural(e.counts.technologies, "technology", "technologies")} assessed · {plural(placed.length, "placement")} on the
          grid · {plural(techs.length, "Point of View", "Points of View")} in this pack (Act now)
        </p>
      </header>

      {/* the grid sizes itself to its box, so the box is an A4 page's printable width: it prints whole */}
      <div className="mt-6 max-w-[672px] break-inside-avoid">
        <Grid items={placed} cutpoints={data.cutpoints} withFabric from="/frontier" lens="growth"
          frontier={{ ...frontier, band }} since={e.previous?.label} />
      </div>
      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-2 print:grid-cols-1">
        <ActNow items={actNow} lens="growth" from="/frontier" withFabric />
        <MovedSince moved={placed.filter((i) => i.moved)} previous={e.previous} from="/frontier" withFabric />
        <Committed items={placed} />
        <Assumptions items={data.assumptions} />
      </div>

      {(povs ?? []).map((pov) => (
        <section key={pov.tech_id} className="mt-12 break-before-page">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-500">Point of View · Act now</div>
          <h2 className="mt-1 font-display text-2xl text-ink">{label(pov.technology ?? pov.tech_id)}</h2>
          <p className="mt-1 text-sm text-neutral-600">Written {formatAt(pov.composed_at, pov.composed_tz)}</p>
          <PovBody pov={pov as Pov} afterAnswers={<PovLeader fabrics={pov.fabrics ?? []} />} />
        </section>
      ))}
      {povs && povs.length === 0 && <p className="mt-8 text-sm text-muted">Nothing is at Act now in this edition.</p>}
    </div>
  );
}
