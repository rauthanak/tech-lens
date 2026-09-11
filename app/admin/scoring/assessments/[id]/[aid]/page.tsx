"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { fetchJson } from "@/lib/api";
import { formatTime } from "@/lib/format";

type MeasureResult = {
  code: string;
  score: number | null;
  justification: string | null;
  evidence_urls: string[];
  counter_case: string | null;
  unscorable: boolean;
  missing: string | null;
};

type WatchMetric = {
  metric: string;
  current_value?: string;
  inflection_threshold?: string;
  direction?: string;
  implication?: string;
};

type Assessment = {
  _id: string;
  technology: string;
  tech_id: string;
  fabric: string;
  doc_count: number;
  tora: Record<string, { score: number | null; scored: number; of: number; partial: boolean }>;
  placement?: {
    timeline: { score: number | null; band: string | null; scored: number; of: number; partial: boolean };
    potential: { score: number | null; band: string | null; scored: number; of: number; partial: boolean };
    disruptiveness: { score: number | null; band: string | null };
    priority: string | null;
    priority_by_disruptiveness: string | null;
    horizon: string | null;
  };
  watch_metrics?: WatchMetric[];
  tora_basis: string;
  created_at: string;
  measures: Record<string, MeasureResult>;
};

const PRIORITY_STYLE: Record<string, { bg: string; ink: string }> = {
  P1: { bg: "#8a4b2d", ink: "#ffffff" },
  P2: { bg: "#a97253", ink: "#ffffff" },
  P3: { bg: "#c49579", ink: "#171513" },
  P4: { bg: "#dcb9a2", ink: "#171513" },
  P5: { bg: "#eed8c8", ink: "#171513" },
  P6: { bg: "#f8efe7", ink: "#171513" },
};

type Doc = {
  id: string;
  end_url: string;
  title?: string | null;
  kind?: string;
  source_id?: string;
  published_date?: string | null;
  scraped_at: string;
  summary_text?: string | null;
};

const AXES: { key: string; label: string }[] = [
  { key: "market_potential", label: "Market Potential" },
  { key: "strategic_fit", label: "Strategic Fit" },
  { key: "adoption_readiness", label: "Adoption Readiness" },
];

function scoreShade(score: number | null): string {
  if (score == null) return "bg-neutral-100 text-neutral-400";
  if (score >= 7) return "bg-[#8a4b2d] text-white";
  if (score >= 4) return "bg-[#dcb9a2] text-[#171513]";
  return "bg-[#f8efe7] text-[#171513]";
}

export default function AssessmentPage() {
  const { id, aid } = useParams<{ id: string; aid: string }>();
  const [a, setA] = useState<Assessment | null>(null);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    fetchJson<Assessment>(`/api/scoring/runs/${id}/assessments/${aid}`)
      .then(setA)
      .catch(setError);
  }, [id, aid]);

  const loadDocs = useCallback(
    (skip: number, techId: string) =>
      fetchJson<{ documents: Doc[]; total: number }>(
        `/api/technologies/${techId}/documents?sort=published&limit=50&skip=${skip}`,
      )
        .then((d) => {
          setDocs((prev) => (skip === 0 ? d.documents : [...(prev ?? []), ...d.documents]));
          setTotal(d.total);
        })
        .catch(setError),
    [],
  );

  useEffect(() => {
    if (a) loadDocs(0, a.tech_id);
  }, [a, loadDocs]);

  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow={`Assessment · ${a?.fabric ?? ""}`} title={a?.technology ?? "…"}>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          <Link href={`/admin/scoring/assessments/${id}`}
            className="text-[var(--accent)] underline underline-offset-4">
            back to run
          </Link>
          {a && (
            <Link href={`/admin/scoring/pov/${id}/${a.tech_id}`}
              className="text-[var(--accent)] underline underline-offset-4">
              Point of View →
            </Link>
          )}
          {a && (
            <span className="font-mono text-xs text-neutral-500">
              {a.doc_count} evidence docs · {a.tora_basis} · {formatTime(a.created_at)}
            </span>
          )}
        </p>
      </PageHeader>

      {error != null && <BackendError error={error} />}

      {a && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {AXES.map(({ key, label }) => {
              const ax = a.tora?.[key];
              return (
                <div key={key} className="border border-neutral-200 bg-white px-5 py-4">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    {label}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className={`px-2.5 py-1 font-mono text-xl tabular-nums ${scoreShade(ax?.score ?? null)}`}>
                      {ax?.score ?? "—"}
                    </span>
                    {ax?.partial && (
                      <span className="font-mono text-[11px] text-amber-700">
                        partial — {ax.scored} of {ax.of} measures scored
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="border border-dashed border-neutral-300 bg-neutral-50 px-5 py-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500"
                title="scored alongside TORA, never averaged in — X1/X2 feed the priority grid's potential, X3 the PoV">
                Outside TORA
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(a.measures)
                  .filter(([, m]) => m.code.startsWith("X"))
                  .sort(([, x], [, y]) => x.code.localeCompare(y.code))
                  .map(([mid, m]) => (
                    <span key={mid} className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-neutral-500">{m.code}</span>
                      <span className={`px-1.5 py-0.5 font-mono text-sm tabular-nums ${scoreShade(m.score)}`}>
                        {m.score ?? "—"}
                      </span>
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {a.placement && (
            <section className="mt-6 border border-neutral-200 bg-white px-5 py-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                Placement — deterministic, recomputes free when cut-points change
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-neutral-500">Priority</span>
                  {a.placement.priority ? (
                    <span className="px-2.5 py-1 font-mono text-base"
                      style={{ background: PRIORITY_STYLE[a.placement.priority]?.bg, color: PRIORITY_STYLE[a.placement.priority]?.ink }}>
                      {a.placement.priority}
                    </span>
                  ) : <span className="font-mono text-neutral-400">—</span>}
                  {a.placement.priority_by_disruptiveness &&
                    a.placement.priority_by_disruptiveness !== a.placement.priority && (
                    <span className="font-mono text-[11px] text-neutral-500"
                      title="the alternative grid view — vertical axis = disruption threat">
                      ({a.placement.priority_by_disruptiveness} by disruptiveness)
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-neutral-500">Horizon</span>
                  <span className="bg-neutral-100 px-2 py-0.5 font-mono">{a.placement.horizon ?? "—"}</span>
                </span>
                <span className="font-mono text-xs text-neutral-600">
                  how soon: {a.placement.timeline.score ?? "—"} ({a.placement.timeline.band ?? "?"}
                  {a.placement.timeline.partial && `, ${a.placement.timeline.scored}/${a.placement.timeline.of} scored`})
                </span>
                <span className="font-mono text-xs text-neutral-600">
                  how big: {a.placement.potential.score ?? "—"} ({a.placement.potential.band ?? "?"}
                  {a.placement.potential.partial && `, ${a.placement.potential.scored}/${a.placement.potential.of} scored`})
                </span>
              </div>
            </section>
          )}

          {(a.watch_metrics?.length ?? 0) > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold">Metrics to watch</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Checkable predictions — a later run can verify each one. Crossing
                a threshold changes this technology&apos;s story.
              </p>
              <div className="mt-3 divide-y divide-neutral-100 border border-neutral-200 bg-white">
                {a.watch_metrics!.map((m, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-sm font-medium leading-snug">{m.metric}</span>
                      {m.direction && (
                        <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-neutral-500">
                          watching it {m.direction === "rising" ? "rise ↑" : m.direction === "falling" ? "fall ↓" : m.direction}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 grid gap-x-6 gap-y-1 text-sm text-neutral-600 sm:grid-cols-2">
                      {m.current_value && (
                        <p><span className="font-mono text-[11px] uppercase text-neutral-500">now </span>{m.current_value}</p>
                      )}
                      {m.inflection_threshold && (
                        <p><span className="font-mono text-[11px] uppercase text-neutral-500">inflection </span>{m.inflection_threshold}</p>
                      )}
                    </div>
                    {m.implication && (
                      <p className="mt-1 text-sm text-neutral-600">
                        <span className="font-mono text-[11px] uppercase text-neutral-500">if crossed </span>
                        {m.implication}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-7">
            <h2 className="text-lg font-semibold">The measures</h2>
            <div className="mt-3 space-y-3">
              {Object.entries(a.measures)
                .sort(([, x], [, y]) => x.code.localeCompare(y.code))
                .map(([mid, m]) => (
                  <div key={mid} className="border border-neutral-200 bg-white px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-neutral-500">{m.code}</span>
                      <span className={`px-2 py-0.5 font-mono text-sm tabular-nums ${scoreShade(m.score)}`}>
                        {m.score ?? "—"}
                      </span>
                      <span className="font-mono text-xs text-neutral-500">{mid.replace(/-/g, " ")}</span>
                      {m.unscorable && (
                        <span className="bg-amber-100 px-2 py-0.5 font-mono text-[11px] uppercase text-amber-900">
                          unscorable
                        </span>
                      )}
                    </div>
                    {m.justification && (
                      <p className="mt-2.5 text-sm leading-relaxed text-neutral-700">{m.justification}</p>
                    )}
                    {m.unscorable && m.missing && (
                      <p className="mt-2 text-sm text-amber-800">
                        <span className="font-mono text-[11px] uppercase">what would resolve it: </span>
                        {m.missing}
                      </p>
                    )}
                    {m.counter_case && (
                      <p className="mt-2 border-l-2 border-neutral-200 pl-3 text-sm leading-relaxed text-neutral-600">
                        <span className="font-mono text-[11px] uppercase text-neutral-500">counter-case </span>
                        {m.counter_case}
                      </p>
                    )}
                    {m.evidence_urls.length > 0 && (
                      <div className="mt-2.5">
                        <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                          cited by the scorer
                        </div>
                        <div className="mt-1 flex flex-col gap-0.5">
                          {m.evidence_urls.map((u) => (
                            <a key={u} href={u} target="_blank" rel="noreferrer"
                              className="break-all font-mono text-xs text-[var(--accent)] hover:underline">
                              {u}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">The evidence dossier</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Every document behind this assessment — all {total} were in the
              dossier the scorer read, newest published first (undated ones
              last, by extraction date). The links on each measure above are the
              subset the scorer cited.
            </p>
            {docs && (
              <div className="mt-3 divide-y divide-neutral-100 border border-neutral-200 bg-white">
                {docs.map((d) => (
                  <div key={d.id} className="px-5 py-3">
                    <div className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {d.title || d.end_url.replace(/^https?:\/\//, "")}
                      </span>
                      <span className="shrink-0 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] uppercase text-neutral-600">
                        {d.kind ?? "article"}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-neutral-500">
                        {d.published_date || `extracted ${String(d.scraped_at).slice(0, 10)}`}
                      </span>
                    </div>
                    <a href={d.end_url} target="_blank" rel="noreferrer"
                      className="mt-0.5 block truncate font-mono text-xs text-[var(--accent)] hover:underline">
                      {d.end_url}
                    </a>
                  </div>
                ))}
              </div>
            )}
            {docs && docs.length < total && (
              <button
                onClick={() => loadDocs(docs.length, a.tech_id)}
                className="mt-3 border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-100"
              >
                Load more ({docs.length} of {total})
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
