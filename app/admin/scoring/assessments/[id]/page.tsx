"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import BackLink from "@/components/BackLink";
import ConfirmAction from "@/components/ConfirmAction";
import EvidenceLine from "@/components/EvidenceLine";
import FabricLabel from "@/components/FabricLabel";
import Hood from "@/components/Hood";
import ModelUse from "@/components/ModelUse";
import PageHeader from "@/components/PageHeader";
import StageFlow from "@/components/StageFlow";
import StatusChip from "@/components/StatusChip";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import { calls, resumeAssessment } from "@/lib/actions";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { formatAt, formatDay, plural } from "@/lib/format";
import { useHood } from "@/lib/hood";
import { useHere, withFrom } from "@/lib/here";
import { blockedReason, stageWord, usePipeline } from "@/lib/pipeline";
import { formatScore, LEGEND } from "@/lib/scoring";
import { useTechLabel } from "@/lib/tech-labels";
import { PRIORITY, scoreShade } from "@/lib/theme";

const SCORING_STAGES = ["preparing", "scoring", "done"];

type AxisResult = { score: number | null; scored: number; of: number; partial: boolean };
type Tora = Record<string, AxisResult>;

type Placement = {
  timeline: { score: number | null; band: string | null; scored?: number; of?: number; partial: boolean };
  potential: { score: number | null; band: string | null; scored?: number; of?: number; partial: boolean };
  disruptiveness: { score: number | null; band: string | null };
  priority: string | null;
  priority_by_disruptiveness: string | null;
  horizon: string | null;
};

type Assessment = {
  _id: string;
  technology: string;
  tech_id: string;
  fabric: string;
  fabric_id: string;
  doc_count: number;
  tora: Tora;
  extras?: Record<string, number | null>;
  placement?: Placement;
  tora_basis: string;
  evidence_runs?: string[];
  // a person's priority, which wins over the computed one (kept in computed_priority)
  override?: { priority: string; reason: string | null; computed: string | null };
};

type Run = {
  _id: string;
  status: string;
  stage?: string;
  stage_history?: { stage: string; at: string }[];
  progress: { techs_total: number; techs_done: number; llm_calls: number };
  technologies: { tech_id: string; name: string }[];
  skipped?: { tech_id: string; name: string; reason: string }[];
  started_at: string;
  finished_at?: string;
  error?: string | null;
  assessments: Assessment[];
};

const AXES: { key: string; label: string; short: string }[] = [
  { key: "market_potential", label: "Market Potential", short: "Market" },
  { key: "strategic_fit", label: "Strategic Fit", short: "Strategic" },
  { key: "adoption_readiness", label: "Adoption Readiness", short: "Adoption" },
];

// scored alongside the three scores; their codes show only under Technical details
const EXTRAS: { code: string; short: string; label: string }[] = [
  { code: "X1", short: "Threat", label: "Disruption threat: outside the three scores, feeds the priority grid" },
  { code: "X2", short: "Capture", label: "Serviceable capture: outside the three scores, feeds the priority grid" },
  { code: "X3", short: "Gap", label: "Capability gap: outside the three scores, feeds the Point of View" },
];

const TIMELINE_COLS = ["near", "mid", "far"] as const;
const POTENTIAL_ROWS = ["high", "mid", "low"] as const;

type Named = { code: string; name: string };

/** A score with one decimal, "—" when there's none. */
const score = (n: number | null | undefined) => (n == null ? "—" : formatScore(n));

/** The two grid views: how big, or Disruption threat alone. */
const VIEW_WORDS = { priority: "By size of prize", priority_by_disruptiveness: "By threat to today's revenue" } as const;

function PriorityChip({ p }: { p: string | null | undefined }) {
  if (!p) return <span className="font-mono text-xs text-neutral-400">—</span>;
  return (
    <span className={`inline-block min-w-8 px-1 py-0.5 text-center font-mono text-xs ${PRIORITY[p] ?? "bg-neutral-100"}`}>
      {p}
    </span>
  );
}

function ScoringRun() {
  const { id } = useParams<{ id: string }>();
  const here = useHere();
  const label = useTechLabel();
  const pipeline = usePipeline();
  const [resumeCalls, setResumeCalls] = useState<{ count: number; calls: number } | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null);
  const [fabric, setFabric] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [axisView, setAxisView] = useState<"priority" | "priority_by_disruptiveness">("priority");
  const [prioFilter, setPrioFilter] = useState<string | null>(null);
  const [gridMeta, setGridMeta] = useState<{
    cells: Record<string, string>;
    timelineFrom: Named[]; potentialFrom: Named[]; tCuts: number[]; pCuts: number[];
  } | null>(null);
  const [sortKey, setSortKey] = useState<string>("market_potential");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  // table pagination — big runs stay snappy; a new filter goes back to page one
  const [paging, setPaging] = useState({ filter: "", shown: 50 });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hood = useHood();
  // a measure's name, with its code under Technical details
  const named = (list: Named[]) => list.map((m) => (hood && m.code ? `${m.code} ${m.name}` : m.name));
  // technologies switched off since: marked on their rows
  const [off, setOff] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetchJson<{ ids?: string[]; technologies?: { _id: string }[] }>("/api/technologies?view=off&ids_only=true&limit=500")
      .then((d) => setOff(new Set(d.ids ?? d.technologies?.map((t) => t._id) ?? [])))
      .catch(() => {});
  }, []);

  const loadedOnce = useRef(false);
  const load = useCallback(() => {
    return fetchJson<Run>(`/api/scoring/runs/${id}`)
      .then((d) => {
        loadedOnce.current = true;
        // an override is the priority in force: the grid, filters and sort use it
        setRun({ ...d, assessments: d.assessments.map((a) => a.override && a.placement
          ? { ...a, placement: { ...a.placement, priority: a.override.priority } } : a) });
        setError(null);
      })
      // a poll timing out during a heavy scoring burst is not "backend down" —
      // keep showing the data we have; only surface errors before the first load
      .catch((e) => { if (!loadedOnce.current) setError(e); });
  }, [id]);
  const resumeBlocked = blockedReason(pipeline, "assess");

  useEffect(() => {
    load();
  }, [load]);

  // the priority grid as configured, and measure names to explain placement
  useEffect(() => {
    Promise.all([
      fetchJson<{ config: { _id: string; [k: string]: unknown }[] }>("/api/scoring/config"),
      fetchJson<{ measures: { _id: string; code: string; name: string }[] }>("/api/scoring/measures"),
    ])
      .then(([c, m]) => {
        const grid: Record<string, unknown> =
          c.config.find((d) => d._id === "priority_grid") ?? {};
        const label = new Map(m.measures.map((x) => [x._id, x]));
        const names = (ids: unknown) =>
          ((ids as string[]) ?? []).map((i) => label.get(i) ?? { code: "", name: i });
        setGridMeta({
          cells: (grid["grid"] as Record<string, string>) ?? {},
          timelineFrom: names(grid["timeline_from"]),
          potentialFrom: names(grid["potential_from"]),
          tCuts: (grid["timeline_cutpoints"] as number[]) ?? [4, 7],
          pCuts: (grid["potential_cutpoints"] as number[]) ?? [4, 7],
        });
      })
      .catch(() => {});
  }, []);

  const running = run?.status === "running" || run?.status === "terminating";
  const stopped = run?.status === "failed" || run?.status === "terminated";

  // what resuming would cost: the technologies the run hasn't assessed yet
  const left = useMemo(() => {
    if (!run || !stopped) return [];
    const done = new Set([...run.assessments.map((a) => a.tech_id), ...(run.skipped ?? []).map((x) => x.tech_id)]);
    return run.technologies.filter((t) => !done.has(t.tech_id)).map((t) => t.tech_id);
  }, [run, stopped]);
  useEffect(() => {
    if (!left.length) return;
    fetchJson<{ technologies: number; calls: number }>(`/api/scoring/preview?technologies=${left.join(",")}`)
      .then((d) => setResumeCalls({ count: left.length, calls: d.calls }))
      .catch(() => {});
  }, [left]);

  useEffect(() => {
    if (running && !timer.current) timer.current = setInterval(load, 5000);
    if (!running && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [running, load]);

  const fabrics = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of run?.assessments ?? []) seen.set(a.fabric_id, a.fabric);
    return [...seen.entries()];
  }, [run]);

  const scoped = useMemo(() => {
    let list = run?.assessments ?? [];
    if (fabric !== "all") list = list.filter((a) => a.fabric_id === fabric);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((a) => a.technology.includes(q));
    return list;
  }, [run, fabric, query]);

  const gridCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of scoped) {
      const p = a.placement?.[axisView];
      if (p) counts[p] = (counts[p] ?? 0) + 1;
    }
    return counts;
  }, [scoped, axisView]);

  const rows = useMemo(() => {
    let list = scoped;
    if (prioFilter) list = list.filter((a) => a.placement?.[axisView] === prioFilter);
    const val = (a: Assessment) =>
      sortKey === "technology" ? a.technology
      : sortKey === "docs" ? a.doc_count
      : sortKey === "priority" ? Number((a.placement?.[axisView] ?? "P9").slice(1))
      : sortKey === "horizon" ? (a.placement?.horizon ?? "H9")
      : sortKey.startsWith("X") ? (a.extras?.[sortKey] ?? -1)
      : (a.tora?.[sortKey]?.score ?? -1);
    return [...list].sort((x, y) => {
      const a = val(x), b = val(y);
      return (a < b ? -1 : a > b ? 1 : 0) * sortDir;
    });
  }, [scoped, prioFilter, axisView, sortKey, sortDir]);

  const filterKey = `${fabric}|${query}|${prioFilter}`;
  const shown = paging.filter === filterKey ? paging.shown : 50;

  function sortBy(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === "technology" || key === "priority" || key === "horizon" ? 1 : -1);
    }
  }

  // `done`: what it did; `failed`: what didn't happen, before the reason
  async function act(path: string, done: string, failed: string) {
    setNotice(null);
    try {
      await sendJson(path, "POST", {});
      setNotice({ text: done, failed: false });
      load();
    } catch (e) {
      setNotice({ text: `${failed}: ${errorText(e)}`, failed: true });
    }
  }

  const arrow = (key: string) => (sortKey === key ? (sortDir === -1 ? " ↓" : " ↑") : "");

  return (
    <div>
      <BackLink fallback="/admin/scoring/assessments" />
      <PageHeader eyebrow="Assessment run" title={run ? `Assessment run · ${formatDay(run.started_at)}` : "Assessment run"} right={<TechnicalDetailsSwitch />}
        intro="Where each technology in this run landed, fabric by fabric, and its scores."
        help={<>
          <li>One row per technology and fabric. Market, Strategic and Adoption are the three headline scores
            (0–10); Threat, Capture and Gap (disruption threat, serviceable capture, capability gap) are also
            scored; Priority runs from P1 (act now) to P6 (just watch), Horizon from H1 (near) to H3 (far), and
            Pages counts the pages read. &ldquo;Switched off&rdquo; marks a technology switched off since: it
            isn&apos;t assessed again or shown to leaders. &ldquo;partial&rdquo; means some measures couldn&apos;t
            be scored and were left out, never counted as zero.</li>
          <li>The priority grid counts the rows in each cell: how soon it arrives across, how big the prize is
            down. Click a cell to filter the table. &ldquo;{VIEW_WORDS.priority_by_disruptiveness}&rdquo; swaps
            how big for the Disruption threat Tata enters: the damage to existing revenue if others move first.</li>
          <li>Click a row for the full reasoning behind it. Filter by fabric or search by name above the grid.</li>
          <li>Resume finishes a stopped run and keeps what&apos;s done. Redo scores works out the three scores and
            the priorities again from the stored measure scores, with today&apos;s weights and cut-points, at no
            model cost.</li>
        </>}>
        {run && (
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-neutral-600">
            <StatusChip status={run.status} />
            {running && run.stage && <span>now: {stageWord(run.stage).toLowerCase()}</span>}
            <span>{run.progress.techs_done} of {plural(run.progress.techs_total, "technology", "technologies")} done</span>
            <span>{plural(run.progress.llm_calls, "model call")} used</span>
            <span>started {formatAt(run.started_at)}</span>
            {run.finished_at && <span>finished {formatAt(run.finished_at)}</span>}
            <Hood><span className="font-mono text-xs">run {id}</span></Hood>
          </p>
        )}
        {run && <ModelUse runIds={[id]} kind="scoring" startedAt={run.started_at} refresh={run.progress.techs_done} calls={false} />}
      </PageHeader>
      <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        {run && (
          <>
            {running && (
              <button
                onClick={() => act(`/api/scoring/runs/${id}/terminate`, "Stopping the run; what's already assessed is kept.", "Not stopped")}
                className="rounded-full border border-line bg-white px-2.5 py-1 text-xs hover:bg-neutral-100"
              >
                Terminate
              </button>
            )}
            {stopped && (
              <ConfirmAction label="Resume" secondary cost={resumeCalls ? calls(resumeCalls.calls) : undefined}
                question={resumeCalls
                  ? `Resume? About ${plural(resumeCalls.calls, "model call")} for the ${plural(resumeCalls.count, "technology", "technologies")} left. What's already assessed is kept.`
                  : "Resume? What's already assessed is kept; only the missing work runs again."}
                disabled={resumeBlocked}
                onConfirm={async () => { await resumeAssessment(id); setNotice({ text: "Resumed: finishing the missing work.", failed: false }); load(); }} />
            )}
            {!running && run.assessments.length > 0 && (
              <button
                onClick={() => act(`/api/scoring/runs/${id}/recompute`, "Scores and priorities redone with today's weights and cut-points.", "Scores not redone")}
                title="Work out the three scores and the priority again from the stored measure scores, with today's weights and cut-points: no model calls"
                className="rounded-full border border-line bg-white px-2.5 py-1 text-xs hover:bg-neutral-100"
              >
                Redo scores with today&apos;s weights (free)
              </button>
            )}
          </>
        )}
        {notice && <span role="status" className={`text-sm ${notice.failed ? "text-failed" : "text-ink"}`}>{notice.text}</span>}
      </p>

      {error != null && <BackendError error={error} />}
      {run?.error && <p className="mt-3 font-mono text-xs text-failed">{run.error}</p>}

      {run && run.assessments.length > 0 && <EvidenceLine assessments={run.assessments} />}

      {run && run.assessments.length === 0 && (run.stage_history?.length ?? 0) > 0 && (
        <Hood>
          <div className="mt-5 w-52 rounded-card border border-line bg-white px-5 py-4">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
              Process
            </p>
            <StageFlow
              stages={SCORING_STAGES}
              history={run.stage_history!}
              status={run.status}
              endTime={run.finished_at ?? null}
            />
          </div>
        </Hood>
      )}

      {run && run.assessments.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {/* "all" has no fabric colour, so it shows as the neutral pill */}
          {[["all", "All fabrics"] as [string, string], ...fabrics].map(([fid, label]) => (
            <button
              key={fid}
              onClick={() => setFabric(fid)}
              className={`rounded-full ${fabric === fid ? "ring-2 ring-azure ring-offset-2" : "hover:opacity-80"}`}
            >
              <FabricLabel id={fid} name={label} />
            </button>
          ))}
          <input
            className="ml-auto w-64 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
            placeholder="search technologies…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {run && run.assessments.length > 0 && (
        <div className="mt-4 flex flex-wrap items-start gap-6 rounded-card border border-line bg-white px-5 py-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                Priority grid
              </span>
              {(["priority", "priority_by_disruptiveness"] as const).map((v) => (
                <button key={v} onClick={() => { setAxisView(v); setPrioFilter(null); }}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    axisView === v ? "bg-navy text-white"
                    : "border border-line text-neutral-600 hover:bg-neutral-100"}`}>
                  {VIEW_WORDS[v]}
                </button>
              ))}
            </div>
            {gridMeta && (
              <table className="mt-2 border-separate" style={{ borderSpacing: 2 }}>
                <thead>
                  <tr>
                    <th className="pr-2 text-right font-mono text-[10px] font-normal uppercase text-neutral-500">How big ↓ · How soon →</th>
                    {TIMELINE_COLS.map((c) => (
                      <th key={c} className="pb-0.5 font-mono text-[10px] font-normal uppercase text-neutral-500">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {POTENTIAL_ROWS.map((r) => (
                    <tr key={r}>
                      <td className="pr-2 text-right font-mono text-[10px] uppercase text-neutral-500">{r}</td>
                      {TIMELINE_COLS.map((c) => {
                        const p = gridMeta.cells[`${c}_${r}`];
                        const n = gridCounts[p] ?? 0;
                        const active = prioFilter === p;
                        return (
                          <td key={c}>
                            <button
                              onClick={() => setPrioFilter(active ? null : p)}
                              title={`${p} — click to ${active ? "clear the" : "filter the table to this"} cell`}
                              className={`h-11 w-16 text-center ${PRIORITY[p]} ${active ? "ring-2 ring-azure" : ""}`}
                            >
                              <span className="block font-mono text-[10px]">{p}</span>
                              <span className="block font-mono text-sm font-semibold tabular-nums">{n || "·"}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="min-w-64 flex-1 space-y-3 text-[13px] leading-relaxed text-neutral-600">
            {axisView === "priority_by_disruptiveness" && scoped.length > 0 && Object.keys(gridCounts).length === 0 && (
              <p className="text-ink">
                Empty: Tata hasn&apos;t entered the Disruption threat for {fabric === "all" ? "these technologies" : "this fabric"} yet.
              </p>
            )}
            <details className="group">
              <summary className="flex cursor-pointer list-none items-baseline gap-2 text-sm text-ink [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="inline-block text-[9px] text-muted transition-transform group-open:rotate-90">▶</span>
                How the grid works
              </summary>
              <div className="mt-2 space-y-3">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    How a cell is chosen
                  </div>
                  <p className="mt-0.5">
                    <em>How soon</em> (across, in both views): the average of{" "}
                    {gridMeta ? named(gridMeta.timelineFrom).join(" + ") : "the timeline measures"}.
                  </p>
                  <p className="mt-0.5">
                    <em>How big</em> (down): the average of{" "}
                    {gridMeta ? named(gridMeta.potentialFrom).join(", ") : "the potential measures"}.
                  </p>
                  <p className="mt-0.5">
                    Below {gridMeta?.tCuts[0] ?? 4} is far/low, above {gridMeta?.tCuts[1] ?? 7} is
                    near/high. A measure without enough evidence is left out of its average,
                    never counted as zero.
                  </p>
                </div>
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    How threat, capture and gap affect the priority
                  </div>
                  <p className="mt-0.5">
                    Disruption threat and Serviceable capture never touch the three scores, but they are half of
                    the <em>how big</em> average: they move the priority, not the headline
                    scores. Capability gap moves neither; it becomes the capability caveat in the Point of View.
                  </p>
                </div>
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    The two views
                  </div>
                  <p className="mt-0.5">
                    <em>{VIEW_WORDS.priority}</em> plots the full <em>how big</em> average.
                    <em> {VIEW_WORDS.priority_by_disruptiveness}</em> swaps it for Disruption threat alone:
                    the damage to Tata Communications if others move first (<em>how soon</em> stays
                    the same). A technology can be a modest opportunity yet a serious
                    threat, so the same row can sit in two different cells.
                  </p>
                </div>
              </div>
            </details>
            <p className="text-xs text-neutral-500">
              Click a cell to filter the table below; hover a priority in the table
              for that row&apos;s arithmetic.
              {prioFilter && (
                <button onClick={() => setPrioFilter(null)}
                  className="ml-2 rounded-full border border-line px-1.5 py-0.5 text-[11px] hover:bg-neutral-100">
                  clear {prioFilter}
                </button>
              )}
            </p>
          </div>
          {(run.stage_history?.length ?? 0) > 0 && (
            <Hood>
              <div className="w-44 shrink-0 border-l border-neutral-100 pl-6">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                  Process
                </p>
                <StageFlow
                  stages={SCORING_STAGES}
                  history={run.stage_history!}
                  status={run.status}
                  endTime={run.finished_at ?? null}
                />
              </div>
            </Hood>
          )}
        </div>
      )}

      {run && (
        <div className="mt-3 overflow-hidden rounded-card border border-line bg-white">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col />
              {fabric === "all" && <col className="w-28" />}
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-16" />
            </colgroup>
            <thead>
              <tr className="border-b border-neutral-200 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                <th className="cursor-pointer px-4 py-2.5 text-left font-normal hover:text-black"
                  onClick={() => sortBy("technology")}>
                  Technology{arrow("technology")}
                </th>
                {fabric === "all" && <th className="px-3 py-2.5 text-left font-normal">Fabric</th>}
                {AXES.map((a) => (
                  <th key={a.key}
                    className="cursor-pointer px-3 py-2.5 text-right font-normal hover:text-black"
                    onClick={() => sortBy(a.key)} title={a.label}>
                    {a.short}{arrow(a.key)}
                  </th>
                ))}
                {EXTRAS.map((x) => (
                  <th key={x.code}
                    className="cursor-pointer px-2 py-2.5 text-right font-normal hover:text-black"
                    onClick={() => sortBy(x.code)} title={x.label}>
                    {hood ? x.code : x.short}{arrow(x.code)}
                  </th>
                ))}
                <th className="cursor-pointer px-2 py-2.5 text-right font-normal hover:text-black"
                  onClick={() => sortBy("priority")} title="Priority cell (current grid view)">
                  Priority{arrow("priority")}
                </th>
                <th className="cursor-pointer px-2 py-2.5 text-right font-normal hover:text-black"
                  onClick={() => sortBy("horizon")} title="Horizon from the timeline band">
                  Horizon{arrow("horizon")}
                </th>
                <th className="cursor-pointer px-3 py-2.5 text-right font-normal hover:text-black"
                  onClick={() => sortBy("docs")}>
                  Pages{arrow("docs")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.slice(0, shown).map((a) => (
                <Row key={a._id} a={a} showFabric={fabric === "all"} axisView={axisView} here={here} off={off.has(a.tech_id)} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-neutral-500">
                    {running
                      ? "Assessments appear here as each technology completes."
                      : run.assessments.length === 0
                        ? "No assessments were produced."
                        : "Nothing matches the filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {rows.length > shown && (
            <div className="border-t border-neutral-100 px-4 py-2.5">
              <button
                onClick={() => setPaging({ filter: filterKey, shown: shown + 50 })}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
              >
                Show more ({shown} of {rows.length})
              </button>
            </div>
          )}
        </div>
      )}

      {run && run.assessments.length > 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          {LEGEND} &ldquo;partial&rdquo;: this average is built from fewer measures, because those without enough
          evidence are left out rather than counted as zero (hover any score for the counts). &ldquo;—&rdquo;: the
          evidence couldn&apos;t support a score. For Threat and Capture it means Tata hasn&apos;t entered one yet.
        </p>
      )}

      {(run?.skipped?.length ?? 0) > 0 && (
        <div className="mt-3 rounded-card border border-line bg-white px-5 py-3 text-sm text-neutral-600">
          <span className="font-mono text-[11px] uppercase text-neutral-500">skipped: </span>
          {run!.skipped!.map((s) => `${label(s.name)} (${s.reason})`).join("; ")}
        </div>
      )}
    </div>
  );
}

// "partial" after a score, in a fixed width so every chip in a column lines up
// whether or not it shows
function Partial({ on, title }: { on: boolean; title?: string }) {
  return (
    <span title={on ? title : undefined} className="ml-1 inline-block w-9 text-left text-[10px] text-muted">
      {on ? "partial" : ""}
    </span>
  );
}

function placementTitle(a: Assessment): string {
  const p = a.placement;
  if (!p) return "Not placed yet: Redo scores places it";
  if (!p.priority) {
    const gaps = [
      p.timeline.score == null && "how soon has no scored measures",
      p.potential.score == null && "how big has no scored measures",
    ].filter(Boolean).join("; ");
    return `Held beside the grid: ${gaps || "how soon or how big is incomplete"}. The method won't place what it can't compute.`;
  }
  const parts = [
    `${p.priority}: how soon ${score(p.timeline.score)} (${p.timeline.band}) × how big ${score(p.potential.score)} (${p.potential.band})`,
  ];
  if (p.timeline.partial || p.potential.partial) {
    parts.push(`partial: how soon ${p.timeline.scored ?? "?"}, how big ${p.potential.scored ?? "?"} measures scored; the rest left out, never zeroed`);
  }
  if (p.priority_by_disruptiveness && p.priority_by_disruptiveness !== p.priority) {
    parts.push(`${VIEW_WORDS.priority_by_disruptiveness.toLowerCase()}: ${p.priority_by_disruptiveness} (disruption threat ${score(p.disruptiveness.score)})`);
  }
  return parts.join(". ");
}

function Row({ a, showFabric, axisView, here, off }: {
  a: Assessment; showFabric: boolean;
  axisView: "priority" | "priority_by_disruptiveness"; here: string; off: boolean;
}) {
  const router = useRouter();
  const label = useTechLabel();
  const href = withFrom(`/admin/technologies/${a.tech_id}?fabric=${encodeURIComponent(a.fabric_id)}`, here);
  return (
    <tr className="cursor-pointer hover:bg-neutral-50" title="Open this assessment's details"
      onClick={() => router.push(href)}>
      <td className="truncate px-4 py-2 font-medium">
        <Link href={withFrom(`/admin/technologies/${a.tech_id}`, here)} onClick={(e) => e.stopPropagation()}
          className="hover:underline" title="Open the technology">
          {label(a.technology)}
        </Link>
        {off && (
          <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-normal text-muted"
            title="Switched off since this run: not assessed again or shown to leaders; its pages are still collected">
            Switched off
          </span>
        )}
      </td>
      {showFabric && (
        <td className="truncate px-3 py-2 font-mono text-[11px] uppercase text-neutral-500">
          {a.fabric}
        </td>
      )}
      {AXES.map(({ key }) => {
        const ax = a.tora?.[key];
        return (
          <td key={key} className="px-3 py-2 text-right">
            <span className="inline-flex items-center">
              <span className={`inline-block min-w-10 px-1.5 py-0.5 text-center font-mono text-xs tabular-nums ${scoreShade(ax?.score ?? null)}`}>
                {score(ax?.score)}
              </span>
              <Partial on={Boolean(ax?.partial)}
                title={ax ? `${ax.scored} of ${ax.of} measures scored; the rest left out, never zeroed` : undefined} />
            </span>
          </td>
        );
      })}
      {EXTRAS.map((x) => {
        const value = a.extras?.[x.code] ?? null;
        return (
          <td key={x.code} className="px-2 py-2 text-right" title={x.label}>
            <span className={`inline-block min-w-8 px-1 py-0.5 text-center font-mono text-xs tabular-nums ${scoreShade(value)}`}>
              {score(value)}
            </span>
          </td>
        );
      })}
      <td className="px-2 py-2 text-right" title={placementTitle(a)}>
        <span className="inline-flex items-center">
          <PriorityChip p={a.placement?.[axisView]} />
          {a.override && axisView === "priority" && (
            <span className="ml-1 text-[11px] text-muted"
              title={`Set by a person (computed ${a.override.computed ?? "none"}): ${a.override.reason ?? ""}`}>✎</span>
          )}
        </span>
      </td>
      <td className="px-2 py-2 text-right font-mono text-xs text-neutral-700">
        {a.placement?.horizon ?? "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-neutral-600">
        {a.doc_count}
      </td>
    </tr>
  );
}

export default function ScoringRunPage() {
  return (
    <Suspense fallback={null}>
      <ScoringRun />
    </Suspense>
  );
}
