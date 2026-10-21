"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ActButton from "@/components/ActButton";
import AddLink from "@/components/AddLink";
import BackendError from "@/components/BackendError";
import Bottlenecks from "@/components/Bottlenecks";
import ChoiceForm from "@/components/ChoiceForm";
import DecisionNote from "@/components/DecisionNote";
import EvidenceLine from "@/components/EvidenceLine";
import FabricLabel from "@/components/FabricLabel";
import FinanceCard from "@/components/FinanceCard";
import FindEvidence from "@/components/FindEvidence";
import LeaderRecord from "@/components/LeaderRecord";
import PathToScale from "@/components/PathToScale";
import Section from "@/components/Section";
import UseCases from "@/components/UseCases";
import WatchMetrics, { type WatchMetric } from "@/components/WatchMetrics";
import { fetchJson } from "@/lib/api";
import { decide, type Decision } from "@/lib/decisions";
import { formatDay, plural } from "@/lib/format";
import { useHood } from "@/lib/hood";
import { formatScore, noPriorityReason, type Placement } from "@/lib/scoring";
import { PRIORITY, scoreShade } from "@/lib/theme";
import { type Finance, hasFigures, type Pages, type PathStep, type SuggestedBlocker, type UseCase, useValueLists } from "@/lib/value";

type State = "scored" | "scored_by_person" | "gap_accepted" | "waiting_for_tata" | "unscored";
type Result = {
  code: string; score: number | null; justification: string | null; evidence_urls: string[];
  counter_case: string | null; missing: string | null; scope: "technology" | "fabric" | "tata";
  state: State; model_score?: number; decision?: Decision;
};
type Applied = {
  _id: string; scoring_run_id: string; fabric_id: string; fabric: string; created_at: string; doc_count: number;
  evidence_runs?: string[]; measures: Record<string, Result>;
  tora: Record<string, { score: number | null; scored: number; of: number }>;
  placement: Placement & { timeline: Composite; potential: Composite };
  effective: { priority: string | null; horizon: string | null; computed_priority: string | null;
    override: Decision | null; override_moved: boolean };
  watch_metrics?: WatchMetric[];
  use_cases?: UseCase[];
  suggested_use_cases?: UseCase[];
  no_use_case?: { reason: string; evidence_needed: string } | null;
  value_failed?: string | null;
  suggested_bottlenecks?: SuggestedBlocker[];
};
type Composite = { score: number | null; band: string | null; scored: number; of: number };
type MeasureDef = { _id: string; code: string; name: string; axis: string; scope?: string; definition: string };
type Resp = {
  technology: { id: string; label: string };
  fabric: string;
  fabrics: { fabric_id: string; fabric: string; priority: string | null; computed_priority: string | null;
    override: boolean; states: Partial<Record<State, number>> }[];
  assessment: Applied;
  measures: MeasureDef[];
  finance: Finance;
  path: PathStep[];
  use_case_decisions: Record<string, { _id: string; value: string }>;
  cited_pages: Pages;
};

const PRIORITIES = ["P1", "P2", "P3", "P4", "P5", "P6"].map((p) => ({ value: p, label: p }));
const STATE_WORDS: Record<State, string> = {
  scored: "scored", scored_by_person: "scored by a person", gap_accepted: "gap accepted",
  waiting_for_tata: "waiting for Tata", unscored: "unscored",
};
const SCOPE_WORDS = { technology: "Judged for the technology as a whole", fabric: "Judged in this fabric",
  tata: "Entered by Tata" };
const PILL = "rounded-full border border-line bg-white px-3 py-1 text-[13px] hover:bg-ground";
const AXES = [["market_potential", "Market potential"], ["strategic_fit", "Strategic fit"],
  ["adoption_readiness", "Adoption readiness"]] as const;

function composite(label: string, c: Composite) {
  return `${label}: ${c.score == null ? "not enough evidence" : `${formatScore(c.score)}${c.band ? `, ${c.band}` : ""}`} · ${c.scored} of ${c.of} scored`;
}

/** A technology's latest assessment, one tab per fabric (?fabric=), with the
 *  choices people make before publishing: override the priority, score a
 *  measure by hand or accept its gap, enter Tata's measures, and undo. */
export default function FabricAssessment({ techId, onChanged }: { techId: string; onChanged?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const hood = useHood();
  const fabric = params.get("fabric") ?? "";
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [form, setForm] = useState<string | null>(null); // which form is open: "override" or a measure's id
  const [why, setWhy] = useState<Record<string, boolean>>({});
  const lists = useValueLists();

  const load = useCallback(() =>
    fetchJson<Resp>(`/api/technologies/${techId}/assessment${fabric ? `?fabric=${encodeURIComponent(fabric)}` : ""}`)
      .then((d) => { setData(d); setError(null); })
      .catch(setError), [techId, fabric]);
  useEffect(() => { load(); }, [load]);
  // a link to "#finance" (the Point of View's "for Tata to fill in") lands on the card once it's drawn
  const drawn = Boolean(data);
  useEffect(() => {
    if (drawn && window.location.hash === "#finance") document.getElementById("finance")?.scrollIntoView();
  }, [drawn]);

  const choose = (f: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("fabric", f);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const done = async () => {
    setForm(null);
    await load();
    onChanged?.();
  };

  if (error != null) return <BackendError error={error} />;
  if (!data) return null;
  const a = data.assessment;
  const e = a.effective;
  const names = new Map(data.measures.map((m) => [m._id, m]));
  const rows = Object.entries(a.measures).map(([mid, r]) => ({ mid, r, m: names.get(mid) }))
    .sort((x, y) => (x.m?.code ?? x.mid).localeCompare(y.m?.code ?? y.mid));
  const needs = rows.filter(({ r }) => r.state === "unscored" || r.state === "waiting_for_tata");
  const settled = rows.filter(({ r }) => r.state !== "unscored" && r.state !== "waiting_for_tata");
  const counts = rows.reduce((c, { r }) => ({ ...c, [r.state]: (c[r.state] ?? 0) + 1 }), {} as Partial<Record<State, number>>);
  const why0 = noPriorityReason(a.placement);
  const tech = data.technology.label;
  const blockers = (data.finance.bottlenecks?.picked.length ?? 0) + (data.finance.bottlenecks?.other ? 1 : 0);

  const row = ({ mid, r, m }: { mid: string; r: Result; m?: MeasureDef }) => {
    const name = m?.name ?? mid;
    const open = why[mid];
    // what a person can do when the pages don't settle it: score it by hand
    // (or enter Tata's figure), or leave it out
    const fill = r.state === "unscored"
      ? { kind: "hand_score" as const, openLabel: "Score by hand", skipLabel: "Accept the gap",
        label: r.scope === "technology" ? "Score, 0–10 (applies in every fabric)" : "Score, 0–10",
        placeholder: "what you know that the pages don't show" }
      : r.state === "waiting_for_tata"
        ? { kind: "tata_entry" as const, openLabel: "Enter", skipLabel: "Leave it out", label: "Tata's score, 0–10",
          placeholder: "where the figure comes from" }
        : null;
    return (
      <li key={mid} className="py-3">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <span className={`w-10 shrink-0 px-1.5 py-0.5 text-center font-mono text-sm tabular-nums ${scoreShade(r.score)}`}>
            {r.score ?? "—"}
          </span>
          <div className="min-w-0 flex-1 basis-64">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{name}</span>
              {hood && <span className="font-mono text-[11px] text-neutral-400">{r.code}</span>}
              <span className="text-[11.5px] text-muted">{SCOPE_WORDS[r.scope]}</span>
            </div>
            {r.state === "scored" && r.justification && (
              <p className="mt-0.5 text-[13px] text-neutral-700">
                {open ? r.justification : `${r.justification.split(/(?<=[.!?])\s/)[0]}`}{" "}
                <button type="button" className="text-link hover:underline" onClick={() => setWhy({ ...why, [mid]: !open })}>
                  {open ? "less" : `why · ${plural(r.evidence_urls.length, "page")}`}
                </button>
              </p>
            )}
            {r.state === "unscored" && (
              <p className="mt-0.5 text-[13px] text-amber-900">
                Not scored: the pages don&apos;t show it.{r.missing && <> What would: {r.missing}</>}
              </p>
            )}
            {r.state === "waiting_for_tata" && (
              <p className="mt-0.5 text-[13px] text-amber-900">Waiting for Tata&apos;s figure, 0–10: Enter it, or Leave it out if Tata has none.</p>
            )}
            {r.state === "scored_by_person" && r.decision && (
              <div className="mt-0.5">
                <DecisionNote what={r.scope === "tata" ? `Entered as ${r.score}` : `Scored ${r.score}`}
                  decision={r.decision} onUndone={done} />
                {r.model_score != null && (
                  <p className="text-[12px] text-muted">The model scored it {r.model_score} from the pages; the person&apos;s score is used.</p>
                )}
              </div>
            )}
            {r.state === "gap_accepted" && r.decision && (
              <div className="mt-0.5"><DecisionNote what="Gap accepted" decision={r.decision} onUndone={done} /></div>
            )}
            {open && r.state === "scored" && (
              <div className="mt-1.5 space-y-1.5 text-[13px]">
                {r.counter_case && (
                  <p className="border-l-2 border-neutral-200 pl-3 text-neutral-600">
                    <span className="font-mono text-[11px] uppercase text-neutral-500">The case against </span>{r.counter_case}
                  </p>
                )}
                {r.evidence_urls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block break-all font-mono text-xs text-link hover:underline">{u}</a>
                ))}
              </div>
            )}
            {fill && form === mid && (
              <ChoiceForm label={fill.label} reasonRequired placeholder={fill.placeholder}
                onSubmit={(v, reason) => decide({ kind: fill.kind, tech_id: techId, fabric_id: a.fabric_id,
                  measure_id: mid, value: v, reason }).then(done)} onCancel={() => setForm(null)} />
            )}
          </div>
          <div className="flex min-w-0 max-w-full flex-wrap gap-1.5">
            {fill && form !== mid && (
              <>
                <button type="button" onClick={() => setForm(mid)} className={PILL}>{fill.openLabel}</button>
                <ActButton label={fill.skipLabel} className={PILL} onDone={done}
                  run={() => decide({ kind: "accept_gap", tech_id: techId, fabric_id: a.fabric_id, measure_id: mid })} />
                {r.state === "unscored" && (
                  <>
                    <FindEvidence gap={{ kind: "measure", tech_id: techId, fabric_id: a.fabric_id, measure_id: mid }} onDone={done} />
                    <AddLink gap={{ tech_id: techId, fabric_id: a.fabric_id, measure_id: mid }} onDone={done} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="mt-3">
      <nav aria-label="Fabrics" className="flex flex-wrap gap-1.5">
        {data.fabrics.map((f) => {
          const on = f.fabric_id === a.fabric_id;
          return (
            <button key={f.fabric_id} type="button" aria-current={on ? "page" : undefined} onClick={() => choose(f.fabric_id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] ${on ? "border-navy bg-navy text-white" : "border-line bg-white hover:bg-ground"}`}>
              {f.fabric}
              <span className={`font-mono text-[11px] ${on ? "text-white/80" : "text-muted"}`}>
                {f.priority ?? "no priority"}{f.override ? " ✎" : ""}
              </span>
              {(f.states.unscored ?? 0) > 0 && (
                <span className={`rounded-full px-1.5 text-[10.5px] ${on ? "bg-white/20" : "bg-amber-100 text-amber-900"}`}
                  title={`${f.states.unscored} unscored`}>{f.states.unscored}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* the priority, how it was reached, and a person's override */}
      <section className="mt-3 rounded-card border border-line bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <FabricLabel id={a.fabric_id} name={a.fabric} />
          <span className="flex items-center gap-2 text-sm">
            <span className="text-muted">Priority</span>
            <span className={`px-2.5 py-1 font-mono text-base ${e.priority ? PRIORITY[e.priority] : "text-neutral-400"}`}>
              {e.priority ?? "—"}
            </span>
            {e.override && <span className="text-[13px] text-muted">override in force (computed {e.computed_priority ?? "none"})</span>}
          </span>
          <span className="text-sm text-muted" title="How soon it arrives: H1 near, H2 mid, H3 far">Horizon {e.horizon ?? "—"}</span>
          <span className="ml-auto">
            {form !== "override" && (
              <button type="button" onClick={() => setForm("override")}
                className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-ground">
                {e.override ? "Change the override…" : "Override priority…"}
              </button>
            )}
          </span>
        </div>
        <p className="mt-2 text-[13px] text-neutral-600">
          {composite("How soon", a.placement.timeline)} · {composite("How big", a.placement.potential)}
        </p>
        {!e.priority && why0 && (
          <p className="mt-1 text-[13px] text-amber-900">{why0} Score the missing measures below, or set a priority by hand.</p>
        )}
        {e.override && (
          <div className="mt-1.5">
            <DecisionNote what={`Set to ${e.priority}`} decision={e.override} onUndone={done} />
            {e.override_moved && (
              <p className="text-[12.5px] text-amber-900">
                The computed priority has moved from {e.override.computed ?? "none"} to {e.computed_priority ?? "none"} since
                this override: check it still holds.
              </p>
            )}
          </div>
        )}
        {form === "override" && (
          <ChoiceForm label="Priority" options={PRIORITIES} reasonRequired
            placeholder="why this priority, not the computed one"
            onSubmit={(v, reason) => decide({ kind: "override", tech_id: techId, fabric_id: a.fabric_id, value: v, reason }).then(done)}
            onCancel={() => setForm(null)} />
        )}
      </section>

      {/* each part: what it is, what you do here, where it shows up; then the part */}
      <Section title={`Measures in ${a.fabric}`}
        summary={(["scored", "scored_by_person", "gap_accepted", "waiting_for_tata", "unscored"] as State[])
          .filter((s) => counts[s]).map((s) => `${counts[s]} ${STATE_WORDS[s]}`).join(" · ")}
        what="What the radar scores, 0 to 10, from the pages; together they set the priority above."
        todo={needs.length ? "Settle the ones under Needs a person: score by hand, enter Tata's figure, or leave it out."
          : "Nothing needs a person here."}
        shows="The priority, here and in the leaders' view, and the Point of View.">
        {needs.length > 0 && (
          <>
            <div className="text-[12px] font-medium text-amber-900">Needs a person · {needs.length}</div>
            <ul className="divide-y divide-neutral-100">{needs.map(row)}</ul>
          </>
        )}
        <details className={needs.length ? "mt-2" : ""}>
          <summary className="cursor-pointer text-[12.5px] text-link hover:underline">Settled · {plural(settled.length, "measure")}</summary>
          <ul className="divide-y divide-neutral-100">{settled.map(row)}</ul>
        </details>
      </Section>

      <Section title={`Use cases: where the value lands in ${a.fabric}`}
        summary={a.use_cases?.length ? plural(a.use_cases.length, "use case") : "none from the pages yet"}
        what={<>Ways Tata could make or save money with {tech} in {a.fabric}, read from its pages. Each has two levers, how it
          earns (contribution) and how it cuts the cost of delivering (delivery cost), and the capital it needs.</>}
        todo={a.suggested_use_cases?.length ? "Accept or reject the use cases the model suggested without pages."
          : "Read them. Money figures come from people, under Finance below; the model never writes one."}
        shows="The Point of View, and the leaders' view.">
        <UseCases cases={a.use_cases ?? []} suggested={a.suggested_use_cases ?? []} none={a.no_use_case ?? null}
          failed={a.value_failed} decisions={data.use_case_decisions} pages={data.cited_pages} lists={lists} techId={techId}
          fabricId={a.fabric_id} onChanged={done} />
      </Section>

      <Section title={`What could stop it scaling in ${a.fabric}`}
        summary={data.finance.bottlenecks ? `${plural(blockers, "blocker")} picked`
          : a.suggested_bottlenecks?.length ? `${a.suggested_bottlenecks.length} suggested from the pages, none picked yet` : "none picked yet"}
        what={<>Problems that commonly stop a technology growing into a real business in {a.fabric}, such as customers&apos; data
          being hard to move. {a.fabric}&apos;s list is kept in Setup › Fabrics.</>}
        todo={<>Tick the ones that apply to {tech}, or write your own. Those the model read on a page are marked: tick them only
          if you agree.</>}
        shows="The leaders' view and the Point of View. Picking them is one of the things the owner's record needs to reach Aligned (below).">
        <Bottlenecks key={`${a.fabric_id}:${data.finance.bottlenecks?.decision._id ?? ""}`} picked={data.finance.bottlenecks}
          options={lists.fabrics[a.fabric_id] ? lists.fabrics[a.fabric_id].bottlenecks ?? [] : undefined}
          suggested={a.suggested_bottlenecks} pages={data.cited_pages} techId={techId} fabricId={a.fabric_id} onChanged={done} />
      </Section>

      <Section title={`How far Tata has got with it in ${a.fabric}`}
        summary={data.finance.step ? `reached ${data.finance.step.name}` : "not recorded yet"}
        what={<>Tata&apos;s path to scale: the {data.path.length} steps a technology goes through at Tata, from a first look
          (Evaluation) to full investment. Each step says the proof needed to reach it and the decision it then lets Tata make.</>}
        todo="Record the step Tata has actually reached. Only a person sets this; the radar then shows what's still missing for the next step."
        shows="The leaders' view and the Point of View.">
        <PathToScale steps={data.path} current={data.finance.step} next={data.finance.next_step} decision={data.finance.step_decision}
          techId={techId} fabricId={a.fabric_id} onChanged={done} />
      </Section>

      <Section title={`Who owns it at Tata, and what's next in ${a.fabric}`}
        what={<>The person at Tata accountable for {tech} in {a.fabric}, their next action and its date, and what&apos;s committed:
          people, budget or a trial. Typed in by people; it never changes a score.</>}
        todo="Record the owner and the next action; add what's committed when it is."
        shows="The leaders' view shows the state next to the technology, so leaders see which bets have an owner and resources.">
        {/* drawn again when the path step or blockers change: the state follows them */}
        <LeaderRecord key={`${a.fabric_id}:${data.finance.step_decision?._id ?? ""}:${data.finance.bottlenecks?.decision._id ?? ""}`}
          techId={techId} fabricId={a.fabric_id} onChanged={done} />
      </Section>

      <Section id="finance" title={`Finance in ${a.fabric}`}
        summary={hasFigures(data.finance) ? "figures entered" : "no figures yet"}
        what="What it could earn or protect a year, when it pays back, and the revenue it needs to break even, worked out from figures people enter."
        todo="Enter the figures you have. Each one says where it came from; the model never writes one."
        shows="The Point of View, and what the next step needs above.">
        <FinanceCard key={`${a.fabric_id}:${data.finance.entered?._id ?? ""}`} f={data.finance} techId={techId} fabricId={a.fabric_id} onChanged={done} />
      </Section>

      <details className="mt-3 rounded-card border border-line bg-white px-5 py-3">
        <summary className="cursor-pointer text-sm font-semibold">Score detail: the three scores</summary>
        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {AXES.map(([k, label]) => {
            const ax = a.tora?.[k];
            return (
              <span key={k} className="flex items-center gap-2">
                <span className="text-muted">{label}</span>
                <span className={`px-1.5 py-0.5 font-mono tabular-nums ${scoreShade(ax?.score ?? null)}`}>{ax?.score != null ? formatScore(ax.score) : "—"}</span>
                <span className="text-xs text-muted">{ax ? `${ax.scored} of ${ax.of} measures` : ""}</span>
              </span>
            );
          })}
        </div>
      </details>

      {(a.watch_metrics?.length ?? 0) > 0 && (
        <details className="mt-3 rounded-card border border-line bg-white px-5 py-3">
          <summary className="cursor-pointer text-sm font-semibold">Metrics to watch · {a.watch_metrics!.length}</summary>
          <div className="mt-2"><WatchMetrics metrics={a.watch_metrics!} /></div>
        </details>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 text-sm text-muted">
        <span>Assessed {formatDay(a.created_at)} · read {plural(a.doc_count, "page")}</span>
        <EvidenceLine assessments={[{ evidence_runs: a.evidence_runs }]} />
        <Link href={`/admin/scoring/assessments/${a.scoring_run_id}`} className="mt-3 text-link hover:underline">Assessment run →</Link>
      </div>
    </div>
  );
}
