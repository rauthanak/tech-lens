"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { formatTime } from "@/lib/format";

type Tora = Record<string, { score: number | null; scored?: number; of?: number; partial: boolean }>;

type MeasureResult = {
  code: string;
  score: number | null;
  justification?: string | null;
  counter_case?: string | null;
  unscorable?: boolean;
  missing?: string | null;
};

type Assessment = {
  _id: string;
  fabric: string;
  doc_count?: number;
  tora: Tora;
  placement?: { priority: string | null; horizon: string | null };
  watch_metrics?: { metric: string; current_value?: string; inflection_threshold?: string; implication?: string }[];
  measures?: Record<string, MeasureResult>;
};

type MeasureMeta = { _id: string; code: string; name: string; axis: string; weight?: number };

type Pov = {
  technology: string;
  version: number;
  composed_at: string;
  sections: {
    headline?: string;
    summary?: string;
    tora_analysis?: { market_potential?: string; strategic_fit?: string; adoption_readiness?: string } | null;
    maturity?: string | null;
    market_view?: string | null;
    placement_rationale?: string | null;
    capability_gap?: string | null;
    evidence_gaps?: string | { fabric: string; missing: string[] }[] | null;
    recommendation?: string;
  };
};

const AXIS_LABELS: Record<string, string> = {
  market_potential: "Market Potential",
  strategic_fit: "Strategic Fit",
  adoption_readiness: "Adoption Readiness",
};

function scoreShade(score: number | null): string {
  if (score == null) return "bg-neutral-100 text-neutral-400";
  if (score >= 7) return "bg-[#8a4b2d] text-white";
  if (score >= 4) return "bg-[#dcb9a2] text-[#171513]";
  return "bg-[#f8efe7] text-[#171513]";
}

function Section({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;
  return (
    <section>
      <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500">{title}</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-800">{text}</p>
    </section>
  );
}

/** One fabric's score derivation: each TORA axis with its rolled-up score and
 * the per-measure scores + stored justifications it was computed from. */
function Derivation({ a, meta }: { a: Assessment; meta: MeasureMeta[] }) {
  const axes = [...Object.keys(AXIS_LABELS), ...new Set(meta.map((m) => m.axis))].filter(
    (ax, i, arr) => arr.indexOf(ax) === i,
  );
  return (
    <div className="border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-neutral-600">
        {a.fabric}
      </div>
      {axes.map((axis) => {
        const measures = meta.filter((m) => m.axis === axis && a.measures?.[m._id]);
        if (measures.length === 0) return null;
        const roll = a.tora?.[axis];
        return (
          <div key={axis} className="border-b border-neutral-100 px-4 py-3 last:border-b-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">{AXIS_LABELS[axis] ?? "Additional signals"}</span>
              {roll && (
                <>
                  <span className={`px-1.5 py-0.5 font-mono text-xs tabular-nums ${scoreShade(roll.score)}`}>
                    {roll.score ?? "—"}
                  </span>
                  <span className="font-mono text-[11px] text-neutral-500">
                    weighted mean · {roll.scored}/{roll.of} measures scored
                  </span>
                </>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {measures.map((m) => {
                const r = a.measures![m._id];
                return (
                  <details key={m._id} className="group">
                    <summary className="flex cursor-pointer list-none items-baseline gap-2 py-0.5 text-sm hover:text-black">
                      <span className="text-neutral-400 transition-transform group-open:rotate-90">›</span>
                      <span className="min-w-0 flex-1 truncate text-neutral-700">{m.name}</span>
                      {(m.weight ?? 0) > 0 && (
                        <span className="font-mono text-[11px] text-neutral-400">×{m.weight}</span>
                      )}
                      <span className={`px-1.5 py-0.5 font-mono text-xs tabular-nums ${scoreShade(r.score)}`}>
                        {r.unscorable ? "n/a" : (r.score ?? "—")}
                      </span>
                    </summary>
                    <div className="mb-2 ml-4 border-l-2 border-neutral-200 pl-3 text-sm leading-relaxed text-neutral-600">
                      {r.unscorable ? (
                        <>
                          <span className="font-mono text-[11px] uppercase text-neutral-500">
                            not assessable —{" "}
                          </span>
                          {r.missing ?? "the required evidence is missing"}
                        </>
                      ) : (
                        r.justification
                      )}
                      {r.counter_case && (
                        <p className="mt-1 italic text-neutral-500">Counter-case: {r.counter_case}</p>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PovPage() {
  const { id, tech } = useParams<{ id: string; tech: string }>();
  const [pov, setPov] = useState<Pov | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<MeasureMeta[]>([]);
  const [missing, setMissing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    fetchJson<Pov>(`/api/scoring/runs/${id}/pov/${tech}`)
      .then((p) => {
        setPov(p);
        setMissing(false);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setMissing(true);
        else setError(e);
      });
    // the run listing carries roll-ups only; fetch each full assessment for
    // the per-measure scores and justifications behind them
    fetchJson<{ assessments: Assessment[] }>(`/api/scoring/runs/${id}`)
      .then((d) => {
        const mine = (d.assessments as (Assessment & { tech_id: string })[]).filter(
          (a) => a.tech_id === tech,
        );
        setAssessments(mine);
        return Promise.all(
          mine.map((a) => fetchJson<Assessment>(`/api/scoring/runs/${id}/assessments/${a._id}`)),
        );
      })
      .then(setAssessments)
      .catch(() => {});
    fetchJson<{ measures: MeasureMeta[] }>("/api/scoring/measures")
      .then((d) => setMeta(d.measures))
      .catch(() => {});
  }, [id, tech]);

  useEffect(() => {
    load();
  }, [load]);

  // a closed <details> prints nothing — open every measure row for the PDF,
  // then restore whatever the reader had collapsed
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      opened = [...document.querySelectorAll<HTMLDetailsElement>("details:not([open])")];
      opened.forEach((d) => (d.open = true));
    };
    const after = () => {
      opened.forEach((d) => (d.open = false));
      opened = [];
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  async function compose() {
    setComposing(true);
    setError(null);
    try {
      await sendJson(`/api/scoring/runs/${id}/pov/${tech}`, "POST", {});
      load();
    } catch (e) {
      setError(e);
    } finally {
      setComposing(false);
    }
  }

  const s = pov?.sections ?? {};
  const watch = assessments[0]?.watch_metrics ?? [];
  const docCount = assessments[0]?.doc_count ?? 0;
  // scores + derivation hold the right column; when there are none, the
  // narrative expands to the full width
  const hasRight = assessments.length > 0;

  return (
    <div>
      <PageHeader eyebrow="Point of View" title={pov?.technology ?? tech.replace(/-/g, " ")}>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600 print:hidden">
          <Link href="/admin/scoring/pov" className="text-[var(--accent)] underline underline-offset-4">
            all points of view
          </Link>
          <Link
            href={`/admin/scoring/assessments/${id}`}
            className="text-[var(--accent)] underline underline-offset-4"
          >
            scoring run
          </Link>
          {pov && (
            <span className="font-mono text-xs text-neutral-500">
              v{pov.version} · composed {formatTime(pov.composed_at)}
            </span>
          )}
          {docCount > 0 && (
            <span className="font-mono text-xs text-neutral-500">
              assessed from {docCount} source document{docCount === 1 ? "" : "s"}
            </span>
          )}
          <button
            onClick={compose}
            disabled={composing}
            className="border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
          >
            {composing ? "Composing…" : pov ? "Recompose" : "Compose PoV"}
          </button>
          {pov && (
            <button
              onClick={() => window.print()}
              title="opens the print dialog — choose 'Save as PDF'"
              className="border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100"
            >
              Download PDF
            </button>
          )}
        </p>
        {pov && (
          <p className="mt-1 hidden font-mono text-[11px] text-neutral-500 print:block">
            Tech Lens · Point of View v{pov.version} · composed {formatTime(pov.composed_at)} ·{" "}
            {docCount} source documents
          </p>
        )}
      </PageHeader>

      {error != null && <BackendError error={error} />}
      {missing && !composing && (
        <p className="mt-6 text-sm text-neutral-600">
          No PoV composed yet for this technology — one click above writes it from the stored
          assessment (the scores never move).
        </p>
      )}

      {pov && (
        <>
          {s.headline && (
            <p className="mt-7 border-l-[3px] border-[#8a4b2d] pl-4 font-display text-[22px] font-semibold leading-snug">
              {s.headline}
            </p>
          )}

          <div
            className={
              hasRight
                ? "mt-8 grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]"
                : "mt-8"
            }
          >
            {/* left — the narrative */}
            <div className="space-y-6">
              <Section title="Summary" text={s.summary} />
              <Section title="Recommendation" text={s.recommendation} />

              {Array.isArray(s.evidence_gaps) && s.evidence_gaps.length > 0 && (
                <section>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                    Evidence gaps
                  </h2>
                  <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3">
                    {s.evidence_gaps.map((g) => (
                      <div key={g.fabric} className="border border-neutral-200 bg-white px-4 py-3">
                        <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-600">
                          {g.fabric}
                        </div>
                        <ul className="mt-2 space-y-1.5">
                          {(g.missing ?? []).map((m, i) => (
                            <li key={i} className="flex gap-2 text-sm leading-relaxed text-neutral-700">
                              <span className="text-[#8a4b2d]">·</span>
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {typeof s.evidence_gaps === "string" && (
                <Section title="Evidence gaps" text={s.evidence_gaps} />
              )}

              {watch.length > 0 && (
                <section>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                    Metrics to watch
                  </h2>
                  <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3">
                    {watch.map((m, i) => (
                      <div key={i} className="border border-neutral-200 bg-white px-4 py-3 text-sm">
                        <div className="font-medium leading-snug">{m.metric}</div>
                        {m.current_value && (
                          <p className="mt-1.5 text-neutral-600">
                            <span className="font-mono text-[11px] uppercase text-neutral-400">now </span>
                            {m.current_value}
                          </p>
                        )}
                        {m.inflection_threshold && (
                          <p className="mt-1 text-neutral-600">
                            <span className="font-mono text-[11px] uppercase text-neutral-400">inflection </span>
                            {m.inflection_threshold}
                          </p>
                        )}
                        {m.implication && (
                          <p className="mt-1 italic text-neutral-500">{m.implication}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <Section title="TORA · Market Potential" text={s.tora_analysis?.market_potential} />
              <Section title="TORA · Strategic Fit" text={s.tora_analysis?.strategic_fit} />
              <Section title="TORA · Adoption Readiness" text={s.tora_analysis?.adoption_readiness} />
              <Section title="Maturity" text={s.maturity} />
              <Section title="Market view" text={s.market_view} />
              <Section title="Placement" text={s.placement_rationale} />
              <Section title="Capability gap" text={s.capability_gap} />
            </div>

            {/* right — the numbers behind it */}
            <div className="space-y-6">
              {assessments.length > 0 && (
                <section>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                    Scores
                  </h2>
                  <div className="mt-2 overflow-x-auto border border-neutral-200 bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                          <th className="px-3 py-2 text-left font-normal">Fabric</th>
                          {Object.keys(AXIS_LABELS).map((k) => (
                            <th key={k} className="px-2 py-2 text-right font-normal">
                              {AXIS_LABELS[k].split(" ")[0]}
                            </th>
                          ))}
                          <th className="px-2 py-2 text-right font-normal">Prio</th>
                          <th className="px-2 py-2 text-right font-normal">Hzn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {assessments.map((a) => (
                          <tr key={a._id}>
                            <td className="px-3 py-2 font-mono text-[11px] uppercase text-neutral-600">
                              {a.fabric}
                            </td>
                            {Object.keys(AXIS_LABELS).map((k) => (
                              <td key={k} className="px-2 py-2 text-right">
                                <span
                                  className={`inline-block min-w-9 px-1.5 py-0.5 text-center font-mono text-xs tabular-nums ${scoreShade(a.tora?.[k]?.score ?? null)}`}
                                >
                                  {a.tora?.[k]?.score ?? "—"}
                                </span>
                              </td>
                            ))}
                            <td className="px-2 py-2 text-right font-mono text-xs">
                              {a.placement?.priority ?? "—"}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-xs">
                              {a.placement?.horizon ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {meta.length > 0 && assessments.some((a) => a.measures) && (
                <section className="break-inside-avoid-page">
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                    How the scores were derived
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Each axis is the weighted mean of its scored measures — expand a measure for the
                    assessor&apos;s justification, verbatim.
                  </p>
                  <div className="mt-2 space-y-3">
                    {assessments
                      .filter((a) => a.measures)
                      .map((a) => (
                        <Derivation key={a._id} a={a} meta={meta} />
                      ))}
                  </div>
                </section>
              )}

            </div>
          </div>
        </>
      )}
    </div>
  );
}
