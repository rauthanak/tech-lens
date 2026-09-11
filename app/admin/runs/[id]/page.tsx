"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { duration, formatTime, STATUS_STYLES } from "@/lib/format";

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

type ScoringRun = {
  _id: string;
  status: string;
  stage?: string;
  progress: { techs_total: number; techs_done: number; llm_calls: number };
  started_at: string;
  finished_at?: string;
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
  totals: { sources: number; pages_visited: number; documents: number; new_documents: number };
  sources: SourceStat[];
};

/* ── palette (mirrors the pipeline artifact) ───────────────────────── */

const C = {
  ink: "#1C1A17",
  copper: "#8F5230",
  copperDark: "#6B3E22",
  cream: "#F6EDE4",
  creamBorder: "#E2CDB8",
  teal: "#0F5B57",
  tealBg: "#E7EFEE",
  tealBorder: "#BFD5D2",
  paper: "#FAF8F4",
  sand: "#EDE8DF",
  sandBorder: "#C7BFB2",
  muted: "#4A463F",
  faint: "#A8A096",
};

type Kind = "llm" | "free" | "outcome";
type NodeState = "done" | "active" | "failed" | "pending";

/* ── static stage copy (drawn from the pipeline document) ──────────── */

const STAGES = ["orchestrating", "crawling", "resolving", "done"] as const;

const STAGE_INFO: Record<string, {
  eyebrow: string; title: string; kind: Kind; box: string;
  blurb: string; inn: string; out: string;
}> = {
  orchestrating: {
    eyebrow: "STAGE 1 · AGENT", title: "Orchestrating", kind: "llm",
    box: "Plan the run, divide the register by horizon",
    blurb: "The orchestrator deep agent plans the run and divides the enabled register into one workload each for H1, H2 and H3. The fan-out itself is deterministic — every enabled source gets crawled no matter what the agent decides.",
    inn: "the enabled source register, run scope",
    out: "a run plan — three horizon workloads",
  },
  crawling: {
    eyebrow: "STAGE 2 · AGENTS × N", title: "Crawling", kind: "llm",
    box: "Crawl every enabled source, summarize what changed",
    blurb: "One supervisor per horizon partitions its slice into bounded scout batches. Per source: the discovery ladder (links → sitemap → RSS → headless browser), content-hash dedupe so an unchanged page is never paid for twice, then one LLM call per new article — summary, technology tags, and the scout's take on where the trend is heading.",
    inn: "the three horizon workloads",
    out: "documents written to the store",
  },
  resolving: {
    eyebrow: "STAGE 3 · CHAINED", title: "Resolving", kind: "llm",
    box: "Collapse raw tags into canonical technologies",
    blurb: "Documents arrive tagged with raw strings; scoring needs one canonical name per technology. The resolver merges cheapest step first — deterministic normalization, then the pinned-alias skip, and only what's left reaches the model as merge-groups with the register passed in as fixed anchors. It chains automatically as the final stage of every scout run.",
    inn: "raw technology strings from all documents",
    out: "canonical technologies + stamped documents",
  },
  done: {
    eyebrow: "OUTCOME", title: "Documents", kind: "outcome",
    box: "Summarized · tagged · resolved",
    blurb: "The run's artifact: summarized, tagged and resolved documents. Scoring reads this store, not the live run — score whenever you like, on whatever the latest resolve produced.",
    inn: "everything above",
    out: "evidence, ready for scoring",
  },
  /* downstream of the hand-off — separate runs on their own clock */
  scoring: {
    eyebrow: "STAGES 3 · 4 · 5 · SEPARATE RUN", title: "Scoring & Assessment", kind: "llm",
    box: "Measure on evidence, roll up, place on the grid",
    blurb: "The analyzer works a chosen set of technologies under a config snapshot frozen at start: an evidence dossier per technology, a fabric gate, twelve measures scored with citations (or an honest unscorable), then pure arithmetic — TORA roll-ups, the priority grid, horizon, watch metrics. Deliberately decoupled from scouting: this shows the latest scoring run, whichever resolve it read.",
    inn: "the technology register + document store",
    out: "assessments — scores with citations, per fabric",
  },
  pov: {
    eyebrow: "STAGE 6 · FINAL DOCUMENT", title: "Point of View", kind: "llm",
    box: "Narrated, never re-scored",
    blurb: "The composer writes the client's sections around the stored assessment — verbatim numbers, no vote of its own. Unscorable measures become an explicit evidence-gaps section, and the page exports as a print-clean PDF: the pipeline's final document.",
    inn: "the stored assessment, unaltered",
    out: "a client-ready PoV document",
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
    blurb: "Collect every raw string from the documents and apply the deterministic clean — case, hyphens and spacing merged at zero cost — plus the pinned-alias skip: anything the register already knows never returns to the model." },
  { id: "llm pass 1", title: "LLM pass 1", kind: "llm",
    blurb: "technology_resolve over the leftovers in alphabetical chunks: merge-groups only, with the established register as fixed anchors that new names fold into but never rename." },
  { id: "llm pass 2", title: "LLM pass 2", kind: "llm",
    blurb: "A second pass over the resulting canonicals by frequency, catching merges that straddled chunk boundaries." },
  { id: "writing register", title: "Write register", kind: "free",
    blurb: "Upsert canonical technologies and their aliases into the register — admin pins survive untouched." },
  { id: "stamping documents", title: "Stamp documents", kind: "free",
    blurb: "Stamp every document with its resolved canonical names and recompute per-technology stats." },
  { id: "done", title: "Register updated", kind: "outcome",
    blurb: "The technology register reflects this run's documents." },
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
  subs.forEach((sub, i) => {
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
    return <span className="rounded-[2px] px-1.5 py-px font-mono text-[9px] font-semibold text-white" style={{ background: C.copper }}>LLM</span>;
  if (kind === "outcome")
    return <span className="rounded-[2px] border px-1.5 py-px font-mono text-[9px] font-semibold" style={{ color: C.teal, borderColor: C.tealBorder, background: "#fff" }}>OUTCOME</span>;
  return <span className="rounded-[2px] border px-1.5 py-px font-mono text-[9px] font-semibold" style={{ color: C.muted, borderColor: C.faint, background: "#fff" }}>FREE</span>;
}

function StateBadge({ state }: { state: NodeState }) {
  if (state === "done")
    return <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: C.teal }}>✓</span>;
  if (state === "failed")
    return <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">✕</span>;
  return null;
}

function FlowBox({ eyebrow, title, kind, state, sub, onClick, drill }: {
  eyebrow: string; title: string; kind: Kind; state: NodeState;
  sub?: string; onClick?: () => void; drill?: boolean;
}) {
  const style: React.CSSProperties =
    kind === "llm"
      ? { background: C.cream, border: `2px solid ${C.copper}` }
      : kind === "outcome"
        ? { background: C.tealBg, border: `1px solid ${C.tealBorder}`, borderLeft: `4px solid ${C.teal}` }
        : { background: "#fff", border: `1px solid ${C.faint}` };
  if (state === "failed") style.border = "2px solid #dc2626";
  const eyebrowColor = kind === "llm" ? C.copperDark : kind === "outcome" ? C.teal : C.muted;
  return (
    <button
      onClick={onClick}
      className={`relative w-full rounded-[3px] px-3.5 py-2.5 text-left transition-opacity ${state === "pending" ? "opacity-45" : ""} ${onClick ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
      style={style}
    >
      {state === "active" && <span aria-hidden className="stage-ants pointer-events-none absolute -inset-px" />}
      <StateBadge state={state} />
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[9px] font-semibold tracking-[.14em]" style={{ color: eyebrowColor }}>{eyebrow}</span>
        <KindBadge kind={kind} />
      </span>
      <span className="mt-0.5 block text-[15px] font-semibold leading-tight" style={{ color: C.ink }}>
        {title}
        {drill && <span className="ml-1.5 font-mono text-[11px]" style={{ color: C.faint }}>›</span>}
      </span>
      {sub && (
        <span className="mt-0.5 block font-mono text-[10px]" style={{ color: state === "active" ? C.copper : C.muted }}>
          {sub}
        </span>
      )}
    </button>
  );
}

function Connector() {
  return <div className="py-0.5 text-center text-[11px] leading-none" style={{ color: C.faint }}>▼</div>;
}

function InOut({ inn, out }: { inn: string; out: string }) {
  return (
    <div className="mt-4 flex flex-col gap-1.5 border-t border-dashed pt-3" style={{ borderColor: C.sandBorder }}>
      <div className="grid grid-cols-[42px_1fr] items-baseline gap-2">
        <span className="font-mono text-[10px] font-semibold" style={{ color: C.teal }}>IN</span>
        <span className="text-[13px]" style={{ color: C.ink }}>{inn}</span>
      </div>
      <div className="grid grid-cols-[42px_1fr] items-baseline gap-2">
        <span className="font-mono text-[10px] font-semibold" style={{ color: C.copper }}>OUT</span>
        <span className="text-[13px]" style={{ color: C.ink }}>{out}</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[2px] border px-3 py-2" style={{ background: C.sand, borderColor: C.sandBorder }}>
      <div className="font-mono text-[9px] font-semibold tracking-[.12em]" style={{ color: C.muted }}>{label}</div>
      <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums" style={{ color: C.ink }}>{value}</div>
    </div>
  );
}

function DetailHeader({ eyebrow, title, kind, state, timing }: {
  eyebrow: string; title: string; kind?: Kind; state?: NodeState; timing?: string;
}) {
  return (
    <div className="border-b-2 pb-3" style={{ borderColor: C.ink }}>
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[10px] font-semibold tracking-[.16em]" style={{ color: C.teal }}>{eyebrow}</span>
        {kind && <KindBadge kind={kind} />}
        {state && (
          <span className={`px-1.5 py-px font-mono text-[10px] uppercase ${
            state === "done" ? "text-white" : state === "active" ? "" : state === "failed" ? "bg-red-100 text-red-900" : ""
          }`} style={
            state === "done" ? { background: C.teal }
            : state === "active" ? { background: C.cream, color: C.copperDark }
            : state === "pending" ? { background: C.sand, color: C.muted } : undefined
          }>
            {state === "active" ? "in progress" : state}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-3">
        <span className="text-[26px] font-semibold leading-tight tracking-[-.01em]" style={{ color: C.ink }}>{title}</span>
        {timing && <span className="font-mono text-xs" style={{ color: C.muted }}>{timing}</span>}
      </div>
    </div>
  );
}

/** The classic per-source table, grouped by horizon — scales to hundreds of
 *  sources where a ladder of boxes would not. Rows open the document browser. */
function SourcesTable({ run, runId, parent, running }: {
  run: Run; runId: string; parent: NodeState; running: boolean;
}) {
  const router = useRouter();
  if (run.sources.length === 0)
    return (
      <p className="mt-5 max-w-xl border px-3 py-2 text-[13px]" style={{ background: C.sand, borderColor: C.sandBorder, color: C.muted }}>
        {running ? "Scouts are on their way…" : "No sources were crawled."}
      </p>
    );
  const groups = new Map<string, SourceStat[]>();
  for (const s of run.sources) {
    if (!groups.has(s.category)) groups.set(s.category, []);
    groups.get(s.category)!.push(s);
  }
  return (
    <div className="mt-5 overflow-x-auto rounded-[3px] border bg-white" style={{ borderColor: C.sandBorder }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left font-mono text-[10px] uppercase tracking-[.12em]" style={{ borderColor: C.sandBorder, color: C.muted }}>
            <th className="px-4 py-2.5 font-semibold">Source</th>
            <th className="px-4 py-2.5 font-semibold">Pages</th>
            <th className="px-4 py-2.5 font-semibold">Docs (new)</th>
            <th className="px-4 py-2.5 font-semibold">Duration</th>
            <th className="px-4 py-2.5 font-semibold">Note</th>
          </tr>
        </thead>
        <tbody>
          {[...groups.entries()].map(([category, sources]) => (
            <Fragment key={category}>
              <tr style={{ background: C.sand }}>
                <td colSpan={5} className="px-4 py-1.5 font-mono text-[10px] font-semibold tracking-[.14em]" style={{ color: C.copperDark }}>
                  {category} · {sources.length} SOURCE{sources.length === 1 ? "" : "S"}
                </td>
              </tr>
              {sources.map((s) => {
                const st = sourceState(s, parent);
                return (
                  <tr
                    key={s.source_id}
                    onClick={() => router.push(`/admin/runs/${runId}/sources/${s.source_id}`)}
                    className="cursor-pointer border-b last:border-b-0 hover:bg-neutral-50"
                    style={{ borderColor: "#F0ECE4" }}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 font-medium" style={{ color: C.ink }}>
                        {s.source_name}
                        {st === "done" && <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: C.teal }}>✓</span>}
                        {st === "failed" && <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white">✕</span>}
                      </div>
                      <div className="font-mono text-xs" style={{ color: C.faint }}>{s.source_url}</div>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{s.pages_visited}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {s.documents}
                      <span style={{ color: C.faint }}> ({s.new_documents})</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {duration(s.source_start_date_time, s.source_end_date_time)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: st === "active" ? C.copper : "#7a3c1e" }}>
                      {s.error ?? (s.source_end_date_time ? "" : "in progress")}
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
  const [scoring, setScoring] = useState<ScoringRun | null>(null);
  const [povCount, setPovCount] = useState<number>(0);
  const runningRef = useRef(false);
  const autoSelected = useRef(false);

  const load = useCallback((silent = false) => {
    // downstream, decoupled stages: latest scoring run + composed PoVs (best-effort)
    fetchJson<{ scoring_runs: ScoringRun[] }>("/api/scoring/runs")
      .then((d) => setScoring(d.scoring_runs[0] ?? null)).catch(() => {});
    fetchJson<{ povs: unknown[] }>("/api/scoring/povs")
      .then((d) => setPovCount(d.povs.length)).catch(() => {});
    fetchJson<Run>(`/api/runs/${id}`)
      .then((d) => {
        setRun(d);
        setError(null);
        setRefreshedAt(new Date());
        runningRef.current = d.status === "running" || d.status === "terminating";
        // a live run opens straight onto its executing stage (once — clicks win after that)
        if (!autoSelected.current && runningRef.current && d.stage && STAGE_INFO[d.stage]) {
          autoSelected.current = true;
          setSelected(d.stage);
        }
      })
      .catch((e) => {
        if (!silent) setError(e);
      });
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(
      () => load(true),
      runningRef.current ? REFRESH_RUNNING_MS : REFRESH_IDLE_MS,
    );
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
  const scoringState: NodeState = !scoring ? "pending"
    : scoring.status === "completed" ? "done"
    : scoring.status === "running" || scoring.status === "terminating" ? "active"
    : "failed";
  const povState: NodeState = povCount > 0 ? "done" : "pending";

  /* ladder for the current level */
  function ladder() {
    if (!run) return null;
    if (path === null) {
      const scoutLadder = STAGES.map((s, i) => {
        const info = STAGE_INFO[s];
        const t = stageTimes(run, s);
        const st = states[s];
        const sub =
          st === "active" ? "in progress"
          : st === "done" && t.start ? (t.end ? duration(t.start, t.end) : "")
          : st === "failed" ? (run.status === "terminated" ? "stopped here" : "failed here")
          : info.box;
        // crawling scales to hundreds of sources — its detail lives in the
        // right pane as a grouped table, not as a ladder of source boxes
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
      return (
        <>
          {scoutLadder}
          {/* the hand-off: scoring runs on its own clock, reading the store */}
          <div className="my-3 flex items-center gap-2">
            <span className="h-px flex-1 border-t border-dashed" style={{ borderColor: C.sandBorder }} />
            <span className="font-mono text-[9px] font-semibold tracking-[.14em]" style={{ color: C.faint }}>
              HAND-OFF · SEPARATE CLOCK
            </span>
            <span className="h-px flex-1 border-t border-dashed" style={{ borderColor: C.sandBorder }} />
          </div>
          <FlowBox
            eyebrow={STAGE_INFO.scoring.eyebrow} title={STAGE_INFO.scoring.title} kind="llm"
            state={scoringState}
            sub={scoring
              ? `${scoring.progress.techs_done}/${scoring.progress.techs_total} techs · ${scoring.progress.llm_calls} calls`
              : "no scoring run yet"}
            onClick={() => { setPath(null); setSelected("scoring"); }}
          />
          <Connector />
          <FlowBox
            eyebrow={STAGE_INFO.pov.eyebrow} title={STAGE_INFO.pov.title} kind="llm"
            state={povState}
            sub={povCount > 0 ? `${povCount} composed` : "not composed yet"}
            onClick={() => { setPath(null); setSelected("pov"); }}
          />
        </>
      );
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

  /* right pane for the current selection */
  function detail() {
    if (!run) return null;

    /* drilled: orchestrating substage detail */
    if (path === "orchestrating" && selected) {
      const s = ORCH_SUBS.find((x) => x.id === selected);
      if (s) {
        const events = (run.substage_history ?? []).filter((e) => e.stage === "orchestrating").map((e) => ({ id: e.substage, at: e.at }));
        const st = eventStates(ORCH_SUBS, events, states.orchestrating)[s.id];
        return (
          <div>
            <DetailHeader eyebrow={`ORCHESTRATING · SUB-STAGE`} title={s.title} kind={s.kind} state={st.state}
              timing={st.start && st.end ? duration(st.start, st.end) : undefined} />
            <p className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: C.ink }}>{s.blurb}</p>
            {st.start && <p className="mt-3 font-mono text-xs" style={{ color: C.muted }}>started {formatTime(st.start)}</p>}
          </div>
        );
      }
    }

    /* drilled: resolver phase detail */
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
            <DetailHeader eyebrow="RESOLVING · PASS" title={s.title} kind={s.kind}
              state={run.resolve ? st.state : "pending"}
              timing={st.start && st.end ? duration(st.start, st.end) : undefined} />
            <p className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: C.ink }}>{s.blurb}</p>
            {run.resolve && s.kind === "llm" && (
              <div className="mt-4 grid max-w-sm grid-cols-1 gap-3">
                <Stat label="LLM CALLS (WHOLE RESOLVE)" value={run.resolve.llm_calls} />
              </div>
            )}
          </div>
        );
      }
    }

    /* drilled but nothing selected → parent stage overview; or top-level selection */
    const stage = path ?? selected;
    if (stage && STAGE_INFO[stage]) {
      const info = STAGE_INFO[stage];
      const t = stageTimes(run, stage);
      const st = stage === "scoring" ? scoringState : stage === "pov" ? povState : states[stage];
      const timing = stage === "scoring"
        ? (scoring ? duration(scoring.started_at, scoring.finished_at ?? null) : undefined)
        : stage === "pov" ? undefined
        : t.start ? (t.end ? duration(t.start, t.end) : `since ${formatTime(t.start)}`) : undefined;
      return (
        <div>
          <DetailHeader eyebrow={info.eyebrow} title={info.title} kind={info.kind} state={st}
            timing={timing} />
          <p className="mt-4 max-w-2xl text-[14px] leading-relaxed" style={{ color: C.ink }}>{info.blurb}</p>
          <InOut inn={info.inn} out={info.out} />

          {stage === "crawling" && (
            <>
              <div className="mt-5 grid max-w-xl grid-cols-4 gap-3">
                <Stat label="SOURCES" value={run.totals.sources} />
                <Stat label="PAGES" value={run.totals.pages_visited} />
                <Stat label="DOCS" value={run.totals.documents} />
                <Stat label="NEW" value={run.totals.new_documents} />
              </div>
              {(run.substage_history ?? []).some((e) => e.stage === "crawling") && (
                <div className="mt-5 max-w-xl border-t border-dashed pt-3" style={{ borderColor: C.sandBorder }}>
                  <div className="font-mono text-[10px] font-semibold tracking-[.12em]" style={{ color: C.muted }}>SUPERVISOR DISPATCH</div>
                  <div className="mt-2 flex flex-col gap-1">
                    {(run.substage_history ?? []).filter((e) => e.stage === "crawling").map((e, i) => (
                      <div key={i} className="flex items-baseline gap-3 font-mono text-xs" style={{ color: C.ink }}>
                        <span style={{ color: C.faint }}>{formatTime(e.at)}</span>
                        <span>{e.substage}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <SourcesTable run={run} runId={id} parent={states.crawling} running={running} />
            </>
          )}

          {stage === "resolving" && (run.resolve ? (
            <div className="mt-5 grid max-w-xl grid-cols-3 gap-3">
              <Stat label="STATUS" value={<span className="text-[13px]">{run.resolve.status}</span>} />
              <Stat label="LLM CALLS" value={run.resolve.llm_calls} />
              <Stat label="DURATION" value={<span className="text-[13px]">{duration(run.resolve.started_at, run.resolve.finished_at ?? null)}</span>} />
            </div>
          ) : (
            <p className="mt-5 max-w-xl border px-3 py-2 text-[13px]" style={{ background: C.sand, borderColor: C.sandBorder, color: C.muted }}>
              {states.resolving === "pending"
                ? "The resolve chains after crawling finishes."
                : "No resolve is linked to this run — it was skipped because another resolve was already running, or the run predates resolve linking."}
            </p>
          ))}

          {stage === "scoring" && (
            <>
              {scoring ? (
                <div className="mt-5 grid max-w-xl grid-cols-3 gap-3">
                  <Stat label="STATUS" value={<span className="text-[13px]">{scoring.status}{scoring.stage && (scoring.status === "running" || scoring.status === "terminating") ? ` · ${scoring.stage}` : ""}</span>} />
                  <Stat label="TECHNOLOGIES" value={`${scoring.progress.techs_done}/${scoring.progress.techs_total}`} />
                  <Stat label="LLM CALLS" value={scoring.progress.llm_calls} />
                </div>
              ) : (
                <p className="mt-5 max-w-xl border px-3 py-2 text-[13px]" style={{ background: C.sand, borderColor: C.sandBorder, color: C.muted }}>
                  No scoring run yet — start one whenever the register looks right; it will read this run&apos;s documents.
                </p>
              )}
              <div className="mt-5 flex gap-3">
                <Link href={scoring ? `/admin/scoring/assessments/${scoring._id}` : "/admin/scoring/assessments"}
                  className="px-4 py-2 text-sm font-medium text-white hover:opacity-90" style={{ background: C.ink }}>
                  {scoring ? "Open scoring run →" : "Start scoring →"}
                </Link>
              </div>
            </>
          )}

          {stage === "pov" && (
            <>
              <div className="mt-5 grid max-w-xs grid-cols-1 gap-3">
                <Stat label="COMPOSED POINTS OF VIEW" value={povCount} />
              </div>
              <div className="mt-5 flex gap-3">
                <Link href="/admin/scoring/pov"
                  className="px-4 py-2 text-sm font-medium text-white hover:opacity-90" style={{ background: C.ink }}>
                  Points of View →
                </Link>
              </div>
            </>
          )}

          {stage === "done" && (
            <>
              <div className="mt-5 grid max-w-xl grid-cols-4 gap-3">
                <Stat label="SOURCES" value={run.totals.sources} />
                <Stat label="PAGES" value={run.totals.pages_visited} />
                <Stat label="DOCS" value={run.totals.documents} />
                <Stat label="NEW" value={run.totals.new_documents} />
              </div>
              <div className="mt-5 flex gap-3">
                <Link href="/admin/technologies" className="px-4 py-2 text-sm font-medium text-white hover:opacity-90" style={{ background: C.ink }}>
                  Technology register →
                </Link>
                <Link href="/admin/scoring/assessments" className="border px-4 py-2 text-sm font-medium hover:bg-neutral-50" style={{ borderColor: C.sandBorder, color: C.ink, background: "#fff" }}>
                  Run scoring →
                </Link>
              </div>
            </>
          )}
        </div>
      );
    }

    /* default: run overview */
    return (
      <div>
        <DetailHeader eyebrow="SCOUT RUN · FIVE STAGES" title="The process, end to end" />
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed" style={{ color: C.ink }}>
          Scouts read the enabled sources so the resolver can hand scoring a clean register —
          each stage leaves a finished artifact for the next. Copper boxes spend model calls;
          outlined boxes are deterministic and free. Click a stage on the left to drill into
          its sub-process.
        </p>
        <div className="mt-5 grid max-w-xl grid-cols-4 gap-3">
          <Stat label="SOURCES" value={run.totals.sources} />
          <Stat label="PAGES" value={run.totals.pages_visited} />
          <Stat label="DOCS" value={run.totals.documents} />
          <Stat label="NEW" value={run.totals.new_documents} />
        </div>
        {(run.stage_history?.length ?? 0) > 0 && (
          <div className="mt-5 max-w-xl border-t border-dashed pt-3" style={{ borderColor: C.sandBorder }}>
            <div className="font-mono text-[10px] font-semibold tracking-[.12em]" style={{ color: C.muted }}>TIMELINE</div>
            <div className="mt-2 flex flex-col gap-1">
              {run.stage_history!.map((h, i) => (
                <div key={i} className="flex items-baseline gap-3 font-mono text-xs" style={{ color: C.ink }}>
                  <span style={{ color: C.faint }}>{formatTime(h.at)}</span>
                  <span>{h.stage}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Runs"
        title={`Run ${id}`}
        right={
          running ? (
            <button onClick={terminate}
              className="border border-[#c4552f]/50 bg-white px-4 py-2 text-sm font-medium text-[#7a3c1e] hover:bg-[#fdf3ee]">
              Terminate
            </button>
          ) : undefined
        }
      >
        {run && (
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
            <span className={`px-2 py-0.5 font-mono text-[11px] uppercase ${STATUS_STYLES[run.status] ?? "bg-neutral-100"}`}>
              {run.status}
            </span>
            <span>started {formatTime(run.run_start_date_time)}</span>
            <span>ended {formatTime(run.run_end_date_time)}</span>
            <span className="font-mono text-xs">{duration(run.run_start_date_time, run.run_end_date_time)}</span>
            <button onClick={() => load()} title="Refresh"
              className="border border-neutral-300 bg-white px-2 py-0.5 text-sm hover:bg-neutral-100">⟳</button>
            <span className="font-mono text-xs text-neutral-500">
              refreshed {refreshedAt ? formatTime(refreshedAt.toISOString()) : "—"}
            </span>
          </p>
        )}
      </PageHeader>

      {error != null && <BackendError error={error} />}
      {terminateError && <p className="mt-4 text-sm text-[#7a3c1e]">Terminate failed: {terminateError}</p>}
      {run?.error && (
        <p className="mt-4 max-w-3xl border border-[#c4552f]/40 bg-[#fdf3ee] px-4 py-2 font-mono text-xs text-[#7a3c1e]">
          {run.error}
        </p>
      )}

      {run && (
        <div className="mt-6 flex items-stretch gap-0 rounded-[3px] border p-6"
          style={{ background: C.paper, borderColor: C.sandBorder }}>
          {/* left 30% — the ladder */}
          <div className="w-[30%] min-w-[280px] shrink-0">
            <div className="mb-3 flex items-center gap-2">
              {path !== null && (
                <button onClick={() => { setSelected(path); setPath(null); }}
                  className="border px-2 py-0.5 font-mono text-[11px] hover:bg-white"
                  style={{ borderColor: C.sandBorder, color: C.muted }}>
                  ‹
                </button>
              )}
              <span className="font-mono text-[11px] font-semibold tracking-[.16em]" style={{ color: C.muted }}>
                {path === null ? "PROCESS" : (
                  <>
                    <button onClick={() => { setSelected(path); setPath(null); }} className="hover:underline">PROCESS</button>
                    <span style={{ color: C.faint }}> › </span>
                    <span style={{ color: C.ink }}>{STAGE_INFO[path]?.title.toUpperCase()}</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex flex-col">{ladder()}</div>
          </div>

          {/* fading separator */}
          <div aria-hidden className="mx-6 w-px self-stretch bg-gradient-to-b from-transparent via-neutral-300 to-transparent" />

          {/* right 70% — the detail pane */}
          <div className="min-w-0 flex-1 pt-1">{detail()}</div>
        </div>
      )}
    </div>
  );
}
