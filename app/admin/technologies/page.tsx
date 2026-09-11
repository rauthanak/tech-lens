"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { ApiError, fetchJson, sendJson } from "@/lib/api";

type Tech = {
  _id: string;
  name: string;
  enabled: boolean;
  aliases: string[];
  doc_count?: number;
  page_count?: number;
  source_count?: number;
  horizons?: Record<string, number>;
};

type Resolve = {
  _id: string;
  status: string;
  phase?: string;
  llm_calls?: number;
  raw_strings?: number;
  technologies?: number;
  docs_stamped?: number;
  started_at: string;
  error?: string;
};

type Payload = {
  technologies: Tech[];
  total: number;
  summary: { tech_count: number; tagged_docs: number; kinds: Record<string, number>; horizons: Record<string, number> };
  last_resolve: Resolve | null;
};

const PAGE = 100;
const HORIZON_ORDER = ["H1", "H2", "H3"];

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-neutral-200 bg-white px-5 py-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-[26px] font-semibold leading-tight">{value}</div>
      {sub && <div className="mt-0.5 font-mono text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

export default function TechnologiesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [rows, setRows] = useState<Tech[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    (skip: number, q: string) =>
      fetchJson<Payload>(
        `/api/technologies?limit=${PAGE}&skip=${skip}&q=${encodeURIComponent(q)}`,
      )
        .then((d) => {
          setData(d);
          setRows((prev) => (skip === 0 ? d.technologies : [...prev, ...d.technologies]));
          setRefreshedAt(new Date());
        })
        .catch(setError),
    [],
  );

  useEffect(() => {
    load(0, debouncedQ);
  }, [debouncedQ, load]);

  // while a resolve runs, silently refresh the first page
  const running = data?.last_resolve?.status === "running";
  useEffect(() => {
    if (running && !timer.current) {
      timer.current = setInterval(() => load(0, debouncedQ), 5000);
    }
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
  }, [running, debouncedQ, load]);

  async function triggerResolve() {
    setNotice(null);
    try {
      await sendJson("/api/technologies/resolve", "POST", {});
      setNotice("resolve started");
      load(0, debouncedQ);
    } catch (e) {
      setNotice(e instanceof ApiError ? (e.detail ?? e.message) : "failed to start");
    }
  }

  const r = data?.last_resolve;

  return (
    <div>
      <PageHeader eyebrow="Technologies" title="What the scouts actually found">
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          The canonical technology register — raw tags from every document,
          cleaned and merged by the resolver. Click a technology for its
          documents and aliases, or to merge it with another.
        </p>
      </PageHeader>

      {error != null && <BackendError error={error} />}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={triggerResolve}
          disabled={running}
          className="bg-[#171513] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
        >
          {running ? "Resolving…" : "Run resolve"}
        </button>
        {r && (
          <span className="font-mono text-xs text-neutral-500">
            {r.status === "running"
              ? `${r.phase ?? "running"} · ${r.llm_calls ?? 0} LLM calls`
              : `last resolve ${r.status}${r.status === "completed" ? ` · ${r.raw_strings} raw → ${r.technologies} technologies · ${r.docs_stamped} docs stamped` : ""}`}
          </span>
        )}
        {r?.status === "failed" && (
          <span className="font-mono text-xs text-[#7a3c1e]">{r.error}</span>
        )}
        {notice && <span className="font-mono text-xs text-[#7a3c1e]">{notice}</span>}
        <span className="ml-auto flex items-center gap-2 font-mono text-xs text-neutral-500">
          {refreshedAt && <span>refreshed {refreshedAt.toLocaleTimeString()}</span>}
          <button
            onClick={() => load(0, debouncedQ)}
            title="refresh now"
            className="border border-neutral-300 px-2 py-1 hover:bg-neutral-100"
          >
            ↻
          </button>
        </span>
      </div>

      {data && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Technologies" value={String(data.summary.tech_count)} />
            <Tile label="Tagged documents" value={String(data.summary.tagged_docs)} />
            <Tile
              label="Articles / PDFs"
              value={`${data.summary.kinds["article"] ?? 0} / ${data.summary.kinds["pdf"] ?? 0}`}
            />
            <Tile
              label="By horizon"
              value={HORIZON_ORDER.map((h) => data.summary.horizons[h] ?? 0).join(" · ")}
              sub="H1 · H2 · H3"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-baseline gap-3">
            <input
              className="w-full max-w-md rounded border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
              placeholder="search technologies and aliases…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="font-mono text-xs text-neutral-500">
              {data.total} match{data.total === 1 ? "" : "es"}
            </span>
          </div>

          <div className="mt-3 divide-y divide-neutral-100 border border-neutral-200 bg-white">
            <div className="flex items-center gap-4 px-5 py-2 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
              <span className="flex-1">Technology</span>
              <span className="w-16 text-right">Docs</span>
              <span className="w-16 text-right">Pages</span>
              <span className="w-16 text-right">Sources</span>
              <span className="w-24 text-right">H1 · H2 · H3</span>
            </div>
            {rows.map((t) => (
              <Link
                key={t._id}
                href={`/admin/technologies/${t._id}`}
                className="flex items-center gap-4 px-5 py-2.5 hover:bg-neutral-50"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className={`font-medium ${t.enabled ? "" : "text-neutral-400 line-through"}`}>
                    {t.name}
                  </span>
                  {t.aliases.length > 1 && (
                    <span className="ml-2 font-mono text-[11px] text-neutral-400">
                      +{t.aliases.length - 1} alias{t.aliases.length > 2 ? "es" : ""}
                    </span>
                  )}
                </span>
                <span className="w-16 text-right font-mono text-xs tabular-nums">{t.doc_count ?? 0}</span>
                <span className="w-16 text-right font-mono text-xs tabular-nums">{t.page_count ?? 0}</span>
                <span className="w-16 text-right font-mono text-xs tabular-nums">{t.source_count ?? 0}</span>
                <span className="w-24 text-right font-mono text-xs tabular-nums text-neutral-500">
                  {HORIZON_ORDER.map((h) => t.horizons?.[h] ?? 0).join(" · ")}
                </span>
              </Link>
            ))}
            {rows.length === 0 && (
              <p className="px-5 py-6 text-sm text-neutral-500">
                {data.summary.tech_count === 0
                  ? "No technologies yet — run a resolve."
                  : "Nothing matches the search."}
              </p>
            )}
          </div>
          {rows.length < data.total && (
            <button
              onClick={() => load(rows.length, debouncedQ)}
              className="mt-3 border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-100"
            >
              Load more ({rows.length} of {data.total})
            </button>
          )}
        </>
      )}
    </div>
  );
}
