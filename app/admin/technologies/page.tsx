"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import ConfirmAction from "@/components/ConfirmAction";
import PageHeader from "@/components/PageHeader";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import { calls, resumeAssessment, startAssessment, writePovs } from "@/lib/actions";
import { fetchJson } from "@/lib/api";
import { formatDay, plural } from "@/lib/format";
import { useHere, withFrom } from "@/lib/here";
import { useHood } from "@/lib/hood";
import { blockedReason, usePipeline } from "@/lib/pipeline";
import { STATE_LABELS, STATE_MEANING, STATE_ORDER, STATE_STYLE, type TechState } from "@/lib/states";
import { useTechLabel } from "@/lib/tech-labels";
import { LIVE_DOT } from "@/lib/theme";

type Tech = {
  _id: string;
  name: string;
  enabled: boolean;
  aliases: string[];
  state: TechState;
  new_pages: number;
  assessed_at: string | null;
  pov: { scoring_run_id: string; composed_at: string } | null;
  doc_count?: number;
  page_count?: number;
  source_count?: number;
  horizons?: Record<string, number>;
};

type Resolve = {
  _id: string;
  status: string;
  phase?: string;
  llm_calls?: number;
  raw_strings?: number;
  technologies?: number;
  docs_stamped?: number;
  started_at: string;
  finished_at?: string;
  error?: string;
};

type Payload = {
  technologies: Tech[];
  total: number;
  state_counts: Partial<Record<TechState, number>>;
  // never assessed, but now at the page bar the latest assessment by page count used
  over_floor?: { min_pages: number; started_at: string; tech_ids: string[]; technologies: number;
    calls: number; calls_max: number } | null;
  summary: { tech_count: number; tagged_docs: number; kinds: Record<string, number>; horizons: Record<string, number> };
  last_resolve: Resolve | null;
};

const PAGE = 100;
const HORIZON_ORDER = ["H1", "H2", "H3"];

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-line bg-white px-5 py-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-[26px] font-semibold leading-tight">{value}</div>
      {sub && <div className="mt-0.5 font-mono text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

/** The register by state: what needs you first, each technology's state,
 *  new pages, assessment and Point of View. ?state= filters (the Briefing's
 *  "Waiting for you" links here), and a filtered list carries its batch
 *  action. Inventory counts sit behind Technical details. */
function Technologies() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const here = useHere();
  const label = useTechLabel();
  const hood = useHood();
  const p = usePipeline();
  const state = (STATE_ORDER as string[]).includes(params.get("state") ?? "") ? params.get("state") as TechState : null;
  const [data, setData] = useState<Payload | null>(null);
  const [rows, setRows] = useState<Tech[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    (skip: number) =>
      fetchJson<Payload>(`/api/technologies?limit=${PAGE}&skip=${skip}&q=${encodeURIComponent(debouncedQ)}${state ? `&state=${state}` : ""}`)
        .then((d) => {
          setData(d);
          setRows((prev) => (skip === 0 ? d.technologies : [...prev, ...d.technologies]));
          setError(null);
        })
        .catch(setError),
    [debouncedQ, state],
  );

  // reload for a new search or filter, and when an assessment or write finishes
  const finished = p ? `${p.assess.status}:${p.pov.job?.status ?? ""}:${p.technologies.resolve_status ?? ""}` : "";
  useEffect(() => { load(0); }, [load, finished]);

  // while technologies are organized, refresh the first page
  const running = data?.last_resolve?.status === "running";
  useEffect(() => {
    if (running && !timer.current) timer.current = setInterval(() => load(0), 5000);
    if (!running && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [running, load]);

  const setState = (next: TechState | null) => {
    const q = new URLSearchParams(params.toString());
    if (next) q.set("state", next);
    else q.delete("state");
    const rest = q.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
  };

  const r = data?.last_resolve;
  const counts = data?.state_counts ?? {};
  const all = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  const shown = STATE_ORDER.filter((s) => (counts[s] ?? 0) > 0 || s === state);
  const over = data?.over_floor;
  // a filtered list's batch action: exactly the technologies the pipeline would act on
  const assess = p?.for_analyst.find((i) => i.kind === "assess");
  const write = p?.for_analyst.find((i) => i.kind === "write");
  const resume = p?.for_analyst.find((i) => i.kind === "resume");
  const searching = debouncedQ !== "";
  let batch: React.ReactNode = null;
  if (state === "new_evidence" && assess && !searching)
    batch = <ConfirmAction label={`Assess these ${assess.count}`} cost={calls(assess.calls)} disabled={blockedReason(p, "assess")}
      question={`Assess ${plural(assess.count, "technology", "technologies")} with new pages? About ${plural(assess.calls, "model call")} (up to ${assess.calls_max}).`}
      onConfirm={() => startAssessment(assess.tech_ids)} />;
  if (state === "no_pov" && write && !searching)
    batch = <ConfirmAction label={`Write these ${write.count}`} cost={calls(write.calls)}
      disabled={p?.pov.job?.status === "running" ? "Points of View are being written." : null}
      question={`Write ${plural(write.count, "Point of View", "Points of View")}? About ${plural(write.calls, "model call")}.`}
      onConfirm={() => writePovs(false)} />;
  if (state === "stopped_partway" && resume)
    batch = <ConfirmAction label="Resume the run" cost={calls(resume.calls)} disabled={blockedReason(p, "assess")}
      question={`Resume the assessment run of ${formatDay(resume.started_at)}? About ${plural(resume.calls, "model call")} for the ${plural(resume.count, "technology", "technologies")} left.`}
      onConfirm={() => resumeAssessment(resume.scoring_run_id)} />;
  if (state === "not_assessed" && over && !searching)
    batch = <ConfirmAction label={`Assess the ${over.technologies} with ${over.min_pages}+ pages`} cost={calls(over.calls)}
      disabled={blockedReason(p, "assess")}
      question={`Assess ${plural(over.technologies, "technology", "technologies")} not yet assessed that have ${over.min_pages} or more pages? About ${plural(over.calls, "model call")}${over.calls_max > over.calls ? ` (up to ${over.calls_max.toLocaleString()})` : ""}.`}
      onConfirm={() => startAssessment(over.tech_ids)} />;

  return (
    <div>
      <PageHeader title="Technologies" right={<TechnicalDetailsSwitch />}
        intro="Every technology the radar found on collected pages, and where each one stands."
        help={<>
          <li>One row per technology, those found on the most pages first. Click a name for everything about it:
            its assessment, its Point of View, its findings and its pages.</li>
          <li>The filters show what needs you, and what each state means is written under them. A filtered list
            offers a button to act on all of it at once; it shows the model-call cost and asks before starting.</li>
          <li>New pages: pages about it collected since its latest assessment (every page, if it was never
            assessed). Assessed: the date of that assessment. Point of View: when its Point of View was written.</li>
          <li>The Technical details switch adds page and source counts, and how many of its pages come from H1, H2
            and H3 sources (see Setup → Sources).</li>
        </>} />

      {error != null && <BackendError error={error} />}

      {running && (
        <p className="mt-4 flex items-center gap-2 text-sm"><span className={LIVE_DOT} />Organizing technologies…</p>
      )}

      {data && (
        <>
          {hood && (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="Technologies" value={String(data.summary.tech_count)} />
                <Tile label="Pages linked" value={String(data.summary.tagged_docs)} />
                <Tile label="Articles · PDFs"
                  value={`${data.summary.kinds["article"] ?? 0} · ${data.summary.kinds["pdf"] ?? 0}`}
                  sub={`${data.summary.kinds["article"] ?? 0} articles · ${data.summary.kinds["pdf"] ?? 0} PDFs`} />
                <Tile label="By horizon"
                  value={HORIZON_ORDER.map((h) => data.summary.horizons[h] ?? 0).join(" · ")}
                  sub={HORIZON_ORDER.map((h) => `${h} ${data.summary.horizons[h] ?? 0}`).join(" · ")} />
              </div>
              {r && (
                <p className="mt-3 text-xs text-neutral-500">
                  {r.status === "completed"
                    ? `Organized ${formatDay(r.finished_at)} · ${r.raw_strings} names → ${r.technologies} technologies · ${r.docs_stamped} pages linked. `
                    : r.status === "failed" ? `The last organize failed: ${r.error}. ` : ""}
                  <Link href="/admin/operations" className="text-link hover:underline">Organize again on Operations →</Link>
                </p>
              )}
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-1.5" role="group" aria-label="Filter by state">
            {[null, ...shown].map((s) => {
              const on = s === state;
              return (
                <button key={s ?? "all"} type="button" aria-pressed={on} onClick={() => setState(s)}
                  className={`rounded-full border px-3 py-1 text-[13px] ${on ? "border-navy bg-navy text-white" : "border-line bg-white hover:bg-ground"}`}>
                  {s ? STATE_LABELS[s] : "All"}{" "}
                  <span className={`tabular-nums ${on ? "text-white/75" : "text-muted"}`}>{(s ? counts[s] ?? 0 : all).toLocaleString()}</span>
                </button>
              );
            })}
          </div>

          {/* what the states mean: each one shown on "All", the chosen one under a filter */}
          <dl className="mt-3 space-y-1.5 text-[13px]">
            {(state ? [state] : shown).map((s) => (
              <div key={s} className="sm:flex sm:gap-3">
                <dt className="shrink-0 sm:w-48">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] ${STATE_STYLE[s]}`}>{STATE_LABELS[s]}</span>
                </dt>
                <dd className="mt-1 text-neutral-600 sm:mt-0">
                  {STATE_MEANING[s]}
                  {s === "not_assessed" && (
                    <>
                      {" "}Assess one from its page, or a group by page count on{" "}
                      <Link href="/admin/scoring/assessments" className="text-link hover:underline">Assessment runs</Link>.
                      {over && ` ${plural(over.technologies, "of them now has", "of them now have")} ${over.min_pages} or more pages, the bar the ${formatDay(over.started_at)} assessment used.`}
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              className="min-w-0 flex-1 basis-64 rounded border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
              placeholder="Search technologies…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <span className="text-xs text-muted">{plural(data.total, "technology", "technologies")}</span>
            {batch && <span className="ml-auto">{batch}</span>}
            {!batch && searching && (state === "new_evidence" || state === "no_pov" || (state === "not_assessed" && over)) && (
              <span className="ml-auto text-xs text-muted">Clear the search to act on them all.</span>
            )}
          </div>

          <div className="mt-3 overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="px-5 py-2 font-medium">Technology</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 text-right font-medium">New pages</th>
                  <th className="px-3 py-2 font-medium">Assessed</th>
                  <th className="px-3 py-2 font-medium">Point of View</th>
                  {hood && <th className="px-3 py-2 text-right font-mono font-medium">Docs · Pages · Sources</th>}
                  {hood && <th className="px-5 py-2 text-right font-mono font-medium">H1 · H2 · H3</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((t) => (
                  <tr key={t._id} className="hover:bg-neutral-50">
                    <td className="px-5 py-2.5">
                      <Link href={withFrom(`/admin/technologies/${t._id}`, here)}
                        className={`font-medium hover:underline ${t.enabled ? "" : "text-neutral-400"}`}>
                        {label(t.name)}
                      </Link>
                      {hood && t.aliases.length > 1 && (
                        <span className="ml-2 font-mono text-[11px] text-neutral-400">
                          +{t.aliases.length - 1} alias{t.aliases.length > 2 ? "es" : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] ${STATE_STYLE[t.state]}`}>
                        {STATE_LABELS[t.state]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.new_pages > 0 ? t.new_pages : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted">{t.assessed_at ? formatDay(t.assessed_at) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {t.pov ? (
                        <Link href={withFrom(`/admin/scoring/pov/${t.pov.scoring_run_id}/${t._id}`, here)}
                          className="text-link hover:underline">Written {formatDay(t.pov.composed_at)}</Link>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    {hood && (
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                        {t.doc_count ?? 0} · {t.page_count ?? 0} · {t.source_count ?? 0}
                      </td>
                    )}
                    {hood && (
                      <td className="px-5 py-2.5 text-right font-mono text-xs tabular-nums text-neutral-500">
                        {HORIZON_ORDER.map((h) => t.horizons?.[h] ?? 0).join(" · ")}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="px-5 py-6 text-sm text-neutral-500">
                {data.summary.tech_count === 0
                  ? "No technologies yet. They appear once a collection has been organized."
                  : searching ? "Nothing matches the search." : "No technologies in this state."}
              </p>
            )}
          </div>
          {rows.length < data.total && (
            <button onClick={() => load(rows.length)}
              className="mt-3 rounded-full border border-line bg-white px-4 py-2 text-sm hover:bg-neutral-100">
              Show more ({rows.length} of {data.total})
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function TechnologiesPage() {
  return (
    <Suspense fallback={null}>
      <Technologies />
    </Suspense>
  );
}
