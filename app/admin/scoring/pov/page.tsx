"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import ConfirmAction from "@/components/ConfirmAction";
import FabricLabel from "@/components/FabricLabel";
import type { Edition } from "@/components/frontier/items";
import { PublishLink } from "@/components/LeadersSee";
import { editionName } from "@/components/PublishEdition";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import StatusChip from "@/components/StatusChip";
import { calls, writePovs } from "@/lib/actions";
import { fetchJson } from "@/lib/api";
import { formatDay, plural } from "@/lib/format";
import { useHere, withFrom } from "@/lib/here";
import { useStoredStart, useStoredState } from "@/lib/paging";
import { usePipeline } from "@/lib/pipeline";
import { LEGEND, HORIZON_TERM } from "@/lib/scoring";
import { useTechLabel } from "@/lib/tech-labels";
import { LIVE_DOT, PRIORITY } from "@/lib/theme";

type PovRow = {
  _id: string;
  scoring_run_id: string;
  tech_id: string;
  technology: string;
  version: number;
  composed_at: string;
  composed_tz?: string | null;
  assessed_at: string | null; // the assessment it was written from
  sections?: { headline?: string };
  new_since_written: number | null;
  views?: { opened: number; printed: number; last_opened: string | null } | null; // on the leaders' address
  placements: { fabric_id: string; fabric: string; priority: string | null; horizon: string | null;
    computed_priority?: string | null; override?: { priority: string; reason: string | null } | null }[];
};

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

/** A page of the list (GET /scoring/povs?limit=…): `total` match the filters, of `count`; the
 *  counts the page's lines use (`behind`, `unsent`, waiting) cover every one. */
type Library = { povs: PovRow[]; total: number; count: number; behind: number; unsent: number;
  fabrics: { id: string; name: string }[]; uncomposed_count: number; assessed: number; switched_off: number; job: Job };

const PAGE = 48; // cards a page (rows of 2, 3 or 4); search and the pager appear once there are more
const PRIORITIES = ["P1", "P2", "P3", "P4", "P5", "P6"];
const field = "rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink";

function PovLibrary() {
  const label = useTechLabel();
  const here = useHere();
  const p = usePipeline();
  const [data, setData] = useState<Library | null>(null);
  const [error, setError] = useState<unknown>(null);
  // the search, filters and page are kept for the tab: coming back shows the same cards
  const [q, setQ] = useStoredState("povs:q", "");
  const [start, setStart] = useStoredStart("povs");
  const [sort, setSort] = useStoredState<"priority" | "newest">("povs:sort", "priority");
  const [fabric, setFabric] = useStoredState("povs:fabric", "");
  const [priority, setPriority] = useStoredState("povs:priority", "");
  const [newer, setNewer] = useStoredState("povs:newer", false);
  const [onlyUnsent, setOnlyUnsent] = useStoredState("povs:unsent", false); // written after the edition leaders see
  const [edition, setEdition] = useState<Edition | null | undefined>(undefined); // the one leaders see; null: none yet

  // a page of cards from the server, filtered and sorted there; asked again when a filter or
  // the page changes, as the writing job moves on, and when Points of View come or go
  const [shownFrom, setShownFrom] = useState(0);
  const job = p?.pov.job;
  const moved = `${job?.done}:${job?.status}:${p?.pov.composed}:${p?.pov.pending}`;
  const load = useCallback(() => {
    const ask = (skip: number) => fetchJson<Library>(`/api/scoring/povs?${new URLSearchParams({
      limit: String(PAGE), skip: String(skip), sort, q: q.trim(), ...(fabric ? { fabric } : {}), ...(priority ? { priority } : {}),
      ...(newer ? { newer: "true" } : {}), ...(onlyUnsent ? { unsent: "true" } : {}) })}`);
    const lastOf = (total: number) => Math.floor((total - 1) / PAGE) * PAGE;
    return ask(start)
      // the kept page is past the end now (the list grew shorter meanwhile): its last page
      .then((d) => (d.povs.length === 0 && d.total > 0 ? ask(lastOf(d.total)).then((l) => ({ d: l, at: lastOf(d.total) })) : { d, at: start }))
      .then(({ d, at }) => { setData(d); setShownFrom(at); setError(null); })
      .catch(setError);
  }, [start, sort, q, fabric, priority, newer, onlyUnsent]);
  useEffect(() => { load(); }, [load, moved]);
  useEffect(() => {
    fetchJson<{ editions: Edition[] }>("/api/editions").then((d) => setEdition(d.editions[0] ?? null)).catch(() => setEdition(undefined));
  }, []);

  const povs = data?.povs ?? [];
  const fabrics = (data?.fabrics ?? []).map((f) => [f.id, f.name] as [string, string]);
  const unsent = edition ? data?.unsent ?? 0 : 0; // written after the edition leaders see
  const behind = data?.behind ?? 0;
  const reset = () => setStart(0); // another search or filter starts at the first cards
  const waiting = data?.uncomposed_count ?? 0;
  const running = data?.job?.status === "running" ? data.job : null;
  const failed = new Set((data?.job?.failed ?? []).map((f) => f.tech_id));

  return (
    <div>
      <PageHeader title="Points of View"
        intro="The radar's conclusions: one Point of View per technology, written from its latest assessment."
        help={<>
          <li>Highest priority first (a technology&apos;s best fabric), or newest written; filter by fabric, by priority, or
            to those with pages newer than they are. Click one to read it. Each card shows the headline, when it was
            written and the assessment it explains, and per fabric the priority and the horizon, or &ldquo;no
            priority&rdquo;.</li>
          <li>At the top, what keeps them current: those written from an older assessment can be written again now; those
            with newer pages need their technology assessed again first, since a Point of View only explains its
            assessment.</li>
          <li>&ldquo;New since written&rdquo; counts pages collected about the technology after its Point of View
            was written.</li>
          <li>Leaders see a Point of View only as the latest published edition holds it; the first line at the top says how
            many were written after it, and Publish on the Briefing sends them.</li>
          <li>Technologies assessed but without a Point of View yet are counted at the top. The link opens them on
            Technologies, where you can write one (about 1 model call) or all of them.</li>
          <li>A Point of View explains its assessment in Tata Communications&apos; house format, and every number
            traces back to the assessment and its source pages. Writing or rewriting one never changes the
            scores.</li>
          <li>Rewrite all writes every assessed technology&apos;s Point of View again from its latest assessment,
            including those not written yet, at about one model call each. It says how many before it starts.</li>
          <li>Switched-off technologies are left out of the list and of Rewrite all; their Points of View stay on
            their technology&apos;s page. Switching one back on brings it back.</li>
        </>}>
        <p className="mt-1 text-xs text-muted">Each fabric shows its priority and horizon. {LEGEND}</p>
      </PageHeader>

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

      {data && data.count > 0 && (
        <section aria-label="Keeping them current" className="mt-4 rounded-card border border-line bg-white px-5 py-3 text-sm">
          <h2 className="font-semibold">Keeping them current</h2>
          <ul className="mt-1 space-y-1.5">
            {edition !== undefined && (
              <li className="flex flex-wrap items-baseline gap-x-3">
                {!edition ? <span>Nothing is published yet: leaders see none of these until the first edition.</span>
                  : <span>Leaders see these as {editionName(edition)} holds them{unsent
                    ? <>: <button type="button" className="text-link underline decoration-dotted underline-offset-2 hover:decoration-solid"
                        aria-pressed={onlyUnsent} onClick={() => { setOnlyUnsent(!onlyUnsent); reset(); }}>
                        {unsent === 1 ? "1 was" : `${unsent} were`} written after it</button>, so leaders don&apos;t see{" "}
                        {unsent === 1 ? "that version" : "those versions"} yet{onlyUnsent ? " (only they show below)" : ""}.</>
                    : "; none was written after it."}</span>}
                {(!edition || unsent > 0) && <PublishLink>Publish on the Briefing →</PublishLink>}
              </li>
            )}
            <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {waiting > 0 ? <>
                <span>{plural(waiting, "technology has", "technologies have")} a newer assessment than its Point of View
                  (or none yet).</span>
                <ConfirmAction label="Write them" secondary cost={calls(waiting)} confirmLabel="Write" doneLabel="Started"
                  disabled={running ? "Points of View are being written." : null}
                  question={`Write ${plural(waiting, "Point of View", "Points of View")} from the latest assessments? About ${plural(waiting, "model call")}.`}
                  onConfirm={async () => { await writePovs(false); await load(); }} />
                <Link href="/admin/technologies?state=no_pov" className="text-link hover:underline">See them →</Link>
              </> : <span className="text-muted">Every Point of View is written from its technology&apos;s latest assessment.</span>}
            </li>
            {behind > 0 && (
              <li className="flex flex-wrap items-baseline gap-x-3">
                <span>{behind === 1 ? "1 has pages newer than its assessment: assess it" : `${behind} have pages newer than their assessments: assess them`}{" "}
                  again first; a Point of View only explains its assessment.</span>
                <Link href="/admin/technologies?state=new_evidence" className="text-link hover:underline">Technologies with new pages →</Link>
              </li>
            )}
            {data.assessed > 0 && (
              <li className="flex flex-wrap items-baseline gap-x-3 text-muted">
                <span>Or write every one again, for instance after the Point of View skill changes.</span>
                <ConfirmAction label="Rewrite all" secondary cost={calls(data.assessed)}
                  question={`Rewrite all? This writes ${plural(data.assessed, "Point of View", "Points of View")}, one per assessed technology that's switched on, from its latest assessment${waiting ? `, including the ${waiting} not written yet` : ""}. Existing versions are replaced. About ${plural(data.assessed, "model call")}.`}
                  confirmLabel="Rewrite" doneLabel="Started" disabled={running ? "Points of View are being written." : null}
                  onConfirm={async () => { await writePovs(true); await load(); }} />
              </li>
            )}
          </ul>
        </section>
      )}

      {data && (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {data.count > PAGE && (
              <input type="search" value={q} placeholder="Search by technology or headline" aria-label="Search Points of View"
                onChange={(e) => { setQ(e.target.value); reset(); }}
                className="min-w-0 flex-1 basis-64 rounded-full border border-line bg-white px-4 py-1.5 text-sm outline-none focus:border-neutral-400" />
            )}
            <select aria-label="Order" className={field} value={sort} onChange={(e) => { setSort(e.target.value as "priority" | "newest"); reset(); }}>
              <option value="priority">Highest priority first</option>
              <option value="newest">Newest written first</option>
            </select>
            <select aria-label="Fabric" className={field} value={fabric} onChange={(e) => { setFabric(e.target.value); reset(); }}>
              <option value="">Any fabric</option>
              {fabrics.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select aria-label="Priority" className={field} value={priority} onChange={(e) => { setPriority(e.target.value); reset(); }}>
              <option value="">Any priority</option>
              {PRIORITIES.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
              <option value="none">No priority</option>
            </select>
            {unsent > 0 && (
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={onlyUnsent} onChange={(e) => { setOnlyUnsent(e.target.checked); reset(); }} />
                Only those not in the edition ({unsent})
              </label>
            )}
            {behind > 0 && (
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={newer} onChange={(e) => { setNewer(e.target.checked); reset(); }} />
                Only those with newer pages ({behind})
              </label>
            )}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,26rem),1fr))] gap-3">
            {povs.map((pv) => (
              <Link key={pv._id} href={withFrom(`/admin/scoring/pov/${pv.scoring_run_id}/${pv.tech_id}`, here)}
                className="block rounded-card border border-line bg-white px-5 py-4 hover:border-neutral-400">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[17px] font-semibold">{label(pv.technology)}</span>
                  <span className="text-xs text-neutral-500">
                    Written {formatDay(pv.composed_at)}
                    {pv.assessed_at && ` · from the ${formatDay(pv.assessed_at)} assessment`}
                    {pv.views?.opened ? ` · leaders opened it ${plural(pv.views.opened, "time")}` : ""}
                  </span>
                  {edition && pv.composed_at > edition.published_at && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                      title="Written after the edition leaders see: the next Publish sends it">
                      Not in {editionName(edition)}
                    </span>
                  )}
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
                        {!pl.priority && <span className="text-[11px] text-muted">no priority</span>}
                        {pl.priority && (
                          <span className={`px-1 py-0.5 font-mono text-[11px] ${PRIORITY[pl.priority] ?? "bg-neutral-100"}`}
                            title={pl.override ? `Set by a person (the scores give ${pl.computed_priority ?? "none"}): ${pl.override.reason ?? "no reason recorded"}` : undefined}>
                            {pl.priority}
                          </span>
                        )}
                        {pl.override && <span className="text-[11px] text-amber-900">set by a person</span>}
                        {pl.horizon && <span className="text-[11.5px] text-neutral-500">{pl.horizon}, {HORIZON_TERM[pl.horizon] ?? ""}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
          <Pager start={shownFrom} total={data.total} size={PAGE} go={setStart}
            shorter={start > shownFrom} what="Points of View" />
          {data.count === 0 && (
            <p className="rounded-card border border-line bg-white px-5 py-6 text-sm text-neutral-500">
              No Points of View written yet.
            </p>
          )}
          {data.count > 0 && data.total === 0 && (
            <p className="text-sm text-muted">Nothing matches: clear the search or a filter.</p>
          )}
          {(data.switched_off ?? 0) > 0 && (
            <p className="text-xs text-muted">
              Left out: {plural(data.switched_off, "Point of View")} of switched-off technologies, which leaders
              don&apos;t see and Rewrite all doesn&apos;t write.{" "}
              <Link href="/admin/technologies?view=off" className="text-link hover:underline">See them →</Link>
            </p>
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
