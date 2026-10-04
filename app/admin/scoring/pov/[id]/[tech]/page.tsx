"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import FabricLabel from "@/components/FabricLabel";
import BackLink from "@/components/BackLink";
import ConfirmAction from "@/components/ConfirmAction";
import PageHeader from "@/components/PageHeader";
import WatchMetrics, { type WatchMetric } from "@/components/WatchMetrics";
import { ApiError, explain, fetchJson, sendJson } from "@/lib/api";
import { formatDay, orList } from "@/lib/format";
import { useHere, withFrom } from "@/lib/here";
import { type Axis, formatScore } from "@/lib/scoring";
import { scoreShade } from "@/lib/theme";
import { useTechLabel } from "@/lib/tech-labels";

type Tora = Record<string, Axis>;

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
  fabric_id: string;
  doc_count?: number;
  created_at?: string;
  tora: Tora;
  placement?: { priority: string | null; horizon: string | null };
  watch_metrics?: WatchMetric[];
  measures?: Record<string, MeasureResult>;
};

type MeasureMeta = { _id: string; code: string; name: string; axis: string; weight?: number };

type Pov = {
  technology: string;
  version: number;
  composed_at: string;
  not_assessed_in?: string[]; // fabrics judged not relevant before scoring
  sections: {
    headline?: string;
    summary?: string;
    tora_analysis?: { market_potential?: string; strategic_fit?: string; adoption_readiness?: string } | null;
    other_measures?: string | null;
    placement_rationale?: string | null;
    evidence_gaps?: string | { fabric: string; missing: string[] }[] | null;
    recommendation?: string;
    // written before version 4 of the skill, retelling the scores' measures
    maturity?: string | null;
    market_view?: string | null;
    capability_gap?: string | null;
  };
};

const AXIS_LABELS: Record<string, string> = {
  market_potential: "Market Potential",
  strategic_fit: "Strategic Fit",
  adoption_readiness: "Adoption Readiness",
};

const heading = "font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500";

/** One section of the narrative; `covers` names the measures it explains. */
function Section({ title, covers, text }: { title: string; covers?: string; text?: string | null }) {
  if (!text) return null;
  return (
    <section>
      <div className="break-inside-avoid break-after-avoid">
        <h2 className={heading}>{title}</h2>
        {covers && <p className="mt-1 text-xs text-neutral-500">{covers}</p>}
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-800">{text}</p>
    </section>
  );
}

/** The scores per fabric, each with how many of its measures had evidence,
 *  and the fabrics it wasn't assessed in. */
function Scores({ assessments, runId, notIn, className }: {
  assessments: Assessment[]; runId: string; notIn: string[]; className: string;
}) {
  const here = useHere();
  return (
    <section className={`break-inside-avoid ${className}`}>
      <h2 className={heading}>Scores</h2>
      {/* relative: keeps the sr-only header inside the scroll box, not widening the page */}
      <div className="relative mt-2 overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
              <th className="px-3 py-2 text-left font-normal">Fabric</th>
              {Object.keys(AXIS_LABELS).map((k) => (
                <th key={k} className="px-2 py-2 text-right font-normal">
                  {AXIS_LABELS[k].split(" ")[0]}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-normal">Priority</th>
              <th className="px-2 py-2 text-right font-normal">Horizon</th>
              <th className="px-3 py-2 print:hidden"><span className="sr-only">Assessment</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {assessments.map((a) => (
              <tr key={a._id}>
                <td className="px-3 py-2 align-top">
                  <FabricLabel id={a.fabric_id} name={a.fabric} />
                </td>
                {Object.keys(AXIS_LABELS).map((k) => {
                  const ax = a.tora?.[k];
                  return (
                    <td key={k} className="px-2 py-2 text-right align-top">
                      {ax?.score != null ? (
                        <span className={`inline-block min-w-9 px-1.5 py-0.5 text-center font-mono text-xs tabular-nums ${scoreShade(ax.score)}`}>
                          {formatScore(ax.score)}
                        </span>
                      ) : <span className="text-xs text-muted">no score</span>}
                      {ax?.of ? <span className="mt-0.5 block text-[11px] text-muted">{ax.scored ?? 0}/{ax.of}</span> : null}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-right align-top font-mono text-xs">
                  {a.placement?.priority ?? <span className="font-sans text-muted">not set</span>}
                </td>
                <td className="px-2 py-2 text-right align-top font-mono text-xs">
                  {a.placement?.horizon ?? <span className="font-sans text-muted">not set</span>}
                </td>
                <td className="px-3 py-2 text-right align-top print:hidden">
                  <Link href={withFrom(`/admin/scoring/assessments/${runId}/${encodeURIComponent(a._id)}`, here)}
                    className="whitespace-nowrap text-xs text-link hover:underline">Details →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notIn.length > 0 && (
        <p className="mt-1.5 text-xs text-neutral-600">
          Not assessed in {orList(notIn)}: judged not relevant to this technology before scoring.
        </p>
      )}
      <p className="mt-1.5 text-xs text-neutral-500">
        Out of 10, darker when higher. 2/3: two of the score&apos;s three measures had enough evidence. With
        none there&apos;s no score, which isn&apos;t a zero.
      </p>
    </section>
  );
}

/** One fabric's score derivation: each axis with its rolled-up score and the
 *  per-measure scores + stored justifications it was computed from. */
function Derivation({ a, meta }: { a: Assessment; meta: MeasureMeta[] }) {
  const axes = [...Object.keys(AXIS_LABELS), ...new Set(meta.map((m) => m.axis))].filter(
    (ax, i, arr) => arr.indexOf(ax) === i,
  );
  return (
    <div className="rounded-card border border-line bg-white print:rounded-none print:border-0">
      <div className="break-after-avoid border-b border-neutral-200 px-4 py-2">
        <FabricLabel id={a.fabric_id} name={a.fabric} />
      </div>
      {axes.map((axis) => {
        const measures = meta.filter((m) => m.axis === axis && a.measures?.[m._id]);
        if (measures.length === 0) return null;
        const roll = a.tora?.[axis];
        return (
          <div key={axis} className="border-b border-neutral-100 px-4 py-3 last:border-b-0">
            <div className="flex break-after-avoid items-baseline gap-2">
              <span className="text-sm font-medium">{AXIS_LABELS[axis] ?? "Other measures"}</span>
              {roll && (
                <>
                  <span className={`px-1.5 py-0.5 font-mono text-xs tabular-nums ${scoreShade(roll.score)}`}>
                    {roll.score != null ? formatScore(roll.score) : "no score"}
                  </span>
                  <span className="font-mono text-[11px] text-neutral-500">
                    weighted mean · {roll.scored} of {roll.of} measures scored
                  </span>
                </>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {measures.map((m) => {
                const r = a.measures![m._id];
                const scored = r.score != null && !r.unscorable;
                return (
                  <details key={m._id} className="group">
                    <summary className="flex cursor-pointer list-none items-baseline gap-2 py-0.5 text-sm hover:text-black">
                      <span className="text-neutral-400 transition-transform group-open:rotate-90">›</span>
                      <span className="min-w-0 flex-1 truncate text-neutral-700">{m.name}</span>
                      {(m.weight ?? 0) > 0 && (
                        <span className="font-mono text-[11px] text-neutral-400">×{m.weight}</span>
                      )}
                      <span className={`px-1.5 py-0.5 font-mono text-xs tabular-nums ${scoreShade(scored ? r.score : null)}`}>
                        {scored ? formatScore(r.score!) : "no score"}
                      </span>
                    </summary>
                    <div className="mb-2 ml-4 border-l-2 border-neutral-200 pl-3 text-sm leading-relaxed text-neutral-600">
                      {scored ? r.justification : (
                        <>
                          <span className="italic text-neutral-500">Not enough evidence. Would need: </span>
                          {r.missing ?? "not recorded"}
                        </>
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

function PointOfView() {
  const { id, tech } = useParams<{ id: string; tech: string }>();
  const label = useTechLabel();
  const [pov, setPov] = useState<Pov | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<MeasureMeta[]>([]);
  const [missing, setMissing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [scoresError, setScoresError] = useState<unknown>(null); // the narrative still shows without them

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
    // the per-measure scores and justifications behind them, and the measures'
    // names — together, so a failure shows once, with its reason
    Promise.all([
      fetchJson<{ assessments: (Assessment & { tech_id: string })[] }>(`/api/scoring/runs/${id}`)
        .then((d) => Promise.all(d.assessments.filter((a) => a.tech_id === tech)
          .sort((x, y) => x.fabric_id.localeCompare(y.fabric_id)) // the order the Point of View writes them in
          .map((a) => fetchJson<Assessment>(`/api/scoring/runs/${id}/assessments/${a._id}`)))),
      fetchJson<{ measures: MeasureMeta[] }>("/api/scoring/measures"),
    ])
      .then(([mine, m]) => { setAssessments(mine); setMeta(m.measures); setScoresError(null); })
      .catch(setScoresError);
  }, [id, tech]);

  useEffect(() => {
    load();
  }, [load]);

  // print what's open: when How the scores were derived is open, every
  // measure's reasoning in it opens for the PDF, then closes again
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      opened = [...document.querySelectorAll<HTMLDetailsElement>("details.derivation[open] details:not([open])")];
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
    try {
      await sendJson(`/api/scoring/runs/${id}/pov/${tech}`, "POST", {});
      load();
    } finally {
      setComposing(false);
    }
  }

  const s = pov?.sections ?? {};
  const watch = assessments.find((a) => a.watch_metrics?.length)?.watch_metrics ?? []; // one list per technology
  const docCount = assessments[0]?.doc_count ?? 0;
  // the assessment it explains: its earliest fabric, as the backend dates it
  const assessedAt = assessments.map((a) => a.created_at).filter(Boolean).sort()[0];
  const basis = pov && [`Written ${formatDay(pov.composed_at)}`,
    assessedAt && `assessed ${formatDay(assessedAt)}${docCount ? ` from ${docCount} page${docCount === 1 ? "" : "s"}` : ""}`,
    `version ${pov.version}`].filter(Boolean).join(" · ");
  // the measures each section explains, by name, in their scoring order
  const named = (keep: (m: MeasureMeta) => boolean) =>
    meta.filter(keep).sort((x, y) => x.code.localeCompare(y.code)).map((m) => m.name).join(" · ");
  const covers = (axis: string) => {
    const names = named((m) => m.axis === axis);
    return names && `Measures: ${names}`;
  };
  const others = named((m) => !(m.axis in AXIS_LABELS));
  // scores + derivation hold the right column; when there are none, the
  // narrative expands to the full width
  const hasRight = assessments.length > 0 || scoresError != null;
  const scores = (className: string) => assessments.length > 0 && (
    <Scores assessments={assessments} runId={id} notIn={pov?.not_assessed_in ?? []} className={className} />
  );

  return (
    <div>
      <BackLink fallback={`/admin/technologies/${tech}`} fallbackLabel={label(pov?.technology ?? tech.replace(/-/g, " "))} />
      <PageHeader eyebrow="Point of View" title={label(pov?.technology ?? tech.replace(/-/g, " "))}
        intro="The radar's conclusion on this technology: what Tata Communications should do, why, and what's still missing."
        help={<>
          <li>The headline is the verdict, and Recommendation says what Tata Communications should do next. Summary says
            what the technology is and where the evidence comes from.</li>
          <li>Scores: per fabric, Market, Strategic and Adoption from 0 to 10 (darker is higher), each with how many of
            its three measures had enough evidence (2/3); then the priority (P1 act now to P6 just watch) and the horizon
            (H1 near to H3 far). Details opens that fabric&apos;s assessment, with the pages it cites. A fabric without
            a row wasn&apos;t assessed: before scoring, it was judged not relevant to this technology.</li>
          <li>Each fabric is scored on 12 measures: three under each score, and three other measures that feed no
            score. A section explains each score and its measures, then Other measures, then Priority and horizon.
            Where fabrics score the same, it&apos;s said once.</li>
          <li>Evidence gaps name what&apos;s missing, and Metrics to watch say what would change the verdict.</li>
          <li>Written is when this Point of View was written; assessed is when the assessment it explains was made.
            Rewriting writes it again from the same assessment: the scores don&apos;t change.</li>
          <li>How the scores were derived, closed until you open it: each measure with the assessor&apos;s reasoning and
            the strongest case against it. &ldquo;No score&rdquo; means the evidence couldn&apos;t support one; it&apos;s
            left out, never counted as zero.</li>
          <li>Print / Save as PDF prints the Point of View and its scores. To include how the scores were derived, open
            it first: it prints after the rest, on its own pages.</li>
        </>}>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600 print:hidden">
          <Link href={`/admin/technologies/${tech}`} className="text-link hover:underline">Technology →</Link>
          <Link href="/admin/scoring/pov" className="text-link hover:underline">All Points of View →</Link>
          <Link href={`/admin/scoring/assessments/${id}`} className="text-link hover:underline">Assessment run →</Link>
          {basis && <span className="text-xs text-neutral-500">{basis}</span>}
          <ConfirmAction label={pov ? "Rewrite" : "Write Point of View"} cost="about 1 model call" secondary
            question={`${pov ? "Rewrite" : "Write"} the Point of View from the same assessment? About 1 model call; the scores don't change.${pov ? " The current version is replaced." : ""}`}
            confirmLabel={pov ? "Rewrite" : "Write"} onConfirm={compose} />
          {pov && (
            <button type="button" onClick={() => window.print()}
              className="rounded-full border border-line bg-white px-2.5 py-1 text-xs hover:bg-neutral-100">
              Print / Save as PDF
            </button>
          )}
        </p>
        {basis && (
          <p className="mt-1 hidden font-mono text-[11px] text-neutral-500 print:block">Tech Lens · Point of View · {basis}</p>
        )}
      </PageHeader>

      {error != null && <BackendError error={error} />}
      {missing && !composing && (
        <p className="mt-6 text-sm text-neutral-600">
          No Point of View written yet for this technology. Writing it from the stored assessment
          takes about 1 model call; the scores never change.
        </p>
      )}

      {pov && (
        <>
          {s.headline && (
            <p className="mt-7 break-inside-avoid border-l-[3px] border-navy pl-4 font-display text-[22px] leading-snug">
              {s.headline}
            </p>
          )}

          {/* one column in print, whatever the paper's width */}
          <div
            className={
              hasRight
                ? "mt-8 grid grid-cols-1 items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] print:block"
                : "mt-8"
            }
          >
            {/* left — the narrative: what to do, then why, score by score, then
                what's missing and what would change it */}
            <div className="min-w-0 space-y-6">
              <Section title="Recommendation" text={s.recommendation} />
              <Section title="Summary" text={s.summary} />
              {/* narrow screens and print: the scores follow the summary, before the
                  sections that explain them */}
              {scores("lg:hidden print:block")}
              <Section title="Market Potential" covers={covers("market_potential")} text={s.tora_analysis?.market_potential} />
              <Section title="Strategic Fit" covers={covers("strategic_fit")} text={s.tora_analysis?.strategic_fit} />
              <Section title="Adoption Readiness" covers={covers("adoption_readiness")} text={s.tora_analysis?.adoption_readiness} />
              <Section title="Other measures" covers={others && `Not part of the three scores: ${others}`}
                text={s.other_measures} />
              <Section title="Priority and horizon" text={s.placement_rationale} />
              <Section title="Maturity" text={s.maturity} />
              <Section title="Market view" text={s.market_view} />
              <Section title="Capability gap" text={s.capability_gap} />

              {Array.isArray(s.evidence_gaps) && s.evidence_gaps.length > 0 && (
                <section>
                  <h2 className={heading}>Evidence gaps</h2>
                  {/* on paper: one fabric under another, full width and unboxed, so they fit the page */}
                  <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3 print:block print:space-y-3">
                    {s.evidence_gaps.map((g) => (
                      <div key={g.fabric} className="break-inside-avoid rounded-card border border-line bg-white px-4 py-3 print:rounded-none print:border-0 print:p-0">
                        <FabricLabel id={assessments.find((a) => a.fabric === g.fabric)?.fabric_id}
                          name={g.fabric} />
                        <ul className="mt-2 space-y-1.5">
                          {(g.missing ?? []).map((m, i) => (
                            <li key={i} className="flex gap-2 text-sm leading-relaxed text-neutral-700">
                              <span className="text-navy">·</span>
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
                  {/* heading and intro: one unit on paper, kept with the first metric */}
                  <div className="break-inside-avoid break-after-avoid">
                    <h2 className={heading}>Metrics to watch</h2>
                    <p className="mt-1 text-xs text-neutral-500">
                      What would change the verdict, suggested by the assessment. Nothing tracks them automatically: the
                      next assessment checks them.
                    </p>
                  </div>
                  <div className="mt-2"><WatchMetrics metrics={watch} /></div>
                </section>
              )}
            </div>

            {/* right — the numbers behind it; min-w-0 lets the wide table scroll in its box */}
            <div className="min-w-0 space-y-6">
              {scoresError != null && (
                <p className="rounded-card border border-failed/40 bg-failed/5 px-4 py-3 text-sm text-failed">
                  Couldn&apos;t load the scores behind this Point of View: {explain(scoresError).title}.{" "}
                  {explain(scoresError).hint}
                </p>
              )}
              {scores("hidden lg:block print:hidden")}

              {meta.length > 0 && assessments.some((a) => a.measures) && (
                // prints only when open, after the rest, on its own pages
                <details className="derivation group/derived print:break-before-page">
                  <summary className={`flex cursor-pointer list-none items-center gap-2 ${heading} [&::-webkit-details-marker]:hidden`}>
                    <span aria-hidden className="inline-block text-[9px] transition-transform group-open/derived:rotate-90 print:hidden">▶</span>
                    How the scores were derived
                  </summary>
                  <p className="mt-1 text-xs text-neutral-500">
                    Each score is the weighted mean of its scored measures. Expand a measure for the
                    assessor&apos;s justification, verbatim.
                  </p>
                  <div className="mt-2 space-y-3">
                    {assessments
                      .filter((a) => a.measures)
                      .map((a) => (
                        <Derivation key={a._id} a={a} meta={meta} />
                      ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function PovPage() {
  return (
    <Suspense fallback={null}>
      <PointOfView />
    </Suspense>
  );
}
