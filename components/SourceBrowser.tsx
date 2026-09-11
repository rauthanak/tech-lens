"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import BackendError from "@/components/BackendError";
import { fetchJson } from "@/lib/api";

type SourceRow = {
  source_id: string;
  name: string;
  url: string;
  horizon: "H1" | "H2" | "H3";
  cluster: string;
  cost: string;
  enabled: boolean;
};

type SourcesResponse = {
  horizons: Record<string, { label?: string; meaning?: string }>;
  sources: SourceRow[];
};

const COST_LABELS: Record<string, string> = {
  free: "Free",
  free_tier: "Free tier",
  licensed: "Licensed",
};

const pretty = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

type SortKey = "name" | "cluster" | "cost" | "enabled";
type Sort = { key: SortKey; dir: 1 | -1 } | null;

const sortValue = (s: SourceRow, key: SortKey): string | number => {
  if (key === "enabled") return s.enabled ? 1 : 0;
  if (key === "cost") return COST_LABELS[s.cost] ?? s.cost;
  return s[key].toLowerCase();
};

export const filterSegment = (
  active: boolean
) =>
  `px-3 py-1.5 ${active ? "bg-[#1c1a17] font-medium text-white" : "hover:bg-neutral-100"}`;

/** The source register list with search, horizon/cost/enabled filters and
 * sortable columns — shared by the reader (/) and admin (/admin/sources)
 * endpoints. */
export default function SourceBrowser() {
  const router = useRouter();
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState("");
  const [horizon, setHorizon] = useState<string>("all");
  const [cost, setCost] = useState<string>("all");
  const [enabled, setEnabled] = useState<string>("all");
  const [sort, setSort] = useState<Sort>(null);

  useEffect(() => {
    fetchJson<SourcesResponse>("/api/sources").then(setData).catch(setError);
  }, []);

  const costOptions = useMemo(() => {
    if (!data) return [];
    const known = Object.keys(COST_LABELS);
    const seen = [...new Set(data.sources.map((s) => s.cost))];
    return [...known.filter((c) => seen.includes(c)), ...seen.filter((c) => !known.includes(c))];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.sources.filter(
      (s) =>
        (horizon === "all" || s.horizon === horizon) &&
        (cost === "all" || s.cost === cost) &&
        (enabled === "all" || s.enabled === (enabled === "on")) &&
        (!q ||
          s.name.toLowerCase().includes(q) ||
          s.source_id.toLowerCase().includes(q) ||
          s.cluster.toLowerCase().includes(q))
    );
  }, [data, query, horizon, cost, enabled]);

  const sortRows = (rows: SourceRow[]) => {
    if (!sort) return rows;
    const { key, dir } = sort;
    return [...rows].sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  };

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: 1 }
    );

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th className="px-4 py-2.5 font-medium">
      <button
        onClick={() => toggleSort(k)}
        className="flex items-center gap-1 uppercase tracking-wider hover:text-neutral-800"
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        <span className={sort?.key === k ? "" : "text-neutral-300"}>
          {sort?.key === k && sort.dir === -1 ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );

  return (
    <div>
      {error != null && <BackendError error={error} />}

      {data && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or cluster…"
              className="w-64 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
            />
            <div className="flex overflow-hidden rounded border border-neutral-300 bg-white text-sm">
              {["all", "H1", "H2", "H3"].map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={filterSegment(horizon === h)}
                >
                  {h === "all" ? "All horizons" : h}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded border border-neutral-300 bg-white text-sm">
              {["all", ...costOptions].map((c) => (
                <button
                  key={c}
                  onClick={() => setCost(c)}
                  className={filterSegment(cost === c)}
                >
                  {c === "all" ? "All costs" : COST_LABELS[c] ?? pretty(c)}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded border border-neutral-300 bg-white text-sm">
              {[
                ["all", "All"],
                ["on", "Enabled"],
                ["off", "Disabled"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setEnabled(value)}
                  className={filterSegment(enabled === value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="font-mono text-xs text-neutral-500">
              {filtered.length} of {data.sources.length}
            </span>
          </div>

          {(horizon === "all" ? ["H1", "H2", "H3"] : [horizon]).map((h) => {
            const rows = sortRows(filtered.filter((s) => s.horizon === h));
            if (rows.length === 0) return null;
            const meta = data.horizons[h];
            return (
              <section key={h} className="mt-8">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-lg font-semibold">
                    {h} — {meta?.label ?? h}
                  </h2>
                  <span className="text-xs text-neutral-500">{meta?.meaning}</span>
                </div>
                <div className="mt-3 overflow-x-auto border border-neutral-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-left font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                        <SortHeader label="Source" k="name" />
                        <th className="px-4 py-2.5 font-medium">Horizon</th>
                        <SortHeader label="Cluster" k="cluster" />
                        <SortHeader label="Cost" k="cost" />
                        <SortHeader label="Enabled" k="enabled" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {rows.map((s) => (
                        <tr
                          key={s.source_id}
                          onClick={() => router.push(`/admin/sources/${s.source_id}`)}
                          className="cursor-pointer hover:bg-neutral-50"
                        >
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{s.name}</div>
                            <div className="font-mono text-xs text-neutral-500">
                              {s.url}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">{s.horizon}</td>
                          <td className="px-4 py-2.5">{pretty(s.cluster)}</td>
                          <td className="px-4 py-2.5">{COST_LABELS[s.cost] ?? s.cost}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                s.enabled ? "bg-emerald-600" : "bg-neutral-300"
                              }`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
