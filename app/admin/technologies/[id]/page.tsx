"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import ActButton from "@/components/ActButton";
import BackendError from "@/components/BackendError";
import BackLink from "@/components/BackLink";
import ConfirmAction from "@/components/ConfirmAction";
import DecisionNote from "@/components/DecisionNote";
import AddLink from "@/components/AddLink";
import FabricAssessment from "@/components/FabricAssessment";
import FindEvidence from "@/components/FindEvidence";
import TechAnswers from "@/components/TechAnswers";
import FabricLabel from "@/components/FabricLabel";
import PageHeader from "@/components/PageHeader";
import SignalItem from "@/components/SignalItem";
import SignalPanel from "@/components/SignalPanel";
import { calls, resumeAssessment, startAssessment, startClassify } from "@/lib/actions";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { formatAt, formatDay, formatTime, orList, plural } from "@/lib/format";
import { useHere, withFrom } from "@/lib/here";
import { useHood } from "@/lib/hood";
import { blockedReason, isLive, refreshPipeline, usePipeline } from "@/lib/pipeline";
import { type Axis, type Placement } from "@/lib/scoring";
import type { FoundHit } from "@/lib/signals";
import { type Catalog, type CitedPage, type Classification, type Status, STATUS_LABELS, STATUS_STYLE } from "@/lib/classification";
import { decide } from "@/lib/decisions";
import { type Scored, type TechState, thinScoring } from "@/lib/states";
import { refreshTechLabels, useTechLabel } from "@/lib/tech-labels";
import { LIVE_DOT } from "@/lib/theme";

type Fabric = {
  assessment_id: string;
  fabric_id: string;
  fabric: string;
  priority: string | null;
  horizon: string | null;
  placement?: Placement | null;
  tora: Record<string, Axis>;
  measures: Scored;
};

type Summary = {
  frontier: { edition: string; placed: boolean } | null; // the latest published edition, and whether it's in it
  technology: { id: string; name: string; aliases: string[]; enabled: boolean; page_count: number; source_count: number;
    switched_off_at?: string | null; switched_off_tz?: string | null; pages_since_off?: number; wake?: boolean;
    imported?: { file: string; at: string; tz: string | null; description: string | null } | null; catalog: Catalog };
  state: TechState;
  assessment: { scoring_run_id: string; run_status: string; assessed_at: string; pages_read: number;
    evidence_runs: string[] | null; measures: Scored; fabrics: Fabric[]; not_assessed_in?: string[] } | null;
  unfinished: { scoring_run_id: string; status: string; started_at: string;
    progress: { techs_done?: number; techs_total?: number } } | null;
  pov: { id: string; scoring_run_id: string; composed_at: string; composed_tz: string | null; version: number; headline: string | null;
    from_latest_assessment: boolean } | null;
  new_pages: { since_assessment: number; since_pov: number | null };
  estimate: { assess_calls: number; assess_calls_max: number; write_calls: number };
  status?: { status: Status; reason: string; notes: string[] };
  classification?: Classification;
  cited_pages?: Record<string, CitedPage>;
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
  found_by?: { job_id: string; at: string; tz: string | null };
};

const field = "mt-1 block w-56 rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500";
const secondary = "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-ground disabled:opacity-50";

const FINDINGS = 5; // the top findings, in the Briefing's order; "View all" for the rest

/** Everything about one technology: its state and next step first, then its
 *  assessment and Point of View, then the findings and pages behind them. */
function TechnologyHub() {
  const { id } = useParams<{ id: string }>();
  const here = useHere();
  const label = useTechLabel();
  const hood = useHood();
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
  const [fullDescription, setFullDescription] = useState(false);
  const [evidence, setEvidence] = useState<"findings" | "pages">("findings");

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

  // reload when an assessment run, a classification run or Points of View move on
  const progress = p ? `${p.assess.status}:${p.assess.techs_done}:${p.pov.composed}:${p.classify?.status}:${p.classify?.finished_at}` : "";
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
      setNotice(errorText(e));
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
  // how solid the latest assessment is: measures scored, and the fabrics it couldn't place
  const unplaced = a?.fabrics.filter((f) => !f.priority).map((f) => f.fabric) ?? [];
  const thin = thinScoring(a?.measures);
  const status = s.status?.status;
  const classified = !!s.classification?.classified_at;
  const imported = t.imported;

  // where it is on the radar's journey (UX rule 1), and the one next step with its cost
  const journey = [
    { label: "Collected", done: t.page_count > 0 },
    { label: "Classified", done: classified },
    { label: "Assessed", done: !!a },
    { label: "Point of View", done: !!s.pov },
    { label: "In the leaders' view", done: !!s.frontier?.placed }, // in the latest published edition, what leaders see
  ];
  const assess = (label: string, secondary = false) => (
    <ConfirmAction label={label} secondary={secondary} cost={calls(s.estimate.assess_calls)} disabled={blocked}
      question={`Assess ${name}? About ${plural(s.estimate.assess_calls, "model call")} (up to ${s.estimate.assess_calls_max}).`}
      onConfirm={() => startAssessment([id])} />
  );
  const lookForMore = (
    <>
      <FindEvidence gap={{ kind: "technology", tech_id: id }} only="button" onDone={load} />
      <AddLink gap={{ tech_id: id }} onDone={load} />
    </>
  );
  let next: React.ReactNode;
  let main: React.ReactNode = null;
  if (s.state === "off") {
    next = <>
      Switched off{t.switched_off_at ? ` on ${formatAt(t.switched_off_at, t.switched_off_tz)}` : ""}: left out of
      assessments, Points of View and the leaders&apos; view, while its pages are still collected.
      {t.wake && <span className="text-amber-800"> {plural(t.pages_since_off ?? 0, "new page")} since: have a look
        below, and switch it back on if it matters now.</span>}
    </>;
    main = <ActButton label="Switch it back on" className={secondary} onDone={load}
      run={() => sendJson(`/api/technologies/${id}`, "PUT", { name: t.name, enabled: true })} />;
  } else if (s.state === "assessing") {
    next = <span className="inline-flex items-center gap-2"><span className={LIVE_DOT} />
      Being assessed now · {s.unfinished?.progress.techs_done ?? 0} of{" "}
      {plural(s.unfinished?.progress.techs_total ?? 0, "technology", "technologies")} in this run.</span>;
  } else if (s.state === "stopped_partway") {
    next = `Its assessment stopped partway on ${formatDay(s.unfinished?.started_at)}.${a ? " The results below are from the previous assessment." : ""} Resume to finish it.`;
    main = (
      <ConfirmAction label="Resume" cost={resume ? calls(resume.calls) : undefined} disabled={blocked}
        question={resume
          ? `Resume the assessment run? About ${plural(resume.calls, "model call")} for the ${plural(resume.count, "technology", "technologies")} left.`
          : "Resume the assessment run? What's already assessed is kept."}
        onConfirm={() => resumeAssessment(s.unfinished!.scoring_run_id)} />
    );
  } else if (!a && t.page_count === 0) {
    next = "No pages about it yet, so there's nothing to classify or assess. Find evidence searches the web for pages about it; Add a link reads a page you know.";
    main = lookForMore;
  } else if (!a && !classified) {
    next = "Classify it: one model call reads its pages and judges how solid its evidence is, its commercial availability, TRL and domain.";
    main = <>
      <ConfirmAction label="Classify" cost={calls(1)}
        disabled={isLive(p?.classify?.status) ? "Technologies are being classified now." : null}
        question={`Classify ${name}? About 1 model call, reading the summaries and quotes of its pages.`}
        onConfirm={() => startClassify([id])} />
      {assess("Assess anyway", true)}
    </>;
  } else if (!a && status === "thin") {
    next = "Its evidence was judged thin, so it waits before scoring. Find evidence looks for more on the web, or add a page you know. It can still be assessed as it is.";
    main = <>{lookForMore}{assess("Assess anyway", true)}</>;
  } else if (!a) {
    next = "Ready to assess: it's scored in each fabric it touches, then its Point of View can be written.";
    main = assess("Assess now");
  } else if (s.state === "new_evidence") {
    next = `${plural(s.new_pages.since_assessment, "new page")} since the ${formatDay(a.assessed_at)} assessment. Assess again to include ${s.new_pages.since_assessment === 1 ? "it" : "them"}.`;
    main = assess("Assess again");
  } else if (s.state === "no_pov") {
    next = s.pov ? "Its Point of View is from an earlier assessment: write it again from the latest one."
      : `Assessed ${formatDay(a.assessed_at)}: write its Point of View.`;
    main = (
      <ConfirmAction label="Write Point of View" cost={calls(s.estimate.write_calls)}
        question="Write the Point of View? About 1 model call." confirmLabel="Write" onConfirm={writePov} />
    );
  } else {
    next = status === "placed" && s.frontier?.placed
      ? `In the leaders' view, in the ${s.frontier.edition} edition: ${s.status?.reason}. Nothing else waits; anything a person can still settle shows in its fabric's tab below.`
      : status === "placed"
      ? `Placed: ${s.status?.reason}. Leaders see it in the leaders' view once the next edition is published (Briefing › Publish the edition).`
      : `Held beside the grid: ${s.status?.reason ?? "no fabric could be placed"}. To place it, score a missing measure by hand or find evidence for it in a fabric's tab below, or override its priority.`;
    if (s.pov) main = (
      <Link href={withFrom(`/admin/scoring/pov/${s.pov.scoring_run_id}/${id}`, here)}
        className="rounded-full bg-navy px-4 py-1.5 text-sm text-white hover:bg-navy-strong">Open Point of View</Link>
    );
  }

  return (
    <div>
      <BackLink fallback="/admin/technologies" />
      <PageHeader title={name}
        intro="Everything the radar knows about this technology."
        help={<>
          <li>The line under the name shows where it is on the radar&apos;s journey: collected, classified, assessed,
            its Point of View written, and in the leaders&apos; view, the screen Tata&apos;s leaders read. Next step says what moves it on; its
            button shows the cost and asks before starting. Manage renames it, merges other names into it or
            switches it off, at no model cost.</li>
          <li>Under the name: whether it&apos;s in the catalog, Tata&apos;s own list of emerging technologies, with
            Tata&apos;s description when the catalog gave one. Add to the catalog or Take out of the catalog changes that, as a
            person&apos;s choice with Undo. Each answer says where it came from: its pages, its assessment, a person,
            or the catalog; under a person&apos;s or the catalog&apos;s value it also says what the radar itself
            judged, and Why? opens that reason and its pages.</li>
          <li>The grey line gives the date of its latest assessment, how many pages that assessment read, and how many
            pages and sources mention it in all.</li>
          <li>Assessment: one tab per fabric it was assessed in, Tata Communications&apos; business areas. Each tab
            leads with the priority, P1 act now to P6 just watch, and the two things it&apos;s worked out from: how
            soon it arrives and how big the prize is, each with how many of its measures were scored.</li>
          <li>Override priority sets it by hand, with a reason; the computed priority stays beside it, and if a later
            run computes something else the tab says so.</li>
          <li>Measures: those that need a person come first. An unscored one says what evidence would score it:
            score it by hand (with a reason) or accept the gap. Measures Tata enters wait for its entry. Every
            choice says who made it and when, and can be undone.</li>
          <li>Point of View: the written conclusion from its latest assessment, and how many pages arrived after it
            was written.</li>
          <li>Each fabric tab, in order: the measures, the use cases (where the value lands), what could stop it scaling,
            how far Tata has got with it, who owns it and what&apos;s next, and finance. Each part says what it is, what you do
            there and where it shows; click a part&apos;s title to fold it.</li>
          <li>Evidence: Findings are events picked out of its pages (its top 5, in the Briefing&apos;s order; View all opens
            the rest). Pages are every article that mentions it, newest first; &ldquo;new&rdquo; marks pages its assessment
            hasn&apos;t read yet.</li>
        </>}
        right={
          <button type="button" onClick={() => setManage(!manage)} aria-expanded={manage}
            className="text-sm text-link hover:underline">Manage {manage ? "▴" : "▾"}</button>
      }>
        {a && a.fabrics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {a.fabrics.map((f) => <FabricLabel key={f.fabric_id} id={f.fabric_id} name={f.fabric} />)}
          </div>
        )}
        <JourneyLine steps={journey} />
        {s.status && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] ${STATUS_STYLE[s.status.status]}`}>
              {STATUS_LABELS[s.status.status]}
            </span>
            <span className="text-muted">{s.status.reason}</span>
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-azure/30 bg-azure/5 px-4 py-2.5 text-sm">
          <p className="min-w-0 flex-1 basis-72"><b className="font-semibold">Next step:</b> {next}</p>
          {main && <div className="flex flex-wrap items-center gap-3">{main}</div>}
        </div>
        <FindEvidence gap={{ kind: "technology", tech_id: id }} only="past" />
        {a && a.measures.of > 0 && (
          <p className={`mt-1 text-sm ${thin || unplaced.length > 0 ? "text-amber-800" : "text-muted"}`}>
            {a.measures.scored} of {a.measures.of} measures had enough evidence to score
            {unplaced.length > 0 && (unplaced.length === a.fabrics.length
              ? `, so it has no priority yet in ${orList(unplaced)}`
              : `; no priority yet in ${orList(unplaced)}`)}.
            {thin && " Its priority and Point of View rest on thin evidence: each fabric's Details shows what's missing."}
          </p>
        )}
        <p className="mt-1 text-sm text-muted">
          {a && (
            <>
              Assessed {formatDay(a.assessed_at)} · read {plural(a.pages_read, "page")}
              {a.evidence_runs && ` from ${plural(a.evidence_runs.length, "collection")}`}{" · "}
            </>
          )}
          {plural(t.page_count, "page")} from {plural(t.source_count, "source")}, all time
        </p>
        <div className="mt-2 max-w-4xl text-sm text-neutral-700">
          <p className="flex flex-wrap items-baseline gap-x-2 text-muted">
            <span>{t.catalog.in ? "In the catalog" : "Not in the catalog"}
              {t.catalog.decision_id ? "." : t.catalog.in ? (imported ? `, from ${imported.file}.` : ".") : ": found by the radar only."}</span>
            {!t.catalog.decision_id && (
              <ActButton label={t.catalog.in ? "Take out of the catalog" : "Add to the catalog"}
                title="The catalog: Tata's own list of emerging technologies"
                run={() => decide({ kind: "catalog", tech_id: id, value: t.catalog.in ? "no" : "yes" })} onDone={load} />
            )}
          </p>
          {t.catalog.decision_id && t.catalog.at && (
            <DecisionNote what={t.catalog.in ? "Added to the catalog" : "Taken out of the catalog"}
              decision={{ _id: t.catalog.decision_id, at: t.catalog.at, tz: t.catalog.tz ?? null, reason: null }} onUndone={load} />
          )}
        </div>
        {imported?.description && (
          <div className="mt-1 max-w-4xl text-sm text-neutral-700">
            <p className={fullDescription ? "" : "line-clamp-2"}>
              <span className="text-muted">Tata&apos;s description: </span>{imported.description}
            </p>
            {(imported.description?.length ?? 0) > 200 && (
              <button type="button" onClick={() => setFullDescription(!fullDescription)} aria-expanded={fullDescription}
                className="text-[13px] text-link hover:underline">{fullDescription ? "Show less" : "Show all of Tata's description"}</button>
            )}
          </div>
        )}
      </PageHeader>

      {notice && <p className="mt-3 text-xs text-muted">{notice}</p>}

      {s.classification && <TechAnswers techId={id} c={s.classification} cited={s.cited_pages ?? {}} status={status}
        onChanged={load} />}

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
              {t.enabled ? "Switched on: assessment runs assess it"
                : `Switched off${t.switched_off_at ? ` on ${formatAt(t.switched_off_at, t.switched_off_tz)}` : ""}: tick to switch it back on`}
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
          <>
            <p className="mt-1 text-sm text-muted">
              One tab per fabric it was assessed in. What a person decides here (an override, a score by hand, an
              accepted gap) is kept, applies at once with no model call, and is never overwritten by a later run.
            </p>
            <FabricAssessment techId={id} onChanged={load} />
            {(a.not_assessed_in?.length ?? 0) > 0 && (
              <p className="mt-2 text-xs text-muted">
                Not assessed in {orList(a.not_assessed_in!)}: judged not relevant to this technology before scoring.
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 rounded-card border border-line bg-white px-5 py-4 text-sm">Not assessed yet.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Point of View</h2>
        <div className="mt-3 rounded-card border border-line bg-white px-5 py-4 text-sm">
          {s.pov ? (
            <>
              {s.pov.headline && <p className="border-l-2 border-navy pl-3 leading-relaxed text-ink">{s.pov.headline}</p>}
              <p className="mt-2 text-muted">
                Written {formatAt(s.pov.composed_at, s.pov.composed_tz)}
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
        <h2 className="text-lg font-semibold">Evidence</h2>
        <p className="mt-1 text-[13px] text-muted">
          A <b className="font-medium text-ink">page</b> is an article or report the radar collected that mentions {t.name}.
          A <b className="font-medium text-ink">finding</b> is one event the radar picked out of a page, such as a funding round,
          an acquisition or a launch, with why it matters. One page can hold several findings, or none.
        </p>
        <div role="tablist" aria-label="Evidence" className="mt-3 flex flex-wrap gap-1.5">
          {([["findings", `Findings · events (${hitTotal})`], ["pages", `Pages · articles (${total}${
            s.new_pages.since_assessment > 0 && a ? `, ${s.new_pages.since_assessment} new since the assessment` : ""})`]] as const)
            .map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={evidence === key} onClick={() => setEvidence(key)}
                className={`rounded-full border px-3.5 py-1 text-[13px] ${evidence === key ? "border-navy bg-navy text-white" : "border-line bg-white hover:bg-ground"}`}>
                {label}
              </button>
            ))}
        </div>
        {evidence === "findings" ? (
          <div role="tabpanel">
            {hits.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No findings yet.{total > 0 && ` Its ${plural(total, "page")} ${total === 1 ? "is" : "are"} under the Pages tab.`}
              </p>
            ) : (
              <div className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-card border border-line bg-white">
                {hits.map((h) => <SignalItem key={`${h.doc_id}:${h.n}`} item={h} />)}
              </div>
            )}
            {hitTotal > hits.length && (
              <Link href={`/admin?${new URLSearchParams({ tech: t.name, days: "all" })}`} className="mt-2 inline-block text-sm text-link hover:underline">
                Its top {hits.length}, in the Briefing&apos;s order. View all {hitTotal} findings →
              </Link>
            )}
          </div>
        ) : (
          <div role="tabpanel">
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
                      {hood && <span>{d.source_id}</span>}
                      <span>collected {formatTime(d.scraped_at)}</span>
                      {d.found_by && <span className="text-navy">found by Find evidence on {formatAt(d.found_by.at, d.found_by.tz)}</span>}
                      {d.published_date && <span>published {d.published_date}</span>}
                      {d.run_id && <Link href={`/admin/runs/${d.run_id}`} className="hover:underline">
                        {hood ? `collection ${d.run_id}` : "its collection →"}</Link>}
                    </div>
                  </div>
                ))}
                {docs.length === 0 && <p className="px-5 py-6 text-sm text-neutral-500">No pages linked to this technology.</p>}
              </div>
            )}
            {docs && docs.length < total && (
              <button onClick={loadMore} className={`mt-3 ${secondary}`}>Load more ({docs.length} of {total})</button>
            )}
          </div>
        )}
      </section>

      <SignalPanel />
    </div>
  );
}

/** Where a technology is on the radar's journey, one dot per step: filled when done. */
function JourneyLine({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <ol aria-label="Where it is on the radar" className="mt-3 flex flex-wrap items-center gap-y-1.5 text-[13px]">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center">
          {i > 0 && <span aria-hidden className={`mx-2 h-px w-5 sm:w-8 ${step.done ? "bg-navy" : "bg-line"}`} />}
          <span aria-hidden className={`mr-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] ${
            step.done ? "bg-navy text-white" : "border-2 border-line bg-white"}`}>{step.done ? "✓" : ""}</span>
          <span className={step.done ? "text-ink" : "text-muted"}>{step.label}</span>
          <span className="sr-only">{step.done ? ": done" : ": not yet"}</span>
        </li>
      ))}
    </ol>
  );
}

export default function TechnologyPage() {
  return (
    <Suspense fallback={null}>
      <TechnologyHub />
    </Suspense>
  );
}
