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

/** The source register list with search and horizon filter — shared by the
 * reader (/) and admin (/admin/sources) endpoints. */
export default function SourceBrowser() {
  const router = useRouter();
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState("");
  const [horizon, setHorizon] = useState<string>("all");

  useEffect(() => {
    fetchJson<SourcesResponse>("/api/sources").then(setData).catch(setError);
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.sources.filter(
      (s) =>
        (horizon === "all" || s.horizon === horizon) &&
        (!q ||
          s.name.toLowerCase().includes(q) ||
          s.source_id.toLowerCase().includes(q) ||
          s.cluster.toLowerCase().includes(q))
    );
  }, [data, query, horizon]);

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
                  className={`px-3 py-1.5 ${
                    horizon === h
                      ? "bg-[#1c1a17] font-medium text-white"
                      : "hover:bg-neutral-100"
                  }`}
                >
                  {h === "all" ? "All horizons" : h}
                </button>
              ))}
            </div>
            <span className="font-mono text-xs text-neutral-500">
              {filtered.length} of {data.sources.length}
            </span>
          </div>

          {(horizon === "all" ? ["H1", "H2", "H3"] : [horizon]).map((h) => {
            const rows = filtered.filter((s) => s.horizon === h);
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
                        <th className="px-4 py-2.5 font-medium">Source</th>
                        <th className="px-4 py-2.5 font-medium">Horizon</th>
                        <th className="px-4 py-2.5 font-medium">Cluster</th>
                        <th className="px-4 py-2.5 font-medium">Cost</th>
                        <th className="px-4 py-2.5 font-medium">Enabled</th>
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
