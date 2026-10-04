"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import BackLink from "@/components/BackLink";
import ConfirmAction from "@/components/ConfirmAction";
import EvidenceLine from "@/components/EvidenceLine";
import FabricLabel from "@/components/FabricLabel";
import PageHeader from "@/components/PageHeader";
import SignalItem from "@/components/SignalItem";
import SignalPanel from "@/components/SignalPanel";
import { calls, resumeAssessment, startAssessment } from "@/lib/actions";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { formatDay, formatTime, orList, plural } from "@/lib/format";
import { useHere, withFrom } from "@/lib/here";
import { blockedReason, refreshPipeline, usePipeline } from "@/lib/pipeline";
import { type Axis, formatScore, noPriorityReason, type Placement, scoreNote } from "@/lib/scoring";
import type { FoundHit } from "@/lib/signals";
import { refreshTechLabels, useTechLabel } from "@/lib/tech-labels";
import { LIVE_DOT, PRIORITY } from "@/lib/theme";

type Fabric = {
  assessment_id: string;
  fabric_id: string;
  fabric: string;
  priority: string | null;
  horizon: string | null;
  placement?: Placement | null;
  tora: Record<string, Axis>;
};

type Summary = {
  technology: { id: string; name: string; aliases: string[]; enabled: boolean; page_count: number; source_count: number };
  state: "off" | "assessing" | "stopped_partway" | "not_assessed" | "new_evidence" | "no_pov" | "current";
  assessment: { scoring_run_id: string; run_status: string; assessed_at: string; pages_read: number;
    evidence_runs: string[] | null; fabrics: Fabric[]; not_assessed_in?: string[] } | null;
  unfinished: { scoring_run_id: string; status: string; started_at: string;
    progress: { techs_done?: number; techs_total?: number } } | null;
  pov: { id: string; scoring_run_id: string; composed_at: string; version: number; headline: string | null;
    from_latest_assessment: boolean } | null;
  new_pages: { since_assessment: number; since_pov: number | null };
  estimate: { assess_calls: number; assess_calls_max: number; write_calls: number };
};

type Doc = {
  id: string;
  end_url: string;
  title?: string | null;
  kind?: string;
  category?: string;
  source_id?: string;
  run_id?: string;
  scraped_at: string;
  published_date?: string | null;
  is_stub: boolean;
  summary_text: string | null;
  new: boolean;
};

const AXES = [["market_potential", "Market"], ["strategic_fit", "Strategic fit"], ["adoption_readiness", "Adoption"]];
const field = "mt-1 block w-56 rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500";
const secondary = "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-ground disabled:opacity-50";

const FINDINGS = 5; // the top findings, in the Briefing's order; "View all" for the rest

/** Everything about one technology: its state and next step first, then its
 *  assessment and Point of View, then the findings and pages behind them. */
function TechnologyHub() {
  const { id } = useParams<{ id: string }>();
  const here = useHere();
  const label = useTechLabel();
  const p = usePipeline();
  const [s, setS] = useState<Summary | null>(null);
  const [hits, setHits] = useState<FoundHit[]>([]);
  const [hitTotal, setHitTotal] = useState(0);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const [rename, setRename] = useState("");
  const [alias, setAlias] = useState("");
  const [mergeName, setMergeName] = useState("");

  const load = useCallback(() => {
    fetchJson<Summary>(`/api/technologies/${id}/summary`)
      .then((d) => {
        setS(d);
        setRename((current) => current || d.technology.name);
        return fetchJson<{ hits: FoundHit[]; total: number }>(
          `/api/signals/found?sort=briefing&tech=${encodeURIComponent(d.technology.name)}&limit=${FINDINGS}`);
      })
      .then((d) => { setHits(d.hits); setHitTotal(d.total); })
      .catch(setError);
    fetchJson<{ documents: Doc[]; total: number }>(`/api/technologies/${id}/documents`)
      .then((d) => { setDocs(d.documents); setTotal(d.total); })
      .catch(setError);
  }, [id]);

  // reload when an assessment run or Points of View move on
  const progress = p ? `${p.assess.status}:${p.assess.techs_done}:${p.pov.composed}` : "";
  useEffect(() => { load(); }, [load, progress]);

  const loadMore = () =>
    fetchJson<{ documents: Doc[]; total: number }>(`/api/technologies/${id}/documents?skip=${docs?.length ?? 0}`)
      .then((d) => { setDocs((prev) => [...(prev ?? []), ...d.documents]); setTotal(d.total); })
      .catch(setError);

  async function act(fn: () => Promise<unknown>, done: string) {
    setNotice(null);
    try {
      await fn();
      setNotice(done);
      refreshTechLabels();
      load();
    } catch (e) {
      setNotice(e instanceof ApiError ? (e.detail ?? e.message) : "That didn't work.");
    }
  }

  async function writePov() {
    await sendJson(`/api/scoring/runs/${s!.assessment!.scoring_run_id}/pov/${id}`, "POST", {});
    await refreshPipeline();
    load();
  }

  if (error != null) return <BackendError error={error} />;
  if (!s) return null;
  const t = s.technology;
  const a = s.assessment;
  const blocked = blockedReason(p, "assess");
  const resume = p?.for_analyst.find((i) => i.kind === "resume" && i.scoring_run_id === s.unfinished?.scoring_run_id);
  const name = label(t.name);

  // the state in one sentence: what's true now, and what would bring it up to date
  const sentence: Record<Summary["state"], string | null> = {
    new_evidence: `${plural(s.new_pages.since_assessment, "new page")} since the ${formatDay(a?.assessed_at)} assessment. Assess again to include ${s.new_pages.since_assessment === 1 ? "it" : "them"}.`,
    not_assessed: "Not assessed yet.",
    no_pov: s.pov ? `Assessed ${formatDay(a?.assessed_at)}. Its Point of View is from an earlier assessment, so it's ready for a new one.`
      : `Assessed ${formatDay(a?.assessed_at)}. Ready for a Point of View.`,
    current: `Up to date: the Point of View uses the ${formatDay(a?.assessed_at)} assessment, and no new pages have arrived since.`,
    off: null, assessing: null, stopped_partway: null, // said below, with their details
  };

  // the one main button, by the technology's state (services/evidence on the backend)
  let main: React.ReactNode = null;
  if (s.state === "stopped_partway")
    main = (
      <ConfirmAction label="Resume" cost={resume ? calls(resume.calls) : undefined} disabled={blocked}
        question={resume
          ? `Resume the assessment run? About ${plural(resume.calls, "model call")} for the ${plural(resume.count, "technology", "technologies")} left.`
          : "Resume the assessment run? What's already assessed is kept."}
        onConfirm={() => resumeAssessment(s.unfinished!.scoring_run_id)} />
    );
  else if (s.state === "not_assessed" || s.state === "new_evidence")
    main = (
      <ConfirmAction label="Assess now" cost={calls(s.estimate.assess_calls)} disabled={blocked}
        question={`Assess ${name}? About ${plural(s.estimate.assess_calls, "model call")} (up to ${s.estimate.assess_calls_max}).`}
        onConfirm={() => startAssessment([id])} />
    );
  else if (s.state === "no_pov")
    main = (
      <ConfirmAction label="Write Point of View" cost={calls(s.estimate.write_calls)}
        question="Write the Point of View? About 1 model call." confirmLabel="Write" onConfirm={writePov} />
    );
  else if (s.state === "current" && s.pov)
    main = (
      <Link href={withFrom(`/admin/scoring/pov/${s.pov.scoring_run_id}/${id}`, here)}
        className="rounded-full bg-navy px-4 py-2 text-sm text-white hover:bg-navy-strong">Open Point of View</Link>
    );

  return (
    <div>
      <BackLink fallback="/admin/technologies" />
      <PageHeader title={name}
        intro="Everything the radar knows about this technology."
        help={<>
          <li>The sentence under the name says where it stands. The button beside it takes the next step and shows its
            cost before starting. Manage renames it, merges other names into it or switches it off, at no model
            cost.</li>
          <li>The grey line gives the date of its latest assessment, how many pages that assessment read, and how many
            pages and sources mention it in all.</li>
          <li>Assessment: one row per fabric, Tata Communications&apos; business areas (Network, Cloud, Security,
            Interaction, IoT, Media). P1–P6 is the recommended priority, from P1 act now to P6 just watch; H1–H3 is how soon it arrives,
            from near to far. Market, Strategic fit and Adoption are scores from 0 to 10; Details shows how each was
            reached. A technology is assessed only in the fabrics judged relevant to it before scoring; the line
            under the rows names the others.</li>
          <li>Each score rests on three measures. &ldquo;1 of 3 measures&rdquo; means only one had enough evidence, so
            read the score with care; &ldquo;not enough evidence&rdquo; means none did, so there&apos;s no score (not a
            zero). A fabric without a priority says what&apos;s missing.</li>
          <li>Point of View: the written conclusion from its latest assessment, and how many pages arrived after it
            was written.</li>
          <li>Findings: its top 5 on the Briefing; View all opens the full list. Pages: every page linked to it,
            newest first; &ldquo;new&rdquo; marks pages its assessment hasn&apos;t read yet.</li>
        </>}
        right={
        <div className="flex shrink-0 flex-col items-end gap-2">
          {main}
          <button type="button" onClick={() => setManage(!manage)} aria-expanded={manage}
            className="text-sm text-link hover:underline">Manage {manage ? "▴" : "▾"}</button>
        </div>
      }>
        {a && a.fabrics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {a.fabrics.map((f) => <FabricLabel key={f.fabric_id} id={f.fabric_id} name={f.fabric} />)}
          </div>
        )}
        {sentence[s.state] && <p className="mt-3 text-[15px] text-ink">{sentence[s.state]}</p>}
        <p className="mt-1 text-sm text-muted">
          {a && (
            <>
              Assessed {formatDay(a.assessed_at)} · read {plural(a.pages_read, "page")}
              {a.evidence_runs && ` from ${plural(a.evidence_runs.length, "collection")}`}{" · "}
            </>
          )}
          {plural(t.page_count, "page")} from {plural(t.source_count, "source")}, all time
        </p>
        {s.state === "off" && (
          <p className="mt-2 text-sm">
            Assessment switched off for this technology.{" "}
            <button type="button" onClick={() => setManage(true)} className="text-link hover:underline">Manage</button>
          </p>
        )}
        {s.state === "assessing" && (
          <p className="mt-2 flex items-center gap-2 text-sm"><span className={LIVE_DOT} />
            Being assessed now · {s.unfinished?.progress.techs_done ?? 0} of{" "}
            {plural(s.unfinished?.progress.techs_total ?? 0, "technology", "technologies")} in this run
          </p>
        )}
        {s.state === "stopped_partway" && (
          <p className="mt-2 text-sm">
            Assessment stopped partway on {formatDay(s.unfinished?.started_at)}.{" "}
            {a ? "The results below are from the previous assessment." : "Not assessed yet."}
          </p>
        )}
      </PageHeader>

      {notice && <p className="mt-3 text-xs text-muted">{notice}</p>}

      {manage && (
        <div className="mt-5 rounded-card border border-line bg-white px-5 py-4">
          <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            Aliases — the names found on pages that make up this technology
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {t.aliases.map((x) => <span key={x} className="rounded-full bg-navy/5 px-2 py-0.5 text-[11px] text-ink">{x}</span>)}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-neutral-100 pt-4 text-sm">
            <label>
              Rename <span className="text-xs text-muted">(capitals are kept for display)</span>
              <input className={field} value={rename} onChange={(e) => setRename(e.target.value)} />
            </label>
            <button className={secondary} onClick={() =>
              act(() => sendJson(`/api/technologies/${id}`, "PUT", { name: rename, enabled: t.enabled }), "Renamed. Its pages now carry the new name.")}>
              Save name
            </button>
            <label>
              Claim a name from another technology
              <input className={field} placeholder="the exact name" value={alias} onChange={(e) => setAlias(e.target.value)} />
            </label>
            <button className={secondary} disabled={!alias.trim()} onClick={() =>
              act(() => sendJson(`/api/technologies/${id}/claim_alias`, "POST", { alias: alias.trim() }), "Name claimed. Its pages moved here.")}>
              Claim
            </button>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={t.enabled} onChange={(e) =>
                act(() => sendJson(`/api/technologies/${id}`, "PUT", { name: t.name, enabled: e.target.checked }), "Saved.")} />
              Switched on — assessment runs assess it
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-neutral-100 pt-4 text-sm">
            <label>
              Merge another technology into this one
              <input className={`${field} w-72`} placeholder="its exact name, e.g. ai agents" value={mergeName}
                onChange={(e) => setMergeName(e.target.value)} />
            </label>
            <ConfirmAction label={`Merge into ${name}`} secondary confirmLabel="Merge"
              disabled={mergeName.trim() ? null : "Type the name of the technology to merge."}
              question={`Merge ${mergeName.trim()} into ${name}? ${mergeName.trim()}'s pages move to ${name}, and ${mergeName.trim()} is removed.`}
              onConfirm={() => act(() => sendJson(`/api/technologies/${id}/merge`, "POST", { others: [mergeName.trim()] }),
                `Merged. ${name} keeps its name and now has the merged pages.`)} />
          </div>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Assessment</h2>
        {a ? (
          <div className="mt-3 rounded-card border border-line bg-white px-5 py-4">
            <ul className="divide-y divide-neutral-100">
              {a.fabrics.map((f) => {
                const why = noPriorityReason(f.placement);
                return (
                  <li key={f.fabric_id} className="flex flex-wrap items-center gap-x-5 gap-y-2 py-2.5">
                    <span className="w-28 shrink-0"><FabricLabel id={f.fabric_id} name={f.fabric} /></span>
                    <span className={`w-10 shrink-0 px-1 py-0.5 text-center font-mono text-xs ${f.priority ? PRIORITY[f.priority] : "text-neutral-400"}`}>
                      {f.priority ?? "—"}
                    </span>
                    <span className="w-8 shrink-0 font-mono text-xs text-neutral-600">{f.horizon ?? "—"}</span>
                    <span className="flex w-full flex-wrap gap-x-6 gap-y-1 sm:w-auto sm:flex-1">
                      {AXES.map(([key, label]) => {
                        const axis = f.tora?.[key];
                        const note = scoreNote(axis);
                        return (
                          <span key={key} className="flex items-center gap-2 text-xs text-muted">
                            {label}
                            {axis?.score != null ? (
                              <>
                                <span className="h-1.5 w-20 bg-neutral-100"><span className="block h-full bg-navy" style={{ width: `${axis.score * 10}%` }} /></span>
                                <span className="font-mono text-ink">{formatScore(axis.score)}</span>
                                {note && <span>· {note}</span>}
                              </>
                            ) : <span className="italic">{note || "not scored"}</span>}
                          </span>
                        );
                      })}
                    </span>
                    <Link href={withFrom(`/admin/scoring/assessments/${a.scoring_run_id}/${encodeURIComponent(f.assessment_id)}`, here)}
                      className="text-sm text-link hover:underline">Details →</Link>
                    {why && <p className="basis-full text-xs text-muted">{why}</p>}
                  </li>
                );
              })}
            </ul>
            {(a.not_assessed_in?.length ?? 0) > 0 && (
              <p className="border-t border-neutral-100 pt-2.5 text-xs text-muted">
                Not assessed in {orList(a.not_assessed_in!)}: judged not relevant to this technology before scoring.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-4">
              <EvidenceLine assessments={[{ evidence_runs: a.evidence_runs ?? undefined }]} />
              <Link href={withFrom(`/admin/scoring/assessments/${a.scoring_run_id}`, here)}
                className="mt-3 text-sm text-link hover:underline">Assessment run →</Link>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded-card border border-line bg-white px-5 py-4 text-sm">
            Not assessed yet.
            {t.enabled && s.state !== "assessing" && (
              <ConfirmAction label="Assess now" cost={calls(s.estimate.assess_calls)} disabled={blocked} secondary
                question={`Assess ${name}? About ${plural(s.estimate.assess_calls, "model call")} (up to ${s.estimate.assess_calls_max}).`}
                onConfirm={() => startAssessment([id])} />
            )}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Point of View</h2>
        <div className="mt-3 rounded-card border border-line bg-white px-5 py-4 text-sm">
          {s.pov ? (
            <>
              {s.pov.headline && <p className="border-l-2 border-navy pl-3 leading-relaxed text-ink">{s.pov.headline}</p>}
              <p className="mt-2 text-muted">
                Written {formatDay(s.pov.composed_at)}
                {s.pov.from_latest_assessment && a ? ` · assessed ${formatDay(a.assessed_at)}` : " · from an earlier assessment"}
                {" "}· version {s.pov.version}
                {(s.new_pages.since_pov ?? 0) > 0 && ` · New since written: ${plural(s.new_pages.since_pov!, "page")}`}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link href={withFrom(`/admin/scoring/pov/${s.pov.scoring_run_id}/${id}`, here)} className={secondary}>Open</Link>
                {a && (
                  <ConfirmAction label={s.pov.from_latest_assessment ? "Rewrite" : "Write from the latest assessment"}
                    cost={calls(1)} secondary confirmLabel="Write"
                    question={`${s.pov.from_latest_assessment ? "Rewrite" : "Write"} the Point of View from the latest assessment? About 1 model call.`}
                    onConfirm={writePov} />
                )}
              </div>
            </>
          ) : (
            <span className="text-muted">
              No Point of View yet.{!a && " It can be written once the technology is assessed."}
            </span>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline gap-4">
          <h2 className="text-lg font-semibold">Findings</h2>
          {hitTotal > hits.length && (
            <Link href={`/admin?${new URLSearchParams({ tech: t.name, days: "all" })}`} className="text-sm text-link hover:underline">
              View all {hitTotal} findings →
            </Link>
          )}
        </div>
        {hits.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No findings yet.{total > 0 && ` Its ${plural(total, "page")} ${total === 1 ? "is" : "are"} listed under Pages, below.`}
          </p>
        ) : (
          <div className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-card border border-line bg-white">
            {hits.map((h) => <SignalItem key={`${h.doc_id}:${h.n}`} item={h} />)}
          </div>
        )}
      </section>

      <details className="mt-8">
        <summary className="cursor-pointer text-lg font-semibold">
          Pages <span className="text-sm font-normal text-muted">· {total}
            {s.new_pages.since_assessment > 0 && a && ` · ${s.new_pages.since_assessment} new since the assessment`}</span>
        </summary>
        {docs && (
          <div className="mt-3 divide-y divide-neutral-100 rounded-card border border-line bg-white">
            {docs.map((d) => (
              <div key={d.id} className="px-5 py-3.5">
                <div className="flex items-baseline gap-3">
                  <span className="min-w-0 flex-1 truncate font-medium">{d.title || d.end_url.replace(/^https?:\/\//, "")}</span>
                  {d.new && <span className="shrink-0 rounded-full bg-azure/10 px-2 py-0.5 text-[11px] text-ink">new</span>}
                  <span className="shrink-0 bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] uppercase text-neutral-600">{d.kind ?? "article"}</span>
                </div>
                <a href={d.end_url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate font-mono text-xs text-link hover:underline">
                  {d.end_url}
                </a>
                {d.summary_text && <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{d.summary_text}</p>}
                <div className="mt-1.5 flex flex-wrap gap-x-4 font-mono text-[11px] text-neutral-500">
                  <span>{d.source_id}</span>
                  <span>collected {formatTime(d.scraped_at)}</span>
                  {d.published_date && <span>published {d.published_date}</span>}
                  {d.run_id && <Link href={`/admin/runs/${d.run_id}`} className="hover:underline">collection {d.run_id}</Link>}
                </div>
              </div>
            ))}
            {docs.length === 0 && <p className="px-5 py-6 text-sm text-neutral-500">No pages linked to this technology.</p>}
          </div>
        )}
        {docs && docs.length < total && (
          <button onClick={loadMore} className={`mt-3 ${secondary}`}>Load more ({docs.length} of {total})</button>
        )}
      </details>

      <SignalPanel />
    </div>
  );
}

export default function TechnologyPage() {
  return (
    <Suspense fallback={null}>
      <TechnologyHub />
    </Suspense>
  );
}
