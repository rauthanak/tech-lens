"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import BackLink from "@/components/BackLink";
import EvidenceLine from "@/components/EvidenceLine";
import FabricLabel from "@/components/FabricLabel";
import PageHeader from "@/components/PageHeader";
import WatchMetrics, { type WatchMetric } from "@/components/WatchMetrics";
import { fetchJson } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { useHere, withFrom } from "@/lib/here";
import { formatScore, noPriorityReason } from "@/lib/scoring";
import { useTechLabel } from "@/lib/tech-labels";
import { PRIORITY, scoreShade } from "@/lib/theme";

type MeasureResult = {
  code: string;
  score: number | null;
  justification: string | null;
  evidence_urls: string[];
  counter_case: string | null;
  unscorable: boolean;
  missing: string | null;
};

type Assessment = {
  _id: string;
  technology: string;
  tech_id: string;
  fabric: string;
  fabric_id: string;
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
  evidence_runs?: string[];
  measures: Record<string, MeasureResult>;
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

/** How solid a headline score is, in words. */
function scoredLine(ax: { score: number | null; scored: number; of: number }): string {
  if (ax.score == null) return `Not enough evidence: 0 of ${ax.of} measures scored`;
  return ax.scored < ax.of ? `Partial: ${ax.scored} of ${ax.of} measures scored` : `All ${ax.of} measures scored`;
}

/** One of the two things the priority is worked out from, in words. */
function composite(label: string, c: { score: number | null; band: string | null; scored: number; of: number }): string {
  return c.score == null ? `${label}: not enough evidence (0 of ${c.of} inputs scored)`
    : `${label}: ${formatScore(c.score)}${c.band ? `, ${c.band}` : ""} (${c.scored} of ${c.of} inputs scored)`;
}

function AssessmentDetail() {
  const { id, aid } = useParams<{ id: string; aid: string }>();
  const here = useHere();
  const label = useTechLabel();
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
    <div>
      <BackLink fallback={`/admin/scoring/assessments/${id}`} />
      <PageHeader eyebrow="Assessment" title={a ? label(a.technology) : "…"}
        intro="How this technology scored in one fabric, and why, measure by measure."
        help={<>
          <li>The top cards are the three headline scores (0–10), each the weighted average of its measures. Under
            each: how many of its measures had enough evidence. A measure without enough evidence is left out, never
            counted as zero; with none, there&apos;s no score.</li>
          <li>Other measures are scored alongside: they feed the priority and the Point of View instead of the three
            scores.</li>
          <li>Placement gives the priority (P1 act now to P6 just watch) and the horizon (H1 near to H3 far), worked
            out from how soon it arrives and how big the prize is, with no model calls. Without enough evidence on
            either, it says so.</li>
          <li>Metrics to watch are suggested by the assessment. Nothing tracks them automatically: the next
            assessment checks them.</li>
          <li>The measures: each score with its justification, the strongest case against it and the pages the
            scorer cited. Below them, the pages linked to the technology today.</li>
        </>}>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          {a && <FabricLabel id={a.fabric_id} name={a.fabric} />}
          {a && (
            <Link href={withFrom(`/admin/technologies/${a.tech_id}`, here)} className="text-link hover:underline">
              Technology →
            </Link>
          )}
          {a && (
            <Link href={withFrom(`/admin/scoring/pov/${id}/${a.tech_id}`, here)} className="text-link hover:underline">
              Point of View →
            </Link>
          )}
          <Link href={`/admin/scoring/assessments/${id}`} className="text-link hover:underline">
            Assessment run →
          </Link>
          {a && (
            <span className="text-xs text-neutral-500">
              Assessed {formatDay(a.created_at)} · read {a.doc_count} pages
              {a.tora_basis?.startsWith("recomputed") && ` · scores recalculated ${formatDay(a.tora_basis.slice(11))}`}
            </span>
          )}
        </p>
        {a && <EvidenceLine assessments={[a]} />}
      </PageHeader>

      {error != null && <BackendError error={error} />}

      {a && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {AXES.map(({ key, label }) => {
              const ax = a.tora?.[key];
              return (
                <div key={key} className="rounded-card border border-line bg-white px-5 py-4">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    {label}
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    {ax?.score != null && (
                      <span className={`px-2.5 py-1 font-mono text-xl tabular-nums ${scoreShade(ax.score)}`}>
                        {formatScore(ax.score)}
                      </span>
                    )}
                    {ax && <span className="text-[13px] text-muted">{scoredLine(ax)}</span>}
                  </div>
                </div>
              );
            })}
            <div className="rounded-card border border-dashed border-neutral-300 bg-neutral-50 px-5 py-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                Other measures
              </div>
              <ul className="mt-1.5 space-y-1 text-[13px]">
                {Object.entries(a.measures)
                  .filter(([, m]) => m.code.startsWith("X"))
                  .sort(([, x], [, y]) => x.code.localeCompare(y.code))
                  .map(([mid, m]) => (
                    <li key={mid} className="flex items-center justify-between gap-2">
                      <span className="capitalize text-neutral-700">{mid.replace(/-/g, " ")}</span>
                      {m.score != null ? (
                        <span className={`px-1.5 py-0.5 font-mono text-sm tabular-nums ${scoreShade(m.score)}`}>{m.score}</span>
                      ) : <span className="text-muted">not enough evidence</span>}
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          {a.placement && (
            <section className="mt-6 rounded-card border border-line bg-white px-5 py-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                Placement — worked out from the scores, no model calls
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-neutral-500">Priority</span>
                  {a.placement.priority ? (
                    <span className={`px-2.5 py-1 font-mono text-base ${PRIORITY[a.placement.priority] ?? ""}`}>
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
                <span className="text-neutral-600">{composite("How soon", a.placement.timeline)}</span>
                <span className="text-neutral-600">{composite("How big", a.placement.potential)}</span>
              </div>
              {noPriorityReason(a.placement) && <p className="mt-2 text-sm text-muted">{noPriorityReason(a.placement)}</p>}
            </section>
          )}

          {(a.watch_metrics?.length ?? 0) > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold">Metrics to watch</h2>
              <p className="mt-1 text-sm text-neutral-600">
                What would change this technology&apos;s story, suggested by the assessment. Nothing tracks them
                automatically: the next assessment checks them.
              </p>
              <div className="mt-3"><WatchMetrics metrics={a.watch_metrics!} /></div>
            </section>
          )}

          <section className="mt-7">
            <h2 className="text-lg font-semibold">The measures</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {Object.entries(a.measures)
                .sort(([, x], [, y]) => x.code.localeCompare(y.code))
                .map(([mid, m]) => (
                  <div key={mid} className="rounded-card border border-line bg-white px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-neutral-500">{m.code}</span>
                      <span className={`px-2 py-0.5 font-mono text-sm tabular-nums ${scoreShade(m.score)}`}>
                        {m.score ?? "—"}
                      </span>
                      <span className="font-mono text-xs text-neutral-500">{mid.replace(/-/g, " ")}</span>
                      {m.unscorable && (
                        <span className="bg-neutral-100 px-2 py-0.5 font-mono text-[11px] uppercase">
                          ◐ unscorable
                        </span>
                      )}
                    </div>
                    {m.justification && (
                      <p className="mt-2.5 text-sm leading-relaxed text-neutral-700">{m.justification}</p>
                    )}
                    {m.unscorable && m.missing && (
                      <p className="mt-2 text-sm">
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
                              className="break-all font-mono text-xs text-link hover:underline">
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
            <h2 className="text-lg font-semibold">Pages linked to this technology now</h2>
            <p className="mt-1 text-sm text-neutral-600">
              {total} in all, newest published first (undated ones last, by collection date). Pages
              collected after this assessment weren&apos;t read by it; the links on
              each measure above are the pages the scorer cited.
            </p>
            {docs && (
              <div className="mt-3 divide-y divide-neutral-100 rounded-card border border-line bg-white">
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
                      className="mt-0.5 block truncate font-mono text-xs text-link hover:underline">
                      {d.end_url}
                    </a>
                  </div>
                ))}
              </div>
            )}
            {docs && docs.length < total && (
              <button
                onClick={() => loadDocs(docs.length, a.tech_id)}
                className="mt-3 rounded-full border border-line bg-white px-4 py-2 text-sm hover:bg-neutral-100"
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

export default function AssessmentPage() {
  return (
    <Suspense fallback={null}>
      <AssessmentDetail />
    </Suspense>
  );
}
