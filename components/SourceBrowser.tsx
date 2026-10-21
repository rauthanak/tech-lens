"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import BackendError from "@/components/BackendError";
import { fetchJson } from "@/lib/api";

type Progress = { search: string; remaining?: number; too_broad?: boolean };

type SourceRow = {
  source_id: string;
  name: string;
  url: string;
  horizon: "H1" | "H2" | "H3";
  cluster: string;
  cost: string;
  enabled: boolean;
  access?: "crawl" | "query" | "none";
  adapter?: string;
  note?: string;
  progress?: Progress[];
};

type AdapterInfo = { name: string; label: string };

const ACCESS_LABELS: Record<string, string> = { crawl: "Website", query: "Data source", none: "Not collected" };
const accessOf = (s: SourceRow) => s.access ?? "crawl";

/** "{n} still to collect" / "too broad" for a data source with a backlog. */
export function backlog(s: SourceRow): string | null {
  const remaining = (s.progress ?? []).reduce((n, p) => n + (p.remaining ?? 0), 0);
  const broad = (s.progress ?? []).some((p) => p.too_broad);
  const parts = [remaining > 0 ? `${remaining} still to collect` : "", broad ? "too broad" : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

type SourcesResponse = {
  horizons: Record<string, { label?: string; meaning?: string }>;
  sources: SourceRow[];
};

export const COST_LABELS: Record<string, string> = {
  free: "Free",
  free_tier: "Free up to a limit",
  licensed: "Paid subscription",
};

const pretty = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

// readable names for the kinds of source (the stored cluster ids); one not
// named here shows its id in words
const CLUSTER_NAMES: Record<string, string> = {
  analysts_trade_press: "Analysts and trade press",
  company_filings: "Company filings",
  conferences: "Conferences",
  corporate_research_vendor_events: "Corporate research and vendor events",
  government_funding: "Government funding",
  patents: "Patents",
  preprints_journals: "Preprints and journals",
  standards_foundations: "Standards bodies and foundations",
  talent: "Hiring",
  university_labs: "University labs",
  vc_startup_developer: "VC, startups and developers",
  web_search: "Web search",
};
/** A kind of source in words: "VC, startups and developers". */
export const clusterName = (id: string) => CLUSTER_NAMES[id] ?? pretty(id);

type SortKey = "name" | "cluster" | "cost" | "enabled";
type Sort = { key: SortKey; dir: 1 | -1 } | null;

const sortValue = (s: SourceRow, key: SortKey): string | number => {
  if (key === "enabled") return s.enabled ? 1 : 0;
  if (key === "cost") return COST_LABELS[s.cost] ?? s.cost;
  if (key === "cluster") return clusterName(s.cluster).toLowerCase();
  return s[key].toLowerCase();
};

export const filterSegment = (
  active: boolean
) =>
  `px-3 py-1.5 ${active ? "bg-navy font-medium text-white" : "hover:bg-neutral-100"}`;

/** Every source the radar knows, with search, horizon/cost/enabled filters
 * and sortable columns — shared by the reader (/) and admin (/admin/sources)
 * endpoints. */
export default function SourceBrowser() {
  const router = useRouter();
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState("");
  const [horizon, setHorizon] = useState<string>("all");
  const [cost, setCost] = useState<string>("all");
  // opens on the sources a collection visits; the rest are one click away
  const [enabled, setEnabled] = useState<string>("on");
  const [access, setAccess] = useState<string>("all");
  const [sort, setSort] = useState<Sort>(null);
  const [adapters, setAdapters] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchJson<SourcesResponse>("/api/sources").then(setData).catch(setError);
    fetchJson<AdapterInfo[]>("/api/sources/adapters")
      .then((list) => setAdapters(Object.fromEntries(list.map((a) => [a.name, a.label]))))
      .catch(() => {});
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
        (access === "all" || accessOf(s) === access) &&
        (!q ||
          s.name.toLowerCase().includes(q) ||
          s.source_id.toLowerCase().includes(q) ||
          clusterName(s.cluster).toLowerCase().includes(q))
    );
  }, [data, query, horizon, cost, enabled, access]);

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
          <p className="mt-4 text-sm text-muted">
            {data.sources.length} sources · {data.sources.filter((x) => x.enabled).length} switched on ·{" "}
            {data.sources.filter((x) => x.cost !== "licensed").length} free,{" "}
            {data.sources.filter((x) => x.cost === "licensed").length} paid
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or kind of source…"
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
                ["on", "Switched on"],
                ["off", "Switched off"],
                ["all", "All"],
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
            <div className="flex overflow-hidden rounded border border-neutral-300 bg-white text-sm">
              {[["all", "All"], ["crawl", "Website"], ["query", "Data source"], ["none", "Not collected"]].map(([value, label]) => (
                <button key={value} onClick={() => setAccess(value)} className={filterSegment(access === value)}>
                  {label}
                </button>
              ))}
            </div>
            <span className="font-mono text-xs text-neutral-500">
              {filtered.length} of {data.sources.length}
            </span>
            {enabled === "on" && (
              <button type="button" onClick={() => setEnabled("all")} className="text-sm text-link hover:underline">
                Show all {data.sources.length}
              </button>
            )}
          </div>

          {(horizon === "all" ? ["H1", "H2", "H3"] : [horizon]).map((h) => {
            const rows = sortRows(filtered.filter((s) => s.horizon === h));
            if (rows.length === 0) return null;
            const meta = data.horizons[h];
            return (
              <section key={h} className="mt-8">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-lg font-semibold">
                    {h} · {meta?.label ?? h}
                  </h2>
                  <span className="text-xs text-neutral-500">{meta?.meaning}</span>
                </div>
                <div className="mt-3 overflow-x-auto rounded-card border border-line bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-left font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                        <SortHeader label="Source" k="name" />
                        <th className="px-4 py-2.5 font-medium">How it&apos;s read</th>
                        <SortHeader label="Kind of source" k="cluster" />
                        <SortHeader label="Cost" k="cost" />
                        <SortHeader label="Switched on" k="enabled" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {rows.map((s) => {
                        const how = accessOf(s);
                        const owed = how === "query" ? backlog(s) : null;
                        return (
                          <tr
                            key={s.source_id}
                            onClick={() => router.push(`/admin/sources/${s.source_id}`)}
                            className="cursor-pointer hover:bg-neutral-50"
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap items-center gap-2 font-medium">
                                {s.name}
                                {owed && (
                                  <span className="bg-neutral-100 px-1.5 py-0.5 text-[11px] font-normal text-ink"
                                    title="The next collection carries on where it stopped. Raise the page budget or narrow the search to finish sooner.">
                                    Not finished: {owed}
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-xs text-neutral-500">
                                {s.url}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-sm" title={how === "none" ? s.note : undefined}>
                              {how === "none" && <span aria-hidden className="mr-1">🔒</span>}
                              {ACCESS_LABELS[how]}
                              {how === "query" && s.adapter && (
                                <span className="block font-mono text-[11px] text-neutral-500">{adapters[s.adapter] ?? s.adapter}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">{clusterName(s.cluster)}</td>
                            <td className="px-4 py-2.5">{COST_LABELS[s.cost] ?? s.cost}</td>
                            <td className="px-4 py-2.5">
                              {how === "none" ? (
                                <span className="font-mono text-[11px] text-neutral-400">not collectable</span>
                              ) : (
                                <span
                                  className={`inline-block h-2 w-2 rounded-full ${
                                    s.enabled ? "bg-azure" : "bg-neutral-300"
                                  }`}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
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
