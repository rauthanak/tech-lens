"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Hood from "@/components/Hood";
import ModelUse from "@/components/ModelUse";
import Pager from "@/components/Pager";
import StatusChip from "@/components/StatusChip";
import { fetchJson } from "@/lib/api";
import { formatAt, formatClock, formatDay, plural } from "@/lib/format";
import { useClientPage } from "@/lib/paging";
import { usePipeline } from "@/lib/pipeline";
import { addTokens, beforeRecording, RUN_KIND, type RunUsage, tokenLine } from "@/lib/usage";

const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s);

// `tokens`: the model's tokens, shown under Technical details; the facts say model calls, as buttons do before a run
type HistoryRow = { key: string; at: string; tz?: string | null; kind: string; facts: string[]; tokens?: string[]; status: string | null;
  href: string | null; id: string; ids: string[]; usageKind?: string; used: boolean;
  count?: number; until?: string }; // a group of single Points of View: how many, and when the last was written
type RunRow = { id: string; status: string; run_start_date_time: string; incomplete?: number; resolve_id?: string;
  totals?: { new_documents?: number; signals?: number; other_signals?: number } };
type ScoringRow = { _id: string; status: string; started_at: string;
  progress?: { techs_total?: number; llm_calls?: number } };
type About = { status?: string; tz?: string; total?: number; trigger?: string; file?: string; summary?: string;
  stopped_reason?: string | null; error?: string | null;
  technology?: string | null; gap?: { tech_id?: string }; assessment?: { id: string; started_at: string } };

/** The facts a run's own record gives, by kind. */
function aboutFacts(kind: string, a: About): string[] {
  const n = a.total ?? 0;
  if (kind === "classify")
    return [plural(n, "technology", "technologies"),
      a.trigger?.startsWith("after collection") ? "after a collection" : "started by hand",
      // why it stopped, when it did (the collection's run page says who judged the rest)
      ...(a.stopped_reason ? ["stopped at the spending limit removed on Oct 22"] : a.error ? [`stopped: ${a.error}`] : [])];
  if (kind === "recheck") return [`${plural(n, "page")} checked again`];
  if (kind === "find_evidence") return [a.technology ?? "", short(a.summary ?? "", 120)].filter(Boolean);
  if (kind === "import") return a.file ? [a.file] : [];
  if (kind === "pov")
    return a.assessment ? [`written from the assessment run of ${formatDay(a.assessment.started_at)}`]
      : n ? [plural(n, "technology", "technologies")] : [];
  return [];
}

/** Where a run's own page is, when it has one. */
function aboutHref(kind: string, id: string, a: About): string | null {
  if (kind === "find_evidence" && a.gap?.tech_id) return `/admin/technologies/${a.gap.tech_id}`;
  if (kind === "import") return `/admin/import?id=${encodeURIComponent(id)}`;
  if (kind === "pov") return "/admin/scoring/pov";
  if (kind === "resolve") return "/admin/technologies";
  return null;
}

/** One Point of View written on its own after another within the hour joins
 *  its row: "22 Points of View written · 10:14–10:24 AM · 22 model calls". */
function grouped(rows: HistoryRow[], r: HistoryRow): HistoryRow[] {
  const prev = rows[rows.length - 1];
  const one = (x: HistoryRow) => x.kind === RUN_KIND.pov && x.facts.includes("1 model call");
  if (prev && one(r) && (prev.count || one(prev)) && Date.parse(prev.at) - Date.parse(r.at) < 3600_000) {
    const n = (prev.count ?? 1) + 1;
    rows[rows.length - 1] = { ...prev, count: n, at: r.at, until: prev.until ?? prev.at, ids: [...prev.ids, ...r.ids],
      facts: [`${n} written`, plural(n, "model call")] };
    return rows;
  }
  return [...rows, r];
}

/** Every run that used the model, newest first: collections (with the
 *  organize that ended them), assessment runs, and the runs with no list of
 *  their own (Classify, Points of View, Find evidence, import matching,
 *  checks of stored pages), each with its tokens in, out and reused. */
/** Every run that used the model, newest first, 50 at a time: collections (with the organize
 *  that ended them), assessment runs, and the runs with no list of their own (Classify, Points of
 *  View, Find evidence, import matching, checks of stored pages), each with its tokens. */
export default function OperationsHistory() {
  const p = usePipeline();
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const done = [p?.collect.status, p?.assess.status, p?.classify?.status, p?.pov.job?.status].join(":");
  useEffect(() => {
    Promise.all([fetchJson<{ runs: RunRow[] }>("/api/runs"),
      fetchJson<{ scoring_runs: ScoringRow[] }>("/api/scoring/runs?limit=200"),
      fetchJson<{ runs: RunUsage[]; recorded_since: string | null }>("/api/usage/recent?limit=300")
        .catch(() => ({ runs: [] as RunUsage[], recorded_since: null }))])
      .then(([collections, assessments, usage]) => {
        const own = new Map(usage.runs.map((u) => [`${u.run_id}:${u.run_kind}`, u]));
        const partsOf = (kind: string, id: string) => usage.runs.filter((u) => u.part_of?.kind === kind && u.part_of.id === id);
        // a find-evidence job's page reading is filed as a run, but it isn't a collection
        const reading = new Set(usage.runs.filter((u) => u.part_of?.kind === "find_evidence").map((u) => u.run_id));
        // tokens, or why there are none; runs from before recording have none, or only some
        const tokens = (us: (RunUsage | undefined)[], at: string) => {
          const got = us.filter((u): u is RunUsage => !!u);
          const old = beforeRecording(at, usage.recorded_since);
          if (got.length === 0) return old ? ["tokens not recorded"] : [];
          return [`${tokenLine(addTokens(got))}${old ? " (recorded for part of the run only)" : ""}`];
        };
        const callsOf = (us: (RunUsage | undefined)[]) => {
          const n = us.reduce((t, u) => t + (u?.calls ?? 0), 0);
          return n ? [plural(n, "model call")] : [];
        };
        const listed = new Set([
          ...collections.runs.filter((r) => !reading.has(r.id)).map((r) => `${r.id}:collection`),
          ...assessments.scoring_runs.map((r) => `${r._id}:scoring`)]);
        const parentShown = (u: RunUsage) => !!u.part_of && (listed.has(`${u.part_of.id}:collection`)
          || own.has(`${u.part_of.id}:${u.part_of.kind}`));
        const others = usage.runs.filter((u) => !listed.has(`${u.run_id}:${u.run_kind}`) && !parentShown(u)
          && !(u.run_kind === "collection" && !reading.has(u.run_id)));
        setRows([
          ...collections.runs.filter((r) => !reading.has(r.id)).map((r) => {
            const parts = partsOf("collection", r.id);
            return {
              key: `c${r.id}`, id: r.id, at: r.run_start_date_time, kind: RUN_KIND.collection, status: r.status,
              href: `/admin/runs/${r.id}`, ids: [r.id, ...parts.map((u) => u.run_id)],
              used: !!own.get(`${r.id}:collection`) || parts.length > 0,
              facts: [plural(r.totals?.new_documents ?? 0, "new page"),
                plural((r.totals?.signals ?? 0) + (r.totals?.other_signals ?? 0), "finding"),
                ...(r.incomplete ? [`${plural(r.incomplete, "website")} not read to the end`] : []),
                ...callsOf([own.get(`${r.id}:collection`), ...parts])],
              tokens: tokens([own.get(`${r.id}:collection`), ...parts], r.run_start_date_time),
            };
          }),
          ...assessments.scoring_runs.map((r) => ({
            key: `a${r._id}`, id: r._id, at: r.started_at, kind: RUN_KIND.scoring, status: r.status,
            href: `/admin/scoring/assessments/${r._id}`, ids: [r._id], usageKind: "scoring",
            used: own.has(`${r._id}:scoring`),
            facts: [plural(r.progress?.techs_total ?? 0, "technology", "technologies"),
              plural(r.progress?.llm_calls ?? 0, "model call")],
            tokens: tokens([own.get(`${r._id}:scoring`)], r.started_at),
          })),
          ...others.map((u) => {
            const kind = u.run_kind ?? "";
            const a = (u.about ?? {}) as About;
            const parts = partsOf(kind, u.run_id);
            return {
              key: `${kind}${u.run_id}`, id: u.run_id, at: u.first_at, tz: a.tz, kind: RUN_KIND[kind] ?? (kind || "Other"),
              status: a.status ?? null, href: aboutHref(kind, u.run_id, a),
              // only an assessment run's id also carries another kind (Points of View once written under it)
              ids: [u.run_id, ...parts.map((x) => x.run_id)], usageKind: kind === "pov" ? kind : undefined, used: true,
              facts: [...aboutFacts(kind, a), plural(u.calls + parts.reduce((n, x) => n + x.calls, 0), "model call")],
              tokens: tokens([u, ...parts], u.first_at),
            };
          }),
        ].sort((a, b) => b.at.localeCompare(a.at)).reduce(grouped, [] as HistoryRow[]));
      })
      .catch(() => {});
  }, [done]);
  const paged = useClientPage(rows, "operations-history");
  if (!rows) return null;

  return (
    <section>
      <Pager start={paged.start} total={paged.total} go={paged.go} shorter={paged.shorter} what="runs" />
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing has run yet. Start a collection above.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100 rounded-card border border-line bg-white">
          {paged.page.map((r) => {
            const main = (
              <>
                <span className="w-full shrink-0 text-xs text-muted sm:w-48">
                  {formatAt(r.at, r.tz)}{r.until && r.count ? `–${formatClock(r.until, r.tz)}` : ""}
                </span>
                <span className="shrink-0 font-medium sm:w-44">{r.kind}</span>
                <span className="min-w-0 flex-1 text-muted">
                  {r.facts.join(" · ")}
                  {(r.tokens?.length ?? 0) > 0 && <Hood><span className="block text-xs">{r.tokens!.join(" · ")}</span></Hood>}
                </span>
              </>
            );
            return (
              <li key={r.key}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm hover:bg-ground">
                  {r.href ? (
                    <Link href={r.href} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      {main}
                    </Link>
                  ) : (
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">{main}</span>
                  )}
                  <Hood><span className="font-mono text-[11px] text-neutral-400">{r.ids.join(" + ")}</span></Hood>
                  {r.status && <StatusChip status={r.status} />}
                  {r.used && (
                    <button type="button" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}
                      className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs hover:bg-ground">
                      {open === r.key ? "Hide" : "Cost by skill"}
                    </button>
                  )}
                  {r.href && <Link href={r.href} className="text-link" aria-label={`Open the ${r.kind.toLowerCase()}`}>→</Link>}
                </div>
                {open === r.key && (
                  <div className="px-5 pb-3"><ModelUse runIds={r.ids} kind={r.usageKind} table /></div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Pager className="mt-3" start={paged.start} total={paged.total} go={paged.go} shorter={paged.shorter} what="runs" />
    </section>
  );
}
