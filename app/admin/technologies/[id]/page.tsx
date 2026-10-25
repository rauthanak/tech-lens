"use client";

import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import ActButton from "@/components/ActButton";
import BackendError from "@/components/BackendError";
import BackLink from "@/components/BackLink";
import ConfirmAction from "@/components/ConfirmAction";
import DecisionNote from "@/components/DecisionNote";
import AddEvidence from "@/components/AddEvidence";
import FabricAssessment from "@/components/FabricAssessment";
import FindEvidence from "@/components/FindEvidence";
import TechAnswers from "@/components/TechAnswers";
import TechHistory from "@/components/TechHistory";
import WaitingOnYou from "@/components/WaitingOnYou";
import FabricLabel from "@/components/FabricLabel";
import LookFor from "@/components/LookFor";
import { editionName } from "@/components/PublishEdition";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import SignalItem from "@/components/SignalItem";
import SignalPanel from "@/components/SignalPanel";
import { calls, resumeAssessment, startAssessment, startClassify } from "@/lib/actions";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { formatAt, formatDay, formatTime, orList, plural } from "@/lib/format";
import type { FabricOpen } from "@/lib/open";
import { useHere, withFrom } from "@/lib/here";
import { useHood } from "@/lib/hood";
import { PAGE_SIZE, useStoredStart } from "@/lib/paging";
import { blockedReason, isLive, refreshPipeline, usePipeline } from "@/lib/pipeline";
import { type Axis, HORIZON_TERM, type Placement } from "@/lib/scoring";
import type { FoundHit } from "@/lib/signals";
import { type Catalog, type CitedPage, type Classification, type Status } from "@/lib/classification";
import { decide } from "@/lib/decisions";
import { type Scored, type TechState, thinScoring } from "@/lib/states";
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
  measures: Scored;
};

type Summary = {
  frontier: { edition: string; name: string | null; published_at: string; tz: string | null; placed: boolean } | null; // the latest published edition, and whether it's in it
  technology: { id: string; name: string; aliases: string[]; enabled: boolean; page_count: number; source_count: number;
    switched_off_at?: string | null; switched_off_tz?: string | null; pages_since_off?: number; wake?: boolean;
    imported?: { file: string; at: string; tz: string | null; description: string | null } | null; catalog: Catalog;
    look_for: string[]; look_for_by: string | null; not_a_technology: string | null; mentions: number };
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
  open: FabricOpen[];
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
  copies?: number; // collected more than once (it changed): one row, its newest copy
};

const field = "mt-1 block w-56 rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500";
const secondary = "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-ground disabled:opacity-50";

const FINDINGS = 5; // the top findings, in the Briefing's order; "View all" for the rest

// the assessment, fabric by fabric, is the second tab (its address keeps ?tab=fabrics)
const TABS = [["overview", "Overview"], ["fabrics", "Assessment"], ["evidence", "Evidence"], ["history", "History"]] as const;
type Tab = (typeof TABS)[number][0];

/** Everything about one technology: its journey and next step above every
 *  tab; then Overview (the verdict, the priorities, what waits on you, what
 *  the radar judged), Assessment (fabric by fabric), Evidence
 *  (findings and pages) and History (where its results came from, and what
 *  people decided). A link with ?fabric= opens on Assessment. */
function TechnologyHub() {
  const { id } = useParams<{ id: string }>();
  const here = useHere();
  const label = useTechLabel();
  const hood = useHood();
  const p = usePipeline();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = (TABS.find(([k]) => k === params.get("tab"))?.[0]) ?? (params.get("fabric") ? "fabrics" : "overview");
  const tabHref = (to: Tab, fabric?: string, anchor?: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", to);
    if (fabric) q.set("fabric", fabric);
    return `${pathname}?${q.toString()}${anchor ? `#${anchor}` : ""}`;
  };
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
  }, [id]);
  // its pages, 50 at a time, kept at the same rows when you come back
  const [docStart, setDocStart] = useStoredStart(`tech-pages:${id}`);

  // reload when an assessment run, a classification run or Points of View move on
  const progress = p ? `${p.assess.status}:${p.assess.techs_done}:${p.pov.composed}:${p.classify?.status}:${p.classify?.finished_at}` : "";
  useEffect(() => { load(); }, [load, progress]);
  useEffect(() => {
    const ask = new AbortController();
    fetchJson<{ documents: Doc[]; total: number }>(`/api/technologies/${id}/documents?skip=${docStart}&limit=${PAGE_SIZE}`,
      { signal: ask.signal })
      .then((d) => {
        if (d.total > 0 && docStart >= d.total) { setDocStart(Math.floor((d.total - 1) / PAGE_SIZE) * PAGE_SIZE); return; }
        setDocs(d.documents); setTotal(d.total);
      })
      .catch((e) => { if (!ask.signal.aborted) setError(e); });
    return () => ask.abort();
  }, [id, docStart, setDocStart, progress]);

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
    next = "No pages about it yet, so there's nothing to classify or assess. Find evidence searches the web for pages about it; Add evidence reads links or files you have and can take it on to its Point of View.";
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
    next = `${(s.status?.reason ?? "Its evidence was judged thin").replace(/\.$/, "")}. So it waits before it can be assessed: Find evidence looks for more on the web, or Add evidence reads links or files you have. It can still be assessed as it is.`;
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
      ? `In the leaders' view, in ${editionName(s.frontier)}: ${s.status?.reason}. Anything a person can still settle is under Waiting on you.`
      : status === "placed"
      ? `Placed: ${s.status?.reason}. Leaders see it in the leaders' view once the next edition is published (Briefing › To do › Publish to leaders).`
      : `Held beside the grid: ${s.status?.reason ?? "no fabric could be placed"}. To place it, score a missing measure by hand or find evidence for it in a fabric's tab below, or override its priority.`;
    if (s.pov) main = (
      <Link href={withFrom(`/admin/scoring/pov/${s.pov.scoring_run_id}/${id}`, here)}
        className="rounded-full bg-navy px-4 py-1.5 text-sm text-white hover:bg-navy-strong">Open Point of View</Link>
    );
  }

  const povBlock = s.pov ? (
    <>
      {s.pov.headline && <p className="border-l-2 border-navy pl-3 leading-relaxed text-ink">{s.pov.headline}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href={withFrom(`/admin/scoring/pov/${s.pov.scoring_run_id}/${id}`, here)} className={secondary}>Open the Point of View</Link>
        {a && (
          <ConfirmAction label={s.pov.from_latest_assessment ? "Rewrite" : "Write from the latest assessment"}
            cost={calls(1)} secondary confirmLabel="Write"
            question={`${s.pov.from_latest_assessment ? "Rewrite" : "Write"} the Point of View from the latest assessment? About 1 model call.`}
            onConfirm={writePov} />
        )}
        <span className="text-[13px] text-muted">
          Written {formatAt(s.pov.composed_at, s.pov.composed_tz)}
          {s.pov.from_latest_assessment ? "" : ", from an earlier assessment"}
          {(s.new_pages.since_pov ?? 0) > 0 && ` · ${plural(s.new_pages.since_pov!, "new page")} since it was written`}
        </span>
      </div>
    </>
  ) : (
    <p className="text-sm text-muted">No Point of View yet.{a ? " Write it from the Next step above." : " It can be written once the technology is assessed."}</p>
  );

  return (
    <div>
      <BackLink fallback="/admin/technologies" />
      <PageHeader title={name}
        intro="Everything the radar knows about this technology."
        help={<>
          <li>Above every tab: the fabrics it was assessed in, where it is on the radar&apos;s journey (collected,
            classified, assessed, its Point of View written, in the leaders&apos; view, the screen Tata&apos;s leaders read), and
            the Next step that moves it on; its button shows the cost and asks before starting. Manage renames it,
            merges other names into it or switches it off, at no model cost.</li>
          <li>Overview: the Point of View&apos;s verdict, its priority in each fabric (P1 act now to P6 just watch; H1 near
            to H3 far), and Waiting on you: first what needs a person before its Point of View goes to leaders, then what
            the owner&apos;s record hasn&apos;t got yet. Each item opens the fabric at the part it&apos;s done in.</li>
          <li>Overview also says whether it&apos;s in the catalog, Tata&apos;s own list of emerging technologies (Add to or
            Take out of the catalog, with Undo), and shows what the radar judged: commercial availability, readiness,
            domain and evidence, each with where it came from, Why? (the reason and its pages) and Change.</li>
          <li>Assessment: one tab per fabric it was assessed in, Tata Communications&apos; business areas; a tab&apos;s number
            counts what needs a person there before publishing. Each leads with the priority, why (how soon it arrives
            and how big the prize is) and the three scores the Point of View explains. Override priority sets it by hand,
            with a reason; the computed priority stays beside it.</li>
          <li>The fabric bar stays in view as you scroll. Then, in order: the measures (those that need a person first:
            score by hand, enter your figure, or leave it out), the use cases, Tata&apos;s plan for it (where Tata is on its path
            to scale, then what&apos;s recorded: the step, the owner and next action, the blockers, and people, budget or a
            trial; its title gives the commitment they add up to, the one leaders see). Each
            part&apos;s title says how it stands: amber, something to settle; grey, not recorded yet; green, done. Parts that
            are done start folded. Each says in one line what it is; More says what you do there and where it shows.</li>
          <li>Evidence: findings are events picked out of its pages (its top 5, in the Briefing&apos;s order; View all opens
            the rest). Pages are every article that mentions it, newest first, each once; &ldquo;new&rdquo; marks pages its
            assessment hasn&apos;t read yet.</li>
          <li>History: where its results came from (its latest assessment, the pages and collections it read, its Point of
            View), and every choice people made about it, who made it, when and why, with Undo.</li>
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
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-azure/30 bg-azure/5 px-4 py-2.5 text-sm">
          <p className="min-w-0 flex-1 basis-72"><b className="font-semibold">Next step:</b> {next}</p>
          {main && <div className="flex flex-wrap items-center gap-3">{main}</div>}
        </div>
        {s.state !== "off" && ( // kept while it's assessed: an Add evidence job may be what's assessing it
          <div className="mt-3"><AddEvidence techId={id} name={name} assessCalls={s.estimate.assess_calls} hasPov={!!s.pov} onDone={load} /></div>
        )}
        <FindEvidence gap={{ kind: "technology", tech_id: id }} only="past" />
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

      <nav aria-label="Parts of this page" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([key, label]) => (
          <Link key={key} href={tabHref(key)} scroll={false} replace aria-current={tab === key ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-2 py-2 text-sm sm:px-3.5 ${tab === key ? "border-navy font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {label}
            <span className="ml-1 hidden text-[12px] text-muted min-[380px]:inline sm:ml-1.5">
              {key === "fabrics" && a ? a.fabrics.length : key === "evidence" ? t.page_count.toLocaleString() : ""}
            </span>
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        // at 1280 px and wider, two columns: the verdict and what waits on the left, the facts on the right
        <div className="min-[1280px]:grid min-[1280px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] min-[1280px]:items-start min-[1280px]:gap-6">
          <div className="min-w-0">
          <section className="mt-4 rounded-card border border-line bg-white px-5 py-4">
            <h2 className="font-semibold">Point of View</h2>
            <div className="mt-2">{povBlock}</div>
            {a && a.fabrics.length > 0 && (
              <>
                <h2 className="mt-4 font-semibold">Priority in each fabric</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {a.fabrics.map((f) => (
                    <li key={f.fabric_id}>
                      <Link href={tabHref("fabrics", f.fabric_id)} className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[13px] hover:bg-ground">
                        {f.fabric}
                        <span className={`px-1.5 font-mono ${f.priority ? PRIORITY[f.priority] : "text-neutral-400"}`}>{f.priority ?? "none"}</span>
                        {f.horizon && <span className="text-muted">{HORIZON_TERM[f.horizon] ?? f.horizon}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[12px] text-muted">P1 act now to P6 just watch. Click a fabric for why, and to change it.</p>
              </>
            )}
            {a && a.measures.of > 0 && (
              <p className={`mt-2 text-sm ${thin || unplaced.length > 0 ? "text-amber-800" : "text-muted"}`}>
                {a.measures.scored} of {a.measures.of} measures scored
                {(a.measures.waiting ?? 0) > 0 && `; ${a.measures.waiting} wait for your figures (Disruption threat, Serviceable capture)`}
                {a.measures.of - a.measures.scored - (a.measures.waiting ?? 0) > 0
                  && `; ${a.measures.of - a.measures.scored - (a.measures.waiting ?? 0)} had too little evidence`}
                {unplaced.length > 0 && (unplaced.length === a.fabrics.length
                  ? `, so it has no priority yet in ${orList(unplaced)}`
                  : `; no priority yet in ${orList(unplaced)}`)}.
                {thin && " Its priority and Point of View rest on thin evidence: each fabric's measures show what's missing."}
              </p>
            )}
          </section>

          {a && s.open.length > 0 && <WaitingOnYou open={s.open} href={(f, anchor) => tabHref("fabrics", f, anchor)} />}
          </div>

          <aside className="min-w-0 min-[1280px]:mt-4" aria-label="What it is">
          {s.classification && <TechAnswers techId={id} c={s.classification} cited={s.cited_pages ?? {}} status={status}
            onChanged={load} narrow />}
          <div className="mt-6 max-w-4xl text-sm text-neutral-700 min-[1280px]:mt-4">
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
              <p className={fullDescription ? "" : "line-clamp-3"}>
                <span className="text-muted">Tata&apos;s description: </span>{imported.description}
              </p>
              {(imported.description?.length ?? 0) > 200 && (
                <button type="button" onClick={() => setFullDescription(!fullDescription)} aria-expanded={fullDescription}
                  className="text-[13px] text-link hover:underline">{fullDescription ? "Show less" : "Show all of Tata's description"}</button>
              )}
            </div>
          )}

          <LookFor techId={id} names={t.look_for} by={t.look_for_by} mentions={t.mentions}
            notATechnology={t.catalog.in ? t.not_a_technology : null} onSaved={load} />
          </aside>
        </div>
      )}

      {tab === "fabrics" && (
        <section className="mt-4">
          {a ? (
            <>
              <p className="text-sm text-muted">
                What a person decides here applies at once and is never overwritten by a later run.
              </p>
              <FabricAssessment techId={id} open={s.open} notAssessedIn={a.not_assessed_in} onChanged={load} />
            </>
          ) : (
            <p className="rounded-card border border-line bg-white px-5 py-4 text-sm">Not assessed yet: the Next step above says what moves it on.</p>
          )}
        </section>
      )}

      {tab === "evidence" && (
        <section className="mt-4">
          <p className="text-[13px] text-muted">
            {plural(t.page_count, "page")} from {plural(t.source_count, "source")}, all time. A{" "}
            <b className="font-medium text-ink">page</b> is an article or report the radar collected that mentions {t.name}.
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
              {docs && <Pager className="mt-3" start={docStart} total={total} go={setDocStart} what="pages" />}
              {docs && (
                <div className="mt-3 divide-y divide-neutral-100 rounded-card border border-line bg-white">
                  {docs.map((d) => (
                    <div key={d.id} className="px-5 py-3.5">
                      <div className="flex items-baseline gap-3">
                        <span className="min-w-0 flex-1 truncate font-medium">{d.title || d.end_url.replace(/^https?:\/\//, "")}</span>
                        {d.new && <span className="shrink-0 rounded-full bg-azure/10 px-2 py-0.5 text-[11px] text-ink">new</span>}
                        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[12px] text-neutral-600">{({ article: "Article", pdf: "PDF", document: "Document" } as Record<string, string>)[d.kind ?? "article"] ?? d.kind}</span>
                      </div>
                      <a href={d.end_url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate font-mono text-xs text-link hover:underline">
                        {d.end_url}
                      </a>
                      {d.summary_text && <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{d.summary_text}</p>}
                      <div className="mt-1.5 flex flex-wrap gap-x-4 font-mono text-[11px] text-neutral-500">
                        {hood && <span>{d.source_id}</span>}
                        <span>collected {formatTime(d.scraped_at)}{(d.copies ?? 1) > 1 && ` (${d.copies} times in all)`}</span>
                        {d.found_by && <span className="text-navy">found by Find evidence on {formatAt(d.found_by.at, d.found_by.tz)}</span>}
                        {d.published_date && <span>published {formatDay(d.published_date)}</span>}
                        {d.run_id && <Link href={`/admin/runs/${d.run_id}`} className="hover:underline">
                          {hood ? `collection ${d.run_id}` : "its collection →"}</Link>}
                      </div>
                    </div>
                  ))}
                  {docs.length === 0 && <p className="px-5 py-6 text-sm text-neutral-500">No pages linked to this technology.</p>}
                </div>
              )}
              {docs && <Pager className="mt-3" start={docStart} total={total} go={setDocStart} what="pages" />}
            </div>
          )}
        </section>
      )}

      {tab === "history" && (
        <TechHistory techId={id} assessment={a} pages={t.page_count} newPages={s.new_pages.since_assessment}
          pov={s.pov} classifiedAt={s.classification?.classified_at} onChanged={load} />
      )}

      <SignalPanel />
    </div>
  );
}

/** Where a technology is on the radar's journey, one dot per step: filled when done. */
function JourneyLine({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <ol aria-label="Where it is on the radar" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] sm:gap-x-0">
      {/* on a phone the steps wrap, so no connecting line: one would start the second line */}
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center">
          {i > 0 && <span aria-hidden className={`mx-2 hidden h-px w-8 sm:block ${step.done ? "bg-navy" : "bg-line"}`} />}
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
