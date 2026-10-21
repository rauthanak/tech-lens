"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import Hood from "@/components/Hood";
import ModelUse from "@/components/ModelUse";
import PageHeader from "@/components/PageHeader";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import StatusChip from "@/components/StatusChip";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { duration, formatAt, formatDay, plural } from "@/lib/format";
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
  crawl_settings?: { pages_per_source?: number }; // as the collection ran
  used_in?: UsedIn[];
  assessments_before_upgrade?: number;
  analysis_errors?: { reason: string; detail: string; pages: number; sources: string[] }[];
};

type Kind = "llm" | "free" | "outcome";
type NodeState = "done" | "active" | "failed" | "pending";

/* ── stage copy (under the hood) ───────────────────────────────────── */

const STAGES = ["orchestrating", "crawling", "resolving", "classifying", "done"] as const;

const STAGE_INFO: Record<string, {
  eyebrow: string; title: string; kind: Kind; box: string;
  blurb: string; inn: string; out: string;
}> = {
  orchestrating: {
    eyebrow: "STAGE 1 · AGENT", title: "Planning", kind: "llm",
    box: "Plans which sources to read",
    blurb: "A model plans the collection and splits the switched-on sources into three groups, one per horizon (H1, H2, H3). Every switched-on source is read whatever the plan says.",
    inn: "the switched-on sources",
    out: "three groups of sources, one per horizon",
  },
  crawling: {
    eyebrow: "STAGE 2 · AGENTS", title: "Collecting", kind: "llm",
    box: "Reads each source and each new page",
    blurb: "Each group is read source by source. A website is crawled from its start pages and feeds, following links; a data source runs its saved searches. A page that hasn't changed since it was last read costs nothing; each new or changed page gets one model call, for its summary, the technologies it names and the events on the signal list.",
    inn: "the three groups, and the signal list as the collection started",
    out: "pages with their summaries and findings",
  },
  resolving: {
    eyebrow: "STAGE 3 · ORGANIZE", title: "Merging names", kind: "llm",
    box: "Merges duplicate technology names",
    blurb: "Pages name the same technology in different ways. This step merges the spellings into one name per technology: first by plain rules (capitals, hyphens, spacing, names already known), then the model for what's left, without renaming technologies the radar already knows. Pages set aside by a Can ignore rule are left out.",
    inn: "every technology name on the collected pages",
    out: "one name per technology, with each page linked to it",
  },
  classifying: {
    eyebrow: "STAGE 4 · CLASSIFY", title: "Judging evidence", kind: "llm",
    box: "Judges each technology with new pages",
    blurb: "One model call per technology with new pages: how solid its evidence is (independent sources, kinds of source and event, credibility), its domain and sub-domain, commercial availability, maturity (TRL), and whether it may be nascent. The step stops at its token limit (Setup › Settings) and says so.",
    inn: "each technology's newest pages, those with findings first",
    out: "for each technology, its judgement with reasons and pages",
  },
  done: {
    eyebrow: "OUTCOME", title: "Evidence", kind: "outcome",
    box: "Pages read, events found, names merged",
    blurb: "What the collection leaves behind: pages with their summaries and findings, filed under one name per technology. An assessment run reads them whenever you choose to assess.",
    inn: "everything above",
    out: "evidence, ready for assessment",
  },
};

const ORCH_SUBS: { id: string; title: string; kind: Kind; blurb: string }[] = [
  { id: "planning", title: "Planning", kind: "llm",
    blurb: "A model reads the list of switched-on sources and drafts the plan." },
  { id: "dispatching", title: "Handing out", kind: "free",
    blurb: "The plan becomes one group of sources per horizon, by fixed rules, so no switched-on source is left out." },
];

const RESOLVE_PHASES: { id: string; title: string; kind: Kind; blurb: string }[] = [
  { id: "gathering", title: "Gathering and tidying", kind: "free",
    blurb: "Every technology name on the pages (set-aside pages left out), tidied by plain rules at no cost: capitals, hyphens and spacing. A name the radar already knows never goes to the model." },
  { id: "llm pass 1", title: "Model pass 1", kind: "llm",
    blurb: "The model reads the remaining names in alphabetical batches and says which are the same technology. Technologies the radar already knows take in new spellings but are never renamed." },
  { id: "llm pass 2", title: "Model pass 2", kind: "llm",
    blurb: "A second pass over the merged names, most frequent first, catching pairs that fell into different batches." },
  { id: "writing register", title: "Saving technologies", kind: "free",
    blurb: "Each technology and its other spellings are saved. A name a person set stays as it is." },
  { id: "stamping documents", title: "Linking pages", kind: "free",
    blurb: "Each page is linked to the technologies it names, and each technology's page counts are worked out again." },
  { id: "done", title: "Technologies updated", kind: "outcome",
    blurb: "The radar's technologies now reflect this collection's pages." },
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
/** A source's note, in words: why it stopped, or why it gave nothing. A
 *  website's stored note reads "didn't finish: 250 links left". */
function sourceNote(s: SourceStat, how: string, budget?: number): string | null {
  if (s.incomplete_note) {
    const left = s.incomplete_note.match(/^didn't finish: (\d+) links? left$/);
    if (!left) return s.incomplete_note;
    const links = `${plural(Number(left[1]), "link")} not visited`;
    return budget && s.pages_visited >= budget ? `Stopped at its page budget of ${budget}; ${links}` : links;
  }
  if (how === "query" && s.source_end_date_time && !s.error && s.documents === 0)
    return "No new results from its saved searches";
  return null;
}

function SourcesTable({ run, runId, parent, running, access, horizons }: {
  run: Run; runId: string; parent: NodeState; running: boolean; access: Record<string, string>;
  horizons: Record<string, string>;
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
                <td colSpan={5} className="px-4 py-1.5 text-xs font-semibold">
                  {horizons[category] ? `${horizons[category]} (${category})` : category} · {plural(sources.length, "source")}
                </td>
              </tr>
              {sources.map((s) => {
                const st = sourceState(s, parent);
                const how = ACCESS_ICON[access[s.source_id] ?? "crawl"];
                const note = sourceNote(s, access[s.source_id] ?? "crawl", run.crawl_settings?.pages_per_source);
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
                    <td className="px-4 py-2.5 text-xs">
                      {s.error && <span className="block text-failed">{s.error}</span>}
                      {note && <span className="block">{note}</span>}
                      {!s.error && !note && !s.source_end_date_time && (
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
  const [horizons, setHorizons] = useState<Record<string, string>>({}); // "H1" → "Already on the market"
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
    fetchJson<{ horizons: Record<string, { label?: string }>; sources: { source_id: string; access?: string }[] }>("/api/sources")
      .then((d) => {
        setAccess(Object.fromEntries(d.sources.map((s) => [s.source_id, s.access ?? "crawl"])));
        setHorizons(Object.fromEntries(Object.entries(d.horizons).map(([h, m]) => [h, m.label ?? h])));
      })
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
      setTerminateError(errorText(e));
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
            {st.start && <p className="mt-3 font-mono text-xs text-muted">started {formatAt(st.start)}</p>}
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
            <DetailHeader eyebrow="MERGING NAMES · PASS" title={s.title} kind={s.kind}
              state={run.resolve ? st.state : "pending"}
              timing={st.start && st.end ? duration(st.start, st.end) : undefined} />
            <p className="mt-4 max-w-4xl text-[14px] leading-relaxed">{s.blurb}</p>
            {run.resolve && s.kind === "llm" && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Stat label="MODEL CALLS (WHOLE STEP)" value={run.resolve.llm_calls} />
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
      const timing = t.start ? (t.end ? duration(t.start, t.end) : `since ${formatAt(t.start)}`) : undefined;
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
                    <span className="text-faint">{formatAt(e.at)}</span>
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
          Blue boxes use model calls; outlined boxes follow fixed rules and cost nothing. Click a stage on
          the left to see its detail, or open planning and merging names for their steps.
        </p>
        {(run.stage_history?.length ?? 0) > 0 && (
          <div className="mt-5 border-t border-dashed border-line pt-3">
            <div className="font-mono text-[10px] font-semibold tracking-[.12em] text-muted">TIMELINE</div>
            <div className="mt-2 flex flex-col gap-1">
              {run.stage_history!.map((h, i) => (
                <div key={i} className="flex items-baseline gap-3 font-mono text-xs">
                  <span className="text-faint">{formatAt(h.at)}</span>
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
        title={run ? `Collection · ${formatDay(run.run_start_date_time)}` : "Collection"}
        intro="What one collection fetched, what it found, and where its pages were used."
        help={<>
          <li>The three cards follow the collection: pages visited, saved and new or changed; the findings on those
            pages, as of the collection (See its findings opens them on the Briefing); then the Organize step, which
            merges different spellings of the same technology into one name, across every page collected so far.</li>
          <li>Used in: the assessment runs that read this collection&apos;s pages, and the Points of View built from
            them.</li>
          <li>Sources: one row per source, grouped by horizon (see Setup › Sources). The note says why a source
            stopped: a website is read up to its page budget, most promising links first, so some links are not
            visited; a data source with results still to collect carries on at the next collection. Click a source
            for its pages.</li>
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
            <span>started {formatAt(run.run_start_date_time)}</span>
            <span>ended {formatAt(run.run_end_date_time)}</span>
            <span>took {duration(run.run_start_date_time, run.run_end_date_time)}</span>
            {running && <>
              <button onClick={() => load()} title="Refresh now"
                className="rounded-full border border-line bg-white px-2 py-0.5 text-sm hover:bg-neutral-100">⟳</button>
              <span className="text-xs text-neutral-500">
                refreshed {refreshedAt ? formatAt(refreshedAt.toISOString()) : "—"}
              </span>
            </>}
            <Hood><span className="font-mono text-xs text-neutral-500">collection {id}</span></Hood>
          </p>
        )}
        {run && <ModelUse runIds={[id, ...(run.resolve_id ? [run.resolve_id] : [])]} startedAt={run.run_start_date_time}
          refresh={refreshedAt} />}
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
              <Figures items={[["sources", totals.sources.toLocaleString()], ["pages visited", totals.pages_visited.toLocaleString()],
                ["pages saved", totals.documents.toLocaleString()], ["new or changed", totals.new_documents.toLocaleString()]]} />
            </StepCard>
            <StepCard step={2} title="Findings" href={`/admin?run=${id}`}
              linkText="See its findings on the Briefing">
              {signalsKnown ? (<>
                <Figures items={[["match the signal list", (totals.signals ?? 0).toLocaleString()],
                  ["match no signal", (totals.other_signals ?? 0).toLocaleString()]]} />
                <p className="mt-2 text-xs text-neutral-600">
                  {plural(totals.set_aside ?? 0, "page")} set aside: nothing worth keeping
                </p>
              </>) : (
                <p className="text-neutral-500">— (this collection predates signals)</p>
              )}
            </StepCard>
            <StepCard step={3} title="Organize: merge names" href="/admin/technologies" linkText="Review technologies">
              {run.resolve?.status === "completed" ? (
                <p>
                  Merged {Number(run.resolve.raw_strings ?? 0).toLocaleString()} names, from every page collected so
                  far; the radar then knew {Number(run.resolve.technologies ?? 0).toLocaleString()} technologies.
                </p>
              ) : run.resolve?.status === "failed" ? (
                <p className="text-failed">Didn&apos;t finish{run.resolve.error ? `: ${run.resolve.error}` : "."}</p>
              ) : run.resolve || states.resolving === "pending" || running ? (
                <p className="text-neutral-500">{run.resolve ? "Merging names…" : "Runs after collecting finishes."}</p>
              ) : (
                <p className="text-neutral-500">Skipped: another merge of names was running.</p>
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
                    in the <Link href={`/admin/scoring/assessments/${u.scoring_run_id}`} className="text-link underline underline-offset-4">
                      assessment run of {formatAt(u.started_at)}</Link>
                    <Hood><span className="ml-1 font-mono text-xs text-neutral-500">{u.scoring_run_id}</span></Hood>.
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
          </section>

          {/* 3 · per source */}
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Sources</h2>
            <SourcesTable run={run} runId={id} parent={states.crawling} running={running} access={access} horizons={horizons} />
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
