"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { fetchJson } from "@/lib/api";
import { formatTime } from "@/lib/format";

type Health = { status: string; mongo: boolean };

type SourceRow = {
  source_id: string;
  horizon: "H1" | "H2" | "H3";
  cost: string;
  enabled: boolean;
};

type SourcesResponse = {
  horizons: Record<string, { label?: string; meaning?: string }>;
  sources: SourceRow[];
};

type Run = {
  id: string;
  status: string;
  stage?: string;
  run_start_date_time: string;
  totals?: { pages_visited?: number; documents?: number; new_documents?: number };
};

type TechResponse = {
  total: number;
  summary?: { tech_count: number; tagged_docs: number; horizons?: Record<string, number> };
  last_resolve?: { status: string; phase?: string } | null;
};

type ScoringOverview = {
  fabrics: { total: number; enabled: number };
  measures: { total: number };
};

type ScoringRun = {
  _id: string;
  status: string;
  stage?: string;
  progress: { techs_total: number; techs_done: number; llm_calls: number };
  started_at: string;
};

type PovsResponse = {
  povs: unknown[];
  uncomposed: unknown[];
  job?: { status: string; done: number; total: number } | null;
};

type Skill = { name: string; description?: string; version: number; enabled: boolean };

const HORIZONS = ["H1", "H2", "H3"] as const;
// Ordered single-hue shades of the portal's copper accent: nearer horizon = lighter.
const HORIZON_SHADES: Record<string, string> = {
  H1: "#d9b8a3",
  H2: "#b97d55",
  H3: "#8a4b2d",
};
const ACCENT = "#8a4b2d";
const COSTS: { key: string; label: string }[] = [
  { key: "free", label: "Free" },
  { key: "free_tier", label: "Free tier" },
  { key: "licensed", label: "Licensed" },
];

const STATUS_STYLE: Record<string, string> = {
  running: "bg-amber-100 text-amber-900",
  terminating: "bg-amber-100 text-amber-900",
  completed: "bg-emerald-100 text-emerald-900",
  done: "bg-emerald-100 text-emerald-900",
  terminated: "bg-neutral-200 text-neutral-700",
  failed: "bg-red-100 text-red-900",
};

function StatusChip({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <span
      className={`px-2 py-0.5 font-mono text-[11px] uppercase ${STATUS_STYLE[status] ?? "bg-neutral-100 text-neutral-600"}`}
    >
      {status}
    </span>
  );
}

function StatusCard({ name, ok, note }: { name: string; ok: boolean | null; note: string }) {
  const dot = ok === null ? "bg-neutral-300" : ok ? "bg-emerald-600" : "bg-[#c4552f]";
  const text = ok === null ? "Unknown" : ok ? "Operational" : "Down";
  return (
    <div className="flex items-center gap-4 border border-neutral-200 bg-white px-5 py-4">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      <div>
        <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          {name}
        </div>
        <div className="text-sm font-medium">
          {text}
          <span className="ml-2 font-normal text-neutral-500">{note}</span>
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  total,
  color,
  chip,
  hint,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  chip?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2" title={hint}>
      {chip && <span className="h-2 w-2 shrink-0" style={{ background: chip }} />}
      <span className="w-24 shrink-0 truncate text-sm">{label}</span>
      <div className="h-1.5 min-w-0 flex-1 bg-neutral-100">
        <div
          className="h-full"
          style={{ width: `${total ? (value / total) * 100 : 0}%`, background: color }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-neutral-600">
        {value}
      </span>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  children,
}: {
  label: string;
  value?: string | number;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-200 bg-white px-5 py-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      {value !== undefined && (
        <div className="mt-2 text-[40px] font-semibold leading-none tabular-nums">{value}</div>
      )}
      {sub && <div className="mt-2.5 text-sm text-neutral-600">{sub}</div>}
      {children}
    </div>
  );
}

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Link href={href} className="text-sm text-[var(--accent)] underline underline-offset-4">
        open →
      </Link>
    </div>
  );
}

const TILES = "mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-3";

export default function OverviewPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [apiDown, setApiDown] = useState(false);
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [tech, setTech] = useState<TechResponse | null>(null);
  const [scoring, setScoring] = useState<ScoringOverview | null>(null);
  const [scoringRuns, setScoringRuns] = useState<ScoringRun[] | null>(null);
  const [povs, setPovs] = useState<PovsResponse | null>(null);
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    fetchJson<Health>("/api/health")
      .then(setHealth)
      .catch(() => setApiDown(true));
    fetchJson<SourcesResponse>("/api/sources").then(setData).catch(setError);
    fetchJson<{ runs: Run[] }>("/api/runs").then((d) => setRuns(d.runs)).catch(() => {});
    fetchJson<TechResponse>("/api/technologies?limit=1").then(setTech).catch(() => {});
    fetchJson<ScoringOverview>("/api/scoring/overview").then(setScoring).catch(() => {});
    fetchJson<{ scoring_runs: ScoringRun[] }>("/api/scoring/runs")
      .then((d) => setScoringRuns(d.scoring_runs))
      .catch(() => {});
    fetchJson<PovsResponse>("/api/scoring/povs").then(setPovs).catch(() => {});
    fetchJson<{ prompts: Skill[] }>("/api/prompts").then((d) => setSkills(d.prompts)).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const s = data.sources;
    const byHorizon = Object.fromEntries(
      HORIZONS.map((h) => [h, s.filter((x) => x.horizon === h).length])
    );
    const byCost: Record<string, number> = {};
    for (const x of s) byCost[x.cost] = (byCost[x.cost] ?? 0) + 1;
    return {
      total: s.length,
      enabled: s.filter((x) => x.enabled).length,
      byHorizon,
      byCost,
    };
  }, [data]);

  const latestRun = runs?.[0];
  const latestScoring = scoringRuns?.[0];
  const techHorizons = tech?.summary?.horizons ?? {};
  const techHorizonTotal = HORIZONS.reduce((n, h) => n + (techHorizons[h] ?? 0), 0);

  return (
    <div>
      <PageHeader eyebrow="Overview" title="Radar at a glance">
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          Health of the Tech Atlas service and a summary of every register —
          scout runs, sources, technologies, scoring and skills.
        </p>
      </PageHeader>

      {error != null && <BackendError error={error} />}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Service health</h2>
        <div className="mt-3 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
          <StatusCard
            name="Tech Atlas API"
            ok={apiDown ? false : health ? true : null}
            note={apiDown ? "nothing answered on port 8100" : "port 8100"}
          />
          <StatusCard
            name="MongoDB"
            ok={apiDown ? null : health ? health.mongo : null}
            note={apiDown ? "unknown while the API is down" : "via /api/health"}
          />
        </div>
      </section>

      {runs && (
        <section className="mt-10">
          <SectionHead title="Runs" href="/admin/runs" />
          <div className={TILES}>
            <Tile
              label="Scout runs"
              value={runs.length}
              sub={
                latestRun ? (
                  <span className="flex flex-wrap items-center gap-2">
                    latest <StatusChip status={latestRun.status} />
                    {(latestRun.status === "running" || latestRun.status === "terminating") &&
                      latestRun.stage && (
                        <span className="font-mono text-xs text-[#7a3c1e]">{latestRun.stage}</span>
                      )}
                  </span>
                ) : (
                  "no runs yet"
                )
              }
            />
            <Tile
              label="Pages visited"
              value={(latestRun?.totals?.pages_visited ?? 0).toLocaleString()}
              sub="in the latest run"
            />
            <Tile
              label="Documents"
              value={(latestRun?.totals?.documents ?? 0).toLocaleString()}
              sub={`${(latestRun?.totals?.new_documents ?? 0).toLocaleString()} new in the latest run`}
            />
            <Tile
              label="Latest run started"
              sub={latestRun ? formatTime(latestRun.run_start_date_time) : "—"}
            />
          </div>
        </section>
      )}

      {stats && (
        <section className="mt-10">
          <SectionHead title="Sources" href="/admin/sources" />
          <div className={TILES}>
            <Tile
              label="In the register"
              value={stats.total}
              sub={`${stats.enabled} enabled · ${stats.total - stats.enabled} disabled`}
            >
              <div className="mt-2 h-1.5 bg-neutral-100">
                <div
                  className="h-full"
                  style={{
                    width: `${stats.total ? (stats.enabled / stats.total) * 100 : 0}%`,
                    background: ACCENT,
                  }}
                />
              </div>
            </Tile>

            <Tile label="By horizon">
              <div className="mt-1">
                {HORIZONS.map((h) => (
                  <BreakdownRow
                    key={h}
                    label={h}
                    hint={`${data?.horizons[h]?.label ?? h} — ${data?.horizons[h]?.meaning ?? ""}`}
                    value={stats.byHorizon[h]}
                    total={stats.total}
                    color={HORIZON_SHADES[h]}
                    chip={HORIZON_SHADES[h]}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                H1 known misses · H2 catchable inflections · H3 blind spots
              </p>
            </Tile>

            <Tile label="By cost">
              <div className="mt-1">
                {COSTS.map((c) => (
                  <BreakdownRow
                    key={c.key}
                    label={c.label}
                    value={stats.byCost[c.key] ?? 0}
                    total={stats.total}
                    color={ACCENT}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {(stats.byCost.free ?? 0) + (stats.byCost.free_tier ?? 0)} free ·{" "}
                {stats.byCost.licensed ?? 0} paid
              </p>
            </Tile>
          </div>
        </section>
      )}

      {tech && (
        <section className="mt-10">
          <SectionHead title="Technologies" href="/admin/technologies" />
          <div className={TILES}>
            <Tile
              label="In the register"
              value={(tech.summary?.tech_count ?? tech.total).toLocaleString()}
              sub="resolved, deduplicated technologies"
            />
            <Tile
              label="Tagged documents"
              value={(tech.summary?.tagged_docs ?? 0).toLocaleString()}
              sub="stamped with canonical names"
            />
            <Tile label="By horizon">
              <div className="mt-1">
                {HORIZONS.map((h) => (
                  <BreakdownRow
                    key={h}
                    label={h}
                    value={techHorizons[h] ?? 0}
                    total={techHorizonTotal}
                    color={HORIZON_SHADES[h]}
                    chip={HORIZON_SHADES[h]}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-neutral-500">technologies carrying a horizon tag</p>
            </Tile>
            <Tile
              label="Last resolve"
              sub={
                tech.last_resolve ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusChip status={tech.last_resolve.status} />
                    <span className="font-mono text-xs text-neutral-500">
                      {tech.last_resolve.phase ?? ""}
                    </span>
                  </span>
                ) : (
                  "no resolve yet"
                )
              }
            />
          </div>
        </section>
      )}

      {(scoring || scoringRuns || povs) && (
        <section className="mt-10">
          <SectionHead title="Scoring" href="/admin/scoring" />
          <div className={TILES}>
            {scoring && (
              <Tile
                label="Framework"
                value={scoring.measures.total}
                sub={`measures across 3 TORA axes · ${scoring.fabrics.enabled} of ${scoring.fabrics.total} fabrics enabled`}
              />
            )}
            <Tile
              label="Latest scoring run"
              value={
                latestScoring
                  ? `${latestScoring.progress.techs_done}/${latestScoring.progress.techs_total}`
                  : "—"
              }
              sub={
                latestScoring ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusChip status={latestScoring.status} />
                    <span className="font-mono text-xs text-neutral-500">
                      {latestScoring.progress.llm_calls.toLocaleString()} LLM calls
                    </span>
                  </span>
                ) : (
                  "technologies assessed"
                )
              }
            />
            {povs && (
              <Tile
                label="Points of view"
                value={povs.povs.length}
                sub={
                  povs.job?.status === "running"
                    ? `composing — ${povs.job.done}/${povs.job.total}`
                    : `composed · ${povs.uncomposed.length} pending`
                }
              />
            )}
          </div>
        </section>
      )}

      {skills && (
        <section className="mt-10">
          <SectionHead title="Skills" href="/admin/prompts" />
          <div className={TILES}>
            <Tile
              label="In the library"
              value={skills.length}
              sub={`${skills.filter((s) => s.enabled).length} enabled · versioned, editable, fetched at runtime`}
            />
            <Tile label="By name">
              <div className="mt-2 flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <Link
                    key={s.name}
                    href={`/admin/prompts/${s.name}`}
                    title={s.description}
                    className="bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-700 hover:bg-[#8a4b2d]/10 hover:text-[#7a3c1e]"
                  >
                    {s.name} <span className="text-neutral-400">v{s.version}</span>
                  </Link>
                ))}
              </div>
            </Tile>
          </div>
        </section>
      )}
    </div>
  );
}
