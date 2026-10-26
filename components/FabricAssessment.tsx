"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ActButton from "@/components/ActButton";
import AddLink from "@/components/AddLink";
import BackendError from "@/components/BackendError";
import Bottlenecks from "@/components/Bottlenecks";
import ChoiceForm from "@/components/ChoiceForm";
import DecisionNote from "@/components/DecisionNote";
import FabricLabel from "@/components/FabricLabel";
import FinanceCard from "@/components/FinanceCard";
import FindEvidence from "@/components/FindEvidence";
import LeaderRecord from "@/components/LeaderRecord";
import PathToScale from "@/components/PathToScale";
import Section, { type PartState } from "@/components/Section";
import UseCases from "@/components/UseCases";
import WatchMetrics, { SIGNS_EXPLAINED, type WatchMetric } from "@/components/WatchMetrics";
import { fetchJson } from "@/lib/api";
import { decide, type Decision } from "@/lib/decisions";
import { orList, plural } from "@/lib/format";
import { useHood } from "@/lib/hood";
import { AXIS_MEANING, formatScore, HORIZON_TERM, noPriorityReason, type Placement, PRIORITY_LEGEND, SCORE_NAMES } from "@/lib/scoring";
import { LEADER_STATES } from "@/components/frontier/items";
import { beforePublishing, type FabricOpen, toSettle } from "@/lib/open";
import { PRIORITY, scoreShade } from "@/lib/theme";
import { type Finance, FINANCE_SHOWN, hasFigures, type Pages, type PathStep, type SuggestedBlocker, type UseCase, useValueLists } from "@/lib/value";

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
  waiting_for_tata: "waiting for your figure", unscored: "unscored",
};
const SCOPE_WORDS = { technology: "Judged for the technology as a whole", fabric: "Judged in this fabric",
  tata: "Entered by your team" };
const EMPTY: FabricOpen = { fabric_id: "", fabric: "", priority: null, unscored: 0, blocking: false, waiting_for_tata: 0,
  override_moved: false, suggested_use_cases: [], finance_missing: [], step: null, next_step: null, blockers: true, owner: true,
  leader: "undefined", resources: false };
/** One row of Tata's plan's "What's recorded": ✓ or ○, what it is, and the
 *  part itself (`id`: Waiting on you's anchor). */
function Recorded({ id, ok, label, children }: { id?: string; ok: boolean; label: string; children: React.ReactNode }) {
  return (
    <li id={id} className="grid scroll-mt-20 grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 gap-y-1 py-2.5 text-[13px] md:grid-cols-[1.25rem_13rem_minmax(0,1fr)]">
      <span aria-hidden className={ok ? "text-emerald-700" : "text-muted"}>{ok ? "✓" : "○"}</span>
      <span className="font-medium">{label}<span className="sr-only">{ok ? ": recorded" : ": not recorded"}</span></span>
      <div className="col-start-2 md:col-start-3">{children}</div>
    </li>
  );
}

const PART = "mt-4 border-t border-neutral-100 pt-3 text-[13.5px] font-semibold scroll-mt-20";
const PILL = "rounded-full border border-line bg-white px-3 py-1 text-[13px] hover:bg-ground";
const AXES = Object.entries(SCORE_NAMES);

const PRIZE: Record<string, string> = { high: "big", mid: "moderate", low: "small" };
const LEADER: Record<FabricOpen["leader"], PartState> = { undefined: { tone: "open", label: "No owner yet" },
  defined: { tone: "open", label: "Defined" }, aligned: { tone: "open", label: "Aligned" },
  integrated: { tone: "done", label: "Integrated" } };

/** Why the priority, as a sentence: "it arrives mid-term (how soon: 6 of 10,
 *  from 2 of 2 measures) and the prize is big (how big: 8 of 10, …)".
 *  `waiting`: how-big measures unscored because they wait for Tata's figures. */
function because(horizon: string | null, t: Composite, p: Composite, waiting = 0) {
  const of = (c: Composite, w = 0) => `${formatScore(c.score!)} of 10, from ${c.scored} of ${plural(c.of, "measure")}`
    + (w > 0 ? `; ${w} ${w === 1 ? "waits" : "wait"} for your figures` : "");
  const soon = t.score == null ? "how soon it arrives isn't scored yet"
    : `it arrives ${horizon ? HORIZON_TERM[horizon] ?? horizon : t.band ?? ""} (how soon: ${of(t)})`;
  const big = p.score == null ? "how big the prize is isn't scored yet"
    : `the prize is ${PRIZE[p.band ?? ""] ?? p.band ?? ""} (how big: ${of(p, Math.min(waiting, p.of - p.scored))})`;
  return `${soon} and ${big}`;
}

/** Open the part an anchor names (and any fold it sits in), then bring it into view. */
function jump(hash: string) {
  const el = hash && document.getElementById(hash);
  if (!el) return;
  for (let d: HTMLElement | null = el; d; d = d.parentElement?.closest("details") ?? null) {
    if (d instanceof HTMLDetailsElement) d.open = true;
  }
  el.scrollIntoView();
}

/** A technology's latest assessment, one tab per fabric (?fabric=), with the
 *  choices people make before publishing: override the priority, score a
 *  measure by hand or accept its gap, enter Tata's measures, and undo. Each
 *  tab's badge counts what needs a person before publishing there (`open`). */
export default function FabricAssessment({ techId, open, notAssessedIn, onChanged }: {
  techId: string;
  open?: FabricOpen[];
  notAssessedIn?: string[];
  onChanged?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const hood = useHood();
  const fabric = params.get("fabric") ?? "";
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [form, setForm] = useState<string | null>(null); // which form is open: "override" or a measure's id
  const [why, setWhy] = useState<Record<string, boolean>>({});
  const [picking, setPicking] = useState(false); // the blockers' checklist, opened from "Pick blockers…"
  const lists = useValueLists();

  // only the latest load's answer is applied, so a late one for another tab can't replace it
  const asked = useRef(0);
  const load = useCallback(() => {
    const n = ++asked.current;
    return fetchJson<Resp>(`/api/technologies/${techId}/assessment${fabric ? `?fabric=${encodeURIComponent(fabric)}` : ""}`)
      .then((d) => { if (n === asked.current) { setData(d); setError(null); } })
      .catch((e) => { if (n === asked.current) setError(e); });
  }, [techId, fabric]);
  const latest = useRef(load); // a save that ends after a tab change reloads the tab now chosen
  useEffect(() => { latest.current = load; load(); }, [load]);
  // a link to a part ("#finance" from the Point of View, "#measures" from Waiting on you, "#finance" from the
  // path's next step) lands on it once it's drawn, opening it if it's folded
  const drawn = data?.assessment._id;
  useEffect(() => {
    if (drawn) jump(window.location.hash.slice(1));
    const onHash = () => jump(window.location.hash.slice(1));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [drawn]);

  const choose = (f: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("fabric", f);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const done = async () => {
    setForm(null);
    await latest.current();
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
  const fo = open?.find((o) => o.fabric_id === a.fabric_id);
  const undecided = (a.suggested_use_cases ?? []).filter((x) => !data.use_case_decisions[x.key]).length;
  const poc = data.path.find((st) => st._id === "proof_of_concept");
  const notNeeded = !data.finance.asks && !data.finance.entered;
  // what's recorded for Tata's plan: the step, an owner, the blockers, resources
  const recorded = [!!data.finance.step, !!fo?.owner, !!data.finance.bottlenecks, !!fo?.resources];
  const notAssessed = (notAssessedIn?.length ?? 0) > 0
    && `Not assessed in ${orList(notAssessedIn!)}: judged not relevant to it before assessing.`;

  const row = ({ mid, r, m }: { mid: string; r: Result; m?: MeasureDef }) => {
    const name = m?.name ?? mid;
    const open = why[mid];
    // what a person can do when the pages don't settle it: score it by hand
    // (or enter Tata's figure), or leave it out; a score the model gave can
    // be replaced by a person's too, the model's staying beside it
    const fill: { kind: "hand_score" | "tata_entry"; openLabel: string; skipLabel: string | null; label: string;
      placeholder: string } | null = r.state === "unscored"
      ? { kind: "hand_score", openLabel: "Score by hand", skipLabel: "Accept the gap",
        label: r.scope === "technology" ? "Score, 0–10 (applies in every fabric)" : "Score, 0–10",
        placeholder: "what you know that the pages don't show" }
      : r.state === "scored"
        ? { kind: "hand_score", openLabel: "Score by hand", skipLabel: null,
          label: r.scope === "technology" ? "Your score, 0–10 (applies in every fabric)" : "Your score, 0–10",
          placeholder: `why it should differ from the model's ${r.score}` }
        : r.state === "waiting_for_tata"
          ? { kind: "tata_entry", openLabel: "Enter", skipLabel: "Leave it out", label: "Your figure, 0–10",
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
              <p className="mt-0.5 text-[13px] text-amber-900">Waiting for your figure, 0–10: Enter it, or Leave it out if there&apos;s none.</p>
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
                {fill.skipLabel && (
                  <ActButton label={fill.skipLabel} className={PILL} onDone={done}
                    run={() => decide({ kind: "accept_gap", tech_id: techId, fabric_id: a.fabric_id, measure_id: mid })} />
                )}
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
      {/* the fabric bar stays in view while the parts below scroll */}
      <div className="sticky top-0 z-20 -mx-2 flex flex-col gap-1 bg-ground/95 px-2 py-2 backdrop-blur sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
      <nav aria-label="Fabrics" className="flex flex-wrap gap-1.5">
        {data.fabrics.map((f) => {
          const on = f.fabric_id === a.fabric_id;
          const mine = open?.find((o) => o.fabric_id === f.fabric_id) ?? {
            ...EMPTY, unscored: f.states.unscored ?? 0, waiting_for_tata: f.states.waiting_for_tata ?? 0 };
          const todo = beforePublishing(mine);
          return (
            <button key={f.fabric_id} type="button" aria-current={on ? "page" : undefined} onClick={() => choose(f.fabric_id)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[13px] ${on ? "border-navy bg-navy text-white" : "border-line bg-white hover:bg-ground"}`}>
              {f.fabric}
              <span className={`font-mono text-[11px] ${on ? "text-white/80" : "text-muted"}`}>
                {f.priority ?? "no priority"}{f.override ? " ✎" : ""}
              </span>
              {todo.length > 0 && (
                <span className={`rounded-full px-1.5 text-[10.5px] ${on ? "bg-white/20" : "bg-amber-100 text-amber-900"}`}
                  title={`Before publishing: ${todo.map((t) => t.label).join("; ")}`}>{toSettle(mine)}</span>
              )}
            </button>
          );
        })}
      </nav>
      {notAssessed && <span className="hidden text-[12px] text-muted sm:inline">{notAssessed}</span>}
      </div>
      {/* on a phone the note sits under the bar, so the bar stays one row */}
      {notAssessed && <p className="text-[12px] text-muted sm:hidden">{notAssessed}</p>}

      <div key={a.fabric_id}>

      {/* the priority, how it was reached, and a person's override */}
      <section id="priority" className="mt-3 scroll-mt-20 rounded-card border border-line bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <FabricLabel id={a.fabric_id} name={a.fabric} />
          <span className="flex items-center gap-2 text-sm">
            <span className="text-muted">Priority</span>
            <span className={`px-2.5 py-1 font-mono text-base ${e.priority ? PRIORITY[e.priority] : "text-neutral-400"}`}>
              {e.priority ?? "—"}
            </span>
            {e.override && <span className="text-[13px] text-muted">override in force (computed {e.computed_priority ?? "none"})</span>}
          </span>
          <span className="text-sm text-muted">
            Horizon {e.horizon ? `${e.horizon}, ${HORIZON_TERM[e.horizon] ?? ""}` : "—"}
          </span>
          <span className="ml-auto">
            {form !== "override" && (
              <button type="button" onClick={() => setForm("override")}
                className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-ground">
                {e.override ? "Change the override…" : "Override priority…"}
              </button>
            )}
          </span>
        </div>
        {(e.override ? e.computed_priority : e.priority) && (
          <p className="mt-2 text-[13.5px] text-neutral-800">
            <b>{e.override ? `Computed ${e.computed_priority}` : e.priority}</b> because{" "}
            {because(e.horizon, a.placement.timeline, a.placement.potential,
              Object.values(a.measures).filter((r) => r.scope === "tata" && r.score == null).length)}.
          </p>
        )}
        <p className="mt-1 text-[12px] text-muted">{PRIORITY_LEGEND}; the horizon says how soon it arrives. The priority comes
          from how soon × how big; the three scores below describe the case and feed the Point of View.</p>
        <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          <span className="text-muted">The three scores the Point of View explains:</span>
          {AXES.map(([k, label]) => {
            const ax = a.tora?.[k];
            return (
              <span key={k} className="flex items-center gap-1.5" title={AXIS_MEANING[k]}>
                <span className="text-neutral-700">{label}</span>
                <span className={`px-1.5 font-mono tabular-nums ${scoreShade(ax?.score ?? null)}`}>{ax?.score != null ? formatScore(ax.score) : "—"}</span>
                <span className="text-xs text-muted">{ax ? `${ax.scored} of ${ax.of}` : ""}</span>
              </span>
            );
          })}
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
      <Section id="measures" title={`Measures in ${a.fabric}`}
        state={needs.length ? { tone: "todo", label: `${needs.length} to settle` } : { tone: "done", label: "All settled" }}
        closed={!needs.length}
        summary={(["scored", "scored_by_person", "gap_accepted", "waiting_for_tata", "unscored"] as State[])
          .filter((s) => counts[s]).map((s) => `${counts[s]} ${STATE_WORDS[s]}`).join(" · ")}
        what="What the radar scores, 0 to 10, from the pages; together they set the priority above."
        todo={needs.length ? "Settle the ones under Needs a person: score by hand, enter your figure, or leave it out."
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

      <Section id="use-cases" title={`Use cases: where the value lands in ${a.fabric}`}
        state={undecided ? { tone: "todo", label: `${plural(undecided, "suggestion")} to accept or reject` } : undefined}
        summary={a.use_cases?.length ? plural(a.use_cases.length, "use case") : "none from the pages yet"}
        what={<>Ways Tata could make or save money with {tech} in {a.fabric}, read from its pages. Each has two levers, how it
          earns (contribution) and how it cuts the cost of delivering (delivery cost), and the capital it needs.</>}
        todo={a.suggested_use_cases?.length ? "Accept or reject the use cases the model suggested without pages."
          : "Read them; the model never writes a money figure."}
        shows="The Point of View, and the leaders' view.">
        <UseCases cases={a.use_cases ?? []} suggested={a.suggested_use_cases ?? []} none={a.no_use_case ?? null}
          failed={a.value_failed} decisions={data.use_case_decisions} pages={data.cited_pages} lists={lists} techId={techId}
          fabricId={a.fabric_id} onChanged={done} compact />
      </Section>

      <Section id="plan" title={`Tata's plan for it in ${a.fabric}`}
        state={fo ? { ...LEADER[fo.leader], label: `Commitment: ${LEADER[fo.leader].label} · ${recorded.filter(Boolean).length} of 4 recorded`
          // the path to scale beside it, as the Point of View says it
          + (fo.step ? ` · ${fo.step}, step ${data.path.findIndex((x) => x.name === fo.step) + 1} of ${data.path.length}` : "") } : undefined}
        closed={fo?.leader === "integrated"}
        what={<>Who owns {tech} in {a.fabric}, where Tata is on its path to scale, and what could stop it. Typed in by people; it
          never changes a score.</>}
        todo="Record the step Tata has reached, the owner and next action, and the blockers that apply; add people, budget or a trial when they're committed. Each one recorded raises the commitment."
        shows="The leaders' view shows the commitment beside the technology, so leaders see which bets have an owner and resources; the Point of View takes all of it in, as Tata's own record, when it's next written: rewrite it to bring it up to date.">
        <div id="path" className="scroll-mt-20">
          <h4 className={`${PART} mt-1 border-t-0 pt-0`}>Where Tata is <span className="font-normal text-muted">· its path to scale, Tata&apos;s process</span></h4>
          <PathToScale steps={data.path} current={data.finance.step} next={data.finance.next_step} decision={data.finance.step_decision}
            techId={techId} fabricId={a.fabric_id} finance={data.finance} onChanged={done} />
        </div>
        <h4 className={PART}>What&apos;s recorded <span className="font-normal text-muted">· sets the commitment leaders see</span></h4>
        <ul className="divide-y divide-neutral-100">
          <Recorded ok={recorded[0]} label="The step Tata has reached">
            {data.finance.step ? `${data.finance.step.name}, step ${data.finance.step.order} of ${data.path.length}`
              : <span className="text-muted">Not recorded yet: Record the step, above.</span>}
          </Recorded>
          <Recorded id="owner" ok={recorded[1]} label="Owner and next action">
            {/* drawn again when the path step or blockers change: the commitment follows them */}
            <LeaderRecord key={`${a.fabric_id}:${data.finance.step_decision?._id ?? ""}:${data.finance.bottlenecks?.decision._id ?? ""}`}
              techId={techId} fabricId={a.fabric_id} onChanged={done} />
          </Recorded>
          <Recorded id="blockers" ok={recorded[2]} label="What could stop it scaling">
            {data.finance.bottlenecks || picking ? (
              <>
                {!data.finance.bottlenecks && (
                  <p className="mb-1.5 text-[12.5px] text-neutral-700">
                    Problems that commonly stop a technology growing into a real business in {a.fabric}, such as customers&apos;
                    data being hard to move ({a.fabric}&apos;s list is kept in{" "}
                    <Link href="/admin/scoring/fabrics" className="text-link hover:underline">Setup › Fabrics</Link>). Tick the ones
                    that apply, or write your own; those the model read on a page are marked: tick them only if you agree.
                  </p>
                )}
                <Bottlenecks key={`${a.fabric_id}:${data.finance.bottlenecks?.decision._id ?? ""}`} picked={data.finance.bottlenecks}
                  options={lists.fabrics[a.fabric_id] ? lists.fabrics[a.fabric_id].bottlenecks ?? [] : undefined}
                  suggested={a.suggested_bottlenecks} pages={data.cited_pages} techId={techId} fabricId={a.fabric_id}
                  onCancel={data.finance.bottlenecks ? undefined : () => setPicking(false)}
                  onChanged={() => { setPicking(false); done(); }} />
              </>
            ) : (
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-muted">{a.suggested_bottlenecks?.length
                  ? `None picked yet; ${a.suggested_bottlenecks.length} suggested from the pages.` : "None picked yet."}</span>
                <button type="button" onClick={() => setPicking(true)}
                  className="rounded-full border border-line bg-white px-3 py-0.5 text-[13px] hover:bg-ground">Pick blockers…</button>
              </span>
            )}
          </Recorded>
          <Recorded ok={recorded[3]} label="People, budget or a trial">
            <span className="text-muted">{recorded[3] ? "Recorded: see the owner's row."
              : recorded[1] ? "Not committed yet: add them with Change, in the owner's row, when they are."
              : "Recorded with the owner and next action, once committed."}</span>
          </Recorded>
        </ul>
        <p className="mt-2 text-[12px] text-muted">
          Commitment rises as these are recorded:{" "}
          {LEADER_STATES.slice(1).map((st, i) => (
            <span key={st.id}>{i > 0 && " → "}<b className="font-medium text-ink">{st.name}</b> ({st.means})</span>
          ))}.
        </p>
      </Section>

      {FINANCE_SHOWN && (
      <Section id="finance" title={`Finance in ${a.fabric}`}
        state={fo?.finance_missing.length ? { tone: "todo", label: "Figures to enter" }
          : hasFigures(data.finance) ? { tone: "done", label: "Figures entered" }
          : notNeeded ? { tone: "open", label: "Not needed yet" } : { tone: "open", label: "No figures yet" }}
        closed={notNeeded}
        what="What it could earn or protect a year, when it pays back, and the revenue it needs to break even, worked out from figures people enter."
        todo="Enter the figures you have. Each one says where it came from; the model never writes one."
        shows="The Point of View, and what the next step needs in Tata's plan above.">
        <FinanceCard key={`${a.fabric_id}:${data.finance.entered?._id ?? ""}`} f={data.finance} techId={techId} fabricId={a.fabric_id}
          askedFrom={poc ? `${poc.name} (step ${poc.order})` : undefined} onChanged={done} />
      </Section>
      )}

      {(a.watch_metrics?.length ?? 0) > 0 && (
        <details className="mt-3 rounded-card border border-line bg-white px-5 py-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Signs to watch · {a.watch_metrics!.length}
            {a.watch_metrics!.some((m) => m.crossed) && <span className="ml-2 font-normal text-amber-900">
              {a.watch_metrics!.filter((m) => m.crossed).length} crossed</span>}
          </summary>
          <p className="mt-1 text-[12.5px] text-muted">{SIGNS_EXPLAINED}</p>
          <div className="mt-2"><WatchMetrics metrics={a.watch_metrics!} owned={{ techId, onChanged: done }} /></div>
        </details>
      )}
      </div>
    </div>
  );
}
