"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import Hood from "@/components/Hood";
import PageHeader from "@/components/PageHeader";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import StatusChip from "@/components/StatusChip";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { duration, formatTime } from "@/lib/format";
import { LIVE_DOT } from "@/lib/theme";

/* ── data ──────────────────────────────────────────────────────────── */

type SourceStat = {
  category: string;
  source_id: string;
  source_url: string;
  source_name: string;
  source_start_date_time: string;
  source_end_date_time: string | null;
  pages_visited: number;
  documents: number;
  new_documents: number;
  error: string | null;
  incomplete?: boolean;
  incomplete_note?: string | null;
};

type SubstageEvent = { stage: string; substage: string; at: string };
type PhaseEvent = { phase: string; at: string };

type Resolve = {
  id: string;
  status: string;
  phase: string;
  phase_history?: PhaseEvent[];
  llm_calls: number;
  started_at: string;
  finished_at?: string;
  error?: string;
} & Record<string, unknown>;

type UsedIn = {
  scoring_run_id: string;
  status: string | null;
  started_at: string | null;
  technologies: number;
  povs: number;
};

type Run = {
  id: string;
  status: string;
  stage?: string;
  stage_history?: { stage: string; at: string }[];
  substage_history?: SubstageEvent[];
  resolve_id?: string;
  resolve?: Resolve;
  run_start_date_time: string;
  run_end_date_time: string | null;
  error: string | null;
  totals: {
    sources: number; pages_visited: number; documents: number; new_documents: number;
    signals?: number; other_signals?: number; set_aside?: number;
  };
  sources: SourceStat[];
  used_in?: UsedIn[];
  latest_activity?: { scoring_run_id: string; status: string; started_at: string } | null;
  assessments_before_upgrade?: number;
  analysis_errors?: { reason: string; detail: string; pages: number; sources: string[] }[];
};

type Kind = "llm" | "free" | "outcome";
type NodeState = "done" | "active" | "failed" | "pending";

/* ── stage copy (under the hood) ───────────────────────────────────── */

const STAGES = ["orchestrating", "crawling", "resolving", "done"] as const;

const STAGE_INFO: Record<string, {
  eyebrow: string; title: string; kind: Kind; box: string;
  blurb: string; inn: string; out: string;
}> = {
  orchestrating: {
    eyebrow: "STAGE 1 · AGENT", title: "Planning", kind: "llm",
    box: "Plan the run, divide the register by horizon",
    blurb: "The orchestrator deep agent plans the run and divides the enabled register into one workload each for H1, H2 and H3. The fan-out itself is deterministic — every enabled source gets collected no matter what the agent decides.",
    inn: "the enabled source register, run scope",
    out: "a run plan — three horizon workloads",
  },
  crawling: {
    eyebrow: "STAGE 2 · AGENTS × N", title: "Collecting", kind: "llm",
    box: "Collect every enabled source, check each new page for signals",
    blurb: "One supervisor per horizon partitions its slice into scout batches. A website is crawled (start pages and feeds → links → sitemap → headless browser); a data source runs its saved searches. Content-hash dedupe means an unchanged page is never paid for twice; each new page gets one model call — summary, technology tags, the scout's take, and the signals from the list.",
    inn: "the three horizon workloads, the run's signal list",
    out: "documents with summaries and signals",
  },
  resolving: {
    eyebrow: "STAGE 3 · CHAINED", title: "Organizing technologies", kind: "llm",
    box: "Collapse raw tags into canonical technologies",
    blurb: "Documents arrive tagged with raw strings; assessment needs one canonical name per technology. The resolver merges cheapest step first — deterministic normalization, then the pinned-alias skip, and only what's left reaches the model as merge-groups with the register passed in as fixed anchors. Pages set aside by a Can ignore rule are left out.",
    inn: "raw technology strings from all documents",
    out: "canonical technologies + stamped documents",
  },
  done: {
    eyebrow: "OUTCOME", title: "Evidence", kind: "outcome",
    box: "Summarized · signals called out · organized",
    blurb: "The run's artifact: summarized, signal-checked and organized documents. Assessment reads this store whenever you choose to assess.",
    inn: "everything above",
    out: "evidence, ready for assessment",
  },
};

const ORCH_SUBS: { id: string; title: string; kind: Kind; blurb: string }[] = [
  { id: "planning", title: "Planning", kind: "llm",
    blurb: "The orchestrator agent reads the enabled register and drafts the run plan." },
  { id: "dispatching", title: "Dispatching", kind: "free",
    blurb: "The plan becomes per-horizon supervisor workloads — a deterministic fan-out, so no enabled source can be forgotten." },
];

const RESOLVE_PHASES: { id: string; title: string; kind: Kind; blurb: string }[] = [
  { id: "gathering", title: "Gathering + clean", kind: "free",
    blurb: "Collect every raw string from the documents (set-aside pages excluded) and apply the deterministic clean — case, hyphens and spacing merged at zero cost — plus the pinned-alias skip: anything the register already knows never returns to the model." },
  { id: "llm pass 1", title: "Model pass 1", kind: "llm",
    blurb: "technology_resolve over the leftovers in alphabetical chunks: merge-groups only, with the established register as fixed anchors that new names fold into but never rename." },
  { id: "llm pass 2", title: "Model pass 2", kind: "llm",
    blurb: "A second pass over the resulting canonicals by frequency, catching merges that straddled chunk boundaries." },
  { id: "writing register", title: "Write register", kind: "free",
    blurb: "Upsert canonical technologies and their aliases into the register — admin pins survive untouched." },
  { id: "stamping documents", title: "Stamp documents", kind: "free",
    blurb: "Stamp every document with its resolved canonical names and recompute per-technology stats." },
  { id: "done", title: "Register updated", kind: "outcome",
    blurb: "The technology register reflects this collection's pages." },
];

/* ── state derivation ──────────────────────────────────────────────── */

function stageStates(run: Run): Record<string, NodeState> {
  const hist = (run.stage_history ?? []).filter((h) => (STAGES as readonly string[]).includes(h.stage));
  const currentIdx = hist.length ? STAGES.indexOf(hist[hist.length - 1].stage as typeof STAGES[number]) : -1;
  const live = run.status === "running" || run.status === "terminating";
  const stopped = run.status === "failed" || run.status === "terminated";
  const out: Record<string, NodeState> = {};
  STAGES.forEach((s, i) => {
    if (run.status === "completed") out[s] = "done";
    else if (i < currentIdx) out[s] = "done";
    else if (i === currentIdx) out[s] = live ? "active" : stopped ? "failed" : "done";
    else out[s] = "pending";
  });
  return out;
}

function stageTimes(run: Run, stage: string): { start?: string; end?: string } {
  const hist = run.stage_history ?? [];
  const i = hist.findIndex((h) => h.stage === stage);
  if (i < 0) return {};
  return { start: hist[i].at, end: hist[i + 1]?.at ?? run.run_end_date_time ?? undefined };
}

/** States for a fixed ordered sub-list driven by timestamped events. */
function eventStates(
  subs: { id: string }[], events: { id: string; at: string }[],
  parent: NodeState,
): Record<string, { state: NodeState; start?: string; end?: string }> {
  const out: Record<string, { state: NodeState; start?: string; end?: string }> = {};
  subs.forEach((sub) => {
    const ev = events.find((e) => e.id === sub.id);
    if (!ev) {
      out[sub.id] = { state: parent === "done" ? "done" : "pending" };
      return;
    }
    const next = events[events.findIndex((e) => e.id === sub.id) + 1];
    if (next || parent === "done") out[sub.id] = { state: "done", start: ev.at, end: next?.at };
    else if (parent === "active") out[sub.id] = { state: "active", start: ev.at };
    else if (parent === "failed") out[sub.id] = { state: "failed", start: ev.at };
    else out[sub.id] = { state: "done", start: ev.at };
  });
  return out;
}

function sourceState(s: SourceStat, parent: NodeState): NodeState {
  if (s.error) return "failed";
  if (s.source_end_date_time) return "done";
  return parent === "active" ? "active" : parent === "failed" ? "failed" : "done";
}

/* ── small building blocks ─────────────────────────────────────────── */

function KindBadge({ kind }: { kind: Kind }) {
  if (kind === "llm")
    return <span className="rounded-[2px] bg-azure px-1.5 py-px font-mono text-[9px] font-semibold text-ink">MODEL</span>;
  if (kind === "outcome")
    return <span className="rounded-[2px] border border-navy/30 bg-white px-1.5 py-px font-mono text-[9px] font-semibold text-navy">OUTCOME</span>;
  return <span className="rounded-[2px] border border-faint bg-white px-1.5 py-px font-mono text-[9px] font-semibold text-muted">FREE</span>;
}

function StateBadge({ state }: { state: NodeState }) {
  if (state === "done")
    return <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-200 text-[9px] font-bold text-muted">✓</span>;
  if (state === "failed")
    return <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-failed-dot text-[9px] font-bold text-ink">✕</span>;
  return null;
}

// model steps are azure, free steps outlined, the outcome has a navy edge
const BOX: Record<Kind, string> = {
  llm: "border-2 border-azure/40 bg-azure/10",
  free: "border border-faint bg-white",
  outcome: "border border-l-4 border-line border-l-navy bg-white",
};

function FlowBox({ eyebrow, title, kind, state, sub, onClick, drill }: {
  eyebrow: string; title: string; kind: Kind; state: NodeState;
  sub?: string; onClick?: () => void; drill?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full rounded-[3px] px-3.5 py-2.5 text-left transition-opacity ${
        state === "failed" ? "border-2 border-failed-dot bg-failed/5" : BOX[kind]} ${state === "pending" ? "opacity-45" : ""} ${onClick ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
    >
      {state === "active" && <span aria-hidden className="stage-ants pointer-events-none absolute -inset-px" />}
      <StateBadge state={state} />
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[9px] font-semibold tracking-[.14em] text-muted">{eyebrow}</span>
        <KindBadge kind={kind} />
      </span>
      <span className="mt-0.5 block text-[15px] font-semibold leading-tight">
        {title}
        {drill && <span className="ml-1.5 font-mono text-[11px] text-faint">›</span>}
      </span>
      {sub && (
        <span className={`mt-0.5 block font-mono text-[10px] ${state === "active" ? "text-ink" : "text-muted"}`}>
          {sub}
        </span>
      )}
    </button>
  );
}

function Connector() {
  return <div className="py-0.5 text-center text-[11px] leading-none text-faint">▼</div>;
}

function InOut({ inn, out }: { inn: string; out: string }) {
  return (
    <div className="mt-4 flex flex-col gap-1.5 border-t border-dashed border-line pt-3">
      <div className="grid grid-cols-[42px_1fr] items-baseline gap-2">
        <span className="font-mono text-[10px] font-semibold text-muted">IN</span>
        <span className="text-[13px]">{inn}</span>
      </div>
      <div className="grid grid-cols-[42px_1fr] items-baseline gap-2">
        <span className="font-mono text-[10px] font-semibold text-navy">OUT</span>
        <span className="text-[13px]">{out}</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[2px] border border-line bg-ground px-3 py-2">
      <div className="font-mono text-[9px] font-semibold tracking-[.12em] text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const STATE_CHIP: Record<NodeState, string> = {
  done: "bg-neutral-100 text-muted",
  active: "bg-azure/10 text-ink",
  failed: "bg-failed/10 text-failed",
  pending: "bg-ground text-muted",
};

function DetailHeader({ eyebrow, title, kind, state, timing }: {
  eyebrow: string; title: string; kind?: Kind; state?: NodeState; timing?: string;
}) {
  return (
    <div className="border-b-2 border-ink pb-3">
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[10px] font-semibold tracking-[.16em] text-muted">{eyebrow}</span>
        {kind && <KindBadge kind={kind} />}
        {state && (
          <span className={`px-1.5 py-px font-mono text-[10px] uppercase ${STATE_CHIP[state]}`}>
            {state === "active" ? "in progress" : state}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-3">
        <span className="text-[26px] font-semibold leading-tight tracking-[-.01em]">{title}</span>
        {timing && <span className="font-mono text-xs text-muted">{timing}</span>}
      </div>
    </div>
  );
}

const ACCESS_ICON: Record<string, { icon: string; title: string }> = {
  crawl: { icon: "🌐", title: "Website — crawled" },
  query: { icon: "⌕", title: "Data source — saved searches" },
  none: { icon: "🔒", title: "Never collected" },
};

/** The per-source table, grouped by horizon — scales to hundreds of
 *  sources. Rows open the documents the source gave in this run. */
function SourcesTable({ run, runId, parent, running, access }: {
  run: Run; runId: string; parent: NodeState; running: boolean; access: Record<string, string>;
}) {
  const router = useRouter();
  if (run.sources.length === 0)
    return (
      <p className="mt-3 border border-line bg-ground px-3 py-2 text-[13px] text-muted">
        {running ? "Scouts are on their way…" : "No sources were collected."}
      </p>
    );
  const groups = new Map<string, SourceStat[]>();
  for (const s of run.sources) {
    if (!groups.has(s.category)) groups.set(s.category, []);
    groups.get(s.category)!.push(s);
  }
  return (
    <div className="mt-3 overflow-x-auto rounded-card border border-line bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[.12em] text-muted">
            <th className="px-4 py-2.5 font-semibold">Source</th>
            <th className="px-4 py-2.5 font-semibold">Visited</th>
            <th className="px-4 py-2.5 font-semibold">Saved · new</th>
            <th className="px-4 py-2.5 font-semibold">Duration</th>
            <th className="px-4 py-2.5 font-semibold">Note</th>
          </tr>
        </thead>
        <tbody>
          {[...groups.entries()].map(([category, sources]) => (
            <Fragment key={category}>
              <tr className="bg-ground">
                <td colSpan={5} className="px-4 py-1.5 font-mono text-[10px] font-semibold tracking-[.14em]">
                  {category} · {sources.length} SOURCE{sources.length === 1 ? "" : "S"}
                </td>
              </tr>
              {sources.map((s) => {
                const st = sourceState(s, parent);
                const how = ACCESS_ICON[access[s.source_id] ?? "crawl"];
                return (
                  <tr
                    key={s.source_id}
                    onClick={() => router.push(`/admin/runs/${runId}/sources/${s.source_id}`)}
                    className="cursor-pointer border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        <span title={how.title} className="w-4 text-center text-xs">{how.icon}</span>
                        {s.source_name}
                        {st === "done" && <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-neutral-200 text-[8px] font-bold text-muted">✓</span>}
                        {st === "failed" && <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-failed-dot text-[8px] font-bold text-ink">✕</span>}
                        {s.incomplete && (
                          <span className="bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-normal uppercase">
                            ◐ Didn&apos;t finish
                          </span>
                        )}
                      </div>
                      <div className="pl-6 font-mono text-xs text-faint">{s.source_url}</div>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{s.pages_visited}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {s.documents}
                      <span className="text-faint"> · {s.new_documents} new</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {duration(s.source_start_date_time, s.source_end_date_time)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {s.error && <span className="block text-failed">{s.error}</span>}
                      {s.incomplete_note && <span className="block">{s.incomplete_note}</span>}
                      {!s.error && !s.incomplete_note && !s.source_end_date_time && (
                        <span className="inline-flex items-center gap-1.5"><span className={LIVE_DOT} />in progress</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── the three step cards ──────────────────────────────────────────── */

function StepCard({ step, title, children, href, linkText }: {
  step: number; title: string; children: React.ReactNode; href?: string; linkText?: string;
}) {
  return (
    <div className="flex min-w-[220px] flex-1 flex-col rounded-card border border-line bg-white px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">{step} · {title}</div>
      <div className="mt-2 flex-1 text-sm">{children}</div>
      {href && (
        <Link href={href} className="mt-2 text-xs text-link underline underline-offset-4">{linkText}</Link>
      )}
    </div>
  );
}

function Figures({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1">
      {items.map(([label, value]) => (
        <div key={label}>
          <div className="text-xl font-semibold tabular-nums leading-tight">{value}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── the page ──────────────────────────────────────────────────────── */

const REFRESH_RUNNING_MS = 5000;
const REFRESH_IDLE_MS = 30000;

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [terminateError, setTerminateError] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null); // drilled stage id, or null = top level
  const [selected, setSelected] = useState<string | null>(null); // node id within current level
  const [access, setAccess] = useState<Record<string, string>>({});
  const runningRef = useRef(false);

  const load = useCallback((silent = false) => {
    fetchJson<Run>(`/api/runs/${id}`)
      .then((d) => {
        setRun(d);
        setError(null);
        setRefreshedAt(new Date());
        runningRef.current = d.status === "running" || d.status === "terminating";
      })
      .catch((e) => {
        if (!silent) setError(e);
      });
  }, [id]);

  useEffect(() => {
    load();
    fetchJson<{ sources: { source_id: string; access?: string }[] }>("/api/sources")
      .then((d) => setAccess(Object.fromEntries(d.sources.map((s) => [s.source_id, s.access ?? "crawl"]))))
      .catch(() => {});
    const timer = setInterval(() => load(true), REFRESH_IDLE_MS);
    const fast = setInterval(() => {
      if (runningRef.current) load(true);
    }, REFRESH_RUNNING_MS);
    return () => { clearInterval(timer); clearInterval(fast); };
  }, [load]);

  async function terminate() {
    setTerminateError(null);
    try {
      await sendJson(`/api/runs/${id}/terminate`, "POST", {});
      load(true);
    } catch (e) {
      setTerminateError(e instanceof ApiError ? (e.detail ?? e.message) : "failed");
    }
  }

  const running = run?.status === "running";
  const states = run ? stageStates(run) : {};

  /* ladder for the current level (under the hood) */
  function ladder() {
    if (!run) return null;
    if (path === null) {
      return STAGES.map((s, i) => {
        const info = STAGE_INFO[s];
        const t = stageTimes(run, s);
        const st = states[s];
        const sub =
          st === "active" ? "in progress"
          : st === "done" && t.start ? (t.end ? duration(t.start, t.end) : "")
          : st === "failed" ? (run.status === "terminated" ? "stopped here" : "failed here")
          : info.box;
        const drills = s === "orchestrating" || s === "resolving";
        return (
          <div key={s}>
            {i > 0 && <Connector />}
            <FlowBox
              eyebrow={info.eyebrow} title={info.title} kind={info.kind} state={st} sub={sub}
              drill={drills}
              onClick={() => { if (drills) { setPath(s); setSelected(null); } else { setSelected(s); } }}
            />
          </div>
        );
      });
    }

    if (path === "orchestrating") {
      const events = (run.substage_history ?? [])
        .filter((e) => e.stage === "orchestrating")
        .map((e) => ({ id: e.substage, at: e.at }));
      const sub = eventStates(ORCH_SUBS, events, states.orchestrating);
      return ORCH_SUBS.map((s, i) => (
        <div key={s.id}>
          {i > 0 && <Connector />}
          <FlowBox
            eyebrow={`SUB-STAGE 1.${i + 1}`} title={s.title} kind={s.kind}
            state={sub[s.id].state}
            sub={sub[s.id].state === "done" && sub[s.id].start && sub[s.id].end ? duration(sub[s.id].start!, sub[s.id].end!) : sub[s.id].state === "active" ? "in progress" : undefined}
            onClick={() => setSelected(s.id)}
          />
        </div>
      ));
    }

    if (path === "resolving") {
      const events = (run.resolve?.phase_history ?? []).map((p) => ({ id: p.phase, at: p.at }));
      const parent = run.resolve
        ? (run.resolve.status === "completed" ? "done" : run.resolve.status === "failed" ? "failed" : "active") as NodeState
        : states.resolving;
      const sub = eventStates(RESOLVE_PHASES, events, parent);
      return RESOLVE_PHASES.map((s, i) => (
        <div key={s.id}>
          {i > 0 && <Connector />}
          <FlowBox
            eyebrow={s.kind === "outcome" ? "OUTCOME" : `PASS ${i + 1}`} title={s.title} kind={s.kind}
            state={run.resolve ? sub[s.id].state : "pending"}
            sub={sub[s.id]?.state === "done" && sub[s.id].start && sub[s.id].end ? duration(sub[s.id].start!, sub[s.id].end!) : sub[s.id]?.state === "active" ? "in progress" : undefined}
            onClick={() => setSelected(s.id)}
          />
        </div>
      ));
    }
    return null;
  }

  /* right pane for the current selection (under the hood) */
  function detail() {
    if (!run) return null;

    if (path === "orchestrating" && selected) {
      const s = ORCH_SUBS.find((x) => x.id === selected);
      if (s) {
        const events = (run.substage_history ?? []).filter((e) => e.stage === "orchestrating").map((e) => ({ id: e.substage, at: e.at }));
        const st = eventStates(ORCH_SUBS, events, states.orchestrating)[s.id];
        return (
          <div>
            <DetailHeader eyebrow="PLANNING · SUB-STAGE" title={s.title} kind={s.kind} state={st.state}
              timing={st.start && st.end ? duration(st.start, st.end) : undefined} />
            <p className="mt-4 max-w-4xl text-[14px] leading-relaxed">{s.blurb}</p>
            {st.start && <p className="mt-3 font-mono text-xs text-muted">started {formatTime(st.start)}</p>}
          </div>
        );
      }
    }

    if (path === "resolving" && selected) {
      const s = RESOLVE_PHASES.find((x) => x.id === selected);
      if (s) {
        const events = (run.resolve?.phase_history ?? []).map((p) => ({ id: p.phase, at: p.at }));
        const parent = run.resolve
          ? (run.resolve.status === "completed" ? "done" : run.resolve.status === "failed" ? "failed" : "active") as NodeState
          : states.resolving;
        const st = eventStates(RESOLVE_PHASES, events, parent)[s.id];
        return (
          <div>
            <DetailHeader eyebrow="ORGANIZING · PASS" title={s.title} kind={s.kind}
              state={run.resolve ? st.state : "pending"}
              timing={st.start && st.end ? duration(st.start, st.end) : undefined} />
            <p className="mt-4 max-w-4xl text-[14px] leading-relaxed">{s.blurb}</p>
            {run.resolve && s.kind === "llm" && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Stat label="MODEL CALLS (WHOLE RESOLVE)" value={run.resolve.llm_calls} />
              </div>
            )}
          </div>
        );
      }
    }

    const stage = path ?? selected;
    if (stage && STAGE_INFO[stage]) {
      const info = STAGE_INFO[stage];
      const t = stageTimes(run, stage);
      const timing = t.start ? (t.end ? duration(t.start, t.end) : `since ${formatTime(t.start)}`) : undefined;
      return (
        <div>
          <DetailHeader eyebrow={info.eyebrow} title={info.title} kind={info.kind} state={states[stage]} timing={timing} />
          <p className="mt-4 max-w-4xl text-[14px] leading-relaxed">{info.blurb}</p>
          <InOut inn={info.inn} out={info.out} />
          {stage === "crawling" && (run.substage_history ?? []).some((e) => e.stage === "crawling") && (
            <div className="mt-5 border-t border-dashed border-line pt-3">
              <div className="font-mono text-[10px] font-semibold tracking-[.12em] text-muted">SUPERVISOR DISPATCH</div>
              <div className="mt-2 flex flex-col gap-1">
                {(run.substage_history ?? []).filter((e) => e.stage === "crawling").map((e, i) => (
                  <div key={i} className="flex items-baseline gap-3 font-mono text-xs">
                    <span className="text-faint">{formatTime(e.at)}</span>
                    <span>{e.substage}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stage === "resolving" && run.resolve && (
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Stat label="STATUS" value={<span className="text-[13px]">{run.resolve.status}</span>} />
              <Stat label="MODEL CALLS" value={run.resolve.llm_calls} />
              <Stat label="DURATION" value={<span className="text-[13px]">{duration(run.resolve.started_at, run.resolve.finished_at ?? null)}</span>} />
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <DetailHeader eyebrow="TECHNICAL DETAILS" title="How this collection worked" />
        <p className="mt-4 max-w-4xl text-[14px] leading-relaxed">
          Blue boxes spend model calls; outlined boxes are deterministic and free. Click a stage on
          the left to see its detail, or drill into planning and organizing.
        </p>
        {(run.stage_history?.length ?? 0) > 0 && (
          <div className="mt-5 border-t border-dashed border-line pt-3">
            <div className="font-mono text-[10px] font-semibold tracking-[.12em] text-muted">TIMELINE</div>
            <div className="mt-2 flex flex-col gap-1">
              {run.stage_history!.map((h, i) => (
                <div key={i} className="flex items-baseline gap-3 font-mono text-xs">
                  <span className="text-faint">{formatTime(h.at)}</span>
                  <span>{STAGE_INFO[h.stage]?.title ?? h.stage}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const totals = run?.totals;
  const signalsKnown = totals?.signals !== undefined;
  const used = run?.used_in ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Collection"
        title={`Collection ${id}`}
        intro="What one collection fetched, what it found, and where its pages were used."
        help={<>
          <li>The three cards follow the collection: pages visited, saved and new or changed; the findings on those
            pages, as of the collection (See its findings opens them on the Briefing); then the technologies after
            organizing.</li>
          <li>Used in: the assessment runs that read this collection&apos;s pages, and the Points of View built from
            them.</li>
          <li>Sources: one row per source, grouped by horizon (H1–H3, see Setup → Sources). ◐ Didn&apos;t finish
            means pages were left: a website reached its page limit, or a data source has results still to
            collect, which the next collection picks up. Click a source for its pages.</li>
          <li>Pages that couldn&apos;t be analysed are listed in red with the reason; Check again on Operations
            retries them.</li>
          <li>Terminate stops a running collection and keeps what it has collected. The Technical details switch
            shows its stages and the model&apos;s work in each.</li>
        </>}
        right={
          <div className="flex flex-col items-end gap-3">
            <TechnicalDetailsSwitch />
            {running && (
              <button onClick={terminate}
                className="rounded-full border border-failed/40 bg-white px-4 py-2 text-sm font-medium text-failed hover:bg-failed/5">
                Terminate
              </button>
            )}
          </div>
        }
      >
        {run && (
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
            <StatusChip status={run.status} />
            <span>started {formatTime(run.run_start_date_time)}</span>
            <span>ended {formatTime(run.run_end_date_time)}</span>
            <span>took {duration(run.run_start_date_time, run.run_end_date_time)}</span>
            <button onClick={() => load()} title="Refresh"
              className="rounded-full border border-line bg-white px-2 py-0.5 text-sm hover:bg-neutral-100">⟳</button>
            <span className="font-mono text-xs text-neutral-500">
              refreshed {refreshedAt ? formatTime(refreshedAt.toISOString()) : "—"}
            </span>
          </p>
        )}
      </PageHeader>

      {error != null && <BackendError error={error} />}
      {terminateError && <p className="mt-4 text-sm text-failed">Terminate failed: {terminateError}</p>}
      {run?.error && (
        <p className="mt-4 rounded-card border border-failed/40 bg-failed/5 px-4 py-2 font-mono text-xs text-failed">
          {run.error}
        </p>
      )}

      {run && totals && (
        <>
          {/* 1 · the three steps this run went through */}
          <div className="mt-6 flex flex-wrap gap-3">
            <StepCard step={1} title="Collect">
              <Figures items={[["sources", totals.sources], ["pages visited", totals.pages_visited],
                ["pages saved", totals.documents], ["new or changed", totals.new_documents]]} />
            </StepCard>
            <StepCard step={2} title="Findings" href={`/admin?run=${id}`}
              linkText="See its findings on the Briefing">
              {signalsKnown ? (
                <Figures items={[["on your list", totals.signals ?? 0], ["other", totals.other_signals ?? 0],
                  ["set aside", totals.set_aside ?? 0]]} />
              ) : (
                <p className="text-neutral-500">— (this collection predates signals)</p>
              )}
            </StepCard>
            <StepCard step={3} title="Organize" href="/admin/technologies" linkText="Review technologies">
              {run.resolve ? (
                <Figures items={[["status", <span key="s" className="text-sm font-medium">{run.resolve.status}</span>],
                  ["technologies", String(run.resolve.technologies ?? "—")]]} />
              ) : states.resolving === "pending" || running ? (
                <p className="text-neutral-500">Runs after collecting finishes.</p>
              ) : (
                <p className="text-neutral-500">Skipped: another organize was running.</p>
              )}
            </StepCard>
          </div>

          {/* 2 · recorded facts only: which assessments read this run's pages */}
          <section className="mt-6 rounded-card border border-line bg-white px-5 py-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">Used in</div>
            {used.length > 0 ? (
              <ul className="mt-2 space-y-1.5 text-sm">
                {used.map((u) => (
                  <li key={u.scoring_run_id}>
                    Used in assessments of <b>{u.technologies}</b> technolog{u.technologies === 1 ? "y" : "ies"}{" "}
                    (<Link href={`/admin/scoring/assessments/${u.scoring_run_id}`} className="text-link underline underline-offset-4">
                      assessment run {u.scoring_run_id}</Link>, {formatTime(u.started_at)}).
                    {u.povs > 0 && <> {u.povs} Point{u.povs === 1 ? "" : "s"} of View built from them.</>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <span>Not used in any assessment yet. Review technology names, then choose what to assess.</span>
                <Link href="/admin/technologies" className="rounded-full border border-line bg-white px-3 py-1 text-xs hover:bg-neutral-100">Technologies</Link>
                <Link href="/admin/scoring/assessments" className="rounded-full border border-line bg-white px-3 py-1 text-xs hover:bg-neutral-100">Assessment runs</Link>
              </div>
            )}
            {(run.assessments_before_upgrade ?? 0) > 0 && (
              <p className="mt-2 text-xs text-neutral-500">
                Not recorded for assessments before the upgrade ({run.assessments_before_upgrade} of them).
              </p>
            )}
            {run.latest_activity && (
              <p className="mt-3 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
                <span className="font-mono uppercase tracking-wider">Latest workspace activity:</span>{" "}
                assessment run {run.latest_activity.scoring_run_id} started {formatTime(run.latest_activity.started_at)}.
                This is timing only — it doesn&apos;t mean this collection&apos;s pages were used.
              </p>
            )}
          </section>

          {/* 3 · per source */}
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Sources</h2>
            <SourcesTable run={run} runId={id} parent={states.crawling} running={running} access={access} />
            {(run.analysis_errors?.length ?? 0) > 0 && (
              <div className="mt-4 rounded-card border border-failed/40 bg-failed/5 px-4 py-3">
                <h3 className="text-sm font-semibold text-failed">Pages that couldn&apos;t be analysed</h3>
                <ul className="mt-1.5 space-y-1 text-sm text-failed">
                  {run.analysis_errors!.map((e) => (
                    <li key={e.reason}>
                      {e.pages} {e.pages === 1 ? "page" : "pages"}: {e.reason}
                      {e.detail && <span className="text-failed/80"> ({e.detail})</span>}
                      <span className="text-neutral-600"> · </span>
                      {e.sources.map((s, i) => (
                        <span key={s}>
                          {i > 0 && ", "}
                          <Link href={`/admin/runs/${id}/sources/${s}`} className="underline underline-offset-2">{s}</Link>
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-neutral-600">Check again on Operations retries them.</p>
              </div>
            )}
          </section>

          {/* 4 · technical detail */}
          <Hood>
            <section className="mt-8">
              <h2 className="text-lg font-semibold">Technical details</h2>
              <div className="mt-3 flex flex-col items-stretch gap-0 rounded-card border border-line bg-white p-6 md:flex-row">
                <div className="shrink-0 md:w-[30%] md:min-w-[280px]">
                  <div className="mb-3 flex items-center gap-2">
                    {path !== null && (
                      <button onClick={() => { setSelected(path); setPath(null); }}
                        className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted hover:bg-neutral-100">
                        ‹
                      </button>
                    )}
                    <span className="font-mono text-[11px] font-semibold tracking-[.16em] text-muted">
                      {path === null ? "STAGES" : (
                        <>
                          <button onClick={() => { setSelected(path); setPath(null); }} className="hover:underline">STAGES</button>
                          <span className="text-faint"> › </span>
                          <span className="text-ink">{STAGE_INFO[path]?.title.toUpperCase()}</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col">{ladder()}</div>
                </div>
                <div aria-hidden className="my-5 h-px bg-neutral-200 md:mx-6 md:my-0 md:h-auto md:w-px md:self-stretch md:bg-transparent md:bg-gradient-to-b md:from-transparent md:via-neutral-300 md:to-transparent" />
                <div className="min-w-0 flex-1 pt-1">{detail()}</div>
              </div>
            </section>
          </Hood>
        </>
      )}
    </div>
  );
}
