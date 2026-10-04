"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import ConfirmAction from "@/components/ConfirmAction";
import FabricLabel from "@/components/FabricLabel";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { writePovs } from "@/lib/actions";
import { fetchJson } from "@/lib/api";
import { formatDay, plural } from "@/lib/format";
import { useHere, withFrom } from "@/lib/here";
import { usePipeline } from "@/lib/pipeline";
import { useTechLabel } from "@/lib/tech-labels";
import { LIVE_DOT, PRIORITY } from "@/lib/theme";

type PovRow = {
  _id: string;
  scoring_run_id: string;
  tech_id: string;
  technology: string;
  version: number;
  composed_at: string;
  assessed_at: string | null; // the assessment it was written from
  sections?: { headline?: string };
  new_since_written: number | null;
  placements: { fabric_id: string; fabric: string; priority: string | null; horizon: string | null }[];
};

type Waiting = { scoring_run_id: string; tech_id: string; technology: string; assessed_at: string };

type Job = {
  _id: string;
  status: "running" | "completed" | "failed" | "interrupted";
  recompose?: boolean;
  total: number;
  done: number;
  current: string[];
  failed: { tech_id: string; scoring_run_id: string; error: string }[];
  started_at: string;
} | null;

type Library = { povs: PovRow[]; uncomposed: Waiting[]; assessed: number; job: Job };

const PAGE = 24; // cards at a time; search and "Show more" appear once there are more

function PovLibrary() {
  const label = useTechLabel();
  const here = useHere();
  const p = usePipeline();
  const [data, setData] = useState<Library | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);

  const load = useCallback(
    () => fetchJson<Library>("/api/scoring/povs").then((d) => { setData(d); setError(null); }).catch(setError),
    [],
  );
  // reload as the writing job moves on, and when Points of View come or go
  const job = p?.pov.job;
  useEffect(() => { load(); }, [load, job?.done, job?.status, p?.pov.composed, p?.pov.pending]);

  const povs = data?.povs ?? [];
  const needle = q.trim().toLowerCase();
  const matching = needle
    ? povs.filter((pv) => `${label(pv.technology)} ${pv.sections?.headline ?? ""}`.toLowerCase().includes(needle))
    : povs;
  const waiting = data?.uncomposed ?? [];
  const running = data?.job?.status === "running" ? data.job : null;
  const failed = new Set((data?.job?.failed ?? []).map((f) => f.tech_id));

  return (
    <div>
      <PageHeader title="Points of View"
        intro="The radar's conclusions: one Point of View per technology, written from its latest assessment."
        help={<>
          <li>Newest first; click one to read it. Each card shows the headline, when it was written and when the
            assessment it explains was made, and per fabric the priority (P1 act now to P6 just watch) and the
            horizon (H1 near to H3 far). A fabric without one shows only its name.</li>
          <li>&ldquo;New since written&rdquo; counts pages collected about the technology after its Point of View
            was written.</li>
          <li>Technologies assessed but without a Point of View yet are counted at the top. The link opens them on
            Technologies, where you can write one (about 1 model call) or all of them.</li>
          <li>A Point of View explains its assessment in Tata Communications&apos; house format, and every number
            traces back to the assessment and its source pages. Writing or rewriting one never changes the
            scores.</li>
          <li>Rewrite all writes every assessed technology&apos;s Point of View again from its latest assessment,
            including those not written yet. It says how many before it starts.</li>
        </>} />

      {error != null && <BackendError error={error} />}

      {data?.job && (running || data.job.failed.length > 0 || data.job.status === "interrupted") && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-card border border-line bg-white px-5 py-3 text-sm">
          {running ? (
            <span className="flex items-center gap-2"><span className={LIVE_DOT} />
              Writing {running.done} of {running.total}</span>
          ) : (
            <StatusChip status={data.job.status} />
          )}
          {data.job.failed.length > 0 && <span className="text-failed">{data.job.failed.length} failed</span>}
          {running && running.current.length > 0 && (
            <span className="min-w-0 flex-1 truncate text-xs text-muted">now: {running.current.join(", ")}</span>
          )}
        </div>
      )}

      {waiting.length > 0 && (
        <p className="mt-4 rounded-card border border-line bg-white px-5 py-3 text-sm">
          {plural(waiting.length, "technology is", "technologies are")} ready for a Point of View: assessed, with
          none written from that assessment yet.{" "}
          <Link href="/admin/technologies?state=no_pov" className="text-link hover:underline">See and write them →</Link>
        </p>
      )}

      {data && (
        <div className="mt-5 space-y-3">
          {povs.length > PAGE && (
            <input type="search" value={q} placeholder="Search by technology or headline" aria-label="Search Points of View"
              onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
              className="w-full rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-neutral-400" />
          )}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,26rem),1fr))] gap-3">
            {matching.slice(0, shown).map((pv) => (
              <Link key={pv._id} href={withFrom(`/admin/scoring/pov/${pv.scoring_run_id}/${pv.tech_id}`, here)}
                className="block rounded-card border border-line bg-white px-5 py-4 hover:border-neutral-400">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[17px] font-semibold">{label(pv.technology)}</span>
                  <span className="text-xs text-neutral-500">
                    Written {formatDay(pv.composed_at)}
                    {pv.assessed_at && ` · assessed ${formatDay(pv.assessed_at)}`} · version {pv.version}
                  </span>
                  {(pv.new_since_written ?? 0) > 0 && (
                    <span className="rounded-full bg-azure/10 px-2 py-0.5 text-xs text-ink">
                      New since written: {plural(pv.new_since_written!, "page")}
                    </span>
                  )}
                  <span className="ml-auto text-xs">
                    {running && running.current.includes(pv.tech_id) ? (
                      <span className="flex items-center gap-1.5"><span className={LIVE_DOT} />rewriting…</span>
                    ) : failed.has(pv.tech_id) ? (
                      <span className="text-failed">rewrite failed</span>
                    ) : running?.recompose && pv.composed_at < running.started_at ? (
                      <span className="text-neutral-500">queued</span>
                    ) : null}
                  </span>
                </div>
                {pv.sections?.headline && (
                  <p className="mt-1.5 border-l-2 border-navy/30 pl-3 text-sm leading-relaxed text-neutral-700">
                    {pv.sections.headline}
                  </p>
                )}
                {pv.placements.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {pv.placements.map((pl) => (
                      <span key={pl.fabric_id} className="inline-flex items-center gap-1">
                        <FabricLabel id={pl.fabric_id} name={pl.fabric} />
                        {pl.priority && (
                          <span className={`px-1 py-0.5 font-mono text-[11px] ${PRIORITY[pl.priority] ?? "bg-neutral-100"}`}>
                            {pl.priority}
                          </span>
                        )}
                        {pl.horizon && <span className="font-mono text-[11px] text-neutral-500">{pl.horizon}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
          {matching.length > shown && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <button type="button" onClick={() => setShown(shown + PAGE)}
                className="rounded-full border border-line bg-white px-4 py-1.5 text-ink hover:bg-ground">
                Show {Math.min(PAGE, matching.length - shown)} more
              </button>
              {shown} of {matching.length} shown
            </div>
          )}
          {povs.length === 0 && (
            <p className="rounded-card border border-line bg-white px-5 py-6 text-sm text-neutral-500">
              No Points of View written yet.
            </p>
          )}
          {povs.length > 0 && needle && matching.length === 0 && (
            <p className="text-sm text-muted">Nothing matches the search.</p>
          )}
          {povs.length > 0 && data.assessed > 0 && (
            <div className="pt-1">
              <ConfirmAction label="Rewrite all" secondary
                question={`Rewrite all? This writes ${plural(data.assessed, "Point of View", "Points of View")}, one per assessed technology, from its latest assessment${waiting.length ? `, including the ${waiting.length} not written yet` : ""}. Existing versions are replaced. About ${plural(data.assessed, "model call")}.`}
                confirmLabel="Rewrite" disabled={running ? "Points of View are being written." : null}
                onConfirm={async () => { await writePovs(true); await load(); }} />
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default function PovListPage() {
  return (
    <Suspense fallback={null}>
      <PovLibrary />
    </Suspense>
  );
}
