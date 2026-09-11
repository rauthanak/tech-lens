"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import StageFlow from "@/components/StageFlow";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { formatTime } from "@/lib/format";

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
};

type Run = {
  _id: string;
  status: string;
  stage?: string;
  stage_history?: { stage: string; at: string }[];
  progress: { techs_total: number; techs_done: number; llm_calls: number };
  technologies: { tech_id: string; name: string }[];
  skipped?: { name: string; reason: string }[];
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

const EXTRAS: { code: string; label: string }[] = [
  { code: "X1", label: "X1 Disruption threat — outside TORA, feeds the priority grid" },
  { code: "X2", label: "X2 Serviceable capture — outside TORA, feeds the priority grid" },
  { code: "X3", label: "X3 Capability gap — outside TORA, feeds the PoV" },
];

function scoreShade(score: number | null): string {
  if (score == null) return "bg-neutral-100 text-neutral-400";
  if (score >= 7) return "bg-[#8a4b2d] text-white";
  if (score >= 4) return "bg-[#dcb9a2] text-[#171513]";
  return "bg-[#f8efe7] text-[#171513]";
}

const PRIORITY_STYLE: Record<string, { bg: string; ink: string }> = {
  P1: { bg: "#8a4b2d", ink: "#ffffff" },
  P2: { bg: "#a97253", ink: "#ffffff" },
  P3: { bg: "#c49579", ink: "#171513" },
  P4: { bg: "#dcb9a2", ink: "#171513" },
  P5: { bg: "#eed8c8", ink: "#171513" },
  P6: { bg: "#f8efe7", ink: "#171513" },
};

const TIMELINE_COLS = ["near", "mid", "far"] as const;
const POTENTIAL_ROWS = ["high", "mid", "low"] as const;
// the grid map mirrors the seeded priority_grid config
const GRID_CELLS: Record<string, string> = {
  near_high: "P1", near_mid: "P2", near_low: "P4",
  mid_high: "P2", mid_mid: "P3", mid_low: "P5",
  far_high: "P3", far_mid: "P5", far_low: "P6",
};

function PriorityChip({ p }: { p: string | null | undefined }) {
  if (!p) return <span className="font-mono text-xs text-neutral-400">—</span>;
  const s = PRIORITY_STYLE[p] ?? { bg: "#f5f5f4", ink: "#171513" };
  return (
    <span className="inline-block min-w-8 px-1 py-0.5 text-center font-mono text-xs"
      style={{ background: s.bg, color: s.ink }}>
      {p}
    </span>
  );
}

export default function ScoringRunPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fabric, setFabric] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [axisView, setAxisView] = useState<"priority" | "priority_by_disruptiveness">("priority");
  const [prioFilter, setPrioFilter] = useState<string | null>(null);
  const [gridMeta, setGridMeta] = useState<{
    timelineFrom: string[]; potentialFrom: string[]; tCuts: number[]; pCuts: number[];
  } | null>(null);
  const [sortKey, setSortKey] = useState<string>("market_potential");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [shown, setShown] = useState(50); // table pagination — big runs stay snappy
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadedOnce = useRef(false);
  const load = useCallback(
    () => fetchJson<Run>(`/api/scoring/runs/${id}`)
      .then((d) => { loadedOnce.current = true; setRun(d); setError(null); })
      // a poll timing out during a heavy scoring burst is not "backend down" —
      // keep showing the data we have; only surface errors before the first load
      .catch((e) => { if (!loadedOnce.current) setError(e); }),
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  // config + measure names, to explain placement in this run's own terms
  useEffect(() => {
    Promise.all([
      fetchJson<{ config: { _id: string; [k: string]: unknown }[] }>("/api/scoring/config"),
      fetchJson<{ measures: { _id: string; code: string; name: string }[] }>("/api/scoring/measures"),
    ])
      .then(([c, m]) => {
        const grid: Record<string, unknown> =
          c.config.find((d) => d._id === "priority_grid") ?? {};
        const label = new Map(m.measures.map((x) => [x._id, `${x.code} ${x.name}`]));
        const names = (ids: unknown) =>
          ((ids as string[]) ?? []).map((i) => label.get(i) ?? i);
        setGridMeta({
          timelineFrom: names(grid["timeline_from"]),
          potentialFrom: names(grid["potential_from"]),
          tCuts: (grid["timeline_cutpoints"] as number[]) ?? [4, 7],
          pCuts: (grid["potential_cutpoints"] as number[]) ?? [4, 7],
        });
      })
      .catch(() => {});
  }, []);

  const running = run?.status === "running" || run?.status === "terminating";
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

  useEffect(() => setShown(50), [fabric, query, prioFilter]); // new filter → back to page one

  function sortBy(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === "technology" || key === "priority" || key === "horizon" ? 1 : -1);
    }
  }

  async function act(path: string, done: string) {
    setNotice(null);
    try {
      await sendJson(path, "POST", {});
      setNotice(done);
      load();
    } catch (e) {
      setNotice(e instanceof ApiError ? (e.detail ?? e.message) : "failed");
    }
  }

  const arrow = (key: string) => (sortKey === key ? (sortDir === -1 ? " ↓" : " ↑") : "");

  return (
    <div className="max-w-5xl">
      <p className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <Link href="/admin/scoring/assessments" className="text-[var(--accent)] underline underline-offset-4">
          back to scoring runs
        </Link>
        {run && (
          <>
            <span className="font-mono text-xs">
              {run.status}
              {running && run.stage ? ` · ${run.stage}` : ""} ·{" "}
              {run.progress.techs_done}/{run.progress.techs_total} techs ·{" "}
              {run.progress.llm_calls} LLM calls · started {formatTime(run.started_at)}
            </span>
            {running && (
              <button
                onClick={() => act(`/api/scoring/runs/${id}/terminate`, "terminating")}
                className="border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100"
              >
                Terminate
              </button>
            )}
            {(run.status === "failed" || run.status === "terminated") && (
              <button
                onClick={() => act(`/api/scoring/runs/${id}/resume`, "resumed — finishing the missing work")}
                title="existing assessments are kept; only the missing work re-runs"
                className="border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100"
              >
                Resume
              </button>
            )}
            {!running && run.assessments.length > 0 && (
              <button
                onClick={() => act(`/api/scoring/runs/${id}/recompute`, "TORA recomputed with current weights")}
                title="re-derive the TORA roll-ups from stored scores using the current measure weights — no LLM calls"
                className="border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100"
              >
                Recompute roll-ups
              </button>
            )}
          </>
        )}
        {notice && <span className="font-mono text-xs text-[#7a3c1e]">{notice}</span>}
      </p>

      {error != null && <BackendError error={error} />}
      {run?.error && <p className="mt-3 font-mono text-xs text-[#7a3c1e]">{run.error}</p>}

      {run && run.assessments.length === 0 && (run.stage_history?.length ?? 0) > 0 && (
        <div className="mt-5 w-52 border border-neutral-200 bg-white px-5 py-4">
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
      )}

      {run && run.assessments.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {[["all", "All fabrics"] as [string, string], ...fabrics].map(([fid, label]) => (
            <button
              key={fid}
              onClick={() => setFabric(fid)}
              className={`px-3 py-1.5 text-sm ${
                fabric === fid
                  ? "bg-[#171513] font-medium text-white"
                  : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {label}
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
        <div className="mt-4 flex flex-wrap items-start gap-6 border border-neutral-200 bg-white px-5 py-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                Priority grid
              </span>
              {(["priority", "priority_by_disruptiveness"] as const).map((v) => (
                <button key={v} onClick={() => { setAxisView(v); setPrioFilter(null); }}
                  className={`px-2 py-0.5 text-xs ${
                    axisView === v ? "bg-[#171513] text-white"
                    : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100"}`}>
                  {v === "priority" ? "Impact Potential" : "Disruptiveness"}
                </button>
              ))}
            </div>
            <table className="mt-2 border-separate" style={{ borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th className="pr-2 text-right font-mono text-[10px] font-normal uppercase text-neutral-500">↓ big / soon →</th>
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
                      const p = GRID_CELLS[`${c}_${r}`];
                      const s = PRIORITY_STYLE[p];
                      const n = gridCounts[p] ?? 0;
                      const active = prioFilter === p;
                      return (
                        <td key={c}>
                          <button
                            onClick={() => setPrioFilter(active ? null : p)}
                            title={`${p} — click to ${active ? "clear the" : "filter the table to this"} cell`}
                            className={`h-11 w-16 text-center ${active ? "ring-2 ring-[#171513]" : ""}`}
                            style={{ background: s.bg, color: s.ink }}
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
          </div>
          <div className="min-w-64 flex-1 space-y-3 text-[13px] leading-relaxed text-neutral-600">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                How a cell is chosen
              </div>
              <p className="mt-0.5">
                <em>How soon</em> (the horizontal axis, in both views) — average of{" "}
                {gridMeta?.timelineFrom.join(" + ") ?? "the timeline measures"}.
              </p>
              <p className="mt-0.5">
                <em>How big</em> (Impact Potential, the vertical axis) — average of{" "}
                {gridMeta?.potentialFrom.join(", ") ?? "the potential measures"}.
              </p>
              <p className="mt-0.5">
                Below {gridMeta?.tCuts[0] ?? 4} is far/low, above {gridMeta?.tCuts[1] ?? 7} is
                near/high. An unscorable measure is dropped from its average, never
                counted as zero.
              </p>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                How X1–X3 affect the priority
              </div>
              <p className="mt-0.5">
                X1 and X2 never touch the three TORA numbers, but they are half of
                the <em>how big</em> average — they move the P cell, not the headline
                scores. X3 moves neither; it becomes the capability caveat in the PoV.
              </p>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                The two views
              </div>
              <p className="mt-0.5">
                <em>Impact Potential</em> plots the full <em>how big</em> average.
                <em> Disruptiveness</em> swaps that vertical axis for X1 alone —
                the damage to TCL if others move first (<em>how soon</em> stays
                the same). A technology can be a modest opportunity yet a serious
                threat, so the same row can sit in two different cells.
              </p>
            </div>
            <p className="text-xs text-neutral-500">
              Click a cell to filter the table below; hover a P cell in the table
              for that row&apos;s arithmetic.
              {prioFilter && (
                <button onClick={() => setPrioFilter(null)}
                  className="ml-2 border border-neutral-300 px-1.5 py-0.5 text-[11px] hover:bg-neutral-100">
                  clear {prioFilter}
                </button>
              )}
            </p>
          </div>
          {(run.stage_history?.length ?? 0) > 0 && (
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
          )}
        </div>
      )}

      {run && (
        <div className="mt-3 border border-neutral-200 bg-white">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col />
              {fabric === "all" && <col className="w-28" />}
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-12" />
              <col className="w-12" />
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
                    {x.code}{arrow(x.code)}
                  </th>
                ))}
                <th className="cursor-pointer px-2 py-2.5 text-right font-normal hover:text-black"
                  onClick={() => sortBy("priority")} title="Priority cell (current grid view)">
                  P{arrow("priority")}
                </th>
                <th className="cursor-pointer px-2 py-2.5 text-right font-normal hover:text-black"
                  onClick={() => sortBy("horizon")} title="Horizon from the timeline band">
                  H{arrow("horizon")}
                </th>
                <th className="cursor-pointer px-3 py-2.5 text-right font-normal hover:text-black"
                  onClick={() => sortBy("docs")}>
                  Docs{arrow("docs")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.slice(0, shown).map((a) => (
                <Row key={a._id} a={a} runId={id} showFabric={fabric === "all"} axisView={axisView} />
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
                onClick={() => setShown((n) => n + 50)}
                className="border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
              >
                Show more ({shown} of {rows.length})
              </button>
            </div>
          )}
        </div>
      )}

      {run && run.assessments.length > 0 && (
        <p className="mt-2 font-mono text-[11px] text-neutral-500">
          <span className="text-amber-700">◦</span> partial — this average is
          built from fewer measures, because the unscorable ones are dropped
          rather than counted as zero (hover any score for the counts).
          A score shown as &ldquo;—&rdquo; is one the evidence could not support.
        </p>
      )}

      {(run?.skipped?.length ?? 0) > 0 && (
        <div className="mt-3 border border-neutral-200 bg-white px-5 py-3 text-sm text-neutral-600">
          <span className="font-mono text-[11px] uppercase text-neutral-500">skipped: </span>
          {run!.skipped!.map((s) => `${s.name} (${s.reason})`).join("; ")}
        </div>
      )}
    </div>
  );
}

// chip + marker share one inline-flex line box in every score column, so all
// chips sit on the same baseline whether or not a marker shows
function Marker({ on, title }: { on: boolean; title?: string }) {
  return (
    <span
      title={on ? title : undefined}
      className={`relative -top-1 ml-0.5 inline-block w-2 text-center font-mono text-[10px] ${
        on ? "text-amber-700" : "text-transparent"
      }`}
    >
      ◦
    </span>
  );
}

function placementTitle(a: Assessment): string {
  const p = a.placement;
  if (!p) return "no placement — run the recompute";
  if (!p.priority) {
    const gaps = [
      p.timeline.score == null && "how soon has no scored measures",
      p.potential.score == null && "how big has no scored measures",
    ].filter(Boolean).join("; ");
    return `no cell — ${gaps || "composites incomplete"}. The method won't place what it can't compute.`;
  }
  const parts = [
    `${p.priority}: how soon ${p.timeline.score} (${p.timeline.band}) × how big ${p.potential.score} (${p.potential.band})`,
  ];
  if (p.timeline.partial || p.potential.partial) {
    parts.push(`partial — how soon ${p.timeline.scored ?? "?"}, how big ${p.potential.scored ?? "?"} measures scored; unscorables dropped, never zeroed`);
  }
  if (p.priority_by_disruptiveness && p.priority_by_disruptiveness !== p.priority) {
    parts.push(`disruptiveness view: ${p.priority_by_disruptiveness} (X1 ${p.disruptiveness.score})`);
  }
  return parts.join(". ");
}

function Row({ a, runId, showFabric, axisView }: {
  a: Assessment; runId: string; showFabric: boolean;
  axisView: "priority" | "priority_by_disruptiveness";
}) {
  const href = `/admin/scoring/assessments/${runId}/${encodeURIComponent(a._id)}`;
  return (
    <tr className="cursor-pointer hover:bg-neutral-50"
      onClick={() => (window.location.href = href)}>
      <td className="truncate px-4 py-2 font-medium">
        <Link href={href} onClick={(e) => e.stopPropagation()} className="hover:underline">
          {a.technology}
        </Link>
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
                {ax?.score ?? "—"}
              </span>
              <Marker on={Boolean(ax?.partial)}
                title={ax ? `${ax.scored} of ${ax.of} measures scored — unscorables excluded, never zeroed` : undefined} />
            </span>
          </td>
        );
      })}
      {EXTRAS.map((x) => {
        const score = a.extras?.[x.code] ?? null;
        return (
          <td key={x.code} className="px-2 py-2 text-right" title={x.label}>
            <span className="inline-flex items-center">
              <span className={`inline-block min-w-8 px-1 py-0.5 text-center font-mono text-xs tabular-nums ${scoreShade(score)}`}>
                {score ?? "—"}
              </span>
              <Marker on={false} />
            </span>
          </td>
        );
      })}
      <td className="px-2 py-2 text-right" title={placementTitle(a)}>
        <span className="inline-flex items-center">
          <PriorityChip p={a.placement?.[axisView]} />
          <Marker
            on={Boolean(a.placement?.timeline.partial || a.placement?.potential.partial)}
            title="a composite behind this cell is partial — hover the cell for the counts" />
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
